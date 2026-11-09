\set ON_ERROR_STOP on
\set QUIET on
begin;
create function pg_temp.confere(ok boolean, caso text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FALHOU: %', caso; end if; end $$;
create function pg_temp.recusa(comando text, codigo text) returns void language plpgsql as $$
begin
  begin execute comando;
  exception when others then
    if sqlstate=codigo then return; end if;
    raise exception 'Estado inesperado: %, esperado %: %',sqlstate,codigo,sqlerrm;
  end;
  raise exception 'Comando aceito indevidamente: %',comando;
end $$;
select pg_temp.confere((select tgenabled='O' from pg_trigger where tgrelid='modelos_mensagem'::regclass and tgname='modelos_mensagem_proteger'),'Protetor de modelos segue habilitado');
select pg_temp.confere((select texto not like '%vai te chamar%' and texto_padrao=texto from modelos_mensagem where chave='proposta_escolhida' and canal='notificacao'),'Escolha não promete envio de mensagem');
insert into notificacoes(id,usuario_id,tipo,titulo,texto,link,canal) values
 ('81000000-0000-4000-a000-000000000001','user_comprador','proposta_nova','Nova proposta','Teste de leitura','/radar/pedido/20000000-0000-4000-a000-000000000001','app'),
 ('81000000-0000-4000-a000-000000000002','user_loja','proposta_escolhida','Escolheram sua proposta','Teste da loja','/radar/20000000-0000-4000-a000-000000000001','app'),
 ('81000000-0000-4000-a000-000000000003','user_comprador','proposta_nova','Outro canal','Não marcar por ação do app',null,'email');
set local role anon;
set local request.jwt.claim.role='anon';
select pg_temp.recusa('select * from notificacoes','42501');
select pg_temp.recusa('select marcar_notificacoes_lidas()','42501');
set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='user_comprador';
select pg_temp.confere((select count(*)=0 from notificacoes where id='81000000-0000-4000-a000-000000000002'),'RLS não expõe aviso da loja');
select pg_temp.confere(marcar_notificacoes_lidas(array['81000000-0000-4000-a000-000000000002'::uuid])=0,'Não marca aviso de outra conta');
select pg_temp.confere(marcar_notificacoes_lidas(array['81000000-0000-4000-a000-000000000001'::uuid])=1,'Leitura individual');
select pg_temp.confere(marcar_notificacoes_lidas(array['81000000-0000-4000-a000-000000000001'::uuid])=0,'Leitura idempotente');
select marcar_notificacoes_lidas();
select pg_temp.confere((select lida_em is null from notificacoes where id='81000000-0000-4000-a000-000000000003'),'Leitura em lote mantém outros canais');
select pg_temp.recusa($q$update notificacoes set titulo='Falso'$q$,'42501');
select pg_temp.recusa($q$select notificar('user_loja','proposta_nova','Falso','Falso')$q$,'42501');
select pg_temp.recusa($q$select salvar_preferencia_aviso('tipo_inventado',false)$q$,'22023');
select pg_temp.confere(salvar_preferencia_aviso('proposta_nova',false)=false,'Desligar retorna false como sucesso');
reset role;
select pg_temp.confere(notificar('user_comprador','proposta_nova','Desligado','Não gravar',null,'teste210:desligado')=false,'Preferência bloqueia aviso futuro');
set local role authenticated;
set local request.jwt.claim.sub='user_comprador';
select pg_temp.confere((select count(*)=1 from notificacoes where id='81000000-0000-4000-a000-000000000001'),'Preferência preserva histórico');
select salvar_preferencia_aviso('proposta_nova',true);
reset role;
select pg_temp.confere(notificar('user_comprador','proposta_nova','Ligado','Gravar',null,'teste210:ligado'),'Religar permite aviso futuro');
select pg_temp.confere(notificar('user_comprador','proposta_nova','Ligado','Gravar',null,'teste210:ligado')=false,'Repetição não duplica aviso');
select pg_temp.confere((select lida_em is null from notificacoes where id='81000000-0000-4000-a000-000000000002'),'Leitura de comprador não mudou aviso da loja');
rollback;
