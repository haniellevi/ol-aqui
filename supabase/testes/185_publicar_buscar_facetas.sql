\set ON_ERROR_STOP on
\set QUIET on
-- Rascunhos fictícios. Exercita a publicação autenticada e a busca pública no mesmo banco.
begin;
select id as loja from vitrines_lojas where dono_id = 'user_loja' \gset
select id as distante from vitrines_lojas where dono_id = 'user_distante' \gset
select id as loja_inativa from vitrines_lojas where dono_id = 'user_cota' \gset
select id as carros from categorias where slug = 'carros' \gset
select id as casas from categorias where slug = 'casas' \gset

set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = 'user_loja';

insert into anuncios (id, vitrine_id, categoria_id, titulo, cidade, preco_centavos, atributos, fotos, status)
select f.id, :'loja', f.categoria_id, f.titulo, 'Corrente', f.preco, f.atributos,
       array['https://abc.supabase.co/storage/v1/object/public/anuncios/user_loja/' || f.id || '/1.webp'],
       'rascunho'
  from (values
    ('61000000-0000-4000-a000-000000000001'::uuid, :'carros'::uuid, 'Carro Facetas Automático', 6000000,
      '{"marca":"Fiat","ano":2020,"km":62000,"cambio":"Automático","combustivel":"Flex"}'::jsonb),
    ('61000000-0000-4000-a000-000000000002', :'carros', 'Carro Facetas Manual', 4000000,
      '{"marca":"Fiat","modelo":"Uno","ano":2018,"km":70000,"cambio":"Manual","combustivel":"Gasolina"}'),
    ('61000000-0000-4000-a000-000000000003', :'casas', 'Casa Facetas com jardim', 25000000,
      '{"quartos":3,"area":95.5,"vagas":0}'),
    ('61000000-0000-4000-a000-000000000004', :'carros', 'Carro Facetas Rascunho', 9000000,
      '{"marca":"Fiat","modelo":"Argo","ano":2022,"km":5000,"cambio":"Automático","combustivel":"Elétrico"}'),
    ('61000000-0000-4000-a000-000000000005', :'casas', 'Casa Facetas para aluguel', 150000,
      '{"finalidade":"Aluguel","quartos":2}'),
    ('61000000-0000-4000-a000-000000000006', :'carros', 'Carro Facetas alta quilometragem', 3000000,
      '{"marca":"Fiat","modelo":"Punto","ano":2017,"km":96000,"cambio":"Automático","combustivel":"Flex"}')
  ) f(id, categoria_id, titulo, preco, atributos);

do $$
begin
  begin
    perform publicar_anuncio('61000000-0000-4000-a000-000000000001');
    raise exception 'Carro sem modelo foi publicado';
  exception when check_violation then null;
  end;
  begin
    perform publicar_anuncio('61000000-0000-4000-a000-000000000003');
    raise exception 'Casa sem finalidade foi publicada';
  exception when check_violation then null;
  end;
  update anuncios set atributos = atributos || '{"modelo":"Pulse"}'::jsonb where id = '61000000-0000-4000-a000-000000000001';
  update anuncios set atributos = atributos || '{"finalidade":"venda"}'::jsonb where id = '61000000-0000-4000-a000-000000000003';
  assert publicar_anuncio('61000000-0000-4000-a000-000000000001') = 'ativo', 'Publicação de Carros';
  assert publicar_anuncio('61000000-0000-4000-a000-000000000002') = 'ativo', 'Publicação de Carros com outro câmbio';
  assert publicar_anuncio('61000000-0000-4000-a000-000000000003') = 'ativo', 'Publicação de Casas';
  assert publicar_anuncio('61000000-0000-4000-a000-000000000005') = 'ativo', 'Aluguel sem área é publicável';
  assert publicar_anuncio('61000000-0000-4000-a000-000000000006') = 'ativo', 'Carro acima da faixa';
end $$;

reset role;
set local request.jwt.claim.role = 'postgres';
set local request.jwt.claim.sub = '';
insert into anuncios (vitrine_id, categoria_id, titulo, cidade, preco_centavos, atributos, status) values
  (:'distante', :'carros', 'Carro Facetas fora da região', 'Outra cidade', 6000000,
    '{"marca":"Fiat","modelo":"Punto","ano":2018,"km":100,"cambio":"Manual","combustivel":"Diesel"}', 'ativo'),
  (:'loja_inativa', :'carros', 'Carro Facetas de loja suspensa', 'Corrente', 6000000,
    '{"marca":"Fiat","modelo":"Punto","ano":2018,"km":100,"cambio":"Manual","combustivel":"Híbrido"}', 'ativo'),
  (:'loja', :'carros', 'Carro Facetas em outra cidade', 'Bom Jesus', 6000000,
    '{"marca":"Fiat","modelo":"Punto","ano":2018,"km":100,"cambio":"Manual","combustivel":"Etanol"}', 'ativo'),
  (:'loja', :'carros', 'Carro Facetas vendido', 'Corrente', 6000000,
    '{"marca":"Fiat","modelo":"Punto","ano":2018,"km":100,"cambio":"Manual","combustivel":"GNV"}', 'vendido');
