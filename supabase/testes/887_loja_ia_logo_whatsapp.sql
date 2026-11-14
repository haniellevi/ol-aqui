\set ON_ERROR_STOP on
begin;
insert into perfis(id,microrregiao_id,nome,cidade,whatsapp,whatsapp_verificado_em)
select 'user_ia887',id,'Teste logo Business','Corrente','5589999010887',now() from microrregioes where slug='corrente-pi';
set local role authenticated;
set local request.jwt.claim.sub='user_ia887';
select loja_ia_abrir_coleta() as draft \gset
select loja_ia_salvar_coleta((:'draft'::jsonb->>'id')::uuid,0,'{"nome":"Loja Business","cidade":"Corrente","descricao":"Loja de roupas","materiais":[],"consultarWhatsapp":true,"avisarWhatsapp":false}') as draft \gset
select loja_ia_iniciar((:'draft'::jsonb->>'id')::uuid,1);
reset role;
select id as trabalho, tentativa from loja_ia_pegar(10) where fonte='whatsapp' \gset
select set_config('test.ia887_trabalho', :'trabalho', true), set_config('test.ia887_tentativa', :'tentativa', true), set_config('test.ia887_rascunho', :'draft'::jsonb->>'id',true);
select loja_ia_reservar_logo_whatsapp(:'trabalho',:'tentativa',repeat('a',64),100) as imagem \gset
select set_config('test.ia887_imagem', :'imagem'::jsonb->>'id', true);
do $$ declare t uuid := current_setting('test.ia887_trabalho')::uuid; a uuid := current_setting('test.ia887_tentativa')::uuid; i uuid := current_setting('test.ia887_imagem')::uuid;
begin
  assert loja_ia_reservar_logo_whatsapp(t,a,repeat('a',64),100)->>'id'=i::text,'repetição duplicou imagem';
  assert loja_ia_concluir_logo_whatsapp(t,a,i)=i,'não concluiu';
  assert loja_ia_concluir_logo_whatsapp(t,a,i)=i,'conclusão não idempotente';
  assert loja_ia_imagem_publica(i) is null,'imagem publicada sem loja';
  begin perform loja_ia_reservar_logo_whatsapp(t,gen_random_uuid(),repeat('b',64),100); raise exception 'tentativa antiga aceita'; exception when insufficient_privilege then null; end;
  begin perform loja_ia_reservar_logo_whatsapp(t,a,null,100); raise exception 'hash nulo aceito'; exception when invalid_parameter_value then null; end;
end $$;
set local role authenticated;
do $$ begin
  assert loja_ia_obter_imagem_propria(current_setting('test.ia887_rascunho')::uuid,current_setting('test.ia887_imagem')::uuid)->>'estado'='pronta','dono não vê logo';
  begin perform loja_ia_reservar_logo_whatsapp(current_setting('test.ia887_trabalho')::uuid,current_setting('test.ia887_tentativa')::uuid,repeat('a',64),100); raise exception 'usuário comum importou'; exception when insufficient_privilege then null; end;
end $$;
reset role;
-- A retirada do consentimento entre download e confirmação bloqueia a imagem.
update perfis set whatsapp_verificado_em=null where id='user_ia887';
do $$ begin
  begin perform loja_ia_concluir_logo_whatsapp(current_setting('test.ia887_trabalho')::uuid,current_setting('test.ia887_tentativa')::uuid,current_setting('test.ia887_imagem')::uuid); raise exception 'confirmou sem consentimento'; exception when insufficient_privilege then null; end;
end $$;
update perfis set whatsapp_verificado_em=(select whatsapp_verificado_autorizado_em from loja_ia_rascunhos where dono_id='user_ia887') where id='user_ia887';
select loja_ia_concluir_fonte(:'trabalho',:'tentativa',jsonb_build_object('estado','ok','evidencias',jsonb_build_array(jsonb_build_object('id','whatsapp:logo','campo','logo','valor',:'imagem'::jsonb->>'id','origem',jsonb_build_object('fonte','whatsapp','rotulo','Foto do perfil do WhatsApp Business')))));
select loja_ia_concluir_fonte(id,tentativa,'{"estado":"indisponivel"}') from loja_ia_trabalhos where rascunho_id=(:'draft'::jsonb->>'id')::uuid and fonte='informado';
select id as merc, tentativa as merc_tentativa from loja_ia_pegar(10) where fonte='merc' \gset
select loja_ia_concluir_fonte(:'merc',:'merc_tentativa','{"estado":"indisponivel"}');
do $$ begin
  assert (select campos#>>'{logo,valor}'=current_setting('test.ia887_imagem') from loja_ia_rascunhos where dono_id='user_ia887'),'logo não chegou à revisão';
end $$;
-- O vínculo existente publica a cópia normalizada, sem URL do WhatsApp.
update configuracoes set valor='"https://store-fixture.invalid"'::jsonb where chave='fotos.origem' and microrregiao_id is null;
set local role authenticated;
select loja_ia_publicar((:'draft'::jsonb->>'id')::uuid,2,'{"nome":"Teste logo Business","cidade":"Corrente","slug":"teste-logo-ia887","whatsapp":"5589999010887"}',jsonb_build_object('logo',:'imagem'::jsonb->>'id'));
reset role;
do $$ begin
  assert (select logo_url='/api/loja/imagem/'||current_setting('test.ia887_imagem') from vitrines_lojas where dono_id='user_ia887'),'logo não vinculado';
  assert loja_ia_imagem_publica(current_setting('test.ia887_imagem')::uuid) is not null,'logo publicado não acessível';
end $$;
rollback;
