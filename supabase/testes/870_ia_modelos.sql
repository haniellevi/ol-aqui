\set ON_ERROR_STOP on
\set QUIET on
-- Modelo de IA por recurso (ia.modelo.*): padrão GPT-6 Luna, troca no painel, valor estranho cai no padrão,
-- reservas gravam o modelo escolhido e só o servidor lê a função.
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
    raise exception 'Estado inesperado: % (%), esperado %: %', sqlstate, sqlerrm, codigo, comando;
  end;
  raise exception 'Comando aceito indevidamente: %', comando;
end $$;

-- ===== Padrões =====
select pg_temp.confere((select count(*) = 5 from configuracoes where chave like 'ia.modelo.%' and microrregiao_id is null
  and grupo = 'ia' and valor = '"openai/gpt-6-luna"'::jsonb and not publico), 'Cinco chaves com GPT-6 Luna');
select pg_temp.confere((select bool_and(ia_modelo(r) = 'openai/gpt-6-luna')
  from unnest(array['moderacao','categorizacao','melhoria','verificacao','radar']) r), 'Todos começam no GPT-6 Luna');
select pg_temp.recusa($q$select ia_modelo('outro')$q$, '22023');

-- ===== Troca, valor estranho e chave apagada =====
update configuracoes set valor = '"deepseek/deepseek-v4.1-flash"' where chave = 'ia.modelo.melhoria' and microrregiao_id is null;
select pg_temp.confere(ia_modelo('melhoria') = 'deepseek/deepseek-v4.1-flash', 'Troca para DeepSeek');
select pg_temp.confere(ia_modelo('categorizacao') = 'openai/gpt-6-luna', 'Troca não vaza para outro recurso');
update configuracoes set valor = '"anthropic/claude-opus-5.5"' where chave = 'ia.modelo.melhoria' and microrregiao_id is null;
select pg_temp.confere(ia_modelo('melhoria') = 'openai/gpt-6-luna', 'Modelo fora da lista: padrão');
update configuracoes set valor = '"google/gemini-2.5-flash-lite"' where chave = 'ia.modelo.moderacao' and microrregiao_id is null;
select pg_temp.confere(ia_modelo('moderacao') = 'openai/gpt-6-luna', 'Modelo de outro recurso: padrão');
update configuracoes set valor = 'null' where chave = 'ia.modelo.moderacao' and microrregiao_id is null;
select pg_temp.confere(ia_modelo('moderacao') = 'openai/gpt-6-luna', 'Valor vazio: padrão');
delete from configuracoes where chave = 'ia.modelo.verificacao';
select pg_temp.confere(ia_modelo('verificacao') = 'openai/gpt-6-luna', 'Chave apagada: padrão');
update configuracoes set valor = '"google/gemini-2.5-flash-lite"' where chave = 'ia.modelo.radar' and microrregiao_id is null;
select pg_temp.confere(ia_modelo('radar') = 'google/gemini-2.5-flash-lite', 'Radar volta ao modelo anterior');

-- ===== Reservas usam a função, sem o modelo escrito =====
select pg_temp.confere((select bool_and(pg_get_functiondef(f) like '%ia_modelo(%' and pg_get_functiondef(f) not like '%''openai/gpt-4.1-mini''%'
  and pg_get_functiondef(f) not like '%''google/gemini-2.5-flash-lite''%')
  from unnest(array['categorizacao_ia_reservar()'::regprocedure, 'melhoria_ia_reservar(uuid,text)'::regprocedure,
    'verificacao_loja_reservar()'::regprocedure, 'radar_ia_reservar(text,text)'::regprocedure]) f), 'Quatro reservas leem o painel');
select pg_temp.confere((select column_default like '%ia_modelo(%moderacao%' from information_schema.columns
  where table_schema = 'public' and table_name = 'moderacao_ia' and column_name = 'modelo'), 'Fila da moderação nasce com o modelo do painel');

-- Radar: a reserva grava no livro-caixa o modelo escolhido.
update configuracoes set valor = '"deepseek/deepseek-v4.1-flash"' where chave = 'ia.modelo.radar' and microrregiao_id is null;
update configuracoes set valor = 'true' where chave in ('radar_ia.ativa', 'radar_ia.parecidos_ativa') and microrregiao_id is null;
update configuracoes set valor = '5.5' where chave = 'robo.cotacao_dolar' and microrregiao_id is null;
select radar_ia_reservar(null, 'parecidos') as uso \gset
select pg_temp.confere((select modelo = 'deepseek/deepseek-v4.1-flash' and provedor = 'openrouter' from radar_ia_uso where id = :uso), 'Livro-caixa do Radar com o modelo escolhido');

-- ===== Só o servidor =====
select pg_temp.confere(not has_function_privilege('anon', 'public.ia_modelo(text)', 'execute'), 'anon não lê');
select pg_temp.confere(not has_function_privilege('authenticated', 'public.ia_modelo(text)', 'execute'), 'authenticated não lê');
select pg_temp.confere(has_function_privilege('service_role', 'public.ia_modelo(text)', 'execute'), 'service_role lê');
rollback;
