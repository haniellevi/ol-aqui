-- VOLTAR pelo WhatsApp, ajustes depois da revisão do Codex (29/11/2026). Substitui funções da 20261129010000 (create or replace).
-- 1. Repetição (whatsapp_ultima_mensagem) vale só para outra mensagem. VOLTAR e SIM são sempre reavaliados contra as
--    preferências atuais, e apagam o resumo guardado do número (para não afetar a próxima outra mensagem).
--    Os limites de resposta continuam valendo (uma por tipo e dia, exceto a confirmação da volta, que sai uma por ativação; no máximo 3 por número e dia).
-- 2. whatsapp_sair apaga o resumo guardado do número (as duas formas, com e sem o 9). Mesmo texto e mesma trava da 010000.
-- 3. Confirmação da volta com chave única por ativação (voltar + hora com microssegundos): VOLTAR -> SAIR -> VOLTAR no mesmo dia
--    manda a segunda confirmação. Continua sujeita ao limite de 3 por número e dia.
-- 4. Limpeza do resumo a cada hora pelo pg_cron (independe do tráfego). Função interna, sem grant a anon, authenticated ou service_role.
-- Não altera tabelas nem dados. Não manda mensagem por si só.

-- ---------------------------------------------------------------------
-- 1. Mensagem recebida: repetição só para outra; VOLTAR e SIM sempre avaliados
-- ---------------------------------------------------------------------
create or replace function public.whatsapp_mensagem_recebida(p_numero text, p_intencao text, p_hash text)
returns text
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  uid text;
  numero13 text;
  variantes text[];
  radar_ligado boolean;
  pref_ligada boolean;
  pref_existe boolean;
  sino_desligado boolean;
  pref_mudou_em timestamptz;
  ultima_saida timestamptz;
  ultimo_voltar timestamptz;
  ultima_pergunta timestamptz;
  saiu boolean;
  pergunta_pendente boolean;
  hash_anterior text;
  recebido_anterior timestamptz;
  resultado text;
