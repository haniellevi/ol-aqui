\set ON_ERROR_STOP 0
\set QUIET on
\pset footer off
-- Equipe e permissões (tela 14) e Compliance jurídico (tela 8) · migração 20261108050000_equipe_compliance.sql
-- Cada bloco [n] diz o que deve acontecer. "ERRO esperado" = a linha ERROR logo abaixo é o certo.

-- Preparação (como o sistema)
reset role; select set_config('request.jwt.claim.role','',false), set_config('request.jwt.claim.sub','',false), set_config('request.headers','',false) \g /dev/null
select id as reg from microrregioes where slug='corrente-pi' \gset
insert into microrregioes (slug, nome, cidade_sede) values ('outra-97', 'Outra região 97', 'Longe') returning id as reg_outra \gset
insert into perfis (id,microrregiao_id,nome,whatsapp,cidade,tipo_pessoa) values
 ('user_ad97',:'reg','Admin Noventa e Sete','5589999997001','Corrente','pf'),
 ('user_a297',:'reg','Segunda Admin Noventa e Sete','5589999997002','Corrente','pf'),
 ('user_mo97',:'reg','Moderador Noventa e Sete','5589999997003','Corrente','pf'),
 ('user_fi97',:'reg','Financeira Noventa e Sete','5589999997004','Corrente','pf'),
 ('user_su97',:'reg','Suporte Noventa e Sete','5589999997005','Corrente','pf'),
 ('user_fr97',:'reg','Franqueado Noventa e Sete','5589999997006','Corrente','pf'),
 ('user_lj97',:'reg','Lojista Noventa e Sete','5589999997007','Corrente','pj'),
 ('user_co97',:'reg','Comum Noventa e Sete','5589999997008','Corrente','pf'),
 ('user_lo97',:'reg_outra','Loja Longe Noventa e Sete','5589999997009','Longe','pj');
update configuracoes set valor='"https://abc.supabase.co"' where chave='fotos.origem' and microrregiao_id is null;
update configuracoes set valor='1' where chave='anuncio.fotos_minimo' and microrregiao_id is null;
select id as cat_moveis from categorias where slug='moveis' \gset
\set foto_lj '{https://abc.supabase.co/storage/v1/object/public/anuncios/user_lj97/x/1.webp}'

set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_lj97',false) \g /dev/null
select tipo from quero_vender('loja', 'Loja Noventa e Sete', 'loja-noventa-sete', '89999997007') \g /dev/null
select id as vit_lj from vitrines_lojas where dono_id='user_lj97' \gset
insert into anuncios (vitrine_id, categoria_id, titulo, cidade, preco_centavos, atributos, fotos)
values (:'vit_lj', :'cat_moveis', 'Pistola de agua gigante noventa e sete', 'Corrente', 3000, '{}', :'foto_lj') returning id as ad1, status \gset
insert into anuncios (vitrine_id, categoria_id, titulo, cidade, preco_centavos, atributos, fotos)
values (:'vit_lj', :'cat_moveis', 'Revolver de brinquedo noventa e sete', 'Corrente', 3000, '{}', :'foto_lj') returning id as ad2 \gset
insert into anuncios (vitrine_id, categoria_id, titulo, cidade, preco_centavos, atributos, fotos)
values (:'vit_lj', :'cat_moveis', 'Mesa de jantar noventa e sete', 'Corrente', 30000, '{}', :'foto_lj') returning id as ad3 \gset
insert into anuncios (vitrine_id, categoria_id, titulo, cidade, preco_centavos, atributos, fotos)
values (:'vit_lj', :'cat_moveis', 'Cadeira que vai sumir noventa e sete', 'Corrente', 3000, '{}', :'foto_lj') returning id as ad_apagado \gset
delete from anuncios where id=:'ad_apagado';
select set_config('request.jwt.claim.sub','user_lo97',false) \g /dev/null
select tipo from quero_vender('loja', 'Loja Longe Noventa e Sete', 'loja-longe-noventa-sete', '89999997009') \g /dev/null
select id as vit_lo from vitrines_lojas where dono_id='user_lo97' \gset
reset role; select set_config('request.jwt.claim.role','',false), set_config('request.jwt.claim.sub','',false) \g /dev/null
insert into denuncias (alvo_tipo, alvo_id, denunciante_id, motivo) values ('anuncio', :'ad1', 'user_co97', 'proibido');
insert into denuncias (alvo_tipo, alvo_id, denunciante_id, motivo) values ('anuncio', :'ad3', 'user_co97', 'falso') returning id as den3 \gset
insert into radar_pedidos (comprador_id, microrregiao_id, titulo, cidade) values ('user_co97', :'reg', 'Procuro pistola de pressao noventa e sete', 'Corrente') returning id as ped1 \gset
insert into pagamentos (vitrine_id, microrregiao_id, tipo, plano_codigo, valor_centavos, status) values (:'vit_lj', :'reg', 'assinatura', 'slim', 4990, 'pago');
insert into perfis_verificacoes (perfil_id, tipo) values ('user_lj97', 'cnpj') returning id as verif \gset
update vitrines_lojas set banner_tipo='foto', banner_url='https://abc.supabase.co/storage/v1/object/public/anuncios/user_lj97/vitrine/b.webp' where id=:'vit_lj';

