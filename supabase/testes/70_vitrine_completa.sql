\set ON_ERROR_STOP 0
\set QUIET on
\pset footer off
-- Vitrine completa da loja (migração 20261107040000_vitrine_completa.sql).
-- Cada bloco [n] diz o que deve acontecer. "ERRO ESPERADO" = a linha ERROR logo abaixo é o certo.

-- Preparação (como o sistema)
reset role; select set_config('request.jwt.claim.role','',false), set_config('request.jwt.claim.sub','',false), set_config('request.headers','',false) \g /dev/null
select id as reg from microrregioes where slug='corrente-pi' \gset
insert into perfis (id,microrregiao_id,nome,whatsapp,cidade,tipo_pessoa) values
 ('user_lj70',:'reg','Rita Lojista','5589999997070','Corrente','pj'),
 ('user_lj71',:'reg','Beto Lojista','5589999997171','Corrente','pj'),
 ('user_pf70',:'reg','Caio Pessoa','5589999997272','Corrente','pf'),
 ('user_ad70',:'reg','Admin Setenta','5589999997373','Corrente','pf');
update perfis set e_admin=true where id='user_ad70';
update configuracoes set valor='"https://abc.supabase.co"' where chave='fotos.origem' and microrregiao_id is null;
update configuracoes set valor='1' where chave='anuncio.fotos_minimo' and microrregiao_id is null;
select id as cat_motos from categorias where slug='motos' \gset
select id as cat_moveis from categorias where slug='sofas-e-poltronas' \gset
select id as cat_celulares from categorias where slug='celulares' \gset
\set f70 '{https://abc.supabase.co/storage/v1/object/public/anuncios/user_lj70/x/1.webp}'
\set f71 '{https://abc.supabase.co/storage/v1/object/public/anuncios/user_lj71/x/1.webp}'
\set banner70 'https://abc.supabase.co/storage/v1/object/public/anuncios/user_lj70/vitrine/banner-1.webp'

set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_lj70',false) \g /dev/null
select tipo, plano from quero_vender('loja', 'Loja Setenta', 'loja-setenta', '89999997070');
select id as v70 from vitrines_lojas where dono_id='user_lj70' \gset
select set_config('request.jwt.claim.sub','user_lj71',false) \g /dev/null
select tipo, plano from quero_vender('loja', 'Loja Setenta e Um', 'loja-setenta-um', '89999997171');
select id as v71 from vitrines_lojas where dono_id='user_lj71' \gset
select set_config('request.jwt.claim.sub','user_pf70',false) \g /dev/null
select tipo, plano from quero_vender('pf');
select id as vpf from vitrines_lojas where dono_id='user_pf70' \gset
select slug as slug_pf from vitrines_lojas where dono_id='user_pf70' \gset

\echo '[1] semente: teste e gratis sem foto/secoes/fixados; Slim e Full com; Slim recomendado'
reset role; select set_config('request.jwt.claim.role','',false), set_config('request.jwt.claim.sub','',false) \g /dev/null
select codigo, vitrine_foto_fachada as foto, vitrine_secoes_max as secoes, vitrine_fixados_max as fixados, recomendado from planos order by ordem;

\echo '[2] visitante le os planos ativos com os campos novos'
set role anon; select set_config('request.jwt.claim.role','anon',false) \g /dev/null
select codigo, vitrine_foto_fachada, vitrine_secoes_max, recomendado from planos where codigo in ('slim','full') order by ordem;

\echo '[3] dono grava as informacoes: @ e maiusculas saem do Instagram; pagamento com a grafia do painel; sem repetir'
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_lj70',false) \g /dev/null
update vitrines_lojas set
  endereco = '  Rua   Benjamin Constant, 100  ', lat = -10.441, lng = -45.162,
  instagram = 'https://www.instagram.com/Loja.Setenta/?hl=pt',
  horarios = '{"seg":[{"abre":"08:00","fecha":"12:00"},{"abre":"14:00","fecha":"18:00"}],"sab":[{"abre":"08:00","fecha":"12:00"}],"dom":[]}',
  formas_pagamento = '{pix,"cartao de credito",Pix}', faz_entrega = true, entrega_obs = 'Entrega grátis no centro',
  sobre = 'Loja de motos e peças desde 1990.'
 where id = :'v70'
