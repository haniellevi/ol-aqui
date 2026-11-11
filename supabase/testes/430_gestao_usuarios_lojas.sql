\set ON_ERROR_STOP on
\set QUIET on
begin;
create or replace function pg_temp.confere(ok boolean, caso text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FALHOU: %',caso; end if; end $$;
create or replace function pg_temp.recusa(comando text, codigo text) returns void language plpgsql as $$
begin execute comando; raise exception 'Aceitou comando proibido: %',comando;
exception when others then if sqlstate<>codigo then raise; end if; end $$;
select id as reg from microrregioes where slug='corrente-pi' \gset
insert into perfis(id,microrregiao_id,nome,whatsapp,whatsapp_verificado_em,e_admin) values
 ('user_gestaoAdmin',:'reg','Gestor de teste','5589999910101',now(),true),
 ('user_gestaoDono',:'reg','Titular de teste','5589999910102',now(),false),
 ('user_gestaoOutro',:'reg','Outro titular','5589999910103',now(),false),
 ('user_gestaoSuporte',:'reg','Suporte de teste',null,null,false);
insert into equipe(usuario_id,papel,ativo) values('user_gestaoSuporte','suporte',true);
set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='user_gestaoDono';
select pg_temp.recusa($q$select admin_usuarios()$q$,'42501');
select pg_temp.recusa($q$select admin_usuario('user_gestaoAdmin')$q$,'42501');
select pg_temp.recusa($q$select admin_salvar_usuario('user_gestaoDono',now(),'{}','motivo')$q$,'42501');
select pg_temp.recusa($q$select admin_excluir_loja(gen_random_uuid(),now(),'slug','motivo')$q$,'42501');
select pg_temp.recusa($q$select admin_salvar_loja(null,null,'{}','motivo')$q$,'42501');
select pg_temp.recusa($q$select revogar_conta_definitivamente('user_gestaoAdmin')$q$,'42501');
select pg_temp.confere((select count(*)=0 from admin_gestao_eventos),'auditoria privada');
set local request.jwt.claim.sub='user_gestaoSuporte';
select pg_temp.recusa($q$select admin_usuarios()$q$,'42501');
select pg_temp.recusa($q$select admin_loja_detalhe(gen_random_uuid())$q$,'42501');
set local request.jwt.claim.sub='user_gestaoAdmin';
select pg_temp.confere((admin_usuarios('Titular de teste')->>'total')::int=1,'busca por nome');
select pg_temp.confere((admin_usuarios('9910102')->>'total')::int=1,'busca por telefone');
select pg_temp.confere((admin_usuarios('',1,'{}')->>'total')::int=0,'email ausente nao retorna todos');
select pg_temp.recusa($q$select admin_salvar_usuario('user_gestaoDono',now(),'{"e_admin":true}','teste')$q$,'22023');
select pg_temp.recusa($q$select admin_salvar_usuario('user_gestaoDono','2000-01-01','{}','teste')$q$,'P0001');
select admin_salvar_usuario('user_gestaoDono',(admin_usuario('user_gestaoDono')->>'atualizado_em')::timestamptz,
  '{"nome":"Titular corrigido","whatsapp":"5589999910112","avatar_url":"https://example.com/foto.png"}','Correção do cadastro');
select pg_temp.confere(admin_usuario('user_gestaoDono')->>'nome'='Titular corrigido','nome salvo');
select pg_temp.confere(admin_usuario('user_gestaoDono')->>'whatsapp_verificado_em' is null,'troca invalida confirmacao');
select pg_temp.confere(admin_usuario('user_gestaoDono')->>'whatsapp_origem'='evolution','sincronizacao nao repoe telefone antigo');
select pg_temp.confere((admin_usuario('user_gestaoDono')->>'avatar_personalizado')::boolean,'avatar administrativo preservado');
select pg_temp.recusa($q$select admin_bloquear_usuario('user_gestaoAdmin',true,'teste')$q$,'23514');
select admin_bloquear_usuario('user_gestaoDono',true,'Bloqueio de teste');
select pg_temp.confere((admin_usuario('user_gestaoDono')->>'bloqueado')::boolean,'bloqueado aparece na ficha');
select pg_temp.confere((admin_usuarios('user_gestaoDono')->>'total')::int=1,'bloqueado permanece na busca');
set local request.jwt.claim.sub='user_gestaoDono';
select pg_temp.confere(usuario_id() is null,'JWT existente perde acesso');
set local request.jwt.claim.sub='user_gestaoAdmin';
select admin_bloquear_usuario('user_gestaoDono',false,'Acesso liberado');
set local request.jwt.claim.sub='user_gestaoDono';
select pg_temp.confere(usuario_id()='user_gestaoDono','desbloqueio restaura acesso');
set local request.jwt.claim.sub='user_gestaoAdmin';
select admin_salvar_loja(null,null,jsonb_build_object('dono_id','user_gestaoDono','nome','Loja gestão teste',
  'slug','loja-gestao-teste','microrregiao_id',:'reg','cidade','Corrente','tipo','loja'),'Criar para testar') as loja \gset
select pg_temp.confere((select count(*)=1 from admin_lojas(:'loja')),'lista busca por id exato');
select pg_temp.recusa(format('select admin_salvar_loja(%L,null,%L,%L)',:'loja','{"status":"ativa"}','teste'),'22023');
select pg_temp.recusa(format('select admin_salvar_loja(%L,%L,%L,%L)',:'loja','2000-01-01','{}','teste'),'P0001');
select admin_salvar_loja(:'loja',(admin_loja_detalhe(:'loja')->>'atualizado_em')::timestamptz,
  '{"nome":"Loja corrigida","sobre":"Apresentação corrigida","site_url":"https://example.com","horarios":{"seg":[{"abre":"08:00","fecha":"12:00"}]}}','Corrigir loja');
select pg_temp.confere(admin_loja_detalhe(:'loja')->>'nome'='Loja corrigida','edicao completa salva');
select pg_temp.recusa(format('select admin_excluir_loja(%L,%L,%L,%L)',:'loja',admin_loja_detalhe(:'loja')->>'atualizado_em','errado','Excluir teste'),'23514');
reset role;
insert into anuncios(vitrine_id,categoria_id,titulo,cidade,status)
  select :'loja',id,'Produto para testar gestão','Corrente','rascunho' from categorias where slug='casas' limit 1 returning id as anuncio \gset
update anuncios set status='congelado',congelado_motivo='Preservação de teste' where id=:'anuncio';
set local role authenticated;
set local request.jwt.claim.sub='user_gestaoAdmin';
select pg_temp.recusa(format('select admin_excluir_loja(%L,%L,%L,%L)',:'loja',admin_loja_detalhe(:'loja')->>'atualizado_em','loja-gestao-teste','Excluir teste'),'55000');
select pg_temp.confere(not exists(select 1 from admin_gestao_eventos where alvo=:'loja' and acao='excluir'),'exclusao recusada nao deixa sucesso na auditoria');
reset role;
update anuncios set status='rascunho',congelado_motivo=null where id=:'anuncio';
insert into pagamentos(vitrine_id,microrregiao_id,tipo,valor_centavos) values(:'loja',:'reg','assinatura',100) returning id as pagamento \gset
set local role authenticated;
set local request.jwt.claim.sub='user_gestaoAdmin';
select pg_temp.recusa(format('select admin_excluir_loja(%L,%L,%L,%L)',:'loja',admin_loja_detalhe(:'loja')->>'atualizado_em','loja-gestao-teste','Excluir teste'),'23514');
reset role;
delete from pagamentos where id=:'pagamento';
set local role authenticated;
set local request.jwt.claim.sub='user_gestaoAdmin';
select admin_excluir_loja(:'loja',(admin_loja_detalhe(:'loja')->>'atualizado_em')::timestamptz,'loja-gestao-teste','Excluir teste');
select pg_temp.confere(admin_loja_detalhe(:'loja') is null,'loja excluida');
select pg_temp.confere(admin_usuario('user_gestaoDono') is not null,'titular preservado');
select pg_temp.confere(exists(select 1 from admin_gestao_eventos where alvo=:'loja' and acao='excluir'),'auditoria sobrevive a cascata');
select admin_bloquear_usuario('user_gestaoOutro',true,'Bloqueio antes da exclusão');
reset role;
set local role service_role;
select revogar_conta_definitivamente('user_gestaoOutro');
reset role;
set local role authenticated;
set local request.jwt.claim.sub='user_gestaoAdmin';
select pg_temp.recusa($q$select admin_bloquear_usuario('user_gestaoOutro',false,'Tentar reabrir conta excluída')$q$,'23514');
select pg_temp.confere((admin_usuario('user_gestaoOutro')->>'revogado')::boolean,'exclusao converte bloqueio em revogacao definitiva');
reset role;
select pg_temp.confere(not exists(select 1 from anuncios where id=:'anuncio'),'anuncios excluidos junto com loja');
rollback;
