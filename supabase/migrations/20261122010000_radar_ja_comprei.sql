-- IA do Radar: "já comprei" na conversa — docs/superpowers/plans/2026-11-13-radar-ja-comprei.md
-- Decisões do Raniel (13/11/2026): a IA (JEV) lê só mensagens do CLIENTE, numa conversa com proposta de um pedido
-- DELE ainda aberto, e só as que têm palavra de compra (filtro no servidor, antes de chegar aqui).
-- Se o JEV achar que já resolveu, fica uma pergunta pendente por pedido, que só o cliente vê.
-- "Sim" abre a folha "Com quem você resolveu?" (resolver_pedido_radar); "Não" vale para sempre naquele pedido.
-- Nasce DESLIGADA (radar_ia.ja_comprei_ativa = false). Gasto no mesmo teto e limite por pessoa da IA do Radar.

-- ---------------------------------------------------------------------
-- 1. Chave e parte nova no livro-caixa
-- ---------------------------------------------------------------------
insert into public.configuracoes (chave, valor, grupo, publico, descricao)
select 'radar_ia.ja_comprei_ativa', 'false'::jsonb, 'radar', false,
       'IA do Radar: percebe "já comprei" na conversa e pergunta ao cliente se pode tirar o pedido'
 where not exists (select 1 from public.configuracoes c where c.chave = 'radar_ia.ja_comprei_ativa' and c.microrregiao_id is null);

do $$
declare nome text;
begin
  select con.conname into nome
    from pg_constraint con
    join pg_attribute att on att.attrelid = con.conrelid and att.attnum = any(con.conkey)
   where con.conrelid = 'public.radar_ia_uso'::regclass and con.contype = 'c' and att.attname = 'parte';
  if nome is not null then execute format('alter table public.radar_ia_uso drop constraint %I', nome); end if;
end $$;
alter table public.radar_ia_uso add constraint radar_ia_uso_parte_check
  check (parte in ('perguntas', 'parecidos', 'vitrine', 'novidades', 'ja_comprei'));

-- Mesmo corpo de 20261121010000, com a parte 'ja_comprei' (JEV).
create or replace function public.radar_ia_reservar(p_usuario text, p_parte text)
returns bigint language plpgsql security definer
set search_path = public, extensions
as $$
declare
  cot numeric; orc numeric; gasto numeric; reserva numeric; limite numeric;
  provedor text; modelo text;
  uid bigint;
begin
  if coalesce(auth.role(), '') <> 'service_role' and session_user not in ('postgres', 'supabase_admin') then
    raise exception 'Acesso restrito.' using errcode = '42501';
  end if;
  if p_parte is null or p_parte not in ('perguntas', 'parecidos', 'vitrine', 'novidades', 'ja_comprei') then
    raise exception 'Parte desconhecida.' using errcode = '22023';
  end if;
  if public.config('radar_ia.ativa', null, 'false') is distinct from 'true'::jsonb
     or public.config('radar_ia.' || p_parte || '_ativa', null, 'false') is distinct from 'true'::jsonb then
    return null;
  end if;

  -- perguntas, novidades e ja_comprei começam no JEV (julgar); parecidos e vitrine no Gemini (escrever).
  if p_parte in ('perguntas', 'novidades', 'ja_comprei') then provedor := 'typesafe'; modelo := 'jev-latest';
  else provedor := 'openrouter'; modelo := 'google/gemini-2.5-flash-lite'; end if;

  cot := public.numero_ou_nulo(public.config('robo.cotacao_dolar', null, 'null'));
  orc := public.numero_ou_nulo(public.config('radar_ia.orcamento_mensal_centavos', null, 'null'));
  limite := public.numero_ou_nulo(public.config('radar_ia.usos_por_dia', null, '20'));
  if cot is null or cot <= 0 or orc is null or orc < 0 then return null; end if;
  reserva := round(0.001 * cot * 100, 4);

  perform pg_advisory_xact_lock(hashtext('robo_uso:radar'));
  if p_usuario is not null and (select count(*) from public.radar_ia_uso u
       where u.usuario_id = p_usuario and u.criado_em >= public.robo_inicio('dia')) >= coalesce(limite, 0) then
    return null;
  end if;
  select coalesce(sum(custo_centavos), 0) into gasto from public.radar_ia_uso where criado_em >= public.robo_inicio('mes');
  if gasto + reserva > orc then return null; end if;

  insert into public.radar_ia_uso (usuario_id, microrregiao_id, parte, provedor, modelo, custo_centavos, cotacao_dolar, erro)
  values (p_usuario, (select microrregiao_id from public.perfis where id = p_usuario), p_parte, provedor, modelo, reserva, cot, 'em_andamento')
  returning id into uid;
  return uid;
