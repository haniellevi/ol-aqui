\set ON_ERROR_STOP on
\set QUIET on
begin;

create function pg_temp.recusa(comando text) returns void language plpgsql as $$
begin
  begin execute comando;
  exception when insufficient_privilege or check_violation or invalid_parameter_value then return;
  end;
  raise exception 'Comando aceito indevidamente: %', comando;
end $$;

select id as regiao from microrregioes where slug = 'corrente-pi' \gset
insert into perfis(id, microrregiao_id, nome, cidade, whatsapp, whatsapp_verificado_em) values
  ('user_dono420', :'regiao', 'Dono', 'Corrente', '5589999990421', now()),
  ('user_gerente420', :'regiao', 'Gerente', 'Corrente', '5589999990422', null),
  ('user_terceiro420', :'regiao', 'Terceiro', 'Corrente', '5589999990423', now());
insert into vitrines_lojas(id, dono_id, microrregiao_id, slug, nome, cidade, tipo)
values
  ('42000000-0000-4000-a000-000000000001', 'user_dono420', :'regiao', 'gerencia-420', 'Loja de teste 420', 'Corrente', 'loja'),
  ('42000000-0000-4000-a000-000000000002', 'user_terceiro420', :'regiao', 'gerencia-421', 'Outra loja 421', 'Corrente', 'loja');

update configuracoes set valor = '["bloqueiofake420"]' where chave = 'moderacao.palavras_bloqueadas' and microrregiao_id is null;

set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = 'user_dono420';
do $$ begin
  assert (select count(*) = 1 and bool_and(dono) from minhas_lojas()), 'dono vê a loja própria';
end $$;
select convidar_gerente_loja('42000000-0000-4000-a000-000000000001', '5589999990422') as token \gset
select convidar_gerente_loja('42000000-0000-4000-a000-000000000001', '5589999990422') as vencido \gset
select convidar_gerente_loja('42000000-0000-4000-a000-000000000001', '5589999990422') as cancelado \gset
select set_config('teste.token', :'token', true), set_config('teste.vencido', :'vencido', true), set_config('teste.cancelado', :'cancelado', true);
select pg_temp.recusa($q$select * from convites_gerente_loja$q$);

set local request.jwt.claim.sub = 'user_terceiro420';
do $$ begin
  assert not exists(select 1 from convite_gerente_loja(current_setting('teste.token')::uuid, true)), 'telefone de terceiro recusado';
  assert not exists(select 1 from equipe_minha_loja('42000000-0000-4000-a000-000000000001')), 'equipe privada';
end $$;
set local request.jwt.claim.sub = 'user_gerente420';
do $$ begin
  assert not exists(select 1 from convite_gerente_loja(current_setting('teste.token')::uuid, true)), 'telefone não confirmado recusado';
  assert not exists(select 1 from minhas_lojas()), 'convite pendente não dá acesso';
end $$;

reset role;
set local request.jwt.claim.role = 'service_role';
update perfis set whatsapp_verificado_em = now() where id = 'user_gerente420';
update convites_gerente_loja set expira_em = now() - interval '1 minute'
where token_hash = sha256(convert_to(current_setting('teste.vencido'), 'UTF8'));
select id as convite_ativo from convites_gerente_loja
where token_hash = sha256(convert_to(current_setting('teste.token'), 'UTF8')) \gset

set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = 'user_dono420';
reset role;
select id as convite_cancelado from convites_gerente_loja
where token_hash = sha256(convert_to(current_setting('teste.cancelado'), 'UTF8')) \gset
set local role authenticated;
select revogar_gerente_loja('42000000-0000-4000-a000-000000000001', :'convite_cancelado');

set local request.jwt.claim.sub = 'user_gerente420';
do $$ begin
  assert not exists(select 1 from convite_gerente_loja(current_setting('teste.token')::uuid, true)), 'aceite exige os termos em dia';
