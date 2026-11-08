\set ON_ERROR_STOP 0
\set QUIET on
\pset footer off
-- Painel: Regiões e cidades (tela 7) e Categorias e campos (tela 9) · migração 20261108040000.
-- Cada bloco [n] diz o que deve acontecer. "ERRO esperado" = a linha ERROR logo abaixo é o certo.

-- Preparação (como o sistema)
reset role; select set_config('request.jwt.claim.role','',false), set_config('request.jwt.claim.sub','',false), set_config('request.headers','',false) \g /dev/null
select id as reg from microrregioes where slug='corrente-pi' \gset
insert into perfis (id,microrregiao_id,nome,whatsapp,cidade,tipo_pessoa) values
 ('user_adm96',:'reg','Admin Noventa e Seis','5589999996001','Corrente','pf'),
 ('user_pf96',:'reg','Paula Vendedora','5589999996002','Corrente','pf'),
 ('user_ou96',:'reg','Otavio Comum','5589999996003','Gilbués','pf');
update perfis set e_admin=true where id='user_adm96';
update perfis set whatsapp_verificado_em=now() where id='user_pf96';
update configuracoes set valor='"https://abc.supabase.co"' where chave='fotos.origem' and microrregiao_id is null;
update configuracoes set valor='1' where chave='anuncio.fotos_minimo' and microrregiao_id is null;
\set foto '{https://abc.supabase.co/storage/v1/object/public/anuncios/user_pf96/x/1.webp}'
select id as cat_moveis from categorias where slug='moveis' \gset
select id as cat_casa from categorias where slug='casa-e-moveis' \gset
select id as cat_pedreiro from categorias where slug='pedreiro' \gset
-- Paula vende (pessoa física) e tem um anúncio no ar em Corrente, categoria Móveis
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_pf96',false) \g /dev/null
select tipo from quero_vender('pf', null, null, null, 'Corrente') \g /dev/null
select id as vit_pf from vitrines_lojas where dono_id='user_pf96' \gset
insert into anuncios (vitrine_id, categoria_id, titulo, cidade, preco_centavos, atributos, fotos) values
 (:'vit_pf', :'cat_moveis', 'Guarda-roupa 6 portas noventa e seis', 'Corrente', 80000, '{"estado":"Usado"}', :'foto')
returning id as anu_moveis \gset

-- =========================== Regiões e cidades ===========================

\echo '[1] admin cria uma regiao nova com a sede na Bahia (regiao + cidade juntas); fica no historico'
select set_config('request.jwt.claim.sub','user_adm96',false) \g /dev/null
select admin_criar_regiao('  Oeste   Baiano  ', 'oeste-baiano-96', ' Barreiras ', 'ba') as reg_nova \gset
reset role;
select slug, nome, cidade_sede from microrregioes where id=:'reg_nova';
select nome, uf, ativa from cidades where microrregiao_id=:'reg_nova';
select count(*) filter (where tabela='microrregioes') as log_regiao, count(*) filter (where tabela='cidades') as log_cidade
  from logs_atividade where usuario_id='user_adm96';

\echo '[1b] mesmo endereco interno de novo: ERRO esperado (ja existe)'
set role authenticated; select set_config('request.jwt.claim.sub','user_adm96',false) \g /dev/null
select admin_criar_regiao('Oeste Baiano', 'oeste-baiano-96', 'Luís Eduardo Magalhães', 'BA');
\echo '[1c] sem sede: ERRO esperado'
select admin_criar_regiao('Sem Sede', 'sem-sede-96', ' ', 'BA');

\echo '[2] usuario comum nao cria regiao nem le o painel (2 ERROS esperados: so a equipe); visitante nem chama (ERRO esperado: permission denied)'
select set_config('request.jwt.claim.sub','user_ou96',false) \g /dev/null
select admin_criar_regiao('Golpe', 'golpe-96', 'Golpelandia', 'PI');
select * from admin_regioes();
set role anon; select set_config('request.jwt.claim.role','anon',false), set_config('request.jwt.claim.sub','',false) \g /dev/null
select admin_criar_regiao('Golpe', 'golpe-96', 'Golpelandia', 'PI');