end $$;

create or replace function public.radar_ia_estado()
returns jsonb language plpgsql stable security definer
set search_path = public, extensions
as $$
declare
  geral boolean;
begin
  if coalesce(auth.role(), '') <> 'service_role' and session_user not in ('postgres', 'supabase_admin') then
    raise exception 'Acesso restrito.' using errcode = '42501';
  end if;
  geral := public.config('radar_ia.ativa', null, 'false') = 'true'::jsonb;
  return jsonb_build_object(
    'perguntas',  geral and public.config('radar_ia.perguntas_ativa', null, 'false') = 'true'::jsonb,
    'parecidos',  geral and public.config('radar_ia.parecidos_ativa', null, 'false') = 'true'::jsonb,
    'vitrine',    geral and public.config('radar_ia.vitrine_ativa', null, 'false') = 'true'::jsonb,
    'novidades',  geral and public.config('radar_ia.novidades_ativa', null, 'false') = 'true'::jsonb,
    'ja_comprei', geral and public.config('radar_ia.ja_comprei_ativa', null, 'false') = 'true'::jsonb);
end $$;

-- ---------------------------------------------------------------------
-- 2. Pergunta pendente (uma por pedido) e o "não" do cliente
-- ---------------------------------------------------------------------
create table public.conversa_ja_comprei (
  pedido_id     uuid primary key references public.radar_pedidos(id) on delete cascade,
  conversa_id   uuid not null references public.conversas(id) on delete cascade,
  mensagem_id   uuid references public.conversa_mensagens(id) on delete set null,
  estado        text not null check (estado in ('perguntando', 'nao')),
  criado_em     timestamptz not null default now(),
  respondido_em timestamptz
);
create index conversa_ja_comprei_conversa_idx on public.conversa_ja_comprei (conversa_id);
alter table public.conversa_ja_comprei enable row level security;
revoke all on public.conversa_ja_comprei from public, anon, authenticated;

-- Pedido do cliente desta conversa que a IA ainda pode perguntar: aberto, no prazo, com cartão de proposta
-- nesta conversa e sem pergunta (pendente ou recusada). O do cartão mais recente.
create function public.ja_comprei_pedido_da_conversa(p_conversa uuid)
returns uuid language sql stable security definer
set search_path = public, extensions
as $$
  select p.id
    from public.conversas c
    join public.conversa_mensagens m on m.conversa_id = c.id and m.tipo = 'proposta'
    join public.radar_pedidos p on p.id = m.pedido_id
   where c.id = p_conversa
     and p.comprador_id = c.cliente_id
     and p.status = 'aberto' and p.expira_em > now()
     and not exists (select 1 from public.conversa_ja_comprei j where j.pedido_id = p.id)
   order by m.criado_em desc, m.id desc
   limit 1
$$;

