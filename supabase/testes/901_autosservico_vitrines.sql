\set ON_ERROR_STOP on
begin;
select id as reg from microrregioes where slug='corrente-pi' \gset
insert into perfis(id,microrregiao_id,nome,cidade,whatsapp,whatsapp_verificado_em)
values ('user_auto901',:'reg','Pessoa Sintética','Corrente','5589999900901',now());
set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='user_auto901';
select quero_vender('loja','Loja Sintética Principal','loja-sintetica-901','5589999900901','Corrente');
reset role;
select id as loja from vitrines_lojas where dono_id='user_auto901' \gset
insert into pagamentos(vitrine_id,microrregiao_id,tipo,plano_codigo,valor_centavos,status,meses,asaas_cobranca_id)
values (:'loja',:'reg','assinatura','slim',2990,'pendente',1,'pay_auto901');
insert into voucher_campanhas(codigo,valido_ate) values('AUTO901',now()+interval '1 day') returning id as campanha \gset
insert into voucher_atribuicoes(campanha_id,dono_id,vitrine_id)
values(:'campanha','user_auto901',:'loja');
set local role authenticated;
select excluir_minha_loja('EXCLUIR');
reset role;
select purgar_loja(:'loja');
do $$ begin assert exists(select 1 from vitrines_lojas where dono_id='user_auto901'), 'prazo de 30 dias preservado'; end $$;
set local role authenticated;
select restaurar_minha_loja();
reset role;
do $$ begin assert (select status='ativa' and excluida_em is null from vitrines_lojas where dono_id='user_auto901'); end $$;
set local role authenticated;
select excluir_minha_loja('EXCLUIR');
reset role;
update lixeira_lojas set apagar_apos=now()-interval '1 day' where vitrine_id=:'loja';
set local role authenticated;
do $$ begin
 begin perform restaurar_minha_loja(); raise exception 'restaurou após o prazo';
 exception when sqlstate '22023' then null; end;
end $$;
reset role;
select purgar_loja(:'loja');
do $$ begin
 assert not exists(select 1 from vitrines_lojas where dono_id='user_auto901'), 'purga com pagamento deve liberar titular';
 assert exists(select 1 from pagamentos where asaas_cobranca_id='pay_auto901'), 'pagamento preservado';
 assert (select dono_id='user_auto901' from voucher_atribuicoes where vitrine_id=(select id from vitrines_lojas where dono_retido_id='user_auto901')), 'atribuição histórica preservada';
end $$;
set local role authenticated;
select quero_vender('pf');
select excluir_minha_loja('EXCLUIR');
select restaurar_minha_loja();
reset role;
do $$ begin assert (select status='ativa' from vitrines_lojas where dono_id='user_auto901'); end $$;
-- Rascunhos próprios em todos os estados anteriores à publicação; somente sua fila e mídias.
create function pg_temp.recusa(comando text,codigo text) returns void language plpgsql as $$
begin execute comando; raise exception 'Aceitou operação proibida';
exception when others then if sqlstate<>codigo then raise; end if; end $$;
insert into perfis(id,microrregiao_id,nome,cidade) values
 ('user_auto902',:'reg','Outra Pessoa','Corrente'),('user_auto903',:'reg','Gerente Pessoa','Corrente');
insert into loja_ia_rascunhos(dono_id,estado) values('user_auto901','coleta') returning id as rascunho \gset
insert into loja_ia_imagens(rascunho_id,caminho,tipo,origem,estado,mime,tamanho)
values(:'rascunho',:'rascunho'||'/upload/teste','foto','enviada','upload','image/jpeg',10);
insert into loja_ia_trabalhos(rascunho_id,fonte) values(:'rascunho','merc') returning id as trabalho \gset
set local role authenticated;
set local request.jwt.claim.sub='user_auto902';
select pg_temp.recusa(format('select loja_ia_descartar(%L,0)',:'rascunho'),'42501');
set local request.jwt.claim.sub='user_auto901';
select pg_temp.recusa(format('select loja_ia_descartar(%L,1)',:'rascunho'),'40001');
select loja_ia_descartar(:'rascunho',0);
reset role;
set local request.jwt.claim.sub='';
select pg_temp.recusa(format('select loja_ia_descartar(%L,0)',:'rascunho'),'28000');
-- Sem JWT? O simulador conserva sub; testar anon e callback com papel explicitamente.
set local role service_role;
select not loja_ia_concluir_fonte(:'trabalho',gen_random_uuid(),'{"estado":"ok"}') as callback_recusado \gset
\if :callback_recusado
\else
  \quit 1
\endif
reset role;
do $$ begin
 assert not exists(select 1 from loja_ia_trabalhos t join loja_ia_rascunhos r on r.id=t.rascunho_id where r.dono_id='user_auto901');
 assert (select count(*)=1 from loja_ia_imagens_lixeira where caminho like '%/upload/teste');
 assert not ((loja_ia_lote_limpeza()->'lixeira') @> (select jsonb_agg(caminho) from loja_ia_imagens_lixeira where caminho like '%/upload/teste')), 'não limpar uploads em trânsito';
end $$;
do $$ declare r uuid; estado_ text; begin
 foreach estado_ in array array['processando','pronto'] loop
  insert into loja_ia_rascunhos(dono_id,estado) values('user_auto901',estado_) returning id into r;
  perform set_config('request.jwt.claim.sub','user_auto901',true);
  assert loja_ia_descartar(r,0);
 end loop;
end $$;
insert into loja_ia_rascunhos(dono_id,estado) values('user_auto901','publicado') returning id as publicado \gset
set local role authenticated;
set local request.jwt.claim.sub='user_auto901';
select pg_temp.recusa(format('select loja_ia_descartar(%L,0)',:'publicado'),'22023');
reset role;
-- Saída própria preserva o acesso de outra pessoa e deixa histórico.
update vitrines_lojas set tipo='loja',nome='Loja Sintética Equipe' where dono_id='user_auto901';
select id as equipe from vitrines_lojas where dono_id='user_auto901' \gset
insert into convites_gerente_loja(vitrine_id,token_hash,telefone_hash,final_telefone,aceito_por,aceito_em) values
(:'equipe','\x01'::bytea,'\x02'::bytea,'0902','user_auto902',now()),
(:'equipe','\x03'::bytea,'\x04'::bytea,'0903','user_auto903',now());
set local role authenticated;
select pg_temp.recusa(format('select sair_da_loja(%L)',:'equipe'),'22023');
set local request.jwt.claim.sub='user_auto902';
select sair_da_loja(:'equipe');
select sair_da_loja(:'equipe');
reset role;
do $$ begin
 assert (select revogado_em is not null from convites_gerente_loja where aceito_por='user_auto902');
 assert (select revogado_em is null from convites_gerente_loja where aceito_por='user_auto903');
 assert (select count(*)=1 from historico_alteracoes where quem='user_auto902' and motivo='Saída voluntária da equipe.');
 assert not has_function_privilege('anon','public.sair_da_loja(uuid)','execute');
 assert not has_function_privilege('authenticated','public.purgar_loja(uuid)','execute');
end $$;
rollback;
