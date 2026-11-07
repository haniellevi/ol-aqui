\set ON_ERROR_STOP 0
\set QUIET on
\pset footer off
-- Preparação (como o sistema)
reset role; select set_config('request.jwt.claim.role','',false), set_config('request.jwt.claim.sub','',false) \g /dev/null
select id as reg from microrregioes where slug='corrente-pi' \gset
insert into perfis (id,microrregiao_id,nome,whatsapp,cidade,tipo_pessoa) values
 ('user_pf40',:'reg','Ana Vendedora','5589999994040','Corrente','pf'),
 ('user_lj40',:'reg','Joao Lojista','5589999994141','Corrente','pj'),
 ('user_ou40',:'reg','Outro Usuario','5589999994242','Corrente','pf');
update perfis set whatsapp_verificado_em=now() where id='user_pf40';
select id as cat_carros from categorias where slug='carros' \gset
select id as cat_motos from categorias where slug='motos' \gset
select id as cat_moveis from categorias where slug='moveis' \gset
select id as cat_eletro from categorias where slug='eletrodomesticos' \gset
select id as cat_veiculos from categorias where slug='veiculos' \gset
\set foto '{https://abc.supabase.co/storage/v1/object/public/anuncios/user_pf40/x/1.webp}'
\set foto_lj '{https://abc.supabase.co/storage/v1/object/public/anuncios/user_lj40/x/1.webp}'
-- endereço do Storage do projeto (no Supabase de verdade é preenchido no painel depois do deploy)
update configuracoes set valor='"https://abc.supabase.co"' where chave='fotos.origem' and microrregiao_id is null;
update configuracoes set valor='1' where chave='anuncio.fotos_minimo' and microrregiao_id is null;

\echo '[1] semente: 9 categorias-mae; toda subcategoria tem mae'
select count(*) filter (where pai_id is null) as maes, count(*) filter (where pai_id is not null) as subcategorias,
       count(*) filter (where pai_id is null and campos <> '[]') as maes_com_campos from categorias;
select string_agg(nome, ', ' order by ordem) as maes from categorias where pai_id is null;

\echo '[2] visitante le as categorias ativas e os campos'
set role anon; select set_config('request.jwt.claim.role','anon',false) \g /dev/null
select count(*) as visiveis from categorias;
select slug, jsonb_array_length(campos) as campos, campos->0->>'rotulo' as primeiro from categorias where slug in ('carros','fazendas-e-sitios','gado-e-animais') order by slug;

\echo '[3] usuario comum nao cria categoria (erro de RLS)'
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_ou40',false) \g /dev/null
insert into categorias (slug, nome) values ('hackers','Hackers');

\echo '[4] quero_vender pf: cria vitrine tipo pf no plano gratis; repetir nao duplica'
select set_config('request.jwt.claim.sub','user_pf40',false) \g /dev/null
select tipo, plano, slug like 'pf-%' as slug_interno from quero_vender('pf');
select tipo, plano from quero_vender('pf');
select count(*) as vitrines from vitrines_lojas where dono_id='user_pf40';
select id as vit_pf from vitrines_lojas where dono_id='user_pf40' \gset

\echo '[5] rascunho sem titulo, cidade, categoria e campos salva'
insert into anuncios (vitrine_id, status) values (:'vit_pf', 'rascunho') returning id as rasc \gset
select status, titulo is null as sem_titulo, cidade is null as sem_cidade from anuncios where id=:'rasc';
\echo '[5b] passo 3 salvo pela metade (so o ano) continua rascunho'
update anuncios set categoria_id=:'cat_carros', titulo='Fiat Strada 2021 completa', cidade='Corrente', atributos='{"ano":"2021"}', fotos=:'foto' where id=:'rasc';
select status, categoria, subcategoria, atributos from anuncios where id=:'rasc';

\echo '[6] publicar sem campo obrigatorio falha com mensagem (Marca)'
select publicar_anuncio(:'rasc');
\echo '[6b] numero fora do minimo falha mesmo no rascunho'
update anuncios set atributos='{"ano":1800}' where id=:'rasc';
\echo '[6c] opcao fora da lista falha'
update anuncios set atributos='{"cambio":"pedal"}' where id=:'rasc';
\echo '[6d] foto de fora do OLAKI e recusada'
update anuncios set fotos='{https://site-estranho.com/foto.jpg}' where id=:'rasc';
\echo '[6e] categoria-mae nao serve: precisa de subcategoria'
update anuncios set categoria_id=:'cat_veiculos' where id=:'rasc';

