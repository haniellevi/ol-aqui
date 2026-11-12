-- Fila de WhatsApp e avisos da verificação de lojas (para a loja e para a equipe).
-- As chaves verificacao.whatsapp_equipe e verificacao.whatsapp_loja já existem (desligadas de fábrica):
-- desligadas, nada entra na fila de WhatsApp. O aviso no sino da loja sai de qualquer jeito.

-- ---------------------------------------------------------------------
-- 1. Fila de WhatsApp (só o servidor lê e grava)
-- ---------------------------------------------------------------------
create table public.whatsapp_fila (
  id uuid primary key default gen_random_uuid(),
  usuario_id text not null references public.perfis(id) on delete cascade,
  numero text not null check (numero ~ '^55[1-9][0-9]9?[0-9]{8}$'),
  texto text not null check (char_length(texto) between 2 and 1000),
  link text check (link ~ '^/'),
  chave text,
  enviar_apos timestamptz not null default now(),
  tentativas smallint not null default 0,
  estado text not null default 'pendente' check (estado in ('pendente', 'enviando', 'enviada', 'falha', 'incerta')),
  erro text,
  criado_em timestamptz not null default now(),
  enviada_em timestamptz
);
create unique index whatsapp_fila_chave_idx on public.whatsapp_fila (chave) where chave is not null;
create index whatsapp_fila_pendente_idx on public.whatsapp_fila (enviar_apos) where estado = 'pendente';
alter table public.whatsapp_fila enable row level security;
revoke all on public.whatsapp_fila from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- 2. Janela de envio: das 8h às 20h de Fortaleza
-- ---------------------------------------------------------------------
create function public.proxima_janela_whatsapp(p_quando timestamptz default now())
returns timestamptz language plpgsql stable
set search_path = public, extensions
as $$
declare local_ timestamp := p_quando at time zone 'America/Fortaleza';
begin
  if local_::time >= time '08:00' and local_::time < time '20:00' then return p_quando; end if;
  if local_::time < time '08:00' then
    return (date_trunc('day', local_) + interval '8 hours') at time zone 'America/Fortaleza';
  end if;
  return (date_trunc('day', local_) + interval '1 day 8 hours') at time zone 'America/Fortaleza';
end $$;

-- Coloca uma mensagem na fila. Só com WhatsApp confirmado; a mesma chave nunca entra duas vezes.
create function public.whatsapp_enfileirar(p_usuario text, p_texto text, p_link text, p_chave text)
returns boolean language plpgsql security definer
set search_path = public, extensions
as $$
declare numero_ text; n integer;
begin
  select p.whatsapp into numero_ from public.perfis p
   where p.id = p_usuario and p.whatsapp_verificado_em is not null;
  if numero_ is null then return false; end if;
  insert into public.whatsapp_fila (usuario_id, numero, texto, link, chave, enviar_apos)
  values (p_usuario, numero_, p_texto, p_link, p_chave, public.proxima_janela_whatsapp(now()))
  on conflict (chave) where chave is not null do nothing;
  get diagnostics n = row_count;
  return n > 0;
exception when check_violation or not_null_violation then
  return false;
end $$;

-- ---------------------------------------------------------------------
-- 3. Quem da equipe recebe: administrador e suporte com WhatsApp confirmado
-- ---------------------------------------------------------------------
create function public.verificacao_loja_destinatarios_equipe()
returns table (usuario_id text, whatsapp text)
language plpgsql stable security definer
set search_path = public, extensions
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' and session_user not in ('postgres', 'supabase_admin') then
    raise exception 'Acesso restrito.' using errcode = '42501';
  end if;
  return query
    select p.id, p.whatsapp from public.perfis p
     where p.whatsapp is not null and p.whatsapp_verificado_em is not null
       and not exists (select 1 from public.contas_revogadas r where r.usuario_id = p.id)
       and (p.e_admin
            or exists (select 1 from public.equipe e where e.usuario_id = p.id and e.ativo and e.papel in ('suporte', 'administrador')))
     order by p.id;
end $$;

