\set ON_ERROR_STOP on
\set QUIET on
-- Ajustes da revisão final: reconferência desligada de fábrica, dono não escreve cnpj_conferido_em,
-- revisão manual antiga fecha o pedido aberto sem aviso errado, selo removido fecha a revisão por amostra
-- e a rede de segurança do lembrete (pedido parado há mais de 30 minutos vai para a equipe).
begin;
reset role;
select id as reg from microrregioes where slug='corrente-pi' \gset

create function pg_temp.confere(ok boolean, caso text) returns void language plpgsql as $$
begin
  if ok is not true then raise exception 'Falhou: %', caso; end if;
end $$;
create function pg_temp.pdf(texto text) returns text language sql as $$ select encode(convert_to('%PDF-1.7 '||texto,'UTF8'),'base64') $$;
create function pg_temp.vid(n integer) returns uuid language sql as $$ select ('76000000-0000-4000-a000-' || lpad(n::text, 12, '0'))::uuid $$;
create function pg_temp.req(n integer) returns uuid language sql security definer as $$
  select id from verificacoes_loja where vitrine_id = pg_temp.vid(n) order by criado_em desc, id desc limit 1 $$;
-- Loja nova com um pedido enviado (arquivos guardados).
create function pg_temp.nova(n integer) returns uuid language plpgsql security definer as $$
declare r text;
begin
  insert into perfis(id,microrregiao_id,nome,cidade,whatsapp,whatsapp_verificado_em)
  values ('user_760x'||n, (select id from microrregioes where slug='corrente-pi'), 'Dono '||n, 'Corrente', '5589976'||lpad(n::text,6,'0'), now());
  insert into vitrines_lojas(id,dono_id,microrregiao_id,slug,nome,cidade,bairro,endereco,whatsapp,tipo)
  values (pg_temp.vid(n), 'user_760x'||n, (select id from microrregioes where slug='corrente-pi'), 'loja-760-'||n, 'Loja 760 '||n,
          'Corrente', 'Centro', 'Rua '||n, '5589977'||lpad(n::text,6,'0'), 'loja');
  r := enviar_verificacao_loja('user_760x'||n, '1122233300'||lpad(n::text,4,'0'), pg_temp.pdf('comprovante '||n), null);
  if r <> 'enviada' then raise exception 'envio da loja %: %', n, r; end if;
  return pg_temp.req(n);
end $$;
-- Loja com selo e CNPJ gravado, sem pedido; conferida há p_dias (null = nunca).
create function pg_temp.selada(n integer, p_dias integer) returns void language plpgsql security definer as $$
begin
  insert into perfis(id,microrregiao_id,nome,cidade,whatsapp,whatsapp_verificado_em)
  values ('user_760x'||n, (select id from microrregioes where slug='corrente-pi'), 'Dono '||n, 'Corrente', '5589976'||lpad(n::text,6,'0'), now());
  insert into vitrines_lojas(id,dono_id,microrregiao_id,slug,nome,cidade,bairro,endereco,whatsapp,tipo)
  values (pg_temp.vid(n), 'user_760x'||n, (select id from microrregioes where slug='corrente-pi'), 'loja-760-'||n, 'Loja 760 '||n,
          'Corrente', 'Centro', 'Rua '||n, '5589977'||lpad(n::text,6,'0'), 'loja');
  update vitrines_lojas set cnpj = '1122233300'||lpad(n::text,4,'0') where id = pg_temp.vid(n);
  perform verificacao_loja_definir(pg_temp.vid(n), 'aprovada', null, 'verificacao_aprovada', null, null);
  update vitrines_lojas set cnpj_conferido_em = case when p_dias is null then null else now() - make_interval(days => p_dias) end
   where id = pg_temp.vid(n);
end $$;
create function pg_temp.avisos(n integer, p_tipo text) returns integer language sql security definer as $$
  select count(*)::integer from notificacoes where usuario_id = 'user_760x'||n and tipo = p_tipo $$;
create function pg_temp.reservadas() returns integer language sql security definer as $$
  select count(*)::integer from verificacao_loja_reconferir_reservar(100) where vitrine_id::text like '76000000-%' $$;
