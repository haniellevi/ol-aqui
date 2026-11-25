\set ON_ERROR_STOP on
begin;
-- Relógio real da função controlado só nesta transação de teste. Nunca parâmetro remoto.
do $$ begin assert to_regprocedure('public.medicao_limpar_opcionais()') is not null,
  'falta limpeza determinística das métricas opcionais'; end $$;
select id as reg from microrregioes where slug='corrente-pi' \gset
select id as cat from categorias where slug='sofas-e-poltronas' \gset
insert into perfis(id,microrregiao_id,nome,cidade) values('user_ret913',:'reg','Fictício 913','Corrente');
insert into vitrines_lojas(id,dono_id,microrregiao_id,slug,nome,cidade,tipo)
values('91300000-0000-4000-a000-000000000001','user_ret913',:'reg','ret913','Fictícia','Corrente','loja');
insert into anuncios(id,vitrine_id,microrregiao_id,categoria_id,titulo,cidade,status)
values('91300000-0000-4000-a000-000000000002','91300000-0000-4000-a000-000000000001',:'reg',:'cat','Fictício', 'Corrente','ativo');
-- Em 2031-07-01T02:59Z, Fortaleza ainda está em 30/06; 01/01 tem 180 dias.
insert into visitas(visitante,caminho,origem,criado_em,coorte,sessao) values
 ('ret913-181','/','direto','2030-12-31T12:00Z','consentida_v1',null),
 ('ret913-180','/','direto','2031-01-01T12:00Z','consentida_v1',null),
 ('ret913-179','/','direto','2031-01-02T12:00Z','consentida_v1',null),
 ('ret913-legado','/','direto','2030-01-01T12:00Z','legado','91300000-0000-4000-a000-000000000003');
insert into buscas_faixas_dia(dia,microrregiao_id,categoria_id,faixa) values
 ('2030-12-31',:'reg',:'cat','zero'),('2031-01-01',:'reg',:'cat','zero'),('2031-01-02',:'reg',:'cat','zero');
insert into eventos_anuncio(anuncio_id,tipo,criado_em)
select '91300000-0000-4000-a000-000000000002',tipo,dia::date::timestamp at time zone 'America/Fortaleza'
from (values('2030-12-30'),('2030-12-31'),('2031-01-01'),('2031-01-02')) d(dia)
cross join (values('visualizacao'),('favoritar')) t(tipo);
insert into eventos_loja(vitrine_id,tipo,criado_em)
select '91300000-0000-4000-a000-000000000001','visita',dia::date::timestamp at time zone 'America/Fortaleza'
from (values('2030-12-30'),('2030-12-31'),('2031-01-01'),('2031-01-02')) d(dia);
insert into anuncios_aparicoes_dia(anuncio_id,dia,pagina,aparicoes,soma_posicao)
select '91300000-0000-4000-a000-000000000002',dia::date,'busca',5,15
from (values('2030-12-30'),('2030-12-31'),('2031-01-01'),('2031-01-02')) d(dia);
update anuncios_numeros_dia set aparicoes=5,soma_posicao=15,cliques_whatsapp=3,compartilhamentos=2
where anuncio_id='91300000-0000-4000-a000-000000000002';
create temporary table ret913_fatos as select to_jsonb(a) as dados from anuncios a where id='91300000-0000-4000-a000-000000000002';
insert into pagamentos(vitrine_id,microrregiao_id,tipo,valor_centavos,status,pago_em,asaas_cobranca_id)
values('91300000-0000-4000-a000-000000000001',:'reg','anuncio_avulso',100,'pago','2030-01-01T12:00Z','pay_sintetico913');
insert into admin_gestao_eventos(tipo,alvo,autor,acao,motivo,criado_em)
values('loja','91300000-0000-4000-a000-000000000001','user_ret913','fixture913','Prova sintética preservada','2030-01-01T12:00Z');
create temporary table ret913_provas as select jsonb_build_object(
 'pagamento',(select to_jsonb(p) from pagamentos p where asaas_cobranca_id='pay_sintetico913'),
 'prova',(select to_jsonb(e) from admin_gestao_eventos e where acao='fixture913')) as dados;