\echo '[3] admin adiciona cidade do Piaui na regiao baiana (regiao mistura estados): ok; UF errada e nome curto: 2 ERROS esperados'
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_adm96',false) \g /dev/null
insert into cidades (microrregiao_id, nome, uf) values (:'reg_nova', 'Santa  Filomena do Teste', 'pi') returning nome, uf;
insert into cidades (microrregiao_id, nome, uf) values (:'reg_nova', 'Cidade Errada', 'XX');
insert into cidades (microrregiao_id, nome, uf) values (:'reg_nova', 'A', 'BA');

\echo '[4] a mesma cidade em duas regioes: ERRO esperado ("Corrente-PI ja esta na regiao ..."), mesmo sem acento/maiuscula'
insert into cidades (microrregiao_id, nome, uf) values (:'reg_nova', 'CORRENTE', 'PI');

\echo '[5] usuario comum nao mexe em cidades: insert (ERRO esperado de RLS), update e delete nao afetam nada (0 linhas)'
select set_config('request.jwt.claim.sub','user_ou96',false) \g /dev/null
insert into cidades (microrregiao_id, nome, uf) values (:'reg', 'Cidade Pirata', 'PI');
with x as (update cidades set ativa=false where nome='Gilbués' returning 1) select count(*) as atualizou from x;
with x as (delete from cidades where nome='Riacho Frio' returning 1) select count(*) as apagou from x;
\echo '[5b] visitante: insert recusado (ERRO esperado: permission denied)'
set role anon; select set_config('request.jwt.claim.role','anon',false), set_config('request.jwt.claim.sub','',false) \g /dev/null
insert into cidades (microrregiao_id, nome, uf) values (:'reg', 'Cidade Pirata', 'PI');

\echo '[6] trocar a sede para outra cidade ativa da regiao: ok (grava o nome certo); cidade de fora: ERRO esperado; mudar o slug: ERRO esperado'
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_adm96',false) \g /dev/null
update microrregioes set cidade_sede='santa filomena do teste' where id=:'reg_nova' returning cidade_sede;
update microrregioes set cidade_sede='Corrente' where id=:'reg_nova';
update microrregioes set slug='outro-slug-96' where id=:'reg_nova';
\echo '[6b] renomear a regiao: ok; nome vazio: ERRO esperado'
update microrregioes set nome='Oeste da Bahia e Piauí' where id=:'reg_nova' returning nome;
update microrregioes set nome=' ' where id=:'reg_nova';

\echo '[7] desativar a sede: ERRO esperado; desativar outra cidade: ok e ela some da lista do visitante'
update cidades set ativa=false where microrregiao_id=:'reg_nova' and nome='Santa Filomena do Teste';
update cidades set ativa=false where microrregiao_id=:'reg_nova' and nome='Barreiras' returning nome, ativa;
set role anon; select set_config('request.jwt.claim.role','anon',false), set_config('request.jwt.claim.sub','',false) \g /dev/null
select string_agg(nome, ', ' order by nome) as cidades_visiveis from cidades where microrregiao_id=:'reg_nova' and ativa;
\echo '[7b] a sede nova nao pode ser uma cidade inativa: ERRO esperado'
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_adm96',false) \g /dev/null
update microrregioes set cidade_sede='Barreiras' where id=:'reg_nova';

