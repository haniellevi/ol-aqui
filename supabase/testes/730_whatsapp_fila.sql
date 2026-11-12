\set ON_ERROR_STOP on
\set QUIET on
-- Fila de WhatsApp e avisos da verificação: janela 8h-20h, chave única, destinatários da equipe, chaves desligadas,
-- avisos por transição (uma vez só), lembrete de 24 h, funções da rota de envio e permissões.
begin;
reset role;
select id as reg from microrregioes where slug='corrente-pi' \gset

create function pg_temp.confere(ok boolean, caso text) returns void language plpgsql as $$
begin
  if ok is not true then raise exception 'Falhou: %', caso; end if;
end $$;
create function pg_temp.pdf(texto text) returns text language sql as $$ select encode(convert_to('%PDF-1.7 '||texto,'UTF8'),'base64') $$;
create function pg_temp.vid(n integer) returns uuid language sql as $$ select ('73000000-0000-4000-a000-' || lpad(n::text, 12, '0'))::uuid $$;
create function pg_temp.req(n integer) returns uuid language sql security definer as $$
  select id from verificacoes_loja where vitrine_id = pg_temp.vid(n) order by criado_em desc, id desc limit 1 $$;
create function pg_temp.nova(n integer) returns uuid language plpgsql security definer as $$
declare r text;
begin
  insert into perfis(id,microrregiao_id,nome,cidade,whatsapp,whatsapp_verificado_em)
  values ('user_730x'||n, (select id from microrregioes where slug='corrente-pi'), 'Dono '||n, 'Corrente', '5589973'||lpad(n::text,6,'0'), now());
  insert into vitrines_lojas(id,dono_id,microrregiao_id,slug,nome,cidade,bairro,endereco,whatsapp,tipo)
  values (pg_temp.vid(n), 'user_730x'||n, (select id from microrregioes where slug='corrente-pi'), 'loja-730-'||n, 'Loja 730 '||n,
          'Corrente', 'Centro', 'Rua '||n, '5589974'||lpad(n::text,6,'0'), 'loja');
  r := enviar_verificacao_loja('user_730x'||n, '1122233300'||lpad(n::text,4,'0'), pg_temp.pdf('comprovante '||n), null);
  if r <> 'enviada' then raise exception 'envio da loja %: %', n, r; end if;
  return pg_temp.req(n);
end $$;
-- Passos do pedido (como o servidor faria); os estados finais não guardam arquivos.
create function pg_temp.passo(n integer, novo text, p_motivo text default null) returns void language plpgsql security definer as $$
begin
  if novo in ('aprovada','correcao','recusada','obsoleta') then
    update verificacoes_loja set status = novo, motivo = p_motivo, comprovante = null, tipo_comprovante = null, fachada = null, tipo_fachada = null
     where id = pg_temp.req(n);
  elsif novo = 'equipe' then
    update verificacoes_loja set status = 'equipe', motivos_equipe = '{nome_diferente,cnpj_duplicado}', encaminhada_em = now(), prazo_em = now() + interval '24 hours'
     where id = pg_temp.req(n);
  else
    update verificacoes_loja set status = novo where id = pg_temp.req(n);
  end if;
end $$;
create function pg_temp.avisos(n integer, p_tipo text) returns integer language sql security definer as $$
  select count(*)::integer from notificacoes where usuario_id = 'user_730x'||n and tipo = p_tipo $$;
create function pg_temp.fila() returns integer language sql security definer as $$ select count(*)::integer from whatsapp_fila $$;

