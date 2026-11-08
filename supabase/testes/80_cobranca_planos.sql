\set ON_ERROR_STOP 0
\set QUIET on
\pset footer off
-- Cobrança de planos e anúncio avulso + telas 5 e 6 (migração 20261108010000_cobranca_planos.sql).
-- Cada bloco [n] diz o que deve acontecer. "ERRO esperado" = a linha ERROR logo abaixo é o certo.

-- Preparação (como o sistema)
reset role; select set_config('request.jwt.claim.role','',false), set_config('request.jwt.claim.sub','',false), set_config('request.headers','',false) \g /dev/null
select id as reg from microrregioes where slug='corrente-pi' \gset
insert into perfis (id,microrregiao_id,nome,whatsapp,cidade,tipo_pessoa) values
 ('user_lj80',:'reg','Lia Lojista','5589999998080','Corrente','pj'),
 ('user_pf80',:'reg','Rui Pessoa','5589999998181','Corrente','pf'),
 ('user_ou80',:'reg','Outro Oitenta','5589999998282','Corrente','pf'),
 ('user_ad80',:'reg','Admin Oitenta','5589999998383','Corrente','pf'),
 ('user_l280',:'reg','Leo Segunda Loja','5589999998484','Corrente','pj');
update perfis set e_admin=true where id='user_ad80';
update configuracoes set valor='"https://abc.supabase.co"' where chave='fotos.origem' and microrregiao_id is null;
update configuracoes set valor='1' where chave='anuncio.fotos_minimo' and microrregiao_id is null;
update planos set limite_anuncios=3 where codigo='pf_gratis';
select id as cat_moveis from categorias where slug='moveis' \gset
\set foto_pf '{https://abc.supabase.co/storage/v1/object/public/anuncios/user_pf80/x/1.webp}'

set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_lj80',false) \g /dev/null
select tipo from quero_vender('loja', 'Loja Oitenta', 'loja-oitenta', '89999998080') \g /dev/null
select id as vit_lj from vitrines_lojas where dono_id='user_lj80' \gset
select set_config('request.jwt.claim.sub','user_l280',false) \g /dev/null
select tipo from quero_vender('loja', 'Loja Oitenta Dois', 'loja-oitenta-dois', '89999998484') \g /dev/null
select id as vit_l2 from vitrines_lojas where dono_id='user_l280' \gset
select set_config('request.jwt.claim.sub','user_pf80',false) \g /dev/null
select tipo from quero_vender('pf') \g /dev/null
select id as vit_pf from vitrines_lojas where dono_id='user_pf80' \gset
insert into anuncios (vitrine_id, categoria_id, titulo, cidade, preco_centavos, atributos, fotos)
values (:'vit_pf', :'cat_moveis', 'Mesa oitenta numero um', 'Corrente', 30000, '{}', :'foto_pf'),
       (:'vit_pf', :'cat_moveis', 'Mesa oitenta numero dois', 'Corrente', 30000, '{}', :'foto_pf'),
       (:'vit_pf', :'cat_moveis', 'Mesa oitenta numero tres', 'Corrente', 30000, '{}', :'foto_pf');
insert into anuncios (vitrine_id, categoria_id, titulo, cidade, preco_centavos, atributos, fotos, status)
values (:'vit_pf', :'cat_moveis', 'Cadeira oitenta avulsa', 'Corrente', 9000, '{}', :'foto_pf', 'rascunho') returning id as rasc \gset
insert into anuncios (vitrine_id, status) values (:'vit_pf', 'rascunho') returning id as rasc_vazio \gset

\echo '[1] semente: configuracoes novas (periodos so mensal, aviso 7 dias, pendentes 5, 72 h, avulso so pf)'
reset role; select set_config('request.jwt.claim.role','',false), set_config('request.jwt.claim.sub','',false) \g /dev/null
select chave, valor from configuracoes
 where chave in ('assinatura.periodos','assinatura.aviso_vencimento_dias','cobranca.pendentes_max','cobranca.cancelar_pendente_horas','avulso.publico')
   and microrregiao_id is null order by chave;