-- ---------------------------------------------------------------------
-- 4. Modelos de mensagem
-- ---------------------------------------------------------------------
insert into public.modelos_mensagem (chave, canal, ordem, nome, quando, variaveis, titulo, texto, titulo_padrao, texto_padrao)
select chave, canal, ordem, nome, quando, variaveis, titulo, texto, titulo, texto from (values
  ('verificacao_aprovada', 'notificacao', 900, 'Loja verificada', 'Quando a verificação da loja é aprovada.',
   array[]::text[], 'Loja verificada', 'Sua loja foi verificada'),
  ('verificacao_aprovada', 'whatsapp', 901, 'Loja verificada', 'Quando a verificação da loja é aprovada.',
   array[]::text[], null::text, 'Sua loja foi verificada'),
  ('verificacao_falta_algo', 'notificacao', 902, 'Falta algo na verificação', 'Quando a verificação pede uma correção ou perde a validade porque os dados da loja mudaram.',
   array['motivo'], 'Falta algo na verificação', 'Falta algo na verificação da sua loja. {motivo}'),
  ('verificacao_falta_algo', 'whatsapp', 903, 'Falta algo na verificação', 'Quando a verificação pede uma correção ou perde a validade porque os dados da loja mudaram.',
   array['motivo'], null, 'Falta algo na verificação da sua loja. {motivo}'),
  ('verificacao_recusada', 'notificacao', 904, 'Verificação recusada', 'Quando a verificação da loja é recusada.',
   array['motivo'], 'Loja não verificada', 'Não foi possível verificar sua loja. {motivo}'),
  ('verificacao_recusada', 'whatsapp', 905, 'Verificação recusada', 'Quando a verificação da loja é recusada.',
   array['motivo'], null, 'Não foi possível verificar sua loja. {motivo}'),
  ('verificacao_selo_removido', 'notificacao', 906, 'Selo removido', 'Quando o selo de loja verificada sai porque o CNPJ deixou de estar ativo.',
   array[]::text[], 'Selo removido', 'O selo da sua loja saiu porque o CNPJ não está ativo.'),
  ('verificacao_selo_removido', 'whatsapp', 907, 'Selo removido', 'Quando o selo de loja verificada sai porque o CNPJ deixou de estar ativo.',
   array[]::text[], null, 'O selo da sua loja saiu porque o CNPJ não está ativo.'),
  ('verificacao_equipe_chamada', 'whatsapp', 908, 'Verificação precisa da equipe', 'Quando um pedido de verificação é encaminhado para a equipe decidir.',
   array['loja', 'cidade', 'motivo'], null, 'Verificação de loja precisa de você: {loja} ({cidade}). Motivo: {motivo}.'),
  ('verificacao_equipe_atrasada', 'whatsapp', 909, 'Verificação atrasada', 'Quando um pedido encaminhado para a equipe passa do prazo.',
   array['loja'], null, 'Verificação de loja passou de 24 horas: {loja}.')
) as t(chave, canal, ordem, nome, quando, variaveis, titulo, texto)
on conflict (chave, canal) do nothing;

-- ---------------------------------------------------------------------
-- 5. Avisos (internas)
-- ---------------------------------------------------------------------
-- Aviso para a loja: sempre no sino; no WhatsApp só com a chave verificacao.whatsapp_loja ligada.
create function public.verificacao_avisar_loja(p_vitrine uuid, p_chave text, p_vars jsonb, p_chave_unica text)
returns void language plpgsql security definer
set search_path = public, extensions
as $$
declare dono text; m public.modelos_mensagem;
begin
  select l.dono_id into dono from public.vitrines_lojas l where l.id = p_vitrine;
  if dono is null then return; end if;
  perform public.mensagem_aviso(dono, p_chave, p_vars, '/minha-conta/loja/verificar', p_chave_unica, p_chave);
  if public.config('verificacao.whatsapp_loja', null, 'false'::jsonb) = 'true'::jsonb then
    select * into m from public.modelos_mensagem x where x.chave = p_chave and x.canal = 'whatsapp';
    if m.id is not null and m.ativo then
      perform public.whatsapp_enfileirar(dono, public.mensagem_montar(m.texto, p_vars, 1000), '/minha-conta/loja/verificar', p_chave_unica);
    end if;
  end if;
end $$;

