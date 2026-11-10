\set ON_ERROR_STOP on
\set QUIET on
begin;
select id as regiao from microrregioes where slug='corrente-pi' \gset
insert into perfis(id,microrregiao_id,nome,whatsapp,whatsapp_verificado_em,e_admin)
values ('user_pf380',:'regiao','Pessoa Teste 380','5589999990380',now(),false),
       ('user_suporte380',:'regiao','Suporte 380',null,null,false),
       ('user_franq380',:'regiao','Franqueado 380',null,null,false);
insert into equipe(usuario_id,papel,microrregiao_id)
values ('user_suporte380','suporte',null),('user_franq380','franqueado',:'regiao');
insert into vitrines_lojas(id,dono_id,microrregiao_id,slug,nome,cidade,tipo,plano,plano_expira_em)
values ('38000000-0000-4000-a000-000000000001','user_pf380',:'regiao','pf-regional-380','Pessoa Teste 380','Corrente','pf','full',now()+interval '3 days');

set local role service_role;
do $$
declare
  doc text := encode(convert_to('%PDF-1.7 Documento de teste','UTF8'),'base64');
  comp text := encode(convert_to('%PDF-1.7 Comprovante de teste','UTF8'),'base64');
begin
  assert enviar_verificacao_vendedor_pf('user_loja',doc,comp) = 'conta', 'Loja não entra no fluxo PF';
  assert enviar_verificacao_vendedor_pf('user_pf380',doc,null) = 'invalido', 'Os dois arquivos são obrigatórios';
  assert enviar_verificacao_vendedor_pf('user_pf380',doc,'###') = 'invalido', 'Base64 inválido';
  assert enviar_verificacao_vendedor_pf('user_pf380',doc,doc) = 'invalido', 'Dois arquivos distintos';
  assert enviar_verificacao_vendedor_pf('user_pf380',doc,encode(convert_to('<html>não é documento</html>','UTF8'),'base64')) = 'invalido';
  assert enviar_verificacao_vendedor_pf('user_pf380',doc,comp) = 'enviada';
  assert enviar_verificacao_vendedor_pf('user_pf380',doc,comp) = 'pendente';
end $$;

reset role;
select set_config('teste.verificacao380', id::text, true) from verificacoes_vendedor_pf where perfil_id='user_pf380';
set local role anon;
do $$ begin
  assert not has_table_privilege('verificacoes_vendedor_pf','select');
  assert not has_function_privilege('public.admin_arquivo_verificacao_pf(uuid,text)','execute');
end $$;

set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='user_pf380';
do $$ begin
  assert (select status='pendente' from minha_verificacao_vendedor_pf()), 'Titular acompanha a situação';
  assert not has_table_privilege('verificacoes_vendedor_pf','select');
  assert not has_function_privilege('public.enviar_verificacao_vendedor_pf(text,text,text)','execute');
  assert not has_function_privilege('public.admin_verificar_vendedor_pf(uuid,text,boolean,boolean,boolean,boolean)','execute');
  begin
    perform admin_arquivo_verificacao_pf(current_setting('teste.verificacao380')::uuid,'documento');
    raise exception 'Titular obteve o arquivo privado pelo endpoint de revisão';
  exception when insufficient_privilege then null;
  end;
end $$;

set local request.jwt.claim.sub='user_franq380';
do $$ begin
  begin
    perform admin_arquivo_verificacao_pf(current_setting('teste.verificacao380')::uuid,'comprovante');
    raise exception 'Franqueado obteve comprovante';
  exception when insufficient_privilege then null;
  end;
end $$;

set local request.jwt.claim.sub='user_suporte380';
do $$
declare envio uuid := current_setting('teste.verificacao380')::uuid;
begin
  assert exists(select 1 from admin_fila_verificacao_pf() f where f.id=envio and dados_atuais);
  assert (select mime='application/pdf' and arquivo_base64 is not null from admin_arquivo_verificacao_pf(envio,'documento'));
  assert (select mime='application/pdf' and arquivo_base64 is not null from admin_arquivo_verificacao_pf(envio,'comprovante'));
  begin
    perform admin_decidir_verificacao_pf(envio,true,true,true,false,null);
    raise exception 'Aprovou sem conferir endereço';
  exception when check_violation then null;
  end;
  perform admin_decidir_verificacao_pf(envio,false,false,false,false,'arquivo_ilegivel');
  assert not exists (select 1 from admin_arquivo_verificacao_pf(envio,'documento'));
end $$;

set local request.jwt.claim.sub='user_pf380';
do $$ begin
  assert (select status='recusada' and motivo='arquivo_ilegivel' from minha_verificacao_vendedor_pf());
end $$;

reset role;
set local request.jwt.claim.sub='';
select enviar_verificacao_vendedor_pf('user_pf380', encode(convert_to('%PDF-1.7 Novo documento','UTF8'),'base64'),
  encode(convert_to('%PDF-1.7 Novo comprovante','UTF8'),'base64'));
select id as revisao from verificacoes_vendedor_pf where perfil_id='user_pf380' and status='pendente' \gset
set local role authenticated;
set local request.jwt.claim.sub='user_suporte380';
select admin_decidir_verificacao_pf(:'revisao',true,true,true,true,null);
do $$ begin
  assert not exists (select 1 from admin_fila_verificacao_pf() f where f.nome='Pessoa Teste 380');
end $$;
set local request.jwt.claim.sub='user_pf380';
do $$ begin
  assert (select status='aprovada' from minha_verificacao_vendedor_pf());
end $$;

reset role;
set local request.jwt.claim.sub='';
do $$ begin
  assert (select count(*) = 2 from verificacoes_vendedor_pf where perfil_id='user_pf380' and documento is null and comprovante is null),
    'Arquivos das duas decisões são removidos';
  assert (select selo_negociador_certificado and verificacao_pf_em is not null from perfis where id='user_pf380');
end $$;
delete from perfis where id='user_pf380';
do $$ begin
  assert not exists(select 1 from verificacoes_vendedor_pf where perfil_id='user_pf380');
end $$;
rollback;
