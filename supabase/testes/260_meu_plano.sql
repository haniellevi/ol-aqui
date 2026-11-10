\set ON_ERROR_STOP on
begin;
create function pg_temp.confere(ok boolean, caso text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FALHOU: %',caso; end if; end $$;
create function pg_temp.recusa(comando text,codigo text) returns void language plpgsql as $$
begin begin execute comando; exception when others then if sqlstate=codigo then return; end if; raise exception 'Estado inesperado: %: %',sqlstate,sqlerrm; end; raise exception 'Aceito indevidamente: %',comando; end $$;
set role authenticated;
set request.jwt.claim.role='authenticated';
set request.jwt.claim.sub='user_loja';
select valor_centavos as valor from opcoes_assinatura() where codigo='slim' and meses=1 \gset
select pagamento_id as pg from pedir_assinatura_site('slim',1,:valor) \gset
select pg_temp.confere((select pagamento_id=:'pg'::uuid from pedir_assinatura_site('slim',1,:valor)),'pedido repetido usa o mesmo pagamento');
select pg_temp.recusa($q$select * from pedir_assinatura_site('full',1,1)$q$,'22023');
select pg_temp.confere((select status='pendente' from pagamentos where id=:'pg'),'mudança de preço não cancela pagamento anterior');
select pg_temp.recusa(format('select reservar_criacao_asaas(%L,%L)',:'pg','sandbox'),'42501');
select pg_temp.recusa('select * from asaas_criacoes','42501');
set request.jwt.claim.sub='user_comprador';
select pg_temp.confere((select count(*)=0 from pagamentos where id=:'pg'),'outra conta não acessa pagamento');
set role anon;
set request.jwt.claim.role='anon';
select pg_temp.recusa($q$select * from pedir_assinatura_site('slim',1,2990)$q$,'42501');
reset role;
set request.jwt.claim.role='';
set request.jwt.claim.sub='';
select pg_temp.confere(reservar_criacao_asaas(:'pg','sandbox'),'primeira reserva aceita');
select pg_temp.confere(not reservar_criacao_asaas(:'pg','sandbox'),'segunda reserva recusada');
select pg_temp.recusa(format('select reservar_criacao_asaas(%L,%L)',:'pg','producao'),'22023');
select pg_temp.confere(registrar_cobranca_asaas(:'pg','pay_260','https://sandbox.asaas.com/i/teste','pix'),'registra cobrança');
select pg_temp.confere(not reservar_criacao_asaas(:'pg','sandbox'),'cobrança existente não ganha nova reserva');
select confirmar_pagamento('pay_260','{"event":"PAYMENT_RECEIVED"}');
select concedido_ate as fim from pagamentos where id=:'pg' \gset
select confirmar_pagamento('pay_260','{"event":"PAYMENT_RECEIVED"}');
select pg_temp.confere((select status='pago' and concedido_ate=:'fim'::timestamptz from pagamentos where id=:'pg'),'confirmação repetida não acrescenta outro período');
rollback;
-- Fixture descartável usada pelas quatro conexões concorrentes do executor.
insert into pagamentos(id,vitrine_id,microrregiao_id,tipo,valor_centavos,status,criado_por)
select '60000000-0000-4000-a000-000000000026',id,microrregiao_id,'assinatura',2990,'pendente','user_loja' from vitrines_lojas where dono_id='user_loja';
