-- Categorias · Etapa 1 do painel novo: quantos anúncios no ar cada categoria tem na região.
-- A soma sobe pelo caminho: um anúncio em "Ração" conta para Ração, Produtos para pets e Pet.
-- Serve para a home ordenar os chips (mais anúncios primeiro) e esconder as vazias para quem procura.
-- Mesmo recorte do catálogo: anúncio ativo, da região, de loja/vendedor ativo.
-- Só leitura; sem dado pessoal (só ids de categoria e números).

create or replace function public.contagem_categorias_regiao(p_regiao uuid)
returns table (categoria_id uuid, total bigint)
language sql stable security definer
set search_path = public
as $$
  select caminho.id, count(*)::bigint
    from public.anuncios a
    join public.vitrines_lojas v on v.id = a.vitrine_id and v.status = 'ativa'
    cross join lateral public.categoria_caminho(a.categoria_id) as caminho(id)
   where a.status = 'ativo'
     and a.microrregiao_id = p_regiao
     and a.categoria_id is not null
   group by caminho.id
$$;

revoke all on function public.contagem_categorias_regiao(uuid) from public;
grant execute on function public.contagem_categorias_regiao(uuid) to anon, authenticated, service_role;

comment on function public.contagem_categorias_regiao(uuid) is
  'Anúncios no ar por categoria na região, somando para as categorias de cima. Usada na home (ordem e vazias).';
