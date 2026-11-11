\set ON_ERROR_STOP on
\set QUIET on
begin;

insert into microrregioes(slug,nome,cidade_sede) values ('teste-estatisticas-360','Região de teste 360','Cidade 360') returning id as reg \gset
select id as distante from microrregioes where slug='teste-distante' \gset
select id as cat from categorias where slug='sofas-e-poltronas' \gset
select set_config('teste.regiao360', :'reg', true);

insert into perfis(id,microrregiao_id,nome,criado_em,whatsapp,whatsapp_verificado_em,e_admin)
values ('user_comprador360',:'reg','Comprador 360','2025-02-01 03:00+00','5589999990360',now(),false),
       ('user_outro360',:'reg','Outro comprador 360','2025-03-01 02:59:59+00',null,null,false),
       ('user_loja360',:'reg','Responsável 360','2024-12-15 12:00+00','5589999990361',now(),false),
       ('user_vendedor360',:'reg','Vendedor 360','2024-12-15 12:00+00','5589999990362',now(),false),
       ('user_suporte360',:'reg','Suporte 360','2025-02-03 12:00+00',null,null,false),
       ('user_revogado360',:'reg','Revogado 360','2025-02-03 12:00+00',null,null,false),
       ('user_admin360',:'reg','Admin 360','2025-02-03 12:00+00',null,null,true);
insert into equipe(usuario_id,papel) values ('user_suporte360','suporte');
insert into contas_revogadas(usuario_id) values ('user_revogado360');

insert into vitrines_lojas(dono_id,microrregiao_id,slug,nome,cidade,tipo,plano,status,plano_expira_em)
values ('user_loja360',:'reg','loja-teste-360','Loja de estatísticas 360','Cidade 360','loja','full','ativa',now()+interval '2 days'),
       ('user_vendedor360',:'reg','loja-apoio-360','Loja de apoio 360','Cidade 360','loja','full','ativa',now()+interval '2 days');
select id as loja from vitrines_lojas where dono_id='user_loja360' \gset
select id as outra_loja from vitrines_lojas where dono_id='user_vendedor360' \gset
select id as loja_distante from vitrines_lojas where dono_id='user_distante' \gset

insert into anuncios(vitrine_id,categoria_id,titulo,cidade,preco_centavos,status,publicado_em)
values (:'loja',:'cat','Mesa publicada em fevereiro','Cidade 360',9900,'ativo','2025-02-01 03:00+00'),
       (:'loja',:'cat','Cadeira publicada em março','Cidade 360',9900,'ativo','2025-03-01 03:00+00'),
       (:'outra_loja',:'cat','Banco de vitrine suspensa','Cidade 360',9900,'ativo','2025-02-08 12:00+00');
update vitrines_lojas set status='suspensa' where id=:'outra_loja';

insert into radar_pedidos(id,comprador_id,microrregiao_id,titulo,cidade,status,fechado_motivo,criado_em)
values ('36000000-0000-4000-a000-000000000001','user_comprador360',:'reg','Procuro cadeira de teste','Cidade 360','aberto',null,'2025-02-01 03:00+00'),
       ('36000000-0000-4000-a000-000000000002','user_comprador360',:'reg','Procuro mesa de teste','Cidade 360','encerrado','arquivado','2025-02-12 12:00+00'),
       ('36000000-0000-4000-a000-000000000003','user_outro360',:'reg','Procuro mesa em outro mês','Cidade 360','aberto',null,'2025-02-20 12:00+00'),
       ('36000000-0000-4000-a000-000000000004','user_outro360',:'reg','Pedido moderado de teste','Cidade 360','encerrado','moderacao','2025-02-15 12:00+00'),
       ('36000000-0000-4000-a000-000000000005','user_outro360',:'reg','Pedido congelado de teste','Cidade 360','congelado',null,'2025-02-16 12:00+00'),
       ('36000000-0000-4000-a000-000000000006','user_outro360',:'reg','Pedido do ano anterior','Cidade 360','encerrado','resolvido','2024-12-15 12:00+00');
insert into radar_propostas(pedido_id,vitrine_id,preco_centavos,status,criado_em)
values ('36000000-0000-4000-a000-000000000001',:'loja',10000,'ativa','2025-02-01 03:00+00'),
       ('36000000-0000-4000-a000-000000000001',:'outra_loja',null,'ativa','2025-02-12 12:00+00'),
       ('36000000-0000-4000-a000-000000000002',:'loja',20000,'ativa','2025-03-01 02:59:59+00'),
       ('36000000-0000-4000-a000-000000000003',:'loja',40000,'ativa','2025-03-01 03:00+00'),
       ('36000000-0000-4000-a000-000000000003',:'outra_loja',888888,'oculta','2025-02-14 12:00+00'),
       ('36000000-0000-4000-a000-000000000004',:'loja',4444,'ativa','2025-02-15 12:00+00'),
       ('36000000-0000-4000-a000-000000000005',:'loja',5555,'ativa','2025-02-16 12:00+00'),
       ('36000000-0000-4000-a000-000000000006',:'loja',10000,'ativa','2024-12-15 12:00+00');
