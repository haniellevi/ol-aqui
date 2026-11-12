\set ON_ERROR_STOP on
\set QUIET on
-- Reconferência mensal do CNPJ: quem é reservado (selo + CNPJ vencido, mais antigas primeiro), resultado ativa/inativa/não encontrada,
-- selo que sai com um aviso só para a loja e um para a equipe, nova verificação depois, data gravada nas aprovações e permissões.
begin;
reset role;
select id as reg from microrregioes where slug='corrente-pi' \gset
-- A reconferência é desligada de fábrica; este teste liga a chave (o caso desligado está no teste 760).
update configuracoes set valor = 'true'::jsonb where chave = 'verificacao.reconferencia_ativa' and microrregiao_id is null;

create function pg_temp.confere(ok boolean, caso text) returns void language plpgsql as $$
begin
  if ok is not true then raise exception 'Falhou: %', caso; end if;
end $$;
create function pg_temp.pdf(texto text) returns text language sql as $$ select encode(convert_to('%PDF-1.7 '||texto,'UTF8'),'base64') $$;
create function pg_temp.vid(n integer) returns uuid language sql as $$ select ('75000000-0000-4000-a000-' || lpad(n::text, 12, '0'))::uuid $$;
create function pg_temp.req(n integer) returns uuid language sql security definer as $$
  select id from verificacoes_loja where vitrine_id = pg_temp.vid(n) order by criado_em desc, id desc limit 1 $$;
-- Loja com selo e CNPJ gravado; conferido há p_dias (null = nunca conferido).
create function pg_temp.loja(n integer, p_dias integer) returns void language plpgsql security definer as $$
begin
  insert into perfis(id,microrregiao_id,nome,cidade,whatsapp,whatsapp_verificado_em)
  values ('user_750x'||n, (select id from microrregioes where slug='corrente-pi'), 'Dono '||n, 'Corrente', '5589975'||lpad(n::text,6,'0'), now());
  insert into vitrines_lojas(id,dono_id,microrregiao_id,slug,nome,cidade,bairro,endereco,whatsapp,tipo)
  values (pg_temp.vid(n), 'user_750x'||n, (select id from microrregioes where slug='corrente-pi'), 'loja-750-'||n, 'Loja 750 '||n,
          'Corrente', 'Centro', 'Rua '||n, '5589976'||lpad(n::text,6,'0'), 'loja');
  update vitrines_lojas set cnpj = '1122233300'||lpad(n::text,4,'0') where id = pg_temp.vid(n);
  perform verificacao_loja_definir(pg_temp.vid(n), 'aprovada', null, 'verificacao_aprovada', null, null);
  update vitrines_lojas set cnpj_conferido_em = case when p_dias is null then null else now() - make_interval(days => p_dias) end
   where id = pg_temp.vid(n);
end $$;
create function pg_temp.avisos(n integer, p_tipo text) returns integer language sql security definer as $$
  select count(*)::integer from notificacoes where usuario_id = 'user_750x'||n and tipo = p_tipo $$;
create function pg_temp.reservadas() returns uuid[] language sql security definer as $$
  select coalesce(array_agg(vitrine_id order by ord), '{}') from verificacao_loja_reconferir_reservar(100) with ordinality as t(vitrine_id, cnpj, ord) where vitrine_id::text like '75000000-%' $$;

insert into perfis(id,microrregiao_id,nome,cidade,whatsapp,whatsapp_verificado_em,e_admin) values
  ('user_750adm', :'reg', 'Admin 750', 'Corrente', '5589979000001', now(), true),
  ('user_750sup', :'reg', 'Suporte 750', 'Corrente', '5589979000002', now(), false);
insert into equipe(usuario_id,papel,microrregiao_id,ativo) values ('user_750sup','suporte',null,true);

-- [1] Coluna nova e funções só para o servidor.
select pg_temp.confere((select count(*) = 1 from information_schema.columns where table_name = 'vitrines_lojas' and column_name = 'cnpj_conferido_em'), 'coluna cnpj_conferido_em existe');

-- [2] Reserva: só selo + CNPJ vencido; mais antigas primeiro; nunca conferida vem antes.
select pg_temp.loja(1, 40);    -- vencida
select pg_temp.loja(2, 5);     -- em dia
select pg_temp.loja(3, null);  -- nunca conferida
select pg_temp.loja(4, 90);    -- vencida, a mais antiga
select pg_temp.loja(5, 31);    -- vencida
select pg_temp.loja(6, 60);
update vitrines_lojas set selo_loja_verificada = false, verificacao_estado = 'recusada' where id = pg_temp.vid(6);  -- sem selo
select pg_temp.confere(pg_temp.reservadas() = array[pg_temp.vid(3), pg_temp.vid(4), pg_temp.vid(1), pg_temp.vid(5)], 'reserva: vencidas com selo, nunca conferida primeiro, depois a mais velha');
select pg_temp.confere((select count(*) = 2 from verificacao_loja_reconferir_reservar(2)), 'reserva respeita o limite');
select pg_temp.confere((select cnpj = '11222333000001' from verificacao_loja_reconferir_reservar(100) where vitrine_id = pg_temp.vid(1)), 'reserva devolve o CNPJ');