returning endereco, instagram, formas_pagamento, faz_entrega, horarios->'seg'->1->>'fecha' as seg_fecha;
\echo '[3b] instagram com @ simples'
update vitrines_lojas set instagram = '@loja_70' where id = :'v70' returning instagram;
\echo '[3c] ERRO ESPERADO: Instagram invalido'
update vitrines_lojas set instagram = 'loja setenta!' where id = :'v70';
\echo '[3d] ERRO ESPERADO: horario de abrir depois do de fechar'
update vitrines_lojas set horarios = '{"seg":[{"abre":"18:00","fecha":"08:00"}]}' where id = :'v70';
\echo '[3e] ERRO ESPERADO: horarios do mesmo dia se cruzando'
update vitrines_lojas set horarios = '{"seg":[{"abre":"08:00","fecha":"13:00"},{"abre":"12:00","fecha":"18:00"}]}' where id = :'v70';
\echo '[3f] ERRO ESPERADO: dia que nao existe'
update vitrines_lojas set horarios = '{"feriado":[{"abre":"08:00","fecha":"12:00"}]}' where id = :'v70';
\echo '[3g] ERRO ESPERADO: forma de pagamento fora da lista do painel'
update vitrines_lojas set formas_pagamento = '{Bitcoin}' where id = :'v70';
\echo '[3h] ERRO ESPERADO: localizacao pela metade'
update vitrines_lojas set lat = -10.5, lng = null where id = :'v70';
\echo '[3i] ERRO ESPERADO: Sobre nos com palavra proibida'
update vitrines_lojas set sobre = 'Aceitamos pix antecipado' where id = :'v70';
\echo '[3j] ERRO ESPERADO: cor do banner fora da lista do painel'
update vitrines_lojas set banner_cor = '#123456' where id = :'v70';
\echo '[3k] cor da lista (em minusculas) e modelo listras: aceitos'
update vitrines_lojas set banner_cor = '#c2410c', banner_modelo = 'listras' where id = :'v70' returning banner_cor, banner_modelo, banner_tipo;
\echo '[3l] horarios vazios {} viram "nao informado"'
update vitrines_lojas set horarios = '{}' where id = :'v71';
select set_config('request.jwt.claim.sub','user_lj71',false) \g /dev/null
update vitrines_lojas set horarios = '{}' where id = :'v71' returning horarios is null as nao_informado;
select set_config('request.jwt.claim.sub','user_lj70',false) \g /dev/null
\echo '[3m] outro usuario nao muda a loja dos outros (0 linhas)'
select set_config('request.jwt.claim.sub','user_lj71',false) \g /dev/null
update vitrines_lojas set sobre = 'invadido' where id = :'v70' returning id;
select set_config('request.jwt.claim.sub','user_lj70',false) \g /dev/null

\echo '[4] plano de teste: foto da fachada, secao e envio para a pasta vitrine sao recusados'
\echo '[4a] ERRO ESPERADO: foto da fachada so nos planos que tem (nomes vindos da tabela)'
update vitrines_lojas set banner_tipo = 'foto', banner_url = :'banner70' where id = :'v70';
\echo '[4b] ERRO ESPERADO: secoes proprias so nos planos que tem'
insert into loja_secoes (vitrine_id, nome) values (:'v70', 'Promoções');
\echo '[4c] envio ao Storage na pasta vitrine: recusado no teste'
select pode_enviar_foto('user_lj70/vitrine/banner-1.webp') as pode_no_teste, pode_enviar_foto('user_lj70/loja/logo.webp') as logo_continua;
\echo '[4d] recursos da minha loja no teste'
select foto_fachada, secoes_max, fixados_max, secoes_total, fixados_total from minha_vitrine_recursos();

\echo '[5] loja assina o Slim (sistema): foto liberada'
reset role; select set_config('request.jwt.claim.role','',false), set_config('request.jwt.claim.sub','',false) \g /dev/null
update vitrines_lojas set plano='slim', plano_expira_em = now() + interval '30 days' where id = :'v70';
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_lj70',false) \g /dev/null
select pode_enviar_foto('user_lj70/vitrine/banner-1.webp') as pode_no_slim, pode_enviar_foto('user_lj71/vitrine/banner-1.webp') as pasta_alheia,
       pode_enviar_foto('user_lj70/vitrine/../x.webp') as com_ponto_ponto;
