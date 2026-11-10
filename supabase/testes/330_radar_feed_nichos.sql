\set ON_ERROR_STOP on
\set QUIET on
begin;

select id as regiao from microrregioes where slug='corrente-pi' \gset
select id as distante from microrregioes where slug='teste-distante' \gset
select id as veiculos from categorias where slug='veiculos' \gset
select id as carros from categorias where slug='carros' \gset
select id as motos from categorias where slug='motos' \gset

insert into anuncios(vitrine_id,categoria_id,titulo,cidade,preco_centavos,atributos,status,publicado_em)
select id,:'motos','Moto de teste para o nicho','Corrente',1500000,
       '{"marca":"Honda","modelo":"CG","ano":2020}','ativo',now()
from vitrines_lojas where dono_id='user_loja';

insert into radar_pedidos(id,comprador_id,microrregiao_id,categoria_id,titulo,detalhes,cidade,criado_em)
values ('33000000-0000-4000-a000-000000000001','user_comprador',:'regiao',:'motos',
        'Moto específica para teste','Detalhe do comprador','Corrente',now()-interval '1 day'),
       ('33000000-0000-4000-a000-000000000002','user_distante',:'distante',:'motos',
        'Moto de outra região','Detalhe de outra região','Outra cidade',now()),
       ('33000000-0000-4000-a000-000000000003','user_comprador',:'regiao',:'veiculos',
        'Veículo sem nicho específico',null,'Corrente',now()-interval '2 days');

-- Mais de uma página de pedidos de um nicho vizinho, todos mais recentes.
insert into radar_pedidos(comprador_id,microrregiao_id,categoria_id,titulo,cidade,criado_em)
select 'user_comprador',:'regiao',:'carros','Pedido de carro de teste '||n,'Corrente',now()
from generate_series(1,42) n;

set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='user_loja';
select set_config('teste.radar330_motos', :'motos', true);
select set_config('teste.radar330_veiculos', :'veiculos', true);
do $$
declare
  motos uuid := current_setting('teste.radar330_motos')::uuid;
  veiculos uuid := current_setting('teste.radar330_veiculos')::uuid;
begin
  assert not exists (
    select 1 from radar_feed_regional('todas',null,40,0) where id='33000000-0000-4000-a000-000000000001'
  ), 'Controle: moto mais antiga está fora da primeira página geral';
  assert (select array_agg(id) = array['33000000-0000-4000-a000-000000000001'::uuid]
          from radar_feed_regional('categoria',motos,40,0)), 'Filtro específico age antes da paginação e respeita a região';
  assert (select count(*) >= 44 from (
    select id from radar_feed_regional('categoria',veiculos,40,0)
    union all
    select id from radar_feed_regional('categoria',veiculos,40,40)
  ) itens), 'Categoria principal inclui subcategorias e permite paginar';
  assert (select count(*) = count(distinct id) from (
    select id from radar_feed_regional('categoria',veiculos,40,0)
    union all
    select id from radar_feed_regional('categoria',veiculos,40,40)
  ) itens), 'Desempate consistente entre páginas';
  assert (select count(*)=2 from radar_feed_regional('meu_nicho',null,40,0)
          where id in ('33000000-0000-4000-a000-000000000001','33000000-0000-4000-a000-000000000003')),
         'Meu nicho inclui pedido da categoria anunciada e pedido genérico compatível';
  assert not exists (
    select 1 from radar_feed_regional('meu_nicho',null,40,0) where titulo like 'Pedido de carro de teste %'
  ), 'Meu nicho não confunde subcategorias vizinhas';
end $$;

set local request.jwt.claim.sub='user_semcodigo';
do $$ begin
  assert (select detalhes is null and comprador_primeiro_nome is null
    from radar_feed_regional('categoria',current_setting('teste.radar330_motos')::uuid,40,0)
    where id='33000000-0000-4000-a000-000000000001'), 'Filtro mantém dados privados protegidos';
end $$;
rollback;