\echo '[8] Corrente tem anuncio, vendedor e pessoas: remover e renomear dao ERRO esperado (2 ERROS, mensagem diz o que tem); desativar e ativar de novo funcionam'
update microrregioes set cidade_sede='Corrente' where id=:'reg';
insert into cidades (microrregiao_id, nome, uf) values (:'reg', 'Lugarejo Noventa e Seis', 'PI');
update microrregioes set cidade_sede='Lugarejo Noventa e Seis' where id=:'reg' returning cidade_sede;
delete from cidades where microrregiao_id=:'reg' and nome='Corrente';
update cidades set nome='Corrente Nova' where microrregiao_id=:'reg' and nome='Corrente';
update cidades set ativa=false where microrregiao_id=:'reg' and nome='Corrente' returning nome, ativa;
update cidades set ativa=true where microrregiao_id=:'reg' and nome='Corrente' returning nome, ativa;
update microrregioes set cidade_sede='Corrente' where id=:'reg' returning cidade_sede;
\echo '[8b] o anuncio de Corrente continua no ar com a cidade dele'
select status, cidade from anuncios where id=:'anu_moveis';
\echo '[8c] cidade sem uso: renomear e remover funcionam (o DELETE fica no historico)'
update cidades set nome='Lugarejo 96' where microrregiao_id=:'reg' and nome='Lugarejo Noventa e Seis' returning nome;
delete from cidades where microrregiao_id=:'reg' and nome='Lugarejo 96' returning nome;
reset role;
select acao, dados_antes->>'nome' as nome from logs_atividade where tabela='cidades' and acao='DELETE' and usuario_id='user_adm96';
\echo '[8d] cidade nao muda de regiao: ERRO esperado'
set role authenticated; select set_config('request.jwt.claim.sub','user_adm96',false) \g /dev/null
update cidades set microrregiao_id=:'reg_nova' where microrregiao_id=:'reg' and nome='Riacho Frio';

\echo '[9] apagar a regiao-piloto (tem pessoas, vendedor, anuncio): ERRO esperado com a lista; apagar uma regiao vazia leva as cidades junto'
delete from microrregioes where id=:'reg';
select admin_criar_regiao('Vazia 96', 'vazia-96', 'Ermo', 'TO') as reg_vazia \gset
insert into cidades (microrregiao_id, nome, uf) values (:'reg_vazia', 'Ermo de Baixo', 'TO');
delete from microrregioes where id=:'reg_vazia' returning slug;
select count(*) as cidades_que_sobraram from cidades where microrregiao_id=:'reg_vazia';

\echo '[10] painel: admin_regioes mostra sede e contagens; admin_cidades mostra o uso de cada cidade'
select slug, cidade_sede, cidades_ativas > 10 as muitas_cidades, vendedores_pf >= 1 as tem_vendedor, anuncios_ativos >= 1 as tem_anuncio, pessoas >= 3 as tem_pessoas,
       repasse_percentual is null as repasse_a_definir
  from admin_regioes() where slug in ('corrente-pi', 'oeste-baiano-96') order by slug;
select nome, e_sede, anuncios >= 1 as tem_anuncio, lojas >= 1 as tem_vendedor, pessoas >= 3 as tem_pessoas from admin_cidades(:'reg') where nome='Corrente';
select nome, uf, ativa, e_sede, anuncios, lojas, pessoas, pedidos from admin_cidades(:'reg_nova');
\echo '[10b] funcoes auxiliares nao abrem para usuario comum (ERRO esperado: permission denied)'
select set_config('request.jwt.claim.sub','user_ou96',false) \g /dev/null
select * from uso_cidade(:'reg', 'Corrente');

-- =========================== Categorias ===========================

\echo '[11] admin cria categoria principal e subcategoria com campos (opcoes limpas, chave e tipo conferidos)'
select set_config('request.jwt.claim.sub','user_adm96',false) \g /dev/null
insert into categorias (slug, nome, icone, ordem) values ('ferramentas-96', ' Ferramentas  96 ', 'wrench', 50) returning id as cat_ferr \gset
insert into categorias (slug, nome, icone, pai_id, campos) values ('furadeiras-96', 'Furadeiras', 'zap', :'cat_ferr',
  '[{"chave":"voltagem","rotulo":"Voltagem","tipo":"lista","obrigatorio":true,"filtro":true,"opcoes":[" 110 V ","220 V","Bivolt"]},
    {"chave":"potencia","rotulo":"Potência","tipo":"numero","filtro":true,"unidade":"W","min":0},
    {"chave":"com_maleta","rotulo":"Vem com maleta","tipo":"sim_nao"}]') returning id as cat_fur \gset
