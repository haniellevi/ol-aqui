\set ON_ERROR_STOP on
\set QUIET on
-- Radar v2, fase 3 (IA): chaves, limite por pessoa, teto do mês, livro-caixa e aviso de anúncio novo parecido.
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

select id as regiao from microrregioes where slug='corrente-pi' \gset
select id as moveis from categorias where slug = 'sofas-e-poltronas' \gset
update configuracoes set valor = '100' where chave in ('radar.pedidos_por_dia', 'radar.pedidos_abertos_max') and microrregiao_id is null;
update configuracoes set valor = '5.5' where chave = 'robo.cotacao_dolar' and microrregiao_id is null;

insert into perfis(id, microrregiao_id, nome, whatsapp, whatsapp_verificado_em, cidade, tipo_pessoa) values
  ('user_q790a',    :'regiao', 'Pessoa A 790', '5589999979001', now(), 'Corrente', 'pf'),
  ('user_q790b',    :'regiao', 'Pessoa B 790', '5589999979002', now(), 'Corrente', 'pf'),
  ('user_q790comp', :'regiao', 'Compradora 790', '5589999979003', now(), 'Corrente', 'pf'),
  ('user_q790loja', :'regiao', 'Loja 790', '5589999979004', now(), 'Corrente', 'pj');

-- ===== Chaves desligadas por padrão =====
select pg_temp.confere((select valor = 'false'::jsonb from configuracoes where chave = 'radar_ia.ativa' and microrregiao_id is null), 'Chave geral começa desligada');
select pg_temp.confere((select count(*) = 4 from configuracoes where chave in ('radar_ia.perguntas_ativa','radar_ia.parecidos_ativa','radar_ia.vitrine_ativa','radar_ia.novidades_ativa')
  and microrregiao_id is null and valor = 'false'::jsonb), 'Chaves das partes começam desligadas');
select pg_temp.confere((select valor = '3000'::jsonb from configuracoes where chave = 'radar_ia.orcamento_mensal_centavos' and microrregiao_id is null), 'Teto R$ 30');
select pg_temp.confere((select valor = '20'::jsonb from configuracoes where chave = 'radar_ia.usos_por_dia' and microrregiao_id is null), '20 usos por dia');
select pg_temp.confere(radar_ia_reservar('user_q790a', 'parecidos') is null, 'Geral desligada: sem reserva');
select pg_temp.confere(radar_ia_estado() = '{"perguntas": false, "parecidos": false, "vitrine": false, "novidades": false}'::jsonb, 'Estado: tudo desligado');
update configuracoes set valor = 'true' where chave = 'radar_ia.ativa' and microrregiao_id is null;
select pg_temp.confere(radar_ia_reservar('user_q790a', 'parecidos') is null, 'Parte desligada: sem reserva');
update configuracoes set valor = 'true' where chave in ('radar_ia.parecidos_ativa', 'radar_ia.novidades_ativa') and microrregiao_id is null;
select pg_temp.recusa($q$select radar_ia_reservar('user_q790a', 'outra')$q$, '22023');
select pg_temp.confere(radar_ia_estado() = '{"perguntas": false, "parecidos": true, "vitrine": false, "novidades": true}'::jsonb, 'Estado: só as partes ligadas');

-- ===== Reserva e conclusão =====
select radar_ia_reservar('user_q790a', 'parecidos') as uso1 \gset
select pg_temp.confere(:'uso1' is not null, 'Ligada: reserva');
select pg_temp.confere((select parte = 'parecidos' and erro = 'em_andamento' and provedor = 'openrouter' and modelo = 'google/gemini-2.5-flash-lite'
  and custo_centavos = 0.55 and usuario_id = 'user_q790a' from radar_ia_uso where id = :uso1), 'Reserva no livro-caixa');
select radar_ia_concluir(:uso1, 0.0003, 900, 80, null);
select pg_temp.confere((select erro is null and custo_centavos = 0.165 and tokens_entrada = 900 and tokens_saida = 80 from radar_ia_uso where id = :uso1), 'Custo real gravado');
select radar_ia_concluir(:uso1, 0.01, 1, 1, 'outra');
select pg_temp.confere((select erro is null and custo_centavos = 0.165 from radar_ia_uso where id = :uso1), 'Concluir 2 vezes não muda');
select radar_ia_reservar(null, 'novidades') as uso2 \gset
select pg_temp.confere(not exists (select 1 from robo_uso where usuario_id = 'user_q790a'), 'Radar não entra no livro-caixa do robô (teto do Aki)');
select pg_temp.confere((select provedor = 'typesafe' and modelo = 'jev-latest' and usuario_id is null from radar_ia_uso where id = :uso2), 'Novidade: JEV, sem pessoa');
select radar_ia_concluir(:uso2, null, 0, 0, 'tempo_esgotado');
select pg_temp.confere((select erro = 'tempo_esgotado' and custo_centavos = 0.55 from radar_ia_uso where id = :uso2), 'Falha mantém a reserva');

