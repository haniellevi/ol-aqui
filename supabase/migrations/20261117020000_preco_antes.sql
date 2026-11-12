-- Card de anúncio no estilo da OLX: preço antigo riscado e "Cidade - UF".
-- * preco_antes_centavos: opcional. Quem baixa o preço na edição pode dizer quanto era.
--   O card só risca quando ele é MAIOR que o preço atual (a regra fica na tela, então
--   mudar o preço depois nunca quebra um salvamento).
--   Mesmas regras do preço: mesma tabela, mesmas políticas (só o dono, o ajudante e a equipe
--   editam; todo mundo lê os anúncios no ar), mesmo limite (>= 0). Nenhuma permissão nova.
-- * anuncios_cards_extra(ids): devolve, para os cards de uma lista, o preço antes e a UF da
--   cidade. Roda com as permissões de quem pergunta (security invoker), então só devolve o
--   que a pessoa já podia ler.

alter table public.anuncios
  add column if not exists preco_antes_centavos bigint check (preco_antes_centavos >= 0);
comment on column public.anuncios.preco_antes_centavos is
  'Preço anterior (opcional), informado ao baixar o preço. O card mostra riscado só se for maior que preco_centavos.';

create or replace function public.anuncios_cards_extra(p_ids uuid[])
returns table (id uuid, preco_antes_centavos bigint, uf text)
language sql stable security invoker
set search_path = public, extensions
as $$
  select a.id,
         a.preco_antes_centavos,
         (select c.uf::text
            from public.cidades c
           where c.microrregiao_id = a.microrregiao_id
             and public.nome_comparavel(c.nome) = public.nome_comparavel(a.cidade)
           order by c.ativa desc, c.uf
           limit 1) as uf
    from public.anuncios a
   where a.id = any(p_ids[1:200])
$$;

revoke all on function public.anuncios_cards_extra(uuid[]) from public;
grant execute on function public.anuncios_cards_extra(uuid[]) to anon, authenticated, service_role;