select nome from categorias where id=:'cat_ferr';
select campos->0->'opcoes' as opcoes, campos->1->>'unidade' as unidade, campos->2->>'obrigatorio' as obrig_padrao from categorias where id=:'cat_fur';

\echo '[11b] 7 ERROS esperados: slug repetido; tipo desconhecido; lista sem opcoes; opcao repetida; campo na categoria principal; chave que confunde o filtro (ano/ano_min); dois campos com o mesmo nome'
insert into categorias (slug, nome, pai_id) values ('furadeiras-96', 'Furadeiras de novo', :'cat_ferr');
update categorias set campos='[{"chave":"cor","rotulo":"Cor","tipo":"cor"}]' where id=:'cat_fur';
update categorias set campos='[{"chave":"cor","rotulo":"Cor","tipo":"lista","opcoes":[]}]' where id=:'cat_fur';
update categorias set campos='[{"chave":"cor","rotulo":"Cor","tipo":"lista","opcoes":["Azul","azul "]}]' where id=:'cat_fur';
update categorias set campos='[{"chave":"cor","rotulo":"Cor","tipo":"texto"}]' where id=:'cat_ferr';
update categorias set campos='[{"chave":"ano","rotulo":"Ano","tipo":"numero"},{"chave":"ano_min","rotulo":"Ano mínimo","tipo":"texto"}]' where id=:'cat_fur';
update categorias set campos='[{"chave":"cor","rotulo":"Cor","tipo":"texto"},{"chave":"cor2","rotulo":"cor","tipo":"texto"}]' where id=:'cat_fur';

\echo '[11c] limite de campos vem da configuracao (campos_max = 2, Furadeiras ja tem 3): ordem, esconder, renomear campo e Subir/Descer de uma irma funcionam; subir para 4 campos e criar outra com 3 dao 2 ERROS esperados'
reset role; update configuracoes set valor='2' where chave='categorias.campos_max' and microrregiao_id is null;
set role authenticated; select set_config('request.jwt.claim.sub','user_adm96',false) \g /dev/null
update categorias set ordem=ordem where id=:'cat_fur' returning slug as ordem_ok;
update categorias set ativa=false where id=:'cat_fur' returning ativa as escondeu;
update categorias set ativa=true where id=:'cat_fur' returning ativa as mostrou;
update categorias set campos=jsonb_set(campos, '{2,rotulo}', '"Vem com maleta?"') where id=:'cat_fur' returning campos->2->>'rotulo' as renomeou_campo;
update categorias set campos=campos || '[{"chave":"marca","rotulo":"Marca","tipo":"texto"}]' where id=:'cat_fur';
insert into categorias (slug, nome, pai_id, campos) values ('serras-96', 'Serras', :'cat_ferr',
  '[{"chave":"a","rotulo":"A","tipo":"texto"},{"chave":"b","rotulo":"B","tipo":"texto"},{"chave":"c","rotulo":"C","tipo":"texto"}]');
