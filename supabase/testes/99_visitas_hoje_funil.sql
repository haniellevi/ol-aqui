\set ON_ERROR_STOP 0
\set QUIET on
\pset footer off
-- Visitas, tela Hoje e funil de lojistas · migração 20261110210000_visitas_hoje_funil.sql.
-- Cada bloco [n] diz o que deve acontecer. "ERRO esperado" = a linha ERROR logo abaixo é o certo.

reset role; select set_config('request.jwt.claim.role','',false), set_config('request.jwt.claim.sub','',false), set_config('request.headers','',false) \g /dev/null
insert into microrregioes (slug, nome, cidade_sede) values ('teste-99', 'Região Noventa e Nove', 'Vila Nove') returning id as reg \gset
insert into cidades (microrregiao_id, nome, uf) values (:'reg', 'Vila Nove', 'PI');
insert into perfis (id,microrregiao_id,nome,whatsapp,cidade,tipo_pessoa) values
 ('user_lj99',:'reg','Ana Loja Nove','5589999999901','Vila Nove','pj'),
 ('user_l299',:'reg','Bia Outra Loja','5589999999902','Vila Nove','pj'),
 ('user_co99',:'reg','Caio Comum','5589999999903','Vila Nove','pf'),
 ('user_ad99',:'reg','Duda Admin','5589999999904','Vila Nove','pf');
update perfis set e_admin=true where id='user_ad99';
update perfis set whatsapp_verificado_em=now() where id like 'user_%99';

\echo '[1] semente: 10 origens, 5 etapas (pagando = ganho, cancelou = perdido) e as configuracoes da tela Hoje e do funil'
select count(*) as origens from origens_visita;
select codigo, tipo from funil_etapas order by ordem;
select count(*) as configs from configuracoes where grupo in ('hoje','funil','visitas') and microrregiao_id is null;

\echo '[2] visitante sem login registra: link marcado (Instagram, com acento e maiúscula), site de onde veio, site estranho, direto; /admin e código ruim são ignorados'
set role anon; select set_config('request.jwt.claim.role','anon',false), set_config('request.jwt.claim.sub','',false) \g /dev/null
select registrar_visita('visit-aaaa-0001', '/?utm_source=x', 'Instagram', 'Rádio Corrente Nov', null, true, true);
select registrar_visita('visit-aaaa-0002', '/loja/teste', null, null, 'www.l.instagram.com', false, true);
select registrar_visita('visit-aaaa-0003', '/busca', null, null, 'golpe.example.com', true, false);
select registrar_visita('visit-aaaa-0004', '/', null, null, null, true, false);
select registrar_visita('visit-aaaa-0005', '/', 'qr_loja', 'loja-da-ana', null, true, true);
select registrar_visita('visit-aaaa-0006', '/admin/funil', 'instagram', null, null, true, false);
select registrar_visita('X', '/', 'instagram', null, null, true, false);
reset role;
select visitante, caminho, origem, campanha, referencia, celular, primeira from visitas order by id;

\echo '[3] trava: o mesmo navegador registra no máximo 30 por minuto'
set role anon; select set_config('request.jwt.claim.role','anon',false) \g /dev/null
select count(*) from (select registrar_visita('visit-robo-0001', '/', null, null, null, true, false) from generate_series(1, 40)) x \g /dev/null
reset role;
select count(*) as do_robo from visitas where visitante = 'visit-robo-0001';

\echo '[4] visitante não lê visitas (ERRO esperado: permission denied); comum lê 0; admin lê tudo'
set role anon; select set_config('request.jwt.claim.role','anon',false) \g /dev/null
select count(*) from visitas;
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_co99',false) \g /dev/null
select count(*) as comum_ve from visitas;
select set_config('request.jwt.claim.sub','user_ad99',false) \g /dev/null
select count(*) >= 35 as admin_ve from visitas;

\echo '[5] números do período: comum recebe ERRO esperado; admin vê pessoas por origem'
select set_config('request.jwt.claim.sub','user_co99',false) \g /dev/null
select admin_visitas(current_date, current_date);
select set_config('request.jwt.claim.sub','user_ad99',false) \g /dev/null
select (r->>'visitas')::int >= 35 as tem_visitas, (r->>'pessoas')::int as pessoas, (r->>'novas')::int as novas,
       (select string_agg(o->>'codigo' || '=' || (o->>'pessoas'), ',' order by o->>'codigo') from jsonb_array_elements(r->'por_origem') o) as origens,
       jsonb_array_length(r->'por_campanha') as campanhas
  from admin_visitas(current_date - 1, current_date) r;
select admin_visitas(current_date, current_date - 1);

