\set ON_ERROR_STOP 0
\pset footer off
\echo '[17] token sem role (vira anon) nao altera plano da vitrine'
set role anon; select set_config('request.jwt.claim.sub','user_b',false), set_config('request.jwt.claim.role','',false) \g /dev/null
update vitrines_lojas set plano='full', plano_expira_em='2999-01-01' where dono_id='user_b';
reset role; select plano from vitrines_lojas where dono_id='user_b';
\echo '[18] cadastro de vitrine com teste eterno e forcado para o padrao'
select set_config('request.jwt.claim.role','',false) \g /dev/null
insert into perfis (id,microrregiao_id,nome) select 'user_novo', id, 'Novo' from microrregioes limit 1;
set role authenticated; select set_config('request.jwt.claim.sub','user_novo',false), set_config('request.jwt.claim.role','authenticated',false) \g /dev/null
insert into vitrines_lojas (dono_id,microrregiao_id,slug,nome,cidade,teste_expira_em,criado_em,status) select 'user_novo', id, 'loja-nova','Loja Nova','Corrente','2999-01-01','2999-01-01','ativa' from microrregioes limit 1;
reset role; select teste_expira_em < now() + interval '31 days' as teste_normal, criado_em <= now() as criado_normal from vitrines_lojas where slug='loja-nova';
\echo '[19] anuncio criado com pago_ate e destaque e zerado'
set role authenticated;
insert into anuncios (vitrine_id,microrregiao_id,categoria,titulo,cidade,pago_ate,destaque_ate,total_favoritos) select v.id,v.microrregiao_id,'geral','Bicicleta aro 29','Corrente','2999-01-01','2999-01-01',999 from vitrines_lojas v where slug='loja-nova' returning pago_ate, destaque_ate, total_favoritos;
\echo '[20] loja sem acesso ve o pedido no feed mas sem detalhes nem nome; tabela direta vazia'
select set_config('request.jwt.claim.sub','user_d',false) \g /dev/null
select titulo, detalhes, comprador_primeiro_nome from radar_feed limit 1;
select count(*) as direto from radar_pedidos;
\echo '[21] loja paga ve detalhes'
select set_config('request.jwt.claim.sub','user_c',false) \g /dev/null
update radar_pedidos set detalhes='Trator 4x4 ate 2015' where false;
select count(*) filter (where comprador_primeiro_nome is not null) as com_nome from radar_feed;
\echo '[22] comprador com celular nao confirmado: nao entrega o numero'
reset role; select set_config('request.jwt.claim.role','',false) \g /dev/null
update perfis set whatsapp_verificado_em=null where id='user_a';
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_c',false) \g /dev/null
select * from revelar_contato_radar((select id from radar_feed where titulo='Procuro trator traçado 4' ));