\echo '[2] loja em teste: Slim e Full, so mensal, regra "inicio" (comeca agora, 30 dias); teste e plano gratis nao aparecem'
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false) \g /dev/null
select set_config('request.jwt.claim.sub','user_lj80',false) \g /dev/null
select codigo, meses, valor_centavos, dias, regra, inicio <= now() as agora, fim > now() + interval '29 days' as trinta_dias, atual, disponivel
  from opcoes_assinatura() order by ordem, meses;
select situacao, plano, renovar_agora, plano_proximo from minha_assinatura();
\echo '[2b] visitante nao ve opcoes nem pede cobranca (ERRO esperado: permission denied x2); quem nao vende: nada'
set role anon; select set_config('request.jwt.claim.role','anon',false), set_config('request.jwt.claim.sub','',false) \g /dev/null
select * from opcoes_assinatura();
select * from pedir_assinatura('slim');
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_ou80',false) \g /dev/null
select count(*) as sem_vitrine from opcoes_assinatura();
select count(*) as sem_vitrine from minha_assinatura();

\echo '[3] admin cria o trimestral com 10% (fica no log); a loja ve 3 meses = preco do Slim x 3 x 0,9'
select set_config('request.jwt.claim.sub','user_ad80',false) \g /dev/null
update configuracoes set valor='[{"meses": 1, "desconto_percentual": 0}, {"meses": 3, "desconto_percentual": 10}, {"meses": 0}, "lixo"]', atualizado_por='user_ad80'
 where chave='assinatura.periodos' and microrregiao_id is null;
reset role; select count(*) as log_periodos from logs_atividade where tabela='configuracoes' and usuario_id='user_ad80' and acao='UPDATE';
set role authenticated; select set_config('request.jwt.claim.sub','user_lj80',false) \g /dev/null
select codigo, meses, desconto_percentual, valor_centavos, dias from opcoes_assinatura() order by ordem, meses;
\echo '[3b] usuario comum nao muda os periodos (RLS: nada muda)'
update configuracoes set valor='[{"meses": 1, "desconto_percentual": 99}]' where chave='assinatura.periodos';
select valor->1->>'desconto_percentual' as desconto_continua from configuracoes where chave='assinatura.periodos' and microrregiao_id is null;

\echo '[4] pedir Slim mensal: pagamento pendente com o valor da tabela; pedir de novo devolve o mesmo'
select valor_centavos, regra, cancelados from pedir_assinatura('slim', 1);
select pagamento_id as pg_slim from pedir_assinatura('slim', 1) \gset
select count(*) as pendentes_slim from pagamentos where vitrine_id=:'vit_lj' and tipo='assinatura' and status='pendente';
select tipo, plano_codigo, meses, valor_centavos, status, criado_por from pagamentos where id=:'pg_slim';
\echo '[4b] periodo fora da lista (ERRO esperado: periodos da lista); plano de teste (ERRO esperado: nao esta a venda); plano gratis (ERRO esperado)'
select * from pedir_assinatura('slim', 2);
select * from pedir_assinatura('teste', 1);
select * from pedir_assinatura('pf_gratis', 1);
\echo '[4c] trocar a escolha para o trimestral cancela a cobranca anterior; voltar para o mensal cria outra'
select valor_centavos, regra from pedir_assinatura('slim', 3);
select status, observacao from pagamentos where id=:'pg_slim';
select pagamento_id as pg_slim from pedir_assinatura('slim', 1) \gset
select count(*) filter (where status='pendente') as pendentes, count(*) filter (where status='cancelado') as cancelados
  from pagamentos where vitrine_id=:'vit_lj' and tipo='assinatura';

