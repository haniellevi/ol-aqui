\set ON_ERROR_STOP on
\set QUIET on
-- VOLTAR pelo WhatsApp (29/11/2026): SAIR com o texto novo, uma pergunta a cada 7 dias (só com o Radar ligado),
-- SIM só com pergunta pendente, VOLTAR com chave geral desligada, sino do app desligado (não é mexido),
-- quem nunca teve o aviso, número sem conta ou não confirmado, conta revogada, limite de 3 respostas por dia,
-- mensagem repetida (bot) em 1 dia, respostas fora da janela (verificação e Radar à parte) e permissões.
-- A janela de tempo é simulada mudando criado_em. Tudo numa transação que volta no fim.
begin;
reset role;

create function pg_temp.confere870(ok boolean, caso text) returns void language plpgsql as $$
begin
  if ok is not true then raise exception 'Falhou: %', caso; end if;
end $$;
-- Resumo do texto, como o servidor manda (sha256 hexa)
create function pg_temp.h870(t text) returns text language sql as $$
  select encode(sha256(convert_to(t, 'UTF8')), 'hex')
$$;

select id as reg from microrregioes where slug = 'corrente-pi' \gset

-- Chave geral ligada para os casos de volta (começa desligada só para os preparativos).
update configuracoes set valor = 'false'::jsonb where chave = 'radar.whatsapp_ativo' and microrregiao_id is null;
insert into perfis(id, microrregiao_id, nome, cidade, whatsapp, whatsapp_verificado_em) values
  ('user_870saiu', :'reg', 'Loja 870 saiu', 'Corrente', '5589999970001', now()),
  ('user_870sem',  :'reg', 'Pessoa 870 sem aviso', 'Corrente', '5589999970002', now()),
  ('user_870nao',  :'reg', 'Pessoa 870 não confirmada', 'Corrente', '5589999970003', null),
  ('user_870lim',  :'reg', 'Loja 870 limite', 'Corrente', '5589999970004', now()),
  ('user_870pausa', :'reg', 'Loja 870 pausa', 'Corrente', '5589999970005', now()),
  ('user_870rev',  :'reg', 'Conta 870 revogada', 'Corrente', '5589999970006', now()),
  ('user_870sino', :'reg', 'Loja 870 sino desligado', 'Corrente', '5589999970007', now()),
  ('user_870sinl', :'reg', 'Loja 870 sino desligado com aviso ligado', 'Corrente', '5589999970008', now()),
  ('user_870sim',  :'reg', 'Loja 870 sim sem pergunta', 'Corrente', '5589999970009', now());
insert into preferencias_avisos (usuario_id, tipo, canal, ligado) values ('user_870nao', 'pedido_novo', 'whatsapp', false);
insert into preferencias_avisos (usuario_id, tipo, canal, ligado) values ('user_870sino', 'pedido_novo', 'app', false);
insert into preferencias_avisos (usuario_id, tipo, canal, ligado) values ('user_870sinl', 'pedido_novo', 'app', false);
insert into preferencias_avisos (usuario_id, tipo, canal, ligado) values ('user_870sinl', 'pedido_novo', 'whatsapp', true);
insert into whatsapp_respostas (usuario_id, comando) values ('user_870nao', 'SAIR');
insert into contas_revogadas (usuario_id) values ('user_870rev');
update configuracoes set valor = 'true'::jsonb where chave = 'radar.whatsapp_ativo' and microrregiao_id is null;

-- [1] SAIR: desliga o aviso no WhatsApp e a confirmação já traz a volta
set local role service_role;
select whatsapp_sair('5589999970001', 'SAIR') as achou \gset
reset role;
select pg_temp.confere870(:'achou' = 't', 'SAIR acha a conta de quem mandou');
select pg_temp.confere870((select ligado = false from preferencias_avisos where usuario_id = 'user_870saiu' and tipo = 'pedido_novo' and canal = 'whatsapp'), 'SAIR desliga o aviso no WhatsApp');
select pg_temp.confere870((select count(*) = 1 from whatsapp_fila where chave like 'whatsapp_saida:5589999970001:%'
  and texto = 'Pronto. Você não vai mais receber pedidos do Radar pelo WhatsApp. Para voltar, responda VOLTAR aqui ou ligue em Minha conta > Notificações.'
  and estado = 'pendente' and link is null), 'confirmação do SAIR com o texto novo, uma só, pendente e sem link');

