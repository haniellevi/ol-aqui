begin;
insert into perfis(id,microrregiao_id,nome,cidade,whatsapp,whatsapp_verificado_em)
select 'user_ia882',id,'Loja IA','Corrente','5589999978811',now() from microrregioes where slug='corrente-pi';
set local role authenticated;
set local request.jwt.claim.sub='user_ia882';
select loja_ia_abrir_coleta() as draft \gset
select loja_ia_salvar_coleta((:'draft'::jsonb->>'id')::uuid,0,'{"nome":"Loja","cidade":"Corrente","descricao":"Loja de roupas","materiais":[],"consultarWhatsapp":true,"avisarWhatsapp":true}') as draft \gset
select loja_ia_iniciar((:'draft'::jsonb->>'id')::uuid,1);
reset role;
select id as trabalho, tentativa from loja_ia_pegar(10) where fonte='whatsapp' \gset
select loja_ia_emitir_ticket(:'trabalho', :'tentativa') as ticket \gset
select set_config('test.id', :'draft'::jsonb->>'id', true);
select set_config('test.ticket', :'ticket', true), set_config('test.trabalho', :'trabalho', true), set_config('test.tentativa', :'tentativa', true);
do $$ begin
  assert loja_ia_resgatar_ticket(current_setting('test.ticket')::uuid)='5589999978811', 'resgata número confirmado';
  assert loja_ia_resgatar_ticket(current_setting('test.ticket')::uuid) is null, 'ticket reapresentado';
end $$;
select loja_ia_emitir_ticket(:'trabalho', :'tentativa') as ticket \gset
update loja_ia_tickets set expira_em=now()-interval '1 second' where id=:'ticket';
select set_config('test.ticket', :'ticket', true);
do $$ begin assert loja_ia_resgatar_ticket(current_setting('test.ticket')::uuid) is null, 'ticket expirado'; end $$;
select loja_ia_emitir_ticket(:'trabalho', :'tentativa') as ticket \gset
update loja_ia_rascunhos set entrada=jsonb_set(entrada,'{consultarWhatsapp}','false') where id=(:'draft'::jsonb->>'id')::uuid;
select set_config('test.ticket', :'ticket', true);
do $$ begin assert loja_ia_resgatar_ticket(current_setting('test.ticket')::uuid) is null, 'consentimento removido após ticket'; end $$;
update loja_ia_rascunhos set entrada=jsonb_set(entrada,'{consultarWhatsapp}','true') where id=(:'draft'::jsonb->>'id')::uuid;
select loja_ia_emitir_ticket(:'trabalho', :'tentativa') as ticket \gset
update perfis set whatsapp_verificado_em=null where id='user_ia882';
select set_config('test.ticket', :'ticket', true);
do $$ begin assert loja_ia_resgatar_ticket(current_setting('test.ticket')::uuid) is null, 'confirmação retirada após ticket'; end $$;
update perfis set whatsapp_verificado_em=now() where id='user_ia882';
select loja_ia_emitir_ticket(:'trabalho', :'tentativa') as ticket \gset
update perfis set whatsapp_verificado_em=whatsapp_verificado_em + interval '1 second' where id='user_ia882';
select set_config('test.ticket', :'ticket', true);
do $$ begin
  assert loja_ia_resgatar_ticket(current_setting('test.ticket')::uuid) is null, 'reverificação exige nova autorização';
  begin update loja_ia_rascunhos set entrada=entrada where dono_id='user_ia882'; raise exception 'consentimento renovado silenciosamente'; exception when insufficient_privilege then null; end;
end $$;
update perfis set whatsapp_verificado_em=(select whatsapp_verificado_autorizado_em from loja_ia_rascunhos where dono_id='user_ia882') where id='user_ia882';
set local role authenticated;
do $$ begin
  begin perform loja_ia_emitir_ticket(current_setting('test.trabalho')::uuid,current_setting('test.tentativa')::uuid); raise exception 'usuário comum emitiu ticket'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select loja_ia_emitir_ticket(:'trabalho', :'tentativa') as ticket \gset
select set_config('test.ticket', :'ticket', true);
insert into vitrines_lojas(dono_id,microrregiao_id,nome,slug,cidade,tipo,plano,status)
select id,microrregiao_id,'Teste','pf-ia882','Corrente','pf','pf_gratis','suspensa' from perfis where id='user_ia882';
do $$ begin
  assert loja_ia_resgatar_ticket(current_setting('test.ticket')::uuid) is null, 'suspensão impede consulta';
  assert loja_ia_emitir_ticket(current_setting('test.trabalho')::uuid,current_setting('test.tentativa')::uuid) is null, 'suspensão impede ticket';