-- [1] Janela: 07:59, 08:00, 19:59, 20:00 e 23:30 de Fortaleza.
select pg_temp.confere(proxima_janela_whatsapp('2026-11-12 07:59:00-03') = '2026-11-12 08:00:00-03', '07:59 espera até 08:00');
select pg_temp.confere(proxima_janela_whatsapp('2026-11-12 08:00:00-03') = '2026-11-12 08:00:00-03', '08:00 sai na hora');
select pg_temp.confere(proxima_janela_whatsapp('2026-11-12 19:59:00-03') = '2026-11-12 19:59:00-03', '19:59 sai na hora');
select pg_temp.confere(proxima_janela_whatsapp('2026-11-12 20:00:00-03') = '2026-11-13 08:00:00-03', '20:00 espera até 08:00 do dia seguinte');
select pg_temp.confere(proxima_janela_whatsapp('2026-11-12 23:30:00-03') = '2026-11-13 08:00:00-03', '23:30 espera até 08:00 do dia seguinte');
select pg_temp.confere(proxima_janela_whatsapp('2026-11-13 02:00:00+00') = '2026-11-13 08:00:00-03', '02:00 UTC é 23h do dia 12 em Fortaleza: espera');

-- [2] Fila: tabela travada, só confirmado, chave única, janela.
select pg_temp.confere((select relrowsecurity from pg_class where oid = 'whatsapp_fila'::regclass), 'fila com RLS');
select pg_temp.confere((select count(*) = 0 from pg_policies where tablename = 'whatsapp_fila'), 'fila sem policies');
insert into perfis(id,microrregiao_id,nome,cidade,whatsapp,whatsapp_verificado_em) values
  ('user_730conf', :'reg', 'Confirmado', 'Corrente', '5589975000001', now()),
  ('user_730nao',  :'reg', 'Sem confirmar', 'Corrente', '5589975000002', null),
  ('user_730sem',  :'reg', 'Sem número', 'Corrente', null, null);
select pg_temp.confere(whatsapp_enfileirar('user_730conf', 'Teste de fila', '/x', 'chave-730-a'), 'confirmado entra na fila');
select pg_temp.confere(not whatsapp_enfileirar('user_730conf', 'Teste de fila', '/x', 'chave-730-a'), 'mesma chave não entra de novo');
select pg_temp.confere(not whatsapp_enfileirar('user_730nao', 'Teste de fila', '/x', 'chave-730-b'), 'WhatsApp sem confirmação é ignorado');
select pg_temp.confere(not whatsapp_enfileirar('user_730sem', 'Teste de fila', '/x', 'chave-730-c'), 'sem número é ignorado');
select pg_temp.confere(not whatsapp_enfileirar('user_730conf', 'Teste de fila', 'sem-barra', 'chave-730-d'), 'link inválido não derruba, só não entra');
select pg_temp.confere((select count(*) = 1 and bool_and(estado = 'pendente' and tentativas = 0 and numero = '5589975000001'
    and enviar_apos >= now() - interval '1 second'
    and (enviar_apos at time zone 'America/Fortaleza')::time >= time '08:00'
    and (enviar_apos at time zone 'America/Fortaleza')::time < time '20:00') from whatsapp_fila where usuario_id = 'user_730conf'), 'fila: uma linha pendente dentro da janela');
delete from whatsapp_fila;

-- [3] Destinatários da equipe.
insert into perfis(id,microrregiao_id,nome,cidade,whatsapp,whatsapp_verificado_em,e_admin) values
  ('user_730adm',  :'reg', 'Admin', 'Corrente', '5589976000001', now(), true),
  ('user_730sup',  :'reg', 'Suporte', 'Corrente', '5589976000002', now(), false),
  ('user_730ads',  :'reg', 'Administrador da equipe', 'Corrente', '5589976000003', now(), false),
  ('user_730fra',  :'reg', 'Franqueado', 'Corrente', '5589976000004', now(), false),
  ('user_730mod',  :'reg', 'Moderador', 'Corrente', '5589976000005', now(), false),
  ('user_730fin',  :'reg', 'Financeiro', 'Corrente', '5589976000006', now(), false),
  ('user_730ina',  :'reg', 'Suporte inativo', 'Corrente', '5589976000007', now(), false),
  ('user_730snc',  :'reg', 'Suporte sem confirmar', 'Corrente', '5589976000008', null, false),
  ('user_730sns',  :'reg', 'Suporte sem número', 'Corrente', null, null, false);