\echo '[5] lojista nao forja: nao confirma (ERRO esperado: permission denied), nao muda o pagamento, nao cria pagamento (ERRO esperado: RLS), nao marca plano para depois'
select confirmar_pagamento('qualquer');
update pagamentos set status='pago', valor_centavos=1 where id=:'pg_slim';
select status, valor_centavos from pagamentos where id=:'pg_slim';
insert into pagamentos (vitrine_id, microrregiao_id, tipo, plano_codigo, valor_centavos, status) values (:'vit_lj', :'reg', 'assinatura', 'full', 1, 'pago');
update vitrines_lojas set plano_proximo='full', plano_proximo_ate=now()+interval '1 year', plano='full', plano_expira_em=now()+interval '1 year' where id=:'vit_lj';
reset role; select plano, plano_expira_em is null as sem_vencimento, plano_proximo from vitrines_lojas where id=:'vit_lj';
set role authenticated;
\echo '[5b] outra pessoa nao ve o pagamento da loja; visitante tambem nao'
select set_config('request.jwt.claim.sub','user_ou80',false) \g /dev/null
select count(*) as alheio from pagamentos where id=:'pg_slim';
set role anon; select set_config('request.jwt.claim.role','anon',false), set_config('request.jwt.claim.sub','',false) \g /dev/null
select count(*) as visitante from pagamentos where id=:'pg_slim';

\echo '[6] servidor grava a cobranca e o Asaas confirma: Slim de agora ate +30 dias (regra inicio); aviso repetido nao soma'
set role service_role; select set_config('request.jwt.claim.role','service_role',false), set_config('request.jwt.claim.sub','',false) \g /dev/null
select registrar_cobranca_asaas(:'pg_slim', 'pay_80_slim', 'https://sandbox.asaas.com/i/80', 'pix') as gravou;
select confirmar_pagamento('pay_80_slim', '{"event":"PAYMENT_RECEIVED","payment":{"id":"pay_80_slim","billingType":"PIX"}}');
select plano, status, plano_expira_em between now() + interval '29 days 23 hours' and now() + interval '30 days 1 minute' as trinta_dias
  from vitrines_lojas where id=:'vit_lj';
select status, forma, regra, plano_anterior, concedido_ate is not null as concedido from pagamentos where id=:'pg_slim';
select plano_expira_em as exp1 from vitrines_lojas where id=:'vit_lj' \gset
select confirmar_pagamento('pay_80_slim');
select plano_expira_em = :'exp1' as nao_somou from vitrines_lojas where id=:'vit_lj';

\echo '[7] renovar o Slim: regra renovacao, comeca no vencimento atual; confirmado soma mais 30 dias'
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_lj80',false) \g /dev/null
select codigo, regra, inicio = :'exp1'::timestamptz as no_vencimento, atual from opcoes_assinatura() where meses = 1 order by ordem;
select pagamento_id as pg_renova from pedir_assinatura('slim', 1) \gset
reset role; select set_config('request.jwt.claim.role','service_role',false) \g /dev/null
select registrar_cobranca_asaas(:'pg_renova', 'pay_80_renova', null, 'cartao') \g /dev/null
select confirmar_pagamento('pay_80_renova', '{"payment":{"billingType":"CREDIT_CARD"}}') \g /dev/null
select plano_expira_em = :'exp1'::timestamptz + interval '30 days' as somou_30 from vitrines_lojas where id=:'vit_lj';
select regra, forma from pagamentos where id=:'pg_renova';

\echo '[8] devolucao da renovacao: tira so os 30 dias daquele pagamento; a loja continua no Slim ate o vencimento anterior'
select cancelar_pagamento('pay_80_renova', 'estornado', '{"event":"PAYMENT_REFUNDED"}') \g /dev/null
select plano, plano_expira_em = :'exp1'::timestamptz as voltou from vitrines_lojas where id=:'vit_lj';
select cancelar_pagamento('pay_80_renova', 'estornado') \g /dev/null
select plano_expira_em = :'exp1'::timestamptz as repetido_nao_mexe from vitrines_lojas where id=:'vit_lj';