-- [3] Ativa: só atualiza a data, sem avisos.
select verificacao_loja_reconferir_registrar(pg_temp.vid(1), '11222333000001', 'ativa', 'ATIVA');
select pg_temp.confere((select selo_loja_verificada and verificacao_estado = 'aprovada' and cnpj_conferido_em > now() - interval '1 minute'
   from vitrines_lojas where id = pg_temp.vid(1)), 'ativa: mantém o selo e atualiza a data');
select pg_temp.confere(pg_temp.avisos(1, 'verificacao_selo_removido') = 0, 'ativa: nenhum aviso');
select pg_temp.confere(not (pg_temp.vid(1) = any (pg_temp.reservadas())), 'conferida sai da reserva');

-- [3b] Resultado de outro CNPJ (a loja trocou de CNPJ no meio da rodada): nada muda, o selo fica.
select verificacao_loja_reconferir_registrar(pg_temp.vid(2), '99999999999999', 'inativa', 'BAIXADA');
select pg_temp.confere((select selo_loja_verificada and verificacao_estado = 'aprovada' from vitrines_lojas where id = pg_temp.vid(2))
   and pg_temp.avisos(2, 'verificacao_selo_removido') = 0
   and not exists (select 1 from verificacao_loja_avisos where vitrine_id = pg_temp.vid(2)), 'CNPJ diferente: nada muda');

-- [4] Inativa: selo sai, motivo, aviso da equipe, ação registrada, aviso à loja (sino) e WhatsApp com as chaves ligadas.
update configuracoes set valor = 'true'::jsonb where chave in ('verificacao.whatsapp_loja', 'verificacao.whatsapp_equipe') and microrregiao_id is null;
delete from whatsapp_fila;
select verificacao_loja_reconferir_registrar(pg_temp.vid(4), '11222333000004', 'inativa', 'BAIXADA');
select pg_temp.confere((select not selo_loja_verificada and verificacao_estado = 'recusada' and verificacao_motivo = 'cnpj_inativo'
   from vitrines_lojas where id = pg_temp.vid(4)), 'inativa: selo sai, estado recusada, motivo cnpj_inativo');
select pg_temp.confere((select count(*) = 1 and bool_and(detalhe->>'resultado' = 'inativa' and detalhe->>'situacao' = 'BAIXADA')
   from verificacao_loja_avisos where vitrine_id = pg_temp.vid(4) and tipo = 'receita_inativa' and resolvido_em is null), 'inativa: aviso receita_inativa para a equipe');
select pg_temp.confere((select count(*) = 1 and bool_and(detalhes->>'origem' = 'receita' and admin_id is null)
   from vitrines_acoes_admin where vitrine_id = pg_temp.vid(4) and acao = 'verificacao_selo_removido'), 'inativa: registrada em vitrines_acoes_admin');
select pg_temp.confere(pg_temp.avisos(4, 'verificacao_selo_removido') = 1, 'inativa: exatamente um aviso no sino da loja');
select pg_temp.confere((select count(*) = 1 and bool_and(link = '/minha-conta/loja/verificar') from whatsapp_fila where usuario_id = 'user_750x4'), 'inativa: um WhatsApp para a loja');
select pg_temp.confere((select count(*) >= 1 and count(*) = count(distinct usuario_id) and bool_and(link = '/admin/lojas#fila-lojas' and texto like 'Verificação de loja precisa de você: Loja 750 4 (Corrente).%')
   from whatsapp_fila where chave like 'verificacao_selo_removido_equipe:%'), 'inativa: um WhatsApp por pessoa da equipe');
select pg_temp.confere((select count(*) = 0 from whatsapp_fila where texto ~ '[0-9]{14}'), 'mensagens sem CNPJ');

-- Repetir o resultado numa loja que já perdeu o selo não duplica nada.
select verificacao_loja_reconferir_registrar(pg_temp.vid(4), '11222333000004', 'inativa', 'BAIXADA');
select pg_temp.confere(pg_temp.avisos(4, 'verificacao_selo_removido') = 1 and (select count(*) = 1 from vitrines_acoes_admin where vitrine_id = pg_temp.vid(4) and acao = 'verificacao_selo_removido'), 'repetir não duplica');

-- [5] Não encontrada também tira o selo.
select verificacao_loja_reconferir_registrar(pg_temp.vid(5), '11222333000005', 'nao_encontrada', null);
select pg_temp.confere((select not selo_loja_verificada and verificacao_motivo = 'cnpj_inativo' from vitrines_lojas where id = pg_temp.vid(5)), 'não encontrada: selo sai');