-- [2] Outra mensagem depois do SAIR faz a pergunta UMA vez; a mesma mensagem de novo é repetida (nada);
-- outra mensagem no mesmo período não pergunta de novo
set local role service_role;
select whatsapp_mensagem_recebida('5589999970001', 'outra', pg_temp.h870('oi')) as p1 \gset
select whatsapp_mensagem_recebida('5589999970001', 'outra', pg_temp.h870('oi')) as p_rep \gset
select whatsapp_mensagem_recebida('5589999970001', 'outra', pg_temp.h870('quero um sofá')) as p2 \gset
reset role;
select pg_temp.confere870(:'p1' = 'pergunta', 'outra mensagem depois do SAIR faz a pergunta de volta');
select pg_temp.confere870(:'p_rep' = 'mensagem_repetida', 'mesma mensagem logo em seguida: não responde');
select pg_temp.confere870(:'p2' = 'ja_perguntou', 'outra mensagem no mesmo período: não pergunta de novo');
select pg_temp.confere870((select count(*) = 1 and bool_and(texto = 'Oi! Você pediu para não receber pedidos do Radar pelo WhatsApp. Quer voltar a receber? Responda SIM.' and estado = 'pendente' and link is null)
  from whatsapp_fila where chave like 'whatsapp_resposta:5589999970001:pergunta:%'), 'pergunta na fila uma vez, com o texto certo');
select pg_temp.confere870((select count(*) = 1 from whatsapp_respostas where usuario_id = 'user_870saiu' and comando = 'PERGUNTA_VOLTAR'), 'pergunta registrada no banco');

-- [3] Pergunta com mais de 7 dias não vale como SIM: o SIM não faz nada; outra mensagem gera a pergunta de novo
delete from whatsapp_fila where chave like 'whatsapp_resposta:5589999970001:%';
update whatsapp_respostas set criado_em = now() - interval '8 days' where usuario_id = 'user_870saiu' and comando = 'PERGUNTA_VOLTAR';
set local role service_role;
select whatsapp_mensagem_recebida('5589999970001', 'sim', pg_temp.h870('sim')) as s_vencida \gset
select whatsapp_mensagem_recebida('5589999970001', 'outra', pg_temp.h870('tudo bem')) as p_nova \gset
reset role;
select pg_temp.confere870(:'s_vencida' = 'nada', 'SIM depois de 7 dias não ativa e não faz nada');
select pg_temp.confere870(:'p_nova' = 'pergunta', 'depois de 7 dias, outra mensagem gera a pergunta de novo');
select pg_temp.confere870((select ligado = false from preferencias_avisos where usuario_id = 'user_870saiu' and tipo = 'pedido_novo' and canal = 'whatsapp'), 'SIM vencido não liga o aviso');
select pg_temp.confere870((select count(*) = 0 from whatsapp_respostas where usuario_id = 'user_870saiu' and comando = 'VOLTAR'), 'SIM vencido não registra volta');

