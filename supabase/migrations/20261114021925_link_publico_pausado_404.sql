-- Pausados retornam 404 na rota pública. O painel continua usando a consulta da loja.
create or replace function public.anuncio_fora_do_ar(p_anuncio_id uuid)
returns table (categoria_slug text, categoria_nome text)
language sql stable security definer
set search_path = public, extensions
as $$
  select c.slug, c.nome
    from public.anuncios a
    join public.vitrines_lojas v on v.id = a.vitrine_id
    left join public.categorias c on c.id = a.categoria_id and c.ativa
   where a.id = p_anuncio_id
     and (a.status = 'expirado'
          or (a.status in ('ativo', 'vendido') and v.status <> 'ativa'))
$$;