-- ===== Limite por pessoa =====
update configuracoes set valor = '2' where chave = 'radar_ia.usos_por_dia' and microrregiao_id is null;
select pg_temp.confere(radar_ia_reservar('user_q790a', 'parecidos') is not null, '2º uso do dia');
select pg_temp.confere(radar_ia_reservar('user_q790a', 'parecidos') is null, '3º uso do dia: sem reserva');
select pg_temp.confere(radar_ia_reservar('user_q790b', 'parecidos') is not null, 'Outra pessoa segue');
update configuracoes set valor = '20' where chave = 'radar_ia.usos_por_dia' and microrregiao_id is null;

-- ===== Teto do mês =====
insert into robo_uso (usuario_id, tipo, provedor, modelo, custo_centavos) values ('user_q790b', 'conversa', 'openrouter', 'x', 999999);
select pg_temp.confere(radar_ia_reservar('user_q790b', 'parecidos') is not null, 'Gasto do Aki não conta no teto do Radar');
update configuracoes set valor = '1' where chave = 'radar_ia.orcamento_mensal_centavos' and microrregiao_id is null;
select pg_temp.confere(radar_ia_reservar('user_q790b', 'parecidos') is null, 'Teto estourado: sem reserva');
update configuracoes set valor = '3000' where chave = 'radar_ia.orcamento_mensal_centavos' and microrregiao_id is null;

-- ===== Só o servidor =====
set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='user_q790a';
select pg_temp.recusa($q$select radar_ia_reservar('user_q790a', 'parecidos')$q$, '42501');
select pg_temp.recusa($q$select radar_ia_concluir(1, 0, 0, 0, null)$q$, '42501');
select pg_temp.recusa($q$select radar_novidades_candidatos(10)$q$, '42501');
select pg_temp.recusa($q$select radar_novidade_conferida(gen_random_uuid(), now())$q$, '42501');
select pg_temp.recusa($q$select radar_ia_estado()$q$, '42501');
select pg_temp.confere(not has_table_privilege('authenticated', 'radar_ia_uso', 'select'), 'Livro-caixa do Radar fechado para a API');
select pg_temp.recusa($q$select radar_avisar_novidade(gen_random_uuid(), gen_random_uuid())$q$, '42501');
reset role;
set local request.jwt.claim.role='';
set local request.jwt.claim.sub='';

-- ===== Anúncio novo parecido =====
select id as corrente from cidades where microrregiao_id = :'regiao' and sem_acento(lower(nome)) = 'corrente' \gset
select id as outra_cidade from cidades where microrregiao_id = :'regiao' and id <> :'corrente' order by nome limit 1 \gset
insert into vitrines_lojas(dono_id, microrregiao_id, slug, nome, cidade, tipo, plano, plano_expira_em, teste_expira_em) values
  ('user_q790loja', :'regiao', 'q790-loja', 'Loja 790', 'Corrente', 'loja', 'full', now() + interval '10 days', now() - interval '1 day'),
  ('user_q790comp', :'regiao', 'q790-comp', 'Vitrine da compradora 790', 'Corrente', 'loja', 'full', now() + interval '10 days', now() - interval '1 day');
select id as vit_loja from vitrines_lojas where slug = 'q790-loja' \gset
select id as vit_comp from vitrines_lojas where slug = 'q790-comp' \gset
insert into radar_pedidos(id, comprador_id, microrregiao_id, titulo, cidade, modo_contato, cidades_ids, criado_em) values
  ('79000000-0000-4000-a000-000000000001','user_q790comp',:'regiao','bicicleta aro 29','Corrente','whatsapp_direto', null, now() - interval '1 hour'),
  ('79000000-0000-4000-a000-000000000002','user_q790comp',:'regiao','geladeira duplex','Corrente','whatsapp_direto', array[:'outra_cidade']::uuid[], now() - interval '1 hour'),
  ('79000000-0000-4000-a000-000000000003','user_q790comp',:'regiao','fogão 4 bocas','Corrente','whatsapp_direto', null, now() - interval '1 hour');
update radar_pedidos set status = 'encerrado', fechado_em = now(), fechado_motivo = 'cancelado' where id = '79000000-0000-4000-a000-000000000003';

insert into anuncios(id, vitrine_id, categoria_id, titulo, cidade, preco_centavos, atributos, status) values
  ('79000000-0000-4000-b000-000000000001', :'vit_loja', :'moveis', 'Bicicleta aro 29 seminova', 'Corrente', 90000, '{"estado":"usado"}', 'ativo'),
  ('79000000-0000-4000-b000-000000000002', :'vit_comp', :'moveis', 'Bicicleta aro 29 da compradora', 'Corrente', 50000, '{"estado":"usado"}', 'ativo'),
  ('79000000-0000-4000-b000-000000000003', :'vit_loja', :'moveis', 'Geladeira duplex frost free', 'Corrente', 150000, '{"estado":"usado"}', 'ativo'),
  ('79000000-0000-4000-b000-000000000004', :'vit_loja', :'moveis', 'Fogão 4 bocas novo', 'Corrente', 70000, '{"estado":"novo"}', 'ativo'),
  ('79000000-0000-4000-b000-000000000005', :'vit_loja', :'moveis', 'Mesa de jantar', 'Corrente', 30000, '{"estado":"usado"}', 'ativo');

