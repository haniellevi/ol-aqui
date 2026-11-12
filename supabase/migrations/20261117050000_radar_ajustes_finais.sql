-- Radar v2, fase 1: ajustes finais da revisão do ramo.
--  RF1  só quem pode atender ESTE pedido (atende e está na área) fica sem "Eu sei onde tem";
--       loja de fora da área indica normalmente.
--  RF3  radar_feed e radar_pedido devolvem pode_propor (atende e está na área do pedido).
--  RF2  aviso de pedido novo sem cidades diz o nome da região.
--  10   indicar e ler indicações só com loja ativa.
--  6    "Ainda preciso" confere radar_pode_estender também no banco.
--  5    contas internas não ficam abertas para a API (só funções do banco e service_role usam).
--  8    radar_indicacoes.autor_id aponta para perfis (sai junto com a conta).
--  3a   plano de teste não promete Radar (só onde ainda é o texto padrão).

-- ---------------------------------------------------------------------
-- 1. Feed com pode_propor
-- ---------------------------------------------------------------------
drop function public.radar_feed();
create function public.radar_feed()
returns table (
  id uuid, microrregiao_id uuid, categoria public.categoria_anuncio, titulo text,
  detalhes text, preco_max_centavos bigint, cidade text, urgencia text,
  atributos jsonb, total_propostas integer, max_propostas integer,
  modo_contato text, propostas_ate timestamptz, expira_em timestamptz, criado_em timestamptz,
  comprador_certificado boolean, comprador_primeiro_nome text, ja_propus boolean,
  categoria_id uuid, categoria_nome text, preco_min_centavos bigint, sou_comprador boolean,
  visibilidade text, area_texto text, pode_propor boolean)
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
         p.visibilidade, case when p.cidades_ids is null then 'Toda a região' else p.cidade end,
         coalesce(eu.atende and p.comprador_id <> eu.uid and public.radar_pedido_na_area(p, eu.vitrine), false)
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

-- A aba "Pedidos na região" lê o feed por aqui: devolve pode_propor também.
drop function public.radar_feed_regional(text, uuid, integer, integer);
create function public.radar_feed_regional(
  p_filtro text default 'todas', p_categoria_id uuid default null,
  p_limite integer default 41, p_deslocamento integer default 0)
returns table (
  id uuid, categoria_id uuid, titulo text, detalhes text, preco_min_centavos bigint,
  preco_max_centavos bigint, categoria_nome text, cidade text, urgencia text, total_propostas integer,
  max_propostas integer, modo_contato text, propostas_ate timestamptz, criado_em timestamptz,
  comprador_certificado boolean, comprador_primeiro_nome text, ja_propus boolean, sou_comprador boolean,
  visibilidade text, area_texto text, pode_propor boolean
)
language sql stable security definer
set search_path = public
as $$
  with eu as (
    select p.id, p.microrregiao_id from public.perfis p where p.id = public.usuario_id()
  ), meus_nichos as (
    select distinct a.categoria_id
      from eu
      join public.vitrines_lojas v on v.dono_id = eu.id and v.microrregiao_id = eu.microrregiao_id
      join public.anuncios a on a.vitrine_id = v.id and a.microrregiao_id = v.microrregiao_id
     where p_filtro = 'meu_nicho' and v.status = 'ativa' and a.status = 'ativo'
  )
  select f.id, c.id, f.titulo, f.detalhes, f.preco_min_centavos, f.preco_max_centavos, c.nome,
         f.cidade, f.urgencia, f.total_propostas, f.max_propostas, f.modo_contato, f.propostas_ate,
         f.criado_em, f.comprador_certificado, f.comprador_primeiro_nome, f.ja_propus, f.sou_comprador,
         f.visibilidade, f.area_texto, f.pode_propor
    from public.radar_feed() f
    join eu on eu.microrregiao_id = f.microrregiao_id
    left join public.categorias c on c.id = public.radar_categoria_pedido(f.categoria_id, f.categoria)
   where case p_filtro
           when 'todas' then true
           when 'sem_categoria' then c.id is null
           when 'categoria' then public.radar_nicho_corresponde(p_categoria_id, c.id)
           when 'meu_nicho' then not f.sou_comprador and exists (
             select 1 from meus_nichos n where public.radar_nicho_corresponde(c.id, n.categoria_id)
           )
           else false
         end
   order by f.criado_em desc, f.id desc
   limit least(greatest(coalesce(p_limite, 41), 1), 41)
  offset least(greatest(coalesce(p_deslocamento, 0), 0), 1000000)