\echo '[9] subir para o Full no meio do periodo: regra troca_agora (comeca agora, os dias do Slim nao passam)'
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_lj80',false) \g /dev/null
select codigo, regra, inicio <= now() as agora from opcoes_assinatura() where meses = 1 and codigo='full';
select pagamento_id as pg_full from pedir_assinatura('full', 1) \gset
reset role; select set_config('request.jwt.claim.role','service_role',false) \g /dev/null
select registrar_cobranca_asaas(:'pg_full', 'pay_80_full', null, 'pix') \g /dev/null
select confirmar_pagamento('pay_80_full') \g /dev/null
select plano, plano_expira_em < :'exp1'::timestamptz + interval '1 minute' as trinta_de_agora from vitrines_lojas where id=:'vit_lj';
select regra, plano_anterior, expira_anterior = :'exp1'::timestamptz as guardou_anterior from pagamentos where id=:'pg_full';
select plano_expira_em as exp_full from vitrines_lojas where id=:'vit_lj' \gset

\echo '[10] descer para o Slim: regra proximo_periodo; o Full continua ate o fim e o Slim fica marcado para depois'
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_lj80',false) \g /dev/null
select codigo, regra, inicio = :'exp_full'::timestamptz as no_fim_do_full from opcoes_assinatura() where meses = 1 and codigo='slim';
select pagamento_id as pg_desce from pedir_assinatura('slim', 1) \gset
reset role; select set_config('request.jwt.claim.role','service_role',false) \g /dev/null
select registrar_cobranca_asaas(:'pg_desce', 'pay_80_desce', null, 'pix') \g /dev/null
select confirmar_pagamento('pay_80_desce') \g /dev/null
select plano, plano_expira_em = :'exp_full'::timestamptz as full_igual, plano_proximo,
       plano_proximo_ate = :'exp_full'::timestamptz + interval '30 days' as slim_depois, plano_proximo_pagamento_id = :'pg_desce' as ligado
  from vitrines_lojas where id=:'vit_lj';
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_lj80',false) \g /dev/null
select situacao, plano, plano_proximo, plano_proximo_inicio = :'exp_full'::timestamptz as inicio_certo from minha_assinatura();

\echo '[11] com troca marcada: outro plano (ERRO esperado: ja pagou o Plano Slim); o mesmo Slim soma no fim dele (renovacao_proximo)'
select * from pedir_assinatura('full', 1);
select codigo, regra, disponivel, motivo is not null as tem_motivo from opcoes_assinatura() where meses = 1 order by ordem;
select regra, inicio = :'exp_full'::timestamptz + interval '30 days' as no_fim_do_slim from pedir_assinatura('slim', 1);

\echo '[12] devolucao do Slim marcado (antes de comecar): a troca some; o Full continua igual'
reset role; select set_config('request.jwt.claim.role','service_role',false) \g /dev/null
select cancelar_pagamento('pay_80_desce', 'estornado') \g /dev/null
select plano, plano_expira_em = :'exp_full'::timestamptz as full_igual, plano_proximo, plano_proximo_ate from vitrines_lojas where id=:'vit_lj';

\echo '[13] devolucao do Full (foi o unico que deu o Full): volta ao Slim que vencia na data paga anterior'
select cancelar_pagamento('pay_80_full', 'estornado') \g /dev/null
select plano, plano_expira_em = :'exp1'::timestamptz as data_anterior from vitrines_lojas where id=:'vit_lj';

