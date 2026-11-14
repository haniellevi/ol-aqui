-- VOLTAR pelo WhatsApp (29/11/2026). Só mexe em funções e na lista de comandos guardados; não altera dados existentes.
-- 1. whatsapp_respostas: aceita VOLTAR (a pessoa ligou o aviso de volta) e PERGUNTA_VOLTAR (a pergunta "quer voltar?").
--    criado_em passa a usar clock_timestamp(): duas mensagens na mesma transação continuam em ordem.
-- 2. whatsapp_fila_pegar_em: a resposta automática do WhatsApp (chave whatsapp_resposta:) sai fora da janela, como a de SAIR.
-- 3. whatsapp_sair: a confirmação passa a dizer "Para voltar, responda VOLTAR aqui ou ligue em Minha conta > Notificações."
-- 4. whatsapp_resposta_automatica: uma resposta por tipo e dia, no máximo 3 respostas automáticas por número e dia.
-- 5. whatsapp_mensagem_recebida: decide VOLTAR, SIM e as outras mensagens numa transação, com trava por conta.
-- Não manda mensagem por si só: quem envia é a fila (rota interna), com a conferência de sempre.

-- ---------------------------------------------------------------------
-- 1. Comandos guardados e ordem certa
-- ---------------------------------------------------------------------
alter table public.whatsapp_respostas drop constraint if exists whatsapp_respostas_comando_check;
alter table public.whatsapp_respostas add constraint whatsapp_respostas_comando_check
  check (comando in ('SAIR', 'PARAR', 'STOP', 'CANCELAR', 'VOLTAR', 'PERGUNTA_VOLTAR'));
alter table public.whatsapp_respostas alter column criado_em set default clock_timestamp();
create index if not exists whatsapp_respostas_usuario_idx on public.whatsapp_respostas (usuario_id, criado_em desc);

-- ---------------------------------------------------------------------
-- 2. Fila: fora da janela de 8h às 20h saem a resposta de SAIR e as respostas automáticas (chaves whatsapp_saida: e whatsapp_resposta:)
-- ---------------------------------------------------------------------
create or replace function public.whatsapp_fila_pegar_em(p_limite integer, p_quando timestamptz)
returns table (id uuid, numero text, texto text, link text, tentativas smallint)
language plpgsql
set search_path = public, extensions
as $$
declare
  radar_ligado boolean := public.config('radar.whatsapp_ativo', null, 'false'::jsonb) = 'true'::jsonb;
  dentro_janela boolean := public.proxima_janela_whatsapp(p_quando) = p_quando;
begin
  update public.whatsapp_fila f set estado = 'incerta', erro = 'travada'
   where f.estado = 'enviando' and f.enviar_apos < p_quando - interval '10 minutes';
  -- Aviso do Radar de pedido que não aceita mais proposta não sai (fechado, vencido, prazo de propostas acabou
  -- ou limite de propostas cheio): mesmas regras de radar_avisar_pedido_novo. O id do pedido está na chave.
  update public.whatsapp_fila f set estado = 'cancelada', erro = 'pedido_fechado'
   where f.estado = 'pendente' and f.chave like 'radar_pedido_novo:%'
     and not exists (
       select 1 from public.radar_pedidos rp
        where rp.id::text = substring(f.chave from '^radar_pedido_novo:([0-9a-f-]{36}):')
          and rp.status = 'aberto' and rp.expira_em > p_quando
          and rp.total_propostas < rp.max_propostas
          and (rp.modo_contato <> 'propostas_prazo' or (rp.propostas_ate is not null and rp.propostas_ate > p_quando)));
  -- Aviso do Radar de quem desligou (SAIR ou Minha conta) não sai mais
  update public.whatsapp_fila f set estado = 'cancelada', erro = 'radar_desligado'
   where f.estado = 'pendente' and f.chave like 'radar_pedido_novo:%'
     and not exists (select 1 from public.preferencias_avisos pa
                      where pa.usuario_id = f.usuario_id and pa.tipo = 'pedido_novo' and pa.canal = 'whatsapp' and pa.ligado);
  return query
    update public.whatsapp_fila f set estado = 'enviando', tentativas = f.tentativas + 1, enviar_apos = p_quando
     where f.id in (
       select x.id from public.whatsapp_fila x
        where x.estado = 'pendente' and x.enviar_apos <= p_quando
          and (dentro_janela or x.chave like 'whatsapp_saida:%' or x.chave like 'whatsapp_resposta:%')
          and (radar_ligado or x.chave is null or x.chave not like 'radar_pedido_novo:%')
        order by x.enviar_apos, x.criado_em
        limit greatest(least(coalesce(p_limite, 5), 5), 1)
        for update skip locked)
    returning f.id, f.numero, f.texto, f.link, f.tentativas;
