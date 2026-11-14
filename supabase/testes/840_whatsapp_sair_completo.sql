\set ON_ERROR_STOP on
\set QUIET on
-- SAIR à prova de falha: conferência logo antes de enviar (chave geral, preferência, pedido aberto, prazo e vaga),
-- corrida com SAIR durante o envio, uma resposta de confirmação por número e dia (sai fora da janela, o Radar não a
-- cancela), sem conta não responde, e permissões. Horários fixos onde a janela importa; o resto usa now().
begin;
reset role;

create function pg_temp.confere840(ok boolean, caso text) returns void language plpgsql as $$
begin
  if ok is not true then raise exception 'Falhou: %', caso; end if;
end $$;
create function pg_temp.recusa840(comando text, codigo text) returns void language plpgsql as $$
begin
  begin execute comando;
  exception when others then
    if sqlstate = codigo then return; end if;
    raise exception 'Estado inesperado: %, esperado %: %', sqlstate, codigo, sqlerrm;
  end;
  raise exception 'Comando aceito indevidamente: %', comando;
end $$;

select id as reg from microrregioes where slug = 'corrente-pi' \gset

-- Chave geral do aviso do Radar ligada só neste teste (a transação desfaz). Começa desligada para as preparações.
update configuracoes set valor = 'false'::jsonb where chave = 'radar.whatsapp_ativo' and microrregiao_id is null;

insert into perfis(id, microrregiao_id, nome, cidade, whatsapp, whatsapp_verificado_em) values
  ('user_840comprador', :'reg', 'Comprador 840', 'Corrente', '5589999960100', now()),
  ('user_840loja',      :'reg', 'Loja 840 um', 'Corrente', '5589999960001', now()),
  ('user_840outra',     :'reg', 'Loja 840 dois', 'Corrente', '5589999960002', now());
insert into preferencias_avisos (usuario_id, tipo, canal, ligado) values
  ('user_840loja', 'pedido_novo', 'whatsapp', true),
  ('user_840outra', 'pedido_novo', 'whatsapp', true);
insert into radar_pedidos (id, comprador_id, microrregiao_id, titulo, cidade, status, expira_em, modo_contato, propostas_ate, max_propostas, total_propostas)
values ('84000000-0000-4000-a000-000000000001', 'user_840comprador', :'reg', 'Procuro sofá para teste 840', 'Corrente',
        'aberto', now() + interval '10 days', 'propostas_prazo', now() + interval '3 days', 10, 0);

-- [1] Conferência: aviso do Radar com tudo de acordo sai ("pode") e continua "enviando"
update configuracoes set valor = 'true'::jsonb where chave = 'radar.whatsapp_ativo' and microrregiao_id is null;
insert into whatsapp_fila(id, usuario_id, numero, texto, link, chave, enviar_apos, estado, tentativas) values
  ('84000000-0000-4000-a000-0000000000a1', 'user_840loja', '5589999960001', 'Aviso Radar 840 um', '/radar/x',
   'radar_pedido_novo:84000000-0000-4000-a000-000000000001:84000000-0000-4000-a000-0000000000f1', now(), 'enviando', 1);
select whatsapp_fila_confirmar_envio('84000000-0000-4000-a000-0000000000a1') as d1 \gset
select pg_temp.confere840(:'d1' = 'pode', 'aviso do Radar com tudo de acordo pode sair');
select pg_temp.confere840((select estado = 'enviando' from whatsapp_fila where id = '84000000-0000-4000-a000-0000000000a1'), 'conferir não muda o estado quando pode sair');

-- [2] Corrida: SAIR chega enquanto a mensagem está "enviando". SAIR não mexe em "enviando" (só em pendente),
-- então a conferência logo antes do envio é que segura a mensagem.
set local role service_role;
select whatsapp_sair('5589999960001', 'SAIR') as achou \gset
reset role;
select pg_temp.confere840(:'achou' = 't', 'SAIR acha a conta de quem respondeu');
select pg_temp.confere840((select estado = 'enviando' from whatsapp_fila where id = '84000000-0000-4000-a000-0000000000a1'), 'SAIR não altera mensagem já "enviando"');
select whatsapp_fila_confirmar_envio('84000000-0000-4000-a000-0000000000a1') as d2 \gset
select pg_temp.confere840(:'d2' = 'cancelada', 'SAIR durante o envio: a conferência cancela antes de enviar');
select pg_temp.confere840((select estado = 'cancelada' and erro = 'radar_desligado' from whatsapp_fila where id = '84000000-0000-4000-a000-0000000000a1'),
  'cancelada com o motivo radar_desligado');