\echo '[14] troca marcada que ja comecou: vale na hora (plano_efetivo) e a rotina grava'
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_lj80',false) \g /dev/null
select pagamento_id as pg_full2 from pedir_assinatura('full', 1) \gset
reset role; select set_config('request.jwt.claim.role','service_role',false) \g /dev/null
select registrar_cobranca_asaas(:'pg_full2', 'pay_80_full2', null, 'pix') \g /dev/null
select confirmar_pagamento('pay_80_full2') \g /dev/null
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_lj80',false) \g /dev/null
select pagamento_id as pg_desce2 from pedir_assinatura('slim', 1) \gset
reset role; select set_config('request.jwt.claim.role','service_role',false) \g /dev/null
select registrar_cobranca_asaas(:'pg_desce2', 'pay_80_desce2', null, 'pix') \g /dev/null
select confirmar_pagamento('pay_80_desce2') \g /dev/null
reset role; select set_config('request.jwt.claim.role','',false) \g /dev/null
update vitrines_lojas set plano_expira_em = now() - interval '1 minute' where id=:'vit_lj';
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_lj80',false) \g /dev/null
select codigo as plano_que_vale from meu_plano();
select plano, plano_proximo, situacao from minha_assinatura();
set role service_role; select set_config('request.jwt.claim.role','service_role',false), set_config('request.jwt.claim.sub','',false) \g /dev/null
select expirar_rotina();
reset role; select plano, plano_proximo, plano_expira_em > now() + interval '29 days' as slim_valendo from vitrines_lojas where id=:'vit_lj';

\echo '[15] usuario nao roda a rotina (ERRO esperado: permission denied); cobranca velha nao paga e cancelada pela rotina'
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_lj80',false) \g /dev/null
select expirar_rotina();
select pagamento_id as pg_velho from pedir_assinatura('full', 1) \gset
reset role; update pagamentos set criado_em = now() - interval '80 hours' where id=:'pg_velho';
set role service_role; select set_config('request.jwt.claim.role','service_role',false) \g /dev/null
select expirar_rotina() \g /dev/null
select status, observacao from pagamentos where id=:'pg_velho';

\echo '[16] limite de cobrancas esperando (cobranca.pendentes_max = 1): a segunda loja pede 1, a segunda falha (ERRO esperado: muitas cobrancas)'
reset role; update configuracoes set valor='1' where chave='cobranca.pendentes_max' and microrregiao_id is null;
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_pf80',false) \g /dev/null
select count(*) as pf_planos from opcoes_assinatura();
select pagamento_id as pg_pf_slim from pedir_assinatura('slim', 1) \gset
select * from pedir_anuncio_avulso(:'rasc');
reset role; update configuracoes set valor='5' where chave='cobranca.pendentes_max' and microrregiao_id is null;
update pagamentos set status='cancelado' where id=:'pg_pf_slim';

\echo '[17] anuncio avulso: PF no limite (3 de 3) nao publica o rascunho (ERRO esperado: limite de 3 anuncios)'
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_pf80',false) \g /dev/null
select publicar_anuncio(:'rasc');
\echo '[17b] pede o avulso: 990 por 30 dias (do painel); pedir de novo devolve o mesmo'
select valor_centavos, dias from pedir_anuncio_avulso(:'rasc');
select pagamento_id as pg_av from pedir_anuncio_avulso(:'rasc') \gset
select count(*) as pendentes_avulso from pagamentos where anuncio_id=:'rasc' and status='pendente';
\echo '[17c] rascunho incompleto (ERRO esperado: Escolha a categoria); anuncio alheio (ERRO esperado: Anuncio nao encontrado); loja (ERRO esperado: avulso e para pessoa)'
select * from pedir_anuncio_avulso(:'rasc_vazio');
select set_config('request.jwt.claim.sub','user_ou80',false) \g /dev/null
select * from pedir_anuncio_avulso(:'rasc');
select set_config('request.jwt.claim.sub','user_lj80',false) \g /dev/null
insert into anuncios (vitrine_id, status) values (:'vit_lj', 'rascunho') returning id as rasc_lj \gset
select * from pedir_anuncio_avulso(:'rasc_lj');
\echo '[17d] visitante nao pede avulso (ERRO esperado: permission denied)'
set role anon; select set_config('request.jwt.claim.role','anon',false), set_config('request.jwt.claim.sub','',false) \g /dev/null
select * from pedir_anuncio_avulso(:'rasc');

