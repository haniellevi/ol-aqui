\set ON_ERROR_STOP on
\set QUIET on
begin;
create function pg_temp.confere(ok boolean, caso text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FALHOU: %', caso; end if; end $$;
set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='user_comprador';
update perfis set nome='Perfil alterado',cidade='Corrente',bairro='Centro' where id='user_comprador';
select pg_temp.confere((select nome='Perfil alterado' and cidade='Corrente' and bairro='Centro' from meu_perfil()),'Próprio perfil pode ser alterado');
with alterados as (update perfis set nome='Tentativa alheia' where id='user_distante' returning id)
select pg_temp.confere((select count(*)=0 from alterados),'Outra conta não pode ser alterada');
update perfis set e_admin=true,selo_negociador_certificado=true,whatsapp_verificado_em='2030-01-01' where id='user_comprador';
select pg_temp.confere((select not e_admin and not selo_negociador_certificado and whatsapp_verificado_em <> '2030-01-01'::timestamptz from meu_perfil()),'Perfil não promove privilégios nem forja confirmação');
set local request.jwt.claim.sub='user_semcodigo';
update perfis set whatsapp_verificado_em=now() where id='user_semcodigo';
select pg_temp.confere((select whatsapp_verificado_em is null from meu_perfil()),'Não confirma número sem código pelo cliente');
set local request.jwt.claim.sub='';
with alterados as (update perfis set nome='Sem sessão' where id='user_comprador' returning id)
select pg_temp.confere((select count(*)=0 from alterados),'Sessão ausente não altera perfil');
reset role;
select pg_temp.confere((select nome='Loja distante' from perfis where id='user_distante'),'Perfil alheio preservado');
rollback;
