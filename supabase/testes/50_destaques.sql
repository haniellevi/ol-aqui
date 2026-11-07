\set ON_ERROR_STOP 0
\set QUIET on
\pset footer off
-- Destaques pagos (migração 20261107030000_destaques.sql).
-- Cada bloco [n] diz o que deve acontecer. "ERRO esperado" = a linha ERROR logo abaixo é o certo.

-- Preparação (como o sistema)
reset role; select set_config('request.jwt.claim.role','',false), set_config('request.jwt.claim.sub','',false), set_config('request.headers','',false) \g /dev/null
select id as reg from microrregioes where slug='corrente-pi' \gset
insert into microrregioes (slug, nome, cidade_sede) values ('outra-50', 'Outra região 50', 'Longe') returning id as reg_outra \gset
insert into perfis (id,microrregiao_id,nome,whatsapp,cidade,tipo_pessoa) values
 ('user_pf50',:'reg','Bia Vendedora','5589999995050','Corrente','pf'),
 ('user_lj50',:'reg','Caio Lojista','5589999995151','Corrente','pj'),
 ('user_ou50',:'reg','Outro Cinquenta','5589999995252','Corrente','pf'),
 ('user_ad50',:'reg','Admin Cinquenta','5589999995353','Corrente','pf');
update perfis set whatsapp_verificado_em=now() where id in ('user_pf50','user_lj50');
update perfis set e_admin=true where id='user_ad50';
update configuracoes set valor='"https://abc.supabase.co"' where chave='fotos.origem' and microrregiao_id is null;
update configuracoes set valor='1' where chave='anuncio.fotos_minimo' and microrregiao_id is null;
select id as cat_moveis from categorias where slug='moveis' \gset
\set foto_pf '{https://abc.supabase.co/storage/v1/object/public/anuncios/user_pf50/x/1.webp}'
\set foto_lj '{https://abc.supabase.co/storage/v1/object/public/anuncios/user_lj50/x/1.webp}'

set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_pf50',false) \g /dev/null
select tipo from quero_vender('pf') \g /dev/null
select id as vit_pf from vitrines_lojas where dono_id='user_pf50' \gset
insert into anuncios (vitrine_id, categoria_id, titulo, cidade, preco_centavos, atributos, fotos)
values (:'vit_pf', :'cat_moveis', 'Mesa zeta50 de madeira', 'Corrente', 30000, '{}', :'foto_pf') returning id as a_pf \gset
select set_config('request.jwt.claim.sub','user_lj50',false) \g /dev/null
select tipo from quero_vender('loja', 'Loja Zeta 50', 'loja-zeta-50', '89999995151') \g /dev/null
select id as vit_lj from vitrines_lojas where dono_id='user_lj50' \gset
insert into anuncios (vitrine_id, categoria_id, titulo, cidade, preco_centavos, atributos, fotos)
values (:'vit_lj', :'cat_moveis', 'Cadeira zeta50 antiga', 'Corrente', 10000, '{}', :'foto_lj') returning id as l1 \gset
insert into anuncios (vitrine_id, categoria_id, titulo, cidade, preco_centavos, atributos, fotos)
values (:'vit_lj', :'cat_moveis', 'Armario zeta50 do meio', 'Corrente', 20000, '{}', :'foto_lj') returning id as l2 \gset
insert into anuncios (vitrine_id, categoria_id, titulo, cidade, preco_centavos, atributos, fotos)
values (:'vit_lj', :'cat_moveis', 'Sofazinho zeta50 novo', 'Corrente', 25000, '{}', :'foto_lj') returning id as l3 \gset
reset role; select set_config('request.jwt.claim.role','',false), set_config('request.jwt.claim.sub','',false) \g /dev/null
-- datas de publicação diferentes para a ordem "recentes" (l1 é o mais antigo)
update anuncios set publicado_em = now() - interval '3 days' where id=:'l1';
update anuncios set publicado_em = now() - interval '2 days' where id=:'l2';
update anuncios set publicado_em = now() - interval '1 day'  where id=:'l3';
update anuncios set publicado_em = now() - interval '4 days' where id=:'a_pf';

\echo '[1] semente: 4 tipos; "busca" herdou preco 1490 e 7 dias; configuracoes antigas sairam; Full ganha 4 Subir'
select slug, preco_centavos, dias, vagas_por_regiao, alvo, ativo from destaque_tipos order by ordem;
select count(*) as configs_antigas from configuracoes where chave in ('destaque.preco_centavos','destaque.dias');
select plano_codigo, tipo, quantidade_mes from destaque_creditos_plano order by plano_codigo;
select chave, valor from configuracoes where chave like 'destaque.%' or chave = 'cobranca.vencimento_dias' order by chave;

