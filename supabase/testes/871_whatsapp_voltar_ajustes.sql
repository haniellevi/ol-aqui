\set ON_ERROR_STOP on
\set QUIET on
-- VOLTAR pelo WhatsApp, ajustes (29/11/2026): repetição só para outra mensagem; VOLTAR e SIM sempre avaliados;
-- SAIR apaga o resumo do número (com e sem o 9); confirmação da volta por ativação (VOLTAR -> SAIR -> VOLTAR no mesmo dia);
-- SIM repetido depois da pergunta; limite de 3 por dia; limpeza do resumo só do que tem mais de 1 dia; fila; permissões.
-- A migração 20261129020000 é reaplicada no começo deste teste (o harness troca a linha abaixo): tem de ser idempotente.
-- Tudo numa transação que volta no fim.
begin;
reset role;
-- REAPLICAR_AJUSTES

create function pg_temp.confere871(ok boolean, caso text) returns void language plpgsql as $$
begin
  if ok is not true then raise exception 'Falhou: %', caso; end if;
end $$;
create function pg_temp.h871(t text) returns text language sql as $$
  select encode(sha256(convert_to(t, 'UTF8')), 'hex')
$$;

select id as reg from microrregioes where slug = 'corrente-pi' \gset
update configuracoes set valor = 'true'::jsonb where chave = 'radar.whatsapp_ativo' and microrregiao_id is null;
-- Só o que nascer nesta transação fica pendente na fila (o resto do banco de teste sai da conta)
update whatsapp_fila set estado = 'cancelada', erro = 'teste871' where estado = 'pendente';
insert into perfis(id, microrregiao_id, nome, cidade, whatsapp, whatsapp_verificado_em) values
  ('user_871ciclo', :'reg', 'Loja 871 ciclo', 'Corrente', '5589999980001', now()),
  ('user_871sino',  :'reg', 'Loja 871 sino', 'Corrente', '5589999980002', now()),
  ('user_871out',   :'reg', 'Loja 871 outra', 'Corrente', '5589999980003', now()),
  ('user_871sim',   :'reg', 'Loja 871 sim', 'Corrente', '5589999980004', now()),
  ('user_871lim',   :'reg', 'Loja 871 limite', 'Corrente', '5589999980005', now()),
  ('user_871hash',  :'reg', 'Loja 871 resumo', 'Corrente', '5589999980006', now());
insert into preferencias_avisos (usuario_id, tipo, canal, ligado) values
  ('user_871ciclo', 'pedido_novo', 'whatsapp', false),
  ('user_871sino', 'pedido_novo', 'whatsapp', false),
  ('user_871sino', 'pedido_novo', 'app', false),
  ('user_871sim', 'pedido_novo', 'whatsapp', false),
  ('user_871lim', 'pedido_novo', 'whatsapp', false);

-- [1] VOLTAR -> SAIR -> VOLTAR no mesmo dia: volta nas duas vezes e a segunda confirmação sai
set local role service_role;
select whatsapp_mensagem_recebida('5589999980001', 'voltar', pg_temp.h871('voltar')) as c1 \gset
select whatsapp_sair('5589999980001', 'SAIR') as c_saiu \gset
select whatsapp_mensagem_recebida('5589999980001', 'voltar', pg_temp.h871('voltar')) as c2 \gset
reset role;
select pg_temp.confere871(:'c1' = 'voltou' and :'c_saiu' = 't' and :'c2' = 'voltou', 'VOLTAR, SAIR e VOLTAR no mesmo dia: volta nas duas vezes');
select pg_temp.confere871((select count(*) = 2 from whatsapp_fila where numero = '5589999980001' and chave like 'whatsapp_resposta:5589999980001:voltar%'
  and estado = 'pendente' and texto = 'Pronto! Você volta a receber pedidos do Radar pelo WhatsApp, das 8h às 20h. Para parar, responda SAIR.'),
  'segunda confirmação da volta sai com a primeira no mesmo dia');
select pg_temp.confere871((select count(*) = 1 from whatsapp_fila where numero = '5589999980001' and chave like 'whatsapp_saida:%'), 'a saída tem a sua confirmação');
select pg_temp.confere871((select ligado from preferencias_avisos where usuario_id = 'user_871ciclo' and tipo = 'pedido_novo' and canal = 'whatsapp'), 'aviso do WhatsApp ligado no fim do ciclo');
select pg_temp.confere871((select count(*) = 2 from whatsapp_respostas where usuario_id = 'user_871ciclo' and comando = 'VOLTAR'), 'as duas voltas ficam registradas');