insert into categorias (slug, nome, pai_id, ordem) values ('lixadeiras-96', 'Lixadeiras', :'cat_ferr', 20) returning slug as irma_criada;
select admin_mover_categoria(:'cat_fur', 'descer') \g /dev/null
select string_agg(slug, ', ' order by ordem, nome) as ordem_com_irma_acima_do_limite from categorias where pai_id=:'cat_ferr';
reset role; update configuracoes set valor='20' where chave='categorias.campos_max' and microrregiao_id is null;
\echo '[11c2] limite de opcoes (opcoes_max = 2, Voltagem ja tem 3): renomear a categoria funciona; mais uma opcao na Voltagem e campo novo com 3 opcoes dao 2 ERROS esperados; tirar uma opcao funciona'
update configuracoes set valor='2' where chave='categorias.opcoes_max' and microrregiao_id is null;
set role authenticated; select set_config('request.jwt.claim.sub','user_adm96',false) \g /dev/null
update categorias set nome='Furadeiras e parafusadeiras' where id=:'cat_fur' returning nome;
update categorias set campos=jsonb_set(campos, '{0,opcoes}', campos->0->'opcoes' || '["380 V"]') where id=:'cat_fur';
update categorias set campos=campos || '[{"chave":"cor","rotulo":"Cor","tipo":"lista","opcoes":["Azul","Verde","Preta"]}]' where id=:'cat_fur';
update categorias set campos=jsonb_set(campos, '{0,opcoes}', '["110 V","220 V"]') where id=:'cat_fur' returning campos->0->'opcoes' as tirou_opcao;
reset role; update configuracoes set valor='60' where chave='categorias.opcoes_max' and microrregiao_id is null;
set role authenticated; select set_config('request.jwt.claim.sub','user_adm96',false) \g /dev/null
delete from categorias where slug='lixadeiras-96' returning slug as apagou_irma;

\echo '[11d] slug nao muda depois de criado: ERRO esperado; preco minimo maior que o maximo: ERRO esperado (mensagem clara)'
update categorias set slug='furadeiras-novo-96' where id=:'cat_fur';
update categorias set preco_min_centavos=500000, preco_max_centavos=100 where id=:'cat_fur';

\echo '[12] usuario comum nao cria (ERRO esperado de RLS) nem edita categoria (0 linhas); nem muda a ordem nem le o painel (2 ERROS esperados: so a equipe)'
select set_config('request.jwt.claim.sub','user_ou96',false) \g /dev/null
insert into categorias (slug, nome) values ('pirata-96', 'Pirata');
with x as (update categorias set nome='Hackeada' where id=:'cat_moveis' returning 1) select count(*) as editou from x;
select admin_mover_categoria(:'cat_moveis', 'subir');
select * from admin_categorias();

\echo '[13] admin muda a ordem: Moveis sobe uma posicao dentro de Casa e moveis; na ponta nao muda nada'
select set_config('request.jwt.claim.sub','user_adm96',false) \g /dev/null
select string_agg(slug, ', ' order by ordem, nome) as antes from categorias where pai_id=:'cat_casa';
select admin_mover_categoria(:'cat_moveis', 'descer') \g /dev/null
select string_agg(slug, ', ' order by ordem, nome) as depois from categorias where pai_id=:'cat_casa';
select admin_mover_categoria(:'cat_moveis', 'subir') \g /dev/null
select admin_mover_categoria(:'cat_moveis', 'subir') \g /dev/null
select string_agg(slug, ', ' order by ordem, nome) as primeira_de_novo from categorias where pai_id=:'cat_casa';
\echo '[13b] direcao invalida: ERRO esperado'
select admin_mover_categoria(:'cat_moveis', 'pular');

