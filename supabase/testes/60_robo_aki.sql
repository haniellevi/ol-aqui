\set ON_ERROR_STOP 0
\set QUIET on
\pset footer off
-- Robô Aki: limites, orçamento, gravação de custo só pelo servidor, LGPD e painel.
-- Erros esperados estão escritos em cada bloco ("ERRO esperado").
reset role; select set_config('request.jwt.claim.role','',false), set_config('request.jwt.claim.sub','',false) \g /dev/null
select id as reg from microrregioes where slug='corrente-pi' \gset
insert into microrregioes (slug, nome, cidade_sede) values ('outra-60', 'Outra região 60', 'Outra') returning id as reg2 \gset
insert into perfis (id,microrregiao_id,nome,whatsapp,cidade,tipo_pessoa) values
 ('user_a60',:'reg','Ana Aki','5589999996060','Corrente','pf'),
 ('user_b60',:'reg2','Bruno Aki','5589999996161','Outra','pf'),
 ('user_adm60',:'reg','Admin Aki','5589999996262','Corrente','pf');
update perfis set e_admin=true where id='user_adm60';

\echo '[1] semente: 3 modelos Anthropic ativos com preço; robo.ativo nasce desligado'
select provedor, modelo, ativo, le_imagem, usa_ferramentas, preco_entrada_usd, preco_saida_usd, preco_cache_leitura_usd
  from robo_modelos order by preco_entrada_usd desc;
select count(*) as chaves_robo from configuracoes where chave like 'robo.%' and microrregiao_id is null;
select valor as ativo from configuracoes where chave='robo.ativo';

\echo '[2] visitante: nao le catalogo nem chama robo_pode_enviar (2 ERROS esperados: permission denied)'
set role anon; select set_config('request.jwt.claim.role','anon',false) \g /dev/null
select count(*) from robo_modelos;
select * from robo_pode_enviar();

\echo '[3] pessoa logada com o robo desligado: pode=false, motivo desligado'
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_a60',false) \g /dev/null
select pode, motivo, usadas_hoje, limite_diario from robo_pode_enviar();
\echo '[3b] usuario comum nao le o catalogo (0 linhas) nem liga o robo (0 linhas alteradas)'
select count(*) as modelos_visiveis from robo_modelos;
update configuracoes set valor='true' where chave='robo.ativo';
reset role; select valor as continua_desligado from configuracoes where chave='robo.ativo' and microrregiao_id is null;

\echo '[4] admin liga o robo pelo painel (fica no log); agora pode'
set role authenticated; select set_config('request.jwt.claim.sub','user_adm60',false) \g /dev/null
update configuracoes set valor='true' where chave='robo.ativo' and microrregiao_id is null;
reset role; select count(*) as log_ligou from logs_atividade where tabela='configuracoes' and dados_depois->>'chave'='robo.ativo' and usuario_id='user_adm60';
set role authenticated; select set_config('request.jwt.claim.sub','user_a60',false) \g /dev/null
select pode, motivo, usadas_hoje, limite_diario, provedor, modelo, microrregiao_id = :'reg' as regiao_certa from robo_pode_enviar();

\echo '[5] excecao por regiao desliga so a regiao da Ana; Bruno (outra regiao) continua podendo'
reset role; insert into configuracoes (chave, microrregiao_id, valor, grupo) values ('robo.ativo', :'reg', 'false', 'robo');
set role authenticated; select set_config('request.jwt.claim.sub','user_a60',false) \g /dev/null
select pode, motivo from robo_pode_enviar();
select set_config('request.jwt.claim.sub','user_b60',false) \g /dev/null
select pode, motivo from robo_pode_enviar();
reset role; delete from configuracoes where chave='robo.ativo' and microrregiao_id=:'reg';

\echo '[6] usuario nao grava uso nem conversa (4 ERROS esperados: permission denied x3 + RLS no insert do modelo)'
set role authenticated; select set_config('request.jwt.claim.sub','user_a60',false) \g /dev/null
select * from robo_registrar_resposta('user_a60', null, 'conversa', 'anthropic', 'claude-opus-5-5', 0, 0, 0, 0);
insert into robo_uso (usuario_id, tipo, provedor, modelo, custo_centavos) values ('user_a60', 'conversa', 'x', 'y', 0);
insert into robo_conversas (usuario_id) values ('user_a60');
insert into robo_modelos (provedor, modelo, nome) values ('openai', 'falso', 'Modelo falso');
\echo '[6b] usuario nao registra busca vazia (ERRO esperado: permission denied)'
select robo_registrar_busca_vazia('trator', :'reg');

