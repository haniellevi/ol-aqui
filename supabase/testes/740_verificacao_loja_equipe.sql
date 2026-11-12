\set ON_ERROR_STOP on
\set QUIET on
-- Fila da equipe na verificação da loja: quem pode, o que lista, arquivos só nos status certos, as cinco decisões
-- (aprovar, correção, recusar, confirmar, tirar o selo), corrida entre duas pessoas, cadastro que mudou,
-- avisos para a equipe e limpeza diária das amostras vencidas.
begin;
reset role;
select id as reg from microrregioes where slug='corrente-pi' \gset

create function pg_temp.confere(ok boolean, caso text) returns void language plpgsql as $$
begin
  if ok is not true then raise exception 'Falhou: %', caso; end if;
end $$;
create function pg_temp.pdf(texto text) returns text language sql as $$ select encode(convert_to('%PDF-1.7 '||texto,'UTF8'),'base64') $$;
create function pg_temp.png(texto text) returns text language sql as $$ select encode(decode('89504e470d0a1a0a','hex')||convert_to(texto,'UTF8'),'base64') $$;
create function pg_temp.vid(n integer) returns uuid language sql as $$ select ('74000000-0000-4000-a000-' || lpad(n::text, 12, '0'))::uuid $$;
create function pg_temp.req(n integer) returns uuid language sql security definer as $$
  select id from verificacoes_loja where vitrine_id = pg_temp.vid(n) order by criado_em desc, id desc limit 1 $$;
-- Dono + loja + pedido enviado (como o servidor faria). Com fachada quando p_fachada.
create function pg_temp.nova(n integer, p_fachada boolean default false) returns uuid language plpgsql security definer as $$
declare r text;
begin
  insert into perfis(id,microrregiao_id,nome,cidade,whatsapp,whatsapp_verificado_em)
  values ('user_740x'||n, (select id from microrregioes where slug='corrente-pi'), 'Dono '||n, 'Corrente', '5589977'||lpad(n::text,6,'0'), now());
  insert into vitrines_lojas(id,dono_id,microrregiao_id,slug,nome,cidade,bairro,endereco,whatsapp,tipo)
  values (pg_temp.vid(n), 'user_740x'||n, (select id from microrregioes where slug='corrente-pi'), 'loja-740-'||n, 'Loja 740 '||n,
          'Corrente', 'Centro', 'Rua '||n, '5589978'||lpad(n::text,6,'0'), 'loja');
  r := enviar_verificacao_loja('user_740x'||n, '1122233300'||lpad(n::text,4,'0'), pg_temp.pdf('comprovante '||n),
                               case when p_fachada then pg_temp.png('fachada '||n) end);
  if r <> 'enviada' then raise exception 'envio da loja %: %', n, r; end if;
  return pg_temp.req(n);
end $$;
-- Encaminha para a equipe, com o prazo a p_horas daqui (negativo = já passou) e criado há p_idade.
create function pg_temp.equipe(n integer, p_horas integer, p_idade interval) returns void language sql security definer as $$
  update verificacoes_loja set status = 'equipe', motivos_equipe = '{nome_diferente,cnpj_duplicado}', encaminhada_em = now(),
         prazo_em = now() + make_interval(hours => p_horas), criado_em = now() - p_idade
   where id = pg_temp.req(n) $$;
-- Aprovação da IA sorteada para revisão: selo concedido, pedido guarda os arquivos até p_prazo.
create function pg_temp.amostra(n integer, p_prazo interval) returns void language plpgsql security definer as $$
begin
  perform verificacao_loja_definir(pg_temp.vid(n), 'aprovada', null, 'verificacao_ia_aprovada', null, null);
  update verificacoes_loja set status = 'revisao_amostra', amostra = true, prazo_em = now() + p_prazo, decidido_em = now(),
         parecer = '[{"item":"cnpj_ativo","ok":true}]'::jsonb
   where id = pg_temp.req(n);
end $$;

insert into perfis(id,microrregiao_id,nome,cidade,e_admin) values
  ('user_740adm', :'reg', 'Admin 740', 'Corrente', true),
  ('user_740sup', :'reg', 'Suporte 740', 'Corrente', false),
  ('user_740mod', :'reg', 'Moderador 740', 'Corrente', false),
  ('user_740fin', :'reg', 'Financeiro 740', 'Corrente', false),
  ('user_740fra', :'reg', 'Franqueado 740', 'Corrente', false);