\echo '[7] publicar com os campos funciona; numeros e opcoes sao normalizados'
update anuncios set preco_centavos=8500000, atributos='{"marca":"Fiat","modelo":"Strada","ano":"2021","km":"45.000","cambio":"manual","cor":""}' where id=:'rasc';
select publicar_anuncio(:'rasc') as status;
select publicar_anuncio(:'rasc') as repetido;
select status, atributos, publicado_em is not null as publicado from anuncios where id=:'rasc';

\echo '[8] PF (3 gratis): rascunho nao conta no limite; publicar o 4o falha'
insert into anuncios (vitrine_id, categoria_id, titulo, cidade, preco_centavos, atributos, fotos) values
 (:'vit_pf', :'cat_moveis', 'Sofá retrátil 3 lugares', 'Corrente', 150000, '{"estado":"usado"}', :'foto'),
 (:'vit_pf', :'cat_eletro', 'Geladeira duplex Brastemp', 'Corrente', 200000, '{}', :'foto');
insert into anuncios (vitrine_id, status, categoria_id, titulo, cidade, fotos, preco_centavos) values
 (:'vit_pf', 'rascunho', :'cat_moveis', 'Sofá rascunho escondido', 'Corrente', :'foto', 90000) returning id as rasc2 \gset
select count(*) filter (where status='ativo') as ativos, count(*) filter (where status='rascunho') as rascunhos from anuncios where vitrine_id=:'vit_pf';
select publicar_anuncio(:'rasc2');

\echo '[9] quero_vender loja: teste gratis com os dias da configuracao (mudada para 10)'
reset role; select set_config('request.jwt.claim.role','',false) \g /dev/null
update configuracoes set valor='10' where chave='teste.dias' and microrregiao_id is null;
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_lj40',false) \g /dev/null
select tipo, slug, nome, plano, teste_expira_em::date = (now() + interval '10 days')::date as teste_10_dias
  from quero_vender('loja', 'Loja do João', 'Loja-do-Joao', '(89) 99999-4141', null);
select whatsapp, cidade from vitrines_lojas where dono_id='user_lj40';
\echo '[9b] repetir nao reinicia o teste'
reset role; update vitrines_lojas set teste_expira_em = now() + interval '3 days' where dono_id='user_lj40';
set role authenticated;
select nome, teste_expira_em::date = (now() + interval '3 days')::date as manteve from quero_vender('loja', 'Loja do João Novo', 'loja-do-joao');
reset role; update configuracoes set valor='30' where chave='teste.dias' and microrregiao_id is null;

\echo '[10] endereco ja usado: erro amigavel; slug_disponivel'
set role authenticated; select set_config('request.jwt.claim.sub','user_ou40',false) \g /dev/null
select * from quero_vender('loja', 'Outra Loja', 'loja-do-joao', '89999994242');
select slug_disponivel('loja-do-joao') as joao, slug_disponivel('livre-123') as livre, slug_disponivel('com espaco') as invalido;
\echo '[10b] WhatsApp invalido'
select * from quero_vender('loja', 'Outra Loja', 'outra-loja', '12345');

\echo '[11] anuncios da loja (um vai para analise, um fica rascunho)'
select set_config('request.jwt.claim.sub','user_lj40',false) \g /dev/null
select id as vit_lj from vitrines_lojas where dono_id='user_lj40' \gset
insert into anuncios (vitrine_id, categoria_id, titulo, cidade, preco_centavos, atributos, fotos) values
 (:'vit_lj', :'cat_motos',  'Honda CG 160 Titan', 'Corrente', 1500000, '{"marca":"Honda","modelo":"CG 160","ano":2019,"km":20000}', :'foto_lj'),
 (:'vit_lj', :'cat_carros', 'Fiat Uno Mille 2010', 'Corrente', 2000000, '{"marca":"Fiat","modelo":"Uno","ano":2010,"km":150000,"cambio":"Manual"}', :'foto_lj'),
 (:'vit_lj', :'cat_moveis', 'Pistola de cola quente', 'Corrente', 5000, '{}', :'foto_lj')
returning titulo, status, categoria;