begin
  if coalesce(auth.role(), '') <> 'service_role' and session_user not in ('postgres', 'supabase_admin') then
    raise exception 'Acesso restrito.' using errcode = '42501';
  end if;
  if p_numero is null or p_numero !~ '^55[1-9][0-9]9?[0-9]{8}$' or p_intencao not in ('voltar', 'sim', 'outra')
     or p_hash is null or p_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Mensagem recebida inválida.' using errcode = '22023';
  end if;
  variantes := case when length(p_numero) = 13
                    then array[p_numero, substr(p_numero, 1, 4) || substr(p_numero, 6)]
                    else array[p_numero, substr(p_numero, 1, 4) || '9' || substr(p_numero, 5)] end;
  numero13 := case when length(p_numero) = 13 then p_numero else substr(p_numero, 1, 4) || '9' || substr(p_numero, 5) end;

  -- Conta com o número confirmado (com ou sem o 9). Sem conta, número não confirmado ou conta revogada: nada.
  -- Se houver mais de uma conta com o número, vale a de menor id (o cadastro de WhatsApp é único: whatsapp_vinculos).
  select pf.id into uid from public.perfis pf
   where pf.whatsapp = any(variantes) and pf.whatsapp_verificado_em is not null
     and not exists (select 1 from public.contas_revogadas r where r.usuario_id = pf.id)
   order by pf.id limit 1;
  if uid is null then return 'sem_conta'; end if;

  -- Uma decisão por vez por conta: mensagens simultâneas não geram duas respostas nem duas ativações.
  perform pg_advisory_xact_lock(hashtext('whatsapp_voltar:' || uid));

  -- Repetição (bot ou toque repetido): só vale para outra mensagem, em até 1 dia. Só o resumo fica guardado.
  -- VOLTAR e SIM não passam por aqui: são avaliados sempre, e apagam o resumo do número para não afetar a próxima outra.
  if p_intencao = 'outra' then
    delete from public.whatsapp_ultima_mensagem where recebido_em < now() - interval '1 day';
    select u.hash, u.recebido_em into hash_anterior, recebido_anterior
      from public.whatsapp_ultima_mensagem u where u.numero = numero13;
    insert into public.whatsapp_ultima_mensagem (numero, hash, recebido_em) values (numero13, p_hash, clock_timestamp())
      on conflict (numero) do update set hash = excluded.hash, recebido_em = excluded.recebido_em;
    if hash_anterior = p_hash and recebido_anterior > now() - interval '1 day' then
      return 'mensagem_repetida';
    end if;
  else
    delete from public.whatsapp_ultima_mensagem where numero = numero13;
  end if;

  radar_ligado := public.config('radar.whatsapp_ativo', null, 'false'::jsonb) = 'true'::jsonb;
  select exists (select 1 from public.preferencias_avisos pa
                  where pa.usuario_id = uid and pa.tipo = 'pedido_novo' and pa.canal = 'whatsapp' and pa.ligado) into pref_ligada;
  select exists (select 1 from public.preferencias_avisos pa
                  where pa.usuario_id = uid and pa.tipo = 'pedido_novo' and pa.canal = 'whatsapp') into pref_existe;
  -- Sino do pedido novo no app. Desligado de propósito: o WhatsApp não sai (o Radar pula a loja), então a volta não liga nada.
  select exists (select 1 from public.preferencias_avisos pa
                  where pa.usuario_id = uid and pa.tipo = 'pedido_novo' and pa.canal = 'app' and not pa.ligado) into sino_desligado;
  select pa.atualizado_em into pref_mudou_em from public.preferencias_avisos pa
   where pa.usuario_id = uid and pa.tipo = 'pedido_novo' and pa.canal = 'whatsapp';
  select max(r.criado_em) into ultima_saida from public.whatsapp_respostas r
   where r.usuario_id = uid and r.comando in ('SAIR', 'PARAR', 'STOP', 'CANCELAR');
  select max(r.criado_em) into ultimo_voltar from public.whatsapp_respostas r
   where r.usuario_id = uid and r.comando = 'VOLTAR';
  select max(r.criado_em) into ultima_pergunta from public.whatsapp_respostas r
   where r.usuario_id = uid and r.comando = 'PERGUNTA_VOLTAR';
  -- Quem saiu: a última decisão foi uma saída. Se a pessoa mexeu no aviso depois pelo site, a decisão foi essa, não a saída.
  saiu := ultima_saida is not null and (ultimo_voltar is null or ultimo_voltar < ultima_saida)
          and (pref_mudou_em is null or pref_mudou_em <= ultima_saida);
  -- Pergunta pendente: feita nos últimos 7 dias e sem resposta depois (volta ou nova saída).
  pergunta_pendente := ultima_pergunta is not null and ultima_pergunta > now() - interval '7 days'
    and not exists (select 1 from public.whatsapp_respostas r
                     where r.usuario_id = uid and r.criado_em > ultima_pergunta
                       and r.comando in ('VOLTAR', 'SAIR', 'PARAR', 'STOP', 'CANCELAR'));

  -- VOLTAR, ou SIM depois de uma pergunta pendente
  if p_intencao = 'voltar' or (p_intencao = 'sim' and pergunta_pendente) then
    if not radar_ligado then
      perform public.whatsapp_resposta_automatica(uid, p_numero, 'pausado', 'No momento os avisos do Radar pelo WhatsApp estão pausados.');
      return 'pausado';
    end if;
    -- Quem nunca teve o aviso não é ligado pelo WhatsApp: recebe a orientação de ligar pelo site
    if not pref_existe and ultima_saida is null then
      perform public.whatsapp_resposta_automatica(uid, p_numero, 'orientacao', 'Para receber pedidos do Radar no WhatsApp, ligue em Minha conta > Notificações no Mercado da Região.');
      return 'orientacao';
    end if;
    -- Sino do app desligado pela pessoa: não mexe nele. Pede para ligar o sino antes (ele vale para o WhatsApp também).
    if sino_desligado then
      perform public.whatsapp_resposta_automatica(uid, p_numero, 'sino', 'Para voltar a receber pedidos do Radar pelo WhatsApp, ligue antes o aviso de pedido novo no app em Minha conta > Notificações. Depois responda VOLTAR.');
      return 'sino_desligado';
    end if;
    -- Com o sino ligado (ou sem linha, que quer dizer ligado), o aviso do Radar só liga no WhatsApp
    if pref_ligada then
      perform public.whatsapp_resposta_automatica(uid, p_numero, 'ja_ativo', 'Você já recebe os pedidos do Radar pelo WhatsApp, das 8h às 20h. Para parar, responda SAIR.');
      return 'ja_ativo';
    end if;
    insert into public.preferencias_avisos (usuario_id, tipo, canal, ligado, atualizado_em)
    values (uid, 'pedido_novo', 'whatsapp', true, now())
    on conflict (usuario_id, tipo, canal) do update set ligado = true, atualizado_em = now();
    insert into public.whatsapp_respostas (usuario_id, comando) values (uid, 'VOLTAR');
    -- Chave única por ativação: a confirmação sai mesmo que já tenha saído outra no mesmo dia (VOLTAR -> SAIR -> VOLTAR).
    perform public.whatsapp_resposta_automatica(uid, p_numero, 'voltar' || to_char(clock_timestamp(), 'HH24MISSUS'), 'Pronto! Você volta a receber pedidos do Radar pelo WhatsApp, das 8h às 20h. Para parar, responda SAIR.');
    return 'voltou';
  end if;

  -- SIM sem pergunta pendente não faz nada (pedido: "fora disso, SIM não faz nada")
  if p_intencao = 'sim' then return 'nada'; end if;

  -- Outra mensagem: quem saiu e ainda não voltou recebe UMA pergunta a cada 7 dias (com o Radar ligado; senão, nada a oferecer)
  if saiu and not pref_ligada and radar_ligado then
    if ultima_pergunta is not null and ultima_pergunta > now() - interval '7 days' then
      return 'ja_perguntou';
    end if;
    resultado := public.whatsapp_resposta_automatica(uid, p_numero, 'pergunta', 'Oi! Você pediu para não receber pedidos do Radar pelo WhatsApp. Quer voltar a receber? Responda SIM.');
    if resultado <> 'enviada' then return resultado; end if;
    insert into public.whatsapp_respostas (usuario_id, comando) values (uid, 'PERGUNTA_VOLTAR');
    return 'pergunta';
  end if;
  return 'nada';
