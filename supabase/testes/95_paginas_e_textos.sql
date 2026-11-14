\set ON_ERROR_STOP 0
\set QUIET on
\pset footer off
-- Páginas e textos (migração 20261108030000): termos e privacidade com versão e aceite,
-- Central de ajuda, blocos da home e "anúncio saiu do ar".
-- Cada bloco [n] diz o que deve acontecer. "ERRO esperado" = a linha ERROR logo abaixo é o certo.

-- Preparação (como o sistema)
reset role; select set_config('request.jwt.claim.role','',false), set_config('request.jwt.claim.sub','',false), set_config('request.headers','',false) \g /dev/null
select id as reg from microrregioes where slug='corrente-pi' \gset
insert into perfis (id,microrregiao_id,nome,whatsapp,cidade,tipo_pessoa) values
 ('user_a95',:'reg','Ana Noventa e Cinco','5589999995001','Corrente','pf'),
 ('user_b95',:'reg','Beto Noventa e Cinco','5589999995002','Corrente','pf'),
 ('user_adm95',:'reg','Admin Noventa e Cinco','5589999995003','Corrente','pf'),
 ('user_x95',:'reg','Xica Sai da Conta','5589999995004','Corrente','pf');
update perfis set e_admin=true where id='user_adm95';
select id as termos_v1 from documentos_legais where tipo='termos' and versao=1 \gset
select id as priv_v1 from documentos_legais where tipo='privacidade' and versao=1 \gset

\echo '[1] semente: termos v1 e privacidade v1 no ar, como RASCUNHO (revisado_advogado = f); 6 categorias da ajuda, perguntas de seguranca, 5 blocos da home e as configuracoes novas'
select tipo, versao, ativo, revisado_advogado, char_length(conteudo) > 2000 as texto_completo,
       conteudo ilike '%revisado por advogado%' as diz_que_foi_revisado
  from documentos_legais order by tipo desc;
select count(*) as categorias from ajuda_categorias;
select count(*) filter (where categoria='seguranca') as perguntas_seguranca, count(*) as perguntas from ajuda_perguntas;
select chave, ordem, ativo, pode_desligar from home_blocos order by ordem;
select chave, publico from configuracoes where chave in ('contato.email_suporte','ajuda.texto_contato','termos.aviso_titulo','termos.aviso_texto','termos.aviso_novo_titulo','termos.aviso_novo_texto') and microrregiao_id is null order by chave;

\echo '[2] visitante le os termos e a ajuda; nao ve pendencias nem grava documento (2 ERROS esperados: permission denied)'
set role anon; select set_config('request.jwt.claim.role','anon',false) \g /dev/null
select tipo, versao from documentos_legais where ativo order by tipo desc;
select count(*) > 0 as ve_ajuda from ajuda_perguntas;
select * from termos_pendentes();
insert into documentos_legais (tipo, versao, titulo, conteudo, ativo) values ('termos', 9, 'Termos falsos', repeat('golpe ', 20), true);

\echo '[3] pessoa logada sem aceite: 2 pendentes (termos e privacidade), primeira_vez = t'
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_a95',false) \g /dev/null
select tipo, versao, primeira_vez from termos_pendentes();

\echo '[4] aceita os dois (2 novos); repetir nao duplica (0); perfil guarda a versao; aceites sem IP (coluna ip_hash nao existe); o IP fica no log'
select set_config('request.headers', '{"x-forwarded-for": "200.1.2.3"}', false) \g /dev/null
select aceitar_documentos_legais(array[:'termos_v1', :'priv_v1']::uuid[]) as aceites_novos;
select aceitar_documentos_legais(array[:'termos_v1', :'priv_v1']::uuid[]) as repetido;
select count(*) as pendentes_depois from termos_pendentes();
select set_config('request.headers', '', false) \g /dev/null
reset role;
select versao_termos, aceitou_termos_em is not null as tem_data from perfis where id='user_a95';
select count(*) as aceites from aceites where usuario_id='user_a95';
select count(*) as colunas_de_ip_em_aceites from information_schema.columns where table_schema='public' and table_name='aceites' and column_name in ('ip', 'ip_hash', 'criado_ip');
select count(*) as logs_com_ip from logs_atividade where tabela='aceites' and usuario_id='user_a95' and ip = '200.1.2.3'::inet;

