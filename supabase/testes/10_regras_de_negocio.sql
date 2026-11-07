\set ON_ERROR_STOP 0
\set QUIET on
\pset footer off
select id as reg from microrregioes where slug='corrente-pi' \gset
insert into perfis (id,microrregiao_id,nome,whatsapp,cidade,tipo_pessoa) values
 ('user_a',:'reg','Maria Comprador','5589999990000','Corrente','pf'),
 ('user_b',:'reg','Loja Teste','5589999991111','Corrente','pj'),
 ('user_c',:'reg','Loja Paga','5589999992222','Corrente','pj'),
 ('user_d',:'reg','Zé PF','5589999993333','Corrente','pf');
insert into vitrines_lojas (dono_id,microrregiao_id,slug,nome,cidade,whatsapp) values
 ('user_b',:'reg','loja-teste','Loja Teste','Corrente','5589999991111'),
 ('user_c',:'reg','loja-paga','Loja Paga','Corrente','5589999992222'),
 ('user_d',:'reg','ze-pf','Zé PF','Corrente','5589999993333');
update perfis set whatsapp_verificado_em=now() where id='user_a';
update vitrines_lojas set plano='full', plano_expira_em=now()+interval '30 days' where slug='loja-paga';
update vitrines_lojas set teste_expira_em=now()-interval '1 day' where slug='ze-pf';
select count(*) as cidades_piloto from cidades;

