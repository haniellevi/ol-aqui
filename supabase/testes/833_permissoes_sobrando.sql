-- Testes de permissões que sobram: privilégios de tabela, perguntas sobre outra conta e pedido de verificação.
-- Cada caso diz o que deve acontecer. Antes da migração, os casos "recusa" devem FALHAR (estado atual aberto).
-- Depois da migração, todos devem passar. Os casos "continua" provam que o site não quebra.
-- Simulação de login: papel anon/authenticated com request.jwt.claim.sub, como o Supabase faz.

\set QUIET on
\pset format unaligned
\pset tuples_only on
begin;

create temp table g4_res(caso text, ok boolean, obtido text, esperado text);

-- Roda a consulta como o papel pedido e compara com o esperado.
-- Esperado com % aceita prefixo (ex.: 'ERRO 42501%' para recusa por permissão).
create or replace function pg_temp.esperado(caso text, papel text, sub text, consulta text, esperado text) returns void
    language plpgsql as $$
declare obtido text; ok boolean;
begin
  perform set_config('request.jwt.claim.sub', coalesce(sub, ''), false);
  perform set_config('request.jwt.claim.role', case when papel in ('anon', 'authenticated') then papel else '' end, false);
  execute format('set role %I', papel);
  begin
    execute consulta into obtido;
  exception when others then
    obtido := 'ERRO ' || sqlstate || ': ' || sqlerrm;
  end;
  execute 'reset role';
  ok := obtido is not null and obtido like esperado;
  insert into g4_res values (caso, ok, obtido, esperado);
end $$;

-- ---------------------------------------------------------------------
-- Dados fictícios (postgres, sem papel)
-- ---------------------------------------------------------------------
reset role;
insert into perfis (id, microrregiao_id, nome, whatsapp, whatsapp_verificado_em, cidade, tipo_pessoa) values
  ('user_g4a',   (select id from microrregioes where slug = 'corrente-pi'), 'Cliente G4',  '5589999970001', now(), 'Corrente', 'pf'),
  ('user_g4b',   (select id from microrregioes where slug = 'corrente-pi'), 'Dona G4',     '5589999970002', now(), 'Corrente', 'pj'),
  ('user_g4adm', (select id from microrregioes where slug = 'corrente-pi'), 'Admin G4',    '5589999970003', now(), 'Corrente', 'pf'),
  ('user_g4sem', (select id from microrregioes where slug = 'corrente-pi'), 'Sem zap G4',  null,            null,  'Corrente', 'pf'),
  ('user_g4sup', (select id from microrregioes where slug = 'corrente-pi'), 'Suporte G4',  '5589999970004', now(), 'Corrente', 'pf'),
  ('user_g4ex',  (select id from microrregioes where slug = 'corrente-pi'), 'Ex-equipe G4', '5589999970005', now(), 'Corrente', 'pf');
update perfis set e_admin = true, e_super_admin = true where id = 'user_g4adm';

insert into vitrines_lojas (id, dono_id, microrregiao_id, slug, nome, cidade, tipo, plano, plano_expira_em, teste_expira_em, status) values
  ('b4000000-0000-4000-8000-000000000001', 'user_g4b', (select id from microrregioes where slug = 'corrente-pi'),
   'g4-loja', 'Loja G4', 'Corrente', 'loja', 'full', now() + interval '30 days', now() - interval '1 day', 'ativa');
-- o selo de loja verificada não entra pelo INSERT (trigger); o banco marca por UPDATE, como a equipe faz
update vitrines_lojas set selo_loja_verificada = true, verificacao_estado = 'aprovada' where id = 'b4000000-0000-4000-8000-000000000001';

insert into anuncios (id, vitrine_id, categoria_id, titulo, cidade, preco_centavos, atributos, status, slug) values
  ('a4000000-0000-4000-8000-000000000001', 'b4000000-0000-4000-8000-000000000001', (select id from categorias where slug = 'sofas-e-poltronas'),
   'Sofá G4 ativo', 'Corrente', 40000, '{"estado":"usado"}', 'ativo', 'g4-ativo'),
  ('a4000000-0000-4000-8000-000000000002', 'b4000000-0000-4000-8000-000000000001', (select id from categorias where slug = 'sofas-e-poltronas'),
   'Sofá G4 pausado', 'Corrente', 40000, '{"estado":"usado"}', 'pausado', 'g4-pausado');