\echo '[18] Asaas confirma o avulso: o anuncio entra no ar sozinho, pago por 30 dias, e nao conta no limite'
set role service_role; select set_config('request.jwt.claim.role','service_role',false), set_config('request.jwt.claim.sub','',false) \g /dev/null
select registrar_cobranca_asaas(:'pg_av', 'pay_80_av', null, 'pix') \g /dev/null
select confirmar_pagamento('pay_80_av') \g /dev/null
select status, pago_ate > now() + interval '29 days' as pago_30 from anuncios where id=:'rasc';
select concedido_ate is not null as concedido, observacao from pagamentos where id=:'pg_av';
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_pf80',false) \g /dev/null
\echo '[18b] ja no ar: pedir de novo (ERRO esperado: ja esta no ar)'
select * from pedir_anuncio_avulso(:'rasc');

\echo '[19] devolucao do avulso: o anuncio sai do ar (pausado, nao apagado), porque nao cabe no plano gratis'
set role service_role; select set_config('request.jwt.claim.role','service_role',false), set_config('request.jwt.claim.sub','',false) \g /dev/null
select cancelar_pagamento('pay_80_av', 'estornado') \g /dev/null
select status, pago_ate <= now() as sem_tempo, titulo from anuncios where id=:'rasc';

\echo '[20] avulso vencido: a rotina passa para expirado quando nao cabe no plano'
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_pf80',false) \g /dev/null
select pagamento_id as pg_av2 from pedir_anuncio_avulso(:'rasc') \gset
set role service_role; select set_config('request.jwt.claim.role','service_role',false), set_config('request.jwt.claim.sub','',false) \g /dev/null
select registrar_cobranca_asaas(:'pg_av2', 'pay_80_av2', null, 'pix') \g /dev/null
select confirmar_pagamento('pay_80_av2') \g /dev/null
select status as no_ar_de_novo from anuncios where id=:'rasc';
reset role; update anuncios set pago_ate = now() - interval '1 minute' where id=:'rasc';
set role service_role; select expirar_rotina() \g /dev/null
select status as depois_da_rotina from anuncios where id=:'rasc';

\echo '[20b] com vaga sobrando no plano o avulso nao e cobrado (ERRO esperado: ainda tem vaga)'
reset role; update anuncios set status='pausado' where vitrine_id=:'vit_pf' and titulo='Mesa oitenta numero um';
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_pf80',false) \g /dev/null
select * from pedir_anuncio_avulso(:'rasc');

\echo '[21] dono nao forja pago_ate (continua o mesmo)'
reset role; select pago_ate as pago_antes from anuncios where id=:'rasc' \gset
set role authenticated;
update anuncios set pago_ate = now() + interval '1 year' where id=:'rasc';
select pago_ate = :'pago_antes'::timestamptz as nao_mudou from anuncios where id=:'rasc';

\echo '[22] painel tela 5: usuario comum nao lista (ERRO esperado) nem age (ERRO esperado); admin lista com plano, situacao e contagens'
select * from admin_lojas();
select admin_acao_loja(:'vit_lj', 'suspender', 'teste de forja');
select set_config('request.jwt.claim.sub','user_ad80',false) \g /dev/null
select nome, tipo, plano, situacao, anuncios_ativos, limite_anuncios, propostas_mes, total > 0 as tem_total
  from admin_lojas(p_busca => 'oitenta') order by nome;
select count(*) as so_lojas from admin_lojas(p_busca => 'oitenta', p_tipo => 'loja');
select count(*) as busca_whatsapp from admin_lojas(p_busca => '(89) 99999-8181');

