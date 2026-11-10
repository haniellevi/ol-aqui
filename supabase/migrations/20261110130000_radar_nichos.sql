-- A árvore tem categoria-mãe e subcategoria. Categorias ocultas não geram correspondência.
create function public.radar_nicho_corresponde(p_pedido_categoria uuid, p_anuncio_categoria uuid)
returns boolean language sql stable
set search_path = public
as $$
  select public.categoria_disponivel(p_pedido_categoria)
     and public.categoria_disponivel(p_anuncio_categoria)
     and (p_pedido_categoria = p_anuncio_categoria or exists (
       select 1 from public.categorias c where c.id = p_anuncio_categoria and c.pai_id = p_pedido_categoria
     ))
$$;

-- O Aki também tem pedidos que só registraram a categoria antiga. "geral" cobre
-- vários nichos e fica sem categoria específica. Uma seleção explícita tem precedência.
create function public.radar_categoria_pedido(p_categoria_id uuid, p_legado public.categoria_anuncio)
returns uuid language sql stable
set search_path = public
as $$
  select case when p_categoria_id is not null then
           case when public.categoria_disponivel(p_categoria_id) then p_categoria_id end
         else (
           select c.id from public.categorias c
            where c.pai_id is null and c.ativa and c.tipo_legado = p_legado
              and c.slug = case p_legado
                when 'veiculo' then 'veiculos'
                when 'imovel' then 'imoveis'
                when 'movel' then 'casa-e-moveis'
              end
         ) end
$$;

-- Reaproveita a visibilidade de radar_feed() e filtra antes de limitar a página.
-- O feed antigo continua disponível para o Aki e outras integrações.
create function public.radar_feed_regional(
  p_filtro text default 'todas', p_categoria_id uuid default null,
  p_limite integer default 41, p_deslocamento integer default 0)
returns table (
  id uuid, categoria_id uuid, titulo text, detalhes text, preco_min_centavos bigint,
  preco_max_centavos bigint, categoria_nome text, cidade text, urgencia text, total_propostas integer,
  max_propostas integer, modo_contato text, propostas_ate timestamptz, criado_em timestamptz,
  comprador_certificado boolean, comprador_primeiro_nome text, ja_propus boolean, sou_comprador boolean
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
         f.criado_em, f.comprador_certificado, f.comprador_primeiro_nome, f.ja_propus, f.sou_comprador
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

revoke all on function public.radar_nicho_corresponde(uuid, uuid),
  public.radar_categoria_pedido(uuid, public.categoria_anuncio),
  public.radar_feed_regional(text, uuid, integer, integer)
  from public, anon, authenticated;
grant execute on function public.radar_feed_regional(text, uuid, integer, integer) to authenticated;