\echo '[2] visitante le os tipos ativos; nao le destaques (ERRO esperado: permission denied)'
set role anon; select set_config('request.jwt.claim.role','anon',false), set_config('request.jwt.claim.sub','',false) \g /dev/null
select count(*) as tipos_visiveis from destaque_tipos;
select count(*) from destaques;

\echo '[3] usuario comum nao muda preco do tipo (RLS: nada muda)'
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_ou50',false) \g /dev/null
update destaque_tipos set preco_centavos=1 where slug='busca';
select preco_centavos as preco_busca from destaque_tipos where slug='busca';

\echo '[4] usuario nao cria destaque direto (ERRO esperado: permission denied)'
insert into destaques (tipo, anuncio_id, vitrine_id, microrregiao_id, origem, status, inicio, fim)
values ('busca', :'a_pf', :'vit_pf', :'reg', 'cortesia', 'ativo', now(), now() + interval '30 days');

\echo '[5] opcoes do anuncio da PF: subir, busca e home; sem creditos; 8 vagas na home'
select set_config('request.jwt.claim.sub','user_pf50',false) \g /dev/null
select slug, preco_centavos, dias, vagas_livres, creditos_restantes, disponivel, motivo from opcoes_destaque(:'a_pf');
\echo '[5b] opcoes da loja sem anuncio: so "loja" e indisponivel para PF'
select slug, disponivel, motivo from opcoes_destaque(null);
\echo '[5c] opcoes de anuncio alheio: nada'
select count(*) as alheio from opcoes_destaque(:'l1');

\echo '[6] contratar "busca" pago: pedido esperando pagamento + pagamento pendente; repetir devolve o mesmo'
select status, origem, preco_centavos, pagamento_id is not null as tem_pagamento, reservado_ate > now() as reservado
  from contratar_destaque('busca', :'a_pf');
select destaque_id as d_busca, pagamento_id as pg_busca from contratar_destaque('busca', :'a_pf') \gset
select count(*) as pedidos_busca from destaques where anuncio_id=:'a_pf' and tipo='busca';
select tipo, valor_centavos, status, anuncio_id = :'a_pf' as do_anuncio from pagamentos where id=:'pg_busca';

\echo '[7] vendedor nao confirma o proprio pagamento (ERRO esperado: permission denied) nem muda o pagamento'
select confirmar_pagamento('qualquer');
update pagamentos set status='pago' where id=:'pg_busca';
select status as pagamento_continua from pagamentos where id=:'pg_busca';
\echo '[7b] nem grava id do Asaas (ERRO esperado: permission denied)'
select registrar_cobranca_asaas(:'pg_busca', 'pay_forjado', null, 'pix');

\echo '[8] servidor grava a cobranca e o Asaas confirma: destaque ativo, destaque_ate +7 dias; aviso repetido nao soma'
set role service_role; select set_config('request.jwt.claim.role','service_role',false), set_config('request.jwt.claim.sub','',false) \g /dev/null
select registrar_cobranca_asaas(:'pg_busca', 'pay_50_busca', 'https://sandbox.asaas.com/i/x', 'pix') as gravou;
\echo '[8a] segunda cobranca para o mesmo pagamento nao substitui a primeira (false); a mesma de novo pode (troca a forma)'
select registrar_cobranca_asaas(:'pg_busca', 'pay_50_duplicada', null, 'pix') as gravou_outra,
       registrar_cobranca_asaas(:'pg_busca', 'pay_50_busca', 'https://sandbox.asaas.com/i/x', 'cartao') as mesma_de_novo;
select asaas_cobranca_id, forma from pagamentos where id=:'pg_busca';
select confirmar_pagamento('pay_50_busca', '{"event":"PAYMENT_RECEIVED","payment":{"id":"pay_50_busca","billingType":"PIX"}}');
select status, origem, fim > now() + interval '6 days' as sete_dias from destaques where id=:'d_busca';
select destaque_ate as ate1 from anuncios where id=:'a_pf' \gset
select confirmar_pagamento('pay_50_busca');
select destaque_ate = :'ate1' as nao_somou, (select status from pagamentos where id=:'pg_busca') as pagamento, (select forma from pagamentos where id=:'pg_busca') as forma from anuncios where id=:'a_pf';

\echo '[9] busca: destaque pago vem primeiro e com "destaque"'
set role anon; select set_config('request.jwt.claim.role','anon',false) \g /dev/null
select titulo, destaque from buscar_anuncios(q => 'zeta50', ordem => 'recentes');