do $$ declare d text; begin
  d:=pg_get_functiondef('public.medicao_limpar_opcionais()'::regprocedure);
  execute replace(d,'now()', '''2031-07-01T02:59:59Z''::timestamptz');
end $$;
update metricas_marcos set inicio='2030-12-01T12:00Z',aplicacao_inicio=null,aplicacao_fim=null where codigo='consentida_v1';
select public.medicao_limpar_opcionais();
do $$ begin
 assert not exists(select 1 from visitas where visitante='ret913-181'), '181 sai mesmo sem rollout: coorte explícita';
 assert (select count(*)=3 from visitas where visitante like 'ret913-%'), '179/180 e legado conservados';
 assert (select count(*)=2 from buscas_faixas_dia where dia between '2030-12-31' and '2031-01-02'), 'faixas 179/180 conservadas';
 assert (select count(*)=8 from eventos_anuncio where anuncio_id='91300000-0000-4000-a000-000000000002'), 'rollout nulo preserva fonte sem coorte';
end $$;
update metricas_marcos set aplicacao_inicio='2040-01-01T12:00Z',aplicacao_fim='2040-01-01T12:00Z' where codigo='consentida_v1';
select public.medicao_limpar_opcionais();
do $$ begin assert (select count(*)=8 from eventos_anuncio where anuncio_id='91300000-0000-4000-a000-000000000002'), 'rollout futuro não delimita população'; end $$;
update metricas_marcos set aplicacao_inicio='2030-12-29T12:00Z',aplicacao_fim='2030-12-30T12:00Z' where codigo='consentida_v1';
update metricas_marcos set inicio='2030-12-31T12:00Z' where codigo='consentida_v1';
select public.medicao_limpar_opcionais();
do $$ begin assert (select count(*)=8 from eventos_anuncio where anuncio_id='91300000-0000-4000-a000-000000000002'), 'maior dia entre SQL e rollout protege dia misto'; end $$;
update metricas_marcos set inicio='2030-12-01T12:00Z' where codigo='consentida_v1';
select public.medicao_limpar_opcionais();
do $$ begin
 assert (select count(*)=7 from eventos_anuncio where anuncio_id='91300000-0000-4000-a000-000000000002'), 'só evento opcional 181 removido';
 assert exists(select 1 from eventos_anuncio where anuncio_id='91300000-0000-4000-a000-000000000002' and criado_em='2030-12-30T03:00Z' and tipo='visualizacao'), 'dia misto conservado';
 assert (select count(*)=4 from eventos_anuncio where anuncio_id='91300000-0000-4000-a000-000000000002' and tipo='favoritar'), 'favoritar é fato, não expurgar';
 assert (select count(*)=3 from eventos_loja where vitrine_id='91300000-0000-4000-a000-000000000001'), 'loja 181 removido, misto/recentes preservados';
 assert (select count(*)=3 from anuncios_aparicoes_dia where anuncio_id='91300000-0000-4000-a000-000000000002'), 'aparições 181 removidas';
 assert exists(select 1 from anuncios_numeros_dia where anuncio_id='91300000-0000-4000-a000-000000000002' and dia='2030-12-31' and favoritos=1 and aparicoes=0 and soma_posicao=0 and visualizacoes=0 and cliques_whatsapp=0 and compartilhamentos=0), 'limpar só células opcionais e preservar favorito';
 assert exists(select 1 from anuncios_numeros_dia where anuncio_id='91300000-0000-4000-a000-000000000002' and dia='2030-12-30' and visualizacoes=1 and cliques_whatsapp=3), 'células mistas intactas';
 assert (select to_jsonb(a)=f.dados from anuncios a cross join ret913_fatos f where a.id='91300000-0000-4000-a000-000000000002'), 'anúncio/fatos/acumulados não mudam';
end $$;
create temporary table ret913_snapshot as
select jsonb_build_object('visitas',(select jsonb_agg(to_jsonb(v) order by id) from visitas v),'eventos',(select jsonb_agg(to_jsonb(e) order by id) from eventos_anuncio e),'numeros',(select jsonb_agg(to_jsonb(n) order by anuncio_id,dia) from anuncios_numeros_dia n)) as dados;
select public.medicao_limpar_opcionais();
do $$ begin
 assert (select dados=jsonb_build_object('visitas',(select jsonb_agg(to_jsonb(v) order by id) from visitas v),'eventos',(select jsonb_agg(to_jsonb(e) order by id) from eventos_anuncio e),'numeros',(select jsonb_agg(to_jsonb(n) order by anuncio_id,dia) from anuncios_numeros_dia n)) from ret913_snapshot), 'segunda execução idempotente';
 execute replace(pg_get_functiondef('public.medicao_limpar_opcionais()'::regprocedure),'2031-07-01T02:59:59Z','2031-07-01T03:00:00Z');
end $$;
select public.medicao_limpar_opcionais();
do $$ begin
 assert not exists(select 1 from visitas where visitante='ret913-180'), 'à meia-noite Fortaleza antigo 180 vira 181';
 assert exists(select 1 from visitas where visitante='ret913-179'), 'novo limite 180 conservado';
 assert exists(select 1 from visitas where visitante='ret913-legado'), 'legado inclusive com sessao nunca expurgado';
 assert (select dados=jsonb_build_object('pagamento',(select to_jsonb(p) from pagamentos p where asaas_cobranca_id='pay_sintetico913'),'prova',(select to_jsonb(e) from admin_gestao_eventos e where acao='fixture913')) from ret913_provas), 'pagamento e prova íntegros';
 assert not has_function_privilege('anon','public.medicao_limpar_opcionais()','EXECUTE');
 assert not has_function_privilege('authenticated','public.medicao_limpar_opcionais()','EXECUTE');
end $$;
rollback;
