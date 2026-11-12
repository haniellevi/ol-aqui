\set ON_ERROR_STOP on
\set QUIET on
-- Radar v2: lembrete 2 dias antes do vencimento e "Ainda preciso" (até 2 vezes). Fixtures descartáveis.
begin;
reset role;
set local request.jwt.claim.role='';
set local request.jwt.claim.sub='';

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
insert into perfis(id,microrregiao_id,nome,whatsapp,whatsapp_verificado_em) values
  ('user_prazo630',:'regiao','Compradora 630','5589999990630',now()),
  ('user_outra630',:'regiao','Outra pessoa 630','5589999990631',now());

insert into radar_pedidos(id,comprador_id,microrregiao_id,titulo,cidade,modo_contato,propostas_ate) values
  ('63000000-0000-4000-a000-000000000001','user_prazo630',:'regiao','Procuro sofá 630','Corrente','whatsapp_direto',null),
  ('63000000-0000-4000-a000-000000000002','user_prazo630',:'regiao','Procuro mesa 630','Corrente','whatsapp_direto',null),
  ('63000000-0000-4000-a000-000000000003','user_prazo630',:'regiao','Procuro cadeira 630','Corrente','whatsapp_direto',null),
  ('63000000-0000-4000-a000-000000000004','user_prazo630',:'regiao','Procuro cama 630','Corrente','propostas_prazo',now()+interval '3 days'),
  ('63000000-0000-4000-a000-000000000005','user_prazo630',:'regiao','Procuro rack 630','Corrente','whatsapp_direto',null);
-- datas montadas à mão (o gatilho de criação sempre põe hoje + 15 dias)
update radar_pedidos set expira_em=now()+interval '1 day'  where id='63000000-0000-4000-a000-000000000001';
update radar_pedidos set expira_em=now()+interval '1 day', status='atendido' where id='63000000-0000-4000-a000-000000000002';
update radar_pedidos set expira_em=now()-interval '1 hour' where id='63000000-0000-4000-a000-000000000003';
update radar_pedidos set expira_em=now()+interval '1 day', propostas_ate=now()+interval '12 hours' where id='63000000-0000-4000-a000-000000000004';
-- 5 fica com 15 dias: longe do vencimento

select pg_temp.confere((select valor='2'::jsonb from configuracoes where chave='radar.extensoes_max' and microrregiao_id is null),'Config extensoes_max');
select pg_temp.confere((select valor='2'::jsonb from configuracoes where chave='radar.lembrete_dias' and microrregiao_id is null),'Config lembrete_dias');
select pg_temp.confere((select valor ? 'vai_vencer' from configuracoes where chave='radar.avisos_ligados' and microrregiao_id is null),'Aviso ligado');
select pg_temp.confere((select valor ? 'vai_vencer' from configuracoes where chave='radar.avisos_escolha' and microrregiao_id is null),'Aviso na escolha');

-- permissões da rotina: só service_role
set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='user_prazo630';
select pg_temp.recusa($q$select radar_lembrar_vencimento()$q$, '42501');
reset role;
set local request.jwt.claim.role='';
set local request.jwt.claim.sub='';

-- lembrete: avisa só o pedido aberto que vence em até 2 dias
select pg_temp.confere(radar_lembrar_vencimento() >= 2, 'Avisa ao menos os dois pedidos abertos que vencem em 1 dia (1 e 4)');
select pg_temp.confere((select count(*)=1 from notificacoes where usuario_id='user_prazo630' and tipo='vai_vencer'
  and chave='vai_vencer:63000000-0000-4000-a000-000000000001:0' and link='/radar/pedido/63000000-0000-4000-a000-000000000001'
  and titulo='Seu pedido vence em 2 dias' and texto like '%Procuro sofá 630%'),'Notificação do pedido 1');
select pg_temp.confere((select count(*)=2 from notificacoes where usuario_id='user_prazo630' and tipo='vai_vencer'),'Sem aviso para atendido, vencido e distante');
select pg_temp.confere((select lembrete_em is not null from radar_pedidos where id='63000000-0000-4000-a000-000000000001'),'Grava lembrete_em');
select radar_lembrar_vencimento();
select pg_temp.confere((select count(*)=2 from notificacoes where usuario_id='user_prazo630' and tipo='vai_vencer'),'Segunda rodada não repete aviso desta compradora');

-- Ainda preciso: permissões e recusas
set local role anon;
select pg_temp.recusa($q$select estender_pedido_radar('63000000-0000-4000-a000-000000000001')$q$, '42501');
set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='user_outra630';
select pg_temp.recusa($q$select estender_pedido_radar('63000000-0000-4000-a000-000000000001')$q$, '42501');
set local request.jwt.claim.sub='user_prazo630';
select pg_temp.recusa($q$select estender_pedido_radar('63000000-0000-4000-a000-000000000002')$q$, 'P0002');  -- atendido
select pg_temp.recusa($q$select estender_pedido_radar('63000000-0000-4000-a000-000000000003')$q$, 'P0002');  -- vencido
select pg_temp.recusa($q$select estender_pedido_radar('63000000-0000-4000-a000-0000000000ff')$q$, 'P0002');  -- não existe