\echo '[6] conta nova guarda a origem uma vez (instagram); segunda chamada não troca; origem inventada não grava'
select set_config('request.jwt.claim.sub','user_lj99',false) \g /dev/null
select marcar_origem_conta('instagram', 'radio-corrente');
select marcar_origem_conta('radio', null);
select set_config('request.jwt.claim.sub','user_l299',false) \g /dev/null
select marcar_origem_conta('nao-existe', null);
reset role;
select id, origem_cadastro, campanha_cadastro from perfis where id in ('user_lj99','user_l299') order by id;

\echo '[7] admin cadastra contato que ainda não tem loja (WhatsApp da Ana); comum não vê nem cria (0 e ERRO esperado)'
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_ad99',false) \g /dev/null
insert into funil_lojistas (microrregiao_id, nome_loja, contato_nome, whatsapp, etapa, proximo_passo, proximo_em, criado_por)
values (:'reg', 'Loja da Ana', 'Ana', '5589999999901', 'visitado', 'Voltar com o QR', current_date, 'user_ad99') returning id as f1 \gset
select set_config('request.jwt.claim.sub','user_co99',false) \g /dev/null
select count(*) as comum_ve_funil from funil_lojistas;
insert into funil_lojistas (microrregiao_id, nome_loja, etapa) values (:'reg', 'Golpe', 'contato');

\echo '[8] Ana se cadastra no site: liga ao contato existente e sobe para "Em teste" com nota automática; Bia vira contato novo com origem'
select set_config('request.jwt.claim.sub','user_lj99',false) \g /dev/null
select tipo from quero_vender('loja', 'Loja Nove Ana', 'loja-nove-ana', '89999999901') \g /dev/null
select set_config('request.jwt.claim.sub','user_l299',false) \g /dev/null
select tipo from quero_vender('loja', 'Loja Nove Bia', 'loja-nove-bia', '89999999902') \g /dev/null
reset role;
select id as vit1 from vitrines_lojas where dono_id='user_lj99' \gset
select nome_loja, etapa, vitrine_id is not null as ligada, cidade_id is not null as tem_cidade, origem from funil_lojistas
 where microrregiao_id = :'reg' order by criado_em;
select texto, automatica from funil_notas where lojista_id = :'f1' order by criado_em;

\echo '[9] Ana paga um plano: vai sozinha para "Pagando"'
update vitrines_lojas set plano = (select codigo from planos where not e_teste and preco_centavos > 0 order by ordem limit 1),
       plano_expira_em = now() + interval '30 days' where id = :'vit1';
select etapa from funil_lojistas where id = :'f1';

\echo '[10] admin escreve nota; nota automática não pode ser criada à mão (ERRO esperado); importar não duplica (0) e traz loja que estava fora (1)'
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_ad99',false) \g /dev/null
insert into funil_notas (lojista_id, texto) values (:'f1', 'Pediu nota fiscal');
insert into funil_notas (lojista_id, texto, automatica) values (:'f1', 'Falsa', true);
select funil_importar_lojas() as importou_sem_duplicar;
delete from funil_lojistas where nome_loja = 'Loja Nove Bia';
select funil_importar_lojas() as importou_a_bia;
select set_config('request.jwt.claim.sub','user_co99',false) \g /dev/null
select funil_importar_lojas();

\echo '[11] tela Hoje: admin marca feito; comum não vê nem marca (0 e ERRO esperado)'
select set_config('request.jwt.claim.sub','user_ad99',false) \g /dev/null
insert into hoje_feitas (tipo, alvo_id) values ('teste_acabando', :'vit1');
select tipo, feito_por from hoje_feitas;
select set_config('request.jwt.claim.sub','user_co99',false) \g /dev/null
select count(*) as comum_ve_feitas from hoje_feitas;
insert into hoje_feitas (tipo, alvo_id) values ('x', 'y');

\echo '[12] a etapa de cadastro desligada no painel não quebra o cadastro da loja'
reset role;
update configuracoes set valor = '"nao_existe"' where chave = 'funil.etapa_ao_cadastrar' and microrregiao_id is null;
insert into perfis (id,microrregiao_id,nome,whatsapp,cidade,tipo_pessoa,whatsapp_verificado_em) values ('user_l399',:'reg','Caca Terceira','5589999999905','Vila Nove','pj',now());
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_l399',false) \g /dev/null
select tipo from quero_vender('loja', 'Loja Nove Caca', 'loja-nove-caca', '89999999905');
reset role;
select count(*) as caca_no_funil from funil_lojistas where nome_loja = 'Loja Nove Caca';
update configuracoes set valor = '"em_teste"' where chave = 'funil.etapa_ao_cadastrar' and microrregiao_id is null;