end $$;
select aceitar_documentos_legais(array(select id from termos_pendentes()));
do $$ begin
  assert not exists(select 1 from convite_gerente_loja(current_setting('teste.vencido')::uuid, true)), 'convite vencido recusado';
  assert not exists(select 1 from convite_gerente_loja(current_setting('teste.cancelado')::uuid, true)), 'convite cancelado recusado';
  assert exists(select 1 from convite_gerente_loja(current_setting('teste.token')::uuid)), 'convite certo aparece';
  assert not exists(select 1 from minhas_lojas()), 'abrir o link não concede acesso';
  assert exists(select 1 from convite_gerente_loja(current_setting('teste.token')::uuid, true)), 'aceite cria vínculo';
  assert exists(select 1 from convite_gerente_loja(current_setting('teste.token')::uuid, true)), 'aceite repetido é seguro';
  assert (select count(*) = 1 and not bool_or(dono) from minhas_lojas()), 'gerente vê só a loja atribuída';
  assert not exists(select 1 from dados_loja_gerenciada('42000000-0000-4000-a000-000000000002')), 'leitura alheia recusada';
  assert not exists(select 1 from equipe_minha_loja('42000000-0000-4000-a000-000000000001')), 'gerente não vê convites';
end $$;
select pg_temp.recusa($q$select convidar_gerente_loja('42000000-0000-4000-a000-000000000001', '5589999990423')$q$);
select pg_temp.recusa($q$select editar_loja_gerenciada('42000000-0000-4000-a000-000000000001', null,null,null,null,'bloqueiofake420',null,null)$q$);
select pg_temp.recusa($q$select editar_loja_gerenciada('42000000-0000-4000-a000-000000000002', null,null,null,null,null,null,null)$q$);
select pg_temp.recusa($q$select editar_loja_gerenciada('42000000-0000-4000-a000-000000000001', null,null,null,'{"seg":[{"abre":"18:00","fecha":"08:00"}]}',null,null,null)$q$);
select editar_loja_gerenciada('42000000-0000-4000-a000-000000000001', 'Rua de teste', -10.4, -45.2,
  '{"seg":[{"abre":"08:00","fecha":"18:00"}]}', 'Loja fictícia', true, 'Entrega no centro');
do $$ declare n integer; begin
  assert (select sobre = 'Loja fictícia' and faz_entrega from dados_loja_gerenciada('42000000-0000-4000-a000-000000000001')), 'edita informações permitidas';
  -- P5b-2b: o gerente edita a loja direto, mas nome e WhatsApp seguem só do dono (o banco recusa).
  begin
    update vitrines_lojas set whatsapp = '5589999990422' where id = '42000000-0000-4000-a000-000000000001';
    get diagnostics n = row_count;
    assert n = 0, 'alteração direta do contato continua protegida';
  exception when sqlstate '42501' then null; end;
end $$;

set local request.jwt.claim.sub = 'user_dono420';
do $$ begin
  assert (select count(*) = 1 and bool_and(gerente = 'Gerente') from equipe_minha_loja('42000000-0000-4000-a000-000000000001')), 'dono vê gerente ativo';
end $$;
select revogar_gerente_loja('42000000-0000-4000-a000-000000000001', :'convite_ativo');
set local request.jwt.claim.sub = 'user_gerente420';
do $$ begin
  assert not exists(select 1 from minhas_lojas()), 'revogação remove a loja da conta';
  assert not exists(select 1 from convite_gerente_loja(current_setting('teste.token')::uuid, true)), 'convite revogado não reativa acesso';
  assert not exists(select 1 from dados_loja_gerenciada('42000000-0000-4000-a000-000000000001')), 'revogação corta leitura';
end $$;
select pg_temp.recusa($q$select editar_loja_gerenciada('42000000-0000-4000-a000-000000000001', null,null,null,null,null,null,null)$q$);

set local role anon;
set local request.jwt.claim.role = 'anon';
set local request.jwt.claim.sub = '';
select pg_temp.recusa($q$select minhas_lojas()$q$);
select pg_temp.recusa($q$select convite_gerente_loja(current_setting('teste.token')::uuid, true)$q$);
rollback;
