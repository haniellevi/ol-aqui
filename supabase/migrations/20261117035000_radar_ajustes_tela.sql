-- Radar v2, fase 1, ajustes de tela (Task 7b):
--  R1  pedido "Todo mundo" mostra os detalhes a qualquer pessoa logada da região (nome do comprador continua só para quem atende);
--  R2  quem atende (pode_atender_radar) não usa "Eu sei onde tem": usa "Mandar oferta";
--  3   "meus pedidos" devolve visibilidade e area_texto.

create or replace function public.radar_feed()
returns table (
  id uuid, microrregiao_id uuid, categoria public.categoria_anuncio, titulo text,
  detalhes text, preco_max_centavos bigint, cidade text, urgencia text,
  atributos jsonb, total_propostas integer, max_propostas integer,
  modo_contato text, propostas_ate timestamptz, expira_em timestamptz, criado_em timestamptz,
  comprador_certificado boolean, comprador_primeiro_nome text, ja_propus boolean,
  categoria_id uuid, categoria_nome text, preco_min_centavos bigint, sou_comprador boolean,
  visibilidade text, area_texto text)
language sql stable security definer
set search_path = public, extensions
as $$
  with eu as materialized (
    select public.usuario_id() as uid,
           public.e_admin() as admin,
           public.pode_atender_radar(public.usuario_id()) as atende,
           (select me.microrregiao_id from public.perfis me where me.id = public.usuario_id()) as regiao,
           (select v from public.vitrines_lojas v where v.dono_id = public.usuario_id()) as vitrine
  )
  select p.id, p.microrregiao_id, p.categoria, p.titulo,
         case when acesso.ok or p.visibilidade = 'todos' then p.detalhes end,
         p.preco_max_centavos, p.cidade, p.urgencia::text,
         case when acesso.ok then p.atributos else '{}'::jsonb end,
         p.total_propostas, p.max_propostas,
         p.modo_contato::text, p.propostas_ate, p.expira_em, p.criado_em,
         pf.selo_negociador_certificado,
         case when acesso.ok then split_part(pf.nome, ' ', 1) end,
         exists (select 1 from public.radar_propostas rp
                   join public.vitrines_lojas v on v.id = rp.vitrine_id
                  where rp.pedido_id = p.id and v.dono_id = eu.uid),
         p.categoria_id, (select c.nome from public.categorias c where c.id = p.categoria_id),
         p.preco_min_centavos, p.comprador_id = eu.uid,
         p.visibilidade, case when p.cidades_ids is null then 'Toda a região' else p.cidade end
  from eu
  cross join public.radar_pedidos p
  join public.perfis pf on pf.id = p.comprador_id
  cross join lateral (select eu.atende or p.comprador_id = eu.uid as ok) acesso
  where eu.uid is not null
    and (p.comprador_id = eu.uid
         or (p.microrregiao_id = eu.regiao
             and (p.visibilidade = 'todos' or eu.admin
                  or (eu.atende and public.radar_pedido_na_area(p, eu.vitrine)))))
    and p.status = 'aberto' and p.expira_em > now()
    and (p.modo_contato = 'whatsapp_direto' or p.propostas_ate > now())
$$;
revoke all on function public.radar_feed() from public, anon;
grant execute on function public.radar_feed() to authenticated;

create or replace function public.radar_pedido(p_id uuid)
returns table (
  id uuid, titulo text, detalhes text, categoria public.categoria_anuncio, categoria_id uuid, categoria_nome text,
  preco_min_centavos bigint, preco_max_centavos bigint, cidade text, urgencia text, modo_contato text,
  propostas_ate timestamptz, expira_em timestamptz, criado_em timestamptz, status text, situacao text,
  total_propostas integer, max_propostas integer, comprador_primeiro_nome text, comprador_certificado boolean,
  sou_comprador boolean, ja_propus boolean, mesma_regiao boolean, tem_acesso boolean, moderado_motivo text,
  fechado_motivo text, visibilidade text, area_texto text, bloqueado boolean,
  extensoes smallint, pode_estender boolean)