insert into equipe(usuario_id,papel,microrregiao_id,ativo) values
  ('user_730sup','suporte',null,true), ('user_730ads','administrador',null,true), ('user_730fra','franqueado',:'reg',true),
  ('user_730mod','moderador',null,true), ('user_730fin','financeiro',null,true), ('user_730ina','suporte',null,false),
  ('user_730snc','suporte',null,true), ('user_730sns','suporte',null,true);
set local role service_role;
do $$
declare ids text[];
begin
  select array_agg(usuario_id order by usuario_id) into ids from verificacao_loja_destinatarios_equipe() where usuario_id like 'user_730%';
  assert ids = array['user_730adm','user_730ads','user_730sup'], 'destinatários: só admin, administrador e suporte ativos com WhatsApp confirmado: ' || coalesce(ids::text, 'nenhum');
end $$;
reset role;

-- [4] Chaves desligadas: o sino da loja sai, a fila de WhatsApp fica vazia e nada quebra.
select pg_temp.confere((select valor = 'false'::jsonb from configuracoes where chave = 'verificacao.whatsapp_loja' and microrregiao_id is null), 'whatsapp_loja começa desligada');
select pg_temp.confere((select valor = 'false'::jsonb from configuracoes where chave = 'verificacao.whatsapp_equipe' and microrregiao_id is null), 'whatsapp_equipe começa desligada');
select pg_temp.nova(1) \gset
select pg_temp.passo(1, 'equipe');
select pg_temp.passo(1, 'analisando');
select pg_temp.passo(1, 'correcao', 'cnpj_inativo');
select pg_temp.confere(pg_temp.fila() = 0, 'chaves desligadas: nada na fila');
select pg_temp.confere(pg_temp.avisos(1, 'verificacao_falta_algo') = 1, 'chaves desligadas: o sino da loja avisou a correção');
select pg_temp.confere((select texto like 'Falta algo na verificação da sua loja. O CNPJ não está ativo na Receita.%' and link = '/minha-conta/loja/verificar' and chave = 'verificacao_falta_algo:' || pg_temp.req(1)
    from notificacoes where usuario_id = 'user_730x1' and tipo = 'verificacao_falta_algo'), 'texto, link e chave do aviso de correção');

-- [5] Chaves ligadas: loja e equipe entram na fila.
update configuracoes set valor = 'true'::jsonb where chave in ('verificacao.whatsapp_loja', 'verificacao.whatsapp_equipe') and microrregiao_id is null;
select pg_temp.nova(2) \gset
select pg_temp.passo(2, 'equipe');
select pg_temp.confere((select count(*) = 3 and bool_and(texto = 'Verificação de loja precisa de você: Loja 730 2 (Corrente). Motivo: nome diferente, CNPJ em outra loja.' and link = '/admin/lojas#fila-lojas' and estado = 'pendente')
    from whatsapp_fila where chave like 'verificacao_equipe_chamada:' || pg_temp.req(2) || ':%'), 'equipe: um WhatsApp por destinatário com o texto certo');
select pg_temp.confere((select count(*) = 3 and count(distinct usuario_id) = 3 from whatsapp_fila where usuario_id in ('user_730adm','user_730sup','user_730ads')), 'equipe: só os três destinatários');
select pg_temp.confere(pg_temp.avisos(2, 'verificacao_equipe_chamada') = 0 and (select count(*) = 0 from notificacoes where tipo like 'verificacao_equipe%'), 'equipe não ganha aviso no sino');
-- Repetir o mesmo UPDATE, ou voltar e encaminhar de novo, não duplica.
select pg_temp.passo(2, 'equipe');
select pg_temp.passo(2, 'analisando');
select pg_temp.passo(2, 'equipe');
select pg_temp.confere((select count(*) = 3 from whatsapp_fila where chave like 'verificacao_equipe_chamada:%'), 'encaminhar de novo não duplica');
-- A loja ganha sino e WhatsApp.
select pg_temp.passo(2, 'analisando');
select pg_temp.passo(2, 'recusada', 'cnpj_nao_encontrado');
select pg_temp.confere(pg_temp.avisos(2, 'verificacao_recusada') = 1, 'recusada: um aviso no sino');
select pg_temp.confere((select count(*) = 1 and bool_and(texto = 'Não foi possível verificar sua loja. Não achamos esse CNPJ na Receita. Confira o número.' and numero = '5589973000002' and link = '/minha-conta/loja/verificar')
    from whatsapp_fila where usuario_id = 'user_730x2'), 'recusada: um WhatsApp para o dono');