end $$;
delete from vitrines_lojas where dono_id='user_ia882';
select loja_ia_emitir_ticket(:'trabalho', :'tentativa') as ticket \gset
delete from loja_ia_convites where usuario_id='user_ia882';
select set_config('test.ticket', :'ticket', true);
do $$ begin assert loja_ia_resgatar_ticket(current_setting('test.ticket')::uuid) is null, 'convite revogado'; end $$;
insert into loja_ia_convites(usuario_id) values ('user_ia882');
update loja_ia_rascunhos set estado='pronto' where id=(:'draft'::jsonb->>'id')::uuid;
update loja_ia_rascunhos set entrada=jsonb_set(entrada,'{avisarWhatsapp}','false') where id=(:'draft'::jsonb->>'id')::uuid;
select loja_ia_enfileirar_avisos(10);
do $$ begin assert not exists(select 1 from whatsapp_fila where usuario_id='user_ia882'), 'aviso sem consentimento'; end $$;
update loja_ia_rascunhos set entrada=jsonb_set(entrada,'{avisarWhatsapp}','true') where id=(:'draft'::jsonb->>'id')::uuid;
select loja_ia_enfileirar_avisos(10);
select loja_ia_enfileirar_avisos(10);
do $$ begin assert (select count(*)=1 from whatsapp_fila where chave='loja_ia_pronta:'||(select id from loja_ia_rascunhos where dono_id='user_ia882')::text), 'aviso duplicado'; end $$;
update whatsapp_fila set estado='enviando' where usuario_id='user_ia882';
update perfis set whatsapp_verificado_em=null where id='user_ia882';
do $$ declare f uuid; begin
  select id into f from whatsapp_fila where usuario_id='user_ia882';
  assert whatsapp_fila_confirmar_envio(f)='cancelada', 'verificação retirada após enfileirar';
end $$;
-- A confirmação perdida entre consulta autorizada e retorno invalida as evidências.
do $$
declare t public.loja_ia_trabalhos;
begin
  select * into t from public.loja_ia_trabalhos where id=current_setting('test.trabalho')::uuid;
  assert public.loja_ia_concluir_fonte(t.id,t.tentativa,
    '{"estado":"ok","evidencias":[{"id":"wa:desc","campo":"sobre","valor":"Privado","origem":{"fonte":"whatsapp","rotulo":"WhatsApp"}}]}'::jsonb),
    'Finaliza fonte cujo consentimento perdeu validade';
  assert exists(select 1 from public.loja_ia_trabalhos where id=t.id and resultado->>'estado'='indisponivel' and not (resultado ? 'evidencias')),
    'Descarta evidências coletadas com autorização expirada';
end $$;
-- O dono pode retirar os opt-ins mesmo depois da coleta, sem reautorizar o restante.
set local role authenticated;
set local request.jwt.claim.sub='user_ia882';
select loja_ia_revogar_whatsapp((:'draft'::jsonb->>'id')::uuid,true,false) as revogado \gset
select 1 / case when :'revogado'::jsonb#>>'{entrada,consultarWhatsapp}'='false' and :'revogado'::jsonb#>>'{entrada,avisarWhatsapp}'='true' then 1 else 0 end;
select loja_ia_revogar_whatsapp((:'draft'::jsonb->>'id')::uuid,false,true) as revogado \gset
select 1 / case when :'revogado'::jsonb#>>'{entrada,avisarWhatsapp}'='false' then 1 else 0 end;
reset role;
update perfis set whatsapp_verificado_em=now() where id='user_ia882';
update whatsapp_fila set estado='enviando' where usuario_id='user_ia882';
do $$ declare f uuid; begin select id into f from whatsapp_fila where usuario_id='user_ia882'; assert whatsapp_fila_confirmar_envio(f)='cancelada', 'revogação impede envio'; end $$;
set local role authenticated;
set local request.jwt.claim.sub='user_outra882';
do $$ begin
  begin perform loja_ia_revogar_whatsapp((select current_setting('test.id')::uuid),true,true); raise exception 'outro dono revogou'; exception when insufficient_privilege then null; end;
end $$;
rollback;