create function pg_temp.sem_arquivos(p_id uuid) returns boolean language sql security definer as $$
  select comprovante is null and tipo_comprovante is null and fachada is null and tipo_fachada is null and reserva is null
    from verificacoes_loja where id = p_id $$;

insert into perfis(id,microrregiao_id,nome,cidade,whatsapp,whatsapp_verificado_em,e_admin) values
  ('user_760sup', :'reg', 'Suporte 760', 'Corrente', '5589979760001', now(), false);
insert into equipe(usuario_id,papel,microrregiao_id,ativo) values ('user_760sup','suporte',null,true);

-- [1] Reconferência desligada de fábrica: nada reservado, nada disparado; ligada, volta ao normal.
select pg_temp.confere((select valor = 'false'::jsonb and grupo = 'verificacao' and not publico from configuracoes
   where chave = 'verificacao.reconferencia_ativa' and microrregiao_id is null), 'chave reconferencia_ativa existe e vem desligada');
select pg_temp.selada(1, 40);
select pg_temp.selada(2, null);
select pg_temp.confere(pg_temp.reservadas() = 0, 'desligada: reservar não devolve nenhuma loja, mesmo com vencidas');
select pg_temp.confere(verificacao_loja_reconferir_disparar() is null, 'desligada: disparar não faz nada');
update configuracoes set valor = 'true'::jsonb where chave = 'verificacao.reconferencia_ativa' and microrregiao_id is null;
select pg_temp.confere(pg_temp.reservadas() = 2, 'ligada: reservar devolve as vencidas');
update configuracoes set valor = 'false'::jsonb where chave = 'verificacao.reconferencia_ativa' and microrregiao_id is null;
select pg_temp.confere(pg_temp.reservadas() = 0, 'desligada de novo: nenhuma');

-- [2] O dono da loja não escreve cnpj_conferido_em (nem para o futuro, nem para apagar a data).
select pg_temp.selada(3, 40);
select cnpj_conferido_em as antes3 from vitrines_lojas where id = pg_temp.vid(3) \gset
set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='user_760x3';
do $$ declare n integer; begin
  update vitrines_lojas set cnpj_conferido_em = now() + interval '1 year' where id = pg_temp.vid(3);
  get diagnostics n = row_count;
  assert n = 1, 'o dono edita a própria loja';
  update vitrines_lojas set cnpj_conferido_em = null, nome = 'Loja 760 três' where id = pg_temp.vid(3);
  get diagnostics n = row_count;
  assert n = 1, 'o dono edita a própria loja (2)';
end $$;
reset role;
select pg_temp.confere((select cnpj_conferido_em = :'antes3'::timestamptz and nome = 'Loja 760 três' and selo_loja_verificada
   from vitrines_lojas where id = pg_temp.vid(3)), 'dono não muda cnpj_conferido_em; outros campos mudam e o selo fica (nome não reabre)');

-- [3] Revisão manual antiga fecha o pedido aberto, apaga os arquivos e não manda aviso errado.
select pg_temp.nova(10) as ped10 \gset                       -- enviada
select pg_temp.nova(11) as ped11 \gset                       -- analisando
select pg_temp.nova(12) as ped12 \gset                       -- equipe
select pg_temp.nova(13) as ped13 \gset                       -- revisao_amostra (loja com selo)
update verificacoes_loja set status = 'analisando', reserva = gen_random_uuid(), iniciado_em = now() where id = :'ped11';
select reserva as reserva11 from verificacoes_loja where id = :'ped11' \gset
update verificacoes_loja set status = 'equipe', motivos_equipe = '{ia_duvida}', encaminhada_em = now(), prazo_em = now() + interval '24 hours' where id = :'ped12';
select verificacao_loja_definir(pg_temp.vid(13), 'aprovada', null, 'verificacao_ia_aprovada', null, null);
update verificacoes_loja set status = 'revisao_amostra', amostra = true, prazo_em = now() + interval '7 days', decidido_em = now(), reserva = null where id = :'ped13';
select verificacao_revisao as rev10 from vitrines_lojas where id = pg_temp.vid(10) \gset
select verificacao_revisao as rev11 from vitrines_lojas where id = pg_temp.vid(11) \gset
select verificacao_revisao as rev12 from vitrines_lojas where id = pg_temp.vid(12) \gset
select verificacao_revisao as rev13 from vitrines_lojas where id = pg_temp.vid(13) \gset
set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='user_760sup';
select admin_revisar_loja(pg_temp.vid(10), :rev10, 'recusar', 'titularidade', null, null, null);
select admin_revisar_loja(pg_temp.vid(11), :rev11, 'correcao', 'link_invalido', null, null, null);
select admin_revisar_loja(pg_temp.vid(12), :rev12, 'aprovar', null, true, true, true);
select admin_revisar_loja(pg_temp.vid(13), :rev13, 'correcao', 'dados_inconsistentes', null, null, null);
reset role;
select pg_temp.confere((select count(*) = 4 and bool_and(status = 'obsoleta') from verificacoes_loja where id in (:'ped10', :'ped11', :'ped12', :'ped13')),
   'revisão manual: os 4 pedidos abertos viram obsoletos');