select pg_temp.passo(2, 'recusada', 'cnpj_nao_encontrado');
select pg_temp.confere(pg_temp.avisos(2, 'verificacao_recusada') = 1 and (select count(*) = 1 from whatsapp_fila where usuario_id = 'user_730x2'), 'repetir o UPDATE não duplica');

-- [6] Transições da loja: uma vez cada.
select pg_temp.nova(3) \gset
select pg_temp.passo(3, 'analisando');
select pg_temp.passo(3, 'aprovada');
select pg_temp.confere(pg_temp.avisos(3, 'verificacao_aprovada') = 1, 'analisando -> aprovada: um aviso');
select pg_temp.confere((select texto = 'Sua loja foi verificada' from notificacoes where usuario_id = 'user_730x3' and tipo = 'verificacao_aprovada'), 'texto do aviso de aprovação');
select pg_temp.confere((select count(*) = 1 and bool_and(texto = 'Sua loja foi verificada') from whatsapp_fila where usuario_id = 'user_730x3'), 'aprovação: WhatsApp da loja');
select pg_temp.passo(3, 'aprovada');
select pg_temp.confere(pg_temp.avisos(3, 'verificacao_aprovada') = 1, 'repetir o UPDATE não duplica a aprovação');

select pg_temp.nova(4) \gset
select pg_temp.passo(4, 'analisando');
select pg_temp.passo(4, 'revisao_amostra');
select pg_temp.confere(pg_temp.avisos(4, 'verificacao_aprovada') = 1, 'analisando -> revisão por amostra: um aviso');
select pg_temp.passo(4, 'aprovada');
select pg_temp.confere(pg_temp.avisos(4, 'verificacao_aprovada') = 1, 'revisão por amostra -> aprovada: sem segundo aviso');

select pg_temp.nova(5) \gset
select pg_temp.passo(5, 'equipe');
select pg_temp.passo(5, 'aprovada');
select pg_temp.confere(pg_temp.avisos(5, 'verificacao_aprovada') = 1, 'equipe -> aprovada: um aviso');

select pg_temp.nova(6) \gset
select pg_temp.passo(6, 'analisando');
select pg_temp.passo(6, 'obsoleta', 'dados_mudaram');
select pg_temp.confere((select count(*) = 1 and bool_and(texto like 'Falta algo na verificação da sua loja. Os dados da loja mudaram.%') from notificacoes where usuario_id = 'user_730x6' and tipo = 'verificacao_falta_algo'), 'obsoleta: falta algo com dados_mudaram');

select pg_temp.nova(7) \gset
select pg_temp.passo(7, 'aprovada');
select pg_temp.confere(pg_temp.avisos(7, 'verificacao_aprovada') = 0, 'enviada -> aprovada direto não gera aviso de aprovação');

-- Nada de dado de documento nas mensagens.
select pg_temp.confere((select count(*) = 0 from whatsapp_fila where texto ~ '[0-9]{14}'), 'mensagens sem CNPJ nem número de documento');