-- Aviso para a equipe: só WhatsApp, um por pessoa, e só com verificacao.whatsapp_equipe ligada.
create function public.verificacao_avisar_equipe(p_chave text, p_vars jsonb, p_chave_unica text)
returns void language plpgsql security definer
set search_path = public, extensions
as $$
declare m public.modelos_mensagem; d record; texto_ text;
begin
  if public.config('verificacao.whatsapp_equipe', null, 'false'::jsonb) <> 'true'::jsonb then return; end if;
  select * into m from public.modelos_mensagem x where x.chave = p_chave and x.canal = 'whatsapp';
  if m.id is null or not m.ativo then return; end if;
  texto_ := public.mensagem_montar(m.texto, p_vars, 1000);
  for d in select * from public.verificacao_loja_destinatarios_equipe() loop
    perform public.whatsapp_enfileirar(d.usuario_id, texto_, '/admin/lojas#fila-lojas', p_chave_unica || ':' || d.usuario_id);
  end loop;
end $$;

-- Frases curtas para quem lê (nada de dado pessoal: só o motivo).
create function public.verificacao_frase_motivo_loja(p_motivo text)
returns text language sql immutable
set search_path = public, extensions
as $$
  select case p_motivo
    when 'arquivo_ilegivel' then 'Não conseguimos ler o arquivo. Envie de novo, mais nítido.'
    when 'comprovante_invalido' then 'O comprovante enviado não serve. Envie o comprovante de inscrição do CNPJ.'
    when 'cnpj_inativo' then 'O CNPJ não está ativo na Receita.'
    when 'cnpj_nao_encontrado' then 'Não achamos esse CNPJ na Receita. Confira o número.'
    when 'dados_mudaram' then 'Os dados da loja mudaram. Envie o pedido de novo.'
    when 'dados_inconsistentes' then 'Os dados da loja não batem.'
    when 'link_invalido' then 'Um link da loja não abre.'
    when 'contato_nao_confirmado' then 'Não conseguimos confirmar o contato da loja.'
    when 'titularidade' then 'Não conseguimos confirmar que a loja é sua.'
    else 'Abra a página de verificação para ver o que fazer.'
  end
$$;

create function public.verificacao_frase_motivos_equipe(p_motivos text[])
returns text language sql immutable
set search_path = public, extensions
as $$
  select coalesce(nullif(string_agg(case m
    when 'ia_duvida' then 'a IA ficou em dúvida'
    when 'ia_falhou' then 'a IA não conseguiu analisar'
    when 'ia_desligada' then 'conferência automática desligada'
    when 'ia_sem_orcamento' then 'sem orçamento da IA'
    when 'nome_diferente' then 'nome diferente'
    when 'endereco_diferente' then 'endereço diferente'
    when 'cnpj_duplicado' then 'CNPJ em outra loja'
    when 'cidade_fora_da_regiao' then 'cidade fora da região'
    when 'receita_fora_do_ar' then 'Receita fora do ar'
    when 'fachada_estranha' then 'fachada estranha'
    when 'terceira_recusa' then 'terceira recusa em 24 horas'
    else 'conferir o pedido' end, ', ' order by ord), ''), 'conferir o pedido')
  from unnest(coalesce(p_motivos, '{}')) with ordinality as t(m, ord)
$$;