select pg_temp.confere(pg_temp.sem_arquivos(:'ped10') and pg_temp.sem_arquivos(:'ped11') and pg_temp.sem_arquivos(:'ped12') and pg_temp.sem_arquivos(:'ped13'),
   'revisão manual: arquivos e reserva apagados em todos');
select pg_temp.confere((select count(*) = 0 from verificacoes_loja where vitrine_id in (pg_temp.vid(10), pg_temp.vid(11), pg_temp.vid(12), pg_temp.vid(13))
   and status in ('enviada', 'analisando', 'equipe', 'revisao_amostra')), 'revisão manual: nenhum pedido aberto sobra');
select pg_temp.confere((select estado_ok from (select
     (select verificacao_estado = 'recusada' from vitrines_lojas where id = pg_temp.vid(10))
 and (select verificacao_estado = 'correcao' from vitrines_lojas where id = pg_temp.vid(11))
 and (select verificacao_estado = 'aprovada' and selo_loja_verificada from vitrines_lojas where id = pg_temp.vid(12))
 and (select verificacao_estado = 'correcao' and not selo_loja_verificada from vitrines_lojas where id = pg_temp.vid(13)) as estado_ok) t), 'revisão manual: a decisão da equipe vale');
select pg_temp.confere(pg_temp.avisos(10, 'verificacao_falta_algo') = 0 and pg_temp.avisos(11, 'verificacao_falta_algo') = 0
   and pg_temp.avisos(12, 'verificacao_falta_algo') = 0 and pg_temp.avisos(13, 'verificacao_falta_algo') = 0,
   'revisão manual: nenhum aviso "falta algo / dados mudaram"');
-- Resposta tardia da IA para o pedido que a equipe já fechou: ignorada, sem decidir e sem aviso.
select pg_temp.confere(verificacao_loja_concluir(:'ped11', :'reserva11', 'aprovar', null, '{}', '[]'::jsonb, 0, 0, 0) = 'ignorado', 'resposta tardia da IA é ignorada');
select pg_temp.confere((select verificacao_estado = 'correcao' and not selo_loja_verificada from vitrines_lojas where id = pg_temp.vid(11))
   and pg_temp.avisos(11, 'verificacao_falta_algo') = 0 and pg_temp.avisos(11, 'verificacao_aprovada') = 0, 'resposta tardia não muda a loja nem avisa');
-- A loja pode mandar um novo pedido depois (as que não estão com selo).
select pg_temp.confere(enviar_verificacao_loja('user_760x10', '11222333000010', pg_temp.pdf('novo 10'), null) = 'enviada', 'loja 10 envia de novo');
select pg_temp.confere(enviar_verificacao_loja('user_760x11', '11222333000011', pg_temp.pdf('novo 11'), null) = 'enviada', 'loja 11 envia de novo');
select pg_temp.confere(enviar_verificacao_loja('user_760x13', '11222333000013', pg_temp.pdf('novo 13'), null) = 'enviada', 'loja 13 envia de novo');
select pg_temp.confere(enviar_verificacao_loja('user_760x12', '11222333000012', pg_temp.pdf('novo 12'), null) = 'verificada', 'loja 12 aprovada já tem o selo');