-- [7] Lembrete: avisa uma vez e não repete antes de 24 h.
delete from whatsapp_fila;
select pg_temp.nova(8) \gset
select pg_temp.passo(8, 'equipe');
select pg_temp.nova(9) \gset
select pg_temp.passo(9, 'equipe');
delete from whatsapp_fila;
update verificacoes_loja set prazo_em = now() - interval '1 hour' where id = pg_temp.req(8);
select verificacao_loja_lembrar();
select pg_temp.confere((select count(*) = 3 and bool_and(texto = 'Verificação de loja passou de 24 horas: Loja 730 8.') from whatsapp_fila where chave like 'atraso:' || pg_temp.req(8) || ':%'), 'lembrete: um por destinatário');
select pg_temp.confere((select lembrete_em is not null and lembrete_em > now() - interval '1 minute' from verificacoes_loja where id = pg_temp.req(8)), 'lembrete grava lembrete_em');
select pg_temp.confere((select lembrete_em is null from verificacoes_loja where id = pg_temp.req(9)), 'pedido dentro do prazo não é lembrado');
select verificacao_loja_lembrar();
select pg_temp.confere(pg_temp.fila() = 3, 'segunda chamada seguida não repete');
update verificacoes_loja set lembrete_em = now() - interval '23 hours' where id = pg_temp.req(8);
select verificacao_loja_lembrar();
select pg_temp.confere((select lembrete_em < now() - interval '22 hours' from verificacoes_loja where id = pg_temp.req(8)) and pg_temp.fila() = 3, 'antes de 24 h não repete');
update verificacoes_loja set lembrete_em = now() - interval '25 hours' where id = pg_temp.req(8);
select verificacao_loja_lembrar();
select pg_temp.confere((select lembrete_em > now() - interval '1 minute' from verificacoes_loja where id = pg_temp.req(8)), 'depois de 24 h volta a lembrar');
-- Chave desligada: lembrete não enfileira (e não quebra).
update configuracoes set valor = 'false'::jsonb where chave = 'verificacao.whatsapp_equipe' and microrregiao_id is null;
delete from whatsapp_fila;
update verificacoes_loja set lembrete_em = null where id = pg_temp.req(8);
select verificacao_loja_lembrar();
select pg_temp.confere(pg_temp.fila() = 0, 'whatsapp_equipe desligada: lembrete não enfileira');

-- [8] Funções da rota de envio.
delete from whatsapp_fila;
insert into whatsapp_fila(usuario_id,numero,texto,link,chave,enviar_apos) values
  ('user_730conf','5589975000001','Mensagem 1','/a','pegar-1', now() - interval '7 minutes'),
  ('user_730conf','5589975000001','Mensagem 2','/a','pegar-2', now() - interval '6 minutes'),
  ('user_730conf','5589975000001','Mensagem 3','/a','pegar-3', now() - interval '5 minutes'),
  ('user_730conf','5589975000001','Mensagem 4','/a','pegar-4', now() - interval '4 minutes'),
  ('user_730conf','5589975000001','Mensagem 5','/a','pegar-5', now() - interval '3 minutes'),
  ('user_730conf','5589975000001','Mensagem 6','/a','pegar-6', now() - interval '2 minutes'),
  ('user_730conf','5589975000001','Futura','/a','pegar-7', now() + interval '1 hour');
