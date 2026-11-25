\set ON_ERROR_STOP on
begin;
select id as reg from microrregioes where slug='corrente-pi' \gset
select id as cat from categorias where slug='sofas-e-poltronas' \gset
insert into perfis(id,microrregiao_id,nome,cidade,whatsapp,whatsapp_verificado_em) values
 ('user_kit912',:'reg','Kit 912','Corrente','5589999990912',now()),
 ('user_vazia912',:'reg','Vazia 912','Corrente','5589999990913',now());
insert into vitrines_lojas(id,dono_id,microrregiao_id,slug,nome,cidade,whatsapp,tipo,plano,plano_expira_em) values
 ('91200000-0000-4000-a000-000000000001','user_kit912',:'reg','kit-912-cheia','ZZ Kit 912','Corrente','5589999990912','loja','slim',now()+interval '30 days'),
 ('91200000-0000-4000-a000-000000000002','user_vazia912',:'reg','kit-912-vazia','AA Kit 912','Corrente','5589999990913','loja','slim',now()+interval '30 days');
insert into anuncios(id,vitrine_id,categoria_id,titulo,cidade,preco_centavos,status,fotos) values
 ('91200000-0000-4000-a000-000000000003','91200000-0000-4000-a000-000000000001',:'cat','Sofá Kit 912','Corrente',10000,'ativo','{}'),
 ('91200000-0000-4000-a000-000000000004','91200000-0000-4000-a000-000000000001',:'cat','Rascunho Kit 912','Corrente',10000,'rascunho','{}');
set local role anon;
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claim.role','anon',true);
do $$ declare r uuid; begin
 select id into r from microrregioes where slug='corrente-pi';
 assert (select produtos_ativos=1 from catalogo_lojas_oferta(r,'Corrente',null,24,0,false,'Kit 912') limit 1), 'oferta antes de paginar';
 assert (select count(*)=2 from catalogo_lojas_oferta(r,'Corrente',null,24,0,false,'Kit 912')), 'vazia permanece';
 assert (select count(*)=1 from buscar_produtos_vitrine('91200000-0000-4000-a000-000000000001','sofa','recentes',1)), 'acentos';
 assert (select count(*)=0 from buscar_produtos_vitrine('91200000-0000-4000-a000-000000000001','rascunho','recentes',1)), 'rascunho privado';
 assert (select count(*)=0 from buscar_produtos_vitrine('91200000-0000-4000-a000-000000000001','inexistente','recentes',1)), 'sem resultado';
end $$;
reset role;
update vitrines_lojas set status='suspensa' where id='91200000-0000-4000-a000-000000000001';
set local role anon;
do $$ begin
 assert (select count(*)=0 from buscar_produtos_vitrine('91200000-0000-4000-a000-000000000001','sofa','recentes',1)), 'suspensa inacessível';
end $$;
rollback;