\echo '[7] servidor grava pergunta + resposta; custo calculado no banco (1000 entrada + 500 saida + 2000 cache no Opus a R$ 5,50 = 7,92 centavos)'
set role service_role; select set_config('request.jwt.claim.role','service_role',false), set_config('request.jwt.claim.sub','',false) \g /dev/null
select conversa_id as conv_a, mensagem_id as msg_a, custo_centavos
  from robo_registrar_resposta('user_a60', null, 'conversa', 'anthropic', 'claude-opus-5-5', 1000, 500, 2000, 0,
       '{"texto":"Quero uma moto até 10 mil"}', '{"texto":"Achei duas motos.","cartoes":[]}', 1200, null) \gset
\echo :custo_centavos
select titulo, total_mensagens, custo_centavos from robo_conversas where id=:'conv_a';
select papel, conteudo->>'texto' as texto, tokens_entrada, tokens_saida, custo_centavos from robo_mensagens where conversa_id=:'conv_a' order by id;
select tipo, provedor, modelo, custo_centavos, cotacao_dolar from robo_uso where usuario_id='user_a60';

\echo '[7b] servidor nao usa a conversa da Ana para o Bruno (ERRO esperado: Conversa nao encontrada); tokens negativos (ERRO esperado)'
select * from robo_registrar_resposta('user_b60', :'conv_a', 'conversa', 'anthropic', 'claude-opus-5-5', 1, 1, 0, 0);
select * from robo_registrar_resposta('user_a60', :'conv_a', 'conversa', 'anthropic', 'claude-opus-5-5', -5, 1, 0, 0);
\echo '[7c] tipo inventado (ERRO esperado) e pessoa inexistente (ERRO esperado)'
select * from robo_registrar_resposta('user_a60', null, 'gratis', 'anthropic', 'claude-opus-5-5', 1, 1, 0, 0);
select * from robo_registrar_resposta('user_zz60', null, 'conversa', 'anthropic', 'claude-opus-5-5', 1, 1, 0, 0);

\echo '[8] Ana le a propria conversa; Bruno nao ve nada'
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_a60',false) \g /dev/null
select count(*) as minhas_conversas from robo_conversas;
select count(*) as minhas_mensagens from robo_mensagens;
select count(*) as uso_visivel from robo_uso;
select set_config('request.jwt.claim.sub','user_b60',false) \g /dev/null
select count(*) as conversas_alheias from robo_conversas;
select count(*) as mensagens_alheias from robo_mensagens;

\echo '[9] avaliacao: Bruno nao avalia resposta da Ana (ERRO esperado); Ana avalia, muda e tira'
select robo_avaliar(:msg_a, -1, 'invasão');
select set_config('request.jwt.claim.sub','user_a60',false) \g /dev/null
select robo_avaliar(:msg_a, -1, 'Não achou moto nenhuma');
select nota, comentario from robo_avaliacoes;
select robo_avaliar(:msg_a, 1);
select nota, comentario from robo_avaliacoes;
\echo '[9b] nota invalida (ERRO esperado) e pergunta da propria Ana nao e avaliavel (ERRO esperado)'
select robo_avaliar(:msg_a, 5);
select robo_avaliar(:msg_a - 1, 1);
select robo_avaliar(:msg_a, -1, 'Resposta errada de novo');

\echo '[10] limite diario: admin muda para 2; Ana (2 usos) fica bloqueada; Bruno (0) pode'
set role service_role; select set_config('request.jwt.claim.role','service_role',false) \g /dev/null
select custo_centavos from robo_registrar_resposta('user_a60', :'conv_a', 'conversa', 'anthropic', 'claude-haiku-5-5', 1000, 1000, 0, 0,
       '{"texto":"e carro?"}', '{"texto":"Não achei carro."}', 800, null);
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_adm60',false) \g /dev/null
update configuracoes set valor='2' where chave='robo.limite_diario_pessoa' and microrregiao_id is null;
select set_config('request.jwt.claim.sub','user_a60',false) \g /dev/null
select pode, motivo, usadas_hoje, limite_diario from robo_pode_enviar();
select set_config('request.jwt.claim.sub','user_b60',false) \g /dev/null
select pode, motivo, usadas_hoje from robo_pode_enviar();