-- [4] SIM depois de uma pergunta pendente liga o aviso no WhatsApp e registra a volta; o sino do app não é mexido
set local role service_role;
select whatsapp_mensagem_recebida('5589999970001', 'sim', pg_temp.h870('sim')) as s_volta \gset
reset role;
select pg_temp.confere870(:'s_volta' = 'voltou', 'SIM com pergunta pendente volta a receber');
select pg_temp.confere870((select ligado from preferencias_avisos where usuario_id = 'user_870saiu' and tipo = 'pedido_novo' and canal = 'whatsapp'), 'aviso do WhatsApp ligado');
select pg_temp.confere870((select count(*) = 0 from preferencias_avisos where usuario_id = 'user_870saiu' and canal = 'app'), 'o sino do app não é criado nem mexido pela volta');
select pg_temp.confere870((select count(*) = 1 from whatsapp_respostas where usuario_id = 'user_870saiu' and comando = 'VOLTAR'), 'volta registrada uma vez');
select pg_temp.confere870((select count(*) = 1 and bool_and(texto = 'Pronto! Você volta a receber pedidos do Radar pelo WhatsApp, das 8h às 20h. Para parar, responda SAIR.' and numero = '5589999970001')
  from whatsapp_fila where chave like 'whatsapp_resposta:5589999970001:voltar%'), 'confirmação da volta na fila, para o número que mandou');

-- [5] Depois de voltar, SIM sem pergunta pendente não faz nada. VOLTAR de quem já recebe responde "já recebe",
-- mas o limite de 3 respostas do dia (saída, pergunta e volta) segura essa resposta.
set local role service_role;
select whatsapp_mensagem_recebida('5589999970001', 'sim', pg_temp.h870('sim de novo')) as s_sem \gset
select whatsapp_mensagem_recebida('5589999970001', 'voltar', pg_temp.h870('voltar')) as v_ja \gset
reset role;
select pg_temp.confere870(:'s_sem' = 'nada', 'SIM sem pergunta pendente não faz nada');
select pg_temp.confere870(:'v_ja' = 'ja_ativo', 'VOLTAR de quem já recebe: já recebe');
select pg_temp.confere870((select count(*) = 3 from whatsapp_fila where numero = '5589999970001'
  and (chave like 'whatsapp_saida:%' or chave like 'whatsapp_resposta:%')), 'limite de 3 respostas por dia: a quarta não sai');

-- [6] Chave geral desligada: VOLTAR responde que está pausado e não liga; com a chave ligada de novo, a volta funciona
set local role service_role;
select whatsapp_sair('5589999970005', 'PARAR') as saiu_pausa \gset
reset role;
update configuracoes set valor = 'false'::jsonb where chave = 'radar.whatsapp_ativo' and microrregiao_id is null;
set local role service_role;
select whatsapp_mensagem_recebida('5589999970005', 'voltar', pg_temp.h870('voltar')) as pausado \gset
reset role;
select pg_temp.confere870((select ligado = false from preferencias_avisos where usuario_id = 'user_870pausa' and tipo = 'pedido_novo' and canal = 'whatsapp'), 'chave desligada: VOLTAR não liga o aviso');
select pg_temp.confere870((select count(*) = 0 from whatsapp_respostas where usuario_id = 'user_870pausa' and comando = 'VOLTAR'), 'chave desligada: volta não é registrada');
select pg_temp.confere870(:'pausado' = 'pausado' and (select count(*) = 1 from whatsapp_fila where chave like 'whatsapp_resposta:5589999970005:pausado:%'
  and texto = 'No momento os avisos do Radar pelo WhatsApp estão pausados.'), 'chave desligada: responde que está pausado, uma vez');
update configuracoes set valor = 'true'::jsonb where chave = 'radar.whatsapp_ativo' and microrregiao_id is null;
set local role service_role;
select whatsapp_mensagem_recebida('5589999970005', 'voltar', pg_temp.h870('quero voltar')) as voltou_pausa \gset
reset role;
select pg_temp.confere870(:'voltou_pausa' = 'voltou' and (select ligado from preferencias_avisos where usuario_id = 'user_870pausa' and tipo = 'pedido_novo' and canal = 'whatsapp'),
  'com a chave ligada, a volta funciona');