\echo '[1] semente: admins de antes (perfis.e_admin) ja estao na equipe como administrador; anuncios 1 e 2 e o pedido seguraram (palavra)'
update perfis set e_admin=true where id='user_ad97';
select papel, ativo, microrregiao_id is null as sem_regiao from equipe where usuario_id='user_ad97';
select count(*) = (select count(*) from perfis where e_admin) as todo_admin_na_equipe
  from equipe where papel='administrador' and ativo;
select chave, valor from configuracoes where chave like 'compliance.%' and microrregiao_id is null order by chave;
select status from anuncios where id in (:'ad1', :'ad2') order by titulo;
select status from radar_pedidos where id=:'ped1';

\echo '[2] admin: meu_papel = administrador, tem todos os papeis; pessoa comum: nulo/false; visitante: false (RLS publica segue funcionando) e nao le a equipe (ERRO esperado: permission denied)'
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_ad97',false) \g /dev/null
select meu_papel(), tem_papel('moderador') as mod, tem_papel('franqueado') as fran, pode_ver_regiao(:'reg_outra') as outra;
select set_config('request.jwt.claim.sub','user_co97',false) \g /dev/null
select meu_papel() is null as sem_papel, tem_papel('moderador') as mod, tem_papel('administrador') as adm, pode_ver_regiao(:'reg') as regiao;
set role anon; select set_config('request.jwt.claim.role','anon',false), set_config('request.jwt.claim.sub','',false) \g /dev/null
select tem_papel('moderador') as anon_mod, pode_ver_regiao(:'reg') as anon_regiao;
select count(*) >= 1 as anon_le_anuncios from anuncios where id=:'ad3';
select count(*) as anon_le_equipe from equipe;

\echo '[3] admin monta a equipe: moderador, financeiro, suporte e franqueado (com regiao)'
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_ad97',false) \g /dev/null
select equipe_salvar('user_mo97', 'moderador', null, 'Cuida da fila');
select equipe_salvar('user_fi97', 'financeiro', :'reg', null);
select equipe_salvar('user_su97', 'suporte');
select equipe_salvar('user_fr97', 'franqueado', :'reg', 'Franquia de Corrente');
select usuario_id, papel, microrregiao_id is not null as tem_regiao, ativo, adicionado_por from equipe
 where usuario_id in ('user_mo97','user_fi97','user_su97','user_fr97') order by usuario_id;
reset role; select count(*) as logs_equipe from logs_atividade where tabela='equipe' and usuario_id='user_ad97';
set role authenticated;

\echo '[3b] franqueado sem regiao (ERRO esperado: regiao); papel inventado (ERRO esperado: papel); mudar a si mesmo (ERRO esperado: proprio papel); conta que nao existe (ERRO esperado: nao encontrada)'
select equipe_salvar('user_co97', 'franqueado', null);
select equipe_salvar('user_co97', 'dono');
select equipe_salvar('user_ad97', 'moderador');
select equipe_salvar('user_naoexiste97', 'moderador');