-- tela: pode_estender só quando falta pouco
select pg_temp.confere((select pode_estender and extensoes=0 from radar_pedido('63000000-0000-4000-a000-000000000001')),'radar_pedido: pode estender');
select pg_temp.confere((select not pode_estender from radar_pedido('63000000-0000-4000-a000-000000000005')),'radar_pedido: longe do prazo não mostra');
select pg_temp.confere((select not pode_estender from radar_pedido('63000000-0000-4000-a000-000000000002')),'radar_pedido: atendido não mostra');
select pg_temp.confere((select pode_estender from meus_pedidos_radar(false) where id='63000000-0000-4000-a000-000000000001'),'lista: pode estender');
select pg_temp.confere((select not pode_estender from meus_pedidos_radar(false) where id='63000000-0000-4000-a000-000000000005'),'lista: longe do prazo');
select pg_temp.confere((select not pode_estender and extensoes=0 from meus_pedidos_radar(false) where id='63000000-0000-4000-a000-000000000003'),'lista: vencido');
set local request.jwt.claim.sub='user_outra630';
select pg_temp.confere((select not pode_estender from radar_pedido('63000000-0000-4000-a000-000000000001')),'radar_pedido: outra pessoa não estende');
set local request.jwt.claim.sub='user_prazo630';

-- estender 1
select expira_em as antes from radar_pedidos where id='63000000-0000-4000-a000-000000000001' \gset
select estender_pedido_radar('63000000-0000-4000-a000-000000000001') as depois \gset
select pg_temp.confere(:'depois'::timestamptz = :'antes'::timestamptz + interval '15 days','Soma 15 dias à expira_em');
select pg_temp.confere((select expira_em=:'depois'::timestamptz and extensoes=1 and lembrete_em is null
  from radar_pedidos where id='63000000-0000-4000-a000-000000000001'),'Grava expira_em, extensoes e zera lembrete');
select pg_temp.confere((select not pode_estender and extensoes=1 from radar_pedido('63000000-0000-4000-a000-000000000001')),'Depois de estender, longe do prazo');

-- modo propostas_prazo estende o prazo das propostas também
select propostas_ate as pa_antes from radar_pedidos where id='63000000-0000-4000-a000-000000000004' \gset
select estender_pedido_radar('63000000-0000-4000-a000-000000000004');
select pg_temp.confere((select propostas_ate=:'pa_antes'::timestamptz + interval '15 days' from radar_pedidos where id='63000000-0000-4000-a000-000000000004'),'Estende propostas_ate');

-- o gatilho de proteção continua valendo para edição direta
update radar_pedidos set expira_em=now()+interval '300 days' where id='63000000-0000-4000-a000-000000000001';
select pg_temp.confere((select expira_em=:'depois'::timestamptz from radar_pedidos where id='63000000-0000-4000-a000-000000000001'),'Edição direta de expira_em segue bloqueada');
update radar_pedidos set extensoes=0, lembrete_em=now() where id='63000000-0000-4000-a000-000000000001';
select pg_temp.confere((select extensoes=1 and lembrete_em is null from radar_pedidos where id='63000000-0000-4000-a000-000000000001'),'Edição direta de extensoes e lembrete_em bloqueadas');

-- lembrete volta a ser possível depois de estender (chave com outro número)
reset role;
set local request.jwt.claim.role='';
set local request.jwt.claim.sub='';
update radar_pedidos set expira_em=now()+interval '1 day' where id='63000000-0000-4000-a000-000000000001';
select pg_temp.confere(radar_lembrar_vencimento() >= 1, 'Novo lembrete depois de estender');
select pg_temp.confere((select count(*)=1 from notificacoes where chave='vai_vencer:63000000-0000-4000-a000-000000000001:1'),'Chave com extensoes=1');

-- estender 2 e 3
set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='user_prazo630';
select estender_pedido_radar('63000000-0000-4000-a000-000000000001');
select pg_temp.confere((select extensoes=2 from radar_pedidos where id='63000000-0000-4000-a000-000000000001'),'Segunda extensão');
select pg_temp.recusa($q$select estender_pedido_radar('63000000-0000-4000-a000-000000000001')$q$, 'P0001');
select pg_temp.confere((select extensoes=2 from radar_pedidos where id='63000000-0000-4000-a000-000000000001'),'Terceira não muda nada');
reset role;
update radar_pedidos set expira_em=now()+interval '1 day' where id='63000000-0000-4000-a000-000000000001';
set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='user_prazo630';
select pg_temp.confere((select not pode_estender and extensoes=2 from radar_pedido('63000000-0000-4000-a000-000000000001')),'No limite não mostra o botão');
select pg_temp.confere((select not pode_estender and extensoes=2 from meus_pedidos_radar(false) where id='63000000-0000-4000-a000-000000000001'),'Lista no limite não mostra o botão');

-- no limite de extensões o lembrete manda pedir de novo, sem falar em Ainda preciso
reset role;
set local request.jwt.claim.role='';
set local request.jwt.claim.sub='';
select pg_temp.confere(radar_lembrar_vencimento() >= 1, 'Lembrete no limite de extensões');
select pg_temp.confere((select count(*)=1 from notificacoes where usuario_id='user_prazo630' and chave='vai_vencer:63000000-0000-4000-a000-000000000001:2'
  and texto like '%Pedir de novo%' and texto not like '%Ainda preciso%' and texto like '%Procuro sofá 630%'
  and texto like '%sai do ar em 2 dias%'),'Texto do último lembrete manda Pedir de novo');
rollback;
