\pset footer off
select set_config('request.jwt.claim.role','',false) \g /dev/null
update perfis set whatsapp_verificado_em=now() where id='user_d';
set role authenticated;
select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_d',false) \g /dev/null
update perfis set whatsapp='5589988887777' where id='user_d';
reset role; select whatsapp, whatsapp_verificado_em is null as precisa_confirmar from perfis where id='user_d';