-- [6] A loja pode enviar nova verificação depois.
select pg_temp.confere(enviar_verificacao_loja('user_750x4', '11222333000004', pg_temp.pdf('novo comprovante'), null) = 'enviada', 'nova verificação enviada depois da remoção');
select pg_temp.confere((select verificacao_estado = 'pendente' from vitrines_lojas where id = pg_temp.vid(4)), 'nova verificação deixa a loja pendente');

-- [7] Resultado inválido.
do $$ declare ok boolean := false; begin
  begin perform verificacao_loja_reconferir_registrar(pg_temp.vid(2), '11222333000002', 'talvez', null);
  exception when sqlstate '22023' then ok := true; end;
  assert ok, 'resultado inválido deve falhar';
end $$;

-- [8] Aprovações gravam a data da conferência (IA e equipe).
create function pg_temp.pedido_analisando(n integer) returns uuid language plpgsql security definer as $$
declare r text; id_ uuid; res uuid := gen_random_uuid();
begin
  insert into perfis(id,microrregiao_id,nome,cidade,whatsapp,whatsapp_verificado_em)
  values ('user_750y'||n, (select id from microrregioes where slug='corrente-pi'), 'Dono y'||n, 'Corrente', '5589977'||lpad(n::text,6,'0'), now());
  insert into vitrines_lojas(id,dono_id,microrregiao_id,slug,nome,cidade,bairro,endereco,whatsapp,tipo)
  values (pg_temp.vid(20+n), 'user_750y'||n, (select id from microrregioes where slug='corrente-pi'), 'loja-750-y'||n, 'Loja 750 y'||n,
          'Corrente', 'Centro', 'Rua y'||n, '5589978'||lpad(n::text,6,'0'), 'loja');
  r := enviar_verificacao_loja('user_750y'||n, '1122233301'||lpad(n::text,4,'0'), pg_temp.pdf('comprovante y'||n), null);
  if r <> 'enviada' then raise exception 'envio y%: %', n, r; end if;
  select v.id into id_ from verificacoes_loja v where v.vitrine_id = pg_temp.vid(20+n);
  update verificacoes_loja set status = 'analisando', reserva = res, iniciado_em = now() where id = id_;
  return id_;
end $$;
select pg_temp.pedido_analisando(1) as ped1 \gset
select verificacao_loja_concluir(:'ped1', (select reserva from verificacoes_loja where id = :'ped1'), 'aprovar', null, '{}', '[]'::jsonb, 0, 0, 0) as r1 \gset
select pg_temp.confere(:'r1' in ('aprovada', 'revisao_amostra'), 'IA aprovou');
select pg_temp.confere((select selo_loja_verificada and cnpj_conferido_em > now() - interval '1 minute' from vitrines_lojas where id = pg_temp.vid(21)), 'aprovação da IA grava cnpj_conferido_em');

select pg_temp.pedido_analisando(2) as ped2 \gset
update verificacoes_loja set status = 'equipe', motivos_equipe = '{ia_duvida}', encaminhada_em = now(), prazo_em = now() + interval '24 hours' where id = :'ped2';
set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='user_750sup';
select admin_decidir_verificacao_loja(:'ped2', 'aprovar', null, true);
reset role;
select pg_temp.confere((select selo_loja_verificada and cnpj_conferido_em > now() - interval '1 minute' from vitrines_lojas where id = pg_temp.vid(22)), 'aprovação da equipe grava cnpj_conferido_em');

-- [9] Permissões: authenticated e anon não executam; service_role sim.
set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='user_750x2';
do $$ declare ok boolean := false; begin
  begin perform verificacao_loja_reconferir_reservar(30);
  exception when sqlstate '42501' then ok := true; end;
  assert ok, 'authenticated reservou';
  ok := false;
  begin perform verificacao_loja_reconferir_registrar(gen_random_uuid(), '1', 'inativa', null);
  exception when sqlstate '42501' then ok := true; end;
  assert ok, 'authenticated registrou';
  ok := false;
  begin perform verificacao_loja_reconferir_disparar();
  exception when sqlstate '42501' then ok := true; end;
  assert ok, 'authenticated disparou';
end $$;
set local role anon;
do $$ begin
  assert not has_function_privilege('verificacao_loja_reconferir_reservar(integer)','execute');
  assert not has_function_privilege('verificacao_loja_reconferir_registrar(uuid,text,text,text)','execute');
  assert not has_function_privilege('verificacao_loja_reconferir_disparar()','execute');
end $$;
set local role service_role;
do $$ begin
  assert has_function_privilege('verificacao_loja_reconferir_reservar(integer)','execute');
  assert has_function_privilege('verificacao_loja_reconferir_registrar(uuid,text,text,text)','execute');
  assert has_function_privilege('verificacao_loja_reconferir_disparar()','execute');
  assert not has_function_privilege('admin_decidir_verificacao_loja(uuid,text,text,boolean)','execute');
end $$;
reset role;
select pg_temp.confere(has_function_privilege('authenticated', 'admin_decidir_verificacao_loja(uuid,text,text,boolean)', 'execute'), 'equipe continua executando admin_decidir');
rollback;