insert into convites_gerente_loja (id, vitrine_id, token_hash, telefone_hash, final_telefone, expira_em, aceito_por, aceito_em) values
  ('c4000000-0000-4000-8000-000000000001', 'b4000000-0000-4000-8000-000000000001', '\x00', '\x00', '0003', now() + interval '7 days', 'user_g4adm', now());

-- equipe: suporte ativo (revisa lojas) e ex-membro inativo
insert into equipe (usuario_id, papel, ativo) values ('user_g4sup', 'suporte', true), ('user_g4ex', 'suporte', false);

-- ---------------------------------------------------------------------
-- B-04: sobras de privilégio de tabela (catálogo e privilégio efetivo)
-- ---------------------------------------------------------------------
select pg_temp.esperado('B-04 anon sem TRUNCATE/REFERENCES/TRIGGER/MAINTAIN em tabelas public', 'postgres', null,
  $q$select count(*)::text from pg_class c join pg_namespace n on n.oid = c.relnamespace
       cross join lateral aclexplode(c.relacl) a
      where n.nspname = 'public' and c.relkind in ('r','p','v','m','f')
        and a.grantee = (select oid from pg_roles where rolname = 'anon')
        and a.privilege_type in ('TRUNCATE','REFERENCES','TRIGGER','MAINTAIN')$q$, '0');
select pg_temp.esperado('B-04 authenticated sem TRUNCATE/REFERENCES/TRIGGER/MAINTAIN em tabelas public', 'postgres', null,
  $q$select count(*)::text from pg_class c join pg_namespace n on n.oid = c.relnamespace
       cross join lateral aclexplode(c.relacl) a
      where n.nspname = 'public' and c.relkind in ('r','p','v','m','f')
        and a.grantee = (select oid from pg_roles where rolname = 'authenticated')
        and a.privilege_type in ('TRUNCATE','REFERENCES','TRIGGER','MAINTAIN')$q$, '0');
select pg_temp.esperado('B-04 authenticated sem TRUNCATE em perfis, anuncios e vitrines', 'postgres', null,
  $q$select (has_table_privilege('authenticated','public.perfis','TRUNCATE')
          or has_table_privilege('authenticated','public.anuncios','TRUNCATE')
          or has_table_privilege('authenticated','public.vitrines_lojas','TRUNCATE'))::text$q$, 'false');
create table public.g4_tabela_nova (x int);
select pg_temp.esperado('B-04 tabela nova criada pelo postgres nasce sem TRUNCATE para authenticated', 'postgres', null,
  $q$select has_table_privilege('authenticated','public.g4_tabela_nova','TRUNCATE')::text$q$, 'false');
drop table public.g4_tabela_nova;
select pg_temp.esperado('B-04 continua: authenticated mantém SELECT por coluna, UPDATE e INSERT em anuncios, e DELETE em perfis (a RLS decide o resto)', 'postgres', null,
  $q$select (has_column_privilege('authenticated','public.anuncios','status','SELECT') and has_table_privilege('authenticated','public.anuncios','UPDATE')
         and has_table_privilege('authenticated','public.anuncios','INSERT') and has_table_privilege('authenticated','public.perfis','DELETE'))::text$q$, 'true');
select pg_temp.esperado('B-04 continua: anon mantém SELECT por coluna em anuncios (as colunas das telas públicas)', 'postgres', null,
  $q$select has_column_privilege('anon','public.anuncios','titulo','SELECT')::text$q$, 'true');

-- ---------------------------------------------------------------------
-- B-01: perguntas sobre outra conta e uso normal do site
-- ---------------------------------------------------------------------
select pg_temp.esperado('B-01 recusa: visitante não descobre se uma conta é admin', 'anon', null,
  $q$select public.e_admin('user_g4adm')::text$q$, 'false');
select pg_temp.esperado('B-01 recusa: visitante não descobre se uma conta é super admin', 'anon', null,
  $q$select public.e_super_admin('user_g4adm')::text$q$, 'false');