-- [4] Aviso de "dados mudaram" ao virar obsoleta: só com a loja esperando novo envio (sem selo e pendente).
select pg_temp.nova(20) as ped20 \gset                       -- loja pendente, sem selo
update verificacoes_loja set status = 'analisando', reserva = gen_random_uuid(), iniciado_em = now() where id = :'ped20';
update verificacoes_loja set status = 'obsoleta', motivo = 'dados_mudaram', reserva = null, comprovante = null, tipo_comprovante = null,
       fachada = null, tipo_fachada = null where id = :'ped20';
select pg_temp.confere(pg_temp.avisos(20, 'verificacao_falta_algo') = 1, 'obsoleta com loja pendente e sem selo: avisa uma vez');
select pg_temp.nova(21) as ped21 \gset                       -- loja que ganhou o selo no meio
update verificacoes_loja set status = 'analisando', reserva = gen_random_uuid(), iniciado_em = now() where id = :'ped21';
select verificacao_loja_definir(pg_temp.vid(21), 'aprovada', null, 'verificacao_aprovada', null, null);
update verificacoes_loja set status = 'obsoleta', motivo = 'dados_mudaram', reserva = null, comprovante = null, tipo_comprovante = null,
       fachada = null, tipo_fachada = null where id = :'ped21';
select pg_temp.confere(pg_temp.avisos(21, 'verificacao_falta_algo') = 0, 'obsoleta com a loja já com selo: sem aviso');
select pg_temp.nova(22) as ped22 \gset                       -- loja que recebeu decisão final (recusada) no meio
update verificacoes_loja set status = 'analisando', reserva = gen_random_uuid(), iniciado_em = now() where id = :'ped22';
select verificacao_loja_definir(pg_temp.vid(22), 'recusada', 'titularidade', 'verificacao_revisada', null, null);
update verificacoes_loja set status = 'obsoleta', motivo = 'dados_mudaram', reserva = null, comprovante = null, tipo_comprovante = null,
       fachada = null, tipo_fachada = null where id = :'ped22';
select pg_temp.confere(pg_temp.avisos(22, 'verificacao_falta_algo') = 0, 'obsoleta com decisão final da equipe: sem aviso');

-- [5] Selo removido pela reconferência fecha a revisão por amostra, sem segundo aviso para a loja.
select pg_temp.nova(30) as ped30 \gset
update vitrines_lojas set cnpj = '11222333000030' where id = pg_temp.vid(30);
select verificacao_loja_definir(pg_temp.vid(30), 'aprovada', null, 'verificacao_ia_aprovada', null, null);
update vitrines_lojas set cnpj_conferido_em = now() - interval '40 days' where id = pg_temp.vid(30);
update verificacoes_loja set status = 'revisao_amostra', amostra = true, prazo_em = now() + interval '7 days', decidido_em = now(), reserva = null where id = :'ped30';
select pg_temp.confere((select status = 'revisao_amostra' and comprovante is not null from verificacoes_loja where id = :'ped30'), 'preparo: pedido em revisão por amostra com arquivos');
select verificacao_loja_reconferir_registrar(pg_temp.vid(30), '11222333000030', 'inativa', 'BAIXADA');
select pg_temp.confere((select status = 'obsoleta' from verificacoes_loja where id = :'ped30') and pg_temp.sem_arquivos(:'ped30'),
   'selo removido: revisão por amostra vira obsoleta e apaga os arquivos');
select pg_temp.confere((select not selo_loja_verificada and verificacao_estado = 'recusada' and verificacao_motivo = 'cnpj_inativo' from vitrines_lojas where id = pg_temp.vid(30)),
   'selo removido: loja recusada por cnpj_inativo');
select pg_temp.confere(pg_temp.avisos(30, 'verificacao_selo_removido') = 1 and pg_temp.avisos(30, 'verificacao_falta_algo') = 0,
   'selo removido: um aviso só para a loja (nada de "dados mudaram")');
select pg_temp.confere(enviar_verificacao_loja('user_760x30', '11222333000030', pg_temp.pdf('novo 30'), null) = 'enviada', 'loja 30 envia de novo');

