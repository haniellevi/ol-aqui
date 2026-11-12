\set ON_ERROR_STOP on
\set QUIET on
-- Radar v2, ajustes finais: pode_propor, "Eu sei onde tem" para loja de fora da área (RF1),
-- loja ativa nas indicações, aviso com o nome da região (RF2), "Ainda preciso" no banco,
-- contas internas fechadas, FK do autor, plano de teste e pedido do Aki na região toda.
begin;
reset role;
set local request.jwt.claim.role='';
set local request.jwt.claim.sub='';

create function pg_temp.confere(ok boolean, caso text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FALHOU: %', caso; end if;
end $$;
create function pg_temp.recusa(comando text, codigo text, trecho text default null) returns void language plpgsql as $$
begin
  begin execute comando;
  exception when others then
    if sqlstate = codigo and (trecho is null or sqlerrm like '%' || trecho || '%') then return; end if;
    raise exception 'Estado inesperado: % (%), esperado %: %', sqlstate, sqlerrm, codigo, comando;
  end;
  raise exception 'Comando aceito indevidamente: %', comando;
end $$;

select id as regiao, nome as regiao_nome from microrregioes where slug='corrente-pi' \gset
select id as c_corrente from cidades where microrregiao_id = :'regiao' and nome = 'Corrente' \gset
select id as moveis from categorias where slug = 'sofas-e-poltronas' \gset
update configuracoes set valor = '100'
 where chave in ('radar.pedidos_por_dia', 'radar.pedidos_abertos_max',
                 'radar.avisos_lojas_por_dia', 'radar.avisos_lojas_por_comprador_dia') and microrregiao_id is null;
update configuracoes set valor = '200' where chave = 'radar.avisos_lojas_max_por_pedido' and microrregiao_id is null;

insert into perfis(id, microrregiao_id, nome, whatsapp, whatsapp_verificado_em, cidade, tipo_pessoa) values
  ('user_q650comp', :'regiao', 'Compradora 650',   '5589999965001', now(), 'Corrente', 'pf'),
  ('user_q650dent', :'regiao', 'Loja Corrente 650','5589999965002', now(), 'Corrente', 'pj'),
  ('user_q650fora', :'regiao', 'Loja Parnagua 650','5589999965003', now(), 'Parnaguá', 'pj'),
  ('user_q650susp', :'regiao', 'Loja suspensa 650','5589999965004', now(), 'Corrente', 'pj'),
  ('user_q650ind',  :'regiao', 'Indicadora 650',   '5589999965005', now(), 'Corrente', 'pf');

insert into vitrines_lojas(dono_id, microrregiao_id, slug, nome, cidade, tipo, plano, plano_expira_em, teste_expira_em, criado_em) values
  ('user_q650dent', :'regiao', 'q650-dent', 'Loja Corrente 650', 'Corrente', 'loja', 'full', now() + interval '10 days', now() - interval '1 day', now() + interval '1 second'),
  ('user_q650fora', :'regiao', 'q650-fora', 'Loja Parnagua 650', 'Parnaguá', 'loja', 'full', now() + interval '10 days', now() - interval '1 day', now() + interval '2 second'),
  ('user_q650susp', :'regiao', 'q650-susp', 'Loja suspensa 650', 'Corrente', 'loja', 'slim', now() + interval '10 days', now() - interval '1 day', now() + interval '3 second');
update vitrines_lojas set verificacao_estado = 'aprovada', selo_loja_verificada = true where slug in ('q650-dent', 'q650-fora');
select id as vit_dent from vitrines_lojas where slug = 'q650-dent' \gset
select id as vit_fora from vitrines_lojas where slug = 'q650-fora' \gset
select id as vit_susp from vitrines_lojas where slug = 'q650-susp' \gset

insert into anuncios(id, vitrine_id, categoria_id, titulo, cidade, preco_centavos, atributos, status) values
  ('65000000-0000-4000-b000-000000000001', :'vit_dent', :'moveis', 'Sofá da loja de Corrente 650', 'Corrente', 10000, '{"estado":"usado"}', 'ativo'),
  ('65000000-0000-4000-b000-000000000002', :'vit_fora', :'moveis', 'Sofá da loja de Parnaguá 650', 'Parnaguá', 10000, '{"estado":"usado"}', 'ativo'),
  ('65000000-0000-4000-b000-000000000003', :'vit_susp', :'moveis', 'Sofá da loja suspensa 650', 'Corrente', 10000, '{"estado":"usado"}', 'ativo');
update vitrines_lojas set status = 'suspensa' where id = :'vit_susp';

-- A: "Todo mundo", só Corrente. B: "Todo mundo", região toda (avisa a loja Full de Corrente).
insert into radar_pedidos(id, comprador_id, microrregiao_id, categoria_id, titulo, cidade, cidades_ids, visibilidade, detalhes) values
  ('65000000-0000-4000-a000-000000000001', 'user_q650comp', :'regiao', :'moveis', 'Procuro sofá 650 em Corrente', 'Corrente', array[:'c_corrente']::uuid[], 'todos', 'Detalhe 650A');
insert into radar_pedidos(id, comprador_id, microrregiao_id, categoria_id, titulo, cidade, visibilidade) values
  ('65000000-0000-4000-a000-000000000002', 'user_q650comp', :'regiao', :'moveis', 'Procuro sofá 650 na região', 'Toda a região', 'todos');

-- ===== RF2: aviso com o nome da região =====
select pg_temp.confere((select count(*) = 1 from notificacoes
  where usuario_id = 'user_q650dent' and chave = 'pedido_novo:65000000-0000-4000-a000-000000000002'
    and texto like '%' || :'regiao_nome' || '%' and texto not like '%Toda a região%'),
  'Aviso de pedido sem cidades diz o nome da região');
select pg_temp.confere((select count(*) = 1 from notificacoes
  where usuario_id = 'user_q650dent' and chave = 'pedido_novo:65000000-0000-4000-a000-000000000001'
    and texto like '%Corrente%'),
  'Aviso de pedido com cidade segue dizendo a cidade');

set local role authenticated;
set local request.jwt.claim.role='authenticated';

-- ===== RF3: pode_propor =====
set local request.jwt.claim.sub='user_q650dent';
select pg_temp.confere((select pode_propor from radar_pedido('65000000-0000-4000-a000-000000000001')), 'Loja da área pode propor (tela)');
select pg_temp.confere((select pode_propor from radar_feed() where id = '65000000-0000-4000-a000-000000000001'), 'Loja da área pode propor (feed)');
set local request.jwt.claim.sub='user_q650fora';
select pg_temp.confere((select not pode_propor and not bloqueado and detalhes = 'Detalhe 650A' and area_texto = 'Corrente'
  from radar_pedido('65000000-0000-4000-a000-000000000001')), 'Loja de fora da área vê o pedido Todo mundo sem poder propor');
select pg_temp.confere((select count(*) = 1 and bool_and(not pode_propor) from radar_feed() where id = '65000000-0000-4000-a000-000000000001'),
  'Feed: pedido Todo mundo de outra cidade sem pode_propor');
select pg_temp.confere((select pode_propor from radar_pedido('65000000-0000-4000-a000-000000000002')), 'Região toda: a loja de Parnaguá pode propor');
set local request.jwt.claim.sub='user_q650comp';
select pg_temp.confere((select not pode_propor from radar_pedido('65000000-0000-4000-a000-000000000001')), 'Comprador não propõe no próprio pedido');
set local request.jwt.claim.sub='user_q650ind';
select pg_temp.confere((select not pode_propor from radar_pedido('65000000-0000-4000-a000-000000000001')), 'Quem não atende não propõe');

-- ===== RF1: "Eu sei onde tem" =====
set local request.jwt.claim.sub='user_q650dent';
select pg_temp.recusa($q$select indicar_anuncio_radar('65000000-0000-4000-a000-000000000001','65000000-0000-4000-b000-000000000002')$q$, 'P0001', 'mandar oferta');
set local request.jwt.claim.sub='user_q650fora';
select pg_temp.confere((select indicar_anuncio_radar('65000000-0000-4000-a000-000000000001','65000000-0000-4000-b000-000000000001') is not null),
  'Loja de fora da área indica anúncio de outra loja');
select pg_temp.recusa($q$select indicar_anuncio_radar('65000000-0000-4000-a000-000000000002','65000000-0000-4000-b000-000000000001')$q$, 'P0001', 'mandar oferta');

-- ===== 10: loja do anúncio precisa estar ativa =====
set local request.jwt.claim.sub='user_q650ind';
select pg_temp.recusa($q$select indicar_anuncio_radar('65000000-0000-4000-a000-000000000001','65000000-0000-4000-b000-000000000003')$q$, 'P0002');
select indicar_anuncio_radar('65000000-0000-4000-a000-000000000001','65000000-0000-4000-b000-000000000002');
set local request.jwt.claim.sub='user_q650comp';
select pg_temp.confere((select count(*) = 2 from indicacoes_do_pedido('65000000-0000-4000-a000-000000000001')), 'Comprador vê as 2 indicações');
reset role;
update vitrines_lojas set status = 'suspensa' where id = :'vit_fora';
set local role authenticated;
select pg_temp.confere((select count(*) = 1 and bool_and(vitrine_nome = 'Loja Corrente 650') from indicacoes_do_pedido('65000000-0000-4000-a000-000000000001')),
  'Indicação de loja suspensa some da lista');

-- ===== 6: "Ainda preciso" longe do prazo =====
select pg_temp.recusa($q$select estender_pedido_radar('65000000-0000-4000-a000-000000000001')$q$, 'P0001', 'Ainda falta');
select pg_temp.confere((select extensoes = 0 from radar_pedidos where id = '65000000-0000-4000-a000-000000000001'), 'Recusa não estende');

-- ===== 5: contas internas fechadas para a API =====
select pg_temp.recusa($q$select pode_atender_radar('user_q650dent')$q$, '42501');
select pg_temp.recusa($q$select recebe_aviso_radar_na_hora('user_q650dent')$q$, '42501');
select pg_temp.recusa(format($q$select radar_cortesia_ativa(%L)$q$, :'vit_dent'), '42501');
select pg_temp.recusa($q$select radar_pedido_na_area(p, v) from radar_pedidos p, vitrines_lojas v limit 1$q$, '42501');
select pg_temp.recusa($q$select radar_pode_estender(p, 'x') from radar_pedidos p limit 1$q$, '42501');

-- ===== 1: pedido do Aki sem cidade vale para a região toda =====
select criar_pedido_radar(p_titulo => 'Procuro mesa de jantar 650', p_cidade => null, p_origem => 'aki') as aki \gset
select pg_temp.confere((select area_texto = 'Toda a região' from meus_pedidos_radar(false) where id = ((:'aki')::jsonb->>'id')::uuid),
  'Pedido do Aki sem cidade: Toda a região');

reset role;
select pg_temp.confere(not exists (select 1 from pg_proc where proname = 'radar_pode_ver_pedido'), 'radar_pode_ver_pedido saiu');
select pg_temp.confere(has_function_privilege('service_role', 'public.pode_atender_radar(text)', 'execute'), 'service_role segue chamando');

-- ===== 8: autor da indicação aponta para perfis, com cascade =====
select pg_temp.confere((select confdeltype = 'c' from pg_constraint where conname = 'radar_indicacoes_autor_fk'), 'FK do autor com on delete cascade');
select pg_temp.recusa($q$insert into radar_indicacoes(pedido_id, autor_id, anuncio_id) values ('65000000-0000-4000-a000-000000000002','user_q650naoexiste','65000000-0000-4000-b000-000000000001')$q$, '23503');

-- ===== 3a: plano de teste não promete Radar =====
select pg_temp.confere((select descricao not ilike '%radar%' from planos where codigo = 'teste'), 'Plano de teste sem promessa de Radar');
rollback;
