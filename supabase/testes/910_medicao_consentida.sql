\set ON_ERROR_STOP on
\set QUIET on
-- Etapa P4: métricas do produto (números diários, termos, aparições, favoritar, tempo até sair e leituras).
begin;
set local timezone='America/Fortaleza';
reset role;
set local request.jwt.claim.role='';
set local request.jwt.claim.sub='';
select id as reg from microrregioes where slug='corrente-pi' \gset
select id as cat from categorias where slug='sofas-e-poltronas' \gset
insert into perfis(id,microrregiao_id,nome,cidade,whatsapp,whatsapp_verificado_em,e_admin) values
 ('user_dono540',:'reg','Dono 540','Corrente','5589999990540',now(),false),
 ('user_outro540',:'reg','Outro 540','Corrente','5589999990541',now(),false),
 ('user_visitante540',:'reg','Visitante 540','Corrente','5589999990542',now(),false),
 ('user_admin540',:'reg','Admin 540','Corrente','5589999990543',now(),true);
insert into vitrines_lojas(id,dono_id,microrregiao_id,slug,nome,cidade,whatsapp,tipo,plano,plano_expira_em) values
 ('54000000-0000-4000-a000-000000000001','user_dono540',:'reg','loja-540','Loja 540','Corrente','5589999990540','loja','slim',now()+interval '30 days'),
 ('54000000-0000-4000-a000-000000000002','user_outro540',:'reg','outra-540','Outra 540','Corrente','5589999990541','loja','slim',now()+interval '30 days');
insert into anuncios(id,vitrine_id,microrregiao_id,categoria_id,titulo,descricao,cidade,preco_centavos,fotos,status,publicado_em) values
 ('54100000-0000-4000-a000-000000000001','54000000-0000-4000-a000-000000000001',:'reg',:'cat','Sofá 540 A',null,'Corrente',null,'{}','ativo',now()-interval '10 days'),
 ('54100000-0000-4000-a000-000000000002','54000000-0000-4000-a000-000000000001',:'reg',:'cat','Mesa 540 B',null,'Corrente',null,'{}','ativo',now()),
 ('54100000-0000-4000-a000-000000000003','54000000-0000-4000-a000-000000000001',:'reg',:'cat','Cadeira 540 C',null,'Corrente',null,'{}','ativo',now()-interval '20 days'),
 ('54100000-0000-4000-a000-000000000004','54000000-0000-4000-a000-000000000002',:'reg',:'cat','Estante 540 D',null,'Corrente',null,'{}','ativo',now()),
 ('54100000-0000-4000-a000-000000000005','54000000-0000-4000-a000-000000000001',:'reg',:'cat','Rascunho 540 E',null,'Corrente',null,'{}','rascunho',null);

do $$ declare v uuid := '91000000-0000-4000-a000-000000000001'; s uuid := '91000000-0000-4000-a000-000000000002'; o uuid := '91000000-0000-4000-a000-000000000003'; begin
  assert not has_function_privilege('anon','public.registrar_visita_consentida(uuid,uuid,uuid,text,text,boolean,boolean)','execute');
  assert not has_function_privilege('authenticated','public.registrar_evento(uuid,text,text,text,text)','execute');
  assert public.registrar_visita_consentida(v,s,o,'/minha-conta')=false;
  assert public.registrar_visita_consentida(v,s,o,'/busca')=true;
  assert public.registrar_visita_consentida(v,s,o,'/busca')=false;
  assert public.registrar_visita_consentida(v,s,'91000000-0000-4000-a000-000000000004','/')=true;
  assert public.registrar_visita_consentida(v,s,'91000000-0000-4000-a000-000000000005','/busca')=true;
  assert (select count(*)=3 and count(distinct visitante)=1 and count(distinct sessao)=1 from public.visitas where visitante=v::text);
  perform public.registrar_busca_consentida(null,null,'zero');
  perform public.registrar_busca_consentida(null,null,'zero');
  assert (select vezes=2 from public.buscas_faixas_dia where microrregiao_id is null and categoria_id is null and faixa='zero');
  assert not has_table_privilege('authenticated','public.anuncios_termos_dia','select');