\echo '[3c] lista e busca de contas (admin): pelo celular, pelo nome e pelos ids achados no Clerk'
select usuario_id, papel, regiao_nome is not null as tem_regiao, ativo from equipe_lista() where usuario_id like 'user_%97' order by usuario_id;
select usuario_id, papel from equipe_buscar_conta('(89) 99999-7008');
select usuario_id from equipe_buscar_conta('comum noventa');
select usuario_id from equipe_buscar_conta(null, array['user_co97','user_lj97']) order by usuario_id;
select count(*) as busca_vazia from equipe_buscar_conta('');

\echo '[4] quem nao e admin nao mexe na equipe (ERRO esperado x4: so um administrador) e cada um le so a propria linha'
select set_config('request.jwt.claim.sub','user_mo97',false) \g /dev/null
select equipe_salvar('user_co97', 'moderador');
select equipe_desativar('user_fi97');
select * from equipe_lista();
select * from equipe_buscar_conta('comum');
select usuario_id, papel from equipe;
select set_config('request.jwt.claim.sub','user_co97',false) \g /dev/null
select count(*) as comum_ve_equipe from equipe;
\echo '[4b] escrever direto na tabela (ERRO esperado x3: permission denied)'
insert into equipe (usuario_id, papel) values ('user_co97', 'administrador');
update equipe set papel='administrador' where usuario_id='user_mo97';
delete from equipe where usuario_id='user_mo97';
\echo '[4c] visitante (ERRO esperado x2: permission denied)'
set role anon; select set_config('request.jwt.claim.role','anon',false), set_config('request.jwt.claim.sub','',false) \g /dev/null
select equipe_salvar('user_co97', 'administrador');
select meu_papel();
\echo '[4d] pessoa nao liga e_admin no proprio perfil (fica false, sem linha na equipe)'
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_co97',false) \g /dev/null
update perfis set e_admin=true where id='user_co97';
reset role; select e_admin, (select count(*) from equipe where usuario_id='user_co97') as na_equipe from perfis where id='user_co97';

\echo '[5] moderador: ve a fila, aprova o anuncio 1 (denuncia fecha improcedente) e recusa o 2 (pausado com motivo)'
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_mo97',false) \g /dev/null
select meu_papel(), tem_papel('financeiro') as fin;
select count(*) as fila_anuncios from anuncios where status='em_analise' and id in (:'ad1', :'ad2');
select count(*) as fila_pedidos from radar_pedidos where id=:'ped1' and status='em_analise';
select count(*) as denuncias_abertas from denuncias where alvo_id in (:'ad1', :'ad3') and status='aberta';
select moderar_anuncio(:'ad1', 'aprovar');
select moderar_anuncio(:'ad2', 'recusar', 'Arma de brinquedo nao pode');
select titulo, status, motivo_analise from anuncios where id in (:'ad1', :'ad2') order by titulo;
select status, resolvido_por from denuncias where alvo_id=:'ad1';
reset role; select count(*) as log_moderacao from logs_atividade where tabela='anuncios' and registro_id=:'ad1' and usuario_id='user_mo97';
set role authenticated;
\echo '[5b] de novo no mesmo anuncio (ERRO esperado: nao esta mais em analise); acao inventada (ERRO esperado: invalida); congelar e so do administrador (ERRO esperado: Compliance)'
select moderar_anuncio(:'ad1', 'recusar', 'x');
select moderar_anuncio(:'ad3', 'apagar');
select congelar_anuncio(:'ad3', 'teste');
\echo '[5c] pedido do Radar: recusar tira pela moderacao (o comprador ve o motivo) e o moderador devolve pelo moderar_radar'
select moderar_pedido(:'ped1', 'recusar', 'Arma nao pode');
select status, fechado_motivo, moderado_motivo from radar_pedidos where id=:'ped1';
select moderar_radar('pedido', :'ped1', 'devolver');
select status, fechado_motivo from radar_pedidos where id=:'ped1';
\echo '[5d] denuncia solta: procede; de novo (ERRO esperado: ja resolvida); banner da loja: o moderador tira a foto'
select resolver_denuncia(:'den3', true);
select status from denuncias where id=:'den3';
select resolver_denuncia(:'den3', false);
select moderar_banner_vitrine(:'vit_lj', 'Foto com telefone') is not null as devolveu_url;
select banner_tipo, banner_url is null as sem_foto from vitrines_lojas where id=:'vit_lj';
\echo '[5e] moderador nao ve pagamentos (0) nem a lista de lojas (ERRO esperado: so a equipe) nem os totais (ERRO esperado: pagamentos)'
select count(*) as mod_pagamentos from pagamentos where vitrine_id=:'vit_lj';
select count(*) from admin_lojas();
select count(*) from admin_resumo_pagamentos();

