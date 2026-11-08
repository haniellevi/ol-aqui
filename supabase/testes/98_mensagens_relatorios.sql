\set ON_ERROR_STOP 0
\set QUIET on
\pset footer off
-- Mensagens automáticas (tela 13) e relatórios (tela 15) · migração 20261108060000_mensagens_relatorios.sql.
-- Cada bloco [n] diz o que deve acontecer. "ERRO esperado" = a linha ERROR logo abaixo é o certo.
-- Os relatórios usam uma região só deste teste (teste-98), para os números não dependerem dos outros arquivos.

-- Preparação (como o sistema)
reset role; select set_config('request.jwt.claim.role','',false), set_config('request.jwt.claim.sub','',false), set_config('request.headers','',false) \g /dev/null
insert into microrregioes (slug, nome, cidade_sede) values ('teste-98', 'Região Noventa e Oito', 'Vila Noventa') returning id as reg \gset
insert into cidades (microrregiao_id, nome, uf) values (:'reg', 'Vila Noventa', 'PI'), (:'reg', 'Serra Oito', 'PI');
insert into perfis (id,microrregiao_id,nome,whatsapp,cidade,tipo_pessoa) values
 ('user_lj98',:'reg','Ana Lojista Noventa','5589999999801','Vila Noventa','pj'),
 ('user_l298',:'reg','Bruno Segunda Loja','5589999999802','Vila Noventa','pj'),
 ('user_l398',:'reg','Carla Terceira Loja','5589999999803','Serra Oito','pj'),
 ('user_co98',:'reg','Davi Comprador','5589999999804','Vila Noventa','pf'),
 ('user_ad98',:'reg','Edu Admin Noventa','5589999999805','Vila Noventa','pf');
update perfis set e_admin=true where id='user_ad98';
update configuracoes set valor='"https://abc.supabase.co"' where chave='fotos.origem' and microrregiao_id is null;
update configuracoes set valor='1' where chave='anuncio.fotos_minimo' and microrregiao_id is null;
select id as cat_moveis from categorias where slug='moveis' \gset
select id as cat_motos from categorias where slug='motos' \gset
select id as cat_veiculos from categorias where slug='veiculos' \gset
\set foto '{https://abc.supabase.co/storage/v1/object/public/anuncios/user_lj98/x/1.webp}'

set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_lj98',false) \g /dev/null
select tipo from quero_vender('loja', 'Loja Noventa e Oito', 'loja-noventa-e-oito', '89999999801') \g /dev/null
select id as vit1 from vitrines_lojas where dono_id='user_lj98' \gset
insert into anuncios (vitrine_id, categoria_id, titulo, cidade, preco_centavos, atributos, fotos)
values (:'vit1', :'cat_moveis', 'Mesa noventa e oito grande', 'Vila Noventa', 30000, '{}', :'foto') returning id as a1 \gset
insert into anuncios (vitrine_id, categoria_id, titulo, cidade, preco_centavos, atributos, fotos)
values (:'vit1', :'cat_moveis', 'Cadeira noventa e oito', 'Serra Oito', 9000, '{}', :'foto') returning id as a2 \gset
insert into anuncios (vitrine_id, categoria_id, titulo, cidade, preco_centavos, atributos, fotos)
values (:'vit1', :'cat_moveis', 'Sofa noventa e oito vendido', 'Vila Noventa', 50000, '{}', :'foto') returning id as a3 \gset
select marcar_vendido(:'a3', true) as vendeu;
select set_config('request.jwt.claim.sub','user_l298',false) \g /dev/null
select tipo from quero_vender('loja', 'Loja Noventa Dois', 'loja-noventa-dois', '89999999802') \g /dev/null
select id as vit2 from vitrines_lojas where dono_id='user_l298' \gset
select set_config('request.jwt.claim.sub','user_l398',false) \g /dev/null
select tipo from quero_vender('loja', 'Loja Noventa Tres', 'loja-noventa-tres', '89999999803') \g /dev/null
select id as vit3 from vitrines_lojas where dono_id='user_l398' \gset
reset role; select set_config('request.jwt.claim.role','',false), set_config('request.jwt.claim.sub','',false) \g /dev/null