select whatsapp_fila_confirmar_envio('84000000-0000-4000-a000-0000000000a1') as d2b \gset
select pg_temp.confere840(:'d2b' = 'ignorada', 'linha já cancelada não é enviada de novo (ignorada)');

-- [3] Resposta de confirmação: uma por número e dia, com o texto exato, na fila, sem ser cancelada pelo Radar
select pg_temp.confere840((select count(*) = 1 from whatsapp_fila where chave like 'whatsapp_saida:5589999960001:%'), 'SAIR põe UMA resposta na fila');
select pg_temp.confere840((select texto = 'Pronto. Você não vai mais receber pedidos do Radar pelo WhatsApp. Para voltar, ligue o aviso em Minha conta > Avisos no Mercado da Região.'
  and numero = '5589999960001' and usuario_id = 'user_840loja' and estado = 'pendente' and link is null
  from whatsapp_fila where chave like 'whatsapp_saida:5589999960001:%'), 'resposta com o texto exato, para o número que mandou, pendente e sem link');
select pg_temp.confere840((select chave ~ '^whatsapp_saida:5589999960001:[0-9]{4}-[0-9]{2}-[0-9]{2}$' from whatsapp_fila where chave like 'whatsapp_saida:5589999960001:%'),
  'chave da resposta: número com 9 e dia');
select pg_temp.confere840((select count(*) = 1 from whatsapp_respostas where usuario_id = 'user_840loja'), 'SAIR fica registrado (sem número nem texto)');

-- [4] Dedup: outra saída no mesmo dia (forma sem o 9) não põe segunda resposta
set local role service_role;
select whatsapp_sair('558999960001', 'PARAR') as achou_sem_nove \gset
reset role;
select pg_temp.confere840(:'achou_sem_nove' = 't', 'PARAR sem o 9 acha a mesma conta');
select pg_temp.confere840((select count(*) = 1 from whatsapp_fila where chave like 'whatsapp_saida:5589999960001:%'), 'mesmo número e dia: uma resposta só');
select pg_temp.confere840((select count(*) = 2 from whatsapp_respostas where usuario_id = 'user_840loja'), 'as duas saídas ficam registradas');

-- [5] Sem conta: nada acontece, nenhuma resposta e nada registrado
set local role service_role;
select whatsapp_sair('5589999999999', 'SAIR') as sem_conta \gset
reset role;
select pg_temp.confere840(:'sem_conta' = 'f', 'número sem conta: não acha ninguém');
select pg_temp.confere840((select count(*) = 0 from whatsapp_fila where numero = '5589999999999'), 'número sem conta não recebe resposta');
select pg_temp.confere840((select count(*) = 2 from whatsapp_respostas where usuario_id = 'user_840loja'), 'número sem conta não registra nada');

-- [6] Pedido de quem ainda liga o aviso: fechado, prazo passado, vaga cheia, chave geral, preferência
insert into whatsapp_fila(id, usuario_id, numero, texto, link, chave, enviar_apos, estado, tentativas) values
  ('84000000-0000-4000-a000-0000000000b1', 'user_840outra', '5589999960002', 'Aviso fechado', '/radar/x', 'radar_pedido_novo:84000000-0000-4000-a000-000000000001:vit840-b1', now(), 'enviando', 1),
  ('84000000-0000-4000-a000-0000000000b2', 'user_840outra', '5589999960002', 'Aviso prazo', '/radar/x', 'radar_pedido_novo:84000000-0000-4000-a000-000000000001:vit840-b2', now(), 'enviando', 1),
  ('84000000-0000-4000-a000-0000000000b3', 'user_840outra', '5589999960002', 'Aviso vaga', '/radar/x', 'radar_pedido_novo:84000000-0000-4000-a000-000000000001:vit840-b3', now(), 'enviando', 1),
  ('84000000-0000-4000-a000-0000000000b4', 'user_840outra', '5589999960002', 'Aviso chave geral', '/radar/x', 'radar_pedido_novo:84000000-0000-4000-a000-000000000001:vit840-b4', now(), 'enviando', 1),
  ('84000000-0000-4000-a000-0000000000b5', 'user_840outra', '5589999960002', 'Aviso sem preferência', '/radar/x', 'radar_pedido_novo:84000000-0000-4000-a000-000000000001:vit840-b5', now(), 'enviando', 1);