-- [2] VOLTAR com sino desligado -> liga o sino -> VOLTAR de novo no mesmo dia: ativa (o VOLTAR não fica preso na repetição)
set local role service_role;
select whatsapp_mensagem_recebida('5589999980002', 'voltar', pg_temp.h871('voltar')) as s1 \gset
reset role;
update preferencias_avisos set ligado = true where usuario_id = 'user_871sino' and tipo = 'pedido_novo' and canal = 'app';
set local role service_role;
select whatsapp_mensagem_recebida('5589999980002', 'voltar', pg_temp.h871('voltar')) as s2 \gset
reset role;
select pg_temp.confere871(:'s1' = 'sino_desligado' and :'s2' = 'voltou', 'sino desligado e depois ligado: a segunda VOLTAR ativa');
select pg_temp.confere871((select ligado from preferencias_avisos where usuario_id = 'user_871sino' and tipo = 'pedido_novo' and canal = 'whatsapp'), 'depois de ligar o sino, a volta liga o WhatsApp');
select pg_temp.confere871((select count(*) = 1 from whatsapp_fila where numero = '5589999980002' and chave like 'whatsapp_resposta:5589999980002:sino:%'), 'o pedido de ligar o sino sai uma vez');
select pg_temp.confere871((select count(*) = 1 from whatsapp_fila where numero = '5589999980002' and chave like 'whatsapp_resposta:5589999980002:voltar%'), 'a confirmação da volta sai uma vez');

-- [3] Outra mensagem repetida segue ignorada; a outra diferente passa
set local role service_role;
select whatsapp_mensagem_recebida('5589999980003', 'outra', pg_temp.h871('oi')) as o1 \gset
select whatsapp_mensagem_recebida('5589999980003', 'outra', pg_temp.h871('oi')) as o2 \gset
select whatsapp_mensagem_recebida('5589999980003', 'outra', pg_temp.h871('tudo bem')) as o3 \gset
reset role;
select pg_temp.confere871(:'o1' = 'nada' and :'o2' = 'mensagem_repetida' and :'o3' = 'nada', 'outra repetida segue ignorada; outra diferente passa');

-- [4] SAIR apaga o resumo do número, nas duas formas (com e sem o 9): a mesma mensagem depois da saída não é repetida
set local role service_role;
select whatsapp_sair('5589999980006', 'SAIR') as h_saiu \gset
select whatsapp_mensagem_recebida('5589999980006', 'outra', pg_temp.h871('oi')) as h1 \gset
reset role;
select pg_temp.confere871(:'h1' = 'pergunta' and (select count(*) = 1 from whatsapp_ultima_mensagem where numero = '5589999980006'), 'outra depois da saída faz a pergunta e guarda o resumo');
set local role service_role;
select whatsapp_sair('558999980006', 'SAIR') as h_saiu2 \gset
reset role;
select pg_temp.confere871((select count(*) = 0 from whatsapp_ultima_mensagem where numero = '5589999980006'), 'SAIR sem o 9 apaga o resumo com o 9');
set local role service_role;
select whatsapp_mensagem_recebida('5589999980006', 'outra', pg_temp.h871('oi')) as h2 \gset
reset role;
select pg_temp.confere871(:'h2' = 'ja_perguntou', 'depois da saída, a mesma mensagem não é tomada como repetida');

-- [5] SIM repetido depois da pergunta: a primeira volta; a segunda não faz nada e não registra outra volta
set local role service_role;
select whatsapp_sair('5589999980004', 'SAIR') as e_saiu \gset
select whatsapp_mensagem_recebida('5589999980004', 'outra', pg_temp.h871('pergunta')) as e_perg \gset
select whatsapp_mensagem_recebida('5589999980004', 'sim', pg_temp.h871('sim')) as e_sim1 \gset
select whatsapp_mensagem_recebida('5589999980004', 'sim', pg_temp.h871('sim')) as e_sim2 \gset
reset role;
select pg_temp.confere871(:'e_perg' = 'pergunta' and :'e_sim1' = 'voltou' and :'e_sim2' = 'nada', 'SIM repetido depois da pergunta: volta uma vez e depois não faz nada');
select pg_temp.confere871((select count(*) = 1 from whatsapp_respostas where usuario_id = 'user_871sim' and comando = 'VOLTAR')
  and (select count(*) = 1 from whatsapp_fila where numero = '5589999980004' and chave like 'whatsapp_resposta:5589999980004:voltar%'),
  'SIM repetido: uma volta registrada e uma confirmação');