\echo '[5a] ERRO ESPERADO: foto de outro site'
update vitrines_lojas set banner_tipo = 'foto', banner_url = 'https://evil.example/storage/v1/object/public/anuncios/user_lj70/vitrine/b.webp' where id = :'v70';
\echo '[5b] ERRO ESPERADO: foto da pasta de outra loja'
update vitrines_lojas set banner_tipo = 'foto', banner_url = 'https://abc.supabase.co/storage/v1/object/public/anuncios/user_lj71/vitrine/b.webp' where id = :'v70';
\echo '[5c] ERRO ESPERADO: tipo foto sem foto'
update vitrines_lojas set banner_tipo = 'foto', banner_url = null where id = :'v70';
\echo '[5d] foto certa: aceita'
update vitrines_lojas set banner_tipo = 'foto', banner_url = :'banner70' where id = :'v70' returning banner_tipo, banner_url is not null as tem_foto;

\echo '[6] secoes no Slim (3): 3 passam, a 4a falha; nome repetido e palavra proibida falham'
insert into loja_secoes (vitrine_id, nome) values (:'v70', '  Promoções  ') returning nome, ordem;
insert into loja_secoes (vitrine_id, nome) values (:'v70', 'Linha infantil') returning nome, ordem;
\echo '[6a] ERRO ESPERADO: nome repetido (maiusculas nao contam)'
insert into loja_secoes (vitrine_id, nome) values (:'v70', 'PROMOÇÕES');
\echo '[6b] ERRO ESPERADO: palavra proibida no nome'
insert into loja_secoes (vitrine_id, nome) values (:'v70', 'Maconha boa');
\echo '[6c] ERRO ESPERADO: nome curto'
insert into loja_secoes (vitrine_id, nome) values (:'v70', 'A');
insert into loja_secoes (vitrine_id, nome) values (:'v70', 'Peças') returning nome, ordem;
\echo '[6d] ERRO ESPERADO: 4a secao passa do limite do plano'
insert into loja_secoes (vitrine_id, nome) values (:'v70', 'Lançamentos');
select id as s1 from loja_secoes where vitrine_id=:'v70' and nome='Promoções' \gset
select id as s2 from loja_secoes where vitrine_id=:'v70' and nome='Linha infantil' \gset
select id as s3 from loja_secoes where vitrine_id=:'v70' and nome='Peças' \gset
\echo '[6e] reordenar: Pecas primeiro'
select ordenar_secoes(array[:'s3', :'s1', :'s2']::uuid[]) as reordenadas;
select nome, ordem from loja_secoes where vitrine_id=:'v70' order by ordem;
\echo '[6f] ERRO ESPERADO: secao na loja de outra pessoa (RLS)'
insert into loja_secoes (vitrine_id, nome) values (:'v71', 'Invasão');

\echo '[7] anuncios da loja e produtos das secoes'
insert into anuncios (vitrine_id, categoria_id, titulo, cidade, preco_centavos, atributos, fotos) values
 (:'v70', :'cat_motos',     'Honda Biz 125 2020', 'Corrente', 1200000, '{"marca":"Honda","modelo":"Biz","ano":2020}', :'f70'),
 (:'v70', :'cat_motos',     'Yamaha Factor 150',  'Corrente',  900000, '{"marca":"Yamaha","modelo":"Factor","ano":2018}', :'f70'),
 (:'v70', :'cat_moveis',    'Banco de madeira',   'Corrente',   15000, '{}', :'f70'),
 (:'v70', :'cat_celulares', 'Celular Moto G',     'Corrente',  100000, '{}', :'f70'),
 (:'v70', :'cat_moveis',    'Mesa de centro',     'Corrente',    null, '{}', :'f70');
select id as a1 from anuncios where titulo='Honda Biz 125 2020' \gset
select id as a2 from anuncios where titulo='Yamaha Factor 150' \gset
select id as a3 from anuncios where titulo='Banco de madeira' \gset
select id as a4 from anuncios where titulo='Celular Moto G' \gset
select id as a5 from anuncios where titulo='Mesa de centro' \gset
select set_config('request.jwt.claim.sub','user_lj71',false) \g /dev/null
insert into anuncios (vitrine_id, categoria_id, titulo, cidade, preco_centavos, atributos, fotos) values
 (:'v71', :'cat_moveis', 'Sofa da outra loja', 'Corrente', 50000, '{}', :'f71') returning id as b1 \gset