\echo '[1] semente: 19 modelos (aviso no site, WhatsApp e e-mail), todos ligados; textos do Radar iguais aos de antes; configuracao nova; chaves antigas avisam onde editar'
select chave, canal, ativo, titulo is not null as tem_titulo, variaveis from modelos_mensagem order by ordem;
select count(*) as radar_iguais_ao_painel_antigo
  from modelos_mensagem m join configuracoes c on c.microrregiao_id is null
   and ((c.chave = 'radar.aviso.' || m.chave || '.texto' and c.valor #>> '{}' = m.texto)
     or (c.chave = 'radar.aviso.' || m.chave || '.titulo' and c.valor #>> '{}' = m.titulo))
 where m.canal = 'notificacao';
select chave, valor, grupo from configuracoes where chave = 'mensagens.vencido_dias_max';
select count(*) as chaves_antigas_avisando from configuracoes where chave like 'radar.aviso.%' and descricao like 'Texto geral: edite em Painel%';

\echo '[2] visitante nao le modelos (ERRO esperado: permission denied); usuario comum le 0 e nao muda nada (0 linhas); nao cria nem apaga (2 ERROS esperados: permission denied)'
set role anon; select set_config('request.jwt.claim.role','anon',false), set_config('request.jwt.claim.sub','',false) \g /dev/null
select count(*) from modelos_mensagem;
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_co98',false) \g /dev/null
select count(*) as comum_ve from modelos_mensagem;
with x as (update modelos_mensagem set texto='Golpe {nome}' where chave='plano_vencendo' returning 1) select count(*) as comum_mudou from x;
insert into modelos_mensagem (chave, canal, nome, quando, titulo, texto, texto_padrao) values ('golpe', 'notificacao', 'Golpe', 'sempre', 'Ganhou', 'Clique', 'Clique');
delete from modelos_mensagem where chave='plano_vencendo';

\echo '[3] admin muda texto e desliga (fica no log com quem foi); atualizado_por vem do token'
select set_config('request.jwt.claim.sub','user_ad98',false) \g /dev/null
update modelos_mensagem set titulo='  Proposta nova!  ', texto='  {loja} quer vender “{pedido}” por {preco}.  ' where chave='proposta_nova' and canal='notificacao';
update modelos_mensagem set ativo=false where chave='pedido_novo' and canal='notificacao';
select chave, titulo, texto, ativo, atualizado_por from modelos_mensagem where canal='notificacao' and chave in ('proposta_nova','pedido_novo') order by chave;
reset role;
select count(*) as logs_do_admin from logs_atividade where tabela='modelos_mensagem' and usuario_id='user_ad98' and acao='UPDATE';
select dados_antes->>'texto' as texto_antigo from logs_atividade where tabela='modelos_mensagem' and usuario_id='user_ad98'
 and dados_depois->>'chave'='proposta_nova' order by id limit 1;

\echo '[4] variavel desconhecida, chave sem par, texto grande e titulo vazio sao recusados (5 ERROS esperados); WhatsApp nao guarda titulo'
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_ad98',false) \g /dev/null
update modelos_mensagem set texto='Olá {nome}, seu telefone {telefone} e {cpf}' where chave='plano_vencendo' and canal='notificacao';
update modelos_mensagem set texto='Olá {nome, seu plano venceu' where chave='plano_vencido' and canal='notificacao';
update modelos_mensagem set titulo='Assunto {senha}' where chave='plano_vencido' and canal='email';
update modelos_mensagem set texto=repeat('a', 501) where chave='plano_vencendo' and canal='notificacao';
update modelos_mensagem set titulo='   ' where chave='plano_vencendo' and canal='notificacao';
update modelos_mensagem set titulo='Titulo no WhatsApp' where chave='plano_vencendo' and canal='whatsapp';
select texto, titulo is null as sem_titulo from modelos_mensagem where chave in ('plano_vencendo','plano_vencido') and canal='notificacao' order by chave;
select titulo is null as whatsapp_sem_titulo from modelos_mensagem where chave='plano_vencendo' and canal='whatsapp';

\echo '[5] admin nao muda colunas fixas nem forja quem mudou (3 ERROS esperados: permission denied)'
update modelos_mensagem set chave='outra' where chave='plano_vencendo' and canal='notificacao';
update modelos_mensagem set variaveis=array['telefone'] where chave='plano_vencendo' and canal='notificacao';
update modelos_mensagem set atualizado_por='user_co98' where chave='plano_vencendo' and canal='notificacao';

\echo '[6] Radar usa o texto da tela 13 (proposta nova); modelo desligado nao avisa; avisos_ligados continua valendo'
reset role; select set_config('request.jwt.claim.role','',false), set_config('request.jwt.claim.sub','',false) \g /dev/null
select radar_aviso('user_co98', 'proposta_nova', :'reg', '{"loja": "Loja Noventa", "pedido": "Bicicleta aro 29", "preco": "R$ 900"}', '/radar/pedido/x98', 'teste98:proposta') as avisou;
select radar_aviso('user_lj98', 'pedido_novo', :'reg', '{"cidade": "Vila Noventa", "pedido": "Bicicleta aro 29", "preco": "Até R$ 1.000."}', '/radar/x98', 'teste98:pedido') as pedido_novo_desligado;
select tipo, titulo, texto, link from notificacoes where chave like 'teste98:%' order by chave;
insert into configuracoes (chave, microrregiao_id, valor, grupo) values ('radar.avisos_ligados', :'reg', '["pedido_novo"]', 'radar');
select radar_aviso('user_co98', 'proposta_nova', :'reg', '{"loja": "Loja", "pedido": "Outra coisa", "preco": ""}', '/radar/pedido/y98', 'teste98:proposta2') as desligado_no_radar;
delete from configuracoes where chave='radar.avisos_ligados' and microrregiao_id = :'reg';

\echo '[6b] excecao por regiao em configuracoes (radar.aviso.*) continua valendo por cima do texto geral; outra regiao usa o texto geral'
insert into configuracoes (chave, microrregiao_id, valor, grupo) values
  ('radar.aviso.proposta_escolhida.texto', :'reg', '"TEXTO REGIONAL {pedido}"', 'radar'),
  ('radar.aviso.proposta_escolhida.titulo', :'reg', '"   "', 'radar');
select radar_aviso('user_lj98', 'proposta_escolhida', :'reg', '{"pedido": "Bicicleta", "loja": "Loja"}', '/x', 'teste98r:regiao') as avisou_regiao;
select radar_aviso('user_lj98', 'proposta_escolhida', gen_random_uuid(), '{"pedido": "Bicicleta", "loja": "Loja"}', '/x', 'teste98r:geral') as avisou_geral;
select chave, titulo, texto from notificacoes where chave like 'teste98r:%' order by chave;
delete from configuracoes where chave like 'radar.aviso.proposta_escolhida.%' and microrregiao_id = :'reg';

\echo '[7] pagamento confirmado: aviso com valor e o plano; repetir nao duplica'
insert into pagamentos (vitrine_id, microrregiao_id, tipo, plano_codigo, valor_centavos, status)
values (:'vit2', :'reg', 'assinatura', 'slim', 4990, 'pendente') returning id as pg_slim \gset
update pagamentos set status='pago', pago_em=now() where id=:'pg_slim';
update pagamentos set status='pago' where id=:'pg_slim';
select usuario_id, tipo, titulo, texto, link from notificacoes where chave = 'pagamento_confirmado:' || :'pg_slim';
insert into pagamentos (vitrine_id, microrregiao_id, tipo, anuncio_id, valor_centavos, status, pago_em)
values (:'vit1', :'reg', 'anuncio_avulso', :'a1', 990, 'pago', now()) returning id as pg_avulso \gset
select texto from notificacoes where chave = 'pagamento_confirmado:' || :'pg_avulso';

\echo '[8] destaque acabou: aviso com visualizacoes e cliques do periodo'
insert into destaques (tipo, anuncio_id, vitrine_id, microrregiao_id, origem, status, inicio, fim, dias)
values ('busca', :'a1', :'vit1', :'reg', 'cortesia', 'ativo', now() - interval '7 days', now() - interval '1 minute', 7) returning id as dest \gset
insert into eventos_anuncio (anuncio_id, tipo, criado_em) values
 (:'a1', 'visualizacao', now() - interval '2 days'), (:'a1', 'visualizacao', now() - interval '1 day'),
 (:'a1', 'clique_whatsapp', now() - interval '1 day'), (:'a1', 'visualizacao', now() - interval '10 days');
select expirar_destaques() >= 1 as encerrou;
select usuario_id, titulo, texto, link = '/destacar/' || :'a1' as link_certo from notificacoes where chave = 'destaque_acabou:' || :'dest';

\echo '[9] plano vencendo (teste acaba em 2 dias) e vencido (Slim acabou ontem); vencido ha 10 dias nao avisa; rodar de novo nao repete'
update vitrines_lojas set teste_expira_em = now() + interval '2 days' where id=:'vit1';
update vitrines_lojas set plano='slim', plano_expira_em = now() - interval '1 day' where id=:'vit2';
update vitrines_lojas set plano='slim', plano_expira_em = now() - interval '10 days' where id=:'vit3';
set role service_role; select set_config('request.jwt.claim.role','service_role',false) \g /dev/null
select mensagens_avisar_planos() >= 2 as avisou;
select mensagens_avisar_planos() as de_novo;
reset role; select set_config('request.jwt.claim.role','',false) \g /dev/null
select usuario_id, tipo, titulo, texto, link from notificacoes where usuario_id in ('user_lj98','user_l298','user_l398') and tipo in ('plano_vencendo','plano_vencido') order by usuario_id;

\echo '[10] pessoa comum nao roda a rotina nem manda aviso (2 ERROS esperados: permission denied); modelo desligado nao grava'
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_co98',false) \g /dev/null
select mensagens_avisar_planos();
select mensagem_aviso('user_co98', 'pagamento_confirmado', '{}', null, 'golpe98');
reset role; select set_config('request.jwt.claim.role','',false), set_config('request.jwt.claim.sub','',false) \g /dev/null
update modelos_mensagem set ativo=false where chave='pagamento_confirmado' and canal='notificacao';
insert into pagamentos (vitrine_id, microrregiao_id, tipo, valor_centavos, status, pago_em)
values (:'vit3', :'reg', 'destaque', 1490, 'pago', now()) returning id as pg_dest \gset
select count(*) as aviso_com_modelo_desligado from notificacoes where chave = 'pagamento_confirmado:' || :'pg_dest';
update modelos_mensagem set ativo=true where chave='pagamento_confirmado' and canal='notificacao';

\echo '[11] relatorios: visitante (5 ERROS esperados: permission denied) e pessoa comum (ERRO esperado: So a equipe) nao leem'
insert into eventos_anuncio (anuncio_id, tipo, criado_em) values (:'a2', 'visualizacao', now()), (:'a2', 'compartilhar', now());
insert into pagamentos (vitrine_id, microrregiao_id, tipo, valor_centavos, status) values (:'vit3', :'reg', 'destaque', 3990, 'pendente');
insert into pagamentos (vitrine_id, microrregiao_id, tipo, valor_centavos, status, pago_em) values (:'vit3', :'reg', 'destaque', 7777, 'estornado', now());
insert into robo_uso (usuario_id, microrregiao_id, conversa_ref, tipo, provedor, modelo, custo_centavos, erro) values
 ('user_co98', :'reg', '00000000-0000-0000-0000-000000000981', 'conversa', 'x', 'y', 1.5, null),
 ('user_co98', :'reg', '00000000-0000-0000-0000-000000000981', 'conversa', 'x', 'y', 2.25, null),
 ('user_co98', :'reg', '00000000-0000-0000-0000-000000000982', 'foto', 'x', 'y', 0, 'falhou');
-- loja que começou mês passado e terminou o teste sem pagar
update vitrines_lojas set criado_em = now() - interval '40 days', teste_expira_em = now() - interval '10 days' where id=:'vit3';
update vitrines_lojas set plano='teste' where id=:'vit3';
set role anon; select set_config('request.jwt.claim.role','anon',false), set_config('request.jwt.claim.sub','',false) \g /dev/null
select * from relatorio_funil(null, null, :'reg');
select * from relatorio_anuncios(null, null, :'reg');
select * from relatorio_conversao_teste(null, null, :'reg');
select * from relatorio_receita(null, null, :'reg');
select * from relatorio_custo_aki(null, null, :'reg');
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_co98',false) \g /dev/null
select * from relatorio_funil(null, null, :'reg');

\echo '[12] admin: funil (4 visualizacoes nos ultimos 60 dias, 1 clique, 1 compartilhar, 1 vendido pelo OLAKI)'
select set_config('request.jwt.claim.sub','user_ad98',false) \g /dev/null
select (now() at time zone 'America/Fortaleza')::date - 59 as de60, (now() at time zone 'America/Fortaleza')::date as hoje \gset
select * from relatorio_funil(:'de60', :'hoje', :'reg');
\echo '[12b] periodo padrao (ultimos 30 dias) tambem tem as 4; so hoje: 1 visualizacao e 1 compartilhar'
select visualizacoes, compartilhamentos from relatorio_funil(null, null, :'reg');
select visualizacoes, compartilhamentos from relatorio_funil(:'hoje', :'hoje', :'reg');

\echo '[13] admin: anuncios por categoria e cidade (2 no ar; 3 publicados no periodo)'
select categoria, cidade, no_ar, publicados from relatorio_anuncios(:'de60', :'hoje', :'reg');

\echo '[14] admin: teste gratis -> plano pago (mes passado: 1 sem pagar; este mes: 2 lojas, 1 pagou, 1 em teste)'
select mes = date_trunc('month', now() at time zone 'America/Fortaleza')::date as este_mes, comecaram, pagaram, em_teste, nao_pagaram
  from relatorio_conversao_teste(:'de60', :'hoje', :'reg') order by mes;

\echo '[15] admin: receita paga por tipo (plano 4990, avulso 990, destaque 1490; pendente e devolvido nao contam)'
select tipo, quantidade, total_centavos from relatorio_receita(:'de60', :'hoje', :'reg') order by tipo;

\echo '[16] admin: custo do Aki (3 respostas, 2 conversas, 1 erro, 3,75 centavos)'
select respostas, conversas, erros, custo_centavos from relatorio_custo_aki(:'de60', :'hoje', :'reg');

\echo '[17] periodo invertido e mais de 12 meses sao recusados (2 ERROS esperados); 12 meses certinhos passa; outra regiao nao mistura'
select * from relatorio_funil(:'hoje', :'de60', :'reg');
select * from relatorio_receita((:'hoje')::date - 400, :'hoje', :'reg');
select count(*) as linhas_12_meses from relatorio_receita((:'hoje')::date - 365, :'hoje', :'reg');
select visualizacoes from relatorio_funil(:'de60', :'hoje', (select id from microrregioes where slug='outra-50'));

\echo '[18] permissoes das funcoes: relatorios so para logado (a funcao confere admin), internas fechadas, gatilhos fora da API'
reset role;
select p.proname,
       has_function_privilege('anon', p.oid, 'execute') as anon,
       has_function_privilege('authenticated', p.oid, 'execute') as logado,
       p.prosecdef as definer,
       exists (select 1 from unnest(p.proconfig) c where c = 'search_path=public, extensions') as search_path_fixo
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('relatorio_funil','relatorio_anuncios','relatorio_conversao_teste','relatorio_receita','relatorio_custo_aki',
                     'relatorio_periodo','mensagem_aviso','mensagem_montar','mensagem_variaveis_invalidas','mensagem_primeiro_nome',
                     'mensagens_avisar_planos','radar_aviso','mensagens_destaque_acabou','mensagens_pagamento_confirmado','proteger_modelo_mensagem')
 order by p.proname;
select relrowsecurity as rls_ligada from pg_class where oid = 'public.modelos_mensagem'::regclass;