set role authenticated;
select set_config('request.jwt.claim.role','authenticated',false) \g /dev/null
-- comprador cria 5 pedidos (1 em modo prazo)
select set_config('request.jwt.claim.sub','user_a',false) \g /dev/null
insert into radar_pedidos (comprador_id,microrregiao_id,titulo,cidade,categoria) select 'user_a',:'reg','Procuro trator traçado '||g,'Corrente','veiculo' from generate_series(1,4) g;
insert into radar_pedidos (comprador_id,microrregiao_id,titulo,cidade,modo_contato,propostas_ate) values ('user_a',:'reg','Procuro moto até 15 mil','Corrente','propostas_prazo',now()+interval '1 day');
\echo '[1] pedido com palavra proibida vai para analise'
insert into radar_pedidos (comprador_id,microrregiao_id,titulo,cidade) values ('user_a',:'reg','Procuro pistola usada barata','Corrente') returning status, motivo_analise;
\echo '[2] comprador sem WhatsApp confirmado nao posta (deve dar erro de RLS)'
select set_config('request.jwt.claim.sub','user_d',false) \g /dev/null
insert into radar_pedidos (comprador_id,microrregiao_id,titulo,cidade) values ('user_d',:'reg','Procuro geladeira duplex','Corrente');
\echo '[3] PF com teste vencido: 3 gratis, o 4o falha'
insert into anuncios (vitrine_id,microrregiao_id,categoria,titulo,cidade,atributos) select v.id,v.microrregiao_id,'movel','Mesa de madeira '||g,'Corrente','{}' from vitrines_lojas v, generate_series(1,3) g where slug='ze-pf';
insert into anuncios (vitrine_id,microrregiao_id,categoria,titulo,cidade) select v.id,v.microrregiao_id,'movel','Mesa de madeira 4','Corrente' from vitrines_lojas v where slug='ze-pf';
\echo '[4] PF sem acesso ao Radar'
select tem_plano_pago() as pf_radar;
\echo '[5] loja em teste: 3 propostas, a 4a falha'
select set_config('request.jwt.claim.sub','user_b',false) \g /dev/null
select propostas_restantes() as antes;
select modo, whatsapp from revelar_contato_radar((select id from radar_feed where titulo='Procuro trator traçado 1'));
select modo, whatsapp from revelar_contato_radar((select id from radar_feed where titulo='Procuro trator traçado 2'));
select modo, whatsapp from revelar_contato_radar((select id from radar_feed where titulo='Procuro trator traçado 3'));
select modo, whatsapp from revelar_contato_radar((select id from radar_feed where titulo='Procuro trator traçado 4'));
\echo '[6] modo prazo: nao revela WhatsApp'
select set_config('request.jwt.claim.sub','user_c',false) \g /dev/null
select modo, whatsapp, mensagem from revelar_contato_radar((select id from radar_feed where modo_contato='propostas_prazo'), null, 'Tenho uma Titan 2019', 1450000);
\echo '[7] preco absurdo vai para analise'
insert into anuncios (vitrine_id,microrregiao_id,categoria,titulo,cidade,preco_centavos,atributos) select v.id,v.microrregiao_id,'veiculo','Hilux 2022 zerada','Corrente',50000,'{"tipo":"carro"}' from vitrines_lojas v where slug='loja-paga' returning status, motivo_analise;
\echo '[8] dono nao tira da analise'
update anuncios set status='ativo' where titulo='Hilux 2022 zerada';
\echo '[9] comprador escolhe a proposta e recebe WhatsApp da loja'
select set_config('request.jwt.claim.sub','user_a',false) \g /dev/null
select * from escolher_proposta((select id from radar_propostas where preco_centavos=1450000));
\echo '[10] denuncias: 3 tiram o anuncio do ar'
reset role;
insert into anuncios (vitrine_id,microrregiao_id,categoria,titulo,cidade) select v.id,v.microrregiao_id,'geral','Celular novo lacrado','Corrente' from vitrines_lojas v where slug='loja-paga';
insert into perfis (id,microrregiao_id,nome,cidade) values ('user_e1',:'reg','Den Um','Corrente'),('user_e2',:'reg','Den Dois','Corrente');
set role authenticated;
select set_config('request.jwt.claim.sub','user_e1',false) \g /dev/null
insert into denuncias (alvo_tipo,alvo_id,denunciante_id,motivo) select 'anuncio',id,'user_e1','golpe' from anuncios where titulo='Celular novo lacrado';
select set_config('request.jwt.claim.sub','user_e2',false) \g /dev/null
insert into denuncias (alvo_tipo,alvo_id,denunciante_id,motivo) select 'anuncio',id,'user_e2','golpe' from anuncios where titulo='Celular novo lacrado';
select set_config('request.jwt.claim.sub','user_a',false) \g /dev/null
insert into denuncias (alvo_tipo,alvo_id,denunciante_id,motivo) select 'anuncio',id,'user_a','golpe' from anuncios where titulo='Celular novo lacrado';
reset role;
select status, motivo_analise from anuncios where titulo='Celular novo lacrado';
\echo '[11] admin muda preco do Slim pelo painel e fica no log; nao-admin nao muda'
set role authenticated;
update planos set preco_centavos=1 where codigo='slim';
reset role;
select preco_centavos as slim_apos_tentativa from planos where codigo='slim';
select set_config('request.jwt.claim.role','',false) \g /dev/null
update perfis set e_admin=true where id='user_a';
select set_config('request.jwt.claim.role','authenticated',false) \g /dev/null
set role authenticated;
update planos set preco_centavos=5990 where codigo='slim';
reset role;
select preco_centavos as slim_admin from planos where codigo='slim';
select tabela, acao, usuario_id from logs_atividade where tabela='planos';
\echo '[12] webhook Asaas: avulso PF fura o limite'
insert into pagamentos (vitrine_id,microrregiao_id,tipo,anuncio_id,valor_centavos,asaas_cobranca_id) select v.id,v.microrregiao_id,'anuncio_avulso',(select id from anuncios where titulo='Mesa de madeira 1'),990,'pay_123' from vitrines_lojas v where slug='ze-pf';
select confirmar_pagamento('pay_123');
select confirmar_pagamento('pay_123');
set role authenticated;
select set_config('request.jwt.claim.sub','user_d',false) \g /dev/null
insert into anuncios (vitrine_id,microrregiao_id,categoria,titulo,cidade) select v.id,v.microrregiao_id,'movel','Mesa de madeira 4','Corrente' from vitrines_lojas v where slug='ze-pf' returning titulo, status;
