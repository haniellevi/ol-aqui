\set ON_ERROR_STOP on
\set QUIET on
-- Leitura pública de colunas (relatório de 13/11/2026, achados A-01 e B-03).
-- Visitante lê só as colunas das telas públicas e não lê o ID do dono da loja.
-- Logado não lê o IP de criação nem a revisão manual da equipe, mesmo sendo dono ou administrador.
-- Telas do site (dona, ajudante, administrador) continuam lendo o que usam.
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

select id as regiao from microrregioes where slug='corrente-pi' \gset
select id as cat from categorias where slug='sofas-e-poltronas' \gset

insert into perfis(id, microrregiao_id, nome, whatsapp, whatsapp_verificado_em, cidade, tipo_pessoa) values
  ('user_g1dono',  :'regiao', 'Dona G1',   '5589999970001', now(), 'Corrente', 'pf'),
  ('user_g1outro', :'regiao', 'Outro G1',  '5589999970002', now(), 'Corrente', 'pf'),
  ('user_g1adm',   :'regiao', 'Admin G1',  '5589999970003', now(), 'Corrente', 'pf');
update perfis set e_admin = true where id = 'user_g1adm';
insert into vitrines_lojas(dono_id, microrregiao_id, slug, nome, cidade, tipo, plano, plano_expira_em, teste_expira_em) values
  ('user_g1dono', :'regiao', 'g1-loja', 'Loja G1', 'Corrente', 'loja', 'full', now() + interval '10 days', now() + interval '10 days');
select id as vit from vitrines_lojas where slug = 'g1-loja' \gset
insert into anuncios(id, vitrine_id, categoria_id, categoria, titulo, descricao, cidade, preco_centavos, atributos, status, slug,
                     criado_ip, motivo_analise, revisao_manual_admin, pago_ate, publicado_em) values
  ('83000000-0000-4000-b000-000000000001', :'vit', :'cat', 'geral', 'Sofá G1 no ar', 'Descrição pública', 'Corrente', 40000,
   '{"estado":"usado"}', 'ativo', 'sofa-g1-1', '203.0.113.99', 'nota interna G1', true, now() + interval '30 days', now()),
  ('83000000-0000-4000-b000-000000000002', :'vit', :'cat', 'geral', 'Mesa G1 em análise', 'Descrição da mesa', 'Corrente', 30000,
   '{}', 'em_analise', 'mesa-g1-2', '203.0.113.98', 'motivo g1 em análise', false, null, null);

-- Guarda da lista de colunas (roda como dono do banco): só o IP e a revisão da equipe ficam de fora para logado.
select pg_temp.confere(not has_column_privilege('anon', 'public.anuncios', 'criado_ip', 'SELECT'), 'visitante sem IP de criação');
select pg_temp.confere(not has_column_privilege('authenticated', 'public.anuncios', 'criado_ip', 'SELECT'), 'logado sem IP de criação');
select pg_temp.confere(not has_column_privilege('authenticated', 'public.anuncios', 'revisao_manual_admin', 'SELECT'), 'logado sem revisão da equipe');
select pg_temp.confere(not has_column_privilege('anon', 'public.anuncios', 'motivo_analise', 'SELECT'), 'visitante sem nota de moderação');
select pg_temp.confere(not has_column_privilege('anon', 'public.vitrines_lojas', 'dono_id', 'SELECT'), 'visitante sem ID do dono');
select pg_temp.confere(has_column_privilege('authenticated', 'public.vitrines_lojas', 'dono_id', 'SELECT'), 'logado continua lendo dono_id');
select pg_temp.confere(has_column_privilege('authenticated', 'public.anuncios', 'motivo_analise', 'SELECT'), 'dona continua lendo motivo_analise');
-- Guarda: logado lê toda coluna nova de anuncios, menos as duas internas. Coluna nova sem grant quebra este teste de propósito.
select pg_temp.confere(
  (select count(*) from information_schema.columns c where c.table_schema = 'public' and c.table_name = 'anuncios'
     and has_column_privilege('authenticated', 'public.anuncios', c.column_name, 'SELECT'))
  = (select count(*) - 2 from information_schema.columns c where c.table_schema = 'public' and c.table_name = 'anuncios'),
  'logado lê todas as colunas de anuncios menos criado_ip e revisao_manual_admin');