insert into equipe(usuario_id,papel,microrregiao_id,ativo) values
  ('user_740sup','suporte',null,true), ('user_740mod','moderador',null,true), ('user_740fin','financeiro',null,true),
  ('user_740fra','franqueado',:'reg',true);

-- [0] Pedidos de teste: 1 e 2 na equipe (o 2 já passou do prazo), 3 em revisão por amostra, 4 recém-enviado.
select pg_temp.nova(1, true) \gset
select pg_temp.nova(2) \gset
select pg_temp.nova(3, true) \gset
select pg_temp.nova(4) \gset
select pg_temp.equipe(1, 20, interval '3 hours');
select pg_temp.equipe(2, -2, interval '2 hours');
select pg_temp.amostra(3, interval '7 days');
update verificacoes_loja set criado_em = now() - interval '1 hour' where id = pg_temp.req(3);

-- [1] Moderador, financeiro, franqueado e visitante: nenhuma das funções abre.
set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='user_740mod';
do $$ declare c text; begin
  foreach c in array array[
    'select * from admin_fila_verificacao_loja()',
    'select * from admin_arquivo_verificacao_loja(gen_random_uuid(), ''comprovante'')',
    'select admin_decidir_verificacao_loja(gen_random_uuid(), ''aprovar'', null, true)',
    'select * from admin_avisos_verificacao_loja()',
    'select admin_resolver_aviso_verificacao(gen_random_uuid())'] loop
    begin execute c; raise exception 'Moderador não podia: %', c;
    exception when insufficient_privilege then null; end;
  end loop;
end $$;
set local request.jwt.claim.sub='user_740fin';
do $$ declare c text; begin
  foreach c in array array[
    'select * from admin_fila_verificacao_loja()',
    'select * from admin_arquivo_verificacao_loja(gen_random_uuid(), ''comprovante'')',
    'select admin_decidir_verificacao_loja(gen_random_uuid(), ''aprovar'', null, true)',
    'select * from admin_avisos_verificacao_loja()',
    'select admin_resolver_aviso_verificacao(gen_random_uuid())'] loop
    begin execute c; raise exception 'Financeiro não podia: %', c;
    exception when insufficient_privilege then null; end;
  end loop;
end $$;
set local request.jwt.claim.sub='user_740fra';
do $$ declare c text; begin
  foreach c in array array[
    'select * from admin_fila_verificacao_loja()',
    'select * from admin_arquivo_verificacao_loja(gen_random_uuid(), ''comprovante'')',
    'select admin_decidir_verificacao_loja(gen_random_uuid(), ''aprovar'', null, true)',
    'select * from admin_avisos_verificacao_loja()',
    'select admin_resolver_aviso_verificacao(gen_random_uuid())'] loop
    begin execute c; raise exception 'Franqueado não podia: %', c;
    exception when insufficient_privilege then null; end;
  end loop;
end $$;
set local role anon;
do $$ declare c text; begin
  foreach c in array array[
    'select * from admin_fila_verificacao_loja()',
    'select * from admin_arquivo_verificacao_loja(gen_random_uuid(), ''comprovante'')',
    'select admin_decidir_verificacao_loja(gen_random_uuid(), ''aprovar'', null, true)',
    'select * from admin_avisos_verificacao_loja()',
    'select admin_resolver_aviso_verificacao(gen_random_uuid())',
    'select verificacao_loja_limpar_amostras()'] loop
    begin execute c; raise exception 'Visitante não podia: %', c;
    exception when insufficient_privilege then null; end;
  end loop;
end $$;
set local role authenticated;
set local request.jwt.claim.sub='user_740sup';
do $$ begin
  begin perform verificacao_loja_limpar_amostras(); raise exception 'Suporte não roda a limpeza';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- [2] Suporte lista só equipe e revisao_amostra, o mais antigo primeiro; o administrador também lista.