-- Servidor: a mensagem pode ir para a IA? Devolve o mínimo que vai para o JEV, ou null.
create function public.ja_comprei_candidato(p_mensagem uuid)
returns jsonb language plpgsql stable security definer
set search_path = public, extensions
as $$
declare
  m public.conversa_mensagens;
  c public.conversas;
  v_pedido uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' and session_user not in ('postgres', 'supabase_admin') then
    raise exception 'Acesso restrito.' using errcode = '42501';
  end if;
  if not public.conversas_ligadas() or (public.radar_ia_estado()->>'ja_comprei') is distinct from 'true' then
    return null;
  end if;
  select * into m from public.conversa_mensagens x where x.id = p_mensagem;
  if m.id is null or m.tipo <> 'texto' or m.lado <> 'cliente' or m.ia_lida_em is not null then
    return null;
  end if;
  select * into c from public.conversas x where x.id = m.conversa_id;
  v_pedido := public.ja_comprei_pedido_da_conversa(c.id);
  if v_pedido is null then return null; end if;
  return jsonb_build_object('mensagem_id', m.id, 'usuario_id', c.cliente_id, 'texto', m.texto,
    'pedido_id', v_pedido, 'pedido_titulo', (select titulo from public.radar_pedidos where id = v_pedido));
end $$;

-- Servidor: grava que a IA leu a mensagem e, se ela achou que já resolveu, a pergunta pendente.
create function public.ja_comprei_registrar(p_mensagem uuid, p_pedido uuid, p_resolveu boolean)
returns boolean language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v_conv uuid;
  n integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' and session_user not in ('postgres', 'supabase_admin') then
    raise exception 'Acesso restrito.' using errcode = '42501';
  end if;
  update public.conversa_mensagens set ia_lida_em = now()
   where id = p_mensagem and tipo = 'texto' and lado = 'cliente'
  returning conversa_id into v_conv;
  if v_conv is null or not coalesce(p_resolveu, false)
     or public.ja_comprei_pedido_da_conversa(v_conv) is distinct from p_pedido then
    return false;
  end if;
  insert into public.conversa_ja_comprei (pedido_id, conversa_id, mensagem_id, estado)
  values (p_pedido, v_conv, p_mensagem, 'perguntando')
  on conflict (pedido_id) do nothing;
  get diagnostics n = row_count;
  return n > 0;
end $$;

-- Tela: a pergunta pendente desta conversa (só o cliente vê).
create function public.ja_comprei_pendente(p_conversa uuid)
returns table (pedido_id uuid, pedido_titulo text)
language sql stable security definer
set search_path = public, extensions
as $$
  select j.pedido_id, p.titulo
    from public.conversa_ja_comprei j
    join public.radar_pedidos p on p.id = j.pedido_id
   where j.conversa_id = p_conversa and j.estado = 'perguntando' and p.status = 'aberto'
     and public.conversas_ligadas() and public.conversa_papel(p_conversa) = 'cliente'
   order by j.criado_em desc
   limit 1
$$;

-- Tela: "Não, ainda preciso" — a IA nunca mais pergunta sobre este pedido.
create function public.recusar_ja_comprei(p_pedido uuid)
returns void language plpgsql security definer
set search_path = public, extensions
as $$
begin
  if public.usuario_id() is null or not exists (
       select 1 from public.radar_pedidos p where p.id = p_pedido and p.comprador_id = public.usuario_id()) then
    raise exception 'Pedido não encontrado.' using errcode = '42501';
  end if;
  update public.conversa_ja_comprei set estado = 'nao', respondido_em = now()
   where pedido_id = p_pedido and estado = 'perguntando';
end $$;

-- ---------------------------------------------------------------------
-- 3. Permissões
-- ---------------------------------------------------------------------
revoke all on function public.ja_comprei_pedido_da_conversa(uuid), public.ja_comprei_candidato(uuid),
  public.ja_comprei_registrar(uuid, uuid, boolean), public.ja_comprei_pendente(uuid), public.recusar_ja_comprei(uuid)
  from public, anon, authenticated;
grant execute on function public.ja_comprei_candidato(uuid), public.ja_comprei_registrar(uuid, uuid, boolean) to service_role;
grant execute on function public.ja_comprei_pendente(uuid), public.recusar_ja_comprei(uuid) to authenticated, service_role;
