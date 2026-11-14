-- A busca por nome acontece antes do total e da paginação, com recorte regional e de categoria.
create or replace function public.catalogo_lojas_busca(p_regiao uuid, p_cidade text, p_nicho text, p_limite integer, p_offset integer, p_destaques boolean default false, p_busca text default null)
returns table (id uuid, slug text, nome text, cidade text, logo_url text, verificada boolean, total bigint)
language sql stable security definer set search_path = public, pg_temp
as $$
  select v.id, v.slug, v.nome, v.cidade, v.logo_url, v.selo_loja_verificada, count(*) over ()
    from public.vitrines_lojas v
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
   order by coalesce(public.nome_comparavel(v.cidade) = public.nome_comparavel(p_cidade), false) desc,
            case when p_destaques then md5(v.id::text || to_char(now() at time zone 'America/Fortaleza', 'YYYYMMDDHH24')) end,
            v.selo_loja_verificada desc, v.nome, v.id
   limit least(greatest(coalesce(p_limite, 24), 1), 48)
   offset least(greatest(coalesce(p_offset, 0), 0), 100000)
$$;

create or replace function public.catalogo_lojas(p_regiao uuid, p_cidade text, p_nicho text, p_limite integer, p_offset integer, p_destaques boolean default false)
returns table (id uuid, slug text, nome text, cidade text, logo_url text, verificada boolean, total bigint)
language sql stable security definer set search_path = public
as $$
  select * from public.catalogo_lojas_busca(p_regiao, p_cidade, p_nicho, p_limite, p_offset, p_destaques, null)
$$;

revoke all on function public.catalogo_lojas_busca(uuid,text,text,integer,integer,boolean,text) from public;
grant execute on function public.catalogo_lojas_busca(uuid,text,text,integer,integer,boolean,text) to anon, authenticated, service_role;