end $$;

-- ---------------------------------------------------------------------
-- 3. SAIR / PARAR / STOP / CANCELAR: igual à 20261128040000, com a volta na resposta
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
    insert into public.preferencias_avisos (usuario_id, tipo, canal, ligado, atualizado_em)
    values (alvo.id, 'pedido_novo', 'whatsapp', false, now())
    on conflict (usuario_id, tipo, canal) do update set ligado = false, atualizado_em = now();
    update public.whatsapp_fila f set estado = 'cancelada', erro = 'saiu'
     where f.usuario_id = alvo.id and f.estado = 'pendente' and f.chave like 'radar_pedido_novo:%';
    insert into public.whatsapp_respostas (usuario_id, comando) values (alvo.id, p_comando);
  end loop;
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
-- 4. Resposta automática: uma por tipo e dia; no máximo 3 respostas automáticas por número e dia (saída, volta, pergunta, orientação)
-- ---------------------------------------------------------------------
-- Devolve 'enviada', 'repetida' (já foi hoje, mesmo tipo) ou 'limite' (3 neste dia). Só é chamada por whatsapp_mensagem_recebida.
create function public.whatsapp_resposta_automatica(p_uid text, p_numero text, p_tipo text, p_texto text)
returns text
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  numero13 text := case when length(p_numero) = 13 then p_numero else substr(p_numero, 1, 4) || '9' || substr(p_numero, 5) end;
  variantes text[] := case when length(p_numero) = 13
                           then array[p_numero, substr(p_numero, 1, 4) || substr(p_numero, 6)]
                           else array[p_numero, substr(p_numero, 1, 4) || '9' || substr(p_numero, 5)] end;
  inicio timestamptz := date_trunc('day', now() at time zone 'America/Fortaleza') at time zone 'America/Fortaleza';
  inseridas integer;
begin
  if (select count(*) from public.whatsapp_fila f
       where f.numero = any(variantes) and f.criado_em >= inicio
         and (f.chave like 'whatsapp_saida:%' or f.chave like 'whatsapp_resposta:%')) >= 3 then
    return 'limite';
  end if;
  insert into public.whatsapp_fila (usuario_id, numero, texto, link, chave, enviar_apos)
  values (p_uid, p_numero, p_texto, null,
          'whatsapp_resposta:' || numero13 || ':' || p_tipo || ':' || to_char(now() at time zone 'America/Fortaleza', 'YYYY-MM-DD'),
          now())
  on conflict (chave) where chave is not null do nothing;
  get diagnostics inseridas = row_count;
  return case when inseridas > 0 then 'enviada' else 'repetida' end;
end $$;

-- ---------------------------------------------------------------------
-- 5. Mensagem recebida de pessoa: VOLTAR, SIM ou outra (o servidor classifica o texto e não guarda o texto)
-- ---------------------------------------------------------------------
-- Devolve: 'sem_conta' (número sem conta confirmada ou conta revogada: nada), 'pausado' (chave geral desligada),
-- 'orientacao' (nunca teve o aviso), 'ja_ativo', 'voltou', 'pergunta', 'ja_perguntou' (pergunta dos últimos 7 dias),
-- 'nada', ou o motivo do limite/repetição da resposta ('limite', 'repetida').
create function public.whatsapp_mensagem_recebida(p_numero text, p_intencao text)
returns text
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  uid text;
  variantes text[];
  radar_ligado boolean;
  pref_ligada boolean;
  pref_existe boolean;
  ultima_saida timestamptz;
  ultimo_voltar timestamptz;
  ultima_pergunta timestamptz;
  saiu boolean;
  pergunta_pendente boolean;
  resultado text;