\echo '[6] financeiro: le pagamentos e totais; nao modera (ERRO esperado x3), nao mexe em loja (ERRO esperado)'
select set_config('request.jwt.claim.sub','user_fi97',false) \g /dev/null
select count(*) as fin_pagamentos from pagamentos where vitrine_id=:'vit_lj';
select status, tipo, quantidade, total_centavos from admin_resumo_pagamentos(null, null, :'reg') where tipo='assinatura' and status='pago' and total_centavos >= 4990 limit 1;
select count(*) >= 1 as fin_le_nome_da_loja from vitrines_lojas where id=:'vit_lj';
select moderar_anuncio(:'ad3', 'aprovar');
select resolver_denuncia(:'den3', false);
select moderar_radar('pedido', :'ped1', 'ocultar', 'teste financeiro');
select admin_acao_loja(:'vit_lj', 'suspender', 'teste financeiro');

\echo '[7] suporte: lista de lojas, suspende e reativa, analisa verificacao; nao da cortesia, nao troca plano, nao da selo (ERRO esperado x3: suporte nao mexe)'
select set_config('request.jwt.claim.sub','user_su97',false) \g /dev/null
select count(*) >= 2 as suporte_ve_todas from admin_lojas() where id in (:'vit_lj', :'vit_lo');
select admin_acao_loja(:'vit_lj', 'suspender', 'Pedido do dono por telefone');
reset role; select status from vitrines_lojas where id=:'vit_lj';
set role authenticated;
select admin_acao_loja(:'vit_lj', 'reativar', 'Dono resolveu');
select admin_acao_loja(:'vit_lj', 'cortesia', 'quero dar dias', 10);
select admin_acao_loja(:'vit_lj', 'trocar_plano', 'quero trocar', 30, 'full');
select admin_acao_loja(:'vit_lj', 'dar_selo', 'quero dar selo');
reset role; select status, plano, selo_loja_verificada from vitrines_lojas where id=:'vit_lj';
select acao, admin_id from vitrines_acoes_admin where vitrine_id=:'vit_lj' order by criado_em;
set role authenticated;
select admin_analisar_verificacao(:'verif', true);
select count(*) as suporte_ve_verificacoes from perfis_verificacoes where perfil_id='user_lj97';
\echo '[7b] suporte nao modera (ERRO esperado) nem ve pagamentos (0)'
select moderar_anuncio(:'ad3', 'aprovar');
select count(*) as sup_pagamentos from pagamentos where vitrine_id=:'vit_lj';

\echo '[8] franqueado: so a regiao dele (pedir outra regiao devolve a dele); nenhuma acao (ERRO esperado x2); nao ve pagamentos (0)'
select set_config('request.jwt.claim.sub','user_fr97',false) \g /dev/null
select meu_papel(), minha_regiao_equipe() = :'reg' as regiao_dele, pode_ver_regiao(:'reg') as ve_sua, pode_ver_regiao(:'reg_outra') as ve_outra;
select count(*) filter (where id=:'vit_lj') as ve_loja_dele, count(*) filter (where id=:'vit_lo') as ve_loja_longe,
       count(*) filter (where microrregiao_id <> :'reg') as fora_da_regiao from admin_lojas(null, null, :'reg_outra');
select admin_acao_loja(:'vit_lj', 'suspender', 'franqueado tentando');
select admin_resumo_pagamentos();
select count(*) as fran_pagamentos from pagamentos where vitrine_id=:'vit_lj';

\echo '[9] desativar: o moderador perde o acesso na hora (ERRO esperado: so a equipe de moderacao); reativar devolve'
select set_config('request.jwt.claim.sub','user_ad97',false) \g /dev/null
select equipe_desativar('user_mo97', 'Saiu da equipe');
select ativo, desativado_por, desativado_em is not null as tem_data from equipe where usuario_id='user_mo97';
select set_config('request.jwt.claim.sub','user_mo97',false) \g /dev/null
select meu_papel() is null as sem_papel;
select moderar_anuncio(:'ad3', 'aprovar');
select set_config('request.jwt.claim.sub','user_ad97',false) \g /dev/null
select equipe_salvar('user_mo97', 'moderador');
select ativo, desativado_em is null as sem_data from equipe where usuario_id='user_mo97';
\echo '[9b] desativar a si mesmo (ERRO esperado: a si mesmo); quem nao esta na equipe (ERRO esperado: nao esta)'
select equipe_desativar('user_ad97');
select equipe_desativar('user_co97');

