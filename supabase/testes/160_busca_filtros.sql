\set ON_ERROR_STOP on
\set QUIET on
-- Só roda no banco descartável, após as fixtures de 150_fluxo_seguro.sql.
begin;
select id as loja from vitrines_lojas where dono_id = 'user_loja' \gset
select id as distante from vitrines_lojas where dono_id = 'user_distante' \gset
select id as carros from categorias where slug = 'carros' \gset
insert into anuncios (id, vitrine_id, categoria_id, titulo, cidade, preco_centavos, atributos, status, publicado_em) values
 ('40000000-0000-4000-a000-000000000001', :'loja', :'carros', 'Fiat teste de busca A', 'Corrente', 1000000, '{"marca":"Fiat","modelo":"Uno","ano":2015,"cambio":"Manual"}', 'ativo', now() - interval '3 days'),
 ('40000000-0000-4000-a000-000000000002', :'loja', :'carros', 'Fiat teste de busca B', 'Corrente', 2000000, '{"marca":"Fiat","modelo":"Palio","ano":2020,"cambio":"Automático"}', 'ativo', now() - interval '2 days'),
 ('40000000-0000-4000-a000-000000000003', :'loja', :'carros', 'Fiat teste de busca C', 'Bom Jesus', 3000000, '{"marca":"Fiat","modelo":"Argo","ano":2024,"cambio":"Manual"}', 'ativo', now() - interval '1 day'),
 ('40000000-0000-4000-a000-000000000004', :'distante', :'carros', 'Fiat teste de busca distante', 'Outra cidade', 1500000, '{"marca":"Fiat","modelo":"Uno","ano":2018,"cambio":"Manual"}', 'ativo', now()),
 ('40000000-0000-4000-a000-000000000005', :'loja', :'carros', 'Fiat teste de busca pausado', 'Corrente', 1500000, '{"marca":"Fiat","modelo":"Uno","ano":2018,"cambio":"Manual"}', 'pausado', now());
set local role anon;
do $$
declare ids uuid[];
begin
  select array_agg(id) into ids from buscar_anuncios(q => 'Fiat', categoria_slug => 'carros', cidade => 'corrente', preco_min => 1500000, preco_max => 2500000, filtros => '{"ano":{"min":2018,"max":2022},"cambio":["Manual","Automático"]}', microrregiao_slug => 'corrente-pi');
  assert ids = array['40000000-0000-4000-a000-000000000002'::uuid], 'Combinação de texto, categoria, cidade, preço, ano e lista';
  select array_agg(id) into ids from buscar_anuncios(categoria_slug => 'veiculos', microrregiao_slug => 'corrente-pi', ordem => 'menor_preco');
  assert ids = array['40000000-0000-4000-a000-000000000001'::uuid,'40000000-0000-4000-a000-000000000002'::uuid,'40000000-0000-4000-a000-000000000003'::uuid], 'Categoria pai, ordem por preço, região e exclusão de pausados';
  select array_agg(id) into ids from buscar_anuncios(categoria_slug => 'carros', microrregiao_slug => 'corrente-pi', ordem => 'maior_preco', limite => 1, deslocamento => 1);
  assert ids = array['40000000-0000-4000-a000-000000000002'::uuid], 'Paginação usa a mesma ordem';
  assert (select total = 3 from buscar_anuncios(categoria_slug => 'carros', microrregiao_slug => 'corrente-pi', limite => 1, deslocamento => 1)), 'Total independe da página';
  select array_agg(id) into ids from buscar_anuncios(categoria_slug => 'carros', microrregiao_slug => 'corrente-pi', ordem => 'recentes', limite => 1);
  assert ids = array['40000000-0000-4000-a000-000000000003'::uuid], 'Ordenação por mais novos';
  assert (select count(*) = 4 from buscar_anuncios(categoria_slug => 'carros')), 'Busca sem região encontra outros lugares';
  assert not exists(select 1 from buscar_anuncios(categoria_slug => 'carros', preco_min => 4000000, microrregiao_slug => 'corrente-pi')), 'Faixa sem resultados';
end $$;
rollback;
