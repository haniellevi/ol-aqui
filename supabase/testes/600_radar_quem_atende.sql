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

insert into perfis(id,microrregiao_id,nome,whatsapp,whatsapp_verificado_em,tipo_pessoa,e_admin) values
  ('user_q600adm',:'regiao','Admin 600','5589999960000',now(),'pf',true),
  ('user_q600full',:'regiao','Loja Full 600','5589999960001',now(),'pj',false),
  ('user_q600slim',:'regiao','Loja Slim 600','5589999960002',now(),'pj',false),
  ('user_q600naover',:'regiao','Loja sem selo 600','5589999960003',now(),'pj',false),
  ('user_q600teste',:'regiao','Loja teste 600','5589999960004',now(),'pj',false),
  ('user_q600pf',:'regiao','PF verificada 600','5589999960005',now(),'pf',false),
  ('user_q600pfsem',:'regiao','PF sem data 600','5589999960006',now(),'pf',false),
  ('user_q600cort',:'regiao','Loja cortesia 600','5589999960007',now(),'pj',false);

insert into vitrines_lojas(dono_id,microrregiao_id,slug,nome,cidade,tipo,plano,plano_expira_em,teste_expira_em) values
  ('user_q600full',:'regiao','q600-full','Loja Full 600','Corrente','loja','full',now()+interval '10 days',now()-interval '1 day'),
  ('user_q600slim',:'regiao','q600-slim','Loja Slim 600','Corrente','loja','slim',now()+interval '10 days',now()-interval '1 day'),
  ('user_q600naover',:'regiao','q600-naover','Loja sem selo 600','Corrente','loja','full',now()+interval '10 days',now()-interval '1 day'),
  ('user_q600teste',:'regiao','q600-teste','Loja teste 600','Corrente','loja','teste',null,now()+interval '10 days'),
  ('user_q600pf',:'regiao','q600-pf','PF 600','Corrente','pf','slim',now()+interval '10 days',now()-interval '1 day'),
  ('user_q600pfsem',:'regiao','q600-pfsem','PF sem data 600','Corrente','pf','slim',now()+interval '10 days',now()-interval '1 day'),
  ('user_q600cort',:'regiao','q600-cort','Loja cortesia 600','Corrente','loja','slim',now()-interval '1 day',now()-interval '1 day');

-- selos dados pela equipe (postgres passa pelos gatilhos de proteção)
update vitrines_lojas set verificacao_estado='aprovada', selo_loja_verificada=true
 where slug in ('q600-full','q600-slim','q600-teste');
update perfis set selo_negociador_certificado=true, verificacao_pf_em=now() where id='user_q600pf';
update perfis set selo_negociador_certificado=true where id='user_q600pfsem';

select v.id as vit_cort from vitrines_lojas v where v.slug='q600-cort' \gset
select v.id as vit_full from vitrines_lojas v where v.slug='q600-full' \gset

set local role authenticated;
set local request.jwt.claim.role='authenticated';

select pg_temp.confere(pode_atender_radar('user_q600full') and recebe_aviso_radar_na_hora('user_q600full'),'Loja verificada + Full atende e recebe aviso na hora');
select pg_temp.confere(pode_atender_radar('user_q600slim') and not recebe_aviso_radar_na_hora('user_q600slim'),'Loja verificada + Slim atende mas sem aviso na hora');
select pg_temp.confere(not pode_atender_radar('user_q600naover') and not recebe_aviso_radar_na_hora('user_q600naover'),'Loja sem selo não atende, mesmo com Full');
select pg_temp.confere(not pode_atender_radar('user_q600teste'),'Loja verificada em teste não atende');
select pg_temp.confere(pode_atender_radar('user_q600pf') and not recebe_aviso_radar_na_hora('user_q600pf'),'PF verificada + Slim atende');
select pg_temp.confere(not pode_atender_radar('user_q600pfsem'),'PF sem verificacao_pf_em não atende');
select pg_temp.confere(not pode_atender_radar('user_q600inexistente'),'Quem não tem loja não atende');