\echo '[10] outro usuario nao destaca anuncio alheio (ERRO esperado: Anuncio nao encontrado); visitante nao contrata (ERRO esperado: permission denied)'
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_lj50',false) \g /dev/null
select * from contratar_destaque('busca', :'a_pf');
set role anon; select set_config('request.jwt.claim.role','anon',false), set_config('request.jwt.claim.sub','',false) \g /dev/null
select * from contratar_destaque('busca', :'a_pf');

\echo '[11] credito sem ter credito (ERRO esperado: nao tem mais creditos)'
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_lj50',false) \g /dev/null
select * from contratar_destaque('subir', :'l1', true);
\echo '[11b] loja no Full: 4 Subir gratis; subir com credito ativa na hora e o anuncio mais antigo vai para o topo dos recentes'
reset role; update vitrines_lojas set plano='full', plano_expira_em=now() + interval '30 days' where id=:'vit_lj';
set role authenticated;
select slug, creditos_restantes from opcoes_destaque(:'l1') where slug='subir';
select status, origem, preco_centavos, pagamento_id is null as sem_pagamento from contratar_destaque('subir', :'l1', true);
select subido_em is not null as subiu from anuncios where id=:'l1';
set role anon; select set_config('request.jwt.claim.role','anon',false), set_config('request.jwt.claim.sub','',false) \g /dev/null
select titulo, destaque from buscar_anuncios(q => 'zeta50', ordem => 'recentes');
\echo '[11c] subir de novo logo em seguida (ERRO esperado: ja subiu ha pouco); outro anuncio sobe; sobram 2 creditos'
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_lj50',false) \g /dev/null
select * from contratar_destaque('subir', :'l1', true);
select status from contratar_destaque('subir', :'l2', true);
select slug, creditos_restantes, disponivel, motivo is not null as tem_motivo from opcoes_destaque(:'l1') where slug='subir';

\echo '[12] vagas: admin poe 1 vaga na home (fica no log); a loja reserva; a PF nao consegue (ERRO esperado: vagas ocupadas)'
select set_config('request.jwt.claim.sub','user_ad50',false) \g /dev/null
update destaque_tipos set vagas_por_regiao=1, atualizado_por='user_ad50' where slug='home';
reset role; select count(*) as log_tipo from logs_atividade where tabela='destaque_tipos' and acao='UPDATE' and usuario_id='user_ad50';
set role authenticated; select set_config('request.jwt.claim.sub','user_lj50',false) \g /dev/null
select destaque_id as d_home_lj, pagamento_id as pg_home_lj from contratar_destaque('home', :'l2') \gset
select set_config('request.jwt.claim.sub','user_pf50',false) \g /dev/null
select * from contratar_destaque('home', :'a_pf');
select slug, vagas_livres, disponivel from opcoes_destaque(:'a_pf') where slug='home';
\echo '[12b] a reserva da loja venceu sem pagar: a vaga volta e a PF reserva'
reset role; update destaques set reservado_ate = now() - interval '1 minute' where id=:'d_home_lj';
set role authenticated;
select destaque_id as d_home_pf, pagamento_id as pg_home_pf from contratar_destaque('home', :'a_pf') \gset
select status from destaques where id=:'d_home_pf';
\echo '[12c] dinheiro da PF chega: ativa. Pagamento atrasado da loja tambem ativa (quem pagou nunca fica sem): 2 na home'
set role service_role; select set_config('request.jwt.claim.role','service_role',false), set_config('request.jwt.claim.sub','',false) \g /dev/null
select registrar_cobranca_asaas(:'pg_home_pf', 'pay_50_home_pf', null, 'pix') \g /dev/null
select registrar_cobranca_asaas(:'pg_home_lj', 'pay_50_home_lj', null, 'cartao') \g /dev/null
select confirmar_pagamento('pay_50_home_pf') \g /dev/null
select confirmar_pagamento('pay_50_home_lj') \g /dev/null
select count(*) as home_ativos from destaques where tipo='home' and status='ativo' and microrregiao_id=:'reg';
\echo '[12d] corrida: duas reservas ao mesmo tempo passam pela mesma trava (pg_advisory_xact_lock por tipo+regiao)'
select count(*) as funcoes_com_trava from pg_proc where proname in ('contratar_destaque','conceder_destaque_cortesia') and prosrc like '%pg_advisory_xact_lock%';

\echo '[13] pagina inicial: visitante ve os 2 da home (destaque=true); outra regiao vazia'
set role anon; select set_config('request.jwt.claim.role','anon',false) \g /dev/null
select titulo, destaque, total from destaques_home(:'reg') order by titulo;
select count(*) as outra_regiao from destaques_home(:'reg_outra');