select set_config('request.jwt.claim.sub','user_lj70',false) \g /dev/null
\echo '[7a] definir produtos da secao (repetido conta uma vez; ordem da lista)'
select definir_anuncios_secao(:'s1', array[:'a2', :'a1', :'a2']::uuid[]) as produtos;
select a.titulo, sa.ordem from loja_secao_anuncios sa join anuncios a on a.id = sa.anuncio_id where sa.secao_id = :'s1' order by sa.ordem;
\echo '[7b] ERRO ESPERADO: anuncio de outra loja na secao'
select definir_anuncios_secao(:'s1', array[:'a1', :'b1']::uuid[]);
select count(*) as continua_igual from loja_secao_anuncios where secao_id = :'s1';
\echo '[7c] ERRO ESPERADO: insercao direta de anuncio de outra loja'
insert into loja_secao_anuncios (secao_id, anuncio_id) values (:'s2', :'b1');
\echo '[7d] outro usuario nao ve nem mexe nas secoes da loja (0 linhas); nao usa a funcao (ERRO ESPERADO)'
select set_config('request.jwt.claim.sub','user_lj71',false) \g /dev/null
select count(*) as secoes_visiveis from loja_secoes where vitrine_id = :'v70';
update loja_secoes set nome = 'Hackeada' where id = :'s1' returning id;
delete from loja_secao_anuncios where secao_id = :'s1' returning anuncio_id;
select definir_anuncios_secao(:'s1', array[:'b1']::uuid[]);
select set_config('request.jwt.claim.sub','user_lj70',false) \g /dev/null
\echo '[7e] limite de produtos por secao (configuracao = 2): o 3o falha (ERRO ESPERADO)'
reset role; update configuracoes set valor='2' where chave='vitrine.anuncios_por_secao_max' and microrregiao_id is null;
set role authenticated;
select definir_anuncios_secao(:'s2', array[:'a3', :'a5', :'a4']::uuid[]);
select definir_anuncios_secao(:'s2', array[:'a3', :'a5']::uuid[]) as dois_cabem;
reset role; update configuracoes set valor='48' where chave='vitrine.anuncios_por_secao_max' and microrregiao_id is null;
set role authenticated;

\echo '[8] fixados no Slim (3): 3 passam, o 4o falha'
select fixar_anuncio(:'a3') as f1, fixar_anuncio(:'a4') as f2, fixar_anuncio(:'a5') as f3, fixar_anuncio(:'a3') as repetido;
\echo '[8a] ERRO ESPERADO: 4o fixado'
select fixar_anuncio(:'a1');
\echo '[8b] ERRO ESPERADO: fixar direto pela tabela tambem esbarra no limite'
update anuncios set fixado_na_loja = 9 where id = :'a2';
\echo '[8c] ERRO ESPERADO: fixar anuncio de outra loja'
select fixar_anuncio(:'b1');
\echo '[8d] reordenar fixados: Mesa primeiro'
select ordenar_fixados(array[:'a5', :'a3', :'a4']::uuid[]) as reordenados;
select titulo, fixado_na_loja from anuncios where vitrine_id = :'v70' and fixado_na_loja is not null order by fixado_na_loja;
\echo '[8e] cadastro com fixado ja preenchido: o banco ignora'
insert into anuncios (vitrine_id, categoria_id, titulo, cidade, preco_centavos, fotos, fixado_na_loja) values
 (:'v70', :'cat_moveis', 'Cadeira de balanço', 'Corrente', 30000, :'f70', 1) returning fixado_na_loja;
\echo '[8f] vendido sai do topo sozinho; a vaga libera'
select marcar_vendido(:'a4', true) as status;
select fixado_na_loja from anuncios where id = :'a4';
select fixar_anuncio(:'a1') as agora_cabe;

\echo '[9] pagina publica (visitante): so campos publicos, banner com foto, secoes do plano'
set role anon; select set_config('request.jwt.claim.role','anon',false), set_config('request.jwt.claim.sub','',false) \g /dev/null
select v->>'nome' as nome, v->>'banner_tipo' as banner, v->>'banner_url' is not null as foto, v->>'whatsapp' as whatsapp,
       v->>'instagram' as instagram, v->'formas_pagamento' as pagamento, (v->>'e_dono')::boolean as e_dono,
       jsonb_array_length(v->'secoes') as secoes, v->>'total_anuncios' as anuncios
  from vitrine_publica('Loja-Setenta') v;
\echo '[9a] nenhum campo interno sai (cnpj, plano, cobranca, motivo de moderacao)'
select count(*) as campos_internos from vitrine_publica('loja-setenta') v, jsonb_object_keys(v) k
 where k in ('cnpj','plano','plano_expira_em','teste_expira_em','gateway_cliente_id','gateway_assinatura_id','banner_moderado_motivo','dono_id');
