-- Apenas no banco descartável criado por cron_origem.py. Valores sintéticos.
create schema vault;
create table vault.decrypted_secrets(name text primary key, decrypted_secret text);
insert into vault.decrypted_secrets values
 ('olaki_loja_ia_endpoint','https://cron.example.test/api/interno/loja-ia'),
 ('olaki_moderacao_ia_token',repeat('m',32)), ('olaki_limpeza_token',repeat('l',32));
create table public.cron_capturas(id bigint generated always as identity, url text, headers jsonb, body jsonb, timeout_ms integer);
-- Substitui a implementação, nunca enfileira no pg_net e nunca faz HTTP.
create or replace function net.http_post(url text, body jsonb default '{}'::jsonb,
 params jsonb default '{}'::jsonb, headers jsonb default '{"Content-Type":"application/json"}'::jsonb,
 timeout_milliseconds integer default 5000) returns bigint language plpgsql as $$
declare pedido bigint;
begin
 if current_setting('cron.teste_falha',true) = 'sim' then
   raise exception 'Falha sintética de transporte';
 end if;
 insert into public.cron_capturas(url,headers,body,timeout_ms)
 values(url,headers,body,timeout_milliseconds) returning id into pedido;
 return pedido;
end $$;

create table public.cron_esperados(nome text, caminho text, timeout_ms integer, token text, servico boolean);
insert into public.cron_esperados values
 ('categorizacao_ia_disparar','categorizacao',60000,'olaki_moderacao_ia_token',true),
 ('limpeza_disparar','limpeza',60000,'olaki_limpeza_token',true),
 ('moderacao_ia_disparar','moderacao',60000,'olaki_moderacao_ia_token',true),
 ('radar_ia_novidades_disparar','radar-novidades',60000,'olaki_moderacao_ia_token',true),
 ('verificacao_loja_disparar','verificacao-loja',120000,'olaki_moderacao_ia_token',true),
 ('verificacao_loja_reconferir_disparar','verificacao-loja-reconferir',300000,'olaki_moderacao_ia_token',true),
 ('whatsapp_fila_disparar','whatsapp-fila',60000,'olaki_moderacao_ia_token',false);
create table public.cron_funcoes_antes as
 select p.oid, p.proname, p.proacl, p.proowner, p.prosecdef, p.proconfig, pg_get_functiondef(p.oid) definicao
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in (select nome from cron_esperados);
create table public.cron_agenda_antes as select * from cron.job;
create table public.cron_politicas_antes as select * from pg_policies;
do $$ begin
 assert (select count(*)=7 from cron_funcoes_antes where definicao like '%https://ol-aqui.vercel.app/api/interno/%');
 assert current_setting('cron.launch_active_jobs') = 'off';
 assert (select count(*)=7 from cron.job where command in (select 'select public.'||nome||'()' from cron_esperados));
end $$;

-- Trabalho elegível sem depender do estado dos exemplos semeados pelas migrações.
set session_replication_role=replica;
insert into public.perfis(id,microrregiao_id,nome,cidade)
 select 'user_cron320',id,'Fixture cron','Corrente' from microrregioes where slug='corrente-pi';
insert into public.vitrines_lojas(id,dono_id,microrregiao_id,slug,nome,cidade,tipo,cnpj,selo_loja_verificada,cnpj_conferido_em)
 select 'c0000000-0000-4000-a000-000000000001',id,microrregiao_id,'fixture-cron','Fixture cron','Corrente','loja','00000000000000',true,null
 from perfis where id='user_cron320';
insert into verificacoes_loja(vitrine_id,perfil_id,cnpj,identidade,revisao_loja,comprovante,tipo_comprovante)
 values('c0000000-0000-4000-a000-000000000001','user_cron320','00000000000000','fixture',1,'\x01','application/pdf');
insert into whatsapp_fila(usuario_id,numero,texto) values('user_cron320','5589999990320','Mensagem sintética');
insert into moderacao_ia(revisao,estado,iniciado_em) values('fixture','processando',now()-interval '1 hour');
insert into categorizacao_ia(anuncios,criado_em) values('{}',now()-interval '1 hour');
update configuracoes set valor='true' where microrregiao_id is null and chave in
 ('vitrine_ia.categorizacao_ativa','moderacao.ia_ativa','radar_ia.ativa','radar_ia.novidades_ativa','verificacao.reconferencia_ativa');
set session_replication_role=origin;
