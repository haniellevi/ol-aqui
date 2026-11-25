\set ON_ERROR_STOP on
begin;
select id as reg from microrregioes where slug='corrente-pi' \gset
select id as cat from categorias where slug='sofas-e-poltronas' \gset
insert into perfis(id,microrregiao_id,nome,whatsapp,whatsapp_verificado_em,e_admin)
values ('user_c26admin',:'reg','Admin sintético','5589999926001',now(),true),
('user_c26dono',:'reg','Dono sintético','5589999926002',now(),false);
insert into vitrines_lojas(id,dono_id,microrregiao_id,slug,nome,cidade,tipo,plano,plano_expira_em)
values ('26000000-0000-4000-a000-000000000001','user_c26dono',:'reg','loja-c26','Loja sintética','Corrente','loja','full',now()+interval '30 days');
insert into anuncios(id,vitrine_id,categoria_id,titulo,cidade,status,excluido_em,status_antes_exclusao,congelado_motivo,fotos,atributos)
select ('26000000-0000-4000-b000-00000000000'||n)::uuid,'26000000-0000-4000-a000-000000000001',:'cat','Prova sintética '||n,'Corrente',
 'ativo'::status_anuncio,
null::timestamptz,
null,'Ofício sintético',array['https://synthetic.invalid/c26.webp'],'{"estado":"usado"}' from generate_series(1,3) n;
select set_config('olaki.lixeira','1',true);
update anuncios set status='excluido',status_antes_exclusao='ativo',excluido_em=now()-interval '1 day'
where id in ('26000000-0000-4000-b000-000000000001','26000000-0000-4000-b000-000000000002');
update anuncios set excluido_em=now()-interval '40 days' where id='26000000-0000-4000-b000-000000000001';
select public.compliance_retencao_atual('anuncio','26000000-0000-4000-b000-000000000001')->>'retencao_id' as retencao1 \gset
select public.compliance_retencao_atual('anuncio','26000000-0000-4000-b000-000000000002')->>'retencao_id' as retencao2 \gset
select public.compliance_retencao_atual('anuncio','26000000-0000-4000-b000-000000000003')->>'retencao_id' as retencao3 \gset
set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='user_c26admin';
select compliance_abrir('Revisão sintética C26',null) as consulta \gset
select compliance_liberar_retencao(:'consulta','anuncio','26000000-0000-4000-b000-000000000001','  Ofício encerrado  ',:'retencao1') as evento \gset
select set_config('c26.evento',:'evento',true);
select compliance_liberar_retencao(:'consulta','anuncio','26000000-0000-4000-b000-000000000001','Retry legítimo',:'retencao1') = :'evento'::uuid as retry_ok \gset
\if :retry_ok
\else
  \quit 1
\endif
select compliance_liberar_retencao(:'consulta','anuncio','26000000-0000-4000-b000-000000000002','Ofício encerrado',:'retencao2');
select compliance_liberar_retencao(:'consulta','anuncio','26000000-0000-4000-b000-000000000003','Ofício encerrado',:'retencao3');
do $$ begin assert (select status='ativo' from anuncios where id='26000000-0000-4000-b000-000000000003'); end $$;
-- Um ativo liberado pode receber outro congelamento legítimo, sem reutilizar a liberação anterior.
select congelar_anuncio('26000000-0000-4000-b000-000000000003','Novo ofício sintético');
select set_config('c26.consulta',:'consulta',true);
do $$ declare atual jsonb; anterior public.admin_gestao_eventos; begin
  select * into anterior from admin_gestao_eventos where acao='compliance_liberar_retencao'
    and detalhes->>'item'='26000000-0000-4000-b000-000000000003';
  select x into atual from jsonb_array_elements(compliance_fila_retencoes(current_setting('c26.consulta')::uuid)) x
    where x->>'id'='26000000-0000-4000-b000-000000000003';
  assert atual->>'estado'='retido', 'novo episódio ainda não foi liberado';
  assert atual->>'retencao_motivo'='Novo ofício sintético';
  assert atual->>'retencao_id' <> anterior.detalhes->>'retencao_id';
  assert (atual->>'retencao_em')::timestamptz=(anterior.detalhes->>'retencao_em')::timestamptz,
    'IDs distinguem episódios com o mesmo now() na transação';
  assert anterior.detalhes->>'retencao_motivo'='Ofício sintético', 'prova anterior preservada';