\echo '[11] LGPD: Bruno nao apaga a conversa da Ana (0); Ana apaga o historico; o uso continua contando (limite nao zera)'
delete from robo_conversas where id=:'conv_a';
select set_config('request.jwt.claim.sub','user_a60',false) \g /dev/null
delete from robo_conversas where usuario_id='user_a60';
select count(*) as conversas, (select count(*) from robo_mensagens) as mensagens from robo_conversas;
select pode, motivo, usadas_hoje from robo_pode_enviar();
reset role; select count(*) as uso_guardado, count(conversa_id) as com_conversa, count(mensagem_id) as com_mensagem,
                   (select count(*) from robo_avaliacoes) as avaliacoes from robo_uso where usuario_id='user_a60';

\echo '[12] orcamento do mes acabou: Bruno fica bloqueado com motivo orcamento'
update configuracoes set valor='5' where chave='robo.orcamento_mensal_centavos' and microrregiao_id is null;
set role authenticated; select set_config('request.jwt.claim.sub','user_b60',false) \g /dev/null
select pode, motivo from robo_pode_enviar();
reset role; update configuracoes set valor='10000' where chave='robo.orcamento_mensal_centavos' and microrregiao_id is null;
update configuracoes set valor='"abc"' where chave='robo.orcamento_mensal_centavos' and microrregiao_id is null;
set role authenticated; select pode, motivo as orcamento_invalido_bloqueia from robo_pode_enviar();
reset role; update configuracoes set valor='10000' where chave='robo.orcamento_mensal_centavos' and microrregiao_id is null;

\echo '[13] modelo desligado ou sem imagem: sem_modelo; ativar sem preco (ERRO esperado: check)'
set role authenticated; select set_config('request.jwt.claim.sub','user_adm60',false) \g /dev/null
update robo_modelos set ativo=false where modelo='claude-opus-5-5';
select set_config('request.jwt.claim.sub','user_b60',false) \g /dev/null
select pode, motivo from robo_pode_enviar();
select set_config('request.jwt.claim.sub','user_adm60',false) \g /dev/null
update robo_modelos set ativo=true where modelo='claude-opus-5-5';
insert into robo_modelos (provedor, modelo, nome, le_imagem, usa_ferramentas, ativo) values ('openai', 'modelo-sem-preco', 'Sem preço', true, true, true);
insert into robo_modelos (provedor, modelo, nome, le_imagem, usa_ferramentas, preco_entrada_usd, preco_saida_usd)
  values ('openrouter', 'exemplo/modelo-texto', 'Só texto', false, true, 1, 2);
update configuracoes set valor='"openrouter"' where chave='robo.provedor_conversa' and microrregiao_id is null;
update configuracoes set valor='"exemplo/modelo-texto"' where chave='robo.modelo_conversa' and microrregiao_id is null;
select set_config('request.jwt.claim.sub','user_b60',false) \g /dev/null
select pode, motivo as so_texto_nao_serve from robo_pode_enviar();
select set_config('request.jwt.claim.sub','user_adm60',false) \g /dev/null
update configuracoes set valor='"anthropic"' where chave='robo.provedor_conversa' and microrregiao_id is null;
update configuracoes set valor='"claude-opus-5-5"' where chave='robo.modelo_conversa' and microrregiao_id is null;
\echo '[13b] fallback do servidor so para Anthropic (ERRO esperado: check)'
update robo_modelos set fallback_servidor=true where modelo='exemplo/modelo-texto';
\echo '[13c] mudanca de preco do modelo fica no log'
update robo_modelos set preco_saida_usd=21 where modelo='claude-opus-5-5';
reset role; select count(*) as log_modelo from logs_atividade where tabela='robo_modelos' and acao='UPDATE' and usuario_id='user_adm60';
update robo_modelos set preco_saida_usd=20 where modelo='claude-opus-5-5';