set local role authenticated;
set local request.jwt.claim.sub='user_740sup';
do $$
declare ids uuid[]; r record;
begin
  select array_agg(f.id order by f.criado_em, f.id) into ids from admin_fila_verificacao_loja() f where f.vitrine_id in
    (select ('74000000-0000-4000-a000-' || lpad(g::text, 12, '0'))::uuid from generate_series(1, 4) g);
  assert cardinality(ids) = 3, 'a fila tem só os 3 pedidos que esperam a equipe: ' || coalesce(cardinality(ids)::text, 'nenhum');
  select * into r from admin_fila_verificacao_loja() f where f.vitrine_id = '74000000-0000-4000-a000-000000000001';
  assert r.loja_nome = 'Loja 740 1' and r.cidade = 'Corrente' and r.cnpj = '11222333000001' and r.status = 'equipe', 'dados do caso 1';
  assert r.motivos_equipe = '{nome_diferente,cnpj_duplicado}' and r.tem_fachada and not r.atrasada and not r.amostra, 'caso 1: motivos, fachada, no prazo';
  select * into r from admin_fila_verificacao_loja() f where f.vitrine_id = '74000000-0000-4000-a000-000000000002';
  assert r.atrasada and not r.tem_fachada, 'caso 2: atrasada e sem fachada';
  select * into r from admin_fila_verificacao_loja() f where f.vitrine_id = '74000000-0000-4000-a000-000000000003';
  assert r.status = 'revisao_amostra' and r.amostra and not r.atrasada and r.parecer @> '[{"item":"cnpj_ativo","ok":true}]'::jsonb, 'caso 3: amostra com parecer';
  assert (select count(*) from admin_fila_verificacao_loja() f where f.vitrine_id = '74000000-0000-4000-a000-000000000004') = 0, 'pedido recém-enviado não aparece';
  assert (select count(*) from admin_fila_verificacao_loja()) <= 50, 'no máximo 50';
end $$;
set local request.jwt.claim.sub='user_740adm';
do $$ begin
  assert (select count(*) from admin_fila_verificacao_loja() f where f.vitrine_id in
    ('74000000-0000-4000-a000-000000000001','74000000-0000-4000-a000-000000000002','74000000-0000-4000-a000-000000000003')) = 3, 'administrador também lista';
end $$;
reset role;
select pg_temp.confere((select array_agg(f.vitrine_id order by f.criado_em, f.id) = array[pg_temp.vid(1), pg_temp.vid(2), pg_temp.vid(3)]
    from verificacoes_loja f where f.status in ('equipe','revisao_amostra') and f.vitrine_id in (pg_temp.vid(1), pg_temp.vid(2), pg_temp.vid(3))), 'preparo da ordem');
set local role authenticated;
set local request.jwt.claim.sub='user_740sup';
do $$
declare ordem uuid[];
begin
  select array_agg(f.vitrine_id) into ordem from admin_fila_verificacao_loja() f where f.vitrine_id in
    ('74000000-0000-4000-a000-000000000001','74000000-0000-4000-a000-000000000002','74000000-0000-4000-a000-000000000003');
  assert ordem = array['74000000-0000-4000-a000-000000000001','74000000-0000-4000-a000-000000000002','74000000-0000-4000-a000-000000000003']::uuid[], 'mais antigo primeiro';
end $$;

-- [3] Arquivo: só nos status equipe e revisao_amostra, só comprovante e fachada.
do $$
declare a record;
begin
  select * into a from admin_arquivo_verificacao_loja(pg_temp.req(1), 'comprovante');
  assert a.mime = 'application/pdf' and convert_from(decode(a.arquivo_base64, 'base64'), 'UTF8') like '%PDF-1.7 comprovante 1', 'comprovante volta inteiro';
  select * into a from admin_arquivo_verificacao_loja(pg_temp.req(1), 'fachada');
  assert a.mime = 'image/png' and position(convert_to('fachada 1', 'UTF8') in decode(a.arquivo_base64, 'base64')) > 0, 'fachada volta inteira';
  select * into a from admin_arquivo_verificacao_loja(pg_temp.req(3), 'comprovante');
  assert a.mime = 'application/pdf', 'amostra também entrega o comprovante';
  assert (select count(*) from admin_arquivo_verificacao_loja(pg_temp.req(2), 'fachada')) = 0, 'pedido sem fachada não devolve fachada';
  assert (select count(*) from admin_arquivo_verificacao_loja(pg_temp.req(4), 'comprovante')) = 0, 'pedido ainda enviado não entrega arquivo';
  assert (select count(*) from admin_arquivo_verificacao_loja(pg_temp.req(1), 'outro')) = 0, 'tipo desconhecido não devolve nada';
  assert (select count(*) from admin_arquivo_verificacao_loja(gen_random_uuid(), 'comprovante')) = 0, 'pedido inexistente não devolve nada';