select pg_temp.esperado('B-01 recusa: visitante não descobre se a conta tem WhatsApp confirmado', 'anon', null,
  $q$select public.whatsapp_confirmado('user_g4b')::text$q$, 'false');
select pg_temp.esperado('B-01 recusa: logado comum não descobre se outra conta é admin', 'authenticated', 'user_g4a',
  $q$select public.e_admin('user_g4adm')::text$q$, 'false');
select pg_temp.esperado('B-01 recusa: logado comum não descobre se outra conta tem plano pago', 'authenticated', 'user_g4a',
  $q$select public.tem_plano_pago('user_g4b')::text$q$, 'false');
select pg_temp.esperado('B-01 recusa: logado comum não descobre quantas propostas outra loja tem', 'authenticated', 'user_g4a',
  $q$select public.propostas_restantes('user_g4b')::text$q$, '0');
select pg_temp.esperado('B-01 recusa: logado comum não descobre o WhatsApp de outra conta', 'authenticated', 'user_g4a',
  $q$select public.whatsapp_confirmado('user_g4b')::text$q$, 'false');
select pg_temp.esperado('B-01 recusa: visitante nem chama recursos_vitrine_id (sem permissão de execução)', 'anon', null,
  $q$select string_agg(x::text, ';') from public.recursos_vitrine_id('b4000000-0000-4000-8000-000000000001') x$q$, 'ERRO 42501%');
select pg_temp.esperado('B-01 recusa: logado que não é da loja não vê os limites dela', 'authenticated', 'user_g4a',
  $q$select string_agg(x::text, ';') from public.recursos_vitrine_id('b4000000-0000-4000-8000-000000000001') x$q$, '(f,0,0)');
select pg_temp.esperado('B-01 continua: a dona vê os limites do plano da própria loja (plano full tem foto de fachada)', 'authenticated', 'user_g4b',
  $q$select string_agg(x.foto_fachada::text, ';') from public.recursos_vitrine_id('b4000000-0000-4000-8000-000000000001') x$q$, 'true');
select pg_temp.esperado('B-01 continua: logado vê o próprio status de admin (false para comum)', 'authenticated', 'user_g4a',
  $q$select public.e_admin()::text$q$, 'false');
select pg_temp.esperado('B-01 continua: admin consulta o plano de outra conta (painel)', 'authenticated', 'user_g4adm',
  $q$select public.tem_plano_pago('user_g4b')::text$q$, 'true');
select pg_temp.esperado('B-01 continua: admin vê o próprio status de admin', 'authenticated', 'user_g4adm',
  $q$select public.e_admin()::text$q$, 'true');
select pg_temp.esperado('B-01 continua: admin vê WhatsApp de outra conta (painel)', 'authenticated', 'user_g4adm',
  $q$select public.whatsapp_confirmado('user_g4b')::text$q$, 'true');
select pg_temp.esperado('B-01 continua: suporte da equipe ativo consulta o WhatsApp do dono (revisão de loja)', 'authenticated', 'user_g4sup',
  $q$select public.whatsapp_confirmado('user_g4b')::text$q$, 'true');
select pg_temp.esperado('B-01 recusa: ex-membro da equipe (inativo) não consulta o WhatsApp do dono', 'authenticated', 'user_g4ex',
  $q$select public.whatsapp_confirmado('user_g4b')::text$q$, 'false');
select pg_temp.esperado('B-01 continua: logado com WhatsApp vê o próprio (sem argumento, como o site)', 'authenticated', 'user_g4a',
  $q$select public.whatsapp_confirmado()::text$q$, 'true');
select pg_temp.esperado('B-01 continua: dona vê o próprio plano (sem argumento)', 'authenticated', 'user_g4b',
  $q$select public.tem_plano_pago()::text$q$, 'true');
select pg_temp.esperado('B-01 continua: RLS de anúncios para visitante (e_admin na política) lê só o visível', 'anon', null,
  $q$select (select count(*) from anuncios where id = 'a4000000-0000-4000-8000-000000000001')::text
          || '/' || (select count(*) from anuncios where id = 'a4000000-0000-4000-8000-000000000002')::text$q$, '1/0');
select pg_temp.esperado('B-01 continua: equipe da loja mostra o gerente que é admin (e_equipe)', 'authenticated', 'user_g4b',
  $q$select string_agg(e_equipe::text, ',') from public.equipe_minha_loja('b4000000-0000-4000-8000-000000000001')$q$, 'true');