update vitrines_lojas set status = 'suspensa' where id = :'loja_inativa';

set local role anon;
set local request.jwt.claim.role = 'anon';
do $$
declare r jsonb;
begin
  r := buscar_anuncios_com_facetas(q => 'Facetas', categoria_slug => 'carros', cidade => 'corrente',
    microrregiao_slug => 'corrente-pi', filtros => '{"km":{"max":80000},"cambio":["Automático"]}');
  assert (r->>'total')::integer = 1 and r#>>'{anuncios,0,id}' = '61000000-0000-4000-a000-000000000001',
    'O carro publicado corresponde a ano/km/câmbio na região';
  assert r#>'{facetas,cambio,opcoes}' = '{"Automático":1,"Manual":1}', 'OU no câmbio, contando sem o filtro do próprio câmbio';
  assert r#>'{facetas,km}' = '{"min":62000,"max":96000}', 'Faixa de km considera o câmbio e desconsidera o filtro de km';
  assert r#>'{facetas,combustivel,opcoes}' = '{"Flex":1}', 'Combustível cruza os outros filtros';

  r := buscar_anuncios_com_facetas(q => 'Facetas', categoria_slug => 'carros', cidade => 'Corrente', preco_max => 7000000,
    microrregiao_slug => 'corrente-pi', filtros => '{"km":{"max":80000},"cambio":["Automático","Manual"]}',
    ordem => 'maior_preco', limite => 1, deslocamento => 1);
  assert (r->>'total')::integer = 2 and r#>>'{anuncios,0,id}' = '61000000-0000-4000-a000-000000000002',
    'Seleção múltipla encontra os dois anúncios e pagina depois de filtrar';
  assert r#>'{facetas,combustivel,opcoes}' = '{"Flex":1,"Gasolina":1}',
    'Contagem usa a busca completa e exclui outras regiões, outras cidades, rascunhos, vendidos e vitrines suspensas';
  assert not ((r->'facetas') ? 'modelo') and r#>'{facetas,marca}' = '{}',
    'Facetas seguem o catálogo e o texto livre fica disponível para digitar';

  r := buscar_anuncios_com_facetas(q => 'Facetas', categoria_slug => 'casas', cidade => 'Corrente',
    microrregiao_slug => 'corrente-pi', filtros => '{"finalidade":["Venda"],"quartos":{"min":3},"vagas":{"max":0},"area":{"min":95}}');
  assert (r->>'total')::integer = 1 and r#>>'{anuncios,0,id}' = '61000000-0000-4000-a000-000000000003',
    'Encontra a casa publicada por finalidade, quartos, área e zero vagas';
  assert r#>'{facetas,area}' = '{"min":95.5,"max":95.5}' and r#>'{facetas,vagas}' = '{"min":0,"max":0}',
    'Faixas preservam decimal e zero';
  assert not ((r->'facetas') ? 'km'), 'Casas não herda campos de Carros';
  r := buscar_anuncios_com_facetas(q => 'Facetas', categoria_slug => 'casas', cidade => 'Corrente',
    microrregiao_slug => 'corrente-pi', filtros => '{"finalidade":["Aluguel"],"area":{"min":0}}');
  assert (r->>'total')::integer = 0 and r->'anuncios' = '[]'::jsonb and not ((r->'facetas') ? 'area'),
    'Área ausente fica fora da faixa e a busca válida pode retornar vazia';

  begin
    perform buscar_anuncios_com_facetas(categoria_slug => 'carros', microrregiao_slug => 'corrente-pi', filtros => '{"modelo":"Uno"}');
    raise exception 'A RPC aceitou um filtro que o catálogo não permite';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform buscar_anuncios_com_facetas(categoria_slug => 'carros');
    raise exception 'A RPC aceitou facetas sem recorte regional';
  exception when invalid_parameter_value then null;
  end;
end $$;

reset role;
insert into configuracoes (chave, microrregiao_id, valor, grupo)
select 'busca.facetas_ativas', id, 'false', 'busca' from microrregioes where slug = 'corrente-pi';
set local role anon;
do $$
declare r jsonb;
begin
  r := buscar_anuncios_com_facetas(q => 'Facetas', categoria_slug => 'casas', microrregiao_slug => 'corrente-pi');
  assert (r->>'total')::integer = 2 and r->'facetas' = 'null'::jsonb,
    'Configuração regional desliga as facetas mantendo a busca';
end $$;
rollback;