-- [7] Quem nunca teve o aviso: VOLTAR recebe a orientação (uma vez por dia) e não é ligado; SIM e outra mensagem não fazem nada
set local role service_role;
select whatsapp_mensagem_recebida('5589999970002', 'voltar', pg_temp.h870('voltar')) as o1 \gset
select whatsapp_mensagem_recebida('5589999970002', 'voltar', pg_temp.h870('ativar')) as o2 \gset
select whatsapp_mensagem_recebida('5589999970002', 'sim', pg_temp.h870('sim')) as o3 \gset
select whatsapp_mensagem_recebida('5589999970002', 'outra', pg_temp.h870('oi')) as o4 \gset
reset role;
select pg_temp.confere870(:'o1' = 'orientacao' and :'o2' = 'orientacao', 'VOLTAR de quem nunca teve o aviso: orientação');
select pg_temp.confere870((select count(*) = 1 from whatsapp_fila where chave like 'whatsapp_resposta:5589999970002:orientacao:%'
  and texto = 'Para receber pedidos do Radar no WhatsApp, ligue em Minha conta > Notificações no Mercado da Região.'), 'orientação uma vez por dia, com o texto certo');
select pg_temp.confere870((select count(*) = 0 from preferencias_avisos where usuario_id = 'user_870sem'), 'quem nunca teve o aviso não ganha preferência');
select pg_temp.confere870((select count(*) = 0 from whatsapp_respostas where usuario_id = 'user_870sem'), 'quem nunca teve o aviso não registra volta nem pergunta');
select pg_temp.confere870(:'o3' = 'nada' and :'o4' = 'nada', 'SIM e outra mensagem de quem nunca saiu não fazem nada');

-- [8] Número sem conta, conta não confirmada ou conta revogada: nada, nenhuma resposta, nada registrado
set local role service_role;
select whatsapp_mensagem_recebida('5589999970003', 'outra', pg_temp.h870('oi')) as n1 \gset
select whatsapp_mensagem_recebida('5589999970003', 'voltar', pg_temp.h870('voltar')) as n2 \gset
select whatsapp_mensagem_recebida('5589999979999', 'voltar', pg_temp.h870('voltar')) as n3 \gset
select whatsapp_mensagem_recebida('5589999979999', 'outra', pg_temp.h870('oi')) as n4 \gset
select whatsapp_mensagem_recebida('5589999970006', 'outra', pg_temp.h870('oi')) as n5 \gset
reset role;
select pg_temp.confere870(:'n1' = 'sem_conta' and :'n2' = 'sem_conta' and :'n3' = 'sem_conta' and :'n4' = 'sem_conta' and :'n5' = 'sem_conta', 'sem conta, não confirmada ou revogada: sem_conta');
select pg_temp.confere870((select count(*) = 0 from whatsapp_fila where numero in ('5589999970003', '5589999979999', '5589999970006')), 'nenhuma resposta para esses números');
select pg_temp.confere870((select count(*) = 0 from whatsapp_ultima_mensagem where numero in ('5589999970003', '5589999979999', '5589999970006')), 'nenhum resumo guardado para esses números');
select pg_temp.confere870((select count(*) = 1 and bool_and(ligado = false) from preferencias_avisos where usuario_id = 'user_870nao'), 'conta não confirmada: preferência intacta');
select pg_temp.confere870((select count(*) = 0 from whatsapp_respostas where usuario_id in ('user_870nao', 'user_870rev') and comando = 'VOLTAR'), 'nada registrado para essas contas');

-- [9] Limite de 3 respostas automáticas por número e dia: saída (1), pergunta (2), pausado (3); a volta fica registrada,
-- mas a resposta dela não sai pelo limite
set local role service_role;
select whatsapp_sair('5589999970004', 'SAIR') as l0 \gset
select whatsapp_mensagem_recebida('5589999970004', 'outra', pg_temp.h870('oi')) as l1 \gset
reset role;
update configuracoes set valor = 'false'::jsonb where chave = 'radar.whatsapp_ativo' and microrregiao_id is null;
set local role service_role;
select whatsapp_mensagem_recebida('5589999970004', 'voltar', pg_temp.h870('voltar')) as l2 \gset
select whatsapp_mensagem_recebida('5589999970004', 'outra', pg_temp.h870('tudo')) as l3 \gset
reset role;
update configuracoes set valor = 'true'::jsonb where chave = 'radar.whatsapp_ativo' and microrregiao_id is null;
set local role service_role;
select whatsapp_mensagem_recebida('5589999970004', 'voltar', pg_temp.h870('quero voltar')) as l4 \gset
select whatsapp_mensagem_recebida('5589999970004', 'outra', pg_temp.h870('oi de novo')) as l5 \gset
reset role;
select pg_temp.confere870(:'l1' = 'pergunta' and :'l2' = 'pausado' and :'l3' = 'nada' and :'l4' = 'voltou' and :'l5' = 'nada',
  'sequência de respostas da conta de limite');