end $$;

-- ---------------------------------------------------------------------
-- 2. SAIR / PARAR / STOP / CANCELAR: igual à 20261129010000, mais a limpeza do resumo do número (as duas formas)
-- ---------------------------------------------------------------------
create or replace function public.whatsapp_sair(p_numero text, p_comando text)
returns boolean language plpgsql security definer
set search_path = public, extensions
as $$
declare
  alvo record;
  achou boolean := false;
  primeiro text;
  variantes text[];
  numero13 text;
begin
  if coalesce(auth.role(), '') <> 'service_role' and session_user not in ('postgres', 'supabase_admin') then
    raise exception 'Acesso restrito.' using errcode = '42501';
  end if;
  if p_numero is null or p_numero !~ '^55[1-9][0-9]9?[0-9]{8}$' or p_comando not in ('SAIR', 'PARAR', 'STOP', 'CANCELAR') then
    raise exception 'Pedido de saída inválido.' using errcode = '22023';
  end if;
  -- 13 dígitos (com o 9): a outra forma tira o 9 da 5ª posição; 12 dígitos (sem o 9): a outra põe
  variantes := case when length(p_numero) = 13
                    then array[p_numero, substr(p_numero, 1, 4) || substr(p_numero, 6)]
                    else array[p_numero, substr(p_numero, 1, 4) || '9' || substr(p_numero, 5)] end;
  numero13 := case when length(p_numero) = 13 then p_numero else substr(p_numero, 1, 4) || '9' || substr(p_numero, 5) end;
  for alvo in select distinct pf.id from public.perfis pf where pf.whatsapp = any(variantes) order by pf.id loop
    achou := true;
    primeiro := coalesce(primeiro, alvo.id);
    -- Mesma trava da volta (whatsapp_mensagem_recebida): saída e volta da mesma conta não se misturam
    perform pg_advisory_xact_lock(hashtext('whatsapp_voltar:' || alvo.id));
    insert into public.preferencias_avisos (usuario_id, tipo, canal, ligado, atualizado_em)
    values (alvo.id, 'pedido_novo', 'whatsapp', false, now())
    on conflict (usuario_id, tipo, canal) do update set ligado = false, atualizado_em = now();
    update public.whatsapp_fila f set estado = 'cancelada', erro = 'saiu'
     where f.usuario_id = alvo.id and f.estado = 'pendente' and f.chave like 'radar_pedido_novo:%';
    insert into public.whatsapp_respostas (usuario_id, comando) values (alvo.id, p_comando);
  end loop;
  -- Saída apaga o resumo da última mensagem deste número (as duas formas), para a próxima mensagem não ser tomada como repetida.
  delete from public.whatsapp_ultima_mensagem where numero = any(variantes);
  -- Resposta de confirmação: sai na hora (fora da janela também), uma por número e dia, e o Radar não a cancela.
  if achou then
    insert into public.whatsapp_fila (usuario_id, numero, texto, link, chave, enviar_apos)
    values (primeiro, p_numero,
            'Pronto. Você não vai mais receber pedidos do Radar pelo WhatsApp. Para voltar, responda VOLTAR aqui ou ligue em Minha conta > Notificações.',
            null,
            'whatsapp_saida:' || numero13 || ':' || to_char(now() at time zone 'America/Fortaleza', 'YYYY-MM-DD'),
            now())
    on conflict (chave) where chave is not null do nothing;
  end if;
  return achou;