\echo '[14] foto usa o modelo da foto (haiku)'
update configuracoes set valor='"claude-haiku-5-5"' where chave='robo.modelo_foto' and microrregiao_id is null;
set role authenticated; select set_config('request.jwt.claim.sub','user_b60',false) \g /dev/null
select pode, provedor, modelo from robo_pode_enviar('foto');

\echo '[15] ajustes da conversa: textos e limites, sem orcamento nem cotacao'
select ajustes ? 'robo.boas_vindas' as boas_vindas, jsonb_array_length(ajustes->'robo.sugestoes') as sugestoes,
       ajustes ? 'robo.orcamento_mensal_centavos' as vaza_orcamento, ajustes ? 'robo.cotacao_dolar' as vaza_cotacao,
       jsonb_typeof(ajustes->'moderacao.palavras_bloqueadas') as palavras, ajustes->>'microrregiao_id' = :'reg2' as regiao
  from robo_ajustes() as ajustes;

\echo '[16] buscas sem resultado: servidor conta (normaliza acento e espaco); usuario nao ve; admin ve'
set role service_role; select set_config('request.jwt.claim.role','service_role',false) \g /dev/null
select robo_registrar_busca_vazia('Trator  Traçado', :'reg', 'tratores-e-maquinas');
select robo_registrar_busca_vazia('trator tracado', :'reg');
select robo_registrar_busca_vazia('TRATOR TRAÇADO', :'reg');
select robo_registrar_busca_vazia(' x ', :'reg');
select termo, termo_normalizado, categoria_slug, vezes from robo_buscas_vazias;
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_a60',false) \g /dev/null
select count(*) as buscas_visiveis_usuario from robo_buscas_vazias;

\echo '[17] painel: usuario comum (ERRO esperado); admin ve custo, provedores, 14 dias, piores e buscas'
select robo_painel();
select set_config('request.jwt.claim.sub','user_adm60',false) \g /dev/null
select (p->>'custo_mes_centavos')::numeric > 0 as tem_custo, jsonb_array_length(p->'por_provedor') as provedores,
       jsonb_array_length(p->'por_dia') as dias, jsonb_array_length(p->'buscas_vazias') as buscas,
       p->'avaliacoes' as avaliacoes, (p->>'orcamento_centavos')::numeric as orcamento
  from robo_painel() p;
select count(*) as uso_admin from robo_uso;

\echo '[18] "Testar" do painel: grava uso tipo teste sem conversa e nao conta no limite de ninguem'
set role service_role; select set_config('request.jwt.claim.role','service_role',false) \g /dev/null
select conversa_id is null as sem_conversa, mensagem_id is null as sem_mensagem, custo_centavos > 0 as custou
  from robo_registrar_resposta('user_adm60', null, 'teste', 'anthropic', 'claude-haiku-5-5', 20, 10, 0, 0);
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_adm60',false) \g /dev/null
select usadas_hoje as usadas_admin from robo_pode_enviar();

\echo '[19] modelo fora do catalogo: grava uso com custo 0 e o motivo'
set role service_role; select set_config('request.jwt.claim.role','service_role',false) \g /dev/null
select custo_centavos from robo_registrar_resposta('user_b60', null, 'conversa', 'openai', 'nao-existe', 10, 10, 0, 0, '{"texto":"oi"}', '{"texto":"oi"}');
reset role; select erro from robo_uso where modelo='nao-existe';

\echo '[20] conta excluida: conversas somem, uso fica sem dono (o custo do mes continua)'
delete from perfis where id='user_b60';
select count(*) as conversas_b from robo_conversas where usuario_id='user_b60';
select count(*) as uso_sem_dono from robo_uso where usuario_id is null and modelo='nao-existe';

\echo '[21] funcoes de gatilho e internas fora da API'
select has_function_privilege('authenticated', 'public.robo_inicio(text)', 'execute') as inicio_autenticado,
       has_function_privilege('anon', 'public.robo_ajustes()', 'execute') as ajustes_anon,
       has_function_privilege('authenticated', 'public.robo_registrar_resposta(text, uuid, text, text, text, integer, integer, integer, integer, jsonb, jsonb, integer, text)', 'execute') as registrar_autenticado,
       has_function_privilege('service_role', 'public.robo_registrar_resposta(text, uuid, text, text, text, integer, integer, integer, integer, jsonb, jsonb, integer, text)', 'execute') as registrar_servidor;
