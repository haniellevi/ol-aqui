\set ON_ERROR_STOP on
\set QUIET on
-- Troca de ID do Clerk: admin_trocar_id_usuario leva perfil, loja, anúncio, tabelas sem chave
-- estrangeira, histórico em jsonb, fotos e Storage para o ID novo; desfaz com os IDs invertidos;
-- nega anon/authenticated; recusa ID novo que já existe; religa os gatilhos; não mexe em ID parecido.
begin;

create function pg_temp.confere(ok boolean, caso text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FALHOU: %', caso; end if;
end $$;

-- Quantas linhas ainda citam o ID inteiro em qualquer coluna de texto, array ou jsonb de public.
-- (o registro da própria troca, acao = 'troca_id_clerk', guarda os dois IDs de propósito)
create function pg_temp.sobras(p_id text) returns jsonb language plpgsql as $$
declare c record; n bigint; r jsonb := '{}'::jsonb;
begin
  for c in
    select table_name, column_name from information_schema.columns
     where table_schema = 'public' and data_type in ('text', 'character varying', 'jsonb', 'ARRAY', 'USER-DEFINED')
       and table_name in (select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE')
  loop
    execute format('select count(*) from public.%I where %I::text ~ $1%s', c.table_name, c.column_name,
                   case when c.table_name = 'admin_gestao_eventos' then ' and acao <> ''troca_id_clerk''' else '' end)
      into n using '(?<![A-Za-z0-9_])' || p_id || '(?![A-Za-z0-9])';
    if n > 0 then r := r || jsonb_build_object(c.table_name || '.' || c.column_name, n); end if;
  end loop;
  return r;
end $$;

select id as regiao from microrregioes where slug = 'corrente-pi' \gset
select id as cat from categorias where slug = 'casas' \gset

-- Storage mínimo (a simulação não tem o schema storage)
create schema storage;
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text not null, name text not null, owner_id text, unique (bucket_id, name));

insert into perfis(id, microrregiao_id, nome, whatsapp, whatsapp_verificado_em, tipo_pessoa, avatar_url) values
  ('user_antigoteste',       :'regiao', 'Dono antigo 780',  '5589999780001', now(), 'pj',
     'https://x.supabase.co/storage/v1/object/public/anuncios/user_antigoteste/avatar.webp'),
  ('user_antigotesteoutro',  :'regiao', 'Parecido 780',     '5589999780002', now(), 'pj', null),
  ('user_adm780',            :'regiao', 'Admin 780',        '5589999780003', now(), 'pf', null);

insert into vitrines_lojas(dono_id, microrregiao_id, slug, nome, cidade, tipo, plano, status, teste_expira_em) values
  ('user_antigoteste',      :'regiao', 'q780-loja',  'Loja 780',   'Corrente', 'loja', 'teste', 'ativa', now() + interval '10 days'),
  ('user_antigotesteoutro', :'regiao', 'q780-outra', 'Outra 780',  'Corrente', 'loja', 'teste', 'ativa', now() + interval '10 days');
select id as loja from vitrines_lojas where slug = 'q780-loja' \gset
select id as loja_outra from vitrines_lojas where slug = 'q780-outra' \gset

update vitrines_lojas set logo_url = 'https://x.supabase.co/storage/v1/object/public/anuncios/user_antigoteste/loja/logo.webp' where id = :'loja';

insert into anuncios(id, vitrine_id, categoria_id, titulo, cidade, preco_centavos, atributos, fotos, status) values
  ('78000000-0000-4000-a000-000000000001', :'loja', :'cat', 'Casa 780', 'Corrente', 100000, '{"finalidade":"Venda"}',
   array['https://x.supabase.co/storage/v1/object/public/anuncios/user_antigoteste/78000000-0000-4000-a000-000000000001/1.webp',
         'https://x.supabase.co/storage/v1/object/public/anuncios/user_antigoteste/78000000-0000-4000-a000-000000000001/2.webp'],
   'rascunho'),
  ('78000000-0000-4000-a000-000000000002', :'loja_outra', :'cat', 'Casa do parecido 780', 'Corrente', 100000, '{"finalidade":"Venda"}',
   array['https://x.supabase.co/storage/v1/object/public/anuncios/user_antigotesteoutro/78000000-0000-4000-a000-000000000002/1.webp'],
   'rascunho');

-- Chave estrangeira ON DELETE SET NULL, cascata e um documento legal que não pode mudar
update configuracoes set atualizado_por = 'user_antigoteste' where chave = (select min(chave) from configuracoes);
insert into notificacoes(usuario_id, tipo, titulo, texto) values ('user_antigoteste', 'teste', 'Aviso 780', 'Texto 780');
insert into documentos_legais(tipo, versao, titulo, conteudo, ativo, publicado_por)
  values ('termos', 78001, 'Termos 780', repeat('texto ', 20), false, 'user_antigoteste');

-- Colunas sem chave estrangeira
insert into equipe(usuario_id, papel, adicionado_por, desativado_por) values ('user_antigoteste', 'suporte', 'user_antigoteste', 'user_antigotesteoutro');
insert into compliance_acessos(admin_id, tipo, motivo, alvo_usuario) values ('user_antigoteste', 'entrar', 'Teste 780', 'user_antigoteste');
insert into admin_gestao_eventos(tipo, alvo, autor, acao, motivo, detalhes) values
  ('usuario', 'user_antigoteste', 'user_antigoteste', 'editar', 'Teste 780', '{"campos":{"nota":"user_antigoteste"},"lista":["user_antigoteste","user_antigotesteoutro"]}'),
  ('usuario', 'user_antigotesteoutro', 'user_adm780', 'editar', 'Teste 780 outro', '{"campos":{"nota":"user_antigotesteoutro"}}');
insert into logs_atividade(tabela, registro_id, acao, usuario_id, dados_antes, dados_depois) values
  ('perfis', 'user_antigoteste', 'UPDATE', 'user_antigoteste', '{"id":"user_antigoteste","quem":"user_antigoteste"}', '{"id":"user_antigoteste"}'),
  ('perfis', 'user_antigotesteoutro', 'UPDATE', 'user_antigotesteoutro', '{"id":"user_antigotesteoutro"}', null);
insert into lixeira_lojas(vitrine_id, apagar_apos, origem, autor, status_anterior) values (:'loja_outra', now() + interval '30 days', 'admin', 'user_antigoteste', 'ativa');
insert into radar_cortesias(vitrine_id, ate, motivo, criado_por) values (:'loja', now() + interval '30 days', 'Teste 780', 'user_antigoteste');
insert into hoje_feitas(tipo, alvo_id) values ('teste', 'user_antigoteste');
insert into limpeza_arquivos(pasta) values ('user_antigoteste');
insert into perfis_verificacoes(perfil_id, tipo, arquivo_path) values ('user_antigoteste', 'documento', 'user_antigoteste/doc.jpg');
insert into storage.objects(bucket_id, name, owner_id) values
  ('anuncios', 'user_antigoteste/loja/logo.webp', 'user_antigoteste'),
  ('anuncios', 'user_antigoteste/78000000-0000-4000-a000-000000000001/1.webp', null),
  ('verificacoes', 'user_antigoteste/doc.jpg', null),
  ('anuncios', 'user_antigotesteoutro/78000000-0000-4000-a000-000000000002/1.webp', null),
  ('outro', 'user_antigoteste/fica.webp', null);
insert into contas_revogadas(usuario_id) values ('user_antigoteste');

select pg_temp.confere((select count(*) = 0 from pg_trigger where not tgisinternal and tgenabled <> 'O'), 'antes: todos os gatilhos ligados');
select pg_temp.confere(exists (select 1 from whatsapp_vinculos where numero = '5589999780001' and dono_id = 'user_antigoteste'), 'antes: vínculo do WhatsApp no ID antigo');

-- Permissões: só service_role executa
select pg_temp.confere(not has_function_privilege('anon', 'public.admin_trocar_id_usuario(text,text,boolean)', 'execute'), 'anon não executa');
select pg_temp.confere(not has_function_privilege('authenticated', 'public.admin_trocar_id_usuario(text,text,boolean)', 'execute'), 'authenticated não executa');
select pg_temp.confere(has_function_privilege('service_role', 'public.admin_trocar_id_usuario(text,text,boolean)', 'execute'), 'service_role executa');
set local role authenticated;
do $$ begin
  begin perform public.admin_trocar_id_usuario('user_antigoteste', 'user_novoteste'); raise exception 'authenticated conseguiu';
  exception when insufficient_privilege then null; end;
end $$;
set local role anon;
do $$ begin
  begin perform public.admin_trocar_id_usuario('user_antigoteste', 'user_novoteste'); raise exception 'anon conseguiu';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- Erros de entrada
do $$ begin
  begin perform public.admin_trocar_id_usuario('user_antigoteste', 'novo-invalido'); raise exception 'aceitou ID inválido';
  exception when sqlstate '22023' then null; end;
  begin perform public.admin_trocar_id_usuario('user_antigoteste', 'user_antigoteste'); raise exception 'aceitou IDs iguais';
  exception when sqlstate '22023' then null; end;
  begin perform public.admin_trocar_id_usuario('user_naoexiste780', 'user_novoteste'); raise exception 'aceitou antigo inexistente';
  exception when sqlstate 'P0002' then null; end;
  begin perform public.admin_trocar_id_usuario('user_antigoteste', 'user_adm780'); raise exception 'aceitou novo que já existe';
  exception when sqlstate '23505' then null; end;
end $$;
select pg_temp.confere(exists (select 1 from perfis where id = 'user_antigoteste') and not exists (select 1 from perfis where id = 'user_novoteste'),
  'erros não mudam nada');

-- A troca (como service_role, que é quem vai chamar de verdade)
set local role service_role;
select public.admin_trocar_id_usuario('user_antigoteste', 'user_novoteste', true) as resumo \gset
reset role;

select pg_temp.confere((:'resumo'::jsonb)->>'perfis.id' = '1', 'resumo conta o perfil');
select pg_temp.confere((:'resumo'::jsonb) ? 'vitrines_lojas.dono_id' and (:'resumo'::jsonb) ? 'notificacoes.usuario_id'
  and (:'resumo'::jsonb) ? 'equipe.adicionado_por' and (:'resumo'::jsonb) ? 'storage.objects.name', 'resumo traz as tabelas');

select pg_temp.confere(not exists (select 1 from perfis where id = 'user_antigoteste') and exists (select 1 from perfis where id = 'user_novoteste'), 'perfil trocou de ID');
select pg_temp.confere(exists (select 1 from perfis where id = 'user_antigotesteoutro'), 'ID parecido ficou como estava');
select pg_temp.confere((select dono_id = 'user_novoteste' from vitrines_lojas where id = :'loja'), 'loja é do ID novo');
select pg_temp.confere((select logo_url like '%/anuncios/user_novoteste/loja/logo.webp' from vitrines_lojas where id = :'loja'), 'logo da loja aponta para a pasta nova');
select pg_temp.confere((select fotos[1] like '%/anuncios/user_novoteste/78000000%/1.webp' and fotos[2] like '%/anuncios/user_novoteste/78000000%/2.webp' and cardinality(fotos) = 2
    from anuncios where id = '78000000-0000-4000-a000-000000000001'), 'fotos do anúncio na pasta nova, na mesma ordem');
select pg_temp.confere((select fotos[1] like '%/anuncios/user_antigotesteoutro/%' from anuncios where id = '78000000-0000-4000-a000-000000000002'), 'foto do parecido não mudou');
select pg_temp.confere((select avatar_url like '%/anuncios/user_novoteste/avatar.webp' from perfis where id = 'user_novoteste'), 'avatar na pasta nova');
select pg_temp.confere((select atualizado_por = 'user_novoteste' from configuracoes where chave = (select min(chave) from configuracoes)), 'chave estrangeira com SET NULL também foi trocada');
select pg_temp.confere((select count(*) = 1 from notificacoes where usuario_id = 'user_novoteste' and tipo = 'teste'), 'aviso foi junto');
select pg_temp.confere((select publicado_por = 'user_novoteste' from documentos_legais where versao = 78001), 'documento legal trocado apesar do gatilho que o protege');
select pg_temp.confere((select usuario_id = 'user_novoteste' and adicionado_por = 'user_novoteste' and desativado_por = 'user_antigotesteoutro' from equipe where papel = 'suporte' and usuario_id like 'user_novoteste'), 'equipe');
select pg_temp.confere((select admin_id = 'user_novoteste' and alvo_usuario = 'user_novoteste' from compliance_acessos where motivo = 'Teste 780'), 'compliance (registro imutável) trocado');
select pg_temp.confere((select autor = 'user_novoteste' and alvo = 'user_novoteste' and detalhes = '{"campos":{"nota":"user_novoteste"},"lista":["user_novoteste","user_antigotesteoutro"]}'::jsonb
    from admin_gestao_eventos where motivo = 'Teste 780'), 'evento do painel: autor, alvo e jsonb, sem mexer no ID parecido');
select pg_temp.confere((select alvo = 'user_antigotesteoutro' and detalhes = '{"campos":{"nota":"user_antigotesteoutro"}}'::jsonb from admin_gestao_eventos where motivo = 'Teste 780 outro'), 'evento do parecido intacto');
select pg_temp.confere((select usuario_id = 'user_novoteste' and registro_id = 'user_novoteste' and dados_antes = '{"id":"user_novoteste","quem":"user_novoteste"}'::jsonb and dados_depois = '{"id":"user_novoteste"}'::jsonb
    from logs_atividade where acao = 'UPDATE' and registro_id = 'user_novoteste' and tabela = 'perfis'), 'registro de atividade');
select pg_temp.confere((select usuario_id = 'user_antigotesteoutro' and dados_antes = '{"id":"user_antigotesteoutro"}'::jsonb from logs_atividade where acao = 'UPDATE' and registro_id = 'user_antigotesteoutro'), 'registro do parecido intacto');
select pg_temp.confere((select autor = 'user_novoteste' from lixeira_lojas where vitrine_id = :'loja_outra'), 'lixeira de loja');
select pg_temp.confere((select criado_por = 'user_novoteste' from radar_cortesias where vitrine_id = :'loja'), 'cortesia do Radar');
select pg_temp.confere((select alvo_id = 'user_novoteste' from hoje_feitas where tipo = 'teste'), 'tarefa feita do dia');
select pg_temp.confere((select pasta = 'user_novoteste' from limpeza_arquivos where pasta is not null), 'fila de limpeza');
select pg_temp.confere((select arquivo_path = 'user_novoteste/doc.jpg' from perfis_verificacoes where perfil_id = 'user_novoteste'), 'caminho do arquivo de verificação');
select pg_temp.confere(exists (select 1 from contas_revogadas where usuario_id = 'user_novoteste') and not exists (select 1 from contas_revogadas where usuario_id = 'user_antigoteste'), 'conta revogada');
select pg_temp.confere(exists (select 1 from whatsapp_vinculos where numero = '5589999780001' and dono_id = 'user_novoteste' and no_perfil)
  and not exists (select 1 from whatsapp_vinculos where dono_id = 'user_antigoteste'), 'vínculo do WhatsApp foi junto');
select pg_temp.confere((select array_agg(bucket_id || ':' || name order by bucket_id, name) = array[
    'anuncios:user_antigotesteoutro/78000000-0000-4000-a000-000000000002/1.webp',
    'anuncios:user_novoteste/78000000-0000-4000-a000-000000000001/1.webp',
    'anuncios:user_novoteste/loja/logo.webp',
    'outro:user_antigoteste/fica.webp',
    'verificacoes:user_novoteste/doc.jpg'] from storage.objects), 'Storage: pastas dos buckets anuncios e verificacoes mudaram, o resto não');
select pg_temp.confere((select owner_id = 'user_novoteste' from storage.objects where name = 'user_novoteste/loja/logo.webp'), 'dono do objeto');

select pg_temp.confere(pg_temp.sobras('user_antigoteste') = '{}'::jsonb, 'nada sobrou com o ID antigo: ' || pg_temp.sobras('user_antigoteste')::text);
select pg_temp.confere(exists (select 1 from admin_gestao_eventos where acao = 'troca_id_clerk' and alvo = 'user_novoteste'
    and detalhes->>'id_antigo' = 'user_antigoteste' and detalhes->>'id_novo' = 'user_novoteste'), 'registro da troca gravado com os dois IDs');
select pg_temp.confere((select count(*) = 0 from pg_trigger where not tgisinternal and tgenabled <> 'O'), 'depois: todos os gatilhos ligados de novo');
select pg_temp.confere((select count(*) = 0 from pg_constraint where contype = 'f' and confrelid = 'public.perfis'::regclass and confupdtype <> 'c'), 'toda FK para perfis tem ON UPDATE CASCADE');
select pg_temp.confere((select confdeltype = 'n' from pg_constraint where conname = 'configuracoes_atualizado_por_fkey')
  and (select confdeltype = 'c' from pg_constraint where conname = 'vitrines_lojas_dono_id_fkey'), 'ON DELETE continua igual');

-- Gatilhos de volta de verdade: o documento legal publicado volta a ser protegido
do $$ begin
  begin update documentos_legais set titulo = 'Mudou' where versao = 78001; raise exception 'documento legal ficou mutável';
  exception when sqlstate '42501' then null; end;
  begin update compliance_acessos set motivo = 'Mudou' where motivo = 'Teste 780'; raise exception 'compliance ficou mutável';
  exception when sqlstate '42501' then null; end;
end $$;

-- Desfazer: IDs invertidos
set local role service_role;
select public.admin_trocar_id_usuario('user_novoteste', 'user_antigoteste', true) as resumo2 \gset
reset role;
select pg_temp.confere((:'resumo2'::jsonb)->>'perfis.id' = '1', 'desfazer devolve o resumo');
select pg_temp.confere(exists (select 1 from perfis where id = 'user_antigoteste') and not exists (select 1 from perfis where id = 'user_novoteste'), 'desfazer: perfil voltou');
select pg_temp.confere((select dono_id = 'user_antigoteste' and logo_url like '%/anuncios/user_antigoteste/loja/logo.webp' from vitrines_lojas where id = :'loja'), 'desfazer: loja e logo');
select pg_temp.confere((select fotos[2] like '%/anuncios/user_antigoteste/78000000%/2.webp' from anuncios where id = '78000000-0000-4000-a000-000000000001'), 'desfazer: fotos');
select pg_temp.confere((select dados_antes = '{"id":"user_antigoteste","quem":"user_antigoteste"}'::jsonb from logs_atividade where acao = 'UPDATE' and tabela = 'perfis' and registro_id = 'user_antigoteste'), 'desfazer: jsonb de histórico');
select pg_temp.confere((select count(*) = 4 from storage.objects where name like 'user\_antigoteste/%'), 'desfazer: Storage');
select pg_temp.confere(pg_temp.sobras('user_novoteste') = '{}'::jsonb, 'desfazer: nada sobrou com o ID novo: ' || pg_temp.sobras('user_novoteste')::text);
select pg_temp.confere((select count(*) = 2 from admin_gestao_eventos where acao = 'troca_id_clerk'), 'as duas trocas ficam registradas');
select pg_temp.confere(exists (select 1 from admin_gestao_eventos where acao = 'troca_id_clerk' and alvo = 'user_novoteste' and detalhes->>'id_antigo' = 'user_antigoteste'),
  'o registro da primeira troca não foi reescrito pelo desfazer');
select pg_temp.confere((select count(*) = 0 from pg_trigger where not tgisinternal and tgenabled <> 'O'), 'desfazer: gatilhos ligados');

-- Ensaio com o padrão (p_mover_arquivos = false): arquivos e endereços de foto ficam como estão
set local role service_role;
select public.admin_trocar_id_usuario('user_antigoteste', 'user_ensaio780') \gset
reset role;
select pg_temp.confere((select count(*) = 4 from storage.objects where name like 'user\_antigoteste/%'), 'padrão não mexe no Storage');
select pg_temp.confere((select dono_id = 'user_ensaio780' from vitrines_lojas where id = :'loja'), 'padrão troca o resto');
select pg_temp.confere((select logo_url like '%/anuncios/user_antigoteste/%' from vitrines_lojas where id = :'loja'), 'padrão mantém o endereço do logo');
select pg_temp.confere((select bool_and(x like '%/anuncios/user_antigoteste/%') from anuncios a, unnest(a.fotos) x where a.id = '78000000-0000-4000-a000-000000000001'), 'padrão mantém os endereços das fotos do anúncio');

-- Falha no meio desfaz tudo (ID novo colide com objeto do Storage já existente)
insert into storage.objects(bucket_id, name) values ('anuncios', 'user_colide780/loja/logo.webp');
update storage.objects set name = 'user_ensaio780/loja/logo.webp' where name = 'user_antigoteste/loja/logo.webp';
do $$ begin
  begin perform public.admin_trocar_id_usuario('user_ensaio780', 'user_colide780', true);
  exception when unique_violation then null; end;
end $$;
select pg_temp.confere(exists (select 1 from perfis where id = 'user_ensaio780') and not exists (select 1 from perfis where id = 'user_colide780'), 'erro no meio: perfil continua com o ID de antes');
select pg_temp.confere((select dono_id = 'user_ensaio780' from vitrines_lojas where id = :'loja'), 'erro no meio: loja continua no ID de antes');
select pg_temp.confere((select count(*) = 0 from pg_trigger where not tgisinternal and tgenabled <> 'O'), 'erro no meio: gatilhos continuam ligados');

rollback;