-- ---------------------------------------------------------------------
-- 6. Gatilho: cada mudança de situação do pedido gera um aviso, uma vez só
-- ---------------------------------------------------------------------
create function public.verificacao_loja_avisos_gatilho()
returns trigger language plpgsql security definer
set search_path = public, extensions
as $$
declare loja public.vitrines_lojas;
begin
  if new.status is not distinct from old.status then return null; end if;
  begin
    if new.status in ('aprovada', 'revisao_amostra') then
      if old.status in ('analisando', 'equipe') then
        perform public.verificacao_avisar_loja(new.vitrine_id, 'verificacao_aprovada', '{}'::jsonb, 'verificacao_aprovada:' || new.id);
      end if;
    elsif new.status = 'correcao' then
      perform public.verificacao_avisar_loja(new.vitrine_id, 'verificacao_falta_algo',
        jsonb_build_object('motivo', public.verificacao_frase_motivo_loja(new.motivo)), 'verificacao_falta_algo:' || new.id);
    elsif new.status = 'obsoleta' then
      perform public.verificacao_avisar_loja(new.vitrine_id, 'verificacao_falta_algo',
        jsonb_build_object('motivo', public.verificacao_frase_motivo_loja('dados_mudaram')), 'verificacao_falta_algo:' || new.id);
    elsif new.status = 'recusada' then
      perform public.verificacao_avisar_loja(new.vitrine_id, 'verificacao_recusada',
        jsonb_build_object('motivo', public.verificacao_frase_motivo_loja(new.motivo)), 'verificacao_recusada:' || new.id);
    elsif new.status = 'equipe' then
      select * into loja from public.vitrines_lojas l where l.id = new.vitrine_id;
      perform public.verificacao_avisar_equipe('verificacao_equipe_chamada',
        jsonb_build_object('loja', loja.nome, 'cidade', coalesce(loja.cidade, ''),
                           'motivo', public.verificacao_frase_motivos_equipe(new.motivos_equipe)),
        'verificacao_equipe_chamada:' || new.id);
    end if;
  exception when others then
    -- Aviso nunca derruba a decisão do pedido.
    raise warning 'Aviso da verificação não saiu: %', sqlerrm;
  end;
  return null;
end $$;
create trigger z_verificacao_loja_avisos after update of status on public.verificacoes_loja
  for each row execute function public.verificacao_loja_avisos_gatilho();

-- ---------------------------------------------------------------------
-- 7. Lembrete: pedido da equipe parado há mais que o prazo
-- ---------------------------------------------------------------------
create function public.verificacao_loja_lembrar()
returns void language plpgsql security definer
set search_path = public, extensions
as $$
declare r record;
begin
  for r in
    select v.id, l.nome from public.verificacoes_loja v join public.vitrines_lojas l on l.id = v.vitrine_id
     where v.status = 'equipe' and v.prazo_em < now()
       and (v.lembrete_em is null or v.lembrete_em < now() - interval '24 hours')
     order by v.prazo_em
     for update of v skip locked
  loop
    begin
      perform public.verificacao_avisar_equipe('verificacao_equipe_atrasada', jsonb_build_object('loja', r.nome),
        'atraso:' || r.id || ':' || to_char(now() at time zone 'America/Fortaleza', 'YYYY-MM-DD'));
      update public.verificacoes_loja set lembrete_em = now() where id = r.id;
    exception when others then
      -- Um pedido com problema não pode parar o lembrete dos outros.
      raise warning 'Lembrete da verificação não saiu: %', sqlerrm;
    end;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 8. Para a rota de envio (só o servidor)
-- ---------------------------------------------------------------------
-- Pega até p_limite mensagens vencidas e as marca "enviando" (conta a tentativa).
-- Uma "enviando" esquecida há mais de 10 minutos vira "incerta": pode ter saído, então nunca se repete.
create function public.whatsapp_fila_pegar(p_limite integer default 5)
returns table (id uuid, numero text, texto text, link text, tentativas smallint)
language plpgsql security definer
set search_path = public, extensions
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' and session_user not in ('postgres', 'supabase_admin') then
    raise exception 'Acesso restrito.' using errcode = '42501';
  end if;
  update public.whatsapp_fila f set estado = 'incerta', erro = 'travada'
   where f.estado = 'enviando' and f.enviar_apos < now() - interval '10 minutes';
  return query
    update public.whatsapp_fila f set estado = 'enviando', tentativas = f.tentativas + 1, enviar_apos = now()
     where f.id in (
       select x.id from public.whatsapp_fila x
        where x.estado = 'pendente' and x.enviar_apos <= now()
        order by x.enviar_apos, x.criado_em
        limit greatest(least(coalesce(p_limite, 5), 5), 1)
        for update skip locked)
    returning f.id, f.numero, f.texto, f.link, f.tentativas;
end $$;