language sql stable security definer
set search_path = public, extensions
as $$

  with eu as materialized (
    select public.usuario_id() as uid,
           public.e_admin() as admin,
           public.pode_atender_radar(public.usuario_id()) as atende,
           (select me.microrregiao_id from public.perfis me where me.id = public.usuario_id()) as regiao,
           (select v from public.vitrines_lojas v where v.dono_id = public.usuario_id()) as vitrine
  ), alvo as (
    select p as ped, eu.uid, eu.admin, eu.atende, eu.vitrine, x.dono, x.propus,
           (x.aberto_na_regiao and x.pode) as ve_aberto,
           (x.aberto_na_regiao and not x.pode) as bloqueia
      from eu
      cross join public.radar_pedidos p
      cross join lateral (
        select p.comprador_id = eu.uid as dono,
               exists (select 1 from public.radar_propostas rp join public.vitrines_lojas v on v.id = rp.vitrine_id
                        where rp.pedido_id = p.id and v.dono_id = eu.uid) as propus,
               (p.status = 'aberto' and p.expira_em > now() and p.microrregiao_id = eu.regiao) as aberto_na_regiao,
               (p.visibilidade = 'todos' or eu.admin
                or (eu.atende and public.radar_pedido_na_area(p, eu.vitrine))) as pode) x
     where p.id = p_id and eu.uid is not null
  )
  select (t.ped).id, (t.ped).titulo,
         case when a.acesso or (t.ped).visibilidade = 'todos' then (t.ped).detalhes end,
         (t.ped).categoria, (t.ped).categoria_id, c.nome,
         (t.ped).preco_min_centavos, (t.ped).preco_max_centavos, (t.ped).cidade, (t.ped).urgencia, (t.ped).modo_contato,
         (t.ped).propostas_ate, (t.ped).expira_em, (t.ped).criado_em, (t.ped).status::text,
         case when (t.ped).status = 'em_analise' then 'em_analise'
              when (t.ped).status <> 'aberto' or (t.ped).expira_em <= now() then 'fechado'
              when (t.ped).modo_contato = 'propostas_prazo' and (t.ped).propostas_ate <= now() then 'prazo_acabou'
              else 'aberto' end,
         (t.ped).total_propostas, (t.ped).max_propostas,
         case when a.acesso then split_part(btrim(pf.nome), ' ', 1) end,
         pf.selo_negociador_certificado,
         t.dono, t.propus,
         coalesce((t.vitrine).microrregiao_id = (t.ped).microrregiao_id, false),
         a.acesso,
         case when t.dono or t.admin then (t.ped).moderado_motivo end,
         case when t.dono or t.admin then (t.ped).fechado_motivo end,
         (t.ped).visibilidade,
         case when (t.ped).cidades_ids is null then 'Toda a região' else (t.ped).cidade end,
         false,
         (t.ped).extensoes, public.radar_pode_estender(t.ped, t.uid)
    from alvo t
    join public.perfis pf on pf.id = (t.ped).comprador_id
    left join public.categorias c on c.id = (t.ped).categoria_id
    cross join lateral (select t.dono or t.admin or t.atende as acesso) a
   where t.dono or t.admin or t.propus or t.ve_aberto
  union all
  select (t.ped).id, null::text, null::text, null::public.categoria_anuncio, null::uuid, null::text,
         null::bigint, null::bigint, null::text, null::text, null::text,
         null::timestamptz, null::timestamptz, null::timestamptz, null::text, null::text,
         null::integer, null::integer, null::text, null::boolean,
         false, false, true, false, null::text,
         null::text, 'lojas', null::text, true,
         null::smallint, false
    from alvo t
   where not (t.dono or t.admin or t.propus) and t.bloqueia
$$;
revoke all on function public.radar_pedido(uuid) from public, anon;
grant execute on function public.radar_pedido(uuid) to authenticated;

create or replace function public.indicar_anuncio_radar(p_pedido uuid, p_anuncio uuid)
returns uuid language plpgsql security definer
set search_path = public, extensions
as $$
declare
  uid     text := public.usuario_id();
  regiao  uuid;
  p       public.radar_pedidos;
  a       public.anuncios;
  existente uuid;
  lim     integer;
  total   integer;
  novo    uuid;
  hoje    timestamptz := date_trunc('day', now() at time zone 'America/Fortaleza') at time zone 'America/Fortaleza';
