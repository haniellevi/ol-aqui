\set ON_ERROR_STOP on
\set QUIET on
-- Cortesia de lançamento: 30 dias de Radar só para quem paga e ainda não tem selo; não duplica;
-- vale durante e deixa de valer depois do prazo; aviso de fim de prazo 1 vez e permissões.
begin;

create function pg_temp.confere(ok boolean, caso text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FALHOU: %', caso; end if;
end $$;

select id as regiao from microrregioes where slug='corrente-pi' \gset

insert into perfis(id,microrregiao_id,nome,whatsapp,whatsapp_verificado_em,tipo_pessoa,e_admin) values
  ('user_q770lsem',:'regiao','Loja paga sem selo 770','5589999770001',now(),'pj',false),
  ('user_q770lcom',:'regiao','Loja paga com selo 770','5589999770002',now(),'pj',false),
  ('user_q770pfsem',:'regiao','PF paga sem selo 770','5589999770003',now(),'pf',false),
  ('user_q770teste',:'regiao','Loja em teste 770','5589999770004',now(),'pj',false),
  ('user_q770pfgr',:'regiao','PF grátis 770','5589999770005',now(),'pf',false),
  ('user_q770susp',:'regiao','Loja suspensa 770','5589999770006',now(),'pj',false);

insert into vitrines_lojas(dono_id,microrregiao_id,slug,nome,cidade,tipo,plano,plano_expira_em,teste_expira_em,status) values
  ('user_q770lsem',:'regiao','q770-lsem','Loja paga sem selo 770','Corrente','loja','slim',now()+interval '10 days',now()-interval '1 day','ativa'),
  ('user_q770lcom',:'regiao','q770-lcom','Loja paga com selo 770','Corrente','loja','full',now()+interval '10 days',now()-interval '1 day','ativa'),
  ('user_q770pfsem',:'regiao','q770-pfsem','PF paga sem selo 770','Corrente','pf','slim',now()+interval '10 days',now()-interval '1 day','ativa'),
  ('user_q770teste',:'regiao','q770-teste','Loja em teste 770','Corrente','loja','teste',null,now()+interval '10 days','ativa'),
  ('user_q770pfgr',:'regiao','q770-pfgr','PF grátis 770','Corrente','pf','pf_gratis',null,now()-interval '1 day','ativa'),
  ('user_q770susp',:'regiao','q770-susp','Loja suspensa 770','Corrente','loja','slim',now()+interval '10 days',now()-interval '1 day','suspensa');

update vitrines_lojas set verificacao_estado='aprovada', selo_loja_verificada=true where slug='q770-lcom';

-- antes: ninguém atende sem selo
select pg_temp.confere(not pode_atender_radar('user_q770lsem') and not pode_atender_radar('user_q770pfsem'), 'antes da cortesia, sem selo não atende');

-- 1ª rodada
select pg_temp.confere(cortesia_lancamento_conceder() = 2, 'concede exatamente 2 cortesias');
select pg_temp.confere((select count(*) = 2 from radar_cortesias where vitrine_id in (select id from vitrines_lojas where slug like 'q770-%')),
  'só 2 linhas de cortesia nas vitrines do teste');
select pg_temp.confere(exists (select 1 from radar_cortesias c join vitrines_lojas v on v.id=c.vitrine_id
    where v.slug='q770-lsem' and c.criado_por='sistema' and c.motivo='Cortesia de lançamento: verifique sua loja em 30 dias'
      and c.ate between now()+interval '29 days 23 hours' and now()+interval '30 days 1 hour'), 'loja paga sem selo ganha 30 dias');
select pg_temp.confere(exists (select 1 from radar_cortesias c join vitrines_lojas v on v.id=c.vitrine_id where v.slug='q770-pfsem'), 'PF paga sem selo ganha');
select pg_temp.confere(not exists (select 1 from radar_cortesias c join vitrines_lojas v on v.id=c.vitrine_id
    where v.slug in ('q770-lcom','q770-teste','q770-pfgr','q770-susp')), 'com selo, teste, grátis e suspensa não ganham');
select pg_temp.confere((select count(*) = 2 from notificacoes where usuario_id in ('user_q770lsem','user_q770pfsem') and tipo='cortesia_lancamento'
    and texto='Você tem 30 dias de Radar de cortesia. Verifique sua loja para continuar.'), 'os 2 donos são avisados com o texto combinado');
select pg_temp.confere(not exists (select 1 from notificacoes where usuario_id in ('user_q770lcom','user_q770teste','user_q770pfgr','user_q770susp') and tipo='cortesia_lancamento'), 'ninguém mais é avisado');
select pg_temp.confere((select count(*) = 2 from logs_atividade where tabela='radar_cortesias' and acao='INSERT'
    and registro_id in (select id::text from vitrines_lojas where slug in ('q770-lsem','q770-pfsem'))), 'duas linhas no registro de atividade');
select pg_temp.confere(pode_atender_radar('user_q770lsem') and pode_atender_radar('user_q770pfsem'), 'durante a cortesia atende');
select pg_temp.confere(pode_atender_radar('user_q770lcom'), 'loja com selo segue atendendo normalmente');

-- 2ª rodada não duplica nada
select pg_temp.confere(cortesia_lancamento_conceder() = 0, 'rodar de novo não concede');
select pg_temp.confere((select count(*) = 2 from radar_cortesias where vitrine_id in (select id from vitrines_lojas where slug like 'q770-%')), 'continua com 2 linhas');
select pg_temp.confere((select count(*) = 2 from notificacoes where tipo='cortesia_lancamento' and usuario_id like 'user_q770%'), 'continua com 2 avisos');
select pg_temp.confere((select count(*) = 2 from logs_atividade where tabela='radar_cortesias' and acao='INSERT'
    and registro_id in (select id::text from vitrines_lojas where slug in ('q770-lsem','q770-pfsem'))), 'continua com 2 registros de atividade');

-- aviso de fim: ainda faltam 30 dias, não avisa
select pg_temp.confere(verificacao_cortesia_avisar_fim() = 0, 'faltando 30 dias não avisa');
-- no 7º dia avisa uma vez
update radar_cortesias set ate = now() + interval '7 days'
 where vitrine_id in (select id from vitrines_lojas where slug in ('q770-lsem','q770-pfsem'));
select pg_temp.confere(verificacao_cortesia_avisar_fim() = 2, 'no 7º dia avisa os 2');
select pg_temp.confere(verificacao_cortesia_avisar_fim() = 0, 'não repete');
select pg_temp.confere((select count(*) = 2 from notificacoes where tipo='cortesia_fim' and usuario_id like 'user_q770%'), 'dois avisos de fim, um para cada');
-- quem já tem selo não recebe aviso de fim
update vitrines_lojas set verificacao_estado='aprovada', selo_loja_verificada=true where slug='q770-lsem';
update radar_cortesias set ate = now() + interval '3 days' where vitrine_id = (select id from vitrines_lojas where slug='q770-lsem');
delete from notificacoes where tipo='cortesia_fim' and usuario_id='user_q770lsem';
select pg_temp.confere(verificacao_cortesia_avisar_fim() = 0, 'com selo não avisa o fim');

-- depois do prazo deixa de valer
update radar_cortesias set ate = now() - interval '1 minute'
 where vitrine_id = (select id from vitrines_lojas where slug='q770-pfsem');
select pg_temp.confere(not pode_atender_radar('user_q770pfsem'), 'depois do prazo não atende');

-- permissões: só o dono do banco roda; nem a API nem o servidor
set local role authenticated;
do $$ declare ok boolean := false; begin
  begin perform cortesia_lancamento_conceder(); exception when sqlstate '42501' then ok := true; end;
  assert ok, 'authenticated não concede cortesia';
  ok := false;
  begin perform verificacao_cortesia_avisar_fim(); exception when sqlstate '42501' then ok := true; end;
  assert ok, 'authenticated não roda o aviso de fim';
end $$;
reset role;
do $$ begin
  assert not has_function_privilege('anon','cortesia_lancamento_conceder()','execute'), 'anon';
  assert not has_function_privilege('service_role','cortesia_lancamento_conceder()','execute'), 'service_role não concede';
  assert has_function_privilege('service_role','verificacao_cortesia_avisar_fim()','execute'), 'service_role roda o aviso de fim';
  assert not has_function_privilege('anon','verificacao_cortesia_avisar_fim()','execute'), 'anon';
end $$;
rollback;