\echo '[10] administrador novo: liga perfis.e_admin; ele rebaixa o primeiro (perde o admin e vira moderador)'
select equipe_salvar('user_a297', 'administrador', :'reg');
reset role; select e_admin from perfis where id='user_a297';
select papel, microrregiao_id is null as sem_regiao from equipe where usuario_id='user_a297';
set role authenticated; select set_config('request.jwt.claim.sub','user_a297',false) \g /dev/null
select e_admin() as a2_admin, meu_papel();
select equipe_salvar('user_ad97', 'moderador');
reset role; select e_admin from perfis where id='user_ad97';
set role authenticated; select set_config('request.jwt.claim.sub','user_ad97',false) \g /dev/null
select meu_papel();
\echo '[10b] o rebaixado nao mexe mais na equipe (ERRO esperado: so um administrador)'
select equipe_salvar('user_a297', 'moderador');

\echo '[11] nunca sem administrador: quem chama e admin so pelo perfil (linha da equipe fora de sincronia); rebaixar ou tirar a unica administradora da equipe e recusado (ERRO esperado x2: pelo menos um administrador)'
reset role; select set_config('request.jwt.claim.role','',false), set_config('request.jwt.claim.sub','',false) \g /dev/null
update perfis set e_admin=false where e_admin and id not in ('user_a297');
select count(*) as admins_ativos from equipe where papel='administrador' and ativo;
select set_config('olaki.equipe_sync','1',false) \g /dev/null
update perfis set e_admin=true where id='user_ad97';
select set_config('olaki.equipe_sync','',false) \g /dev/null
select usuario_id, papel, ativo from equipe where usuario_id in ('user_ad97','user_a297') order by usuario_id;
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_ad97',false) \g /dev/null
select equipe_salvar('user_a297', 'moderador');
select equipe_desativar('user_a297');
reset role; select set_config('request.jwt.claim.role','',false), set_config('request.jwt.claim.sub','',false) \g /dev/null
select papel, ativo from equipe where usuario_id='user_a297';
\echo '[11b] perfis.e_admin pelo Supabase acompanha a equipe: ligar cria administrador, desligar desativa'
update perfis set e_admin=true where id='user_co97';
select papel, ativo from equipe where usuario_id='user_co97';
update perfis set e_admin=false where id='user_co97';
select papel, ativo from equipe where usuario_id='user_co97';
update perfis set e_admin=false where id='user_ad97';
update perfis set e_admin=true where id='user_ad97';
select papel, ativo from equipe where usuario_id='user_ad97';

\echo '[12] Compliance: entrar grava; sem motivo nao abre (ERRO esperado: motivo); com motivo devolve a consulta'
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_ad97',false),
  set_config('request.headers','{"x-forwarded-for":"200.1.2.3","user-agent":"Teste97"}',false) \g /dev/null
select compliance_entrar('177.10.20.30');
select compliance_abrir('  ', '177.10.20.30');
select compliance_abrir('Oficio 123/2026 Delegacia de Corrente', '177.10.20.30') as consulta \gset
\echo '[12b] busca pelo celular, pelo titulo do anuncio, pelo id do anuncio apagado; busca curta (ERRO esperado: 3 letras)'
select tipo, id from compliance_buscar(:'consulta', '89 99999-7007') order by tipo;
select tipo, id = :'ad3' as e_o_anuncio, usuario_id from compliance_buscar(:'consulta', 'mesa de jantar noventa');
select tipo, titulo, usuario_id from compliance_buscar(:'consulta', :'ad_apagado');
select * from compliance_buscar(:'consulta', 'ab');
\echo '[12c] dados da conta: perfil completo (celular, IP do cadastro), lojas, anuncios, apagado e historico com IP e campos mudados'
select d->'perfil'->>'whatsapp' as celular, d ? 'aceites' as tem_aceites, jsonb_array_length(d->'lojas') as lojas,
       jsonb_array_length(d->'anuncios') as anuncios, jsonb_array_length(d->'anuncios_apagados') as apagados,
       jsonb_array_length(d->'historico') > 5 as tem_historico, (d->>'meses_historico')::int as meses
  from compliance_conta(:'consulta', 'user_lj97', '177.10.20.30') d;