\echo '[14] PF nao contrata "Loja em destaque" (ERRO esperado: so para lojas); a loja contrata, paga e aparece'
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_pf50',false) \g /dev/null
select * from contratar_destaque('loja', null);
select set_config('request.jwt.claim.sub','user_lj50',false) \g /dev/null
select * from contratar_destaque('loja', :'l1');
select pagamento_id as pg_loja from contratar_destaque('loja', null) \gset
set role service_role; select set_config('request.jwt.claim.role','service_role',false), set_config('request.jwt.claim.sub','',false) \g /dev/null
select registrar_cobranca_asaas(:'pg_loja', 'pay_50_loja', null, 'pix') \g /dev/null
select confirmar_pagamento('pay_50_loja') \g /dev/null
set role anon; select set_config('request.jwt.claim.role','anon',false) \g /dev/null
select slug, nome from lojas_em_destaque(:'reg');

\echo '[15] cobranca vencida: pedido cancelado; aviso repetido nao muda nada; dinheiro que chega depois ativa assim mesmo'
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_lj50',false) \g /dev/null
select destaque_id as d_l3, pagamento_id as pg_l3 from contratar_destaque('busca', :'l3') \gset
set role service_role; select set_config('request.jwt.claim.role','service_role',false), set_config('request.jwt.claim.sub','',false) \g /dev/null
select registrar_cobranca_asaas(:'pg_l3', 'pay_50_l3', null, 'pix') \g /dev/null
select cancelar_pagamento('pay_50_l3', 'vencido') \g /dev/null
select cancelar_pagamento('pay_50_l3', 'vencido') \g /dev/null
select d.status as destaque, p.status as pagamento, d.motivo from destaques d join pagamentos p on p.id=d.pagamento_id where d.id=:'d_l3';
select confirmar_pagamento('pay_50_l3') \g /dev/null
select d.status as destaque_depois, p.status as pagamento_depois from destaques d join pagamentos p on p.id=d.pagamento_id where d.id=:'d_l3';
\echo '[15b] devolucao (estorno): destaque cancelado e o tempo de destaque sai do anuncio; aviso de pago repetido depois nao reativa'
select cancelar_pagamento('pay_50_busca', 'estornado') \g /dev/null
select d.status, d.motivo, (select destaque_ate < now() + interval '1 minute' from anuncios where id=:'a_pf') as tempo_devolvido
  from destaques d where d.id=:'d_busca';
select confirmar_pagamento('pay_50_busca') \g /dev/null
select status as continua_cancelado, (select status from pagamentos where id=:'pg_busca') as pagamento from destaques where id=:'d_busca';
\echo '[15c] status desconhecido (ERRO esperado: situacao invalida)'
select cancelar_pagamento('pay_50_l3', 'pago');

\echo '[16] resultado: visualizacoes e cliques na janela do destaque; so o dono ve; admin ve tudo pedindo'
select registrar_evento(:'a_pf','visualizacao','177.5.0.1',null) as v1, registrar_evento(:'a_pf','visualizacao','177.5.0.2',null) as v2,
       registrar_evento(:'a_pf','clique_whatsapp','177.5.0.1',null) as c1 \g /dev/null
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_pf50',false) \g /dev/null
select tipo, status, visualizacoes, cliques_whatsapp from resultados_destaques(:'a_pf') order by tipo;
select set_config('request.jwt.claim.sub','user_ou50',false) \g /dev/null
select count(*) as alheio from resultados_destaques(:'a_pf');
select count(*) as nao_admin_todos from resultados_destaques(null, true);
select set_config('request.jwt.claim.sub','user_ad50',false) \g /dev/null
select count(*) > 0 as admin_ve from resultados_destaques(null, true);
\echo '[16b] tabela direta: dono ve os seus, outro usuario nao ve nada'
select set_config('request.jwt.claim.sub','user_ou50',false) \g /dev/null
select count(*) as outro_ve from destaques;
select set_config('request.jwt.claim.sub','user_pf50',false) \g /dev/null
select count(*) > 0 as dono_ve, bool_and(vitrine_id = :'vit_pf') as so_os_seus from destaques;