\echo '[12] busca (visitante)'
set role anon; select set_config('request.jwt.claim.role','anon',false), set_config('request.jwt.claim.sub','',false) \g /dev/null
\echo '[12a] "sofa" acha "Sofá" (sem o rascunho)'
select titulo, categoria_slug, vitrine_tipo, total from buscar_anuncios(q => 'sofa');
\echo '[12b] erro de digitacao: "geladera"'
select titulo from buscar_anuncios(q => 'geladera');
\echo '[12c] categoria-mae "veiculos" inclui subcategorias, menor preco'
select titulo, preco_centavos, categoria_slug, total from buscar_anuncios(categoria_slug => 'veiculos', ordem => 'menor_preco');
\echo '[12d] faixa de preco ate R$ 20 mil'
select titulo from buscar_anuncios(categoria_slug => 'veiculos', preco_max => 2000000, ordem => 'menor_preco');
\echo '[12e] filtro por atributo: ano >= 2015 e cambio = manual'
select titulo from buscar_anuncios(categoria_slug => 'veiculos', filtros => '{"ano":{"min":2015}}', ordem => 'menor_preco');
select titulo from buscar_anuncios(filtros => '{"cambio":"manual"}', ordem => 'menor_preco');
\echo '[12f] em analise e rascunho nao aparecem'
select count(*) as pistola from buscar_anuncios(q => 'pistola');
select count(*) as rascunho from buscar_anuncios(q => 'rascunho escondido');
\echo '[12g] limite e total; cidade; regiao'
select count(*) as linhas, max(total) as total from buscar_anuncios(categoria_slug => 'veiculos', limite => 1);
select count(*) as cidade_sem_acento from buscar_anuncios(categoria_slug => 'veiculos', cidade => 'CORRENTE', microrregiao_slug => 'corrente-pi');
select count(*) as outra_regiao from buscar_anuncios(categoria_slug => 'veiculos', microrregiao_slug => 'nao-existe');
\echo '[12h] destaque pago vem primeiro'
reset role; update anuncios set destaque_ate = now() + interval '1 day' where titulo = 'Fiat Uno Mille 2010';
set role anon;
select titulo, destaque from buscar_anuncios(categoria_slug => 'veiculos', ordem => 'menor_preco');

\echo '[13] faixa de preco: poucos anuncios = sem faixa; com minimo 2 mostra'
select * from faixa_preco_regiao(:'cat_carros', :'reg');
reset role; update configuracoes set valor='2' where chave='busca.faixa_preco_minimo_anuncios';
set role anon;
select * from faixa_preco_regiao(:'cat_carros', :'reg');
reset role; update configuracoes set valor='3' where chave='busca.faixa_preco_minimo_anuncios';

\echo '[14] visitante registra visualizacao e clique; tipo desconhecido e rascunho sao ignorados'
set role anon;
select registrar_evento(:'rasc', 'visualizacao') as vis, registrar_evento(:'rasc', 'clique_whatsapp') as clique,
       registrar_evento(:'rasc', 'hackear') as desconhecido, registrar_evento(:'rasc2', 'visualizacao') as rascunho;
reset role; select visualizacoes, cliques_whatsapp from anuncios where id=:'rasc';
select count(*) as eventos from eventos_anuncio where anuncio_id=:'rasc';
\echo '[14b] visitante nao le eventos'
set role anon; select count(*) from eventos_anuncio;

\echo '[15] dono nao altera contadores, vendido nem data de publicacao'
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_pf40',false) \g /dev/null
update anuncios set visualizacoes=999, cliques_whatsapp=999, vendido_pelo_olaki=true, publicado_em='2000-01-01' where id=:'rasc';
select visualizacoes, cliques_whatsapp, vendido_pelo_olaki, publicado_em > '2001-01-01' as data_mantida from anuncios where id=:'rasc';

\echo '[16] pagina publica: visitante ve WhatsApp confirmado da PF e os campos; rascunho nao aparece'
set role anon; select set_config('request.jwt.claim.role','anon',false), set_config('request.jwt.claim.sub','',false) \g /dev/null
select titulo, status, categoria_pai_slug, vitrine_tipo, whatsapp, jsonb_array_length(campos) as campos, e_dono from anuncio_publico(:'rasc');
select count(*) as rascunho_visivel from anuncio_publico(:'rasc2');
select vitrine_tipo, vitrine_nome, whatsapp from anuncio_publico((select id from anuncios where titulo='Honda CG 160 Titan'));
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_pf40',false) \g /dev/null
select status, whatsapp is null as sem_whatsapp, e_dono from anuncio_publico(:'rasc2');