select pg_temp.esperado('B-01 continua: criar pedido do Radar com WhatsApp confirmado (política usa whatsapp_confirmado())', 'authenticated', 'user_g4a',
  $q$with x as (insert into radar_pedidos(id, comprador_id, microrregiao_id, titulo, cidade, modo_contato, visibilidade, categoria_id)
        values ('d4000000-0000-4000-8000-000000000001', 'user_g4a', (select id from microrregioes where slug = 'corrente-pi'),
                'Procuro sofá G4', 'Corrente', 'whatsapp_direto', 'lojas', (select id from categorias where slug = 'sofas-e-poltronas'))
        returning id) select 'inserido' from x$q$, 'inserido');

-- ---------------------------------------------------------------------
-- M-05: pedido de verificação de perfil
-- ---------------------------------------------------------------------
select pg_temp.esperado('M-05 recusa: cliente não aponta verificação para o documento de outra pessoa', 'authenticated', 'user_g4a',
  $q$with x as (insert into perfis_verificacoes (perfil_id, tipo, arquivo_path)
        values ('user_g4a', 'documento', 'user_g4b/doc.jpg') returning id) select 'inserido' from x$q$, 'ERRO 42501%');
select pg_temp.esperado('M-05 recusa: caminho com ".." sai da própria pasta e é recusado', 'authenticated', 'user_g4a',
  $q$with x as (insert into perfis_verificacoes (perfil_id, tipo, arquivo_path)
        values ('user_g4a', 'documento', 'user_g4a/../user_g4b/doc.jpg') returning id) select 'inserido' from x$q$, 'ERRO 42501%');
select pg_temp.esperado('M-05 recusa: pedido de verificação para outra conta (perfil de outro) é recusado', 'authenticated', 'user_g4a',
  $q$with x as (insert into perfis_verificacoes (perfil_id, tipo) values ('user_g4b', 'cnpj') returning id) select 'inserido' from x$q$, 'ERRO 42501%');
select pg_temp.esperado('M-05 continua: cliente envia a própria verificação (caminho na própria pasta, como o teste 80)', 'authenticated', 'user_g4a',
  $q$with x as (insert into perfis_verificacoes (perfil_id, tipo, arquivo_path) values ('user_g4a', 'selfie', 'user_g4a/selfie.jpg') returning id) select 'inserido' from x$q$, 'inserido');
select pg_temp.esperado('M-05 continua: cliente envia verificação sem arquivo (status pendente)', 'authenticated', 'user_g4a',
  $q$with x as (insert into perfis_verificacoes (perfil_id, tipo) values ('user_g4a', 'cnpj') returning id) select 'inserido' from x$q$, 'inserido');
select pg_temp.esperado('M-05 continua: serviço (postgres) ainda grava verificação', 'postgres', null,
  $q$with x as (insert into perfis_verificacoes (perfil_id, tipo) values ('user_g4sem', 'cnpj') returning id) select 'inserido' from x$q$, 'inserido');
select pg_temp.esperado('M-05 continua: cliente lê a própria verificação', 'authenticated', 'user_g4sem',
  $q$select (count(*) >= 1)::text from perfis_verificacoes where perfil_id = 'user_g4sem'$q$, 'true');
select pg_temp.esperado('M-05 continua: a política de envio existe e exige o caminho da própria pessoa', 'postgres', null,
  $q$select count(*)::text from pg_policies where schemaname = 'public' and tablename = 'perfis_verificacoes' and policyname = 'verificacao propria envio' and with_check like '%starts_with%'$q$, '1');

-- ---------------------------------------------------------------------
-- Resultado
-- ---------------------------------------------------------------------
select 'RESULTADO permissões: ' || count(*) filter (where ok) || ' ok de ' || count(*) || ' casos' from g4_res;
select '  FALHOU: ' || caso || ' | obtido=' || coalesce(obtido, 'NULL') || ' | esperado=' || esperado from g4_res where not ok order by caso;
do $$ begin
  assert (select count(*) from g4_res where not ok) = 0, 'Há casos de permissão fora do esperado (ver FALHOU acima)';
end $$;
rollback;