\echo '[17] cortesia: usuario comum nao da (ERRO esperado); admin sem motivo (ERRO esperado); admin da e fica no log'
select conceder_destaque_cortesia('busca', :'l3', null, 3, 'tentando');
select set_config('request.jwt.claim.sub','user_ad50',false) \g /dev/null
select conceder_destaque_cortesia('busca', :'l3', null, 3, '');
select conceder_destaque_cortesia('busca', :'l3', null, 3, 'Lançamento da loja') as d_cortesia \gset
reset role; select status, origem, dias, criado_por from destaques where id=:'d_cortesia';
select count(*) as log_cortesia from logs_atividade where tabela='destaques' and registro_id=:'d_cortesia' and usuario_id='user_ad50';
\echo '[17b] cortesia na home com as vagas cheias (ERRO esperado); com "passar das vagas" vai'
set role authenticated;
select conceder_destaque_cortesia('home', :'l3', null, null, 'Parceiro');
select conceder_destaque_cortesia('home', :'l3', null, null, 'Parceiro', true) is not null as deu;

\echo '[18] cancelar destaque: so admin (ERRO esperado para o lojista)'
select set_config('request.jwt.claim.sub','user_lj50',false) \g /dev/null
select cancelar_destaque(:'d_cortesia', 'quero');
select set_config('request.jwt.claim.sub','user_ad50',false) \g /dev/null
select cancelar_destaque(:'d_cortesia', 'Pedido do lojista') \g /dev/null
select status, motivo, fim <= now() as acabou from destaques where id=:'d_cortesia';

\echo '[19] creditos dos planos: admin muda (fica no log); usuario comum nao (ERRO esperado de RLS)'
insert into destaque_creditos_plano (plano_codigo, tipo, quantidade_mes, atualizado_por) values ('slim', 'busca', 1, 'user_ad50');
reset role; select count(*) as log_credito from logs_atividade where tabela='destaque_creditos_plano' and usuario_id='user_ad50';
set role authenticated; select set_config('request.jwt.claim.sub','user_lj50',false) \g /dev/null
insert into destaque_creditos_plano (plano_codigo, tipo, quantidade_mes) values ('teste', 'home', 99);

\echo '[20] vendedor nao forja subido_em nem destaque_ate'
update anuncios set subido_em='2999-01-01', destaque_ate='2999-01-01' where id=:'l3';
select subido_em is null as subido_intacto, destaque_ate < '2999-01-01' as destaque_intacto from anuncios where id=:'l3';
insert into anuncios (vitrine_id, categoria_id, titulo, cidade, preco_centavos, atributos, fotos, subido_em)
values (:'vit_lj', :'cat_moveis', 'Banco zeta50 forjado', 'Corrente', 5000, '{}', :'foto_lj', '2999-01-01') returning subido_em is null as zerado;

\echo '[21] admin nao troca o tipo: alvo nao tem permissao de coluna (ERRO esperado: permission denied); dias do "subir" continuam vazios (ERRO esperado: check constraint)'
select set_config('request.jwt.claim.sub','user_ad50',false) \g /dev/null
update destaque_tipos set alvo='loja' where slug='home';
select slug, alvo from destaque_tipos where slug='home';
update destaque_tipos set dias=3 where slug='subir';

\echo '[22] limite de pedidos esperando pagamento (destaque.pendentes_max = 1): o 2o pedido falha (ERRO esperado)'
reset role; update configuracoes set valor='1' where chave='destaque.pendentes_max' and microrregiao_id is null;
update destaque_tipos set vagas_por_regiao=null where slug='home';
set role authenticated; select set_config('request.jwt.claim.sub','user_ou50',false) \g /dev/null
select tipo from quero_vender('pf') \g /dev/null
reset role; select id as vit_ou from vitrines_lojas where dono_id='user_ou50' \gset
insert into anuncios (vitrine_id, categoria_id, titulo, cidade, preco_centavos, atributos, fotos, status)
values (:'vit_ou', :'cat_moveis', 'Rede zeta50 de dormir', 'Corrente', 5000, '{}', '{}', 'ativo') returning id as o1 \gset
set role authenticated;
select status from contratar_destaque('busca', :'o1');
select status from contratar_destaque('home', :'o1');
reset role; update configuracoes set valor='10' where chave='destaque.pendentes_max' and microrregiao_id is null;

\echo '[23] rotina diaria: usuario nao roda (ERRO esperado: permission denied); servidor roda, encerra o que venceu e cancela pedido velho nao pago (o pagamento pendente tambem)'
update destaques set fim = now() - interval '1 minute' where id=:'d_home_pf';
update destaques set criado_em = now() - interval '3 days' where anuncio_id=:'o1' and status='aguardando_pagamento';
set role authenticated; select set_config('request.jwt.claim.sub','user_ou50',false) \g /dev/null
select expirar_destaques();
set role service_role; select set_config('request.jwt.claim.role','service_role',false), set_config('request.jwt.claim.sub','',false) \g /dev/null
select expirar_rotina();
reset role; select set_config('request.jwt.claim.role','',false) \g /dev/null
select status from destaques where id=:'d_home_pf';
select d.status as pedido, p.status as pagamento from destaques d join pagamentos p on p.id=d.pagamento_id where d.anuncio_id=:'o1';
select count(*) as home_pf_na_inicial from destaques_home(:'reg') where id=:'a_pf';