\echo '[17] favoritos: anuncio ativo conta; rascunho alheio nao (RLS)'
select set_config('request.jwt.claim.sub','user_ou40',false) \g /dev/null
insert into favoritos (usuario_id, anuncio_id) values ('user_ou40', :'rasc');
insert into favoritos (usuario_id, anuncio_id) values ('user_ou40', :'rasc2');
reset role; select total_favoritos from anuncios where id=:'rasc';

\echo '[18] marcar_vendido: outro usuario nao consegue; dono consegue; sai da busca'
set role authenticated; select set_config('request.jwt.claim.sub','user_ou40',false) \g /dev/null
select marcar_vendido(:'rasc', true);
select set_config('request.jwt.claim.sub','user_pf40',false) \g /dev/null
select marcar_vendido(:'rasc', true) as status;
select status, vendido_pelo_olaki, vendido_em is not null as tem_data from anuncios where id=:'rasc';
select count(*) as na_busca from buscar_anuncios(q => 'strada');
select status, whatsapp is not null as contato from anuncio_publico(:'rasc');

\echo '[19] pessoa vira loja sem perder os anuncios (teste gratis comeca)'
select tipo, plano, slug from quero_vender('loja', 'Ana Modas', 'ana-modas');
select count(*) as anuncios_mantidos from anuncios where vitrine_id=:'vit_pf';
\echo '[19b] agora o rascunho publica'
select publicar_anuncio(:'rasc2') as status;

\echo '[20] publicar com palavra proibida vai para analise'
insert into anuncios (vitrine_id, status, categoria_id, titulo, cidade, fotos) values
 (:'vit_pf', 'rascunho', :'cat_moveis', 'Vendo maconha boa', 'Corrente', :'foto') returning id as rasc3 \gset
select publicar_anuncio(:'rasc3') as status;

\echo '[21] avulso pago para rascunho incompleto: webhook nao falha, anuncio continua rascunho'
insert into anuncios (vitrine_id, status, categoria_id) values (:'vit_pf', 'rascunho', :'cat_carros') returning id as rasc4 \gset
reset role; select set_config('request.jwt.claim.role','',false), set_config('request.jwt.claim.sub','',false) \g /dev/null
insert into pagamentos (vitrine_id,microrregiao_id,tipo,anuncio_id,valor_centavos,asaas_cobranca_id) values (:'vit_pf',:'reg','anuncio_avulso',:'rasc4',990,'pay_40');
select confirmar_pagamento('pay_40');
select status, pago_ate > now() as pago from anuncios where id=:'rasc4';

\echo '[22] usuario nao muda o tipo da vitrine direto'
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_lj40',false) \g /dev/null
update vitrines_lojas set tipo='pf' where dono_id='user_lj40';
select tipo from vitrines_lojas where dono_id='user_lj40';

\echo '[23] admin cria categoria; campo de lista sem opcoes e recusado; fica no log'
reset role; update perfis set e_admin=true where id='user_ou40';
set role authenticated; select set_config('request.jwt.claim.sub','user_ou40',false) \g /dev/null
insert into categorias (slug, nome, pai_id, campos) values ('bicicletas','Bicicletas',:'cat_veiculos','[{"chave":"aro","rotulo":"Aro","tipo":"lista"}]');
insert into categorias (slug, nome, pai_id, campos) values ('bicicletas','Bicicletas',:'cat_veiculos','[{"chave":"aro","rotulo":"Aro","tipo":"lista","opcoes":["26","29"],"filtro":true}]') returning slug, campos;
reset role; select acao, usuario_id from logs_atividade where tabela='categorias' and usuario_id='user_ou40';

-- ===================== Correções da revisão =====================
reset role; select set_config('request.jwt.claim.role','',false), set_config('request.jwt.claim.sub','',false) \g /dev/null
insert into perfis (id,microrregiao_id,nome,whatsapp,cidade,bairro,tipo_pessoa) values
 ('user_pf41',:'reg','Carla Maria Souza','5589999994343','Corrente','Centro','pf');
update perfis set whatsapp_verificado_em=now() where id='user_pf41';
\set foto41 '{https://abc.supabase.co/storage/v1/object/public/anuncios/user_pf41/x/1.webp}'