end $$;
reset role;

-- [4] Decisões inválidas não mudam nada.
set local role authenticated;
set local request.jwt.claim.sub='user_740sup';
do $$
begin
  begin perform admin_decidir_verificacao_loja(pg_temp.req(1), 'aprovar', null, false); raise exception 'Aprovou sem conferir';
  exception when check_violation then null; end;
  begin perform admin_decidir_verificacao_loja(pg_temp.req(1), 'aprovar', null, null); raise exception 'Aprovou com conferido nulo';
  exception when check_violation then null; end;
  begin perform admin_decidir_verificacao_loja(pg_temp.req(2), 'correcao', null, null); raise exception 'Correção sem motivo';
  exception when check_violation then null; end;
  begin perform admin_decidir_verificacao_loja(pg_temp.req(2), 'recusar', '   ', null); raise exception 'Recusa com motivo em branco';
  exception when check_violation then null; end;
  begin perform admin_decidir_verificacao_loja(pg_temp.req(2), 'recusar', 'qualquer', null); raise exception 'Recusa com motivo fora da lista';
  exception when check_violation then null; end;
  begin perform admin_decidir_verificacao_loja(pg_temp.req(3), 'tirar_selo', null, null); raise exception 'Tirar selo sem motivo';
  exception when check_violation then null; end;
  begin perform admin_decidir_verificacao_loja(pg_temp.req(1), 'apagar', null, true); raise exception 'Decisão desconhecida';
  exception when sqlstate '22023' then null; end;
  begin perform admin_decidir_verificacao_loja(pg_temp.req(1), null, null, true); raise exception 'Decisão nula';
  exception when sqlstate '22023' then null; end;
  -- Decisão que não vale para o status do pedido.
  declare ok boolean := false; begin begin perform admin_decidir_verificacao_loja(pg_temp.req(1), 'confirmar', null, null); exception when sqlstate 'P0001' then ok := true; end; assert ok, 'Confirmar pedido da equipe'; end;
  declare ok boolean := false; begin begin perform admin_decidir_verificacao_loja(pg_temp.req(1), 'tirar_selo', 'outro', null); exception when sqlstate 'P0001' then ok := true; end; assert ok, 'Tirar selo de pedido da equipe'; end;
  declare ok boolean := false; begin begin perform admin_decidir_verificacao_loja(pg_temp.req(3), 'aprovar', null, true); exception when sqlstate 'P0001' then ok := true; end; assert ok, 'Aprovar pedido de amostra'; end;
  declare ok boolean := false; begin begin perform admin_decidir_verificacao_loja(pg_temp.req(3), 'recusar', 'outro', null); exception when sqlstate 'P0001' then ok := true; end; assert ok, 'Recusar pedido de amostra'; end;
  declare ok boolean := false; begin begin perform admin_decidir_verificacao_loja(pg_temp.req(4), 'aprovar', null, true); exception when sqlstate 'P0001' then ok := true; end; assert ok, 'Aprovar pedido ainda enviado'; end;
  declare ok boolean := false; begin begin perform admin_decidir_verificacao_loja(gen_random_uuid(), 'aprovar', null, true); exception when sqlstate 'P0001' then ok := true; end; assert ok, 'Aprovar pedido que não existe'; end;
end $$;
reset role;
select pg_temp.confere((select count(*) = 2 and bool_and(status = 'equipe' and comprovante is not null) from verificacoes_loja where id in (pg_temp.req(1), pg_temp.req(2))), 'nada mudou nos pedidos da equipe');
select pg_temp.confere((select status = 'revisao_amostra' and comprovante is not null from verificacoes_loja where id = pg_temp.req(3)), 'nada mudou na amostra');
select pg_temp.confere((select not selo_loja_verificada and verificacao_estado = 'pendente' from vitrines_lojas where id = pg_temp.vid(1)), 'loja 1 ainda sem selo');