end $$;
do $$ begin
  set local request.jwt.claim.role='service_role';
  assert public.registrar_evento('54100000-0000-4000-a000-000000000002','visualizacao','910-navegador',null,'email@sentinela.invalid');
  assert not public.registrar_evento('54100000-0000-4000-a000-000000000002','visualizacao','910-navegador','user_visitante540',null), 'Conta não muda identidade da medição';
  assert not public.registrar_evento('54100000-0000-4000-a000-000000000002','visualizacao','910-dono','user_dono540',null);
  assert not exists(select 1 from anuncios_termos_dia where anuncio_id='54100000-0000-4000-a000-000000000002');
  assert (select visualizacoes=1 from anuncios where id='54100000-0000-4000-a000-000000000002');
  assert public.registrar_evento_loja('54000000-0000-4000-a000-000000000001','visita','910-navegador',null);
  assert not public.registrar_evento_loja('54000000-0000-4000-a000-000000000001','visita','910-navegador','user_visitante540');
  insert into anuncios_termos_dia(anuncio_id,dia,termo,vezes) values('54100000-0000-4000-a000-000000000002',current_date,'historico sentinela',1);
  assert (select termos='[]'::jsonb from public.metricas_produtos_periodo(7) where anuncio_id='54100000-0000-4000-a000-000000000002');
  assert exists(select 1 from anuncios_termos_dia where termo='historico sentinela'), 'Histórico preservado';
  set local request.jwt.claim.sub='user_admin540';
  assert public.admin_medicao_resumo(current_date,current_date)->>'pageviews'='3';
  assert public.admin_visitas(current_date,current_date)->'paginas'='[]'::jsonb;
  assert public.admin_visitas(current_date,current_date)->'por_campanha'='[]'::jsonb;
end $$;
rollback;

-- Relógio controlado somente nesta transação: RPC real em sessão UTC à noite local.
begin;
set local timezone='UTC';
do $$ begin
 execute replace(pg_get_functiondef('public.registrar_busca_consentida(uuid,text,text)'::regprocedure),
   'now()', '''2001-01-10T02:59:00Z''::timestamptz');
 perform public.registrar_busca_consentida(null,null,'zero');
 assert exists(select 1 from public.buscas_faixas_dia where dia='2001-01-09' and faixa='zero'),
   'Busca às 23:59 Fortaleza caiu no dia UTC seguinte';
end $$;
rollback;
begin;
set local timezone='UTC';
do $$ begin
 execute replace(pg_get_functiondef('public.registrar_busca_consentida(uuid,text,text)'::regprocedure),
   'now()', '''2001-01-10T03:00:00Z''::timestamptz');
 perform public.registrar_busca_consentida(null,null,'zero');
 assert exists(select 1 from public.buscas_faixas_dia where dia='2001-01-10' and faixa='zero'), 'Meia-noite local não abriu o novo dia';
end $$;
rollback;
begin;
set local timezone='UTC';
select id as reg from microrregioes where slug='corrente-pi' \gset
insert into perfis(id,microrregiao_id,nome,cidade,e_admin) values('user_civil910',:'reg','Admin fictício','Corrente',true);
insert into visitas(visitante,caminho,origem,coorte,sessao,ocorrencia,criado_em) values
 ('91000000-0000-4000-a000-000000000010','/','direto','consentida_v1','91000000-0000-4000-a000-000000000010','91000000-0000-4000-a000-000000000010','2001-01-10T02:59:00Z'),
 ('91000000-0000-4000-a000-000000000011','/','direto','consentida_v1','91000000-0000-4000-a000-000000000011','91000000-0000-4000-a000-000000000011','2001-01-10T03:00:00Z');
set local role authenticated;
set local request.jwt.claim.sub='user_civil910';
do $$ begin
 assert public.admin_medicao_resumo('2001-01-09','2001-01-09')->>'pageviews'='1', 'Resumo direto dependeu do fuso da sessão';
 assert public.admin_medicao_resumo('2001-01-10','2001-01-10')->>'pageviews'='1';
end $$;
rollback;