\echo '[24] PF aparece so pelo primeiro nome e sem bairro'
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_pf41',false) \g /dev/null
select tipo, nome from quero_vender('pf');
select id as vit41 from vitrines_lojas where dono_id='user_pf41' \gset
select nome, bairro from vitrines_lojas where id=:'vit41';

\echo '[25] PF nao troca o WhatsApp da vitrine direto (contato e o celular confirmado do perfil)'
update vitrines_lojas set whatsapp='5511911112222' where id=:'vit41';
select whatsapp is null as sem_numero_solto from vitrines_lojas where id=:'vit41';

\echo '[26] rascunho nao pula para vendido; pausado nao vira vendido por marcar_vendido'
insert into anuncios (vitrine_id, status, categoria_id, titulo, cidade, fotos) values
 (:'vit41', 'rascunho', :'cat_moveis', 'Sofa pix antecipado golpe', 'Corrente', :'foto41') returning id as r41 \gset
update anuncios set status='vendido' where id=:'r41';
insert into anuncios (vitrine_id, categoria_id, titulo, cidade, fotos, preco_centavos) values
 (:'vit41', :'cat_moveis', 'Mesa de jantar 6 lugares', 'Corrente', :'foto41', 80000) returning id as a41, status \gset
update anuncios set status='pausado' where id=:'a41';
select marcar_vendido(:'a41', false);
update anuncios set status='ativo' where id=:'a41';
select status from anuncios where id=:'a41';

\echo '[27] vendido: editar o texto passa pela moderacao (vai para analise e sai do publico)'
select marcar_vendido(:'a41', true) as status;
update anuncios set descricao='Pagamento so por pix antecipado' where id=:'a41';
select status, motivo_analise from anuncios where id=:'a41';
set role anon; select set_config('request.jwt.claim.role','anon',false), set_config('request.jwt.claim.sub','',false) \g /dev/null
select count(*) as publico from anuncio_publico(:'a41');

\echo '[28] fotos: outro endereco, ".." e pasta alheia sao recusados; minimo de fotos vale no ar'
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_pf41',false) \g /dev/null
update anuncios set fotos='{https://evil.example/storage/v1/object/public/anuncios/user_pf41/x/a.webp}' where id=:'r41';
update anuncios set fotos='{https://abc.supabase.co/storage/v1/object/public/anuncios/user_pf41/../user_pf40/x/1.webp}' where id=:'r41';
update anuncios set fotos='{https://abc.supabase.co/storage/v1/object/public/anuncios/user_pf40/x/1.webp}' where id=:'r41';
update anuncios set titulo='Sofa de canto bege', fotos='{}' where id=:'r41';
update anuncios set status='ativo' where id=:'r41';
insert into anuncios (vitrine_id, categoria_id, titulo, cidade, fotos) values (:'vit41', :'cat_moveis', 'Cadeira sem foto', 'Corrente', '{}');
update anuncios set fotos=:'foto41' where id=:'r41';
update anuncios set status='ativo' where id=:'r41';
update anuncios set fotos='{}' where id=:'r41';
select status, cardinality(fotos) as fotos from anuncios where id=:'r41';

\echo '[29] logo da loja: so da pasta <dono>/loja/ do Storage do OLAKI'
select set_config('request.jwt.claim.sub','user_lj40',false) \g /dev/null
update vitrines_lojas set logo_url='https://evil.example/storage/v1/object/public/anuncios/user_lj40/loja/l.webp' where dono_id='user_lj40';
update vitrines_lojas set capa_url='https://abc.supabase.co/storage/v1/object/public/anuncios/user_pf40/loja/c.webp' where dono_id='user_lj40';
update vitrines_lojas set logo_url='https://abc.supabase.co/storage/v1/object/public/anuncios/user_lj40/loja/logo-1.webp' where dono_id='user_lj40' returning logo_url is not null as logo_salva;