-- [5] Aprovar (equipe): selo, CNPJ gravado, arquivos apagados, histórico.
set local role authenticated;
set local request.jwt.claim.sub='user_740sup';
select admin_decidir_verificacao_loja(pg_temp.req(1), 'aprovar', null, true);
reset role;
select pg_temp.confere((select selo_loja_verificada and verificacao_estado = 'aprovada' and verificacao_motivo is null and cnpj = '11222333000001'
    from vitrines_lojas where id = pg_temp.vid(1)), 'aprovar: selo, estado e CNPJ gravado');
select pg_temp.confere((select status = 'aprovada' and decidido_por = 'user_740sup' and decidido_em is not null and motivo is null
    and comprovante is null and tipo_comprovante is null and fachada is null and tipo_fachada is null
    from verificacoes_loja where id = pg_temp.req(1)), 'aprovar: pedido aprovado e arquivos apagados');
select pg_temp.confere((select count(*) = 1 from vitrines_acoes_admin where vitrine_id = pg_temp.vid(1) and acao = 'verificacao_aprovada'
    and admin_id = 'user_740sup' and detalhes->>'decisao' = 'aprovada' and detalhes->>'pedido' = pg_temp.req(1)::text), 'aprovar: histórico');
-- Corrida: outra pessoa decidiu primeiro.
set local role authenticated;
set local request.jwt.claim.sub='user_740adm';
do $$ begin
  declare ok boolean := false; begin begin perform admin_decidir_verificacao_loja(pg_temp.req(1), 'recusar', 'outro', null); exception when sqlstate 'P0001' then ok := true; end; assert ok, 'Decidiu pedido já decidido'; end;
  declare ok boolean := false; begin begin perform admin_decidir_verificacao_loja(pg_temp.req(1), 'aprovar', null, true); exception when sqlstate 'P0001' then ok := true; end; assert ok, 'Aprovou duas vezes'; end;
end $$;
reset role;
select pg_temp.confere((select selo_loja_verificada from vitrines_lojas where id = pg_temp.vid(1)), 'a segunda decisão não mexeu no selo');

-- [6] Pedir correção (equipe): motivo no pedido e na loja, selo fora, arquivos apagados.
set local role authenticated;
set local request.jwt.claim.sub='user_740sup';
select admin_decidir_verificacao_loja(pg_temp.req(2), 'correcao', 'comprovante_invalido', null);
reset role;
select pg_temp.confere((select status = 'correcao' and motivo = 'comprovante_invalido' and decidido_por = 'user_740sup'
    and comprovante is null and fachada is null from verificacoes_loja where id = pg_temp.req(2)), 'correção: pedido');
select pg_temp.confere((select verificacao_estado = 'correcao' and verificacao_motivo = 'comprovante_invalido' and not selo_loja_verificada
    from vitrines_lojas where id = pg_temp.vid(2)), 'correção: loja');
select pg_temp.confere((select count(*) = 1 from vitrines_acoes_admin where vitrine_id = pg_temp.vid(2) and acao = 'verificacao_correcao'
    and admin_id = 'user_740sup' and motivo = 'comprovante_invalido'), 'correção: histórico');

-- [7] Recusar (equipe) e dados que mudaram.
select pg_temp.nova(5, true) \gset
select pg_temp.nova(6) \gset
select pg_temp.nova(7) \gset
select pg_temp.equipe(5, 20, interval '1 hour');
select pg_temp.equipe(6, 20, interval '1 hour');
select pg_temp.equipe(7, 20, interval '1 hour');
set local role authenticated;
set local request.jwt.claim.sub='user_740sup';
select admin_decidir_verificacao_loja(pg_temp.req(5), 'recusar', 'cnpj_nao_encontrado', null);
reset role;
select pg_temp.confere((select status = 'recusada' and motivo = 'cnpj_nao_encontrado' and comprovante is null and fachada is null and tipo_fachada is null
    from verificacoes_loja where id = pg_temp.req(5)), 'recusar: pedido e arquivos apagados');
select pg_temp.confere((select verificacao_estado = 'recusada' and verificacao_motivo = 'cnpj_nao_encontrado' and not selo_loja_verificada
    from vitrines_lojas where id = pg_temp.vid(5)), 'recusar: loja');
