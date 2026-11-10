\set ON_ERROR_STOP on
\set QUIET on
-- Fixtures descartáveis; nenhuma conexão com produção.
begin;
create function pg_temp.confere(ok boolean, caso text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FALHOU: %', caso; end if; end $$;
reset role;
set local request.jwt.claim.role='';
set local request.jwt.claim.sub='';
select id as reg from microrregioes where slug='corrente-pi' \gset
select id as cat from categorias where slug='moveis' \gset
insert into perfis(id,microrregiao_id,nome,cidade,whatsapp) values ('user_vitrine240',:'reg','Loja 240','Corrente','5589999990240');
insert into vitrines_lojas(id,dono_id,microrregiao_id,slug,nome,cidade,whatsapp,tipo,plano,plano_expira_em) values
 ('86000000-0000-4000-a000-000000000001','user_vitrine240',:'reg','loja-240','Loja 240','Corrente','5589999990240','loja','full',now()+interval '30 days');
insert into anuncios(id,vitrine_id,categoria_id,titulo,cidade,preco_centavos,status,publicado_em) values
 ('87000000-0000-4000-a000-000000000001','86000000-0000-4000-a000-000000000001',:'cat','Produto caro teste','Corrente',150050,'ativo',now()),
 ('87000000-0000-4000-a000-000000000002','86000000-0000-4000-a000-000000000001',:'cat','Produto barato teste','Corrente',990,'ativo',now()),
 ('87000000-0000-4000-a000-000000000003','86000000-0000-4000-a000-000000000001',:'cat','Produto sem preço teste','Corrente',null,'ativo',now()),
 ('87000000-0000-4000-a000-000000000004','86000000-0000-4000-a000-000000000001',:'cat','Rascunho privado teste','Corrente',1,'rascunho',now()),
 ('87000000-0000-4000-a000-000000000005','86000000-0000-4000-a000-000000000001',:'cat','Produto vendido teste','Corrente',1,'vendido',now()),
 ('87000000-0000-4000-a000-000000000006','86000000-0000-4000-a000-000000000001',:'cat','Produto pausado teste','Corrente',1,'pausado',now());
update anuncios set fixado_na_loja=1 where id='87000000-0000-4000-a000-000000000001';
insert into loja_secoes(id,vitrine_id,nome,ordem) values ('88000000-0000-4000-a000-000000000001','86000000-0000-4000-a000-000000000001','Seleção de teste',1);
insert into loja_secao_anuncios(secao_id,anuncio_id,ordem) values ('88000000-0000-4000-a000-000000000001','87000000-0000-4000-a000-000000000003',1);
update configuracoes set valor='2' where chave='vitrine.anuncios_por_pagina' and microrregiao_id is null;
set local role anon;
set local request.jwt.claim.role='anon';
do $$ declare v jsonb; ids uuid[]; begin
 v:=vitrine_publica('loja-240');
 assert v->>'whatsapp' is null and (v->>'total_anuncios')::int=3, 'Sem contato confirmado, com contagem pública';
 assert not (v ?| array['dono_id','cnpj','plano','plano_expira_em','whatsapp_verificado_em']), 'Dados internos omitidos';
 assert jsonb_array_length(v->'secoes')=1, 'Seções preservadas';
 select array_agg(id) into ids from anuncios_vitrine('86000000-0000-4000-a000-000000000001','menor_preco',1) where na_pagina;
 assert ids=array['87000000-0000-4000-a000-000000000002','87000000-0000-4000-a000-000000000001']::uuid[], 'Menor preço global e centavos';
 assert (select count(*)=1 from anuncios_vitrine('86000000-0000-4000-a000-000000000001','menor_preco',1) where not na_pagina), 'Produto da seção fora da página';
 assert (select count(*)=1 from anuncios_vitrine('86000000-0000-4000-a000-000000000001','menor_preco',2) where na_pagina), 'Segunda página';
 assert (select count(*)=0 from anuncios_vitrine('86000000-0000-4000-a000-000000000001','recentes',99) where na_pagina), 'Página inexistente';
 assert (select id='87000000-0000-4000-a000-000000000001' from anuncios_vitrine('86000000-0000-4000-a000-000000000001') limit 1), 'Fixado primeiro';
 assert not exists(select 1 from anuncios_vitrine('86000000-0000-4000-a000-000000000001') where titulo like '%privado%' or id in ('87000000-0000-4000-a000-000000000005','87000000-0000-4000-a000-000000000006')), 'Somente anúncios ativos';
 assert vitrine_publica('inexistente-240') is null, 'Loja inexistente';
end $$;
reset role;
update vitrines_lojas set whatsapp=null where id='86000000-0000-4000-a000-000000000001';
set local role anon;
select pg_temp.confere(vitrine_publica('loja-240')->>'whatsapp' is null,'Perfil não confirmado não vaza contato');
reset role;
update perfis set whatsapp_verificado_em=now() where id='user_vitrine240';
set local role anon;
select pg_temp.confere(vitrine_publica('loja-240')->>'whatsapp'='5589999990240','Perfil confirmado serve de contato');
reset role;
update vitrines_lojas set status='suspensa' where id='86000000-0000-4000-a000-000000000001';
set local role anon;
select pg_temp.confere(vitrine_publica('loja-240') is null,'Loja suspensa oculta');
select pg_temp.confere((select count(*)=0 from anuncios_vitrine('86000000-0000-4000-a000-000000000001')),'Produtos suspensos ocultos');
set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='user_comprador';
select pg_temp.confere(vitrine_publica('loja-240') is null,'Outra conta não vê prévia');
set local request.jwt.claim.sub='user_vitrine240';
select pg_temp.confere((vitrine_publica('loja-240')->>'e_dono')::boolean and vitrine_publica('loja-240')->>'whatsapp' is null,'Dono vê prévia sem contato');
rollback;