\echo '[30] eventos: trocar o navegador nao conta de novo; o servidor informa o visitante'
select id as honda from anuncios where titulo='Honda CG 160 Titan' \gset
set role anon; select set_config('request.jwt.claim.role','anon',false), set_config('request.jwt.claim.sub','',false) \g /dev/null
select set_config('request.headers','{"x-forwarded-for":"200.1.1.1","user-agent":"a"}',false) \g /dev/null
select registrar_evento(:'honda','visualizacao') as primeira;
select set_config('request.headers','{"x-forwarded-for":"200.1.1.1","user-agent":"b"}',false) \g /dev/null
select registrar_evento(:'honda','visualizacao') as outro_navegador;
\echo '[30b] visitante comum nao finge ser o servidor (parametros ignorados)'
select registrar_evento(:'honda','visualizacao', 'qualquer', 'user_x') as fingindo;
\echo '[30c] servidor (service_role): cada visitante conta uma vez; o dono nao conta'
reset role; select set_config('request.jwt.claim.role','service_role',false), set_config('request.headers','',false) \g /dev/null
select registrar_evento(:'honda','visualizacao', '177.0.0.1', null) as v1, registrar_evento(:'honda','visualizacao', '177.0.0.1', null) as v1_de_novo,
       registrar_evento(:'honda','visualizacao', '177.0.0.2', null) as v2, registrar_evento(:'honda','visualizacao', '177.0.0.3', 'user_lj40') as dono;
select set_config('request.jwt.claim.role','',false) \g /dev/null

\echo '[31] limite de rascunhos (configuracao anuncio.rascunhos_max = 2)'
update configuracoes set valor='2' where chave='anuncio.rascunhos_max' and microrregiao_id is null;
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_pf41',false) \g /dev/null
insert into anuncios (vitrine_id, status) values (:'vit41', 'rascunho');
insert into anuncios (vitrine_id, status) values (:'vit41', 'rascunho');
insert into anuncios (vitrine_id, status) values (:'vit41', 'rascunho');
select count(*) filter (where status='rascunho') as rascunhos from anuncios where vitrine_id=:'vit41';
reset role; update configuracoes set valor='20' where chave='anuncio.rascunhos_max' and microrregiao_id is null;

\echo '[32] envio ao Storage: so na propria pasta, de anuncio proprio (ou loja)'
set role authenticated; select set_config('request.jwt.claim.sub','user_pf41',false) \g /dev/null
select pode_enviar_foto('user_pf41/' || :'r41' || '/a.webp') as proprio,
       pode_enviar_foto('user_pf41/' || :'honda' || '/a.webp') as anuncio_alheio,
       pode_enviar_foto('user_pf40/' || :'r41' || '/a.webp') as pasta_alheia,
       pode_enviar_foto('user_pf41/qualquer/a.webp') as pasta_inventada,
       pode_enviar_foto('user_pf41/loja/a.webp') as pf_sem_loja;
select set_config('request.jwt.claim.sub','user_lj40',false) \g /dev/null
select pode_enviar_foto('user_lj40/loja/logo-2.webp') as loja;

\echo '[33] meu_plano: plano que saiu de venda (ativo=false) continua valendo para quem tem'
reset role; update planos set ativo=false where codigo='pf_gratis';
set role authenticated; select set_config('request.jwt.claim.sub','user_pf41',false) \g /dev/null
select count(*) as visivel_na_tabela from planos where codigo='pf_gratis';
select codigo, limite_anuncios from meu_plano();
reset role; update planos set ativo=true where codigo='pf_gratis';

\echo '[34] plano de teste da loja vem da configuracao loja.plano_teste'
insert into planos (codigo, nome, publico, preco_centavos, periodo_dias, limite_anuncios, acesso_radar, propostas_radar_mes, e_teste, ordem)
values ('teste_15', 'Teste 15', 'todos', 0, 15, 15, true, 3, true, -1);
update configuracoes set valor='"teste_15"' where chave='loja.plano_teste' and microrregiao_id is null;
insert into perfis (id,microrregiao_id,nome,whatsapp,cidade,tipo_pessoa) values ('user_lj41',:'reg','Pedro Lojista','5589999994444','Corrente','pj');
set role authenticated; select set_config('request.jwt.claim.sub','user_lj41',false) \g /dev/null
select plano from quero_vender('loja', 'Loja do Pedro', 'loja-do-pedro', '89999994444');
reset role; update configuracoes set valor='"teste"' where chave='loja.plano_teste' and microrregiao_id is null;

\echo '[35] busca e pagina publica mostram so o primeiro nome da PF'
set role anon; select set_config('request.jwt.claim.role','anon',false), set_config('request.jwt.claim.sub','',false) \g /dev/null
reset role; update vitrines_lojas set nome='Carla Maria Souza' where id=:'vit41';
set role anon;
select vitrine_nome, whatsapp is not null as contato from anuncio_publico(:'r41');
select distinct vitrine_nome from buscar_anuncios(q => 'sofa de canto');