select pg_temp.confere((select count(*) = 1 from vitrines_acoes_admin where vitrine_id = pg_temp.vid(5) and acao = 'verificacao_recusada' and admin_id = 'user_740sup'), 'recusar: histórico');

-- O cadastro mudou depois do envio (endereço da loja 6): aprovar falha, o pedido segue aberto.
update vitrines_lojas set endereco = 'Outra rua, 99' where id = pg_temp.vid(6);
set local role authenticated;
set local request.jwt.claim.sub='user_740sup';
do $$ begin
  declare ok boolean := false; begin begin perform admin_decidir_verificacao_loja(pg_temp.req(6), 'aprovar', null, true); exception when sqlstate 'P0001' then ok := true; end; assert ok, 'Aprovou cadastro que mudou'; end;
end $$;
reset role;
select pg_temp.confere((select status = 'equipe' and comprovante is not null from verificacoes_loja where id = pg_temp.req(6))
  and (select not selo_loja_verificada from vitrines_lojas where id = pg_temp.vid(6)), 'cadastro mudou: nada foi aprovado');
-- ...mas a equipe consegue recusar, e o pedido não fica preso na fila.
set local role authenticated;
set local request.jwt.claim.sub='user_740sup';
select admin_decidir_verificacao_loja(pg_temp.req(6), 'correcao', 'dados_mudaram', null);
reset role;
select pg_temp.confere((select status = 'correcao' and comprovante is null from verificacoes_loja where id = pg_temp.req(6)), 'cadastro mudou: dá para pedir correção');

-- CNPJ que já é de outra loja: aprovar falha com mensagem clara.
update vitrines_lojas set cnpj = '11222333000007' where id = pg_temp.vid(4);
set local role authenticated;
set local request.jwt.claim.sub='user_740sup';
do $$ begin
  begin perform admin_decidir_verificacao_loja(pg_temp.req(7), 'aprovar', null, true); raise exception 'Aprovou CNPJ de outra loja';
  exception when check_violation then null; end;
end $$;
reset role;
select pg_temp.confere((select status = 'equipe' and comprovante is not null from verificacoes_loja where id = pg_temp.req(7))
  and (select not selo_loja_verificada and cnpj is null from vitrines_lojas where id = pg_temp.vid(7)), 'CNPJ duplicado: nada foi aprovado nem gravado');

-- [8] Revisão por amostra: confirmar apaga os arquivos e mantém o selo.
update verificacoes_loja set decidido_em = now() - interval '2 days' where id = pg_temp.req(3);
set local role authenticated;
set local request.jwt.claim.sub='user_740sup';
select admin_decidir_verificacao_loja(pg_temp.req(3), 'confirmar', null, null);
reset role;
select pg_temp.confere((select decidido_em > now() - interval '1 day' from verificacoes_loja where id = pg_temp.req(3)), 'confirmar: decidido_em é o da equipe');
select pg_temp.confere((select status = 'aprovada' and decidido_por = 'user_740sup' and comprovante is null and fachada is null
    and tipo_comprovante is null and tipo_fachada is null and parecer @> '[{"item":"revisao_humana","ok":true}]'::jsonb
    from verificacoes_loja where id = pg_temp.req(3)), 'confirmar: pedido aprovado, arquivos apagados, parecer');
select pg_temp.confere((select selo_loja_verificada and verificacao_estado = 'aprovada' from vitrines_lojas where id = pg_temp.vid(3)), 'confirmar: selo continua');
select pg_temp.confere((select count(*) = 1 from vitrines_acoes_admin where vitrine_id = pg_temp.vid(3) and acao = 'verificacao_revisada' and admin_id = 'user_740sup'), 'confirmar: histórico');
set local role authenticated;
set local request.jwt.claim.sub='user_740adm';
do $$ begin
  declare ok boolean := false; begin begin perform admin_decidir_verificacao_loja(pg_temp.req(3), 'tirar_selo', 'outro', null); exception when sqlstate 'P0001' then ok := true; end; assert ok, 'Mexeu em amostra já revisada'; end;
end $$;
reset role;