select h->>'tabela' as tabela, h->>'acao' as acao, h->>'ip' as ip, h->'campos' ? 'status' as mudou_status
  from compliance_conta(:'consulta', 'user_lj97') d, jsonb_array_elements(d->'historico') h
 where h->>'registro_id' = :'ad2' and h->>'acao' = 'UPDATE' and h->'campos' ? 'status' limit 1;
\echo '[12d] relatorio: sem motivo (ERRO esperado: motivo); com motivo; o cabecalho tem quem gerou, quando e o motivo'
select compliance_pedir_relatorio(:'consulta', 'user_lj97', '');
select compliance_pedir_relatorio(:'consulta', 'user_lj97', 'Oficio 123/2026 item 2', '177.10.20.30') as rel \gset
select r->'cabecalho'->>'motivo' as motivo, r->'cabecalho'->>'gerado_por_nome' as quem, r->'cabecalho'->>'motivo_consulta' as motivo_consulta,
       r->'cabecalho'->>'ip_navegador' as ip_navegador, jsonb_array_length(r->'dados'->'anuncios') as anuncios
  from compliance_relatorio(:'rel', '177.10.20.30') r;

\echo '[13] Compliance negado: outra admin nao usa a consulta nem o relatorio de outro (ERRO esperado x2: acabou); consulta vencida (ERRO esperado: acabou)'
select set_config('request.jwt.claim.sub','user_a297',false) \g /dev/null
select * from compliance_buscar(:'consulta', 'mesa de jantar');
select compliance_relatorio(:'rel');
reset role; select set_config('request.jwt.claim.role','',false), set_config('request.jwt.claim.sub','',false) \g /dev/null
insert into compliance_acessos (admin_id, tipo, motivo, criado_em) values ('user_ad97', 'abrir', 'Oficio velho', now() - interval '3 hours') returning id as velha \gset
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_ad97',false) \g /dev/null
select * from compliance_buscar(:'velha', 'mesa de jantar');
\echo '[13b] moderador, financeiro e suporte nao usam o Compliance (ERRO esperado x4: so um administrador)'
select set_config('request.jwt.claim.sub','user_mo97',false) \g /dev/null
select compliance_entrar();
select compliance_abrir('Curiosidade');
select set_config('request.jwt.claim.sub','user_fi97',false) \g /dev/null
select compliance_conta(:'consulta', 'user_lj97');
select set_config('request.jwt.claim.sub','user_su97',false) \g /dev/null
select compliance_relatorio(:'rel');
select count(*) as sup_ve_acessos from compliance_acessos;
\echo '[13c] funcao interna e escrita direta (ERRO esperado x3: permission denied); visitante (ERRO esperado: permission denied)'
select set_config('request.jwt.claim.sub','user_ad97',false) \g /dev/null
select compliance_dados('user_lj97');
insert into compliance_acessos (admin_id, tipo) values ('user_ad97', 'entrar');
delete from compliance_acessos;
set role anon; select set_config('request.jwt.claim.role','anon',false), set_config('request.jwt.claim.sub','',false) \g /dev/null
select compliance_abrir('visitante');
\echo '[13d] registro do Compliance nao muda nem some, nem pelo sistema (ERRO esperado x2: nao pode ser mudado)'
reset role; select set_config('request.jwt.claim.role','',false), set_config('request.jwt.claim.sub','',false), set_config('request.headers','',false) \g /dev/null
update compliance_acessos set motivo='apagado' where id=:'consulta';
delete from compliance_acessos where id=:'consulta';

\echo '[14] tudo ficou registrado (acessos por tipo, com IPs) e cada acesso tambem caiu em logs_atividade'
select tipo, count(*) from compliance_acessos where admin_id='user_ad97' and criado_em > now() - interval '1 hour' group by tipo order by tipo;
select ip_navegador, ip from compliance_acessos where id=:'consulta';
select (select count(*) from logs_atividade where tabela='compliance_acessos') = (select count(*) from compliance_acessos) as tudo_no_log;