\echo '[5] a pessoa ve os proprios aceites; outra pessoa nao ve os dela'
set role authenticated; select set_config('request.jwt.claim.sub','user_a95',false) \g /dev/null
select tipo, versao from aceites order by tipo desc;
select set_config('request.jwt.claim.sub','user_b95',false) \g /dev/null
select count(*) as aceites_de_outra_pessoa from aceites where usuario_id='user_a95';

\echo '[6] forjar aceite: INSERT direto falha (ERRO esperado: permission denied); editar o proprio perfil nao muda versao_termos nem a data'
insert into aceites (usuario_id, documento_id, tipo, versao) values ('user_b95', :'termos_v1', 'termos', 1);
update perfis set versao_termos='termos v99', aceitou_termos_em=now(), nome='Beto Editado' where id='user_b95';
reset role;
select nome, versao_termos, aceitou_termos_em from perfis where id='user_b95';

\echo '[6b] aceitar sem login, sem nada, com id inexistente (3 ERROS esperados: permission denied para visitante / nada para aceitar / nao encontrado)'
set role anon; select set_config('request.jwt.claim.role','anon',false), set_config('request.jwt.claim.sub','',false) \g /dev/null
select aceitar_documentos_legais(array[:'termos_v1']::uuid[]);
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_b95',false) \g /dev/null
select aceitar_documentos_legais('{}'::uuid[]);
select aceitar_documentos_legais(array[gen_random_uuid()]);

\echo '[7] quem nao e admin nao publica termos nem marca revisado (2 ERROS esperados: So a equipe)'
select publicar_documento_legal('termos', 'Termos novos', repeat('Texto novo dos termos. ', 10), 'Mudou', true);
select marcar_documento_revisado(:'termos_v1', true);

\echo '[8] admin publica termos v2: v1 sai do ar, v2 entra (fica no log); quem aceitou a v1 ve a v2 pendente com primeira_vez = f'
select set_config('request.jwt.claim.sub','user_adm95',false) \g /dev/null
select (publicar_documento_legal('termos', 'Termos de uso do OLAKI', (select conteudo from documentos_legais where id=:'termos_v1') || E'\n\n## 14. Novidade\n\nRegra nova de teste.', 'Incluímos a regra 14.')).id as termos_v2 \gset
reset role;
select tipo, versao, ativo, revisado_advogado, publicado_por, resumo_mudancas from documentos_legais where tipo='termos' order by versao;
select count(*) as logs_da_publicacao from logs_atividade where tabela='documentos_legais' and usuario_id='user_adm95';
set role authenticated; select set_config('request.jwt.claim.sub','user_a95',false) \g /dev/null
select tipo, versao, primeira_vez, resumo_mudancas from termos_pendentes();

\echo '[9] aceitar a versao velha que a pessoa leu antes da troca falha (ERRO esperado: Os termos mudaram agora); a v2 aceita'
select aceitar_documentos_legais(array[:'termos_v1']::uuid[]);
select aceitar_documentos_legais(array[:'termos_v2']::uuid[]) as aceitou_v2;
reset role;
select versao_termos from perfis where id='user_a95';

\echo '[10] publicar igual ao que esta no ar, curto demais ou tipo errado (3 ERROS esperados)'
set role authenticated; select set_config('request.jwt.claim.sub','user_adm95',false) \g /dev/null
select publicar_documento_legal('termos', 'Termos de uso do OLAKI', (select conteudo from documentos_legais where id=:'termos_v2'));
select publicar_documento_legal('privacidade', 'Política', 'curto');
select publicar_documento_legal('contrato', 'Contrato', repeat('Texto do contrato. ', 10));