-- [9] Tirar o selo: selo cai, pedido vira correção, a loja é avisada uma vez e a equipe ganha o aviso da lista.
select pg_temp.nova(8, true) \gset
select pg_temp.amostra(8, interval '7 days');
select pg_temp.confere((select selo_loja_verificada from vitrines_lojas where id = pg_temp.vid(8)), 'preparo: loja 8 com selo da IA');
update verificacoes_loja set decidido_em = now() - interval '2 days' where id = pg_temp.req(8);
set local role authenticated;
set local request.jwt.claim.sub='user_740sup';
select admin_decidir_verificacao_loja(pg_temp.req(8), 'tirar_selo', 'titularidade', null);
reset role;
select pg_temp.confere((select decidido_em > now() - interval '1 day' from verificacoes_loja where id = pg_temp.req(8)), 'tirar selo: decidido_em é o da equipe');
select pg_temp.confere((select not selo_loja_verificada and verificacao_estado = 'correcao' and verificacao_motivo = 'titularidade'
    from vitrines_lojas where id = pg_temp.vid(8)), 'tirar selo: a loja perde o selo e pede correção');
select pg_temp.confere((select status = 'correcao' and motivo = 'titularidade' and decidido_por = 'user_740sup'
    and comprovante is null and fachada is null and parecer @> '[{"item":"revisao_humana","ok":false}]'::jsonb
    from verificacoes_loja where id = pg_temp.req(8)), 'tirar selo: pedido e arquivos apagados');
select pg_temp.confere((select count(*) = 1 from vitrines_acoes_admin where vitrine_id = pg_temp.vid(8) and acao = 'verificacao_selo_removido'
    and admin_id = 'user_740sup' and motivo = 'titularidade'), 'tirar selo: histórico');
select pg_temp.confere((select count(*) = 1 and bool_and(detalhe->>'motivo' = 'titularidade' and detalhe->>'pedido' = pg_temp.req(8)::text)
    from verificacao_loja_avisos where vitrine_id = pg_temp.vid(8) and tipo = 'amostra_erro' and resolvido_em is null), 'tirar selo: aviso amostra_erro aberto');
-- Sem aviso duplicado: o sino da loja avisa pela transição do pedido (uma vez); não há outro caminho.
select pg_temp.confere((select count(*) = 1 from notificacoes where usuario_id = 'user_740x8' and tipo = 'verificacao_falta_algo'), 'tirar selo: a loja é avisada uma vez só');
select pg_temp.confere((select count(*) = 1 from verificacao_loja_avisos where vitrine_id = pg_temp.vid(8)), 'tirar selo: um aviso só da equipe');

-- Amostra cujo selo já caiu (cadastro mudou): confirmar e tirar o selo falham.
select pg_temp.nova(9) \gset
select pg_temp.amostra(9, interval '7 days');
update vitrines_lojas set endereco = 'Rua Nova, 1' where id = pg_temp.vid(9);
select pg_temp.confere((select not selo_loja_verificada from vitrines_lojas where id = pg_temp.vid(9)), 'preparo: mudar o endereço derruba o selo');
set local role authenticated;
set local request.jwt.claim.sub='user_740sup';
do $$ begin
  declare ok boolean := false; begin begin perform admin_decidir_verificacao_loja(pg_temp.req(9), 'confirmar', null, null); exception when sqlstate 'P0001' then ok := true; end; assert ok, 'Confirmou amostra sem selo'; end;
  declare ok boolean := false; begin begin perform admin_decidir_verificacao_loja(pg_temp.req(9), 'tirar_selo', 'outro', null); exception when sqlstate 'P0001' then ok := true; end; assert ok, 'Tirou selo que já caiu'; end;
end $$;
reset role;