begin
  if uid is null then
    raise exception 'Entre na sua conta para continuar.' using errcode = '42501';
  end if;
  select pf.microrregiao_id into regiao from public.perfis pf where pf.id = uid;
  if regiao is null then
    raise exception 'Complete o seu cadastro para indicar.' using errcode = '42501';
  end if;
  select * into p from public.radar_pedidos x where x.id = p_pedido;
  if p.id is null or p.microrregiao_id <> regiao or p.status <> 'aberto' or p.expira_em <= now() then
    raise exception 'Este pedido não está mais aberto.' using errcode = 'P0002';
  end if;
  if p.comprador_id = uid then
    raise exception 'Este pedido é seu.' using errcode = '42501';
  end if;
  if p.visibilidade <> 'todos' then
    raise exception 'Este pedido é só para lojas.' using errcode = '42501';
  end if;
  if public.pode_atender_radar(uid) then   -- quem atende usa "Mandar oferta"
    raise exception 'Você pode mandar oferta neste pedido.' using errcode = 'P0001';
  end if;
  select * into a from public.anuncios x where x.id = p_anuncio;
  if a.id is null or a.status <> 'ativo' or a.microrregiao_id <> p.microrregiao_id then
    raise exception 'Este anúncio não está disponível.' using errcode = 'P0002';
  end if;
  if public.pode_mexer_vitrine(a.vitrine_id) then   -- dono ou ajudante da loja
    raise exception 'Indique um anúncio de outra pessoa.' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtext('radar_indicacao:' || uid));
  select i.id into existente from public.radar_indicacoes i where i.pedido_id = p.id and i.anuncio_id = a.id;
  if existente is not null then return existente; end if;

  lim := coalesce(public.numero_ou_nulo(public.config('radar.indicacoes_por_dia', p.microrregiao_id, '10'))::int, 10);
  select count(*) into total from public.radar_indicacoes i where i.autor_id = uid and i.criado_em >= hoje;
  if total >= lim then
    raise exception 'Você já indicou % anúncios hoje. Amanhã você pode indicar mais.', total using errcode = 'P0001';
  end if;

  insert into public.radar_indicacoes (pedido_id, autor_id, anuncio_id)
  values (p.id, uid, a.id) returning id into novo;

  perform public.radar_aviso(p.comprador_id, 'indicacao', p.microrregiao_id,
    jsonb_build_object('pedido', p.titulo), '/radar/pedido/' || p.id, 'indicacao:' || p.id || ':' || a.id);
  return novo;
end $$;
revoke all on function public.indicar_anuncio_radar(uuid, uuid) from public, anon;
grant execute on function public.indicar_anuncio_radar(uuid, uuid) to authenticated;

drop function public.meus_pedidos_radar(boolean);
create function public.meus_pedidos_radar(p_arquivados boolean)
returns table (
  id uuid, titulo text, cidade text, categoria_nome text, status text, situacao text, modo_contato text,
  propostas_ate timestamptz, expira_em timestamptz, criado_em timestamptz,
  total_propostas integer, menor_preco_centavos bigint, fechado_motivo text, moderado_motivo text,
  extensoes smallint, pode_estender boolean, visibilidade text, area_texto text)
language sql stable security definer
set search_path = public, extensions
as $$
  select p.id, p.titulo, p.cidade, c.nome, p.status::text,
         case when p.status = 'em_analise' then 'em_analise'
              when p.status <> 'aberto' or p.expira_em <= now() then 'fechado'
              when p.modo_contato = 'propostas_prazo' and p.propostas_ate <= now() then 'prazo_acabou'
              else 'aberto' end,
         p.modo_contato, p.propostas_ate, p.expira_em, p.criado_em,
         ofertas.total, ofertas.menor, p.fechado_motivo, p.moderado_motivo,
         p.extensoes, public.radar_pode_estender(p, public.usuario_id()),
         p.visibilidade, case when p.cidades_ids is null then 'Toda a região' else p.cidade end
    from public.radar_pedidos p
    left join public.categorias c on c.id = p.categoria_id
    cross join lateral (
      select count(*)::int as total, min(rp.preco_centavos) as menor
        from public.radar_propostas rp where rp.pedido_id = p.id and rp.status = 'ativa'
    ) ofertas
   where p.comprador_id = public.usuario_id()
     and (p.arquivado_em is not null) = p_arquivados
   order by p.arquivado_em desc nulls last, p.criado_em desc, p.id desc
   limit 50
$$;
revoke all on function public.meus_pedidos_radar(boolean) from public, anon, authenticated;
grant execute on function public.meus_pedidos_radar(boolean) to authenticated;