-- A. visitante (anon)
set local role anon;
select pg_temp.confere((select count(*) = 1 from anuncios where id = '83000000-0000-4000-b000-000000000001' and titulo = 'Sofá G1 no ar'),
  'visitante lê o anúncio no ar pelas colunas da vitrine');
select pg_temp.confere((select count(*) = 0 from anuncios where id = '83000000-0000-4000-b000-000000000002'), 'visitante não vê anúncio em análise');
select pg_temp.confere((select count(*) = 1 from vitrines_lojas where slug = 'g1-loja' and nome = 'Loja G1'), 'visitante lê colunas públicas da loja');
select pg_temp.confere((select count(*) = 1 from anuncios_cards_extra(array['83000000-0000-4000-b000-000000000001'::uuid]) where uf is not null),
  'card do visitante continua recebendo a UF (anuncios_cards_extra roda como visitante)');
select pg_temp.recusa('select criado_ip from anuncios limit 1', '42501');
select pg_temp.recusa('select motivo_analise from anuncios limit 1', '42501');
select pg_temp.recusa('select revisao_manual_admin from anuncios limit 1', '42501');
select pg_temp.recusa('select pago_ate from anuncios limit 1', '42501');
select pg_temp.recusa('select * from anuncios limit 1', '42501');
select pg_temp.recusa('select dono_id from vitrines_lojas limit 1', '42501');
reset role;

-- B. dona (user_g1dono)
set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='user_g1dono';
select pg_temp.confere((select motivo_analise = 'nota interna G1' and pago_ate is not null from anuncios where id = '83000000-0000-4000-b000-000000000001'),
  'dona lê motivo e prazo do próprio anúncio');
select pg_temp.confere((select count(*) = 2 from anuncios where vitrine_id = :'vit'), 'dona vê os dois anúncios da própria loja');
select pg_temp.recusa('select criado_ip from anuncios limit 1', '42501');
select pg_temp.recusa('select revisao_manual_admin from anuncios limit 1', '42501');
select pg_temp.recusa('select * from anuncios limit 1', '42501');
reset role;

-- C. outra pessoa logada (user_g1outro), antes de virar ajudante
set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='user_g1outro';
select pg_temp.confere((select count(*) = 1 from anuncios where id = '83000000-0000-4000-b000-000000000001' and titulo = 'Sofá G1 no ar'),
  'outra pessoa vê anúncio no ar');
select pg_temp.confere((select count(*) = 0 from anuncios where id = '83000000-0000-4000-b000-000000000002'), 'outra pessoa não vê anúncio em análise');
select pg_temp.recusa('select criado_ip from anuncios where id = ''83000000-0000-4000-b000-000000000001''', '42501');
reset role;

-- D. ajudante (mesmo usuário, agora aceito como ajudante da loja): vê a loja que ajuda, como antes
insert into convites_gerente_loja(vitrine_id, token_hash, telefone_hash, final_telefone, aceito_por, aceito_em)
  values (:'vit', 'g1_token_hash', 'g1_telefone_hash', '0001', 'user_g1outro', now());
set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='user_g1outro';
select pg_temp.confere((select count(*) = 1 from anuncios where id = '83000000-0000-4000-b000-000000000002'),
  'ajudante vê anúncio em análise da loja que ajuda (política de leitura com pode_mexer_vitrine)');
reset role;

-- E. administrador (user_g1adm)
set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='user_g1adm';
select pg_temp.confere((select count(*) = 1 from anuncios where status = 'em_analise' and motivo_analise = 'motivo g1 em análise'),
  'administrador vê a fila de análise com o motivo');
reset role;

rollback;
