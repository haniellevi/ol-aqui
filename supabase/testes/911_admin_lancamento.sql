\set ON_ERROR_STOP on
begin;
select id as reg from microrregioes where slug='corrente-pi' \gset
select id as cat from categorias where slug='sofas-e-poltronas' \gset
insert into perfis(id,microrregiao_id,nome,cidade,e_admin) values
 ('user_admin911',:'reg','Admin fictício','Corrente',true),
 ('user_loja911',:'reg','Loja fictícia','Corrente',false);
insert into vitrines_lojas(id,dono_id,microrregiao_id,slug,nome,cidade,tipo,criado_em)
 values('91100000-0000-4000-a000-000000000001','user_loja911',:'reg','loja-911','Loja fictícia','Corrente','loja','2001-01-10');
insert into buscas_faixas_dia(dia,microrregiao_id,categoria_id,faixa,vezes) values
 ('2001-01-10',:'reg',:'cat','zero',4);
set local role authenticated;
set local request.jwt.claim.sub='user_loja911';
do $$ begin
 begin perform public.admin_lancamento('2001-01-01','2001-01-31');raise exception 'Acesso indevido';
 exception when insufficient_privilege then null;end;
end $$;
set local request.jwt.claim.sub='user_admin911';
do $$ declare r jsonb; begin
 r:=public.admin_lancamento('2001-01-01','2001-01-31');
 assert r->'demanda'='[]'::jsonb,'Célula pequena exposta';
 assert (r->'ativacao'->>'maduras')::int=1;
 assert (r->'ativacao'->>'com_oferta')::int=0;
 assert (r->'negocio'->>'publicados')::int=0;
 assert r->>'de'='2001-01-01';
 assert r->'rollout_inicio'='null'::jsonb and r->'rollout_fim'='null'::jsonb,'Marco SQL não comprova rollout da aplicação';
 assert public.admin_lancamento('1999-01-01','1999-01-31')->'radar'->>'maduros'='0';
 begin perform public.admin_lancamento('2001-02-01','2001-01-01');raise exception 'Intervalo aceito';
 exception when invalid_parameter_value then null;end;
 assert not has_function_privilege('anon','public.admin_lancamento(date,date)','execute');
end $$;
reset role;
update buscas_faixas_dia set vezes=5 where dia='2001-01-10' and categoria_id=:'cat';
insert into buscas_faixas_dia(dia,microrregiao_id,categoria_id,faixa,vezes) values('2001-01-10',:'reg',:'cat','1-10',1);
set local role authenticated;
do $$ begin assert public.admin_lancamento('2001-01-01','2001-01-31')->'demanda'='[]'::jsonb,'Subtração revela parcela pequena';end $$;
reset role;
update buscas_faixas_dia set vezes=5 where dia='2001-01-10' and faixa='1-10' and categoria_id=:'cat';
set local role authenticated;
do $$ declare r jsonb; begin
 r:=public.admin_lancamento('2001-01-01','2001-01-31');
 assert jsonb_array_length(r->'demanda')=1;
 assert r->'demanda'->0->>'buscas'='10';
 assert r->'demanda'->0->>'sem_resultado'='5';
 assert r::text not like '%user_loja911%' and r::text not like '%loja-911%';
end $$;
reset role;
insert into anuncios(id,vitrine_id,microrregiao_id,categoria_id,titulo,cidade,status,publicado_em,vendido_em,vendido_pelo_olaki)
 values('91100000-0000-4000-a000-000000000002','91100000-0000-4000-a000-000000000001',:'reg',:'cat','Produto de teste 911','Corrente','vendido','2001-01-15T03:00:00Z','2001-01-16T03:00:00Z',true);
insert into anuncios_numeros_dia(anuncio_id,dia,cliques_whatsapp) values('91100000-0000-4000-a000-000000000002','2001-01-15',7);
insert into pagamentos(vitrine_id,microrregiao_id,tipo,valor_centavos,status,pago_em)
 values('91100000-0000-4000-a000-000000000001',:'reg','assinatura',999,'pago','2001-01-15');
insert into radar_pedidos(id,comprador_id,microrregiao_id,titulo,cidade,status,criado_em)
 values('91100000-0000-4000-a000-000000000003','user_loja911',:'reg','Pedido sintético 911','Corrente','encerrado','2001-01-10');
set local role authenticated;
do $$ declare r jsonb; begin
 r:=public.admin_lancamento('2001-01-01','2001-01-31');
 assert r->'negocio'->>'publicados'='1';
 assert r->'negocio'->>'vendas_declaradas'='1';
 assert r->'negocio'->>'contatos'='7','Clique não é venda';
 assert r->'negocio'->>'receita_centavos'='0','Pagamento sem ambiente não é produção';
 assert r->'radar'->>'maduros'='1' and r->'radar'->>'sem_proposta'='1';
 assert r->'medicao'->>'sem_dados'='true';
end $$;
reset role;
insert into asaas_criacoes(pagamento_id,ambiente)
 select id,'sandbox' from pagamentos where vitrine_id='91100000-0000-4000-a000-000000000001';
insert into voucher_campanhas(codigo,duracao_dias,valido_ate) values('TESTE911',30,now()+interval '1 day') returning id as campanha \gset
insert into voucher_atribuicoes(campanha_id,dono_id,vitrine_id,resgatado_em)
 values(:'campanha','user_loja911','91100000-0000-4000-a000-000000000001','2001-01-15');
set local role authenticated;
do $$ declare r jsonb; begin
 r:=public.admin_lancamento('2001-01-01','2001-01-31');
 assert r->'negocio'->>'receita_centavos'='0','Sandbox não é receita real';
 assert r->'negocio'->>'cupons'='1';
 assert r::text not like '%TESTE911%','Código não pertence ao agregado';
end $$;
reset role;
update asaas_criacoes set ambiente='producao' where pagamento_id in (select id from pagamentos where vitrine_id='91100000-0000-4000-a000-000000000001');
set local role authenticated;
do $$ begin assert public.admin_lancamento('2001-01-01','2001-01-31')->'negocio'->>'receita_centavos'='999';end $$;
reset role;
-- Instante no limite civil: 02:59Z ainda é o dia anterior em Fortaleza.
insert into visitas(visitante,caminho,origem,coorte,sessao,ocorrencia,criado_em)
 values('91100000-0000-4000-a000-000000000004','/','radio','consentida_v1','91100000-0000-4000-a000-000000000004','91100000-0000-4000-a000-000000000004','2001-01-10T02:59:00Z');
set local role authenticated;
do $$ declare r jsonb; begin
 r:=public.admin_lancamento('2001-01-10','2001-01-10');
 assert r->'medicao'->>'pageviews'='0';
 assert r->'origens'='[]'::jsonb,'Origem e resumo precisam da mesma janela';
 assert public.admin_lancamento('2001-01-09','2001-01-09')->'medicao'->>'pageviews'='1';
end $$;
rollback;