select pg_temp.confere870((select count(*) = 3 from whatsapp_fila where numero = '5589999970004'
  and (chave like 'whatsapp_saida:%' or chave like 'whatsapp_resposta:%')), 'no máximo 3 respostas automáticas no dia para o mesmo número');
select pg_temp.confere870((select count(*) = 1 from whatsapp_respostas where usuario_id = 'user_870lim' and comando = 'VOLTAR')
  and (select ligado from preferencias_avisos where usuario_id = 'user_870lim' and tipo = 'pedido_novo' and canal = 'whatsapp'),
  'o limite segura só a resposta: a volta acontece e fica registrada');

-- [10] Fora da janela de 8h às 20h (madrugada): respostas automáticas saem mesmo sem o Radar ligado;
-- aviso de verificação espera; aviso do Radar sem pedido é cancelado. Dentro da janela (manhã), a verificação sai.
insert into whatsapp_fila(usuario_id, numero, texto, link, chave, enviar_apos) values
  ('user_870sem', '5589999970002', 'Aviso de verificação 870', '/minha-conta', 'teste-870-verificacao', now()),
  ('user_870lim', '5589999970004', 'Radar 870 fora da janela', '/radar/x', 'radar_pedido_novo:87000000-0000-4000-a000-000000000001:vit870', now());
update configuracoes set valor = 'false'::jsonb where chave = 'radar.whatsapp_ativo' and microrregiao_id is null;
do $$
declare
  madrugada timestamptz := (date_trunc('day', now() at time zone 'America/Fortaleza') + interval '1 day 3 hours') at time zone 'America/Fortaleza';
  i integer;
begin
  for i in 1..10 loop
    perform whatsapp_fila_pegar_em(5, madrugada);
  end loop;
end $$;
select pg_temp.confere870((select count(*) = 3 from whatsapp_fila where numero = '5589999970004'
  and (chave like 'whatsapp_saida:%' or chave like 'whatsapp_resposta:%') and estado = 'enviando'), 'madrugada: as respostas automáticas saem mesmo com o Radar desligado');
select pg_temp.confere870((select estado = 'pendente' from whatsapp_fila where chave = 'teste-870-verificacao'), 'madrugada: aviso de verificação espera');
select pg_temp.confere870((select estado = 'cancelada' and erro = 'pedido_fechado' from whatsapp_fila where chave like 'radar_pedido_novo:87000000%'), 'madrugada: aviso do Radar sem pedido aberto é cancelado');
select pg_temp.confere870(whatsapp_fila_confirmar_envio((select id from whatsapp_fila where chave = 'whatsapp_saida:5589999970004:' || to_char(now() at time zone 'America/Fortaleza', 'YYYY-MM-DD'))) = 'pode',
  'conferência antes do envio deixa passar a resposta automática');
update configuracoes set valor = 'true'::jsonb where chave = 'radar.whatsapp_ativo' and microrregiao_id is null;
do $$
declare
  manha timestamptz := (date_trunc('day', now() at time zone 'America/Fortaleza') + interval '1 day 10 hours') at time zone 'America/Fortaleza';
  i integer;
begin
  for i in 1..10 loop
    perform whatsapp_fila_pegar_em(5, manha);
  end loop;
end $$;
select pg_temp.confere870((select estado = 'enviando' from whatsapp_fila where chave = 'teste-870-verificacao'), 'dentro da janela: aviso de verificação sai, sem mudança no Radar');