create temp table pegas as select * from whatsapp_fila_pegar() with no data;
insert into pegas select * from whatsapp_fila_pegar();
select pg_temp.confere((select count(*) = 5 and bool_and(tentativas = 1) from pegas), 'pega no máximo 5, com a tentativa contada');
select pg_temp.confere((select string_agg(texto, ',' order by texto) = 'Mensagem 1,Mensagem 2,Mensagem 3,Mensagem 4,Mensagem 5' from pegas), 'pega as mais antigas');
select pg_temp.confere((select count(*) = 5 from whatsapp_fila where estado = 'enviando') and (select count(*) = 1 from whatsapp_fila where texto = 'Futura' and estado = 'pendente'), 'marcou enviando; a futura espera');
select whatsapp_fila_resultado((select id from pegas where texto = 'Mensagem 1'), 'enviado') as r1 \gset
select whatsapp_fila_resultado((select id from pegas where texto = 'Mensagem 2'), 'incerto') as r2 \gset
select whatsapp_fila_resultado((select id from pegas where texto = 'Mensagem 3'), 'falha') as r3 \gset
select pg_temp.confere(:'r1' = 'enviada' and :'r2' = 'incerta' and :'r3' = 'pendente', 'resultados: enviada, incerta e pendente');
select pg_temp.confere((select estado = 'enviada' and enviada_em is not null from pegas p join whatsapp_fila f using (id) where f.texto = 'Mensagem 1'), 'enviada guarda a hora');
select pg_temp.confere((select estado = 'incerta' from whatsapp_fila where texto = 'Mensagem 2'), 'incerta não volta');
select pg_temp.confere((select estado = 'pendente' and enviar_apos > now() + interval '4 minutes' and enviar_apos < now() + interval '6 minutes' from whatsapp_fila where texto = 'Mensagem 3'), 'falha volta em 5 minutos');
-- 3 falhas viram falha.
update whatsapp_fila set enviar_apos = now() - interval '1 minute' where texto = 'Mensagem 3';
select count(*) as pegou2 from whatsapp_fila_pegar() where texto = 'Mensagem 3' \gset
select whatsapp_fila_resultado((select id from pegas where texto = 'Mensagem 3'), 'falha') as r3b \gset
update whatsapp_fila set enviar_apos = now() - interval '1 minute' where texto = 'Mensagem 3';
select count(*) as pegou3 from whatsapp_fila_pegar() where texto = 'Mensagem 3' \gset
select whatsapp_fila_resultado((select id from pegas where texto = 'Mensagem 3'), 'falha') as r3c \gset
select pg_temp.confere(:'pegou2' = '1' and :'pegou3' = '1' and :'r3b' = 'pendente' and :'r3c' = 'falha'
    and (select estado = 'falha' and tentativas = 3 from whatsapp_fila where texto = 'Mensagem 3'), '3ª falha vira falha');
select whatsapp_fila_resultado((select id from pegas where texto = 'Mensagem 1'), 'falha') as r_ignorado \gset
select pg_temp.confere(:'r_ignorado' = 'ignorado' and (select estado = 'enviada' from whatsapp_fila where texto = 'Mensagem 1'), 'resultado de linha que não está enviando é ignorado');
-- "enviando" esquecida há mais de 10 minutos vira incerta, nunca pendente.
update whatsapp_fila set estado = 'enviando', enviar_apos = now() - interval '11 minutes' where texto = 'Mensagem 4';
select count(*) as nada from whatsapp_fila_pegar() where texto = 'Mensagem 4' \gset
select pg_temp.confere(:'nada' = '0' and (select estado = 'incerta' from whatsapp_fila where texto = 'Mensagem 4'), 'enviando esquecida vira incerta');

-- pegar nunca pega incerta nem falha.
select count(*) as pegou_ruins from whatsapp_fila_pegar() where texto in ('Mensagem 2', 'Mensagem 3', 'Mensagem 4') \gset
select pg_temp.confere(:'pegou_ruins' = '0', 'pegar ignora incerta e falha');
select pg_temp.confere((select estado = 'incerta' from whatsapp_fila where texto = 'Mensagem 2')
  and (select estado = 'falha' from whatsapp_fila where texto = 'Mensagem 3')
  and (select estado = 'incerta' from whatsapp_fila where texto = 'Mensagem 4'), 'incerta e falha seguem como estavam');

-- devolver: só "enviando" volta a pendente, e a tentativa contada ao pegar é desfeita.
select pg_temp.confere((select estado = 'enviando' and tentativas = 1 from whatsapp_fila where texto = 'Mensagem 5')
  and (select estado = 'enviando' and tentativas = 1 from whatsapp_fila where texto = 'Mensagem 6'), 'antes de devolver: 5 e 6 estão enviando com 1 tentativa');