\echo '[11] versao publicada nao muda nem some: admin pela API (ERRO esperado: permission denied); nem a chave secreta (2 ERROS esperados: nao muda / nao pode ser apagada)'
update documentos_legais set conteudo = 'trocado' where id=:'termos_v1';
reset role;
update documentos_legais set conteudo = conteudo || ' trocado' where id=:'termos_v1';
delete from documentos_legais where id=:'termos_v1';
select count(*) as versoes_termos from documentos_legais where tipo='termos';

\echo '[12] admin marca a v2 como revisada e volta (fica no log)'
set role authenticated; select set_config('request.jwt.claim.sub','user_adm95',false) \g /dev/null
select marcar_documento_revisado(:'termos_v2', true) as revisado;
select marcar_documento_revisado(:'termos_v2', false) as voltou;
reset role;
select count(*) as logs_revisao from logs_atividade where tabela='documentos_legais' and registro_id=:'termos_v2' and acao='UPDATE';

\echo '[13] publicacoes ao mesmo tempo nao repetem o numero da versao (unique tipo+versao e um ativo por tipo)'
select tipo, count(*) filter (where ativo) as ativos, count(distinct versao) = count(*) as versoes_unicas from documentos_legais group by tipo order by tipo desc;

\echo '[14] ajuda: admin cria e desliga pergunta (no log); visitante nao ve a desligada nem a de categoria desligada'
set role authenticated; select set_config('request.jwt.claim.sub','user_adm95',false) \g /dev/null
insert into ajuda_perguntas (categoria, pergunta, resposta, ordem) values ('comprar', 'Pergunta de teste 95?', 'Resposta de teste 95.', 99) returning id as perg \gset
update ajuda_perguntas set ativo=false where id=:'perg';
insert into ajuda_categorias (slug, nome, ordem, ativa) values ('teste-95', 'Teste 95', 99, false);
insert into ajuda_perguntas (categoria, pergunta, resposta) values ('teste-95', 'Pergunta escondida 95?', 'Resposta escondida 95.');
set role anon; select set_config('request.jwt.claim.role','anon',false), set_config('request.jwt.claim.sub','',false) \g /dev/null
select count(*) as visitante_ve_teste from ajuda_perguntas where pergunta like '%95?';
select count(*) as visitante_ve_categoria_off from ajuda_categorias where slug='teste-95';
reset role;
select acao, count(*) from logs_atividade where tabela='ajuda_perguntas' and usuario_id='user_adm95' group by acao order by acao;

\echo '[15] ajuda: quem nao e admin nao cria (ERRO esperado: row-level security), nao edita nem apaga (0 linhas); categoria com perguntas nao se apaga (ERRO esperado: foreign key); pergunta curta (ERRO esperado: check)'
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_b95',false) \g /dev/null
insert into ajuda_perguntas (categoria, pergunta, resposta) values ('seguranca', 'Pague o sinal por Pix?', 'Pode pagar sim.');
with x as (update ajuda_perguntas set resposta='Pode pagar o sinal.' where categoria='seguranca' returning 1) select count(*) as editadas_por_nao_admin from x;
with x as (delete from ajuda_perguntas where categoria='seguranca' returning 1) select count(*) as apagadas_por_nao_admin from x;
select set_config('request.jwt.claim.sub','user_adm95',false) \g /dev/null
delete from ajuda_categorias where slug='seguranca';
insert into ajuda_perguntas (categoria, pergunta, resposta) values ('comprar', 'Oi', 'Resposta de teste.');

\echo '[16] home: visitante le os blocos; nao admin nao muda (0 linhas); admin muda textos (no log)'
set role anon; select set_config('request.jwt.claim.role','anon',false), set_config('request.jwt.claim.sub','',false) \g /dev/null
select count(*) as blocos_visiveis from home_blocos;
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_b95',false) \g /dev/null
with x as (update home_blocos set titulo='Golpe aqui' where chave='radar' returning 1) select count(*) as mudou_por_nao_admin from x;
select set_config('request.jwt.claim.sub','user_adm95',false) \g /dev/null
update home_blocos set titulo='  Procurando algo?  ', botao='' where chave='radar';
reset role;
select chave, ordem, titulo, botao from home_blocos where chave='radar';
select count(*) as logs_home from logs_atividade where tabela='home_blocos' and usuario_id='user_adm95';