end $$;
select x->>'retencao_id' as retencao3 from jsonb_array_elements(compliance_fila_retencoes(:'consulta')) x where x->>'id'='26000000-0000-4000-b000-000000000003' \gset
select compliance_liberar_retencao(:'consulta','anuncio','26000000-0000-4000-b000-000000000003','Novo ofício encerrado',:'retencao3') as evento_novo \gset
do $$ begin
  begin
    perform compliance_liberar_retencao(current_setting('c26.consulta')::uuid,'anuncio',
      '26000000-0000-4000-b000-000000000003','Confirmação antiga',
      (select detalhes->>'retencao_id' from admin_gestao_eventos where acao='compliance_liberar_retencao'
        and detalhes->>'item'='26000000-0000-4000-b000-000000000003' and motivo='Ofício encerrado'));
    raise exception 'Confirmação de outro episódio foi aceita';
  exception when sqlstate '55000' then null; end;
end $$;
select compliance_liberar_retencao(:'consulta','anuncio','26000000-0000-4000-b000-000000000003','Retry novo episódio',:'retencao3')=:'evento_novo'::uuid as novo_retry_ok \gset
\if :novo_retry_ok
\else
  \quit 1
\endif
reset role;
insert into radar_pedidos(id,comprador_id,microrregiao_id,categoria_id,titulo,cidade,status,arquivado_em)
values ('26000000-0000-4000-c000-000000000001','user_c26dono',:'reg',:'cat','Pedido sintético C26','Corrente','congelado',now());
insert into radar_propostas(id,pedido_id,vitrine_id,anuncio_id,foto_url,escolhida)
values ('26000000-0000-4000-d000-000000000001','26000000-0000-4000-c000-000000000001','26000000-0000-4000-a000-000000000001',
'26000000-0000-4000-b000-000000000003','https://synthetic.invalid/proposta-c26.webp',true);
select public.compliance_retencao_atual('pedido','26000000-0000-4000-c000-000000000001')->>'retencao_id' as retencao4 \gset
create function pg_temp.recusa_c26(comando text,codigo text) returns void language plpgsql as $$
begin execute comando; raise exception 'Operação indevidamente permitida';
exception when others then if sqlstate<>codigo then raise; end if; end $$;
set local role authenticated;
select compliance_liberar_retencao(:'consulta','pedido','26000000-0000-4000-c000-000000000001','Ofício Radar encerrado',:'retencao4');
select compliance_revisar_retencao(:'consulta','pedido','26000000-0000-4000-c000-000000000001','Destino ainda pendente',:'retencao4') as revisao \gset
select compliance_revisar_retencao(:'consulta','pedido','26000000-0000-4000-c000-000000000001','Destino ainda pendente',:'retencao4')=:'revisao'::uuid as revisao_ok \gset
\if :revisao_ok
\else
  \quit 1
\endif
select set_config('c26.consulta',:'consulta',true);
do $$ begin
  assert jsonb_array_length(compliance_fila_retencoes(current_setting('c26.consulta')::uuid))=4;
  assert compliance_fila_retencoes(current_setting('c26.consulta')::uuid) @> '[{"estado":"revisao_manual_pendente","tipo":"pedido"}]';
end $$;
select compliance_revisar_retencao(:'consulta','pedido','26000000-0000-4000-c000-000000000001','Segunda revisão sintética',:'retencao4') as revisao_ultima \gset
select set_config('c26.revisao_ultima',:'revisao_ultima',true);
do $$ declare e public.admin_gestao_eventos; r public.admin_gestao_eventos; fila jsonb; ped jsonb; begin
  select * into e from admin_gestao_eventos where id=current_setting('c26.evento')::uuid;
  select * into r from admin_gestao_eventos where id=current_setting('c26.revisao_ultima')::uuid;
  assert e.motivo='Ofício encerrado' and e.autor='user_c26admin';
  assert e.criado_em>=transaction_timestamp() and e.criado_em<=clock_timestamp();
  assert (e.detalhes->>'retencao_em')::timestamptz<=e.criado_em;
  select x into fila from jsonb_array_elements(compliance_fila_retencoes(current_setting('c26.consulta')::uuid)) x
    where x->>'id'='26000000-0000-4000-b000-000000000001';
  assert fila->>'motivo'='Ofício encerrado' and (fila->>'criado_em')::timestamptz=e.criado_em;
  select x into ped from jsonb_array_elements(compliance_fila_retencoes(current_setting('c26.consulta')::uuid)) x where x->>'tipo'='pedido';
  assert ped->'ultima_revisao'->>'motivo'='Segunda revisão sintética';
  assert ped->'ultima_revisao'->>'autor'='user_c26admin';
  assert (ped->'ultima_revisao'->>'criado_em')::timestamptz=r.criado_em;