\echo '[14] esconder Moveis (tem anuncio): o anuncio continua no ar e aparece na busca'
update categorias set ativa=false where id=:'cat_moveis' returning slug, ativa;
set role anon; select set_config('request.jwt.claim.role','anon',false), set_config('request.jwt.claim.sub','',false) \g /dev/null
select titulo, categoria_slug from buscar_anuncios(q => 'guarda-roupa noventa e seis');
\echo '[14b] o visitante ainda le a categoria escondida (para a pagina do anuncio e a edicao)'
select slug, ativa from categorias where id=:'cat_moveis';
\echo '[14c] a dona edita o titulo do anuncio na categoria escondida: ok'
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_pf96',false) \g /dev/null
update anuncios set titulo='Guarda-roupa 6 portas noventa e seis novo' where id=:'anu_moveis' returning status, titulo;
\echo '[14d] anuncio novo na categoria escondida: ERRO esperado'
insert into anuncios (vitrine_id, status, categoria_id, titulo, cidade) values (:'vit_pf', 'rascunho', :'cat_moveis', 'Mesa escondida', 'Corrente');
\echo '[14e] esconder a mae (Casa e moveis): escolher uma filha visivel (Decoracao) da ERRO esperado'
set role authenticated; select set_config('request.jwt.claim.sub','user_adm96',false) \g /dev/null
update categorias set ativa=true where id=:'cat_moveis';
update categorias set ativa=false where id=:'cat_casa';
select set_config('request.jwt.claim.sub','user_pf96',false) \g /dev/null
insert into anuncios (vitrine_id, status, categoria_id, titulo, cidade)
  select :'vit_pf', 'rascunho', id, 'Quadro decorativo', 'Corrente' from categorias where slug='decoracao';
select categoria_disponivel(:'cat_moveis') as moveis_disponivel, categoria_disponivel(:'cat_fur') as furadeiras_disponivel;
\echo '[14f] mostra a mae de novo: o mesmo rascunho entra'
select set_config('request.jwt.claim.sub','user_adm96',false) \g /dev/null
update categorias set ativa=true where id=:'cat_casa';
select set_config('request.jwt.claim.sub','user_pf96',false) \g /dev/null
insert into anuncios (vitrine_id, status, categoria_id, titulo, cidade)
  select :'vit_pf', 'rascunho', id, 'Quadro decorativo', 'Corrente' from categorias where slug='decoracao' returning status;

\echo '[14g] rascunho pronto numa categoria que foi escondida depois: publicar da ERRO esperado; o anuncio que ja estava no ar e pausado volta ao ar normalmente'
reset role;
insert into anuncios (vitrine_id, status, categoria_id, titulo, cidade, preco_centavos, atributos, fotos) values
 (:'vit_pf', 'rascunho', :'cat_moveis', 'Cômoda rascunho noventa e seis', 'Corrente', 30000, '{}', :'foto') returning id as rasc_moveis \gset
update anuncios set status='pausado' where id=:'anu_moveis';
update categorias set ativa=false where id=:'cat_moveis';
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_pf96',false) \g /dev/null
select publicar_anuncio(:'rasc_moveis');
select publicar_anuncio(:'anu_moveis') as pausado_volta;
\echo '[14h] atalho: pausar o rascunho antes de publicar. Pausar passa, mas publicar e mudar direto para ativo dao 2 ERROS esperados (nunca esteve no ar)'
update anuncios set status='pausado' where id=:'rasc_moveis' returning status;
select publicar_anuncio(:'rasc_moveis');
update anuncios set status='ativo' where id=:'rasc_moveis';
select status, publicado_em is null as nunca_no_ar from anuncios where id=:'rasc_moveis';
\echo '[14i] anuncio avulso (pago) do rascunho na categoria escondida: a cobranca nao nasce (ERRO esperado: Escolha outra antes de pagar)'
reset role; select set_config('request.jwt.claim.role','',false), set_config('request.jwt.claim.sub','',false) \g /dev/null
insert into pagamentos (vitrine_id, microrregiao_id, tipo, anuncio_id, valor_centavos, status, asaas_cobranca_id)
values (:'vit_pf', :'reg', 'anuncio_avulso', :'rasc_moveis', 990, 'pendente', 'pay_96_av');
\echo '[14j] cobranca feita com a categoria visivel e paga depois que ela foi escondida: so soma o tempo, nao vai ao ar sozinho (nota explica); mostrando a categoria, o dono publica'
update categorias set ativa=true where id=:'cat_moveis';
insert into pagamentos (vitrine_id, microrregiao_id, tipo, anuncio_id, valor_centavos, status, asaas_cobranca_id)
values (:'vit_pf', :'reg', 'anuncio_avulso', :'rasc_moveis', 990, 'pendente', 'pay_96_av') returning id as pg96 \gset
update categorias set ativa=false where id=:'cat_moveis';
set role service_role; select set_config('request.jwt.claim.role','service_role',false) \g /dev/null
select confirmar_pagamento('pay_96_av') \g /dev/null
select status, pago_ate > now() as pago, publicado_em is null as nunca_no_ar from anuncios where id=:'rasc_moveis';
select status, observacao from pagamentos where id=:'pg96';
reset role; select set_config('request.jwt.claim.role','',false) \g /dev/null
update categorias set ativa=true where id=:'cat_moveis';
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_pf96',false) \g /dev/null
select publicar_anuncio(:'rasc_moveis') as publica_com_categoria_visivel;
reset role; update categorias set ativa=true where id=:'cat_moveis';
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_pf96',false) \g /dev/null

