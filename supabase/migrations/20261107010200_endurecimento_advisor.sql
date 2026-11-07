-- =====================================================================
-- OLAKI · Ajustes pedidos pelo Security Advisor do Supabase (07/11/2026)
-- 1. O feed do Radar deixa de ser uma VIEW security definer e vira função
--    (mesmas colunas, mesmo bloqueio no banco).
-- 2. Corrige "column reference mensagem is ambiguous" em revelar_contato_radar
--    (modo propostas com prazo, quando a loja atualiza a própria oferta).
-- 3. Toda função do schema public ganha search_path fixo.
-- 4. Funções internas (gatilhos, rotina diária, webhook) não podem ser
--    chamadas pela API por anon/authenticated.
-- =====================================================================

-- 1. Feed do Radar como função ------------------------------------------
drop view if exists public.radar_feed;
create or replace function public.radar_feed()
returns table (
  id uuid, microrregiao_id uuid, categoria public.categoria_anuncio, titulo text,
  detalhes text, preco_max_centavos bigint, cidade text, urgencia text,
  atributos jsonb, total_propostas integer, max_propostas integer,
  modo_contato text, propostas_ate timestamptz, expira_em timestamptz, criado_em timestamptz,
  comprador_certificado boolean, comprador_primeiro_nome text, ja_propus boolean)
language sql stable security definer
set search_path = public
as $$
  select p.id, p.microrregiao_id, p.categoria, p.titulo,
         case when acesso.ok then p.detalhes end,
         p.preco_max_centavos, p.cidade, p.urgencia::text,
         case when acesso.ok then p.atributos else '{}'::jsonb end,
         p.total_propostas, p.max_propostas,
         p.modo_contato::text, p.propostas_ate, p.expira_em, p.criado_em,
         pf.selo_negociador_certificado,
         case when acesso.ok then split_part(pf.nome, ' ', 1) end,
         exists (select 1 from public.radar_propostas rp
                   join public.vitrines_lojas v on v.id = rp.vitrine_id
                  where rp.pedido_id = p.id and v.dono_id = public.usuario_id())
  from public.radar_pedidos p
  join public.perfis pf on pf.id = p.comprador_id
  cross join lateral (select public.tem_plano_pago(public.usuario_id()) or p.comprador_id = public.usuario_id() as ok) acesso
  where public.usuario_id() is not null
    and p.status = 'aberto' and p.expira_em > now()
    and (p.modo_contato = 'whatsapp_direto' or p.propostas_ate > now())
$$;
revoke all on function public.radar_feed() from public, anon;
grant execute on function public.radar_feed() to authenticated;

-- 2. revelar_contato_radar sem ambiguidade --------------------------------
create or replace function public.revelar_contato_radar(
  p_pedido_id uuid, p_anuncio_id uuid default null, p_mensagem text default null,
  p_preco_centavos bigint default null, p_foto_url text default null)
returns table (modo text, whatsapp text, mensagem text)
language plpgsql security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_vitrine public.vitrines_lojas;
  v_pedido  public.radar_pedidos;
  v_fone    text;
  v_rest    integer;