-- [6] Limite de 3 por número e dia segue valendo para a volta: saída (1), pergunta (2), pausado (3); a volta fica, a resposta não sai
set local role service_role;
select whatsapp_sair('5589999980005', 'SAIR') as f0 \gset
select whatsapp_mensagem_recebida('5589999980005', 'outra', pg_temp.h871('oi')) as f1 \gset
reset role;
update configuracoes set valor = 'false'::jsonb where chave = 'radar.whatsapp_ativo' and microrregiao_id is null;
set local role service_role;
select whatsapp_mensagem_recebida('5589999980005', 'voltar', pg_temp.h871('voltar')) as f2 \gset
reset role;
update configuracoes set valor = 'true'::jsonb where chave = 'radar.whatsapp_ativo' and microrregiao_id is null;
set local role service_role;
select whatsapp_mensagem_recebida('5589999980005', 'voltar', pg_temp.h871('quero voltar')) as f3 \gset
reset role;
select pg_temp.confere871(:'f1' = 'pergunta' and :'f2' = 'pausado' and :'f3' = 'voltou', 'sequência do número com limite: pergunta, pausado e volta');
select pg_temp.confere871((select count(*) = 3 from whatsapp_fila where numero = '5589999980005'
  and (chave like 'whatsapp_saida:%' or chave like 'whatsapp_resposta:%')), 'limite: no máximo 3 respostas automáticas no dia');
select pg_temp.confere871((select count(*) = 0 from whatsapp_fila where numero = '5589999980005' and chave like 'whatsapp_resposta:5589999980005:voltar%'),
  'limite: a confirmação da volta não sai, mas a volta fica');
select pg_temp.confere871((select ligado from preferencias_avisos where usuario_id = 'user_871lim' and tipo = 'pedido_novo' and canal = 'whatsapp')
  and (select count(*) = 1 from whatsapp_respostas where usuario_id = 'user_871lim' and comando = 'VOLTAR'), 'limite: aviso ligado e volta registrada');

-- [7] Limpeza do resumo: apaga só o que tem mais de 1 dia
insert into whatsapp_ultima_mensagem (numero, hash, recebido_em) values
  ('5589999980007', pg_temp.h871('velha'), now() - interval '25 hours'),
  ('5589999980008', pg_temp.h871('recente'), now() - interval '23 hours');
select whatsapp_ultima_mensagem_limpar() >= 1 as limpou \gset
select pg_temp.confere871(:'limpou' = 't', 'limpeza devolve quantas apagou');
select pg_temp.confere871((select count(*) = 0 from whatsapp_ultima_mensagem where numero = '5589999980007'), 'limpeza apaga o resumo com mais de 1 dia');
select pg_temp.confere871((select count(*) = 1 from whatsapp_ultima_mensagem where numero = '5589999980008'), 'limpeza mantém o resumo de menos de 1 dia');

-- [8] Agenda: com pg_cron, o job de hora em hora chama a limpeza. Sem pg_cron (teste), não há job para conferir.
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    assert exists (select 1 from cron.job where jobname = 'olaki-whatsapp-ultima-mensagem-limpar'
                    and schedule = '0 * * * *' and command = 'select public.whatsapp_ultima_mensagem_limpar()'), 'job de limpeza do resumo não agendado';
  end if;
end $$;

-- [9] A volta usa a chave da resposta: a fila a trata como resposta e manda na madrugada, com o Radar desligado
update whatsapp_fila set estado = 'cancelada', erro = 'teste871_madrugada' where estado = 'pendente' and numero <> '5589999980001';
do $$
declare
  madrugada timestamptz := (date_trunc('day', now() at time zone 'America/Fortaleza') + interval '1 day 3 hours') at time zone 'America/Fortaleza';
  i integer;
begin
  for i in 1..10 loop
    perform whatsapp_fila_pegar_em(5, madrugada);
  end loop;
end $$;
select pg_temp.confere871((select count(*) = 2 from whatsapp_fila where numero = '5589999980001'
  and chave like 'whatsapp_resposta:5589999980001:voltar%' and estado = 'enviando'),
  'fila: as duas confirmações de volta saem na madrugada (prefixo whatsapp_resposta:)');

-- [10] Permissões: limpeza só do servidor; decisão e SAIR só do servidor; nada para a conta nem para o visitante
select pg_temp.confere871(not has_function_privilege('service_role', 'whatsapp_ultima_mensagem_limpar()', 'execute')
  and not has_function_privilege('authenticated', 'whatsapp_ultima_mensagem_limpar()', 'execute')
  and not has_function_privilege('anon', 'whatsapp_ultima_mensagem_limpar()', 'execute'), 'limpeza do resumo fechada para servidor, conta e visitante');
select pg_temp.confere871(has_function_privilege('service_role', 'whatsapp_mensagem_recebida(text,text,text)', 'execute')
  and not has_function_privilege('authenticated', 'whatsapp_mensagem_recebida(text,text,text)', 'execute')
  and not has_function_privilege('anon', 'whatsapp_mensagem_recebida(text,text,text)', 'execute'), 'decisão do WhatsApp continua só do servidor');
select pg_temp.confere871(has_function_privilege('service_role', 'whatsapp_sair(text,text)', 'execute')
  and not has_function_privilege('authenticated', 'whatsapp_sair(text,text)', 'execute')
  and not has_function_privilege('anon', 'whatsapp_sair(text,text)', 'execute'), 'SAIR continua só do servidor');
rollback;