\echo '[9b] secoes na ordem com os produtos no ar (Pecas vazia, Promocoes com 2)'
select s->>'nome' as secao, jsonb_array_length(s->'anuncios') as produtos from vitrine_publica('loja-setenta') v, jsonb_array_elements(v->'secoes') s;
\echo '[9c] pessoa fisica nao tem vitrine; endereco inexistente tambem nao'
select vitrine_publica(:'slug_pf') is null as pf_sem_pagina, vitrine_publica('nao-existe') is null as inexistente;
\echo '[9d] visitante nao le as tabelas de secoes direto (ERRO ESPERADO: permissao)'
select count(*) from loja_secoes;

\echo '[10] produtos da loja: fixados primeiro e depois os mais novos; menor preco ignora o fixado'
select titulo, fixado, categoria_nome from anuncios_vitrine(:'v70');
select titulo, preco_centavos from anuncios_vitrine(:'v70', 'menor_preco');
\echo '[10a] anuncio vendido ou de outra loja nao aparece; vitrine de pessoa fisica nao lista nada'
select count(*) filter (where titulo = 'Celular Moto G') as vendido, count(*) filter (where titulo like 'Sofa%') as outra_loja from anuncios_vitrine(:'v70');
select count(*) as pf from anuncios_vitrine(:'vpf');

\echo '[11] plano menor (admin muda o Slim para 1 secao e 1 fixado): o resto some da pagina, nada e apagado'
reset role; select set_config('request.jwt.claim.role','',false) \g /dev/null
update planos set vitrine_secoes_max = 1, vitrine_fixados_max = 1 where codigo = 'slim';
set role anon; select set_config('request.jwt.claim.role','anon',false) \g /dev/null
select jsonb_array_length(v->'secoes') as secoes_visiveis, v->'secoes'->0->>'nome' as primeira from vitrine_publica('loja-setenta') v;
select count(*) filter (where fixado is not null) as fixados_visiveis from anuncios_vitrine(:'v70');
reset role;
select count(*) as secoes_guardadas from loja_secoes where vitrine_id = :'v70';
select count(*) as fixados_guardados from anuncios where vitrine_id = :'v70' and fixado_na_loja is not null;
\echo '[11a] esconder a 1a secao mostra a proxima (dono escolhe o que aparece)'
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_lj70',false) \g /dev/null
update loja_secoes set ativa = false where id = :'s3';
set role anon; select set_config('request.jwt.claim.role','anon',false), set_config('request.jwt.claim.sub','',false) \g /dev/null
select v->'secoes'->0->>'nome' as aparece_agora from vitrine_publica('loja-setenta') v;
reset role; update planos set vitrine_secoes_max = 3, vitrine_fixados_max = 3 where codigo = 'slim';
\echo '[11b] plano vencido (volta ao modelo): banner foto guardado mas a pagina mostra o modelo; sem secoes nem fixados'
update vitrines_lojas set plano_expira_em = now() - interval '1 day' where id = :'v70';
set role anon;
select v->>'banner_tipo' as banner, v->>'banner_url' is null as sem_foto, v->>'banner_cor' as cor, jsonb_array_length(v->'secoes') as secoes
  from vitrine_publica('loja-setenta') v;
select count(*) filter (where fixado is not null) as fixados from anuncios_vitrine(:'v70');
reset role; select banner_tipo, banner_url is not null as foto_guardada from vitrines_lojas where id = :'v70';
\echo '[11c] ERRO ESPERADO: com o plano vencido nao cria secao nova'
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_lj70',false) \g /dev/null
insert into loja_secoes (vitrine_id, nome) values (:'v70', 'Nova seção');
\echo '[11d] voltou a pagar: tudo reaparece'
reset role; update vitrines_lojas set plano_expira_em = now() + interval '30 days' where id = :'v70';
set role anon;
select v->>'banner_tipo' as banner, jsonb_array_length(v->'secoes') as secoes from vitrine_publica('loja-setenta') v;

\echo '[12] pessoa fisica: sem secao, sem foto no banner, sem fixado'
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_pf70',false) \g /dev/null
\echo '[12a] ERRO ESPERADO: secao em vitrine de pessoa fisica'
insert into loja_secoes (vitrine_id, nome) values (:'vpf', 'Minhas coisas');
\echo '[12b] ERRO ESPERADO: foto no banner da pessoa fisica'
update vitrines_lojas set banner_tipo = 'foto', banner_url = 'https://abc.supabase.co/storage/v1/object/public/anuncios/user_pf70/vitrine/b.webp' where id = :'vpf';
select pode_enviar_foto('user_pf70/vitrine/b.webp') as pf_envia;
\echo '[12c] ERRO ESPERADO: pessoa fisica nao fixa anuncio'
insert into anuncios (vitrine_id, categoria_id, titulo, cidade, preco_centavos, fotos) values
 (:'vpf', :'cat_moveis', 'Rack de sala usado', 'Corrente', 20000, '{https://abc.supabase.co/storage/v1/object/public/anuncios/user_pf70/x/1.webp}') returning id as p1 \gset
