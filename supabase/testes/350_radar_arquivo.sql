\set ON_ERROR_STOP on
\set QUIET on
begin;

create function pg_temp.confere(ok boolean, caso text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FALHOU: %', caso; end if;
end $$;
create function pg_temp.recusa(comando text, codigo text) returns void language plpgsql as $$
begin
  begin execute comando;
  exception when others then
    if sqlstate = codigo then return; end if;
    raise exception 'Estado inesperado: %, esperado %: %', sqlstate, codigo, sqlerrm;
  end;
  raise exception 'Comando aceito indevidamente: %', comando;
end $$;

select id as regiao from microrregioes where slug='corrente-pi' \gset
insert into perfis(id,microrregiao_id,nome,whatsapp,whatsapp_verificado_em)
values ('user_arquivo350',:'regiao','Compradora de teste','5589999990350',now());

insert into radar_pedidos(id,comprador_id,microrregiao_id,titulo,cidade,status,fechado_motivo,fechado_em)
values
  ('35000000-0000-4000-a000-000000000001','user_arquivo350',:'regiao','Procuro mesa para escritório','Corrente','aberto',null,null),
  ('35000000-0000-4000-a000-000000000002','user_arquivo350',:'regiao','Procuro cadeira já encontrada','Corrente','atendido','resolvido',now()),
  ('35000000-0000-4000-a000-000000000003','user_arquivo350',:'regiao','Pedido em análise da equipe','Corrente','em_analise',null,null),
  ('35000000-0000-4000-a000-000000000004','user_arquivo350',:'regiao','Pedido congelado pela equipe','Corrente','congelado',null,null),
  ('35000000-0000-4000-a000-000000000005','user_arquivo350',:'regiao','Pedido cancelado antes do arquivo','Corrente','encerrado','cancelado',now());

set local role anon;
select pg_temp.recusa($q$select arquivar_pedido_radar('35000000-0000-4000-a000-000000000001',true)$q$, '42501');
set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='user_loja';
select pg_temp.recusa($q$select arquivar_pedido_radar('35000000-0000-4000-a000-000000000001',true)$q$, '42501');
select proposta_id as oferta
  from propor_radar('35000000-0000-4000-a000-000000000001', null, null, 150000, 'Tenho disponível') \gset

set local request.jwt.claim.sub='user_arquivo350';
update radar_pedidos set arquivado_em=now() where id='35000000-0000-4000-a000-000000000001';
select pg_temp.confere(not radar_pedido_esta_arquivado('35000000-0000-4000-a000-000000000001'),'Edição direta não arquiva');
select pg_temp.confere(arquivar_pedido_radar('35000000-0000-4000-a000-000000000001',true),'Dono arquiva o pedido aberto');
select pg_temp.confere(arquivar_pedido_radar('35000000-0000-4000-a000-000000000001',true),'Arquivar é idempotente');
select pg_temp.confere(radar_pedido_esta_arquivado('35000000-0000-4000-a000-000000000001'),'Marcador pessoal de arquivo');
select pg_temp.confere((select status='encerrado' and fechado_motivo='arquivado' and fechado_em is not null
  from radar_pedidos where id='35000000-0000-4000-a000-000000000001'),'Arquivar fecha sem contar como resolvido');
select pg_temp.confere((select count(*)=1 from meus_pedidos_radar(true) where id='35000000-0000-4000-a000-000000000001'),'Pedido entra em Arquivados');
select pg_temp.confere((select count(*)=0 from meus_pedidos_radar(false) where id='35000000-0000-4000-a000-000000000001'),'Pedido sai da lista regular');
select pg_temp.confere((select count(*)=1 from propostas_do_pedido('35000000-0000-4000-a000-000000000001')),'Histórico de propostas preservado');
select pg_temp.confere((select whatsapp='5589999990002' from escolher_proposta(:'oferta')),'Contato já permitido permanece disponível');

set local request.jwt.claim.sub='user_loja';
select pg_temp.confere(not radar_pedido_esta_arquivado('35000000-0000-4000-a000-000000000001'),'Terceiro não vê o marcador do arquivo');
select pg_temp.confere((select count(*)=0 from radar_feed() where id='35000000-0000-4000-a000-000000000001'),'Pedido arquivado sai do feed');
select pg_temp.recusa($q$select propor_radar('35000000-0000-4000-a000-000000000001',null,null,145000,'Preço novo')$q$, 'P0002');

set local request.jwt.claim.sub='user_arquivo350';
select pg_temp.confere(not arquivar_pedido_radar('35000000-0000-4000-a000-000000000001',false),'Dono pode retirar do arquivo');
select pg_temp.confere((select status='encerrado' and fechado_motivo='arquivado' from meus_pedidos_radar(false)
  where id='35000000-0000-4000-a000-000000000001'),'Retirar do arquivo não reabre pedido');
select pg_temp.confere(arquivar_pedido_radar('35000000-0000-4000-a000-000000000002',true),'Pedido resolvido pode ser arquivado');
select pg_temp.confere((select status='atendido' and fechado_motivo='resolvido' from meus_pedidos_radar(true)
  where id='35000000-0000-4000-a000-000000000002'),'Arquivar preserva o desfecho original');
select pg_temp.recusa($q$select arquivar_pedido_radar('35000000-0000-4000-a000-000000000003',true)$q$, 'P0002');
select pg_temp.recusa($q$select arquivar_pedido_radar('35000000-0000-4000-a000-000000000004',true)$q$, 'P0002');
select pg_temp.confere(arquivar_pedido_radar('35000000-0000-4000-a000-000000000005',true),'Pedido cancelado pode ser guardado');
select pg_temp.confere((select fechado_motivo='cancelado' from meus_pedidos_radar(true)
  where id='35000000-0000-4000-a000-000000000005'),'Arquivamento não muda cancelamento');
rollback;
