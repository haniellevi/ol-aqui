\set ON_ERROR_STOP on
\set QUIET on
-- IA do Radar: "já comprei" na conversa. Só mensagem do cliente, só com pedido dele aberto, chave própria,
-- pergunta pendente por pedido, recusa vale para sempre naquele pedido, só o servidor lê o candidato.
begin;
reset role;
set local request.jwt.claim.role='';
set local request.jwt.claim.sub='';

create function pg_temp.confere(ok boolean, caso text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FALHOU: %', caso; end if;
end $$;
create function pg_temp.recusa(comando text, codigo text, trecho text default null) returns void language plpgsql as $$
begin
  begin execute comando;
  exception when others then
    if sqlstate = codigo and (trecho is null or sqlerrm like '%' || trecho || '%') then return; end if;
    raise exception 'Estado inesperado: % (%), esperado %: %', sqlstate, sqlerrm, codigo, comando;
  end;
  raise exception 'Comando aceito indevidamente: %', comando;
end $$;
-- mensagem gravada direto (o envio já é testado no 790_conversas_base)
create function pg_temp.msg(conv uuid, lado text, texto text) returns uuid language sql as $$
  insert into conversa_mensagens (conversa_id, lado, tipo, texto) values (conv, lado, 'texto', texto) returning id
$$;

select id as regiao from microrregioes where slug='corrente-pi' \gset
select id as moveis from categorias where slug = 'sofas-e-poltronas' \gset
update configuracoes set valor = '100' where chave in ('radar.pedidos_por_dia', 'radar.pedidos_abertos_max') and microrregiao_id is null;
update configuracoes set valor = '5.5' where chave = 'robo.cotacao_dolar' and microrregiao_id is null;
update configuracoes set valor = 'true' where chave = 'conversas.ativa' and microrregiao_id is null;

-- ===== Chave nasce desligada =====
select pg_temp.confere((select valor = 'false'::jsonb and grupo = 'radar' from configuracoes
  where chave = 'radar_ia.ja_comprei_ativa' and microrregiao_id is null), 'Chave do "já comprei" começa desligada');
select pg_temp.confere(radar_ia_estado() ? 'ja_comprei' and radar_ia_estado()->>'ja_comprei' = 'false', 'Estado traz ja_comprei desligado');

insert into perfis(id, microrregiao_id, nome, whatsapp, whatsapp_verificado_em, cidade, tipo_pessoa) values
  ('user_q810cli',  :'regiao', 'Cliente 810', '5589999981001', now(), 'Corrente', 'pf'),
  ('user_q810dono', :'regiao', 'Dono 810',    '5589999981002', now(), 'Corrente', 'pj'),
  ('user_q810cli2', :'regiao', 'Outro 810',   '5589999981003', now(), 'Corrente', 'pf');
insert into vitrines_lojas(dono_id, microrregiao_id, slug, nome, cidade, tipo, plano, plano_expira_em, teste_expira_em) values
  ('user_q810dono', :'regiao', 'q810-loja', 'Loja 810', 'Corrente', 'loja', 'full', now() + interval '10 days', now() - interval '1 day');
select id as vit from vitrines_lojas where slug = 'q810-loja' \gset
insert into anuncios(id, vitrine_id, categoria_id, titulo, cidade, preco_centavos, atributos, status) values
  ('81000000-0000-4000-b000-000000000001', :'vit', :'moveis', 'Bicicleta aro 29 810', 'Corrente', 90000, '{"estado":"usado"}', 'ativo');
insert into radar_pedidos(id, comprador_id, microrregiao_id, titulo, cidade, modo_contato, visibilidade, categoria_id) values
  ('81000000-0000-4000-a000-000000000001','user_q810cli',:'regiao','bicicleta aro 29','Corrente','whatsapp_direto','lojas',:'moveis'),
  ('81000000-0000-4000-a000-000000000002','user_q810cli',:'regiao','capacete de bike','Corrente','whatsapp_direto','lojas',:'moveis');
insert into radar_propostas(id, pedido_id, vitrine_id, anuncio_id, mensagem, preco_centavos) values
  ('81000000-0000-4000-c000-000000000001','81000000-0000-4000-a000-000000000001',:'vit','81000000-0000-4000-b000-000000000001','Tenho essa', 90000);
select id as conv from conversas where cliente_id = 'user_q810cli' and vitrine_id = :'vit' \gset
-- conversa só de anúncio (sem pedido) de outro cliente
insert into conversas (id, cliente_id, vitrine_id, origem) values ('81000000-0000-4000-d000-000000000002', 'user_q810cli2', :'vit', 'anuncio');

select pg_temp.msg(:'conv', 'cliente', 'já comprei, obrigado') as m1 \gset
select pg_temp.confere(ja_comprei_candidato(:'m1') is null, 'Chave desligada: sem candidato');

update configuracoes set valor = 'true' where chave in ('radar_ia.ativa', 'radar_ia.ja_comprei_ativa') and microrregiao_id is null;
select pg_temp.confere(radar_ia_estado()->>'ja_comprei' = 'true', 'Estado: ja_comprei ligado');
select ja_comprei_candidato(:'m1') as cand \gset
select pg_temp.confere((:'cand'::jsonb)->>'pedido_id' = '81000000-0000-4000-a000-000000000001'
  and (:'cand'::jsonb)->>'pedido_titulo' = 'bicicleta aro 29' and (:'cand'::jsonb)->>'texto' = 'já comprei, obrigado'
  and (:'cand'::jsonb)->>'usuario_id' = 'user_q810cli' and (:'cand'::jsonb)->>'mensagem_id' = :'m1', 'Candidato: pedido aberto do cliente');

update configuracoes set valor = 'false' where chave = 'radar_ia.ativa' and microrregiao_id is null;
select pg_temp.confere(ja_comprei_candidato(:'m1') is null, 'Chave geral desligada: sem candidato');
update configuracoes set valor = 'true' where chave = 'radar_ia.ativa' and microrregiao_id is null;
update configuracoes set valor = 'false' where chave = 'conversas.ativa' and microrregiao_id is null;
select pg_temp.confere(ja_comprei_candidato(:'m1') is null, 'Conversas desligadas: sem candidato');
update configuracoes set valor = 'true' where chave = 'conversas.ativa' and microrregiao_id is null;

select pg_temp.confere(ja_comprei_candidato(pg_temp.msg(:'conv', 'loja', 'o cliente já comprei aqui')) is null, 'Mensagem da loja: a IA não lê');
select pg_temp.confere(ja_comprei_candidato(pg_temp.msg('81000000-0000-4000-d000-000000000002', 'cliente', 'já comprei')) is null,
  'Conversa sem pedido: a IA não lê');
select pg_temp.confere(ja_comprei_candidato(gen_random_uuid()) is null, 'Mensagem que não existe');

-- ===== Livro-caixa: parte nova, mesmos limites =====
select radar_ia_reservar('user_q810cli', 'ja_comprei') as uso \gset
select pg_temp.confere((select parte = 'ja_comprei' and provedor = 'typesafe' and modelo = 'jev-latest' from radar_ia_uso where id = :uso), 'Reserva do JEV');
update configuracoes set valor = '1' where chave = 'radar_ia.usos_por_dia' and microrregiao_id is null;
select pg_temp.confere(radar_ia_reservar('user_q810cli', 'ja_comprei') is null, '2º uso do dia com limite 1: sem reserva');
update configuracoes set valor = '20' where chave = 'radar_ia.usos_por_dia' and microrregiao_id is null;
update configuracoes set valor = 'false' where chave = 'radar_ia.ja_comprei_ativa' and microrregiao_id is null;
select pg_temp.confere(radar_ia_reservar('user_q810cli', 'ja_comprei') is null, 'Parte desligada: sem reserva');
update configuracoes set valor = 'true' where chave = 'radar_ia.ja_comprei_ativa' and microrregiao_id is null;

-- ===== Registrar o que a IA julgou =====
select pg_temp.confere(not ja_comprei_registrar(:'m1', '81000000-0000-4000-a000-000000000001', false), 'IA disse que não: nada para perguntar');
select pg_temp.confere((select ia_lida_em is not null from conversa_mensagens where id = :'m1'), 'Mensagem marcada como lida pela IA');
select pg_temp.confere(ja_comprei_candidato(:'m1') is null, 'Mensagem já lida não volta');
select pg_temp.msg(:'conv', 'cliente', 'consegui comprar') as m2 \gset
select pg_temp.confere(ja_comprei_registrar(:'m2', '81000000-0000-4000-a000-000000000001', true), 'IA disse que sim: pergunta pendente');
select pg_temp.confere(not ja_comprei_registrar(:'m2', '81000000-0000-4000-a000-000000000001', true), 'Repetir não cria outra');
select pg_temp.confere((select count(*) = 1 from conversa_ja_comprei where estado = 'perguntando'), 'Uma pergunta por pedido');

-- pedido de outro cliente não entra
insert into radar_pedidos(id, comprador_id, microrregiao_id, titulo, cidade, modo_contato, visibilidade, categoria_id) values
  ('81000000-0000-4000-a000-000000000009','user_q810cli2',:'regiao','outro pedido','Corrente','whatsapp_direto','lojas',:'moveis');
select pg_temp.confere(not ja_comprei_registrar(:'m2', '81000000-0000-4000-a000-000000000009', true), 'Pedido de outra pessoa não vira pergunta');

-- ===== O que cada um vê =====
set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='user_q810cli';
select pg_temp.confere((select count(*) = 1 and min(pedido_titulo) = 'bicicleta aro 29' from ja_comprei_pendente(:'conv')), 'Cliente vê a pergunta');
select pg_temp.recusa($q$select ja_comprei_candidato(gen_random_uuid())$q$, '42501');
select pg_temp.recusa($q$select ja_comprei_registrar(gen_random_uuid(), gen_random_uuid(), true)$q$, '42501');
select pg_temp.confere(not has_table_privilege('authenticated', 'conversa_ja_comprei', 'select'), 'Tabela fechada para a API');
set local request.jwt.claim.sub='user_q810dono';
select pg_temp.confere((select count(*) = 0 from ja_comprei_pendente(:'conv')), 'A loja não vê a pergunta');
select pg_temp.recusa($q$select recusar_ja_comprei('81000000-0000-4000-a000-000000000001')$q$, '42501');
set local request.jwt.claim.sub='user_q810cli2';
select pg_temp.confere((select count(*) = 0 from ja_comprei_pendente(:'conv')), 'Pessoa de fora não vê');

-- ===== "Sim" sem escolher nada: continua; resolver tira a faixa =====
set local request.jwt.claim.sub='user_q810cli';
select pg_temp.confere((select status = 'aberto' from radar_pedidos where id = '81000000-0000-4000-a000-000000000001'), 'Nada sai do ar sozinho');
reset role;
set local request.jwt.claim.role='';
set local request.jwt.claim.sub='';

-- ===== "Não, ainda preciso": nunca mais para esse pedido =====
set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='user_q810cli';
select recusar_ja_comprei('81000000-0000-4000-a000-000000000001');
select recusar_ja_comprei('81000000-0000-4000-a000-000000000001');
select pg_temp.confere((select count(*) = 0 from ja_comprei_pendente(:'conv')), 'Recusou: faixa some');
reset role;
set local request.jwt.claim.role='';
set local request.jwt.claim.sub='';
select pg_temp.confere((select estado = 'nao' and respondido_em is not null from conversa_ja_comprei
  where pedido_id = '81000000-0000-4000-a000-000000000001'), 'Recusa gravada');
select pg_temp.confere(ja_comprei_candidato(pg_temp.msg(:'conv', 'cliente', 'comprei mesmo')) is null, 'Depois do "não": a IA não lê mais por esse pedido');
select pg_temp.confere(not ja_comprei_registrar(pg_temp.msg(:'conv', 'cliente', 'comprei de novo'), '81000000-0000-4000-a000-000000000001', true),
  'Depois do "não": não pergunta de novo');

-- pedido novo da mesma loja na mesma conversa: pode perguntar
insert into radar_propostas(id, pedido_id, vitrine_id, mensagem) values
  ('81000000-0000-4000-c000-000000000002','81000000-0000-4000-a000-000000000002',:'vit', 'Tenho capacete');
select pg_temp.msg(:'conv', 'cliente', 'achei o capacete') as m3 \gset
select pg_temp.confere(ja_comprei_candidato(:'m3')->>'pedido_id' = '81000000-0000-4000-a000-000000000002', 'Pedido novo pode perguntar');
select pg_temp.confere(ja_comprei_registrar(:'m3', '81000000-0000-4000-a000-000000000002', true), 'Pergunta do pedido novo');

-- resolver o pedido tira a faixa
set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='user_q810cli';
select pg_temp.confere((select count(*) = 1 from ja_comprei_pendente(:'conv')), 'Faixa do pedido novo');
select resolver_pedido_radar('81000000-0000-4000-a000-000000000002', null, true);
select pg_temp.confere((select count(*) = 0 from ja_comprei_pendente(:'conv')), 'Pedido resolvido: faixa some');
reset role;
set local request.jwt.claim.role='';
set local request.jwt.claim.sub='';
select pg_temp.confere(ja_comprei_candidato(pg_temp.msg(:'conv', 'cliente', 'comprei')) is null, 'Pedido fechado: a IA não lê');

rollback;