-- [11] Sino do pedido novo no app desligado: a volta não liga o WhatsApp nem mexe no sino; responde para ligar o sino antes.
-- Quem tem o WhatsApp ligado mas o sino desligado também não recebe "já recebe".
set local role service_role;
select whatsapp_sair('5589999970007', 'SAIR') as sino_saiu \gset
select whatsapp_mensagem_recebida('5589999970007', 'voltar', pg_temp.h870('voltar')) as sino1 \gset
select whatsapp_mensagem_recebida('5589999970008', 'voltar', pg_temp.h870('voltar')) as sino2 \gset
reset role;
select pg_temp.confere870(:'sino1' = 'sino_desligado' and :'sino2' = 'sino_desligado', 'sino desligado: volta e já recebe viram aviso para ligar o sino');
select pg_temp.confere870((select ligado = false from preferencias_avisos where usuario_id = 'user_870sino' and tipo = 'pedido_novo' and canal = 'whatsapp')
  and (select ligado = false from preferencias_avisos where usuario_id = 'user_870sino' and tipo = 'pedido_novo' and canal = 'app'),
  'sino desligado: nada é ligado sem a pessoa pedir');
select pg_temp.confere870((select count(*) = 0 from whatsapp_respostas where usuario_id = 'user_870sino' and comando = 'VOLTAR'), 'sino desligado: volta não registrada');
select pg_temp.confere870((select count(*) = 1 from whatsapp_fila where chave like 'whatsapp_resposta:5589999970007:sino:%'
  and texto like 'Para voltar a receber pedidos do Radar pelo WhatsApp, ligue antes o aviso de pedido novo no app%'), 'sino desligado: resposta pede para ligar o sino, uma vez');
select pg_temp.confere870((select count(*) = 0 from whatsapp_fila where numero = '5589999970008' and chave like '%ja_ativo%'), 'WhatsApp ligado e sino desligado: não diz que já recebe');
update preferencias_avisos set ligado = true where usuario_id = 'user_870sino' and canal = 'app';
set local role service_role;
select whatsapp_mensagem_recebida('5589999970007', 'voltar', pg_temp.h870('quero voltar')) as sino3 \gset
reset role;
select pg_temp.confere870(:'sino3' = 'voltou' and (select ligado from preferencias_avisos where usuario_id = 'user_870sino' and tipo = 'pedido_novo' and canal = 'whatsapp'),
  'com o sino ligado pela pessoa, a volta funciona');

-- [12] SAIR e SIM logo depois: SIM sem pergunta pendente não faz nada (nem pergunta, nem volta)
set local role service_role;
select whatsapp_sair('5589999970009', 'SAIR') as sim_saiu \gset
select whatsapp_mensagem_recebida('5589999970009', 'sim', pg_temp.h870('sim')) as sim_sem \gset
reset role;
select pg_temp.confere870(:'sim_sem' = 'nada', 'SAIR e SIM logo depois: nada');
select pg_temp.confere870((select count(*) = 1 from whatsapp_fila where numero = '5589999970009'), 'SAIR e SIM logo depois: só a confirmação do SAIR na fila');
select pg_temp.confere870((select count(*) = 0 from whatsapp_respostas where usuario_id = 'user_870sim' and comando in ('VOLTAR', 'PERGUNTA_VOLTAR')), 'SAIR e SIM logo depois: nada registrado');

