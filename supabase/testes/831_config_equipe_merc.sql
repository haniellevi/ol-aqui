\set ON_ERROR_STOP on
\set QUIET on
-- Configurações (config_publica), equipe (financeiro e moderação) e conversas do Merc só para o dono.
-- Tudo dentro de uma transação que termina em ROLLBACK: não deixa dado para os próximos testes.
begin;
reset role;
set local request.jwt.claim.role='';
set local request.jwt.claim.sub='';

create function pg_temp.confere(ok boolean, caso text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FALHOU: %', caso; end if;
end $$;
create function pg_temp.sem_palavra(comando text, palavra text) returns void language plpgsql as $$
begin
  begin execute comando;
  exception when others then
    if sqlerrm like '%' || palavra || '%' then raise exception 'Mensagem revela a palavra: %', sqlerrm; end if;
    return;
  end;
  raise exception 'Comando aceito indevidamente: %', comando;
end $$;
create function pg_temp.recusa(comando text, codigo text, trecho text default null) returns void language plpgsql as $$
begin
  begin execute comando;
  exception when others then
    if sqlstate = codigo and (trecho is null or sqlerrm like '%' || trecho || '%') then return; end if;
    raise exception 'Estado inesperado: % (%), esperado %: %', sqlstate, sqlerrm, codigo, comando;
  end;
  raise exception 'Comando aceito indevidamente: %', comando;
end $$;

select id as regiao from microrregioes where slug='corrente-pi' \gset
select id as moveis from categorias where slug = 'sofas-e-poltronas' \gset

-- Dados de teste (como dono do banco)
insert into perfis(id, microrregiao_id, nome, cidade) values
  ('user_g2cli',   :'regiao', 'Cliente G2',    'Corrente'),
  ('user_g2dono',  :'regiao', 'Dono G2',       'Corrente'),
  ('user_g2novo',  :'regiao', 'Novo G2',       'Corrente'),
  ('user_g2adm',   :'regiao', 'Admin G2',      'Corrente'),
  ('user_g2fin',   :'regiao', 'Financeiro G2', 'Corrente'),
  ('user_g2mod',   :'regiao', 'Moderador G2',  'Corrente'),
  ('user_g2sus',   :'regiao', 'Dono suspenso G2', 'Corrente'),
  ('user_g2semp',  :'regiao', 'Dono sem pagamento G2', 'Corrente');
update perfis set e_admin = true where id = 'user_g2adm';
-- loja exige WhatsApp confirmado (como no site)
update perfis set whatsapp = '5589999980011', whatsapp_verificado_em = now() where id = 'user_g2cli';
update perfis set whatsapp = '5589999980012', whatsapp_verificado_em = now() where id = 'user_g2novo';
update perfis set whatsapp = '5589999980013', whatsapp_verificado_em = now() where id = 'user_g2dono';
update perfis set whatsapp = '5589999980014', whatsapp_verificado_em = now() where id = 'user_g2sus';
insert into equipe(usuario_id, papel) values ('user_g2fin', 'financeiro'), ('user_g2mod', 'moderador');

insert into vitrines_lojas(dono_id, microrregiao_id, slug, nome, cidade, tipo, plano, plano_expira_em, teste_expira_em, status) values
  ('user_g2dono', :'regiao', 'g2-loja-dono', 'Loja G2', 'Corrente', 'loja', 'teste', now() + interval '10 days', now() + interval '10 days', 'ativa'),
  ('user_g2cli',  :'regiao', 'g2-loja-cli',  'Loja da cliente G2', 'Corrente', 'loja', 'teste', now() + interval '10 days', now() + interval '10 days', 'ativa'),
  ('user_g2sus',  :'regiao', 'g2-loja-sus',  'Loja G2 suspensa', 'Corrente', 'loja', 'teste', now() + interval '10 days', now() + interval '10 days', 'inadimplente'),
  ('user_g2semp', :'regiao', 'g2-loja-semp', 'Loja G2 sem pagamento', 'Corrente', 'loja', 'teste', now() + interval '10 days', now() + interval '10 days', 'inadimplente');
select id as vit from vitrines_lojas where slug = 'g2-loja-dono' \gset
select id as vit_cli from vitrines_lojas where slug = 'g2-loja-cli' \gset
select id as vit_sus from vitrines_lojas where slug = 'g2-loja-sus' \gset
-- anúncio em análise ligado a pagamento (o financeiro vê; sem o pagamento não veria) e dois pagamentos:
-- um da loja no ar, um da loja fora do ar. Loja no ar e anúncio no ar são públicos: não servem de prova.
insert into anuncios(id, vitrine_id, categoria_id, titulo, cidade, preco_centavos, atributos, status) values
  ('83000000-0000-4000-b000-000000000003', :'vit', :'moveis', 'Cadeira G2 paga', 'Corrente', 15000, '{"estado":"novo"}', 'em_analise');
insert into pagamentos(vitrine_id, microrregiao_id, tipo, valor_centavos, anuncio_id, status) values
  (:'vit', :'regiao', 'anuncio_avulso', 15000, '83000000-0000-4000-b000-000000000003', 'pago'),
  (:'vit_sus', :'regiao', 'assinatura', 9900, null, 'pendente');
insert into anuncios(id, vitrine_id, categoria_id, titulo, cidade, preco_centavos, atributos, status, motivo_analise, criado_ip) values
  ('83000000-0000-4000-b000-000000000001', :'vit_cli', :'moveis', 'Sofá G2 em análise', 'Corrente', 40000, '{"estado":"usado"}', 'em_analise', 'Teste G2', '10.0.0.7');
insert into robo_conversas(id, usuario_id, titulo) values ('83000000-0000-4000-d000-000000000001', 'user_g2cli', 'Conversa G2');
insert into robo_mensagens(conversa_id, usuario_id, papel, conteudo, tipo) values
  ('83000000-0000-4000-d000-000000000001', 'user_g2cli', 'usuario', '{"texto":"Dado pessoal G2"}', 'conversa');

-- Configurações de teste: palavra bloqueada, uma chave pública e uma chave só da região que é secreta
update configuracoes set valor = '["segredo_g2"]' where chave = 'moderacao.palavras_bloqueadas' and microrregiao_id is null;
insert into configuracoes(chave, microrregiao_id, valor, publico) values
  ('g2.regiao_privada', null,    '"global publica"', true),
  ('g2.regiao_privada', :'regiao', '"regiao secreta"', false);

\echo '[M-01] cliente logado (authenticated)'
set role authenticated;
select set_config('request.jwt.claim.sub', 'user_g2cli', false), set_config('request.jwt.claim.role', 'authenticated', false) \g /dev/null
-- config_publica: o que o cliente logado recebe.
select pg_temp.confere(config_publica('moderacao.palavras_bloqueadas', null, '[]'::jsonb) = '[]'::jsonb, 'cliente: palavras bloqueadas não aparecem (devolve o padrão)');
select pg_temp.confere(config_publica('loja.plano_teste', null, '"x"'::jsonb) = '"teste"'::jsonb, 'cliente: chave pública continua legível');
select pg_temp.confere(config_publica('g2.regiao_privada', :'regiao', '"padrao"'::jsonb) = '"padrao"'::jsonb, 'cliente: valor só da região (não público) não sai');
select pg_temp.confere(config_publica('g2.regiao_privada', null, '"padrao"'::jsonb) = '"global publica"'::jsonb, 'cliente: valor global público sai');
-- guarda: os gatilhos da loja continuam rodando como usuário logado (senão a regra "not sistema" some)
select pg_temp.confere((select not prosecdef from pg_proc where proname = 'validar_vitrine_completa'), 'gatilho da loja segue como usuário logado');
select pg_temp.confere((select not prosecdef from pg_proc where proname = 'validar_secao_loja'), 'gatilho das seções segue como usuário logado');
select pg_temp.confere((select not prosecdef from pg_proc where proname = 'aki_validar_categoria_loja'), 'gatilho da categoria segue como usuário logado');
-- o dono não tem UPDATE direto na loja (RLS): o texto é barrado na criação, pelo gatilho que roda como usuário logado
select pg_temp.recusa($q$insert into vitrines_lojas(dono_id, microrregiao_id, slug, nome, cidade, tipo, plano, teste_expira_em, status, sobre) values ('user_g2cli', (select id from microrregioes where slug = 'corrente-pi'), 'g2-loja-texto', 'Loja texto', 'Corrente', 'loja', 'teste', now() + interval '5 days', 'ativa', 'texto com segredo_g2')$q$, '23514', 'palavra');
-- a palavra da lista não aparece na mensagem, nem para quem escreve o texto
select pg_temp.sem_palavra($q$insert into vitrines_lojas(dono_id, microrregiao_id, slug, nome, cidade, tipo, plano, teste_expira_em, status, sobre) values ('user_g2cli', (select id from microrregioes where slug = 'corrente-pi'), 'g2-loja-texto2', 'Loja texto', 'Corrente', 'loja', 'teste', now() + interval '5 days', 'ativa', 'texto com segredo_g2')$q$, 'segredo_g2');
select pg_temp.sem_palavra($q$update vitrines_lojas set nome = 'Loja segredo_g2' where slug = 'g2-loja-cli'$q$, 'segredo_g2');
select pg_temp.confere(texto_bloqueado('texto com segredo_g2', null) = 'bloqueado', 'cliente: texto com palavra bloqueada recebe só o sinal');
-- nome de seção da vitrine: palavra da lista é recusada (sem mostrar a palavra); nome limpo passa
select pg_temp.recusa($q$insert into loja_secoes(vitrine_id, nome) values ((select id from vitrines_lojas where slug = 'g2-loja-cli'), 'Ofertas segredo_g2')$q$, '23514', 'palavra');
select pg_temp.sem_palavra($q$insert into loja_secoes(vitrine_id, nome) values ((select id from vitrines_lojas where slug = 'g2-loja-cli'), 'Ofertas segredo_g2')$q$, 'segredo_g2');
reset role;
update vitrines_lojas set plano = 'full' where id = :'vit_cli';   -- seções são do plano Full/Slim
set role authenticated;
insert into loja_secoes(vitrine_id, nome) values (:'vit_cli', 'Ofertas G2');
select pg_temp.confere(exists (select 1 from loja_secoes where vitrine_id = :'vit_cli' and nome = 'Ofertas G2'), 'cliente: seção com nome limpo é criada');
select pg_temp.confere(texto_bloqueado('texto com segredo_g2', null) is distinct from 'segredo_g2', 'cliente: a palavra da lista não sai da função');
select pg_temp.confere(texto_bloqueado('texto limpo de bolo', null) is null, 'cliente: texto limpo passa');
select pg_temp.confere((select count(*) = 1 from vitrines_lojas where id = :'vit_cli'), 'dono continua vendo a própria loja');

\echo '[M-01] cadastro de loja pela regra da política (com plano de teste)'
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', 'user_g2novo', false), set_config('request.jwt.claim.role', 'authenticated', false) \g /dev/null
insert into vitrines_lojas(dono_id, microrregiao_id, slug, nome, cidade, tipo, plano, teste_expira_em, status)
  values ('user_g2novo', :'regiao', 'g2-loja-novo', 'Loja Nova G2', 'Corrente', 'loja', 'teste', now() + interval '5 days', 'ativa');
reset role;
select pg_temp.confere((select plano = 'teste' from vitrines_lojas where slug = 'g2-loja-novo'), 'loja nova nasce com o plano de teste (política e gatilho funcionam)');

\echo '[M-01] visitante (anon) não chama config nem a versão nova'
set role anon;
select pg_temp.recusa($q$select config('loja.plano_teste')$q$, '42501');
select pg_temp.recusa($q$select config_publica('loja.plano_teste', null, '"x"'::jsonb)$q$, '42501');
reset role;

\echo '[M-01] administrador lê tudo pela função nova'
set role authenticated;
select set_config('request.jwt.claim.sub', 'user_g2adm', false), set_config('request.jwt.claim.role', 'authenticated', false) \g /dev/null
select pg_temp.confere(config_publica('moderacao.palavras_bloqueadas', null, '[]'::jsonb) = '["segredo_g2"]'::jsonb, 'admin: lê a lista de palavras');
select pg_temp.confere(config_publica('g2.regiao_privada', :'regiao', '"padrao"'::jsonb) = '"regiao secreta"'::jsonb, 'admin: lê valor da região');

\echo '[M-01] tela de moderação: moderador vê se a análise automática está ligada, sem ler a configuração'
select set_config('request.jwt.claim.sub', 'user_g2mod', false) \g /dev/null
select pg_temp.confere(moderacao_ia_ligada() = false, 'moderador: sinal da análise automática (desligada no teste)');
select set_config('request.jwt.claim.sub', 'user_g2cli', false) \g /dev/null
select pg_temp.confere(moderacao_ia_ligada() = false, 'cliente comum: recebe falso');
reset role;
update configuracoes set valor = 'true' where chave = 'moderacao.ia_ativa' and microrregiao_id is null;
set role authenticated;
select set_config('request.jwt.claim.sub', 'user_g2mod', false) \g /dev/null
select pg_temp.confere(moderacao_ia_ligada() = true, 'moderador: vê ligada quando está ligada');
select set_config('request.jwt.claim.sub', 'user_g2cli', false) \g /dev/null
select pg_temp.confere(moderacao_ia_ligada() = false, 'cliente comum: continua sem o sinal');

\echo '[M-02] financeiro: só o anúncio e a loja que têm pagamento (o que a tela de Pagamentos mostra)'
select set_config('request.jwt.claim.sub', 'user_g2fin', false) \g /dev/null
select pg_temp.confere((select count(*) = 0 from anuncios where id = '83000000-0000-4000-b000-000000000001'), 'financeiro não lê anúncio em análise sem pagamento');
select pg_temp.confere((select count(*) = 1 from anuncios where id = '83000000-0000-4000-b000-000000000003' and titulo = 'Cadeira G2 paga'), 'financeiro lê o título do anúncio ligado a pagamento');
select pg_temp.confere((select count(*) = 0 from vitrines_lojas where slug = 'g2-loja-semp'), 'financeiro não lê loja fora do ar sem pagamento');
select pg_temp.confere((select count(*) = 1 from vitrines_lojas where slug = 'g2-loja-sus' and nome = 'Loja G2 suspensa'), 'financeiro lê o nome da loja fora do ar que tem pagamento');
select pg_temp.confere((select count(*) = 2 from pagamentos p left join vitrines_lojas v on v.id = p.vitrine_id where v.nome is not null), 'financeiro vê o nome da loja nos 2 pagamentos');
select pg_temp.confere((select count(*) = 1 from pagamentos p left join anuncios a on a.id = p.anuncio_id where a.titulo is not null), 'financeiro vê o título do anúncio no pagamento');
select pg_temp.confere((select sum(quantidade) = 2 from admin_resumo_pagamentos_filtrado()), 'financeiro: a tela de pagamentos soma os 2 pagamentos');
select pg_temp.recusa('select criado_ip from anuncios limit 1', '42501');

\echo '[M-02] moderador continua vendo o que a moderação usa'
select set_config('request.jwt.claim.sub', 'user_g2mod', false) \g /dev/null
select pg_temp.confere((select count(*) = 1 from anuncios where id = '83000000-0000-4000-b000-000000000001'), 'moderador lê anúncio em análise');
select pg_temp.confere((select count(*) = 2 from vitrines_lojas where slug in ('g2-loja-sus', 'g2-loja-semp')), 'moderador lê lojas fora do ar (nacional, como antes)');

\echo '[M-03] conversas do Merc: só o dono lê'
select set_config('request.jwt.claim.sub', 'user_g2adm', false) \g /dev/null
select pg_temp.confere((select count(*) = 0 from robo_mensagens where usuario_id = 'user_g2cli'), 'admin não lê mensagens do Merc de outra pessoa');
select pg_temp.confere((select count(*) = 0 from robo_conversas where usuario_id = 'user_g2cli'), 'admin não lê conversas do Merc de outra pessoa');
select set_config('request.jwt.claim.sub', 'user_g2mod', false) \g /dev/null
select pg_temp.confere((select count(*) = 0 from robo_mensagens where usuario_id = 'user_g2cli'), 'moderador não lê mensagens do Merc');
select set_config('request.jwt.claim.sub', 'user_g2cli', false) \g /dev/null
select pg_temp.confere((select count(*) = 1 from robo_mensagens where usuario_id = 'user_g2cli'), 'dono lê as próprias mensagens do Merc');
select pg_temp.confere((select count(*) = 1 from robo_conversas where usuario_id = 'user_g2cli'), 'dono lê as próprias conversas do Merc');

reset role;
rollback;
\echo 'OK: lote banco grupo 2 (config, equipe, Merc)'