begin
  if public.usuario_id() is null then
    raise exception 'Faça login para propor um produto.' using errcode = '28000';
  end if;
  if not public.tem_plano_pago(public.usuario_id()) then
    raise exception 'O Radar de Negócios é exclusivo dos planos com Radar.' using errcode = '42501';
  end if;

  select * into v_vitrine from public.vitrines_lojas where dono_id = public.usuario_id();
  select * into v_pedido  from public.radar_pedidos where id = p_pedido_id for update;

  if v_pedido.id is null or v_pedido.status <> 'aberto' or v_pedido.expira_em <= now() then
    raise exception 'Este pedido não está mais aberto.' using errcode = 'P0002';
  end if;
  if v_pedido.modo_contato = 'propostas_prazo' and v_pedido.propostas_ate <= now() then
    raise exception 'O prazo para propostas deste pedido já acabou.' using errcode = 'P0002';
  end if;
  if v_pedido.microrregiao_id <> v_vitrine.microrregiao_id then
    raise exception 'Este pedido é de outra região.' using errcode = '42501';
  end if;
  if v_pedido.comprador_id = public.usuario_id() then
    raise exception 'Você não pode propor no seu próprio pedido.' using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.radar_propostas where pedido_id = p_pedido_id and vitrine_id = v_vitrine.id) then
    v_rest := public.propostas_restantes(public.usuario_id());
    if v_rest is not null and v_rest <= 0 then
      raise exception 'Você usou todas as propostas do seu plano. Assine um plano maior para continuar.' using errcode = '42501';
    end if;
    if v_pedido.total_propostas >= v_pedido.max_propostas then
      raise exception 'Este pedido já recebeu o máximo de propostas.' using errcode = 'P0001';
    end if;
    insert into public.radar_propostas (pedido_id, vitrine_id, anuncio_id, mensagem, preco_centavos, foto_url)
    values (p_pedido_id, v_vitrine.id, p_anuncio_id, left(p_mensagem, 500), p_preco_centavos, p_foto_url);
    perform set_config('olaki.sistema', '1', true);
    update public.radar_pedidos set total_propostas = total_propostas + 1 where id = p_pedido_id;
    perform set_config('olaki.sistema', '', true);
  elsif v_pedido.modo_contato = 'propostas_prazo' then
    -- no modo prazo, a loja pode atualizar a própria oferta
    update public.radar_propostas
       set mensagem = coalesce(left(p_mensagem, 500), mensagem),
           preco_centavos = coalesce(p_preco_centavos, preco_centavos),
           foto_url = coalesce(p_foto_url, foto_url), anuncio_id = coalesce(p_anuncio_id, anuncio_id)
     where pedido_id = p_pedido_id and vitrine_id = v_vitrine.id;
  end if;

  if v_pedido.modo_contato = 'propostas_prazo' then
    -- comprador não quer ser chamado: a oferta fica guardada e ele recebe o resumo no fim do prazo
    return query select 'propostas_prazo'::text, null::text,
      format('Proposta enviada! O comprador recebe todas as ofertas em %s e escolhe com quem falar.',
             to_char(v_pedido.propostas_ate at time zone 'America/Fortaleza', 'DD/MM "às" HH24:MI'));
    return;
  end if;

  -- só entrega número confirmado no Clerk (quem troca o número perde a confirmação)
  select pf.whatsapp into v_fone from public.perfis pf
   where pf.id = v_pedido.comprador_id and pf.whatsapp_verificado_em is not null;
  if v_fone is null then
    raise exception 'O comprador ainda não confirmou o celular. Tente mais tarde.' using errcode = 'P0001';
  end if;
  return query select 'whatsapp_direto'::text, v_fone,
    format('Olá! Vi seu pedido no Radar do OLAKI: "%s". Tenho uma proposta da loja %s.', v_pedido.titulo, v_vitrine.nome);
end $$;
revoke all on function public.revelar_contato_radar(uuid, uuid, text, bigint, text) from public, anon;
grant execute on function public.revelar_contato_radar(uuid, uuid, text, bigint, text) to authenticated;

-- 3. search_path fixo em toda função nossa do schema public ---------------
do $$
declare f regprocedure;
begin
  for f in
    select p.oid::regprocedure
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prokind = 'f'
       and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
       and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')
  loop
    execute format('alter function %s set search_path = public, extensions', f);
  end loop;
end $$;

-- 4. Funções internas fora da API ------------------------------------------
-- Gatilhos: o Postgres não confere EXECUTE ao disparar um gatilho, então tirar a permissão é seguro.
do $$
declare f regprocedure;
begin
  for f in
    select p.oid::regprocedure
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prorettype = 'trigger'::regtype
       and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
end $$;

-- Rotina diária e webhook do Asaas: só o servidor (service_role) e o agendador.
revoke all on function public.expirar_rotina() from public, anon, authenticated;
grant execute on function public.expirar_rotina() to service_role;
revoke all on function public.confirmar_pagamento(text, jsonb) from public, anon, authenticated;
grant execute on function public.confirmar_pagamento(text, jsonb) to service_role;

-- Visitante (anon) não consulta plano/limite de outras pessoas nem configurações internas.
-- e_admin() e whatsapp_confirmado() continuam liberadas: são usadas nas regras de RLS.
revoke execute on function public.config(text, uuid, jsonb) from public, anon;
grant execute on function public.config(text, uuid, jsonb) to authenticated, service_role;
revoke execute on function public.propostas_restantes(text) from public, anon;
revoke execute on function public.tem_plano_pago(text) from public, anon;
revoke execute on function public.congelar_anuncio(uuid, text) from public, anon;
grant execute on function public.propostas_restantes(text), public.tem_plano_pago(text),
  public.congelar_anuncio(uuid, text) to authenticated, service_role;