begin
  if coalesce(auth.role(), '') <> 'service_role' and session_user not in ('postgres', 'supabase_admin') then
    raise exception 'Acesso restrito.' using errcode = '42501';
  end if;
  if p_numero is null or p_numero !~ '^55[1-9][0-9]9?[0-9]{8}$' or p_intencao not in ('voltar', 'sim', 'outra') then
    raise exception 'Mensagem recebida inválida.' using errcode = '22023';
  end if;
  variantes := case when length(p_numero) = 13
                    then array[p_numero, substr(p_numero, 1, 4) || substr(p_numero, 6)]
                    else array[p_numero, substr(p_numero, 1, 4) || '9' || substr(p_numero, 5)] end;

  -- Conta com o número confirmado (com ou sem o 9). Sem conta, número não confirmado ou conta revogada: nada.
  select pf.id into uid from public.perfis pf
   where pf.whatsapp = any(variantes) and pf.whatsapp_verificado_em is not null
     and not exists (select 1 from public.contas_revogadas r where r.usuario_id = pf.id)
   order by pf.id limit 1;
  if uid is null then return 'sem_conta'; end if;

  -- Uma decisão por vez por conta: mensagens simultâneas não geram duas respostas nem duas ativações.
  perform pg_advisory_xact_lock(hashtext('whatsapp_voltar:' || uid));

  radar_ligado := public.config('radar.whatsapp_ativo', null, 'false'::jsonb) = 'true'::jsonb;
  select exists (select 1 from public.preferencias_avisos pa
                  where pa.usuario_id = uid and pa.tipo = 'pedido_novo' and pa.canal = 'whatsapp' and pa.ligado) into pref_ligada;
  select exists (select 1 from public.preferencias_avisos pa
                  where pa.usuario_id = uid and pa.tipo = 'pedido_novo' and pa.canal = 'whatsapp') into pref_existe;
  select max(r.criado_em) into ultima_saida from public.whatsapp_respostas r
   where r.usuario_id = uid and r.comando in ('SAIR', 'PARAR', 'STOP', 'CANCELAR');
  select max(r.criado_em) into ultimo_voltar from public.whatsapp_respostas r
   where r.usuario_id = uid and r.comando = 'VOLTAR';
  select max(r.criado_em) into ultima_pergunta from public.whatsapp_respostas r
   where r.usuario_id = uid and r.comando = 'PERGUNTA_VOLTAR';
  -- Quem saiu: a última ação registrada é uma saída, não uma volta.
  saiu := ultima_saida is not null and (ultimo_voltar is null or ultimo_voltar < ultima_saida);
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
    if pref_ligada then
      perform public.whatsapp_resposta_automatica(uid, p_numero, 'ja_ativo', 'Você já recebe os pedidos do Radar pelo WhatsApp, das 8h às 20h. Para parar, responda SAIR.');
      return 'ja_ativo';
    end if;
    -- Volta: liga o aviso no WhatsApp e o sino do pedido novo (o WhatsApp só sai com o sino ligado)
    insert into public.preferencias_avisos (usuario_id, tipo, canal, ligado, atualizado_em)
    values (uid, 'pedido_novo', 'whatsapp', true, now())
    on conflict (usuario_id, tipo, canal) do update set ligado = true, atualizado_em = now();
    insert into public.preferencias_avisos (usuario_id, tipo, canal, ligado, atualizado_em)
    values (uid, 'pedido_novo', 'app', true, now())
    on conflict (usuario_id, tipo, canal) do update set ligado = true, atualizado_em = now();
    insert into public.whatsapp_respostas (usuario_id, comando) values (uid, 'VOLTAR');
    perform public.whatsapp_resposta_automatica(uid, p_numero, 'voltar', 'Pronto! Você volta a receber pedidos do Radar pelo WhatsApp, das 8h às 20h. Para parar, responda SAIR.');
    return 'voltou';
  end if;

  -- Outra mensagem (ou SIM sem pergunta pendente): quem saiu e ainda não voltou recebe UMA pergunta a cada 7 dias
  if saiu and not pref_ligada then
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
-- 6. Permissões: só o servidor chama; a resposta automática é interna
-- ---------------------------------------------------------------------
revoke all on function public.whatsapp_mensagem_recebida(text, text) from public, anon, authenticated;
grant execute on function public.whatsapp_mensagem_recebida(text, text) to service_role;
revoke all on function public.whatsapp_resposta_automatica(text, text, text, text) from public, anon, authenticated, service_role;
revoke all on function public.whatsapp_sair(text, text) from public, anon, authenticated;
grant execute on function public.whatsapp_sair(text, text) to service_role;
revoke all on function public.whatsapp_fila_pegar_em(integer, timestamptz) from public, anon, authenticated, service_role;