select fixar_anuncio(:'p1');
\echo '[12d] pessoa fisica: endereco exato e localizacao nunca ficam gravados'
update vitrines_lojas set endereco = 'Rua da minha casa, 10', lat = -10.4, lng = -45.1 where id = :'vpf' returning endereco is null as sem_endereco, lat is null as sem_lat;

\echo '[13] loja suspensa: some para o visitante, o dono ainda ve'
reset role; update vitrines_lojas set status = 'suspensa' where id = :'v71';
set role anon; select set_config('request.jwt.claim.role','anon',false), set_config('request.jwt.claim.sub','',false) \g /dev/null
select vitrine_publica('loja-setenta-um') is null as some_para_visitante;
select count(*) as anuncios_visitante from anuncios_vitrine(:'v71');
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_lj71',false) \g /dev/null
select v->>'status' as status, (v->>'e_dono')::boolean as e_dono, v->>'whatsapp' is null as sem_whatsapp from vitrine_publica('loja-setenta-um') v;
reset role; update vitrines_lojas set status = 'ativa' where id = :'v71';

\echo '[14] moderacao do banner: dono nao grava o motivo; admin tira a foto; dono ve o motivo'
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_lj70',false) \g /dev/null
update vitrines_lojas set banner_moderado_motivo = 'eu mesmo', banner_moderado_em = now() where id = :'v70';
reset role; select banner_moderado_motivo is null as motivo_protegido from vitrines_lojas where id = :'v70';
set role authenticated;
\echo '[14a] ERRO ESPERADO: quem nao e admin nao modera'
select moderar_banner_vitrine(:'v70', 'teste');
select set_config('request.jwt.claim.sub','user_ad70',false) \g /dev/null
select moderar_banner_vitrine(:'v70', 'Foto com propaganda de outra empresa');
reset role; select banner_tipo, banner_url is null as sem_foto from vitrines_lojas where id = :'v70';
select acao, usuario_id from logs_atividade where tabela = 'vitrines_lojas' and registro_id = :'v70' and usuario_id = 'user_ad70';
set role authenticated; select set_config('request.jwt.claim.sub','user_lj70',false) \g /dev/null
select banner_moderado_motivo, banner_moderado_em is not null as quando from minha_vitrine_recursos();
\echo '[14b] dono manda foto nova: o aviso de moderacao sai'
update vitrines_lojas set banner_tipo = 'foto', banner_url = 'https://abc.supabase.co/storage/v1/object/public/anuncios/user_lj70/vitrine/banner-2.webp' where id = :'v70';
select banner_moderado_motivo is null as aviso_saiu from minha_vitrine_recursos();
\echo '[14c] admin renomeia uma secao com nome ruim (fica no log)'
select set_config('request.jwt.claim.sub','user_ad70',false) \g /dev/null
update loja_secoes set nome = 'Ofertas' where id = :'s1' returning nome;
reset role; select count(*) as logs_secao from logs_atividade where tabela = 'loja_secoes' and registro_id = :'s1' and usuario_id = 'user_ad70';

\echo '[15] painel: admin muda os limites do plano (fica no log); usuario comum nao muda; so um recomendado'
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_ad70',false) \g /dev/null
update planos set vitrine_fixados_max = 5, vitrine_foto_fachada = true where codigo = 'full' returning codigo, vitrine_fixados_max;
reset role; select acao, usuario_id, dados_depois->>'vitrine_fixados_max' as fixados from logs_atividade where tabela = 'planos' and registro_id = 'full' and usuario_id = 'user_ad70';
set role authenticated; select set_config('request.jwt.claim.sub','user_lj70',false) \g /dev/null
update planos set vitrine_secoes_max = null where codigo = 'teste' returning codigo;
\echo '[15a] marcar o Full como recomendado desmarca o Slim (so um por vez; os dois ficam no log)'
select set_config('request.jwt.claim.sub','user_ad70',false) \g /dev/null
update planos set recomendado = true where codigo = 'full';
select codigo, recomendado from planos where codigo in ('slim','full') order by ordem;
reset role; select registro_id, dados_depois->>'recomendado' as recomendado from logs_atividade
 where tabela = 'planos' and usuario_id = 'user_ad70' and dados_antes->>'recomendado' is distinct from dados_depois->>'recomendado' order by id;