update radar_propostas set preco_centavos=30000, escolhida=true, escolhida_em='2025-02-20 12:00+00'
 where pedido_id='36000000-0000-4000-a000-000000000001' and vitrine_id=:'loja';

insert into pagamentos(id,vitrine_id,microrregiao_id,tipo,valor_centavos,status,pago_em)
values ('36000000-0000-4000-a000-000000000011',:'loja',:'reg','assinatura',12500,'pago','2025-02-01 03:00+00'),
       ('36000000-0000-4000-a000-000000000012',:'loja',:'reg','anuncio_avulso',2500,'pago','2025-03-01 02:59:59+00'),
       ('36000000-0000-4000-a000-000000000013',:'loja',:'reg','destaque',3000,'pago','2025-03-01 03:00+00'),
       ('36000000-0000-4000-a000-000000000014',:'loja',:'reg','assinatura',6000,'pago','2024-12-15 12:00+00'),
       ('36000000-0000-4000-a000-000000000015',:'loja',:'reg','destaque',700000,'pago','2025-02-15 12:00+00'),
       ('36000000-0000-4000-a000-000000000016',:'loja',:'reg','assinatura',9900,'pago','2025-02-15 12:00+00'),
       ('36000000-0000-4000-a000-000000000017',:'loja',:'reg','assinatura',8000,'estornado','2025-02-15 12:00+00'),
       ('36000000-0000-4000-a000-000000000018',:'loja',:'reg','assinatura',4900,'pendente',null),
       ('36000000-0000-4000-a000-000000000019',:'loja_distante',:'distante','assinatura',33300,'pago','2025-02-15 12:00+00');
insert into asaas_criacoes(pagamento_id,ambiente)
select id,case when id='36000000-0000-4000-a000-000000000015' then 'sandbox' else 'producao' end
  from pagamentos where id::text like '36000000-%' and id<>'36000000-0000-4000-a000-000000000016';

set local role anon;
do $$ begin
  assert not has_function_privilege('public.admin_estatisticas(text,date,uuid)','execute');
end $$;

set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='user_suporte360';
do $$ begin
  assert not has_function_privilege('public.recebimentos_olaki(timestamptz,timestamptz,uuid)','execute');
  begin
    perform admin_estatisticas();
    raise exception 'Equipe sem papel de administrador acessou o resumo global';
  exception when insufficient_privilege then null;
  end;
end $$;

set local request.jwt.claim.sub='user_admin360';
do $$
declare
  reg uuid := current_setting('teste.regiao360')::uuid;
  mes record;
  ano record;
  historia record;
begin
  select * into strict mes from admin_estatisticas('mes','2025-02-19',reg);
  select * into strict ano from admin_estatisticas('ano','2025-08-01',reg);
  select * into strict historia from admin_estatisticas('historico',null,reg);
  assert mes.anuncios_no_ar=2 and mes.anuncios_publicados=2, 'Anúncios agora e no período são métricas distintas';
  assert mes.usuarios_cadastrados=4 and mes.usuarios_novos=2, 'Usuários distintos, sem equipe e contas revogadas';
  assert mes.clientes_radar_atendidos=1 and mes.pedidos_com_proposta=2, 'Um comprador com dois pedidos conta uma vez';
  assert mes.pedidos_criados=3 and mes.contatos_solicitados=1, 'Pedidos e contatos usam suas próprias datas';
  assert mes.propostas_total=3 and mes.propostas_com_valor=2 and mes.propostas_centavos=50000,
         'Valores editados contam uma vez, arquivados preservados, ocultos e moderados excluídos';
  assert mes.receita_centavos=15000 and mes.receita_planos_centavos=12500 and mes.receita_avulsos_centavos=2500
         and mes.receita_destaques_centavos=0, 'Recebimentos do mês em produção, pela data local';
  assert mes.recebimentos_sem_origem=1 and mes.recebimentos_sem_origem_centavos=9900,
         'Recebimento sem ambiente identificado aparece separado';
  assert ano.clientes_radar_atendidos=2 and ano.propostas_centavos=90000 and ano.receita_centavos=18000,
         'Ano civil e totais separados';
  assert historia.propostas_centavos=100000 and historia.receita_centavos=24000 and historia.primeiro_ano<=2024,
         'Histórico inclui anos anteriores';
  assert (select receita_centavos=48300 from admin_estatisticas('mes','2025-02-19',null)),
         'Todas as regiões agregam os recebimentos de cada região';
  assert (select sum(total_centavos)=15000 from relatorio_receita('2025-02-01','2025-02-28',reg)),
         'Relatório e CSV de receita usam a mesma origem verificada';
  begin
    perform admin_estatisticas('semana',null,reg);
    raise exception 'Período inválido foi aceito';
  exception when invalid_parameter_value then null;
  end;
end $$;
rollback;