end $$;
select pg_temp.recusa_c26(format('select compliance_liberar_retencao(%L,%L,%L,%L,%L)',:'consulta','anuncio','26000000-0000-4000-b000-000000000001',' ',:'retencao1'),'22023');
set local request.jwt.claim.sub='user_c26dono';
select pg_temp.recusa_c26(format('select compliance_liberar_retencao(%L,%L,%L,%L,%L)',:'consulta','anuncio','26000000-0000-4000-b000-000000000001','Motivo válido',:'retencao1'),'42501');
select pg_temp.recusa_c26(format('select compliance_fila_retencoes(%L)',:'consulta'),'42501');
reset role;
set local request.jwt.claim.sub='user_c26admin';
do $$ begin
  assert (select count(*)=5 from admin_gestao_eventos where acao='compliance_liberar_retencao' and autor='user_c26admin');
  assert exists(select 1 from admin_gestao_eventos e join logs_atividade l on l.id=(e.detalhes->>'retencao_id')::bigint
    where e.id=current_setting('c26.evento')::uuid and l.criado_em=(e.detalhes->>'retencao_em')::timestamptz);
  assert (select status='excluido' and excluido_em < now()-interval '30 days' from anuncios where id='26000000-0000-4000-b000-000000000001');
  assert (select status='congelado' and congelado_motivo='Novo ofício sintético' from anuncios where id='26000000-0000-4000-b000-000000000003');
  assert purgar_anuncio('26000000-0000-4000-b000-000000000001')='{}'::text[];
  assert not (limpeza_pendente()->'anuncios' @> '["26000000-0000-4000-b000-000000000001"]');
  assert urls_sem_uso(array['https://synthetic.invalid/c26.webp'])='{}'::text[];
  assert urls_sem_uso(array['https://synthetic.invalid/proposta-c26.webp'])='{}'::text[];
  assert (select escolhida and anuncio_id is not null from radar_propostas where id='26000000-0000-4000-d000-000000000001');
  assert (select status='congelado' and arquivado_em is not null from radar_pedidos where id='26000000-0000-4000-c000-000000000001');
  assert exists(select 1 from logs_atividade where tabela='anuncios' and registro_id='26000000-0000-4000-b000-000000000001');
  perform pg_temp.recusa_c26($q$delete from radar_pedidos where id='26000000-0000-4000-c000-000000000001'$q$,'55000');
  perform pg_temp.recusa_c26($q$delete from radar_propostas where id='26000000-0000-4000-d000-000000000001'$q$,'55000');
  perform pg_temp.recusa_c26($q$update radar_propostas set anuncio_id=null where id='26000000-0000-4000-d000-000000000001'$q$,'55000');
  begin
    update anuncios set status='pausado',congelado_motivo=null where id='26000000-0000-4000-b000-000000000001';
    raise exception 'Revisão pendente foi removida';
  exception when sqlstate '55000' then null; end;
end $$;
set local request.jwt.claim.sub='';
set local role anon;
do $$ begin
  assert not exists(select 1 from anuncios where id in
    ('26000000-0000-4000-b000-000000000001','26000000-0000-4000-b000-000000000002'));
  assert not exists(select 1 from radar_pedidos where id='26000000-0000-4000-c000-000000000001');
  assert not has_function_privilege('anon','public.compliance_liberar_retencao(uuid,text,uuid,text,text)','execute');
end $$;
reset role;
rollback;
do $$ begin assert not exists(select 1 from admin_gestao_eventos where autor='user_c26admin'); end $$;