\echo '[23] acoes do admin: sem motivo (ERRO esperado); cortesia de 10 dias soma no plano pago; selo para pessoa (ERRO esperado)'
select admin_acao_loja(:'vit_lj', 'cortesia', '', 10);
reset role; select plano_expira_em as exp_antes from vitrines_lojas where id=:'vit_lj' \gset
set role authenticated;
select admin_acao_loja(:'vit_lj', 'cortesia', 'Compensar falha no site', 10);
reset role; select plano_expira_em = :'exp_antes'::timestamptz + interval '10 days' as somou_10 from vitrines_lojas where id=:'vit_lj';
set role authenticated;
select admin_acao_loja(:'vit_pf', 'dar_selo', 'Documento conferido');
\echo '[23b] cortesia no plano gratis (ERRO esperado: use Trocar plano); trocar o plano da pessoa para Slim por 15 dias'
select admin_acao_loja(:'vit_pf', 'cortesia', 'Ajuda no lancamento', 15);
select admin_acao_loja(:'vit_pf', 'trocar_plano', 'Parceiro do lancamento', 15, 'slim');
reset role; select plano, plano_expira_em between now() + interval '14 days' and now() + interval '15 days 1 minute' as quinze_dias from vitrines_lojas where id=:'vit_pf';
set role authenticated;
\echo '[23c] selo, suspender e reativar a loja; cortesia no teste da segunda loja soma no teste'
select admin_acao_loja(:'vit_lj', 'dar_selo', 'CNPJ conferido');
select admin_acao_loja(:'vit_lj', 'suspender', 'Denuncias de golpe');
reset role; select status, selo_loja_verificada from vitrines_lojas where id=:'vit_lj';
select teste_expira_em as teste_antes from vitrines_lojas where id=:'vit_l2' \gset
set role authenticated;
select admin_acao_loja(:'vit_l2', 'cortesia', 'Loja chegou tarde no piloto', 7);
reset role; select teste_expira_em = :'teste_antes'::timestamptz + interval '7 days' as teste_somou from vitrines_lojas where id=:'vit_l2';
select acao, motivo, admin_id from vitrines_acoes_admin where vitrine_id in (:'vit_lj', :'vit_pf', :'vit_l2') order by criado_em;
select count(*) as log_vitrine_admin from logs_atividade where tabela='vitrines_lojas' and usuario_id='user_ad80';
select count(*) as log_acoes from logs_atividade where tabela='vitrines_acoes_admin' and usuario_id='user_ad80';

\echo '[24] loja suspensa nao pede cobranca (ERRO esperado: suspensa); Pix antigo pago soma o tempo mas ela continua suspensa'
set role authenticated; select set_config('request.jwt.claim.sub','user_lj80',false) \g /dev/null
select * from pedir_assinatura('slim', 1);
select count(*) filter (where disponivel) as disponiveis from opcoes_assinatura();
reset role;
insert into pagamentos (vitrine_id, microrregiao_id, tipo, plano_codigo, meses, valor_centavos, status, asaas_cobranca_id)
values (:'vit_lj', :'reg', 'assinatura', 'slim', 1, 4990, 'cancelado', 'pay_80_antigo') returning id as pg_antigo \gset
select plano_expira_em as exp_susp from vitrines_lojas where id=:'vit_lj' \gset
set role service_role; select set_config('request.jwt.claim.role','service_role',false), set_config('request.jwt.claim.sub','',false) \g /dev/null
select confirmar_pagamento('pay_80_antigo') \g /dev/null
select status, plano_expira_em = :'exp_susp'::timestamptz + interval '30 days' as somou from vitrines_lojas where id=:'vit_lj';
select status, observacao is not null as tem_observacao from pagamentos where id=:'pg_antigo';
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_ad80',false) \g /dev/null
select admin_acao_loja(:'vit_lj', 'reativar', 'Caso resolvido');

\echo '[25] lojista nao le as acoes do painel (nada); visitante nao le (ERRO esperado: permission denied)'
select set_config('request.jwt.claim.sub','user_lj80',false) \g /dev/null
select count(*) as acoes_vistas from vitrines_acoes_admin;
set role anon; select set_config('request.jwt.claim.role','anon',false), set_config('request.jwt.claim.sub','',false) \g /dev/null
select count(*) from vitrines_acoes_admin;

