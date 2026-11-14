\set ON_ERROR_STOP on
begin;
insert into perfis(id,microrregiao_id,nome,cidade,whatsapp,whatsapp_verificado_em)
select x,id,'Teste IA','Corrente',case x when 'user_ia880a' then '5589999971001' when 'user_ia880b' then '5589999971002' else '5589999971003' end,now() from microrregioes cross join unnest(array['user_ia880a','user_ia880b','user_ia880c']) x where slug='corrente-pi';
insert into loja_ia_convites(usuario_id) values ('user_ia880a'),('user_ia880b');
set local role authenticated;
set local request.jwt.claim.sub='user_ia880c';
do $$ begin
  assert not loja_ia_piloto_autorizado(), 'sem convite';
  begin perform loja_ia_abrir_coleta(); raise exception 'abriu sem convite'; exception when insufficient_privilege then null; end;
end $$;
set local request.jwt.claim.sub='user_ia880a';
select loja_ia_abrir_coleta() as draft \gset
select loja_ia_salvar_coleta((:'draft'::jsonb->>'id')::uuid,0,'{"nome":"Loja","cidade":"Corrente","materiais":[],"consultarWhatsapp":true,"avisarWhatsapp":false}') as saved \gset
select 1 / case when (:'saved'::jsonb->>'revisao')::int = 1 then 1 else 0 end;
select set_config('test.draft', :'draft'::jsonb->>'id', true);
do $$ begin
  begin perform loja_ia_salvar_coleta(current_setting('test.draft')::uuid,0,'{}'); raise exception 'revisão obsoleta aceita'; exception when serialization_failure then null; end;
  begin perform * from loja_ia_rascunhos; raise exception 'tabela exposta'; exception when insufficient_privilege then null; end;
end $$;
set local request.jwt.claim.sub='user_ia880b';
do $$ begin
  assert loja_ia_obter() is null, 'outro dono lê';
  begin perform loja_ia_salvar_coleta(current_setting('test.draft')::uuid,1,'{}'); raise exception 'outro dono grava'; exception when insufficient_privilege then null; end;
end $$;
set local request.jwt.claim.sub='user_ia880a';
do $$ begin
  begin perform loja_ia_salvar_coleta(current_setting('test.draft')::uuid,1,'{"nome":"x","cidade":"x","materiais":[],"consultarWhatsapp":"true","avisarWhatsapp":false}'); raise exception 'boolean inválido aceito'; exception when invalid_parameter_value then null; end;
  begin perform loja_ia_salvar_coleta(current_setting('test.draft')::uuid,1,'{"nome":"x","cidade":"x","materiais":[],"consultarWhatsapp":true,"avisarWhatsapp":false,"numero":"5589999999999"}'); raise exception 'número arbitrário aceito'; exception when invalid_parameter_value then null; end;
end $$;
reset role;
do $$ begin assert (select whatsapp_autorizado='5589999971001' from loja_ia_rascunhos where id=current_setting('test.draft')::uuid), 'snapshot do número'; end $$;
delete from loja_ia_convites where usuario_id='user_ia880a';
set local role authenticated;
do $$ begin
  assert loja_ia_obter() is not null, 'rascunho perdido após revogação';
  begin perform loja_ia_salvar_coleta(current_setting('test.draft')::uuid,1,'{}'); raise exception 'convite revogado grava'; exception when insufficient_privilege then null; end;
end $$;
reset role;
insert into loja_ia_convites(usuario_id) values ('user_ia880a');
update vitrines_lojas set status='suspensa' where dono_id='user_ia880a';
insert into vitrines_lojas(dono_id,microrregiao_id,nome,slug,cidade,tipo,plano,status)
select id,microrregiao_id,'PF','pf-ia880','Corrente','pf','pf_gratis','suspensa' from perfis where id='user_ia880a';
set local role authenticated;
set local request.jwt.claim.sub='user_ia880a';
do $$ begin
  begin perform loja_ia_salvar_coleta(current_setting('test.draft')::uuid,1,'{}'); raise exception 'conta suspensa grava'; exception when insufficient_privilege then null; end;
end $$;
reset role;
update vitrines_lojas set status='ativa', tipo='loja' where dono_id='user_ia880a';
set local role authenticated;
do $$ begin
  begin perform loja_ia_abrir_coleta(); raise exception 'loja existente abriu coleta'; exception when insufficient_privilege then null; end;
end $$;
reset role;
insert into contas_revogadas(usuario_id,revogada_em) values ('user_ia880a',now());
set local role authenticated;
do $$ begin
  assert loja_ia_obter() is null and not loja_ia_piloto_autorizado(), 'conta revogada ainda acessa';
  begin perform loja_ia_abrir_coleta(); raise exception 'conta revogada abriu'; exception when invalid_authorization_specification then null; end;
end $$;
set local request.jwt.claim.sub='user_ia880b';
select loja_ia_abrir_coleta();
reset role;
update perfis set whatsapp_verificado_em=null where id='user_ia880b';
set local role authenticated;
do $$ declare id uuid; begin
  id := (loja_ia_obter()->>'id')::uuid;
  begin perform loja_ia_salvar_coleta(id,0,'{"nome":"Loja","cidade":"Corrente","materiais":[],"consultarWhatsapp":true,"avisarWhatsapp":false}'); raise exception 'aceitou número não confirmado'; exception when insufficient_privilege then null; end;
end $$;
reset role;
delete from perfis where id='user_ia880b';
do $$ begin
  assert not exists(select 1 from loja_ia_rascunhos where dono_id='user_ia880b'), 'exclusão deixou rascunho';
  assert not exists(select 1 from loja_ia_convites where usuario_id='user_ia880b'), 'exclusão deixou convite';
  assert has_table_privilege('service_role','public.loja_ia_rascunhos','select,update'), 'worker sem privilégios';
end $$;
rollback;