\echo '[15] apagar categoria em uso (Moveis): ERRO esperado; com subcategorias (Ferramentas): ERRO esperado; sem uso (Furadeiras): ok'
select set_config('request.jwt.claim.sub','user_adm96',false) \g /dev/null
delete from categorias where id=:'cat_moveis';
delete from categorias where id=:'cat_ferr';
delete from categorias where id=:'cat_fur' returning slug;
delete from categorias where id=:'cat_ferr' returning slug;

\echo '[16] subcategoria com anuncio nao vira categoria principal: ERRO esperado (Pedreiro com um anuncio)'
select set_config('request.jwt.claim.sub','user_pf96',false) \g /dev/null
insert into anuncios (vitrine_id, status, categoria_id, titulo, cidade) values (:'vit_pf', 'rascunho', :'cat_pedreiro', 'Faço reboco', 'Corrente');
select set_config('request.jwt.claim.sub','user_adm96',false) \g /dev/null
update categorias set pai_id=null where id=:'cat_pedreiro';
\echo '[16b] mover subcategoria para outra mae: ok (Pedreiro vai para Casa e moveis)'
update categorias set pai_id=:'cat_casa' where id=:'cat_pedreiro' returning slug;
\echo '[16c] mover a categoria principal (com filhas) para baixo de outra: ERRO esperado (so 2 niveis)'
update categorias set pai_id=:'cat_casa' where slug='servicos';

\echo '[17] moderacao usa o preco maximo editado no painel: Moveis ate R$ 1.000 -> anuncio de R$ 5.000 vai para analise'
update categorias set preco_max_centavos=100000 where id=:'cat_moveis';
select set_config('request.jwt.claim.sub','user_pf96',false) \g /dev/null
insert into anuncios (vitrine_id, categoria_id, titulo, cidade, preco_centavos, atributos, fotos) values
 (:'vit_pf', :'cat_moveis', 'Sofá de couro caríssimo', 'Corrente', 500000, '{}', :'foto')
returning status, motivo_analise;

\echo '[18] painel: admin_categorias traz escondidas e contagens (a principal Casa e moveis soma os anuncios das subcategorias: tem_anuncios = t); historico registra as mudancas de categoria'
select set_config('request.jwt.claim.sub','user_adm96',false) \g /dev/null
select slug, anuncios_total >= 2 as tem_anuncios, filhas from admin_categorias() where slug in ('moveis', 'casa-e-moveis') order by slug;
reset role;
select count(*) filter (where acao='INSERT') > 0 as criou, count(*) filter (where acao='UPDATE') > 0 as editou,
       count(*) filter (where acao='DELETE') = 3 as apagou   -- Lixadeiras [11c2], Furadeiras e Ferramentas [15]
  from logs_atividade where tabela='categorias' and usuario_id='user_adm96';