\echo '[26] painel tela 6: totais por status e tipo (so admin; ERRO esperado para o lojista)'
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_lj80',false) \g /dev/null
select * from admin_resumo_pagamentos();
select set_config('request.jwt.claim.sub','user_ad80',false) \g /dev/null
select status, tipo, quantidade > 0 as tem, total_centavos > 0 as soma from admin_resumo_pagamentos(p_tipo => 'assinatura') order by status;
select count(*) as pagos_hoje from admin_resumo_pagamentos(p_status => 'pago', p_de => (now() at time zone 'America/Fortaleza')::date);
select count(*) as amanha from admin_resumo_pagamentos(p_de => (now() at time zone 'America/Fortaleza')::date + 1);

\echo '[27] verificacao: usuario envia, so admin analisa (ERRO esperado para o dono); recusa sem motivo (ERRO esperado); aprova'
select set_config('request.jwt.claim.sub','user_lj80',false) \g /dev/null
insert into perfis_verificacoes (perfil_id, tipo) values ('user_lj80', 'cnpj') returning id as verif \gset
select admin_analisar_verificacao(:'verif', true);
select set_config('request.jwt.claim.sub','user_ad80',false) \g /dev/null
select admin_analisar_verificacao(:'verif', false, '');
select admin_analisar_verificacao(:'verif', true);
select status, analisado_por from perfis_verificacoes where id=:'verif';
\echo '[27b] analisar de novo (ERRO esperado: ja analisada)'
select admin_analisar_verificacao(:'verif', false, 'Mudou de ideia');

\echo '[28] funcoes internas fora da API (ERRO esperado: permission denied x6)'
set role authenticated; select set_config('request.jwt.claim.sub','user_lj80',false) \g /dev/null
select aplicar_assinatura(:'pg_slim');
select reverter_assinatura(:'pg_slim');
select aplicar_anuncio_avulso(:'pg_av');
select materializar_proximo(:'vit_lj');
select anuncio_cabe_no_plano(:'rasc');
select cancelar_pagamento('pay_80_slim', 'estornado');

\echo '[29] periodos invalidos no painel nao quebram: sem nenhum valido fica o mensal'
reset role; update configuracoes set valor='"nada"' where chave='assinatura.periodos' and microrregiao_id is null;
set role authenticated; select set_config('request.jwt.claim.sub','user_l280',false) \g /dev/null
select codigo, meses, valor_centavos from opcoes_assinatura() order by ordem, meses;
reset role; update configuracoes set valor='[{"meses": 1, "desconto_percentual": 0}]' where chave='assinatura.periodos' and microrregiao_id is null;

\echo '[30] devolucao de avulso de anuncio que cabe no plano (a pessoa agora esta no Slim): continua no ar'
reset role; select set_config('request.jwt.claim.role','',false), set_config('request.jwt.claim.sub','',false) \g /dev/null
select id as a_dois from anuncios where vitrine_id=:'vit_pf' and titulo='Mesa oitenta numero dois' \gset
insert into pagamentos (vitrine_id, microrregiao_id, tipo, anuncio_id, valor_centavos, status, asaas_cobranca_id)
values (:'vit_pf', :'reg', 'anuncio_avulso', :'a_dois', 990, 'pendente', 'pay_80_av3');
set role service_role; select set_config('request.jwt.claim.role','service_role',false) \g /dev/null
select confirmar_pagamento('pay_80_av3') \g /dev/null
select status, pago_ate > now() as pago from anuncios where id=:'a_dois';
select cancelar_pagamento('pay_80_av3', 'estornado') \g /dev/null
select status as continua, pago_ate <= now() as sem_tempo from anuncios where id=:'a_dois';

\echo '[31] sem segunda ligacao vitrines_lojas->planos/pagamentos (a API embute vitrines_lojas(nome) em pagamentos): esperado 0 e 1'
reset role; select set_config('request.jwt.claim.role','',false), set_config('request.jwt.claim.sub','',false) \g /dev/null
select count(*) filter (where confrelid = 'public.pagamentos'::regclass) as vitrine_para_pagamentos,
       count(*) filter (where confrelid = 'public.planos'::regclass) as vitrine_para_planos
  from pg_constraint where conrelid = 'public.vitrines_lojas'::regclass and contype = 'f';