select radar_novidades_candidatos(50) as cand \gset
select pg_temp.confere((select jsonb_array_length(:'cand'::jsonb) = 1), 'Só o pedido aberto com anúncio parecido na área');
select pg_temp.confere((select (:'cand'::jsonb)->0->>'pedido_id' = '79000000-0000-4000-a000-000000000001'), 'Pedido da bicicleta');
select pg_temp.confere((select jsonb_agg(x->>'id') = '["79000000-0000-4000-b000-000000000001"]'::jsonb
  from jsonb_array_elements((:'cand'::jsonb)->0->'anuncios') x), 'Só o anúncio da loja (não o da compradora, nem a mesa)');
select pg_temp.confere((select count(*) = 1 from radar_novidades_conferido where pedido_id = '79000000-0000-4000-a000-000000000002'), 'Pedido sem candidato fica marcado');
select pg_temp.confere(not exists (select 1 from radar_novidades_conferido where pedido_id = '79000000-0000-4000-a000-000000000001'), 'Pedido com candidato só é marcado depois que a IA julga');
select pg_temp.confere((select jsonb_array_length(radar_novidades_candidatos(50)) = 1), 'IA falhou: o pedido volta na rodada seguinte');
select radar_novidade_conferida('79000000-0000-4000-a000-000000000001', ((:'cand'::jsonb)->0->>'ate')::timestamptz);
select pg_temp.confere((select count(*) = 2 from radar_novidades_conferido), 'Pedido fechado não é olhado');
select pg_temp.confere((select jsonb_array_length(radar_novidades_candidatos(50)) = 0), 'Depois de julgado, não repete o anúncio');

-- aviso: 1 por dia por pedido
select pg_temp.confere(radar_avisar_novidade('79000000-0000-4000-a000-000000000001', '79000000-0000-4000-b000-000000000001'), 'Avisa a compradora');
select pg_temp.confere((select count(*) = 1 from notificacoes where usuario_id = 'user_q790comp' and tipo = 'radar_novidade'
  and titulo like '%bicicleta aro 29%' and texto like '%Bicicleta aro 29 seminova%' and link like '/anuncio/%'), 'Texto e link do aviso');
select pg_temp.confere(not radar_avisar_novidade('79000000-0000-4000-a000-000000000001', '79000000-0000-4000-b000-000000000001'), 'Segundo aviso no dia não sai');
select pg_temp.confere(not radar_avisar_novidade('79000000-0000-4000-a000-000000000002', '79000000-0000-4000-b000-000000000003'), 'Anúncio fora das cidades do pedido');
select pg_temp.confere(not radar_avisar_novidade('79000000-0000-4000-a000-000000000003', '79000000-0000-4000-b000-000000000004'), 'Pedido fechado');
select pg_temp.confere((select count(*) = 1 from notificacoes where usuario_id = 'user_q790comp' and tipo = 'radar_novidade'), 'Só um aviso no total');

-- anúncio novo chega para o pedido já avisado hoje: nem vira candidato
update radar_novidades_conferido set conferido_em = now() - interval '30 minutes';
insert into anuncios(id, vitrine_id, categoria_id, titulo, cidade, preco_centavos, atributos, status) values
  ('79000000-0000-4000-b000-000000000006', :'vit_loja', :'moveis', 'Bicicleta aro 29 vermelha', 'Corrente', 80000, '{"estado":"usado"}', 'ativo');
select pg_temp.confere((select jsonb_array_length(radar_novidades_candidatos(50)) = 0), 'Pedido já avisado hoje fica de fora');

-- aviso desligado pela pessoa
insert into radar_pedidos(id, comprador_id, microrregiao_id, titulo, cidade, modo_contato, criado_em) values
  ('79000000-0000-4000-a000-000000000004','user_q790comp',:'regiao','fogão 4 bocas','Corrente','whatsapp_direto', now() - interval '1 hour');
set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='user_q790comp';
select salvar_preferencia_aviso('radar_novidade', false);
reset role;
set local request.jwt.claim.role='';
set local request.jwt.claim.sub='';
select pg_temp.confere((select jsonb_array_length(radar_novidades_candidatos(50)) = 0), 'Aviso desligado: pedido não é candidato');
select pg_temp.confere(not radar_avisar_novidade('79000000-0000-4000-a000-000000000004', '79000000-0000-4000-b000-000000000004'), 'Aviso desligado: não avisa');

-- rotina: desligada não dispara
update configuracoes set valor = 'false' where chave = 'radar_ia.novidades_ativa' and microrregiao_id is null;
select pg_temp.confere(radar_ia_novidades_disparar() is null, 'Rotina desligada não chama o servidor');

rollback;