\echo '[15] configuracao estranha nao quebra o Compliance: minutos 90.7 viram 90, texto usa o padrao; meses abaixo de 6 (ou decimal) ficam em 6 (Marco Civil)'
update configuracoes set valor='90.7' where chave='compliance.consulta_minutos' and microrregiao_id is null;
update configuracoes set valor='1.5' where chave='compliance.meses_historico' and microrregiao_id is null;
update configuracoes set valor='"muitas"' where chave='compliance.max_linhas_historico' and microrregiao_id is null;
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_ad97',false) \g /dev/null
select count(*) >= 1 as busca_funciona from compliance_buscar(:'consulta', 'mesa de jantar noventa');
select (d->>'meses_historico')::int as meses, (d->>'historico_limite')::int as limite from compliance_conta(:'consulta', 'user_lj97') d;
reset role; update configuracoes set valor='"seis"' where chave='compliance.meses_historico' and microrregiao_id is null;
update configuracoes set valor='3' where chave='compliance.consulta_minutos' and microrregiao_id is null;
set role authenticated;
select (d->>'meses_historico')::int as meses from compliance_conta(:'consulta', 'user_lj97') d;
select r->'dados'->>'meses_historico' as meses_relatorio from compliance_relatorio(:'rel') r;
reset role;
update configuracoes set valor='60' where chave='compliance.consulta_minutos' and microrregiao_id is null;
update configuracoes set valor='6' where chave='compliance.meses_historico' and microrregiao_id is null;
update configuracoes set valor='2000' where chave='compliance.max_linhas_historico' and microrregiao_id is null;
\echo '[15b] a funcao de apoio e interna (ERRO esperado: permission denied)'
set role authenticated;
select config_inteiro('compliance.meses_historico', 6, 6, 120);

\echo '[16] conta apagada (o golpista apaga a conta: o Clerk apaga o perfil e tudo cai em cascata)'
reset role; select set_config('request.jwt.claim.role','',false), set_config('request.jwt.claim.sub','',false) \g /dev/null
insert into perfis (id,microrregiao_id,nome,whatsapp,cidade,tipo_pessoa) values ('user_go97',:'reg','Golpista Noventa e Sete','5589988887797','Corrente','pj');
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_go97',false) \g /dev/null
select tipo from quero_vender('loja', 'Loja Golpe Noventa e Sete', 'loja-golpe-noventa-sete', '89988887798') \g /dev/null
select id as vit_go from vitrines_lojas where dono_id='user_go97' \gset
insert into anuncios (vitrine_id, categoria_id, titulo, cidade, preco_centavos, atributos, fotos)
values (:'vit_go', :'cat_moveis', 'Sofa golpe noventa e sete', 'Corrente', 50000, '{}', '{https://abc.supabase.co/storage/v1/object/public/anuncios/user_go97/x/1.webp}') returning id as ad_go \gset
set role service_role; select set_config('request.jwt.claim.role','service_role',false), set_config('request.jwt.claim.sub','',false) \g /dev/null
delete from perfis where id='user_go97';
reset role; select count(*) as sobrou_loja from vitrines_lojas where id=:'vit_go';
select tabela, count(*) as apagados from logs_atividade where acao='DELETE' and registro_id in ('user_go97', :'vit_go', :'ad_go') group by tabela order by tabela;
\echo '[16b] admin acha a conta apagada pelo celular dela, pelo nome, pelo nome e celular da loja e pelo titulo; o anuncio apagado leva ao dono'
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_ad97',false) \g /dev/null
select tipo, id, usuario_id, detalhe like 'Conta apagada em %' as diz_apagada from compliance_buscar(:'consulta', '(89) 98888-7797');
select tipo, id from compliance_buscar(:'consulta', 'golpista noventa');
select tipo, id from compliance_buscar(:'consulta', 'Loja Golpe');
select tipo, id from compliance_buscar(:'consulta', '89988887798');
select tipo, usuario_id from compliance_buscar(:'consulta', 'sofa golpe');
select tipo, titulo, usuario_id from compliance_buscar(:'consulta', :'ad_go');
\echo '[16c] dados da conta apagada: ultimo cadastro guardado, loja apagada (com celular), anuncio apagado e o historico com os DELETE da loja e do anuncio'
select jsonb_typeof(d->'perfil') = 'null' as sem_perfil, d->'perfil_apagado'->'dados'->>'whatsapp' as celular_guardado,
       jsonb_array_length(d->'lojas') as lojas, jsonb_array_length(d->'lojas_apagadas') as lojas_apagadas,
       d->'lojas_apagadas'->0->>'whatsapp' as fone_loja, jsonb_array_length(d->'anuncios_apagados') as anuncios_apagados
  from compliance_conta(:'consulta', 'user_go97') d;
