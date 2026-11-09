\set ON_ERROR_STOP on
\set QUIET on
-- Somente banco descartável. Confere o contrato público sem expor contato de anúncio privado.
begin;
select id as loja from vitrines_lojas where dono_id='user_loja' \gset
select id as reg from microrregioes where slug='corrente-pi' \gset
select id as cat from categorias where slug='moveis' \gset
insert into vitrines_lojas(dono_id,microrregiao_id,slug,nome,cidade,tipo,plano) values
 ('user_semcodigo',:'reg','pf-sem-confirmacao','Pessoa Sem Confirmação','Corrente','pf','pf_gratis') returning id as pf \gset
insert into anuncios(id,vitrine_id,categoria_id,titulo,cidade,preco_centavos,status) values
 ('50000000-0000-4000-a000-000000000001',:'loja',:'cat','Mesa para teste local','Corrente',85000,'ativo'),
 ('50000000-0000-4000-a000-000000000002',:'loja',:'cat','Mesa vendida local','Corrente',85000,'vendido'),
 ('50000000-0000-4000-a000-000000000003',:'loja',:'cat','Mesa pausada local','Corrente',85000,'pausado'),
 ('50000000-0000-4000-a000-000000000004',:'loja',:'cat','Mesa rascunho local','Corrente',85000,'rascunho'),
 ('50000000-0000-4000-a000-000000000005',:'pf',:'cat','Mesa pessoa física','Corrente',85000,'ativo');
set local role anon;
set local request.jwt.claim.role='anon';
set local request.jwt.claim.sub='';
do $$ begin
 assert (select whatsapp='5589999990002' from anuncio_publico('50000000-0000-4000-a000-000000000001')), 'Contato da loja ativa';
 assert (select whatsapp is null from anuncio_publico('50000000-0000-4000-a000-000000000002')), 'Vendido não divulga contato';
 assert not exists(select 1 from anuncio_publico('50000000-0000-4000-a000-000000000003')), 'Pausado não expõe detalhes';
 assert not exists(select 1 from anuncio_publico('50000000-0000-4000-a000-000000000004')), 'Rascunho não expõe detalhes';
 assert (select whatsapp is null and vitrine_nome='Pessoa' from anuncio_publico('50000000-0000-4000-a000-000000000005')), 'Pessoa sem confirmação não divulga telefone nem sobrenome';
end $$;
set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='user_loja';
do $$ begin
 assert (select e_dono and whatsapp is null from anuncio_publico('50000000-0000-4000-a000-000000000004')), 'Dono pode revisar rascunho sem divulgar contato';
end $$;
reset role;
update perfis set whatsapp_verificado_em=now() where id='user_semcodigo';
set local role anon;
set local request.jwt.claim.role='anon';
set local request.jwt.claim.sub='';
do $$ begin
 assert (select whatsapp='5589999990005' from anuncio_publico('50000000-0000-4000-a000-000000000005')), 'Pessoa confirmada pode receber contato';
end $$;
reset role;
update vitrines_lojas set status='suspensa' where id=:'loja';
set local role anon;
do $$ begin
 assert not exists(select 1 from anuncio_publico('50000000-0000-4000-a000-000000000001')), 'Loja suspensa não expõe anúncio nem contato';
end $$;
rollback;