\echo '[17] home: bloco pago e "recentes" nao desligam (2 ERROS esperados: nao pode ser desligado); radar desliga; chave e travas nao mudam (ERRO esperado: permission denied); nao se cria bloco (ERRO esperado: permission denied)'
set role authenticated; select set_config('request.jwt.claim.sub','user_adm95',false) \g /dev/null
update home_blocos set ativo=false where chave='destaques';
update home_blocos set ativo=false where chave='recentes';
update home_blocos set ativo=false where chave='radar';
update home_blocos set pode_desligar=true where chave='destaques';
insert into home_blocos (chave, nome) values ('recentes', 'Outro');
reset role;
select chave, ativo, pode_desligar from home_blocos where chave in ('destaques','recentes','radar') order by chave;
update home_blocos set ativo=true, ordem=30, titulo='Não achou o que queria?', botao='Pedir no Radar' where chave='radar';

\echo '[18] anuncio que saiu do ar: expirado devolve so a categoria; ativo, pausado e inexistente nao devolvem nada'
update configuracoes set valor='"https://abc.supabase.co"' where chave='fotos.origem' and microrregiao_id is null;
insert into vitrines_lojas (dono_id,microrregiao_id,slug,nome,cidade,whatsapp,tipo) values ('user_b95',:'reg','beto-95','Beto','Corrente','5589999995002','pf') returning id as vit_b \gset
select id as cat_moveis from categorias where slug='sofas-e-poltronas' \gset
insert into anuncios (vitrine_id, categoria_id, titulo, cidade, preco_centavos, atributos, fotos, status) values
 (:'vit_b', :'cat_moveis', 'Mesa noventa e cinco', 'Corrente', 30000, '{"estado":"usado"}',
  '{https://abc.supabase.co/storage/v1/object/public/anuncios/user_b95/x/1.webp}', 'ativo') returning id as anu_b \gset
set role anon; select set_config('request.jwt.claim.role','anon',false), set_config('request.jwt.claim.sub','',false) \g /dev/null
select count(*) as ativo_nao_aparece from anuncio_fora_do_ar(:'anu_b');
reset role; update anuncios set status='pausado' where id=:'anu_b';
set role anon;
select count(*) as pausado_nao_aparece from anuncio_fora_do_ar(:'anu_b');
reset role; update anuncios set status='expirado' where id=:'anu_b';
set role anon;
select * from anuncio_fora_do_ar(:'anu_b');
select count(*) as inexistente from anuncio_fora_do_ar(gen_random_uuid());
reset role;

\echo '[19] conta apagada leva os aceites junto (LGPD); as versoes dos termos ficam'
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_x95',false) \g /dev/null
select aceitar_documentos_legais(array(select id from documentos_legais where ativo)) as aceites_x;
reset role;
delete from perfis where id='user_x95';
select count(*) as aceites_da_conta_apagada from aceites where usuario_id='user_x95';
select count(*) as versoes_continuam from documentos_legais;

\echo '[19b] conta de admin que publicou uma versao se apaga (LGPD): publicado_por vira vazio, a versao continua igual'
insert into perfis (id,microrregiao_id,nome,whatsapp,cidade,tipo_pessoa) values ('user_admx95',:'reg','Admin Que Sai','5589999995005','Corrente','pf');
update perfis set e_admin=true where id='user_admx95';
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_admx95',false) \g /dev/null
select (publicar_documento_legal('privacidade', 'Política de privacidade do OLAKI', (select conteudo from documentos_legais where tipo='privacidade' and ativo) || E'\n\nMudança de teste 19b.', 'Teste 19b')).id as priv_admx \gset
select aceitar_documentos_legais(array[:'priv_admx']::uuid[]) as aceite_admx;
reset role;
set role service_role; select set_config('request.jwt.claim.role','service_role',false), set_config('request.jwt.claim.sub','',false) \g /dev/null
delete from perfis where id='user_admx95';
reset role;
select count(*) as admin_ainda_existe from perfis where id='user_admx95';
select count(*) as aceites_do_admin from aceites where usuario_id='user_admx95';
select versao, ativo, publicado_por is null as autor_vazio, resumo_mudancas from documentos_legais where id=:'priv_admx';