select h->>'tabela' as tabela, h->>'acao' as acao
  from compliance_conta(:'consulta', 'user_go97') d, jsonb_array_elements(d->'historico') h
 where h->>'acao' = 'DELETE' order by 1;
\echo '[16d] conta viva nao ganha "perfil_apagado" nem loja apagada'
select jsonb_typeof(d->'perfil_apagado') = 'null' as sem_apagado, jsonb_array_length(d->'lojas_apagadas') as lojas_apagadas from compliance_conta(:'consulta', 'user_lj97') d;

\echo '[17] busca por e-mail: o servidor manda os ids achados no Clerk; so esses contam (nem nome nem anuncio); lista vazia = nada; a busca fica gravada com o e-mail'
select tipo, id from compliance_buscar(:'consulta', 'lojista97@exemplo.com', null, array['user_lj97']);
select count(*) as nada from compliance_buscar(:'consulta', 'mesa@exemplo.com', null, array[]::text[]);
reset role; select count(*) as gravou from compliance_acessos where tipo='buscar' and busca='lojista97@exemplo.com';

\echo '[18] franqueado tem uma fonte so: equipe e microrregioes.franqueado_id andam juntas'
select franqueado_id from microrregioes where id=:'reg';
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_ad97',false) \g /dev/null
\echo '[18b] segundo franqueado na mesma regiao (ERRO esperado: ja tem um franqueado)'
select equipe_salvar('user_co97', 'franqueado', :'reg');
\echo '[18c] franqueado troca de regiao (o espelho anda junto) e depois sai da equipe (o espelho limpa)'
select equipe_salvar('user_fr97', 'franqueado', :'reg_outra');
reset role; select (select franqueado_id from microrregioes where id=:'reg') as corrente, (select franqueado_id from microrregioes where id=:'reg_outra') as outra;
set role authenticated;
select equipe_desativar('user_fr97', 'Fim da franquia');
reset role; select count(*) as regioes_com_ele from microrregioes where franqueado_id='user_fr97';
\echo '[18d] ligado direto em microrregioes.franqueado_id (pelo Supabase): vira franqueado na equipe; trocar desliga o anterior'
update microrregioes set franqueado_id='user_fr97' where id=:'reg';
select papel, ativo, microrregiao_id = :'reg' as regiao_certa from equipe where usuario_id='user_fr97';
update microrregioes set franqueado_id='user_co97' where id=:'reg';
select usuario_id, papel, ativo from equipe where usuario_id in ('user_fr97','user_co97') order by usuario_id;
update microrregioes set franqueado_id=null where id=:'reg';
select ativo from equipe where usuario_id='user_co97';
\echo '[18e] pessoa com outro papel nao vira franqueado pelo Supabase (ERRO esperado: outro papel)'
update microrregioes set franqueado_id='user_mo97' where id=:'reg';
select franqueado_id is null as segue_vazio from microrregioes where id=:'reg';

\echo '[19] lista da equipe diz quem tirou cada pessoa (nao quem pôs)'
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_a297',false) \g /dev/null
reset role; update perfis set e_admin=true where id='user_a297';
set role authenticated;
select equipe_salvar('user_su97', 'suporte');
select set_config('request.jwt.claim.sub','user_ad97',false) \g /dev/null
select equipe_desativar('user_su97', 'Saiu');
select usuario_id, adicionado_por_nome, desativado_por_nome from equipe_lista() where usuario_id='user_su97';
reset role; select set_config('request.jwt.claim.role','',false), set_config('request.jwt.claim.sub','',false) \g /dev/null