-- Resultado do envio: 'enviado', 'falha' (volta em 5 min, até 3 tentativas) ou 'incerto' (nunca repete).
create function public.whatsapp_fila_resultado(p_id uuid, p_resultado text)
returns text language plpgsql security definer
set search_path = public, extensions
as $$
declare f public.whatsapp_fila;
begin
  if coalesce(auth.role(), '') <> 'service_role' and session_user not in ('postgres', 'supabase_admin') then
    raise exception 'Acesso restrito.' using errcode = '42501';
  end if;
  select * into f from public.whatsapp_fila x where x.id = p_id and x.estado = 'enviando' for update;
  if f.id is null then return 'ignorado'; end if;
  if p_resultado = 'enviado' then
    update public.whatsapp_fila set estado = 'enviada', enviada_em = now(), erro = null where id = f.id;
    return 'enviada';
  elsif p_resultado = 'falha' then
    if f.tentativas >= 3 then
      update public.whatsapp_fila set estado = 'falha', erro = 'falha' where id = f.id;
      return 'falha';
    end if;
    update public.whatsapp_fila set estado = 'pendente', enviar_apos = now() + interval '5 minutes', erro = 'falha' where id = f.id;
    return 'pendente';
  end if;
  update public.whatsapp_fila set estado = 'incerta', erro = 'incerto' where id = f.id;
  return 'incerta';
end $$;

-- Devolve à fila as mensagens que a rota pegou mas não chegou a tentar (acabou o tempo da rodada).
-- Só as que ainda estão "enviando"; desfaz a tentativa contada ao pegar.
create function public.whatsapp_fila_devolver(p_ids uuid[])
returns integer language plpgsql security definer
set search_path = public, extensions
as $$
declare n integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' and session_user not in ('postgres', 'supabase_admin') then
    raise exception 'Acesso restrito.' using errcode = '42501';
  end if;
  update public.whatsapp_fila f set estado = 'pendente', tentativas = greatest(f.tentativas - 1, 0)
   where f.id = any(coalesce(p_ids, '{}')) and f.estado = 'enviando';
  get diagnostics n = row_count;
  return n;
end $$;

-- ---------------------------------------------------------------------
-- 9. Agendamento (mesmo desenho da fila da IA)
-- ---------------------------------------------------------------------
do $$ begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
  end if;
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_net with schema extensions;
  end if;
end $$;

create function public.whatsapp_fila_disparar()
returns bigint language plpgsql security definer
set search_path = public, extensions
as $$
declare segredo text; pedido bigint;
begin
  if not exists (select 1 from public.whatsapp_fila f where f.estado = 'pendente' and f.enviar_apos <= now()) then
    return null;
  end if;
  select decrypted_secret into segredo from vault.decrypted_secrets where name = 'olaki_moderacao_ia_token';
  if segredo is null or length(segredo) < 32 then return null; end if;
  select net.http_post(url := 'https://ol-aqui.vercel.app/api/interno/whatsapp-fila',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || segredo),
    body := '{}'::jsonb, timeout_milliseconds := 60000) into pedido;
  return pedido;
end $$;

-- ---------------------------------------------------------------------
-- 10. Permissões
-- ---------------------------------------------------------------------
revoke all on function public.proxima_janela_whatsapp(timestamptz), public.whatsapp_enfileirar(text, text, text, text),
  public.verificacao_avisar_loja(uuid, text, jsonb, text), public.verificacao_avisar_equipe(text, jsonb, text),
  public.verificacao_frase_motivo_loja(text), public.verificacao_frase_motivos_equipe(text[]),
  public.verificacao_loja_avisos_gatilho(), public.verificacao_loja_lembrar(), public.whatsapp_fila_disparar()
  from public, anon, authenticated, service_role;
revoke all on function public.verificacao_loja_destinatarios_equipe(), public.whatsapp_fila_pegar(integer),
  public.whatsapp_fila_resultado(uuid, text), public.whatsapp_fila_devolver(uuid[])
  from public, anon, authenticated, service_role;
grant execute on function public.verificacao_loja_destinatarios_equipe(), public.whatsapp_fila_pegar(integer),
  public.whatsapp_fila_resultado(uuid, text), public.whatsapp_fila_devolver(uuid[])
  to service_role;

do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') and exists (select 1 from pg_extension where extname = 'pg_net') then
    perform cron.schedule('olaki-whatsapp-fila', '* * * * *', 'select public.whatsapp_fila_disparar()');
    perform cron.schedule('olaki-verificacao-lembrete', '*/15 * * * *', 'select public.verificacao_loja_lembrar()');
  end if;
end $$;