\echo '[19c] trocar o autor por outra pessoa continua proibido, ate para a chave secreta (ERRO esperado: nao muda)'
update documentos_legais set publicado_por='user_a95' where id=:'priv_admx';
select publicado_por is null as autor_continua_vazio from documentos_legais where id=:'priv_admx';

\echo '[19d] ordem da home: admin sobe/desce pela funcao (no log); nao admin e visitante nao (2 ERROS esperados: So a equipe / permission denied); ordem direta pela API nao (ERRO esperado: permission denied); recentes acima de bloco pago e bloco pago abaixo de recentes nao (2 ERROS esperados: blocos pagos ficam acima); trava pago nao muda; direcao/bloco invalido (2 ERROS esperados)'
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_adm95',false) \g /dev/null
select mover_bloco_home('radar', 'subir') as subiu_radar;
select mover_bloco_home('destaques', 'subir') as ja_na_ponta;
select chave, ordem from home_blocos order by ordem;
select mover_bloco_home('recentes', 'subir') as recentes_sobe;
select mover_bloco_home('recentes', 'subir') as recentes_sobe_de_novo;
select mover_bloco_home('lojas_destaque', 'descer');
select mover_bloco_home('radar', 'para-o-lado');
select mover_bloco_home('banner', 'subir');
update home_blocos set ordem=99 where chave='destaques';
select set_config('request.jwt.claim.sub','user_b95',false) \g /dev/null
select mover_bloco_home('radar', 'descer');
set role anon; select set_config('request.jwt.claim.role','anon',false), set_config('request.jwt.claim.sub','',false) \g /dev/null
select mover_bloco_home('radar', 'descer');
reset role;
select chave, ordem, pago from home_blocos order by ordem;
select count(*) > 0 as logs_ordem from logs_atividade where tabela='home_blocos' and usuario_id='user_adm95' and acao='UPDATE';
update home_blocos set pago=false where chave='destaques';
select pago as pago_continua from home_blocos where chave='destaques';
update home_blocos set ordem = case chave when 'destaques' then 10 when 'lojas_destaque' then 20 when 'radar' then 30 when 'lojas_regiao' then 40 else 50 end;

\echo '[20] endurecimento: RLS ligada, quem chama cada funcao, gatilhos fora da API'
select relname, relrowsecurity from pg_class where relname in ('documentos_legais','aceites','ajuda_categorias','ajuda_perguntas','home_blocos') order by relname;
select has_function_privilege('anon', 'termos_pendentes()', 'execute') as anon_pendentes,
       has_function_privilege('anon', 'aceitar_documentos_legais(uuid[])', 'execute') as anon_aceita,
       has_function_privilege('anon', 'publicar_documento_legal(text,text,text,text,boolean)', 'execute') as anon_publica,
       has_function_privilege('authenticated', 'aceitar_documentos_legais(uuid[])', 'execute') as logado_aceita,
       has_function_privilege('anon', 'anuncio_fora_do_ar(uuid)', 'execute') as anon_fora_do_ar,
       has_function_privilege('anon', 'mover_bloco_home(text,text)', 'execute') as anon_move_bloco,
       has_function_privilege('authenticated', 'proteger_aceite_perfil()', 'execute') as logado_chama_gatilho,
       has_function_privilege('authenticated', 'proteger_home_bloco()', 'execute') as logado_chama_gatilho_home;
select count(*) as funcoes_novas_sem_search_path from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in ('publicar_documento_legal','marcar_documento_revisado','termos_pendentes','aceitar_documentos_legais',
                                            'anuncio_fora_do_ar','mover_bloco_home','proteger_documento_legal','proteger_aceite_perfil','proteger_home_bloco')
   and not exists (select 1 from unnest(coalesce(p.proconfig,'{}')) c where c like 'search_path=%');
