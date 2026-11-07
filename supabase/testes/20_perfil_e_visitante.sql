\set ON_ERROR_STOP 0
\pset footer off
set role authenticated;
select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_d',false) \g /dev/null
\echo '[13] usuario nao marca o proprio celular como verificado'
update perfis set whatsapp_verificado_em = now() where id='user_d';
reset role; select whatsapp_verificado_em is null as continua_nao_verificado from perfis where id='user_d';
set role authenticated;
select set_config('request.jwt.claim.sub','user_a',false) \g /dev/null
\echo '[14] trocar o numero apaga a verificacao'
update perfis set whatsapp='5589988887777' where id='user_a';
reset role; select whatsapp, whatsapp_verificado_em is null as precisa_confirmar from perfis where id='user_a';
\echo '[15] visitante (sem token) ve anuncios ativos mas nao o radar'
set role anon; select set_config('request.jwt.claim.sub','',false), set_config('request.jwt.claim.role','anon',false) \g /dev/null
select count(*) > 0 as ve_anuncios from anuncios; select count(*) as radar from radar_pedidos;
\echo '[16] perfil com id fora do formato Clerk e recusado'
reset role; select set_config('request.jwt.claim.role','',false) \g /dev/null
insert into perfis (id, microrregiao_id, nome) select 'abc', id, 'X' from microrregioes limit 1;