\echo '[24] funcoes internas fora da API (ERRO esperado: permission denied)'
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_lj50',false) \g /dev/null
select ativar_destaque(:'d_l3');
select destaque_vagas_ocupadas('home', :'reg');
set role anon; select set_config('request.jwt.claim.role','anon',false), set_config('request.jwt.claim.sub','',false) \g /dev/null
select * from resultados_destaques();
reset role; select set_config('request.jwt.claim.role','',false) \g /dev/null

-- =====================================================================
-- Correções da revisão: vagas sem pagar, cancelamento desfeito pelo pagamento,
-- anúncio fora do ar, preço por região e limite de perguntas ao Asaas.
-- Atores novos na outra região (X e Y, um anúncio cada).
-- =====================================================================
reset role; select set_config('request.jwt.claim.role','',false), set_config('request.jwt.claim.sub','',false) \g /dev/null
insert into perfis (id,microrregiao_id,nome,whatsapp,cidade,tipo_pessoa) values
 ('user_x50',:'reg_outra','Xavier Cinquenta','5589999995454','Longe','pf'),
 ('user_y50',:'reg_outra','Yara Cinquenta','5589999995555','Longe','pf');
update perfis set whatsapp_verificado_em=now() where id in ('user_x50','user_y50');
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_x50',false) \g /dev/null
select tipo from quero_vender('pf') \g /dev/null
select id as vit_x from vitrines_lojas where dono_id='user_x50' \gset
insert into anuncios (vitrine_id, categoria_id, titulo, cidade, preco_centavos, atributos, fotos)
values (:'vit_x', :'cat_moveis', 'Bicicleta zeta50 aro 29', 'Longe', 80000, '{}',
        '{https://abc.supabase.co/storage/v1/object/public/anuncios/user_x50/x/1.webp}') returning id as ax \gset
select set_config('request.jwt.claim.sub','user_y50',false) \g /dev/null
select tipo from quero_vender('pf') \g /dev/null
select id as vit_y from vitrines_lojas where dono_id='user_y50' \gset
insert into anuncios (vitrine_id, categoria_id, titulo, cidade, preco_centavos, atributos, fotos)
values (:'vit_y', :'cat_moveis', 'Geladeira zeta50 duplex', 'Longe', 90000, '{}',
        '{https://abc.supabase.co/storage/v1/object/public/anuncios/user_y50/x/1.webp}') returning id as ay \gset
reset role; select set_config('request.jwt.claim.role','',false), set_config('request.jwt.claim.sub','',false) \g /dev/null
select status as ax_status from anuncios where id=:'ax';
update destaque_tipos set vagas_por_regiao=1 where slug='home';

\echo '[25] reserva: pedir de novo com a reserva valendo NAO estica a reserva (mesma data, 0 renovacoes)'
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_x50',false) \g /dev/null
select destaque_id as d_hx, pagamento_id as pg_hx, reservado_ate as res1 from contratar_destaque('home', :'ax') \gset
select reservado_ate = :'res1' as mesma_reserva, destaque_id = :'d_hx' as mesmo_pedido from contratar_destaque('home', :'ax');
reset role; select renovacoes from destaques where id=:'d_hx';
\echo '[25b] reserva venceu (pedido de 47h): guarda de novo UMA vez (renovacoes = 1)'
update destaques set reservado_ate = now() - interval '1 minute', criado_em = now() - interval '47 hours' where id=:'d_hx';
set role authenticated;
select reservado_ate > now() as guardou_de_novo from contratar_destaque('home', :'ax');
reset role; select renovacoes from destaques where id=:'d_hx';
\echo '[25c] venceu de novo: nao guarda mais (reservado_ate no passado) e a outra vendedora pega a vaga'
update destaques set reservado_ate = now() - interval '1 minute' where id=:'d_hx';
set role authenticated;
select reservado_ate > now() as guardou_mais_uma, destaque_id = :'d_hx' as mesmo_pedido from contratar_destaque('home', :'ax');
select set_config('request.jwt.claim.sub','user_y50',false) \g /dev/null
select destaque_id as d_hy, pagamento_id as pg_hy from contratar_destaque('home', :'ay') \gset
select status, reservado_ate > now() as y_reservou from destaques where id=:'d_hy';
\echo '[25d] X pede de novo com a vaga ocupada pela Y (ERRO esperado: vagas ocupadas)'
select set_config('request.jwt.claim.sub','user_x50',false) \g /dev/null
select * from contratar_destaque('home', :'ax');