-- [13] Mensagem repetida (bot): mesma mensagem em até 1 dia não responde; depois de 1 dia, vale de novo
set local role service_role;
select whatsapp_mensagem_recebida('5589999970009', 'outra', pg_temp.h870('oi')) as r1 \gset
select whatsapp_mensagem_recebida('5589999970009', 'outra', pg_temp.h870('oi')) as r2 \gset
reset role;
select pg_temp.confere870(:'r1' = 'pergunta' and :'r2' = 'mensagem_repetida', 'bot repetindo a mesma mensagem: uma pergunta e nada depois');
select pg_temp.confere870((select count(*) = 1 from whatsapp_fila where chave like 'whatsapp_resposta:5589999970009:pergunta:%'), 'bot repetindo: a pergunta sai uma vez');
update whatsapp_ultima_mensagem set recebido_em = now() - interval '25 hours' where numero = '5589999970009';
set local role service_role;
select whatsapp_mensagem_recebida('5589999970009', 'outra', pg_temp.h870('oi')) as r3 \gset
reset role;
select pg_temp.confere870(:'r3' = 'ja_perguntou', 'mesma mensagem depois de 1 dia: volta a valer (aqui, a pergunta já foi feita no período)');
select pg_temp.confere870((select count(*) = 0 from information_schema.columns where table_schema = 'public' and table_name = 'whatsapp_ultima_mensagem'
  and column_name not in ('numero', 'hash', 'recebido_em')), 'o resumo guardado não tem texto nem outra coluna');

-- [15] Quem mexeu no aviso pelo site depois da saída: a decisão mais nova vale. Saiu, ligou pelo site e desligou pelo site
-- de novo: não recebe pergunta (a última decisão foi do site, não a saída). Ligar pelo site não é volta pelo WhatsApp.
insert into perfis(id, microrregiao_id, nome, cidade, whatsapp, whatsapp_verificado_em) values
  ('user_870site', :'reg', 'Loja 870 mexeu no site', 'Corrente', '5589999970010', now());
set local role service_role;
select whatsapp_sair('5589999970010', 'SAIR') as site_saiu \gset
reset role;
update preferencias_avisos set ligado = true, atualizado_em = clock_timestamp() where usuario_id = 'user_870site' and tipo = 'pedido_novo' and canal = 'whatsapp';
update preferencias_avisos set ligado = false, atualizado_em = clock_timestamp() where usuario_id = 'user_870site' and tipo = 'pedido_novo' and canal = 'whatsapp';
set local role service_role;
select whatsapp_mensagem_recebida('5589999970010', 'outra', pg_temp.h870('oi')) as site_msg \gset
reset role;
select pg_temp.confere870(:'site_msg' = 'nada', 'desligou pelo site depois da saída: a mensagem não gera pergunta');
select pg_temp.confere870((select count(*) = 0 from whatsapp_respostas where usuario_id = 'user_870site' and comando = 'PERGUNTA_VOLTAR'), 'desligou pelo site: nada registrado como pergunta');

-- [14] Permissões: a decisão é só do servidor; a conta e o visitante não chamam; a resposta automática é interna
select pg_temp.confere870(has_function_privilege('service_role', 'whatsapp_mensagem_recebida(text,text,text)', 'execute'), 'decisão do WhatsApp é do servidor');
select pg_temp.confere870(not has_function_privilege('authenticated', 'whatsapp_mensagem_recebida(text,text,text)', 'execute')
  and not has_function_privilege('anon', 'whatsapp_mensagem_recebida(text,text,text)', 'execute'), 'decisão do WhatsApp fechada para a conta e para o visitante');
select pg_temp.confere870(not has_function_privilege('service_role', 'whatsapp_resposta_automatica(text,text,text,text)', 'execute')
  and not has_function_privilege('authenticated', 'whatsapp_resposta_automatica(text,text,text,text)', 'execute')
  and not has_function_privilege('anon', 'whatsapp_resposta_automatica(text,text,text,text)', 'execute'), 'resposta automática é interna');
select pg_temp.confere870(not has_function_privilege('authenticated', 'whatsapp_sair(text,text)', 'execute'), 'SAIR continua fechado para a conta');
select pg_temp.confere870(not has_table_privilege('service_role', 'whatsapp_ultima_mensagem', 'select')
  and not has_table_privilege('authenticated', 'whatsapp_ultima_mensagem', 'select')
  and not has_table_privilege('anon', 'whatsapp_ultima_mensagem', 'select'), 'resumo das mensagens é só da função do servidor');
rollback;