set local request.jwt.claim.sub='user_q600naover';
select pg_temp.confere(not tem_plano_pago(),'tem_plano_pago segue pode_atender_radar');
select pg_temp.recusa($q$select propor_radar('36000000-0000-4000-a000-000000000001',null,null,100,'Oi')$q$,'42501');
set local request.jwt.claim.sub='user_q600full';
select pg_temp.confere(tem_plano_pago(),'tem_plano_pago true para verificada + paga');

-- cortesia
set local request.jwt.claim.sub='user_q600cort';
select pg_temp.confere(not pode_atender_radar() and propostas_restantes() = 0,'Antes da cortesia: sem plano pago não atende');
select pg_temp.recusa(format($q$select dar_cortesia_radar(%L, current_date + 5, 'Motivo válido')$q$, :'vit_cort'),'42501');

set local request.jwt.claim.sub='user_q600adm';
select pg_temp.recusa(format($q$select dar_cortesia_radar(%L, (now() at time zone 'America/Fortaleza')::date - 1, 'Motivo válido')$q$, :'vit_cort'),'23514');
select pg_temp.recusa(format($q$select dar_cortesia_radar(%L, (now() at time zone 'America/Fortaleza')::date + 400, 'Motivo válido')$q$, :'vit_cort'),'23514');
select pg_temp.recusa(format($q$select dar_cortesia_radar(%L, (now() at time zone 'America/Fortaleza')::date + 5, 'ab')$q$, :'vit_cort'),'23514');
select dar_cortesia_radar(:'vit_cort', (now() at time zone 'America/Fortaleza')::date + 1, 'Parceira do lançamento');

set local request.jwt.claim.sub='user_q600cort';
select pg_temp.confere(pode_atender_radar() and recebe_aviso_radar_na_hora('user_q600cort'),'Cortesia ativa atende e recebe aviso');
select pg_temp.confere(propostas_restantes() is null,'Cortesia ativa = propostas ilimitadas');

reset role;
select pg_temp.confere((select ate = (((now() at time zone 'America/Fortaleza')::date + 2)::timestamp at time zone 'America/Fortaleza') - interval '1 microsecond'
  from radar_cortesias where vitrine_id=:'vit_cort'),'ate grava o fim do dia em Fortaleza');
select pg_temp.confere((select count(*)=1 from logs_atividade where tabela='radar_cortesias' and registro_id=:'vit_cort' and usuario_id='user_q600adm'),'Concessão registrada no log');
update radar_cortesias set ate = now() - interval '1 day' where vitrine_id=:'vit_cort';
select pg_temp.confere(not radar_cortesia_ativa(:'vit_cort'),'Cortesia vencida não vale');
select pg_temp.confere(not pode_atender_radar('user_q600cort') and not recebe_aviso_radar_na_hora('user_q600cort'),'Cortesia vencida: não atende, sem aviso');
update radar_cortesias set ate = now() + interval '1 day' where vitrine_id=:'vit_cort';
select pg_temp.confere(pode_atender_radar('user_q600cort'),'Cortesia renovada volta a valer');

set local role authenticated;
set local request.jwt.claim.sub='user_q600cort';
select pg_temp.recusa(format($q$select tirar_cortesia_radar(%L)$q$, :'vit_cort'),'42501');
select pg_temp.recusa($q$select * from radar_cortesias$q$,'42501');
set local request.jwt.claim.sub='user_q600adm';
select tirar_cortesia_radar(:'vit_cort');
select pg_temp.confere(not pode_atender_radar('user_q600cort'),'Sem cortesia volta a não atender');
reset role;
select pg_temp.confere((select count(*)=1 from logs_atividade where tabela='radar_cortesias' and registro_id=:'vit_cort' and acao='DELETE'),'Retirada registrada no log');

rollback;