\echo '[26] pendentes_max conta pedido velho com reserva valendo: Y (pedido de 3 dias, reserva valendo) nao pede outro (ERRO esperado: muitos destaques esperando)'
reset role; update configuracoes set valor='1' where chave='destaque.pendentes_max' and microrregiao_id is null;
update destaques set criado_em = now() - interval '3 days' where id=:'d_hy';
set role authenticated; select set_config('request.jwt.claim.sub','user_y50',false) \g /dev/null
select * from contratar_destaque('busca', :'ay');
reset role; update configuracoes set valor='10' where chave='destaque.pendentes_max' and microrregiao_id is null;
update destaques set criado_em = now() where id=:'d_hy';

\echo '[26b] reservas_max_por_vendedor = 1: a loja guarda a vaga da home para l1 e nao guarda para l3 (ERRO esperado: ja tem vagas guardadas)'
update configuracoes set valor='1' where chave='destaque.reservas_max_por_vendedor' and microrregiao_id is null;
update destaque_tipos set vagas_por_regiao=5 where slug='home';
set role authenticated; select set_config('request.jwt.claim.sub','user_lj50',false) \g /dev/null
select destaque_id as d_hl1 from contratar_destaque('home', :'l1') \gset
select * from contratar_destaque('home', :'l3');
reset role; update configuracoes set valor='2' where chave='destaque.reservas_max_por_vendedor' and microrregiao_id is null;
update destaques set status='cancelado', motivo='teste' where id=:'d_hl1';

\echo '[27] admin cancela pedido pendente e o Pix antigo e pago depois: continua cancelado, pagamento marcado para devolver, destaque_ate nao muda'
set role authenticated; select set_config('request.jwt.claim.sub','user_lj50',false) \g /dev/null
select destaque_id as d_adm, pagamento_id as pg_adm from contratar_destaque('busca', :'l1') \gset
reset role; select coalesce(destaque_ate::text, 'nenhum') as ate_l1 from anuncios where id=:'l1' \gset
set role service_role; select set_config('request.jwt.claim.role','service_role',false), set_config('request.jwt.claim.sub','',false) \g /dev/null
select registrar_cobranca_asaas(:'pg_adm', 'pay_50_adm', null, 'pix') \g /dev/null
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_ad50',false) \g /dev/null
select cancelar_destaque(:'d_adm', 'Anuncio suspeito') \g /dev/null
set role service_role; select set_config('request.jwt.claim.role','service_role',false), set_config('request.jwt.claim.sub','',false) \g /dev/null
select confirmar_pagamento('pay_50_adm', '{"event":"PAYMENT_RECEIVED"}') \g /dev/null
reset role; select set_config('request.jwt.claim.role','',false) \g /dev/null
select d.status as destaque, d.cancelado_pela_equipe, p.status as pagamento, p.devolver_motivo is not null as devolver,
       (select coalesce(destaque_ate::text, 'nenhum') = :'ate_l1' from anuncios where id=:'l1') as destaque_ate_igual
  from destaques d join pagamentos p on p.id=d.pagamento_id where d.id=:'d_adm';
\echo '[27b] chamada direta de ativar num pedido cancelado nao liga'
select ativar_destaque(:'d_adm');
select status as continua from destaques where id=:'d_adm';

\echo '[28] anuncio congelado antes do dinheiro chegar: nao liga, pagamento marcado para devolver'
set role service_role; select set_config('request.jwt.claim.role','service_role',false), set_config('request.jwt.claim.sub','',false) \g /dev/null
select registrar_cobranca_asaas(:'pg_hy', 'pay_50_hy', null, 'pix') \g /dev/null
select registrar_cobranca_asaas(:'pg_hx', 'pay_50_hx', null, 'pix') \g /dev/null
reset role; select set_config('request.jwt.claim.role','',false) \g /dev/null
update anuncios set status='congelado' where id=:'ax';
set role service_role; select set_config('request.jwt.claim.role','service_role',false) \g /dev/null
select confirmar_pagamento('pay_50_hx') \g /dev/null
reset role; select set_config('request.jwt.claim.role','',false) \g /dev/null
select d.status as destaque, a.status as anuncio, p.devolver_motivo
  from destaques d join anuncios a on a.id=d.anuncio_id join pagamentos p on p.id=d.pagamento_id where d.id=:'d_hx';