\echo '[15b] ERRO ESPERADO: limite negativo de secoes'
set role authenticated; select set_config('request.jwt.claim.sub','user_ad70',false) \g /dev/null
update planos set vitrine_secoes_max = -1 where codigo = 'full';

\echo '[16] visitante nao usa as funcoes do dono nem grava (ERRO ESPERADO em cada uma: permissao)'
set role anon; select set_config('request.jwt.claim.role','anon',false), set_config('request.jwt.claim.sub','',false) \g /dev/null
select * from minha_vitrine_recursos();
select fixar_anuncio(:'a1');
select definir_anuncios_secao(:'s1', array[:'a1']::uuid[]);
update vitrines_lojas set sobre = 'anon' where id = :'v70';
select moderar_banner_vitrine(:'v70', 'x');

\echo '[17] horarios_validos'
select horarios_validos('{"seg":[{"abre":"00:00","fecha":"24:00"}]}') as dia_todo,
       horarios_validos('{"seg":[{"abre":"8:00","fecha":"12:00"}]}') as sem_zero,
       horarios_validos('{"seg":[{"abre":"08:00","fecha":"12:00","x":1}]}') as campo_a_mais,
       horarios_validos('{"seg":[{"abre":"08:00","fecha":"09:00"},{"abre":"10:00","fecha":"11:00"},{"abre":"12:00","fecha":"13:00"},{"abre":"14:00","fecha":"15:00"}]}') as quatro_faixas,
       horarios_validos('[]') as lista;

\echo '[18] outro usuario nao reordena secoes nem fixados da loja dos outros (0 linhas); fixado nao muda'
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_lj71',false) \g /dev/null
select ordenar_secoes(array[:'s2', :'s1']::uuid[]) as secoes_alheias, ordenar_fixados(array[:'a3']::uuid[]) as fixados_alheios;
update anuncios set fixado_na_loja = null where id = :'a5' returning id;
reset role; select fixado_na_loja is not null as continua_fixado from anuncios where id = :'a5';
\echo '[18a] ERRO ESPERADO: visitante nao usa recursos_vitrine_id'
set role anon; select set_config('request.jwt.claim.role','anon',false), set_config('request.jwt.claim.sub','',false) \g /dev/null
select * from recursos_vitrine_id(:'v70');
\echo '[18b] dono tenta mudar a secao para a loja de outra pessoa: o banco mantem a loja original'
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_lj70',false) \g /dev/null
update loja_secoes set vitrine_id = :'v71' where id = :'s2' returning vitrine_id = :'v70' as mesma_loja;

\echo '[19] moderacao do banner nao se desfaz: a mesma foto nao volta; foto nova tira o aviso'
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_ad70',false) \g /dev/null
select moderar_banner_vitrine(:'v70', 'Foto proibida') like '%/user_lj70/vitrine/banner-2.webp' as devolve_url_para_apagar;
select set_config('request.jwt.claim.sub','user_lj70',false) \g /dev/null
\echo '[19a] ERRO ESPERADO: dono grava de novo a foto que a equipe tirou'
update vitrines_lojas set banner_tipo = 'foto', banner_url = 'https://abc.supabase.co/storage/v1/object/public/anuncios/user_lj70/vitrine/banner-2.webp' where id = :'v70';
select banner_moderado_motivo, banner_moderado_em is not null as aviso_continua from minha_vitrine_recursos();
\echo '[19b] dono tenta apagar a marca da foto tirada (forjado): o banco mantem'
update vitrines_lojas set banner_moderado_url = null where id = :'v70';
reset role; select banner_moderado_url like '%banner-2.webp' as marca_mantida from vitrines_lojas where id = :'v70';
set role anon; select set_config('request.jwt.claim.role','anon',false), set_config('request.jwt.claim.sub','',false) \g /dev/null
select v->>'banner_tipo' as banner_publico, v->>'banner_url' is null as sem_foto, v ? 'banner_moderado_url' as vaza_marca from vitrine_publica('loja-setenta') v;
\echo '[19c] foto nova (outro arquivo): aceita e o aviso sai'
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_lj70',false) \g /dev/null
update vitrines_lojas set banner_tipo = 'foto', banner_url = 'https://abc.supabase.co/storage/v1/object/public/anuncios/user_lj70/vitrine/banner-3.webp' where id = :'v70' returning banner_tipo;
select banner_moderado_motivo is null as aviso_saiu from minha_vitrine_recursos();