update radar_pedidos set status = 'encerrado' where id = '84000000-0000-4000-a000-000000000001';
select whatsapp_fila_confirmar_envio('84000000-0000-4000-a000-0000000000b1') as d_fechado \gset
select pg_temp.confere840(:'d_fechado' = 'cancelada' and (select erro from whatsapp_fila where id = '84000000-0000-4000-a000-0000000000b1') = 'pedido_fechado',
  'pedido encerrado: não sai, motivo pedido_fechado');
update radar_pedidos set status = 'aberto' where id = '84000000-0000-4000-a000-000000000001';

update radar_pedidos set propostas_ate = now() - interval '1 minute' where id = '84000000-0000-4000-a000-000000000001';
select whatsapp_fila_confirmar_envio('84000000-0000-4000-a000-0000000000b2') as d_prazo \gset
select pg_temp.confere840(:'d_prazo' = 'cancelada' and (select erro from whatsapp_fila where id = '84000000-0000-4000-a000-0000000000b2') = 'pedido_fechado',
  'prazo de propostas acabou: não sai, motivo pedido_fechado');
update radar_pedidos set propostas_ate = now() + interval '3 days' where id = '84000000-0000-4000-a000-000000000001';

update radar_pedidos set total_propostas = max_propostas where id = '84000000-0000-4000-a000-000000000001';
select whatsapp_fila_confirmar_envio('84000000-0000-4000-a000-0000000000b3') as d_vaga \gset
select pg_temp.confere840(:'d_vaga' = 'cancelada' and (select erro from whatsapp_fila where id = '84000000-0000-4000-a000-0000000000b3') = 'pedido_fechado',
  'limite de propostas cheio: não sai, motivo pedido_fechado');
update radar_pedidos set total_propostas = 0 where id = '84000000-0000-4000-a000-000000000001';

update configuracoes set valor = 'false'::jsonb where chave = 'radar.whatsapp_ativo' and microrregiao_id is null;
select whatsapp_fila_confirmar_envio('84000000-0000-4000-a000-0000000000b4') as d_chave \gset
select pg_temp.confere840(:'d_chave' = 'cancelada' and (select erro from whatsapp_fila where id = '84000000-0000-4000-a000-0000000000b4') = 'radar_desligado',
  'chave geral desligada: não sai, motivo radar_desligado');
update configuracoes set valor = 'true'::jsonb where chave = 'radar.whatsapp_ativo' and microrregiao_id is null;

update preferencias_avisos set ligado = false where usuario_id = 'user_840outra' and tipo = 'pedido_novo' and canal = 'whatsapp';
select whatsapp_fila_confirmar_envio('84000000-0000-4000-a000-0000000000b5') as d_pref \gset
select pg_temp.confere840(:'d_pref' = 'cancelada' and (select erro from whatsapp_fila where id = '84000000-0000-4000-a000-0000000000b5') = 'radar_desligado',
  'preferência desligada: não sai, motivo radar_desligado');
update preferencias_avisos set ligado = true where usuario_id = 'user_840outra' and tipo = 'pedido_novo' and canal = 'whatsapp';

-- [7] Mensagem que não é do Radar passa direto, mesmo com a chave geral desligada e a preferência desligada
update configuracoes set valor = 'false'::jsonb where chave = 'radar.whatsapp_ativo' and microrregiao_id is null;
insert into whatsapp_fila(id, usuario_id, numero, texto, link, chave, enviar_apos, estado, tentativas) values
  ('84000000-0000-4000-a000-0000000000c1', 'user_840outra', '5589999960002', 'Aviso de verificação 840', '/minha-conta', 'teste-840-geral', now(), 'enviando', 1);
select whatsapp_fila_confirmar_envio('84000000-0000-4000-a000-0000000000c1') as d_geral \gset
select pg_temp.confere840(:'d_geral' = 'pode', 'mensagem que não é do Radar passa na conferência');

