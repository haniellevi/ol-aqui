-- Onda F: leituras aditivas, sem mudar contratos existentes nem dados.
create or replace function public.buscar_produtos_vitrine(p_vitrine_id uuid, p_busca text, p_ordem text default 'recentes', p_pagina integer default 1)
returns setof public.vitrine_anuncio
language sql stable security definer
set search_path = public, extensions
as $$
  with v as (
    select x.id, x.microrregiao_id, r.fixados_max, r.secoes_max,
           greatest(coalesce(public.numero_ou_nulo(public.config('vitrine.anuncios_por_pagina', x.microrregiao_id, '120'))::int, 120), 1) as por_pagina
      from public.vitrines_lojas x
      cross join lateral public.recursos_vitrine(x) r
     where x.id = p_vitrine_id and x.tipo = 'loja'
       and (x.status = 'ativa' or x.dono_id = public.usuario_id() or public.e_admin())
  ),
  secoes_visiveis as (                                  -- mesma regra de vitrine_publica
    select s.id from public.loja_secoes s join v on v.id = s.vitrine_id
     where s.ativa
     order by s.ordem, s.criado_em
     limit (select v.secoes_max from v)                 -- limit null = sem limite
  ),
  da_secao as (
    select distinct sa.anuncio_id from public.loja_secao_anuncios sa join secoes_visiveis sv on sv.id = sa.secao_id
  ),
  base as (
    select a.*, v.fixados_max, v.por_pagina,
           case when a.fixado_na_loja is not null
                then row_number() over (partition by a.fixado_na_loja is not null
                                        order by a.fixado_na_loja, coalesce(a.publicado_em, a.criado_em) desc, a.id) end as pos_fixado
      from public.anuncios a join v on v.id = a.vitrine_id
     where a.status = 'ativo'
  ),
  efetivo as (
    select b.*, case when b.pos_fixado <= coalesce(b.fixados_max, 2147483647) then b.pos_fixado end as fixado_ok
      from base b
  ),
  ordenado as (
    select e.*, row_number() over (
             order by case when p_ordem = 'menor_preco' then e.preco_centavos end asc nulls last,
                      case when coalesce(p_ordem, 'recentes') <> 'menor_preco' then e.fixado_ok end asc nulls last,
                      coalesce(e.publicado_em, e.criado_em) desc,
                      e.id) as pos
      from efetivo e
     where strpos(public.nome_comparavel(e.titulo), public.nome_comparavel(left(btrim(p_busca), 120))) > 0
  ),
  pagina as (
    select o.*, o.pos >  (greatest(coalesce(p_pagina, 1), 1) - 1)::bigint * o.por_pagina
            and o.pos <= greatest(coalesce(p_pagina, 1), 1)::bigint * o.por_pagina as dentro
      from ordenado o
  )
  select e.id, e.titulo, e.preco_centavos, e.aceita_troca, e.cidade, e.bairro, e.fotos[1],
         coalesce(e.publicado_em, e.criado_em), coalesce(e.destaque_ate > now(), false), e.fixado_ok::int,
         c.id, c.slug, c.nome, cp.nome,
         (coalesce(cp.ordem, c.ordem, 999) * 1000 + case when cp.id is null then 0 else coalesce(c.ordem, 999) end)::int,
         e.dentro, e.slug
    from pagina e
    left join public.categorias c on c.id = e.categoria_id
    left join public.categorias cp on cp.id = c.pai_id
   where e.dentro
   order by e.pos
$$;
revoke all on function public.buscar_produtos_vitrine(uuid,text,text,integer) from public;
grant execute on function public.buscar_produtos_vitrine(uuid,text,text,integer) to anon, authenticated, service_role;

create or replace function public.catalogo_lojas_oferta(p_regiao uuid, p_cidade text, p_nicho text, p_limite integer, p_offset integer, p_destaques boolean default false, p_busca text default null)
returns table (id uuid, slug text, nome text, cidade text, logo_url text, verificada boolean, total bigint, produtos_ativos bigint)
language sql stable security definer set search_path = public, pg_temp
as $$
  select v.id, v.slug, v.nome, v.cidade, v.logo_url, v.selo_loja_verificada, count(*) over (), oferta.quantidade
    from public.vitrines_lojas v
    cross join lateral (select count(*) as quantidade from public.anuncios a
      where a.vitrine_id = v.id and a.status = 'ativo' and public.categoria_disponivel(a.categoria_id)) oferta
   where (nullif(btrim(p_busca), '') is null or strpos(public.nome_comparavel(v.nome), public.nome_comparavel(left(p_busca, 80))) > 0)
     and v.tipo = 'loja' and v.status = 'ativa' and v.microrregiao_id = p_regiao
     and (not p_destaques or exists (
       select 1 from public.destaques d where d.vitrine_id = v.id and d.tipo = 'loja'
         and d.microrregiao_id = p_regiao and d.status = 'ativo' and d.inicio <= now() and d.fim > now()
     ))
     and (p_nicho is null or exists (
       select 1 from public.anuncios a
       join public.categorias c on c.id = a.categoria_id
       left join public.categorias pai on pai.id = c.pai_id
       where a.vitrine_id = v.id and a.status = 'ativo'
         and public.categoria_disponivel(c.id) and p_nicho in (select k.slug from public.categorias k where k.id in (select public.categoria_caminho(c.id)))
     ))
   order by (oferta.quantidade > 0) desc, coalesce(public.nome_comparavel(v.cidade) = public.nome_comparavel(p_cidade), false) desc,
            case when p_destaques then md5(v.id::text || to_char(now() at time zone 'America/Fortaleza', 'YYYYMMDDHH24')) end,
            v.selo_loja_verificada desc, v.nome, v.id
   limit least(greatest(coalesce(p_limite, 24), 1), 48)
   offset least(greatest(coalesce(p_offset, 0), 0), 100000)
$$;
revoke all on function public.catalogo_lojas_oferta(uuid,text,text,integer,integer,boolean,text) from public;
grant execute on function public.catalogo_lojas_oferta(uuid,text,text,integer,integer,boolean,text) to anon, authenticated, service_role;
