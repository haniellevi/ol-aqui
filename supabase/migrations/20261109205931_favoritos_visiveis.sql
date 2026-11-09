-- Um favorito novo exige anúncio ativo e vendedor ativo, inclusive para o próprio dono.
-- As regras de leitura/exclusão próprias continuam permitindo limpar itens fora do ar.
drop policy if exists "favoritos criar" on public.favoritos;
create policy "favoritos criar" on public.favoritos
  for insert to authenticated with check (
    usuario_id = public.usuario_id()
    and exists (
      select 1 from public.anuncios a
      join public.vitrines_lojas v on v.id = a.vitrine_id
      where a.id = anuncio_id and a.status = 'ativo' and v.status = 'ativa'
    )
  );
