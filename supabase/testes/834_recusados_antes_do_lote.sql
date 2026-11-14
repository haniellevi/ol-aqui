\set ON_ERROR_STOP on
\set QUIET on
-- Anúncio recusado pela equipe ANTES do lote 20261125010000 (sem a marca de revisão) não pode voltar ao ar
-- sem análise. O automatizados.py reaplica a migração do lote no meio deste teste, no lugar da marca de reaplicação
-- (o mesmo jeito do teste 400): a marca tem que aparecer no anúncio que já existia.
-- Sem o lote reaplicado, a marca não é trocada e o caso FALHA de propósito.
begin;
reset role;
set local request.jwt.claim.role='';
set local request.jwt.claim.sub='';

create function pg_temp.confere(ok boolean, caso text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FALHOU: %', caso; end if;
end $$;

select id as regiao from microrregioes where slug='corrente-pi' \gset
select id as moveis from categorias where slug='sofas-e-poltronas' \gset
insert into perfis(id, microrregiao_id, nome, cidade, whatsapp, whatsapp_verificado_em) values
  ('user_h8dono', :'regiao', 'Dona H8', 'Corrente', '5589999980081', now());
insert into vitrines_lojas(id, dono_id, microrregiao_id, slug, nome, cidade, tipo, plano, plano_expira_em, teste_expira_em, status) values
  ('80000000-0000-4000-c000-000000000001', 'user_h8dono', :'regiao', 'h8-loja', 'Loja H8', 'Corrente', 'loja', 'full', now() + interval '30 days', now() + interval '30 days', 'ativa');
-- estado de antes do lote: recusado pela equipe (pausado, motivo "Recusado: ..."), sem a marca de revisão
insert into anuncios(id, vitrine_id, microrregiao_id, categoria_id, titulo, cidade, preco_centavos, atributos, status, motivo_analise, revisao_manual_admin, fotos) values
  ('80000000-0000-4000-a000-000000000001', '80000000-0000-4000-c000-000000000001', :'regiao', :'moveis', 'Sofá H8 recusado', 'Corrente', 40000,
   '{"estado":"usado"}', 'pausado', 'Recusado: fora das regras do OLAKI', false,
   array['https://abc.supabase.co/storage/v1/object/public/anuncios/user_h8dono/80000000-0000-4000-a000-000000000001/1.webp']);
-- outros estados de um anúncio recusado antes do lote: voltou a rascunho, já republicado, e um aprovado (controle)
insert into anuncios(id, vitrine_id, microrregiao_id, categoria_id, titulo, cidade, preco_centavos, atributos, status, motivo_analise, revisao_manual_admin, fotos) values
  ('80000000-0000-4000-a000-000000000002', '80000000-0000-4000-c000-000000000001', :'regiao', :'moveis', 'Sofá H8 rascunho', 'Corrente', 40000,
   '{"estado":"usado"}', 'rascunho', 'Recusado: foto', false,
   array['https://abc.supabase.co/storage/v1/object/public/anuncios/user_h8dono/80000000-0000-4000-a000-000000000002/1.webp']),
  ('80000000-0000-4000-a000-000000000003', '80000000-0000-4000-c000-000000000001', :'regiao', :'moveis', 'Sofá H8 republicado', 'Corrente', 40000,
   '{"estado":"usado"}', 'ativo', 'Recusado: preço', false,
   array['https://abc.supabase.co/storage/v1/object/public/anuncios/user_h8dono/80000000-0000-4000-a000-000000000003/1.webp']),
  ('80000000-0000-4000-a000-000000000004', '80000000-0000-4000-c000-000000000001', :'regiao', :'moveis', 'Sofá H8 aprovado', 'Corrente', 40000,
   '{"estado":"usado"}', 'ativo', null, false,
   array['https://abc.supabase.co/storage/v1/object/public/anuncios/user_h8dono/80000000-0000-4000-a000-000000000004/1.webp']);

-- LOTE_REAPLICADO

select pg_temp.confere((select revisao_manual_admin from anuncios where id = '80000000-0000-4000-a000-000000000001'),
  'anúncio recusado antes do lote ganha a marca de revisão manual');
select set_config('request.jwt.claim.sub', 'user_h8dono', false), set_config('request.jwt.claim.role', 'authenticated', false) \g /dev/null;
set role authenticated;
select pg_temp.confere(publicar_anuncio('80000000-0000-4000-a000-000000000001') = 'em_analise',
  'dona republica anúncio recusado antes do lote: vai para análise, não volta ao ar');
reset role;
select pg_temp.confere((select status = 'em_analise' from anuncios where id = '80000000-0000-4000-a000-000000000001'),
  'status em análise no banco depois da republicação');
select pg_temp.confere((select count(*) = 0 from anuncios where status = 'ativo' and id = '80000000-0000-4000-a000-000000000001'),
  'este anúncio recusado não fica ativo sem análise');
-- rascunho e já republicado também ganham a marca; nenhum status muda; o aprovado fica como estava
select pg_temp.confere((select bool_and(revisao_manual_admin) from anuncios
                         where id in ('80000000-0000-4000-a000-000000000002', '80000000-0000-4000-a000-000000000003')),
  'recusado em rascunho e recusado já republicado ganham a marca de revisão');
select pg_temp.confere((select status from anuncios where id = '80000000-0000-4000-a000-000000000003') = 'ativo',
  'a migração não tira do ar o que já estava ativo (só marca)');
select pg_temp.confere((select status from anuncios where id = '80000000-0000-4000-a000-000000000002') = 'rascunho',
  'a migração não muda o status do rascunho');
select pg_temp.confere((select not revisao_manual_admin from anuncios where id = '80000000-0000-4000-a000-000000000004'),
  'anúncio aprovado não ganha marca');
set role authenticated;
select pg_temp.confere(publicar_anuncio('80000000-0000-4000-a000-000000000002') = 'em_analise',
  'recusado que voltou a rascunho vai para análise ao publicar');
reset role;

rollback;
\echo 'OK: anúncio recusado antes do lote não volta ao ar sem análise'