-- [6] Rede de segurança: pedido parado em "Conferindo" por mais de 30 minutos vai para a equipe (IA ligada ou não).
select pg_temp.nova(40) as ped40 \gset                       -- enviada há 31 min
select pg_temp.nova(41) as ped41 \gset                       -- enviada há 5 min
select pg_temp.nova(42) as ped42 \gset                       -- analisando há 31 min
select pg_temp.nova(43) as ped43 \gset                       -- analisando há 5 min
select pg_temp.nova(44) as ped44 \gset                       -- enviada, antiga, mas com nova tentativa marcada para daqui a pouco
update verificacoes_loja set criado_em = now() - interval '31 minutes', proxima_em = now() - interval '31 minutes' where id = :'ped40';
update verificacoes_loja set criado_em = now() - interval '5 minutes', proxima_em = now() - interval '5 minutes' where id = :'ped41';
update verificacoes_loja set status = 'analisando', reserva = gen_random_uuid(), iniciado_em = now() - interval '31 minutes', criado_em = now() - interval '40 minutes' where id = :'ped42';
update verificacoes_loja set status = 'analisando', reserva = gen_random_uuid(), iniciado_em = now() - interval '5 minutes', criado_em = now() - interval '40 minutes' where id = :'ped43';
update verificacoes_loja set criado_em = now() - interval '2 hours', proxima_em = now() + interval '5 minutes' where id = :'ped44';
select verificacao_loja_lembrar();
select pg_temp.confere((select count(*) = 2 and bool_and(status = 'equipe' and motivos_equipe = '{ia_falhou}' and prazo_em > now() + interval '23 hours'
        and encaminhada_em > now() - interval '1 minute' and comprovante is not null)
   from verificacoes_loja where id in (:'ped40', :'ped42')), 'parado há mais de 30 min (enviada e analisando) vai para a equipe com ia_falhou e prazo');
select pg_temp.confere((select status = 'enviada' from verificacoes_loja where id = :'ped41') and (select status = 'analisando' from verificacoes_loja where id = :'ped43')
   and (select status = 'enviada' from verificacoes_loja where id = :'ped44'), 'pedidos recentes ou com nova tentativa marcada ficam como estão');
select verificacao_loja_lembrar();
select pg_temp.confere((select count(*) = 2 from verificacoes_loja where id in (:'ped40', :'ped42') and status = 'equipe')
   and (select status = 'enviada' from verificacoes_loja where id = :'ped41'), 'segunda chamada não muda nada');
select pg_temp.confere(not exists (select 1 from verificacoes_loja where id in (:'ped40', :'ped42') and lembrete_em is not null), 'recém-encaminhado não é lembrado como atrasado');

-- [7] Permissões e erro esperado.
set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='user_760x3';
do $$ declare ok boolean := false; begin
  begin perform verificacao_loja_reconferir_reservar(30);
  exception when sqlstate '42501' then ok := true; end;
  assert ok, 'authenticated reservou';
  assert not has_function_privilege('verificacao_loja_lembrar()','execute'), 'lembrar é do agendador';
  assert not has_function_privilege('verificacao_loja_avisos_gatilho()','execute'), 'gatilho de avisos fechado';
  assert not has_function_privilege('proteger_verificacao_loja()','execute'), 'proteção fechada';
  assert not has_function_privilege('verificacao_loja_reconferir_disparar()','execute'), 'disparar fechado';
  assert not has_function_privilege('verificacao_loja_reconferir_registrar(uuid,text,text,text)','execute'), 'registrar fechado';
  assert has_function_privilege('admin_revisar_loja(uuid,integer,text,text,boolean,boolean,boolean)','execute'), 'a equipe continua executando admin_revisar_loja';
end $$;
set local role anon;
do $$ begin
  assert not has_function_privilege('admin_revisar_loja(uuid,integer,text,text,boolean,boolean,boolean)','execute'), 'anon não revisa';
end $$;
set local role service_role;
do $$ begin
  assert has_function_privilege('verificacao_loja_reconferir_reservar(integer)','execute');
  assert has_function_privilege('verificacao_loja_reconferir_registrar(uuid,text,text,text)','execute');
  assert has_function_privilege('verificacao_loja_reconferir_disparar()','execute');
  assert not has_function_privilege('verificacao_loja_lembrar()','execute');
end $$;
reset role;
rollback;
