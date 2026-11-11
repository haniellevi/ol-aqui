\set ON_ERROR_STOP on
\set QUIET on
begin;

select id as reg from microrregioes where slug = 'corrente-pi' \gset
select id as cat from categorias where slug = 'sofas-e-poltronas' \gset
insert into perfis(id,microrregiao_id,nome,e_admin,whatsapp,whatsapp_verificado_em) values
  ('user_admin430', :'reg', 'Admin arquivo', true, null, null),
  ('user_loja430', :'reg', 'Dono arquivo', false, '5589999990431', now()),
  ('user_suporte430', :'reg', 'Suporte arquivo', false, null, null),
  ('user_gerente430', :'reg', 'Gerente arquivo', false, '5589999990432', now()),
  ('user_fin430', :'reg', 'Financeiro arquivo', false, null, null),
  ('user_franqueado430', :'reg', 'Franqueado arquivo', false, null, null);
insert into equipe(usuario_id,papel,microrregiao_id) values
  ('user_suporte430','suporte',null), ('user_fin430','financeiro',null), ('user_franqueado430','franqueado',:'reg');

insert into vitrines_lojas(id,dono_id,microrregiao_id,slug,nome,cidade,tipo,plano,status,plano_expira_em)
values ('43000000-0000-4000-a000-000000000001','user_loja430',:'reg','loja-430','Loja de teste do painel','Corrente','loja','full','ativa',now()+interval '2 days');
insert into anuncios(vitrine_id,categoria_id,titulo,cidade,preco_centavos,status,publicado_em) values
  ('43000000-0000-4000-a000-000000000001',:'cat','Mesa de teste do painel','Corrente',9900,'ativo',now()),
  ('43000000-0000-4000-a000-000000000001',:'cat','Banco congelado de teste','Corrente',9900,'congelado',now());
insert into convites_gerente_loja(vitrine_id,token_hash,telefone_hash,final_telefone,aceito_por,aceito_em)
values ('43000000-0000-4000-a000-000000000001',sha256('teste430'),sha256('fone430'),'0432','user_gerente430',now());
insert into pagamentos(id,vitrine_id,microrregiao_id,tipo,valor_centavos,status,pago_em) values
  ('43000000-0000-4000-a000-000000000011','43000000-0000-4000-a000-000000000001',:'reg','assinatura',12500,'pago',now()),
  ('43000000-0000-4000-a000-000000000012','43000000-0000-4000-a000-000000000001',:'reg','destaque',2500,'pago',now()),
  ('43000000-0000-4000-a000-000000000013','43000000-0000-4000-a000-000000000001',:'reg','assinatura',9900,'pendente',null);
insert into asaas_criacoes(pagamento_id,ambiente) values
  ('43000000-0000-4000-a000-000000000011','producao'),
  ('43000000-0000-4000-a000-000000000012','sandbox');
insert into vitrines_acoes_admin(vitrine_id,admin_id,acao,motivo)
values ('43000000-0000-4000-a000-000000000001','user_admin430','cortesia','Histórico anterior de teste');

set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = 'user_loja430';
do $$ begin
  assert admin_ficha_loja('43000000-0000-4000-a000-000000000001') is null;
  assert not exists(select 1 from asaas_criacoes where pagamento_id='43000000-0000-4000-a000-000000000011');
end $$;

set local request.jwt.claim.sub = 'user_suporte430';
do $$ declare ficha jsonb := admin_ficha_loja('43000000-0000-4000-a000-000000000001'); begin
  assert ficha->>'gerentes' = '1' and ficha->>'pagamentos' is null and ficha->>'historico' is null;
  begin
    perform admin_arquivar_loja('43000000-0000-4000-a000-000000000001',true,'Teste não autorizado',(ficha->>'atualizado_em')::timestamptz);
    raise exception 'Suporte conseguiu arquivar';
  exception when insufficient_privilege then null;
  end;
end $$;

set local request.jwt.claim.sub = 'user_franqueado430';
do $$ begin
  assert admin_ficha_loja('43000000-0000-4000-a000-000000000001')->>'anuncios' = '2';
  assert admin_ficha_loja((select id from vitrines_lojas where dono_id='user_distante')) is null;
end $$;

set local request.jwt.claim.sub = 'user_fin430';
do $$ declare loja uuid := '43000000-0000-4000-a000-000000000001'; begin
  assert (select sum(total_centavos) = 12500 from admin_resumo_pagamentos_filtrado(p_ambiente=>'producao',p_loja=>loja));
  assert (select sum(total_centavos) = 2500 from admin_resumo_pagamentos_filtrado(p_ambiente=>'sandbox',p_loja=>loja));
  assert (select sum(total_centavos) = 9900 from admin_resumo_pagamentos_filtrado(p_ambiente=>'sem_origem',p_loja=>loja));
end $$;

set local request.jwt.claim.sub = 'user_admin430';
do $$ declare
  loja uuid := '43000000-0000-4000-a000-000000000001';
  versao timestamptz := (admin_ficha_loja(loja)->>'atualizado_em')::timestamptz;
begin
  assert (select situacao <> 'arquivada' from admin_lojas(p_busca=>loja::text, p_limite=>1));
  perform admin_arquivar_loja(loja,true,'Arquivamento de teste',versao);
  perform admin_arquivar_loja(loja,true,'Repetição segura',versao);
  assert (select count(*) = 1 from vitrines_acoes_admin where vitrine_id=loja and acao='arquivar');
  assert (select count(*) = 1 from admin_lojas(p_busca=>loja::text,p_situacao=>'arquivada'));
  assert (select count(*) = 1 from anuncios where vitrine_id=loja and status='pausado');
  assert (select count(*) = 1 from anuncios where vitrine_id=loja and status='congelado');
  assert (select count(*) = 3 and sum(valor_centavos)=24900 from pagamentos where vitrine_id=loja);
  assert (select count(*) = 2 from vitrines_acoes_admin where vitrine_id=loja);
  begin
    perform admin_acao_loja(loja,'reativar','Tentativa sem restaurar');
    raise exception 'Reativou loja arquivada';
  exception when check_violation then null;
  end;
end $$;

set local request.jwt.claim.sub = 'user_gerente430';
do $$ begin
  assert not exists(select 1 from minhas_lojas() where id='43000000-0000-4000-a000-000000000001');
end $$;
reset role;
set local role anon;
set local request.jwt.claim.role = 'anon';
set local request.jwt.claim.sub = '';
do $$ begin
  assert not has_function_privilege('public.admin_ficha_loja(uuid)','execute');
  assert vitrine_publica('loja-430') is null;
end $$;
reset role;
set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = 'user_admin430';
do $$ declare loja uuid := '43000000-0000-4000-a000-000000000001'; begin
  begin
    perform admin_arquivar_loja(loja,false,'Versão antiga','2000-01-01');
    raise exception 'Aceitou versão antiga' using errcode='22023';
  exception when raise_exception then null;
  end;
  perform admin_arquivar_loja(loja,false,'Restauração de teste',(admin_ficha_loja(loja)->>'atualizado_em')::timestamptz);
  assert (select situacao = 'suspensa' from admin_lojas(p_busca=>loja::text));
  assert (select count(*) = 1 from anuncios where vitrine_id=loja and status='pausado');
  assert (select count(*) = 3 and sum(valor_centavos)=24900 from pagamentos where vitrine_id=loja);
  assert jsonb_array_length(admin_ficha_loja(loja)->'historico') = 3;
end $$;
rollback;