$$;
revoke all on function public.radar_feed_regional(text, uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.radar_feed_regional(text, uuid, integer, integer) to authenticated;

-- ---------------------------------------------------------------------
-- 2. Tela do pedido com pode_propor
-- ---------------------------------------------------------------------
drop function public.radar_pedido(uuid);
create function public.radar_pedido(p_id uuid)
returns table (
  id uuid, titulo text, detalhes text, categoria public.categoria_anuncio, categoria_id uuid, categoria_nome text,
  preco_min_centavos bigint, preco_max_centavos bigint, cidade text, urgencia text, modo_contato text,
  propostas_ate timestamptz, expira_em timestamptz, criado_em timestamptz, status text, situacao text,
  total_propostas integer, max_propostas integer, comprador_primeiro_nome text, comprador_certificado boolean,
  sou_comprador boolean, ja_propus boolean, mesma_regiao boolean, tem_acesso boolean, moderado_motivo text,
  fechado_motivo text, visibilidade text, area_texto text, bloqueado boolean,
  extensoes smallint, pode_estender boolean, pode_propor boolean)
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
         (t.ped).extensoes, public.radar_pode_estender(t.ped, t.uid),
         coalesce(t.atende and not t.dono and public.radar_pedido_na_area(t.ped, t.vitrine), false)
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
         null::smallint, false, false
    from alvo t
   where not (t.dono or t.admin or t.propus) and t.bloqueia
$$;
revoke all on function public.radar_pedido(uuid) from public, anon;
grant execute on function public.radar_pedido(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 3. "Eu sei onde tem": só quem atende ESTE pedido fica de fora (RF1); loja do anúncio ativa (10)
-- ---------------------------------------------------------------------
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
  -- quem atende ESTE pedido (plano com Radar e dentro da área) usa "Mandar oferta"
  if public.pode_atender_radar(uid)
     and public.radar_pedido_na_area(p, (select v from public.vitrines_lojas v where v.dono_id = uid)) then
    raise exception 'Você pode mandar oferta neste pedido.' using errcode = 'P0001';
  end if;
  select * into a from public.anuncios x where x.id = p_anuncio;
  if a.id is null or a.status <> 'ativo' or a.microrregiao_id <> p.microrregiao_id
     or not exists (select 1 from public.vitrines_lojas v where v.id = a.vitrine_id and v.status = 'ativa') then
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

create or replace function public.indicacoes_do_pedido(p_pedido uuid)
returns table (anuncio_id uuid, titulo text, preco_centavos bigint, foto text, vitrine_nome text, criado_em timestamptz)
language plpgsql stable security definer
set search_path = public, extensions
as $$
begin
  if not (public.e_admin() or exists (
        select 1 from public.radar_pedidos p where p.id = p_pedido and p.comprador_id = public.usuario_id())) then
    raise exception 'Pedido não encontrado.' using errcode = '42501';
  end if;
  return query
    select a.id, a.titulo, a.preco_centavos, a.fotos[1], v.nome, i.criado_em
      from public.radar_indicacoes i
      join public.anuncios a on a.id = i.anuncio_id and a.status = 'ativo'
      join public.vitrines_lojas v on v.id = a.vitrine_id and v.status = 'ativa'
     where i.pedido_id = p_pedido
     order by i.criado_em desc, i.id;
end $$;
revoke all on function public.indicacoes_do_pedido(uuid) from public, anon;
grant execute on function public.indicacoes_do_pedido(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 4. "Ainda preciso": a mesma conta da tela vale no banco
-- ---------------------------------------------------------------------
create or replace function public.estender_pedido_radar(p_id uuid)
returns timestamptz language plpgsql security definer
set search_path = public, extensions
as $$
declare
  uid     text := public.usuario_id();
  p       public.radar_pedidos;
  maximo  integer;
  dias    integer;
  sistema_anterior text := coalesce(current_setting('olaki.sistema', true), '');
  nova    timestamptz;
begin
  if uid is null then
    raise exception 'Entre na sua conta para continuar.' using errcode = '42501';
  end if;
  select * into p from public.radar_pedidos x where x.id = p_id for update;
  if p.id is null then
    raise exception 'Este pedido não está mais aberto.' using errcode = 'P0002';
  end if;
  if p.comprador_id <> uid then
    raise exception 'Este pedido não é seu.' using errcode = '42501';
  end if;
  if p.status <> 'aberto' or p.expira_em <= now() then
    raise exception 'Este pedido não está mais aberto.' using errcode = 'P0002';
  end if;
  maximo := coalesce(public.numero_ou_nulo(public.config('radar.extensoes_max', p.microrregiao_id, '2'))::int, 2);
  if p.extensoes >= maximo then
    raise exception 'Este pedido já foi estendido % vezes. Toque em Pedir de novo.', maximo using errcode = 'P0001';
  end if;
  if not public.radar_pode_estender(p, uid) then
    raise exception 'Ainda falta muito para o pedido vencer. O botão "Ainda preciso" aparece perto do fim do prazo.'
      using errcode = 'P0001';
  end if;
  dias := coalesce(public.numero_ou_nulo(public.config('radar.dias_pedido', p.microrregiao_id, '15'))::int, 15);

  -- passa pelo gatilho proteger_radar_v4, que trava expira_em e propostas_ate para o comprador
  perform set_config('olaki.sistema', '1', true);
  update public.radar_pedidos x
     set expira_em     = x.expira_em + make_interval(days => dias),
         propostas_ate = case when x.modo_contato = 'propostas_prazo' and x.propostas_ate is not null
                              then x.propostas_ate + make_interval(days => dias) else x.propostas_ate end,
         extensoes     = x.extensoes + 1,
         lembrete_em   = null
   where x.id = p.id
  returning x.expira_em into nova;
  perform set_config('olaki.sistema', sistema_anterior, true);
  return nova;
end $$;
revoke all on function public.estender_pedido_radar(uuid) from public, anon;
grant execute on function public.estender_pedido_radar(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 5. Aviso de pedido novo: sem cidades, o nome da região (RF2)
-- ---------------------------------------------------------------------
create or replace function public.radar_avisar_pedido_novo()
returns trigger language plpgsql security definer
set search_path = public, extensions
as $$
declare
  categoria_pedido uuid;
  por_dia integer;
  por_comprador integer;
  max_vendedores integer;
  hoje timestamptz := date_trunc('day', now() at time zone 'America/Fortaleza') at time zone 'America/Fortaleza';
  ligados jsonb;
  chave_aviso text := 'pedido_novo:' || new.id::text;
  vars jsonb;
  dono text;
begin
  if new.status <> 'aberto' or new.expira_em <= now() or new.total_propostas >= new.max_propostas
     or (new.modo_contato = 'propostas_prazo' and (new.propostas_ate is null or new.propostas_ate <= now())) then
    return null;
  end if;
  if tg_op = 'UPDATE' and old.status <> 'em_analise' then
    return null; -- publicação após análise; reabrir um pedido já publicado não é um novo pedido
  end if;

  categoria_pedido := public.radar_categoria_pedido(new.categoria_id, new.categoria);
  if categoria_pedido is null then return null; end if;

  ligados := public.config('radar.avisos_ligados', new.microrregiao_id, null);
  if jsonb_typeof(ligados) = 'array' and not (ligados ? 'pedido_novo') then return null; end if;

  por_dia := public.numero_ou_nulo(public.config('radar.avisos_lojas_por_dia', new.microrregiao_id, 'null'))::int;
  por_comprador := public.numero_ou_nulo(public.config('radar.avisos_lojas_por_comprador_dia', new.microrregiao_id, 'null'))::int;
  max_vendedores := coalesce(public.numero_ou_nulo(
    public.config('radar.avisos_lojas_max_por_pedido', new.microrregiao_id, '200')
  )::int, 200);
  if tg_op = 'UPDATE' then
    max_vendedores := max_vendedores - (select count(*)::int from public.notificacoes n where n.chave = chave_aviso);
  end if;
  if max_vendedores <= 0 then return null; end if;

  -- RF2: sem cidades marcadas, o aviso diz o nome da região (não "Toda a região")
  vars := jsonb_build_object('pedido', new.titulo,
    'cidade', case when new.cidades_ids is null
                   then coalesce((select m.nome from public.microrregioes m where m.id = new.microrregiao_id), new.cidade)
                   else new.cidade end,
    'preco', public.radar_faixa_texto(new.preco_min_centavos, new.preco_max_centavos));

  for dono in
    select v.dono_id
      from public.vitrines_lojas v
      join public.perfis pf on pf.id = v.dono_id and pf.microrregiao_id = v.microrregiao_id
     where v.microrregiao_id = new.microrregiao_id and v.status = 'ativa'
       and v.dono_id <> new.comprador_id
       and pf.whatsapp is not null and pf.whatsapp_verificado_em is not null
       and not exists (select 1 from public.contas_revogadas r where r.usuario_id = v.dono_id)
       and public.recebe_aviso_radar_na_hora(v.dono_id)
       and public.radar_pedido_na_area(new, v)
       and exists (
         select 1 from public.anuncios a
          where a.vitrine_id = v.id and a.microrregiao_id = v.microrregiao_id and a.status = 'ativo'
            and public.radar_nicho_corresponde(categoria_pedido, a.categoria_id)
       )
       and not exists (
         select 1 from public.preferencias_avisos pa
          where pa.usuario_id = v.dono_id and pa.tipo = 'pedido_novo' and pa.canal = 'app' and not pa.ligado
       )
       and not exists (
         select 1 from public.notificacoes n where n.usuario_id = v.dono_id and n.chave = chave_aviso
       )
       and (por_dia is null or (
         select count(*) from public.notificacoes n
           join public.radar_pedidos rp on rp.id::text = substr(n.chave, 13)
          where n.usuario_id = v.dono_id and n.tipo = 'pedido_novo' and n.criado_em >= hoje
            and n.chave like 'pedido_novo:%' and rp.status = 'aberto'
       ) < por_dia)
       and (por_comprador is null or (
         select count(*) from public.notificacoes n
           join public.radar_pedidos rp on rp.id::text = substr(n.chave, 13)
          where n.usuario_id = v.dono_id and n.tipo = 'pedido_novo' and n.criado_em >= hoje
            and n.chave like 'pedido_novo:%' and rp.comprador_id = new.comprador_id
       ) < por_comprador)
     order by v.criado_em, v.id
     limit max_vendedores
  loop
    perform public.radar_aviso(
      dono, 'pedido_novo', new.microrregiao_id, vars, '/radar/' || new.id::text, chave_aviso
    );
  end loop;
  return null;
end $$;

-- ---------------------------------------------------------------------
-- 6. Contas internas fechadas para a API (as funções do banco continuam chamando)
-- ---------------------------------------------------------------------
drop function public.radar_pode_ver_pedido(public.radar_pedidos, text);   -- ninguém usa

revoke execute on function public.radar_cortesia_ativa(uuid), public.pode_atender_radar(text),
  public.recebe_aviso_radar_na_hora(text),
  public.radar_pedido_na_area(public.radar_pedidos, public.vitrines_lojas),
  public.radar_pode_estender(public.radar_pedidos, text)
  from public, anon, authenticated;
grant execute on function public.radar_cortesia_ativa(uuid), public.pode_atender_radar(text),
  public.recebe_aviso_radar_na_hora(text),
  public.radar_pedido_na_area(public.radar_pedidos, public.vitrines_lojas),
  public.radar_pode_estender(public.radar_pedidos, text)
  to service_role;

-- ---------------------------------------------------------------------
-- 7. Indicações saem junto com a conta do autor (LGPD), como radar_pedidos.comprador_id
-- ---------------------------------------------------------------------
delete from public.radar_indicacoes i where not exists (select 1 from public.perfis pf where pf.id = i.autor_id);
alter table public.radar_indicacoes
  add constraint radar_indicacoes_autor_fk foreign key (autor_id) references public.perfis(id) on delete cascade;

-- ---------------------------------------------------------------------
-- 8. Plano de teste não atende o Radar: tira a promessa do texto padrão
-- ---------------------------------------------------------------------
update public.planos
   set descricao = '30 dias grátis com até 10 anúncios'
 where codigo = 'teste'
   and descricao = '30 dias grátis com até 10 anúncios e algumas propostas no Radar';