-- [10] Avisos: listam com o nome da loja e resolvem uma vez.
insert into verificacao_loja_avisos(vitrine_id, tipo, detalhe) values (pg_temp.vid(1), 'mudou_nome', '{"antes":"A","depois":"B"}');
set local role authenticated;
set local request.jwt.claim.sub='user_740sup';
do $$
declare a record; mudou uuid; erro uuid;
begin
  select id into erro from admin_avisos_verificacao_loja() x where x.tipo = 'amostra_erro' and x.vitrine_id = '74000000-0000-4000-a000-000000000008';
  select id into mudou from admin_avisos_verificacao_loja() x where x.tipo = 'mudou_nome' and x.vitrine_id = '74000000-0000-4000-a000-000000000001';
  assert erro is not null and mudou is not null, 'os dois avisos aparecem';
  select * into a from admin_avisos_verificacao_loja() x where x.id = erro;
  assert a.loja_nome = 'Loja 740 8' and a.detalhe->>'motivo' = 'titularidade' and a.criado_em is not null, 'aviso traz loja e detalhe';
  perform admin_resolver_aviso_verificacao(erro);
  assert not exists (select 1 from admin_avisos_verificacao_loja() x where x.id = erro), 'resolvido sai da lista';
  assert exists (select 1 from admin_avisos_verificacao_loja() x where x.id = mudou), 'o outro continua';
  declare ok boolean := false; begin begin perform admin_resolver_aviso_verificacao(erro); exception when sqlstate 'P0001' then ok := true; end; assert ok, 'Resolveu duas vezes'; end;
  declare ok boolean := false; begin begin perform admin_resolver_aviso_verificacao(gen_random_uuid()); exception when sqlstate 'P0001' then ok := true; end; assert ok, 'Resolveu aviso que não existe'; end;
end $$;
reset role;
select pg_temp.confere((select resolvido_em is not null and resolvido_por = 'user_740sup' from verificacao_loja_avisos
    where vitrine_id = pg_temp.vid(8) and tipo = 'amostra_erro'), 'aviso resolvido guarda quem e quando');
-- Com o aviso resolvido, um erro novo da mesma loja abre outro aviso.
select pg_temp.confere((select count(*) = 1 from verificacao_loja_avisos where vitrine_id = pg_temp.vid(1) and tipo = 'mudou_nome' and resolvido_em is null), 'aviso aberto do outro tipo segue aberto');

-- [11] Limpeza diária das amostras: só vencidas; selo fica; cadastro que mudou vira obsoleto.
select pg_temp.nova(10, true) \gset
select pg_temp.nova(11, true) \gset
select pg_temp.nova(12) \gset
select pg_temp.amostra(10, interval '-1 hour');
select pg_temp.amostra(11, interval '3 days');
select pg_temp.amostra(12, interval '-1 day');
update vitrines_lojas set endereco = 'Rua Outra, 12' where id = pg_temp.vid(12);
-- Também há o pedido 9 (vence só em 7 dias): não pode mexer.
set local role service_role;
select verificacao_loja_limpar_amostras() as limpas \gset
reset role;
select pg_temp.confere(:limpas = 2, 'a limpeza mexeu só nos 2 vencidos: ' || :limpas);
select pg_temp.confere((select status = 'aprovada' and comprovante is null and fachada is null and tipo_comprovante is null and tipo_fachada is null
    and parecer @> '[{"item":"revisao_humana","nota":"não revisada"}]'::jsonb and (parecer -> -1 -> 'ok') = 'null'::jsonb
    from verificacoes_loja where id = pg_temp.req(10)), 'vencida: aprovada, sem arquivos, parecer "não revisada"');
select pg_temp.confere((select selo_loja_verificada and verificacao_estado = 'aprovada' from vitrines_lojas where id = pg_temp.vid(10)), 'vencida: o selo fica');
select pg_temp.confere((select status = 'revisao_amostra' and comprovante is not null and fachada is not null from verificacoes_loja where id = pg_temp.req(11)), 'dentro do prazo: nada muda');
select pg_temp.confere((select status = 'obsoleta' and comprovante is null from verificacoes_loja where id = pg_temp.req(12))
  and (select not selo_loja_verificada from vitrines_lojas where id = pg_temp.vid(12)), 'vencida com selo já caído: obsoleta, sem arquivos');
select pg_temp.confere((select status = 'revisao_amostra' and comprovante is not null from verificacoes_loja where id = pg_temp.req(9)) is not distinct from true, 'pedido 9 (sem selo, no prazo) intocado');
set local role service_role;
select pg_temp.confere(verificacao_loja_limpar_amostras() = 0, 'segunda limpeza não encontra nada');
reset role;

-- [12] Ninguém lê as tabelas direto; só as funções.
set local role authenticated;
set local request.jwt.claim.sub='user_740sup';
do $$ begin
  begin perform 1 from verificacoes_loja limit 1; raise exception 'Leu a tabela de pedidos';
  exception when insufficient_privilege then null; end;
  begin perform 1 from verificacao_loja_avisos limit 1; raise exception 'Leu a tabela de avisos';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
