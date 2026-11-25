-- Executado antes da migração: assinatura produzida pela função antiga, sem dados reais.
\set ON_ERROR_STOP on
select id as reg from microrregioes where slug='corrente-pi' \gset
insert into perfis(id,microrregiao_id,nome,cidade) values
 ('user_pre901',:'reg','Retenção Sintética','Corrente'),
 ('user_pre902',:'reg','Suspensão Sintética','Corrente'),
 ('user_pre903',:'reg','Ativa Sintética','Corrente');
insert into vitrines_lojas(dono_id,microrregiao_id,slug,nome,cidade,tipo,status)
values ('user_pre901',:'reg','pre901','Histórico Sintético','Corrente','loja','ativa'),
 ('user_pre902',:'reg','pre902','Suspensa Sintética','Corrente','loja','suspensa'),
 ('user_pre903',:'reg','pre903','Ativa Sintética','Corrente','loja','ativa');
select id as loja from vitrines_lojas where dono_id='user_pre901' \gset
insert into pagamentos(vitrine_id,microrregiao_id,tipo,plano_codigo,valor_centavos,status,meses,asaas_cobranca_id)
values (:'loja',:'reg','assinatura','slim',2990,'pendente',1,'pay_pre901');
select lixeira_mover_loja(:'loja','dono',null,'user_pre901');
update lixeira_lojas set apagar_apos=now()-interval '1 day' where vitrine_id=:'loja';
select purgar_loja(:'loja');
select set_config('olaki.sistema','1',false);
update vitrines_lojas set excluida_em=now()-interval '31 days' where id=:'loja';
select set_config('olaki.sistema','',false);