-- [8] A resposta de saída passa na conferência mesmo com a chave geral desligada
update whatsapp_fila set estado = 'enviando' where chave like 'whatsapp_saida:5589999960001:%';
select whatsapp_fila_confirmar_envio((select id from whatsapp_fila where chave like 'whatsapp_saida:5589999960001:%')) as d_resposta \gset
select pg_temp.confere840(:'d_resposta' = 'pode', 'resposta de SAIR passa na conferência, sem o Radar');
update configuracoes set valor = 'true'::jsonb where chave = 'radar.whatsapp_ativo' and microrregiao_id is null;

-- [9] Fila fora da janela de 8h às 20h: só a resposta de SAIR sai; o Radar e os avisos de verificação esperam.
-- Instantes fixos: 22h de 12/11/2026 (Fortaleza) está fora da janela; 10h do mesmo dia está dentro.
delete from whatsapp_fila where estado in ('pendente', 'enviando') and chave not like 'whatsapp_saida:%';
update whatsapp_fila set estado = 'pendente', enviar_apos = '2026-11-12 22:00:00-03' where chave like 'whatsapp_saida:5589999960001:%';
insert into whatsapp_fila(usuario_id, numero, texto, link, chave, enviar_apos) values
  ('user_840outra', '5589999960002', 'Geral 840 fora da janela', '/minha-conta', 'teste-840-geral-fora', '2026-11-12 22:00:00-03'),
  ('user_840outra', '5589999960002', 'Radar 840 fora da janela', '/radar/x', 'radar_pedido_novo:84000000-0000-4000-a000-000000000001:vit840-z', '2026-11-12 22:00:00-03');
create temp table pegos840 as select * from whatsapp_fila_pegar_em(5, '2026-11-12 22:01:00-03'::timestamptz) with no data;
insert into pegos840 select * from whatsapp_fila_pegar_em(5, '2026-11-12 22:01:00-03'::timestamptz);
select pg_temp.confere840((select count(*) = 1 and bool_and(texto like 'Pronto.%') from pegos840), 'fora da janela (22h01): só a resposta de SAIR sai');
select pg_temp.confere840((select estado = 'pendente' from whatsapp_fila where texto = 'Geral 840 fora da janela'), 'fora da janela: aviso de verificação espera');
select pg_temp.confere840((select estado = 'pendente' from whatsapp_fila where texto = 'Radar 840 fora da janela'), 'fora da janela: aviso do Radar espera');

-- [10] Dentro da janela (10h do mesmo dia): aviso do Radar válido também sai
update whatsapp_fila set estado = 'pendente', enviar_apos = '2026-11-12 09:59:00-03' where texto = 'Radar 840 fora da janela';
delete from pegos840;
insert into pegos840 select * from whatsapp_fila_pegar_em(5, '2026-11-12 10:00:00-03'::timestamptz);
select pg_temp.confere840((select count(*) = 1 and bool_and(texto = 'Radar 840 fora da janela') from pegos840 where texto not like 'Pronto.%'), 'dentro da janela (10h): aviso do Radar válido sai');
select pg_temp.confere840((select estado = 'enviando' from whatsapp_fila where texto = 'Radar 840 fora da janela'), 'dentro da janela: o aviso sai como "enviando" e a conferência roda antes do envio');

-- [11] Permissões: conferir e SAIR só do servidor; a conta não vê nada disso
select pg_temp.confere840(not has_function_privilege('authenticated', 'whatsapp_fila_confirmar_envio(uuid)', 'execute')
  and not has_function_privilege('anon', 'whatsapp_fila_confirmar_envio(uuid)', 'execute'), 'conferência fechada para a conta e para o visitante');
select pg_temp.confere840(has_function_privilege('service_role', 'whatsapp_fila_confirmar_envio(uuid)', 'execute'), 'conferência é do servidor');
select pg_temp.confere840(not has_function_privilege('authenticated', 'whatsapp_sair(text,text)', 'execute')
  and not has_function_privilege('anon', 'whatsapp_sair(text,text)', 'execute'), 'SAIR fechado para a conta e para o visitante');
select pg_temp.confere840(not has_function_privilege('authenticated', 'whatsapp_fila_pegar_em(integer,timestamptz)', 'execute'), 'pegar com instante continua interno');
rollback;