end $$;

-- ---------------------------------------------------------------------
-- 3. Limpeza do resumo: apaga o que tem mais de 1 dia. Função interna (só o agendador chama).
-- ---------------------------------------------------------------------
create or replace function public.whatsapp_ultima_mensagem_limpar()
returns integer
language plpgsql security definer
set search_path = public, extensions
as $$
declare apagadas integer;
begin
  delete from public.whatsapp_ultima_mensagem where recebido_em < now() - interval '1 day';
  get diagnostics apagadas = row_count;
  return apagadas;
end $$;

-- ---------------------------------------------------------------------
-- 4. Permissões: a decisão e a limpeza são do servidor; nada para a conta nem para o visitante
-- ---------------------------------------------------------------------
revoke all on function public.whatsapp_mensagem_recebida(text, text, text) from public, anon, authenticated;
grant execute on function public.whatsapp_mensagem_recebida(text, text, text) to service_role;
revoke all on function public.whatsapp_sair(text, text) from public, anon, authenticated;
grant execute on function public.whatsapp_sair(text, text) to service_role;
revoke all on function public.whatsapp_ultima_mensagem_limpar() from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- 5. Agenda: de hora em hora, independente de mensagem chegar. Sem pg_cron, nada é agendado (a repetição já ignora o resumo velho).
-- ---------------------------------------------------------------------
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'olaki-whatsapp-ultima-mensagem-limpar') then
      perform cron.unschedule('olaki-whatsapp-ultima-mensagem-limpar');
    end if;
    perform cron.schedule('olaki-whatsapp-ultima-mensagem-limpar', '0 * * * *', 'select public.whatsapp_ultima_mensagem_limpar()');
  end if;
end $$;
