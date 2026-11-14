\set ON_ERROR_STOP on
\set QUIET on
create function pg_temp.confere(ok boolean, caso text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FALHOU: %', caso; end if; end $$;
create function pg_temp.recusa(comando text, codigo text) returns void language plpgsql as $$
begin
  begin execute comando;
  exception when others then
    if sqlstate = codigo then return; end if;
    raise exception 'Estado inesperado: %, esperado %: %', sqlstate, codigo, sqlerrm;
  end;
  raise exception 'Comando aceito indevidamente: %', comando;
end $$;
select id as reg from microrregioes where slug='corrente-pi' \gset
insert into microrregioes (slug,nome,cidade_sede) values ('teste-distante','Região distante','Outra cidade') returning id as distante \gset
insert into cidades (microrregiao_id,nome,uf) values (:'distante','Outra cidade','BA');
insert into perfis (id,microrregiao_id,nome,whatsapp,whatsapp_verificado_em,cidade) values
 ('user_comprador',:'reg','Comprador teste','5589999990001',now(),'Corrente'),
 ('user_loja',:'reg','Loja teste','5589999990002',now(),'Corrente'),
 ('user_cota',:'reg','Cota teste','5589999990003',now(),'Corrente'),
 ('user_distante',:'distante','Loja distante','5577999990004',now(),'Outra cidade'),
 ('user_semcodigo',:'reg','Celular não confirmado','5589999990005',null,'Corrente');
insert into vitrines_lojas (dono_id,microrregiao_id,slug,nome,cidade,whatsapp,tipo,plano,plano_expira_em) values
 ('user_loja',:'reg','loja-teste','Loja teste','Corrente','5589999990002','loja','full',now()+interval '30 days'),
 ('user_distante',:'distante','loja-distante','Loja distante','Outra cidade','5577999990004','loja','full',now()+interval '30 days');
insert into planos (codigo,nome,publico,preco_centavos,periodo_dias,limite_anuncios,acesso_radar,propostas_radar_mes,e_teste,ordem) values
 ('teste_cota150','Plano de teste da cota 150','todos',1000,30,1,true,3,false,99);
insert into vitrines_lojas (dono_id,microrregiao_id,slug,nome,cidade,whatsapp,tipo,plano,plano_expira_em) values
 ('user_cota',:'reg','cota-teste','Cota teste','Corrente','5589999990003','loja','teste_cota150',now()+interval '10 days');
-- Radar v2: só loja verificada com plano pago atende; a loja da cota usa um plano pago só de teste (3 propostas, 1 anúncio); o Slim fica intacto.
update vitrines_lojas set verificacao_estado='aprovada', selo_loja_verificada=true where dono_id in ('user_loja','user_distante','user_cota');
update planos set limite_anuncios=1 where codigo='teste';

update configuracoes set valor='"https://abc.supabase.co"' where chave='fotos.origem' and microrregiao_id is null;
update configuracoes set valor='true' where chave='radar.exigir_celular_confirmado' and microrregiao_id is null;
update configuracoes set valor='100' where chave in ('radar.pedidos_por_dia','radar.pedidos_abertos_max') and microrregiao_id is null;
-- Fixtures para as quatro transações independentes de concorrência.
insert into radar_pedidos(id,comprador_id,microrregiao_id,titulo,cidade) select
 ('20000000-0000-4000-a000-00000000000'||n)::uuid,'user_comprador',:'reg','Procuro móvel para sala '||n,'Corrente' from generate_series(1,4) n;

set role anon;
set request.jwt.claim.role='anon';
select pg_temp.recusa('select * from radar_feed()', '42501');
select pg_temp.recusa($q$select criar_pedido_radar_site(gen_random_uuid(),'Procuro bicicleta usada','Corrente')$q$, '42501');
set role authenticated;
set request.jwt.claim.role='authenticated';
set request.jwt.claim.sub='user_semcodigo';
select pg_temp.recusa($q$select criar_pedido_radar('Procuro bicicleta usada','Corrente')$q$, '42501');
set request.jwt.claim.sub='user_comprador';
select criar_pedido_radar_site('10000000-0000-4000-a000-000000000001','Procuro bicicleta usada','Corrente','propostas_prazo',72,'Com marchas',(select id from categorias where slug='sofas-e-poltronas')) as criado \gset
select (:'criado'::jsonb->>'id') as pedido \gset
select pg_temp.confere(criar_pedido_radar_site('10000000-0000-4000-a000-000000000001','Procuro bicicleta usada','Corrente','propostas_prazo',72,null,(select id from categorias where slug='sofas-e-poltronas')) ->> 'id' = :'pedido', 'repetição devolve mesmo pedido');
select pg_temp.confere((select count(*)=1 from meus_pedidos_radar() where id=:'pedido'), 'comprador acompanha pedido');
select pg_temp.recusa($q$select criar_pedido_radar('Procuro bicicleta usada','Outra cidade')$q$, '23514');
select pg_temp.recusa($q$select criar_pedido_radar('Procuro bicicleta usada','Corrente','whatsapp_direto',null,null,null,10000,1000)$q$, '23514');
select pg_temp.recusa(format('select propor_radar(%L)', :'pedido'), '42501');
set request.jwt.claim.sub='user_distante';
select pg_temp.confere((select count(*)=0 from radar_feed()), 'feed isola outra região sem filtro do cliente');
select pg_temp.confere((select count(*)=0 from radar_pedido(:'pedido')), 'URL direta isola outra região');
select pg_temp.confere((select count(*)=0 from radar_pedidos where id=:'pedido'), 'RLS isola leitura direta');
select pg_temp.confere((select count(*)=0 from propostas_do_pedido(:'pedido')), 'propostas são privadas');
select pg_temp.recusa(format('select propor_radar(%L)', :'pedido'), '42501');
set request.jwt.claim.sub='user_loja';
select pg_temp.confere((select count(*)=1 from radar_feed() where id=:'pedido'), 'feed inclui região correta');
select pg_temp.confere((select detalhes='Com marchas' from radar_pedido(:'pedido')), 'plano libera detalhes');
select pg_temp.recusa(format('select propor_radar(%L,null,null,10000)', :'pedido'), '23514');
select proposta_id as proposta, whatsapp is null as contato_oculto from propor_radar(:'pedido',null,'https://abc.supabase.co/storage/v1/object/public/anuncios/user_loja/radar-'||:'pedido'||'/1.webp',10000,'Entrego na sua cidade') \gset
select pg_temp.confere(:'contato_oculto'::boolean, 'modo propostas não revela telefone do comprador');
select pg_temp.recusa(format('select escolher_proposta(%L)', :'proposta'), '42501');
select pg_temp.confere((select count(*)=1 from minhas_propostas_radar()), 'vendedor acompanha proposta');
set request.jwt.claim.sub='user_comprador';
select pg_temp.confere((select count(*)=1 from propostas_do_pedido(:'pedido')), 'comprador compara proposta');
select pg_temp.confere((select whatsapp='5589999990002' from escolher_proposta(:'proposta')), 'comprador autorizado recebe contato da loja');
select pg_temp.confere((select whatsapp='5589999990002' from escolher_proposta(:'proposta')), 'contato pode ser reaberto');
set request.jwt.claim.sub='user_loja';
select pg_temp.recusa(format('select propor_radar(%L,null,null,50000)', :'pedido'), 'P0001');
set request.jwt.claim.sub='user_comprador';
select fechar_pedido_radar(:'pedido','cancelado');
select pg_temp.recusa(format('select escolher_proposta(%L)', :'proposta'), 'P0002');
set request.jwt.claim.sub='user_loja';
select pg_temp.recusa(format('select propor_radar(%L)', :'pedido'), 'P0002');
select pg_temp.confere((select count(*)=0 from radar_feed() where id=:'pedido'), 'cancelamento tira pedido do feed');
-- WhatsApp direto: contato só após a proposta autorizada, com repetição sem nova cobrança.
select whatsapp as contato from propor_radar('20000000-0000-4000-a000-000000000001') \gset
select pg_temp.confere(:'contato'='5589999990001','WhatsApp direto entrega número autorizado');
select whatsapp from propor_radar('20000000-0000-4000-a000-000000000001');
reset role;
select pg_temp.confere((select total_propostas=1 from radar_pedidos where id='20000000-0000-4000-a000-000000000001'),'repetir contato não duplica proposta');
-- Sem confirmação: nem a configuração antiga permite negociar.
update configuracoes set valor='false' where chave='radar.exigir_celular_confirmado' and microrregiao_id is null;
set role authenticated;
set request.jwt.claim.sub='user_semcodigo';
select pg_temp.recusa($q$select criar_pedido_radar('Procuro bicicleta para trabalhar','Corrente')$q$, '42501');
reset role;
update configuracoes set valor='true' where chave='radar.exigir_celular_confirmado' and microrregiao_id is null;
-- Três anúncios em rascunho para disputar a única vaga de publicação.
select id as vit_cota from vitrines_lojas where dono_id='user_cota' \gset
select id as cat from categorias where slug='sofas-e-poltronas' \gset
insert into anuncios (id,vitrine_id,categoria_id,titulo,cidade,preco_centavos,atributos,fotos,status) select
 ('30000000-0000-4000-a000-00000000000'||n)::uuid,:'vit_cota',:'cat','Mesa de madeira número '||n,'Corrente',10000,'{"estado":"novo"}',
 array['https://abc.supabase.co/storage/v1/object/public/anuncios/user_cota/x/1.webp'],'rascunho' from generate_series(1,3) n;
