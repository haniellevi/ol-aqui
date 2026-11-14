\set ON_ERROR_STOP on
\set QUIET on
begin;
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

set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='user_comprador';
select criar_pedido_radar_site('80000000-0000-4000-a000-000000000001','Procuro mesa para testar o Radar','Corrente','propostas_prazo',72,'Somente teste local',(select id from categorias where slug='sofas-e-poltronas'),100050,200099) as criado \gset
select (:'criado'::jsonb->>'id') as pedido \gset
select pg_temp.confere((select preco_min_centavos=100050 and preco_max_centavos=200099 from radar_pedido(:'pedido')),'Faixa com centavos preservada');
set local request.jwt.claim.sub='user_loja';
select pg_temp.recusa(format('select propor_radar(%L,null,%L,150050,%L)',:'pedido','https://externo.example/foto.jpg','Foto externa'), '22023');
select pg_temp.recusa(format('select propor_radar(%L,null,%L,150050,%L)',:'pedido','https://abc.supabase.co/storage/v1/object/public/anuncios/user_distante/radar-'||:'pedido'||'/1.webp','Foto alheia'), '22023');
select proposta_id as proposta, whatsapp is null as privado from propor_radar(:'pedido',null,'https://abc.supabase.co/storage/v1/object/public/anuncios/user_loja/radar-'||:'pedido'||'/1.webp',150050,'Entrego no Centro') \gset
select pg_temp.confere(:'privado'::boolean,'Proposta com prazo não revela telefone do comprador');
select * from propor_radar(:'pedido',null,null,149999,'Preço revisado');
select pg_temp.confere((select preco_centavos=149999 from minhas_propostas_radar() where id=:'proposta'),'Edição mantém centavos');
set local request.jwt.claim.sub='user_comprador';
select pg_temp.confere((select count(*)=1 from propostas_do_pedido(:'pedido')),'Comprador recebe uma proposta por loja');
select pg_temp.confere((select count(*)=1 from notificacoes where tipo='proposta_nova' and link='/radar/pedido/'||:'pedido'),'Comprador recebe aviso no app');
-- Prazo encerrado impede novas propostas, mas permite comparar e escolher as recebidas.
reset role;
update radar_pedidos set propostas_ate=now()-interval '1 minute' where id=:'pedido';
set local role authenticated;
set local request.jwt.claim.sub='user_loja';
select pg_temp.recusa(format('select propor_radar(%L,null,null,150050)',:'pedido'),'P0002');
set local request.jwt.claim.sub='user_comprador';
select pg_temp.confere((select situacao='prazo_acabou' from radar_pedido(:'pedido')),'Comprador vê prazo encerrado');
select pg_temp.confere((select whatsapp='5589999990002' from escolher_proposta(:'proposta')),'Contato disponível após prazo das propostas');
select * from escolher_proposta(:'proposta');
set local request.jwt.claim.sub='user_loja';
select pg_temp.confere((select count(*)=1 from notificacoes where tipo='proposta_escolhida' and link='/radar/'||:'pedido'),'Repetir escolha não duplica aviso à loja');
set local request.jwt.claim.sub='user_comprador';
select fechar_pedido_radar(:'pedido','resolvido');
select fechar_pedido_radar(:'pedido','resolvido');
select pg_temp.confere((select situacao='fechado' and fechado_motivo='resolvido' from radar_pedido(:'pedido')),'Fechamento idempotente');
-- Outro comprador e proposta moderada nunca liberam contato.
set local request.jwt.claim.sub='user_semcodigo';
select pg_temp.recusa(format('select escolher_proposta(%L)',:'proposta'),'42501');
reset role;
update radar_propostas set status='oculta' where id=:'proposta';
set local role authenticated;
set local request.jwt.claim.sub='user_comprador';
select pg_temp.confere((select count(*)=0 from propostas_do_pedido(:'pedido')),'Oferta oculta sai da comparação');
select pg_temp.recusa(format('select escolher_proposta(%L)',:'proposta'),'P0002');
rollback;