\echo '[20] descricao antiga nao passa sem filtro: o banco copia o Sobre nos (filtrado); a pagina so mostra o Sobre nos'
update vitrines_lojas set sobre = 'Motos e peças.', descricao = 'qualquer coisa' where id = :'v70';
reset role; select descricao as copia_do_sobre from vitrines_lojas where id = :'v70';
set role authenticated;
update vitrines_lojas set sobre = null, descricao = 'Aceitamos pix antecipado, maconha' where id = :'v70';
update vitrines_lojas set descricao = 'Aceitamos pix antecipado, maconha' where id = :'v70';
reset role; select descricao is null as descricao_sem_texto_forjado from vitrines_lojas where id = :'v70';
set role anon; select set_config('request.jwt.claim.role','anon',false) \g /dev/null
select vitrine_publica('loja-setenta')->>'sobre' is null as sobre_vazio;
reset role; update vitrines_lojas set descricao = 'Texto antigo do sistema' where id = :'v70';
set role anon; select vitrine_publica('loja-setenta')->>'sobre' is null as descricao_antiga_nao_aparece;

\echo '[21] loja criada direto com cor fora da lista: fica com a 1a cor da lista do painel'
reset role; select set_config('request.jwt.claim.role','',false), set_config('request.jwt.claim.sub','',false) \g /dev/null
insert into perfis (id,microrregiao_id,nome,whatsapp,cidade,tipo_pessoa) values ('user_lj79',:'reg','Lia Lojista','5589999997979','Corrente','pj');
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_lj79',false) \g /dev/null
insert into vitrines_lojas (dono_id, microrregiao_id, slug, nome, cidade, plano, banner_cor)
values ('user_lj79', :'reg', 'loja-setenta-nove', 'Loja 79', 'Corrente', 'teste', '#123456') returning banner_cor;
\echo '[21a] ERRO ESPERADO: depois de criada, trocar para cor fora da lista'
update vitrines_lojas set banner_cor = '#123456' where dono_id = 'user_lj79';

\echo '[22] forma de pagamento que o painel tirou da lista: a loja que ja tinha continua mudando as outras'
reset role; select set_config('request.jwt.claim.role','',false), set_config('request.jwt.claim.sub','',false) \g /dev/null
update vitrines_lojas set formas_pagamento = '{Pix,Crediário}' where id = :'v70';
update configuracoes set valor = '["Pix", "Dinheiro"]' where chave = 'vitrine.formas_pagamento' and microrregiao_id is null;
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_lj70',false) \g /dev/null
update vitrines_lojas set formas_pagamento = '{Pix,crediario,Dinheiro}' where id = :'v70' returning formas_pagamento;
update vitrines_lojas set formas_pagamento = '{Pix}' where id = :'v70' returning formas_pagamento;
\echo '[22a] ERRO ESPERADO: depois de tirar, nao marca de novo a forma que saiu da lista'
update vitrines_lojas set formas_pagamento = '{Pix,Crediário}' where id = :'v70';
reset role; update configuracoes set valor = '["Pix", "Dinheiro", "Cartão de crédito", "Cartão de débito", "Boleto", "Crediário", "Transferência"]'
 where chave = 'vitrine.formas_pagamento' and microrregiao_id is null;

\echo '[23] paginas de produtos (configuracao = 2 por pagina): produtos das secoes vem sempre (na_pagina falso)'
update configuracoes set valor = '2' where chave = 'vitrine.anuncios_por_pagina' and microrregiao_id is null;
set role anon; select set_config('request.jwt.claim.role','anon',false), set_config('request.jwt.claim.sub','',false) \g /dev/null
select titulo, na_pagina from anuncios_vitrine(:'v70', 'menor_preco', 1);
select titulo, na_pagina from anuncios_vitrine(:'v70', 'menor_preco', 2);
select count(*) filter (where na_pagina) as na_pagina_3 from anuncios_vitrine(:'v70', 'menor_preco', 3);
reset role; update configuracoes set valor = '120' where chave = 'vitrine.anuncios_por_pagina' and microrregiao_id is null;

\echo '[24] anuncio que vai para analise sai do topo e libera a vaga (tela e banco contam igual)'
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_lj70',false) \g /dev/null
select fixados_total as antes from minha_vitrine_recursos();
reset role; update anuncios set status = 'em_analise' where id = :'a1';
select fixado_na_loja is null as saiu_do_topo from anuncios where id = :'a1';
set role authenticated;
select fixados_total as depois from minha_vitrine_recursos();
select fixar_anuncio(:'a2') is not null as vaga_liberada;