\echo '[28b] vaga: destaque ativo de anuncio congelado nao ocupa vaga (1 com a Y no ar, 0 com ela congelada)'
set role service_role; select set_config('request.jwt.claim.role','service_role',false) \g /dev/null
select confirmar_pagamento('pay_50_hy') \g /dev/null
reset role; select set_config('request.jwt.claim.role','',false) \g /dev/null
select status as y_ativo from destaques where id=:'d_hy';
select destaque_vagas_ocupadas('home', :'reg_outra') as com_y_no_ar;
update anuncios set status='congelado' where id=:'ay';
select destaque_vagas_ocupadas('home', :'reg_outra') as com_y_congelada;
update anuncios set status='ativo' where id in (:'ay', :'ax');

\echo '[29] pedido vencido pago depois com as vagas cheias: nao liga e marca para devolver'
update destaque_tipos set vagas_por_regiao=2 where slug='home';
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_x50',false) \g /dev/null
select destaque_id as d_hx2, pagamento_id as pg_hx2 from contratar_destaque('home', :'ax') \gset
set role service_role; select set_config('request.jwt.claim.role','service_role',false), set_config('request.jwt.claim.sub','',false) \g /dev/null
select registrar_cobranca_asaas(:'pg_hx2', 'pay_50_hx2', null, 'pix') \g /dev/null
select cancelar_pagamento('pay_50_hx2', 'vencido') \g /dev/null
reset role; select set_config('request.jwt.claim.role','',false) \g /dev/null
update destaque_tipos set vagas_por_regiao=1 where slug='home';
set role service_role; select set_config('request.jwt.claim.role','service_role',false) \g /dev/null
select confirmar_pagamento('pay_50_hx2') \g /dev/null
reset role; select set_config('request.jwt.claim.role','',false) \g /dev/null
select d.status as destaque, p.status as pagamento, p.devolver_motivo from destaques d join pagamentos p on p.id=d.pagamento_id where d.id=:'d_hx2';
update destaque_tipos set vagas_por_regiao=8 where slug='home';

\echo '[30] preco por regiao: admin cria excecao do "busca" na outra regiao (fica no log); a opcao e o pedido usam o preco da regiao'
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_ad50',false) \g /dev/null
insert into destaque_precos_regiao (tipo, microrregiao_id, preco_centavos, dias, atualizado_por) values ('busca', :'reg_outra', 990, 3, 'user_ad50');
reset role; select count(*) as log_preco_regiao from logs_atividade where tabela='destaque_precos_regiao' and usuario_id='user_ad50';
set role authenticated; select set_config('request.jwt.claim.sub','user_x50',false) \g /dev/null
select slug, preco_centavos, dias from opcoes_destaque(:'ax') where slug='busca';
select preco_centavos from contratar_destaque('busca', :'ax');
select set_config('request.jwt.claim.sub','user_lj50',false) \g /dev/null
select slug, preco_centavos, dias from opcoes_destaque(:'l1') where slug='busca';
\echo '[30b] usuario comum nao cria excecao de preco (ERRO esperado: row-level security); visitante le'
insert into destaque_precos_regiao (tipo, microrregiao_id, preco_centavos) values ('home', :'reg', 1);
set role anon; select set_config('request.jwt.claim.role','anon',false), set_config('request.jwt.claim.sub','',false) \g /dev/null
select count(*) as visitante_le from destaque_precos_regiao;
\echo '[30c] "subir" nao tem dias por regiao (ERRO esperado: check constraint)'
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_ad50',false) \g /dev/null
insert into destaque_precos_regiao (tipo, microrregiao_id, dias) values ('subir', :'reg_outra', 3);

\echo '[31] perguntas ao Asaas: servidor pode uma vez a cada 15 s por pagamento; usuario nao chama nem le (ERRO esperado: permission denied x2)'
set role service_role; select set_config('request.jwt.claim.role','service_role',false), set_config('request.jwt.claim.sub','',false) \g /dev/null
select marcar_consulta_asaas(:'pg_hy') as primeira, marcar_consulta_asaas(:'pg_hy') as logo_depois;
reset role; update asaas_consultas set consultado_em = now() - interval '20 seconds' where pagamento_id=:'pg_hy';
set role service_role;
select marcar_consulta_asaas(:'pg_hy') as depois_de_20s, marcar_consulta_asaas(gen_random_uuid()) as pagamento_inexistente;
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_y50',false) \g /dev/null
select marcar_consulta_asaas(:'pg_hy');
select count(*) from asaas_consultas;
reset role; select set_config('request.jwt.claim.role','',false) \g /dev/null