select whatsapp_fila_devolver(array(select id from whatsapp_fila where texto in ('Mensagem 1', 'Mensagem 2', 'Mensagem 3', 'Mensagem 5', 'Mensagem 6'))) as devolvidas \gset
select pg_temp.confere(:'devolvidas' = '2', 'devolver conta só as que estavam enviando');
select pg_temp.confere((select count(*) = 2 and bool_and(estado = 'pendente' and tentativas = 0) from whatsapp_fila where texto in ('Mensagem 5', 'Mensagem 6')), 'devolvidas voltam a pendente sem tentativa gasta');
select pg_temp.confere((select estado = 'enviada' from whatsapp_fila where texto = 'Mensagem 1')
  and (select estado = 'incerta' from whatsapp_fila where texto = 'Mensagem 2')
  and (select estado = 'falha' from whatsapp_fila where texto = 'Mensagem 3'), 'devolver ignora enviada, incerta e falha');
select whatsapp_fila_devolver(null) as nenhuma \gset
select pg_temp.confere(:'nenhuma' = '0', 'devolver sem lista não faz nada');

-- [9] Permissões.
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_730conf',false) \g /dev/null
do $$
declare ok boolean;
begin
  begin perform 1 from whatsapp_fila; ok := false; exception when insufficient_privilege then ok := true; end;
  assert ok, 'authenticated não lê a fila';
  begin insert into whatsapp_fila(usuario_id,numero,texto) values ('user_730conf','5589975000001','oi'); ok := false; exception when insufficient_privilege then ok := true; end;
  assert ok, 'authenticated não grava na fila';
  assert not has_function_privilege('whatsapp_enfileirar(text,text,text,text)','execute'), 'enfileirar fechada';
  assert not has_function_privilege('proxima_janela_whatsapp(timestamptz)','execute'), 'janela fechada';
  assert not has_function_privilege('verificacao_avisar_loja(uuid,text,jsonb,text)','execute'), 'avisar loja fechada';
  assert not has_function_privilege('verificacao_avisar_equipe(text,jsonb,text)','execute'), 'avisar equipe fechada';
  assert not has_function_privilege('verificacao_loja_lembrar()','execute'), 'lembrar fechada';
  assert not has_function_privilege('verificacao_loja_destinatarios_equipe()','execute'), 'destinatários fechada';
  assert not has_function_privilege('whatsapp_fila_pegar(integer)','execute'), 'pegar fechada';
  assert not has_function_privilege('whatsapp_fila_resultado(uuid,text)','execute'), 'resultado fechada';
  assert not has_function_privilege('whatsapp_fila_devolver(uuid[])','execute'), 'devolver fechada';
  begin perform whatsapp_fila_devolver(array[gen_random_uuid()]); ok := false; exception when insufficient_privilege then ok := true; end;
  assert ok, 'authenticated não devolve';
  begin perform whatsapp_enfileirar('user_730conf','oi tudo','/x','chave-730-z'); ok := false; exception when insufficient_privilege then ok := true; end;
  assert ok, 'authenticated não enfileira';
end $$;
set local role anon;
do $$ begin
  assert not has_table_privilege('whatsapp_fila','select'), 'anon não lê a fila';
  assert not has_function_privilege('whatsapp_fila_pegar(integer)','execute'), 'anon não pega';
  assert not has_function_privilege('whatsapp_fila_devolver(uuid[])','execute'), 'anon não devolve';
  assert not has_function_privilege('verificacao_loja_destinatarios_equipe()','execute'), 'anon não vê destinatários';
end $$;
set local role service_role;
do $$ begin
  assert has_function_privilege('whatsapp_fila_pegar(integer)','execute');
  assert has_function_privilege('whatsapp_fila_resultado(uuid,text)','execute');
  assert has_function_privilege('whatsapp_fila_devolver(uuid[])','execute');
  assert has_function_privilege('verificacao_loja_destinatarios_equipe()','execute');
  assert not has_function_privilege('whatsapp_enfileirar(text,text,text,text)','execute'), 'enfileirar é interna até para o servidor';
  assert not has_function_privilege('verificacao_loja_lembrar()','execute'), 'lembrar é do agendador';
  assert not has_table_privilege('whatsapp_fila','select'), 'nem o servidor lê a tabela direto';
end $$;
reset role;
rollback;
