\set ON_ERROR_STOP 0
\set QUIET on
\pset footer off
-- Radar completo (migração 20261108020000): pedir, propor, escolher, avisos e moderação.
-- Cada bloco [n] diz o que deve acontecer; "ERRO esperado" = a linha ERROR que aparece é o certo.

-- Preparação (como o sistema)
reset role; select set_config('request.jwt.claim.role','',false), set_config('request.jwt.claim.sub','',false) \g /dev/null
select id as reg from microrregioes where slug='corrente-pi' \gset
insert into microrregioes (slug, nome, cidade_sede) values ('outra-90', 'Outra Região 90', 'Cidade Outra') returning id as reg_outra \gset
insert into cidades (microrregiao_id, nome, uf) values (:'reg_outra', 'Cidade Outra', 'BA');
insert into perfis (id,microrregiao_id,nome,whatsapp,cidade,tipo_pessoa) values
 ('user_c90',:'reg','Carla Compradora','5589999999001','Corrente','pf'),
 ('user_s90',:'reg','Sem Celular','5589999999002','Corrente','pf'),
 ('user_t90',:'reg','Tania Lojista','5589999999003','Corrente','pj'),
 ('user_p90',:'reg','Paulo Lojista','5589999999004','Corrente','pj'),
 ('user_r90',:'reg_outra','Rui Longe','5577999999005','Cidade Outra','pj'),
 ('user_adm90',:'reg','Admin Radar','5589999999006','Corrente','pf');
update perfis set whatsapp_verificado_em=now() where id in ('user_c90','user_p90');
update perfis set e_admin=true where id='user_adm90';
insert into vitrines_lojas (dono_id,microrregiao_id,slug,nome,cidade,whatsapp,tipo,plano,teste_expira_em) values
 ('user_t90',:'reg','loja-tania-90','Loja da Tânia','Corrente','5589999999003','loja','teste',now()+interval '10 days');
insert into vitrines_lojas (dono_id,microrregiao_id,slug,nome,cidade,whatsapp,tipo,plano,plano_expira_em) values
 ('user_p90',:'reg','motos-paulo-90','Motos do Paulo','Corrente','5589999999004','loja','full',now()+interval '30 days'),
 ('user_r90',:'reg_outra','loja-rui-90','Loja do Rui','Cidade Outra','5577999999005','loja','full',now()+interval '30 days');
select id as vit_t from vitrines_lojas where dono_id='user_t90' \gset
select id as vit_p from vitrines_lojas where dono_id='user_p90' \gset
select id as cat_motos from categorias where slug='motos' \gset
select id as cat_moveis from categorias where slug='moveis' \gset
update configuracoes set valor='"https://abc.supabase.co"' where chave='fotos.origem' and microrregiao_id is null;
insert into anuncios (vitrine_id, categoria_id, titulo, cidade, preco_centavos, atributos, fotos, status) values
 (:'vit_p', :'cat_motos', 'Honda Biz 125 2020', 'Corrente', 900000, '{"marca":"Honda","modelo":"Biz","ano":2020,"km":10000}',
  '{https://abc.supabase.co/storage/v1/object/public/anuncios/user_p90/x/1.webp}', 'ativo') returning id as anu_p \gset
insert into anuncios (vitrine_id, categoria_id, titulo, cidade, preco_centavos, atributos, fotos, status) values
 (:'vit_t', :'cat_moveis', 'Sofá de 3 lugares novo', 'Corrente', 150000, '{"estado":"novo"}',
  '{https://abc.supabase.co/storage/v1/object/public/anuncios/user_t90/x/1.webp}', 'ativo') returning id as anu_t \gset
-- limites folgados durante os testes (os blocos de limite mudam e voltam)
update configuracoes set valor='100' where chave in ('radar.pedidos_por_dia','radar.pedidos_abertos_max') and microrregiao_id is null;

\echo '[1] configuracoes novas do Radar estao no painel (grupo radar)'
select count(*) as chaves_radar_novas from configuracoes
 where grupo='radar' and microrregiao_id is null
   and chave in ('radar.pedidos_por_dia','radar.pedidos_abertos_max','radar.proposta_mensagem_max','radar.fotos_max_pasta',
                 'radar.avisos_ligados','radar.avisos_lojas_por_dia','radar.avisos_lojas_max_por_pedido',
                 'radar.aviso.proposta_nova.titulo','radar.aviso.proposta_nova.texto','radar.aviso.prazo_acabou.titulo',
                 'radar.aviso.prazo_acabou.texto','radar.aviso.prazo_sem_propostas.texto','radar.aviso.pedido_novo.titulo',
                 'radar.aviso.pedido_novo.texto','radar.aviso.proposta_escolhida.titulo','radar.aviso.proposta_escolhida.texto');
select propostas_radar_mes as propostas_do_teste from planos where codigo='teste';

\echo '[2] visitante nao cria pedido nem le avisos (2 ERROS esperados: permission denied)'
set role anon; select set_config('request.jwt.claim.role','anon',false) \g /dev/null
select criar_pedido_radar('Procuro moto barata para roça', 'Corrente');
select count(*) from notificacoes;

\echo '[3] comprador sem celular confirmado nao pede (ERRO esperado: Confirme seu celular)'
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_s90',false) \g /dev/null
select criar_pedido_radar('Procuro moto barata para roça', 'Corrente');

\echo '[4] comprador confirmado pede (WhatsApp na hora): cidade certa, categoria da tabela vira enum'
select set_config('request.jwt.claim.sub','user_c90',false) \g /dev/null
select (criar_pedido_radar('Procuro moto Biz até 10 mil', 'corrente', 'whatsapp_direto', null, 'De preferência 2018 para cima',
        :'cat_motos', 300000, 1000000)) ->> 'id' as ped_a \gset
select titulo, cidade, categoria, status, modo_contato, preco_min_centavos, preco_max_centavos, origem, total_propostas
  from radar_pedidos where id=:'ped_a';

\echo '[4b] aviso de pedido novo: so a loja que vende motos na regiao (nao a de moveis, nem a de outra regiao)'
reset role;
select usuario_id, tipo, titulo, texto, link = '/radar/'||:'ped_a' as link_certo from notificacoes where chave='pedido_novo:'||:'ped_a' and usuario_id like 'user_%90' order by usuario_id;

\echo '[5] pedido com prazo de 72 h; prazo fora da lista do painel falha (ERRO esperado: prazos da lista)'
set role authenticated;
select (criar_pedido_radar('Procuro geladeira duplex frost free', 'Corrente', 'propostas_prazo', 72, null, null, null, 200000)) ->> 'id' as ped_b \gset
select modo_contato, prazo_horas, propostas_ate between now() + interval '71 hours' and now() + interval '73 hours' as prazo_72h,
       categoria from radar_pedidos where id=:'ped_b';
select criar_pedido_radar('Procuro geladeira duplex frost free', 'Corrente', 'propostas_prazo', 5);

\echo '[6] cidade de fora da regiao, faixa de preco invertida e titulo curto (3 ERROS esperados)'
select criar_pedido_radar('Procuro moto Biz até 10 mil', 'Cidade Outra');
select criar_pedido_radar('Procuro moto Biz até 10 mil', 'Corrente', 'whatsapp_direto', null, null, null, 900000, 100000);
select criar_pedido_radar('Moto', 'Corrente');

\echo '[7] limite por dia e de pedidos abertos vem do painel (2 ERROS esperados)'
reset role; update configuracoes set valor='3' where chave='radar.pedidos_por_dia' and microrregiao_id is null;
set role authenticated;
select (criar_pedido_radar('Procuro mesa de jantar 6 cadeiras', 'Corrente')) ->> 'status' as terceiro_do_dia;
select criar_pedido_radar('Procuro mesa de jantar 8 cadeiras', 'Corrente');
reset role; update configuracoes set valor='100' where chave='radar.pedidos_por_dia' and microrregiao_id is null;
update configuracoes set valor='3' where chave='radar.pedidos_abertos_max' and microrregiao_id is null;
set role authenticated;
select criar_pedido_radar('Procuro mesa de jantar 8 cadeiras', 'Corrente');
reset role; update configuracoes set valor='100' where chave='radar.pedidos_abertos_max' and microrregiao_id is null;
select id as ped_c from radar_pedidos where titulo='Procuro mesa de jantar 6 cadeiras' \gset

\echo '[8] INSERT direto pela API tambem respeita o limite (ERRO esperado: ja fez 3 pedidos hoje)'
update configuracoes set valor='3' where chave='radar.pedidos_por_dia' and microrregiao_id is null;
set role authenticated;
insert into radar_pedidos (comprador_id, microrregiao_id, titulo, cidade) values ('user_c90', :'reg', 'Procuro bicicleta aro 29', 'Corrente');
reset role; update configuracoes set valor='100' where chave='radar.pedidos_por_dia' and microrregiao_id is null;

\echo '[9] INSERT direto nao forja regiao, fechamento nem prazo gigante (fica na regiao do perfil, sem fechamento, prazo de no maximo 168 h)'
set role authenticated;
insert into radar_pedidos (comprador_id, microrregiao_id, titulo, cidade, modo_contato, propostas_ate, fechado_motivo, moderado_motivo)
values ('user_c90', :'reg_outra', 'Procuro bicicleta aro 29 boa', 'Corrente', 'propostas_prazo', now() + interval '400 days', 'resolvido', 'x');
reset role;
select microrregiao_id = :'reg' as regiao_do_perfil, fechado_motivo, moderado_motivo, propostas_ate <= now() + interval '168 hours' as prazo_limitado
  from radar_pedidos where titulo='Procuro bicicleta aro 29 boa';

\echo '[10] palavra proibida: pedido vai para analise e nenhuma loja e avisada'
set role authenticated;
select (criar_pedido_radar('Procuro pistola de pressão usada', 'Corrente')) ->> 'id' as ped_f \gset
reset role;
select status, motivo_analise, (select count(*) from notificacoes where chave='pedido_novo:'||:'ped_f') as avisos from radar_pedidos where id=:'ped_f';

\echo '[11] loja em teste propoe no pedido com prazo: foto do OLAKI + preco + mensagem; comprador recebe aviso'
set role authenticated; select set_config('request.jwt.claim.sub','user_t90',false) \g /dev/null
select propostas_restantes() as antes;
select modo, whatsapp, proposta_id is not null as criou, editada
  from propor_radar(:'ped_b', null, 'https://abc.supabase.co/storage/v1/object/public/anuncios/user_t90/radar-'||:'ped_b'||'/1.webp', 185000, 'Geladeira Consul 340L, entrego');
select propostas_restantes() as depois;
reset role;
select tipo, titulo, texto, link = '/radar/pedido/'||:'ped_b' as link_certo from notificacoes where usuario_id='user_c90' and tipo='proposta_nova';

\echo '[12] proposta incompleta ou forjada no modo prazo (5 ERROS esperados: preco, anuncio/foto, foto de fora, anuncio de outra loja, palavra proibida)'
set role authenticated; select set_config('request.jwt.claim.sub','user_p90',false) \g /dev/null
select * from propor_radar(:'ped_b', :'anu_p', null, null, 'Tenho');
select * from propor_radar(:'ped_b', null, null, 190000, 'Tenho');
select * from propor_radar(:'ped_b', null, 'https://abc.supabase.co/storage/v1/object/public/anuncios/user_t90/radar-'||:'ped_b'||'/1.webp', 190000);
select * from propor_radar(:'ped_b', :'anu_t', null, 190000);
select * from propor_radar(:'ped_b', :'anu_p', null, 190000, 'Aceito pix antecipado');

\echo '[13] loja paga propoe com anuncio dela; editar a propria proposta nao gasta vaga'
select modo, editada from propor_radar(:'ped_b', :'anu_p', null, 199000, 'Biz não, mas tenho geladeira');
select modo, editada from propor_radar(:'ped_b', null, null, 179000, 'Baixei o preço');
reset role;
select total_propostas from radar_pedidos where id=:'ped_b';
select preco_centavos, mensagem, anuncio_id = :'anu_p' as manteve_anuncio from radar_propostas where pedido_id=:'ped_b' and vitrine_id=:'vit_p';

\echo '[14] loja nao propoe no proprio pedido (ERRO esperado)'
set role authenticated; select set_config('request.jwt.claim.sub','user_p90',false) \g /dev/null
select (criar_pedido_radar('Procuro cadeira de escritório', 'Corrente')) ->> 'id' as ped_d \gset
select * from propor_radar(:'ped_d', null, null, 50000);

\echo '[15] loja de outra regiao nao propoe (ERRO esperado)'
select set_config('request.jwt.claim.sub','user_r90',false) \g /dev/null
select * from propor_radar(:'ped_a', null, null, 900000);

\echo '[16] modo WhatsApp: a loja recebe o WhatsApp confirmado do comprador; teste gratis acaba na 4a proposta (ERRO esperado)'
select set_config('request.jwt.claim.sub','user_t90',false) \g /dev/null
select modo, whatsapp, mensagem from propor_radar(:'ped_a', null, null, 950000, 'Tenho uma Biz 2019');
select modo, whatsapp is null as sem_contato from propor_radar(:'ped_c', null, null, 120000, 'Mesa de madeira maciça');
select propostas_restantes() as restantes;
select * from propor_radar(:'ped_d', null, null, 40000, 'Cadeira giratória');

\echo '[17] comprador compara as propostas (sem contato); outra pessoa nao ve nada'
set role authenticated; select set_config('request.jwt.claim.sub','user_c90',false) \g /dev/null
select loja_nome, loja_tipo, preco_centavos, foto_url is not null as tem_foto, anuncio_titulo, mensagem from propostas_do_pedido(:'ped_b');
select set_config('request.jwt.claim.sub','user_s90',false) \g /dev/null
select count(*) as outra_pessoa from propostas_do_pedido(:'ped_b');
select count(*) as direto_outra_pessoa from radar_propostas;
select set_config('request.jwt.claim.sub','user_t90',false) \g /dev/null
select count(*) as loja_ve_so_as_suas from radar_propostas;

\echo '[18] tela do pedido: loja com Radar ve detalhes; quem nao tem Radar nao; loja de outra regiao ve sem poder propor'
select titulo, detalhes, comprador_primeiro_nome, situacao, ja_propus, mesma_regiao, tem_acesso from radar_pedido(:'ped_a');
select set_config('request.jwt.claim.sub','user_s90',false) \g /dev/null
select titulo, detalhes, comprador_primeiro_nome, tem_acesso from radar_pedido(:'ped_a');
select set_config('request.jwt.claim.sub','user_r90',false) \g /dev/null
select titulo, mesma_regiao from radar_pedido(:'ped_a');
select count(*) as em_analise_para_loja from radar_pedido(:'ped_f');
select set_config('request.jwt.claim.sub','user_c90',false) \g /dev/null
select situacao from radar_pedido(:'ped_f');

\echo '[19] abas: meus pedidos (total e menor preco) e minhas propostas'
select titulo, situacao, total_propostas, menor_preco_centavos from meus_pedidos_radar() where id in (:'ped_a', :'ped_b', :'ped_c') order by titulo;
select set_config('request.jwt.claim.sub','user_t90',false) \g /dev/null
select pedido_titulo, situacao, preco_centavos, status from minhas_propostas_radar() order by pedido_titulo;

\echo '[20] feed tem as colunas novas (categoria da tabela, preco minimo, se e meu)'
select set_config('request.jwt.claim.sub','user_c90',false) \g /dev/null
select titulo, categoria_nome, preco_min_centavos, sou_comprador from radar_feed() where id=:'ped_a';

\echo '[21] comprador escolhe: recebe o WhatsApp da loja e a loja e avisada uma vez so; outra pessoa nao escolhe (ERRO esperado)'
select id as prop_p from radar_propostas where pedido_id=:'ped_b' and vitrine_id=:'vit_p' \gset
select whatsapp, mensagem from escolher_proposta(:'prop_p');
select whatsapp from escolher_proposta(:'prop_p');
reset role;
select count(*) as avisos_escolhida, max(texto) as texto from notificacoes where usuario_id='user_p90' and tipo='proposta_escolhida';
set role authenticated; select set_config('request.jwt.claim.sub','user_s90',false) \g /dev/null
select * from escolher_proposta(:'prop_p');

\echo '[22] avisos: cada um ve so os seus; ninguem grava aviso nem muda direto (2 ERROS esperados); marcar como lidos'
select count(*) as sem_celular_ve from notificacoes;
insert into notificacoes (usuario_id, tipo, titulo, texto) values ('user_s90', 'golpe', 'Ganhou', 'Clique aqui');
select set_config('request.jwt.claim.sub','user_c90',false) \g /dev/null
update notificacoes set lida_em = now();
select count(*) filter (where lida_em is null) as nao_lidas_antes from notificacoes;
select marcar_notificacoes_lidas() > 0 as marcou;
select count(*) filter (where lida_em is null) as nao_lidas_depois from notificacoes;

\echo '[23] funcoes internas fora da API (3 ERROS esperados: permission denied)'
select notificar('user_c90', 'golpe', 'Ganhou', 'Clique');
select radar_avisar_prazos();
select * from radar_propor(:'ped_b', null, null, 1, null, false);

\echo '[24] prazo acabou: resumo ao comprador (com e sem propostas) e a rotina encerra o vencido'
reset role; select set_config('request.jwt.claim.role','',false), set_config('request.jwt.claim.sub','',false) \g /dev/null
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_c90',false) \g /dev/null
select (criar_pedido_radar('Procuro carrinho de bebê usado', 'Corrente', 'propostas_prazo', 24)) ->> 'id' as ped_i \gset
reset role; select set_config('request.jwt.claim.role','',false), set_config('request.jwt.claim.sub','',false) \g /dev/null
update radar_pedidos set propostas_ate = now() - interval '1 minute' where id in (:'ped_b', :'ped_i');
update radar_pedidos set expira_em = now() - interval '1 minute' where id = :'ped_c';
select radar_avisar_prazos() as resumos;
select radar_avisar_prazos() as de_novo_nada;
select texto from notificacoes where usuario_id='user_c90' and tipo='prazo_acabou' order by texto;
select expirar_rotina();
select status, fechado_motivo from radar_pedidos where id=:'ped_c';
select resumo_enviado_em is not null as resumo_marcado from radar_pedidos where id=:'ped_b';

\echo '[25] depois do prazo a loja nao edita mais (ERRO esperado); o comprador ainda escolhe'
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_t90',false) \g /dev/null
select * from propor_radar(:'ped_b', null, null, 150000);
select set_config('request.jwt.claim.sub','user_c90',false) \g /dev/null
select situacao from radar_pedido(:'ped_b');
select whatsapp from escolher_proposta((select id from radar_propostas where pedido_id=:'ped_b' and vitrine_id=:'vit_t'));

\echo '[26] comprador nao estica prazo, nao troca o modo e nao reabre pedido fechado (ERRO esperado ao reabrir)'
update radar_pedidos set expira_em = now() + interval '300 days', modo_contato = 'whatsapp_direto', detalhes = 'Pode ser usada' where id=:'ped_b';
select expira_em < now() + interval '30 days' as validade_mantida, modo_contato, detalhes from radar_pedidos where id=:'ped_b';
update radar_pedidos set status = 'aberto' where id=:'ped_c';

\echo '[27] Ja resolvi e Cancelar; repetir nao quebra; outra pessoa nao fecha (ERRO esperado)'
select fechar_pedido_radar(:'ped_a', 'resolvido') as resolvido, fechar_pedido_radar(:'ped_a', 'resolvido') as repetido;
select fechar_pedido_radar(:'ped_i', 'cancelado') as cancelado;
select status, fechado_motivo, fechado_em is not null as data from radar_pedidos where id in (:'ped_a', :'ped_i') order by status;
select set_config('request.jwt.claim.sub','user_s90',false) \g /dev/null
select fechar_pedido_radar(:'ped_b', 'cancelado');

\echo '[28] moderacao: nao-admin nao modera; motivo obrigatorio (2 ERROS esperados)'
select moderar_radar('proposta', :'prop_p', 'ocultar', 'Golpe');
select set_config('request.jwt.claim.sub','user_adm90',false) \g /dev/null
select moderar_radar('proposta', :'prop_p', 'ocultar', '');

\echo '[28b] ocultar proposta: comprador deixa de ver; a loja ve o motivo e nao edita (ERRO esperado ao editar); devolver'
select moderar_radar('proposta', :'prop_p', 'ocultar', 'Foto de outro produto');
select set_config('request.jwt.claim.sub','user_c90',false) \g /dev/null
select count(*) as comprador_ve from propostas_do_pedido(:'ped_b');
select set_config('request.jwt.claim.sub','user_p90',false) \g /dev/null
select status, moderado_motivo from minhas_propostas_radar() where id=:'prop_p';
reset role; update radar_pedidos set propostas_ate = now() + interval '1 day', resumo_enviado_em = null where id=:'ped_b';
set role authenticated; select set_config('request.jwt.claim.sub','user_p90',false) \g /dev/null
select * from propor_radar(:'ped_b', null, null, 1000);
select set_config('request.jwt.claim.sub','user_adm90',false) \g /dev/null
select moderar_radar('proposta', :'prop_p', 'devolver') as devolver;

\echo '[28c] remover proposta libera a vaga e fica no log com o motivo; ocultar/devolver/remover pedido'
select moderar_radar('proposta', :'prop_p', 'remover', 'Pedido do próprio lojista');
select moderar_radar('pedido', :'ped_d', 'ocultar', 'Pedido repetido');
select set_config('request.jwt.claim.sub','user_t90',false) \g /dev/null
select count(*) as feed_sem_oculto from radar_feed() where id=:'ped_d';
select set_config('request.jwt.claim.sub','user_adm90',false) \g /dev/null
select moderar_radar('pedido', :'ped_d', 'devolver') as devolver;
select moderar_radar('pedido', :'ped_f', 'remover', 'Item proibido');
reset role;
select total_propostas from radar_pedidos where id=:'ped_b';
select status, fechado_motivo from radar_pedidos where id=:'ped_d';
select count(*) as pedido_removido from radar_pedidos where id=:'ped_f';
select tabela, acao, usuario_id, coalesce(dados_depois->>'moderado_motivo', dados_antes->>'moderado_motivo') as motivo
  from logs_atividade
 where (tabela='radar_propostas' and registro_id=:'prop_p' and acao in ('UPDATE','DELETE'))
    or (tabela='radar_pedidos' and registro_id=:'ped_f' and acao='DELETE')
 order by id;

\echo '[29] fotos da proposta no Storage: so loja com Radar, pedido aberto de outra pessoa e da mesma regiao'
set role authenticated; select set_config('request.jwt.claim.sub','user_t90',false) \g /dev/null
select pode_enviar_foto('user_t90/radar-'||:'ped_d'||'/1.webp') as pedido_aberto,
       pode_enviar_foto('user_p90/radar-'||:'ped_d'||'/1.webp') as pasta_de_outro,
       pode_enviar_foto('user_t90/radar-'||:'ped_a'||'/1.webp') as pedido_fechado,
       pode_enviar_foto('user_t90/radarx/1.webp') as pasta_estranha;
select set_config('request.jwt.claim.sub','user_p90',false) \g /dev/null
select pode_enviar_foto('user_p90/radar-'||:'ped_d'||'/1.webp') as proprio_pedido;
select set_config('request.jwt.claim.sub','user_c90',false) \g /dev/null
select pode_enviar_foto('user_c90/radar-'||:'ped_d'||'/1.webp') as comprador_sem_loja;

\echo '[30] caminho do Aki: categoria antiga e origem aki'
select (criar_pedido_radar('Procuro trator pequeno usado', 'Corrente', 'whatsapp_direto', null, null, null, null, 8000000, 'esta_semana', 'veiculo', 'aki')) ->> 'id' as ped_g \gset
select categoria, origem, urgencia from radar_pedidos where id=:'ped_g';

\echo '[31] teto de avisos por loja por dia vem do painel (a loja de motos ja recebeu hoje)'
reset role; update configuracoes set valor='1' where chave='radar.avisos_lojas_por_dia' and microrregiao_id is null;
set role authenticated; select set_config('request.jwt.claim.sub','user_c90',false) \g /dev/null
select (criar_pedido_radar('Procuro capacete de moto tamanho 58', 'Corrente', 'whatsapp_direto', null, null, :'cat_motos')) ->> 'id' as ped_h \gset
reset role;
select count(*) as avisos_do_pedido_h from notificacoes where chave='pedido_novo:'||:'ped_h';
update configuracoes set valor='10' where chave='radar.avisos_lojas_por_dia' and microrregiao_id is null;

\echo '[32] aviso desligado no painel nao e gravado'
update configuracoes set valor='["prazo_acabou", "pedido_novo", "proposta_escolhida"]' where chave='radar.avisos_ligados' and microrregiao_id is null;
set role authenticated; select set_config('request.jwt.claim.sub','user_p90',false) \g /dev/null
select modo from propor_radar(:'ped_h', :'anu_p', null, 25000, 'Tenho capacete');
reset role;
select count(*) as aviso_desligado from notificacoes where usuario_id='user_c90' and tipo='proposta_nova' and dados->>'pedido' like 'Procuro capacete%';
update configuracoes set valor='["proposta_nova", "prazo_acabou", "pedido_novo", "proposta_escolhida"]' where chave='radar.avisos_ligados' and microrregiao_id is null;

\echo '[33] funcao antiga revelar_contato_radar continua com as mesmas colunas'
set role authenticated; select set_config('request.jwt.claim.sub','user_p90',false) \g /dev/null
select modo, whatsapp, mensagem from revelar_contato_radar(:'ped_g');

\echo '[34] visitante nao le pedido, propostas nem abas (3 ERROS esperados: permission denied)'
set role anon; select set_config('request.jwt.claim.role','anon',false), set_config('request.jwt.claim.sub','',false) \g /dev/null
select * from radar_pedido(:'ped_g');
select * from propostas_do_pedido(:'ped_b');
select * from meus_pedidos_radar();

\echo '[35] endurecimento: funcoes novas com search_path; gatilhos e internas fora da API'
reset role; select set_config('request.jwt.claim.role','',false), set_config('request.jwt.claim.sub','',false) \g /dev/null
select count(*) as sem_search_path from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.prokind = 'f'
   and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')
   and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e');
select has_function_privilege('authenticated', 'radar_avisar_proposta()', 'execute') as gatilho_aviso,
       has_function_privilege('authenticated', 'radar_validar_pedido()', 'execute') as gatilho_validar,
       has_function_privilege('authenticated', 'expirar_rotina()', 'execute') as rotina,
       has_function_privilege('service_role', 'expirar_rotina()', 'execute') as rotina_servidor,
       has_function_privilege('anon', 'criar_pedido_radar(text,text,text,integer,text,uuid,bigint,bigint,text,text,text)', 'execute') as anon_cria,
       has_function_privilege('authenticated', 'criar_pedido_radar(text,text,text,integer,text,uuid,bigint,bigint,text,text,text)', 'execute') as logado_cria;
select relrowsecurity as rls_notificacoes from pg_class where relname='notificacoes';

-- ===================== Correções da revisão =====================
reset role; select set_config('request.jwt.claim.role','',false), set_config('request.jwt.claim.sub','',false) \g /dev/null
insert into perfis (id,microrregiao_id,nome,whatsapp,cidade,tipo_pessoa) values
 ('user_spam90',:'reg','Conta Spam','5589999999011','Corrente','pf'),
 ('user_leg90',:'reg','Lia Legítima','5589999999012','Corrente','pf'),
 ('user_l90',:'reg','Luiz Lojista','5589999999013','Corrente','pj'),
 ('user_q90',:'reg','Quitéria Lojista','5589999999014','Corrente','pj'),
 ('user_b90',:'reg','Beto Comprador','5589999999015','Corrente','pf');
update perfis set whatsapp_verificado_em=now() where id in ('user_spam90','user_leg90','user_l90','user_q90','user_b90');
insert into vitrines_lojas (dono_id,microrregiao_id,slug,nome,cidade,whatsapp,tipo,plano,plano_expira_em) values
 ('user_l90',:'reg','loja-luiz-90','Loja do Luiz','Corrente','5589999999013','loja','full',now()+interval '30 days');
insert into vitrines_lojas (dono_id,microrregiao_id,slug,nome,cidade,whatsapp,tipo,plano,teste_expira_em) values
 ('user_q90',:'reg','loja-quiteria-90','Loja da Quitéria','Corrente','5589999999014','loja','teste',now()+interval '10 days');

\echo '[36] IP de quem propos nao sai pela API: nem comprador nem loja leem criado_ip (2 ERROS esperados: permission denied)'
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_c90',false) \g /dev/null
select criado_ip from radar_propostas where pedido_id=:'ped_b';
select * from radar_propostas where pedido_id=:'ped_b';
select count(*) > 0 as comprador_ve_sem_ip from (select id, preco_centavos, mensagem from radar_propostas where pedido_id=:'ped_b') x;
select set_config('request.jwt.claim.sub','user_t90',false) \g /dev/null
select count(*) > 0 as loja_ve_as_suas from (select id, status, moderado_motivo from radar_propostas) x;
reset role;
select has_column_privilege('authenticated','public.radar_propostas','criado_ip','select') as logado_le_ip,
       has_column_privilege('authenticated','public.radar_propostas','preco_centavos','select') as logado_le_preco,
       has_table_privilege('anon','public.radar_propostas','select') as anon_le;

\echo '[37] conta sozinha nao lota o aviso das lojas: teto por comprador (2) e pedido cancelado nao gasta o teto da loja'
reset role; update configuracoes set valor='3' where chave='radar.avisos_lojas_por_dia' and microrregiao_id is null;
set role authenticated; select set_config('request.jwt.claim.sub','user_spam90',false) \g /dev/null
select (criar_pedido_radar('Procuro qualquer coisa barata 1', 'Corrente')) ->> 'id' as sp1 \gset
select (criar_pedido_radar('Procuro qualquer coisa barata 2', 'Corrente')) ->> 'id' as sp2 \gset
select (criar_pedido_radar('Procuro qualquer coisa barata 3', 'Corrente')) ->> 'id' as sp3 \gset
select fechar_pedido_radar(:'sp1','cancelado'), fechar_pedido_radar(:'sp2','cancelado'), fechar_pedido_radar(:'sp3','cancelado');
select set_config('request.jwt.claim.sub','user_leg90',false) \g /dev/null
select (criar_pedido_radar('Procuro fogão de 4 bocas', 'Corrente')) ->> 'id' as leg1 \gset
reset role;
select count(*) filter (where chave in ('pedido_novo:'||:'sp1','pedido_novo:'||:'sp2','pedido_novo:'||:'sp3')) as spam_avisos,
       count(*) filter (where chave = 'pedido_novo:'||:'leg1') as aviso_legitimo
  from notificacoes where usuario_id='user_l90' and tipo='pedido_novo';
update configuracoes set valor='10' where chave='radar.avisos_lojas_por_dia' and microrregiao_id is null;

\echo '[38] pedido com prazo acabado nao segura vaga de pedido aberto (1 ERRO esperado: ja tem 1 pedidos abertos)'
update configuracoes set valor='1' where chave='radar.pedidos_abertos_max' and microrregiao_id is null;
set role authenticated; select set_config('request.jwt.claim.sub','user_leg90',false) \g /dev/null
select fechar_pedido_radar(:'leg1','cancelado');
select (criar_pedido_radar('Procuro geladeira usada boa', 'Corrente', 'propostas_prazo', 24)) ->> 'id' as leg2 \gset
select criar_pedido_radar('Procuro máquina de lavar', 'Corrente');
reset role; update radar_pedidos set propostas_ate = now() - interval '1 minute' where id=:'leg2';
set role authenticated; select set_config('request.jwt.claim.sub','user_leg90',false) \g /dev/null
select situacao from meus_pedidos_radar() where id=:'leg2';
select (criar_pedido_radar('Procuro máquina de lavar', 'Corrente')) ->> 'status' as depois_do_prazo_pode;
reset role; update configuracoes set valor='100' where chave='radar.pedidos_abertos_max' and microrregiao_id is null;

\echo '[39] depois que o comprador escolhe, a loja nao muda preco nem mensagem (ERRO esperado); chamar de novo no WhatsApp continua'
set role authenticated; select set_config('request.jwt.claim.sub','user_leg90',false) \g /dev/null
select (criar_pedido_radar('Procuro bicicleta infantil aro 16', 'Corrente')) ->> 'id' as leg3 \gset
select set_config('request.jwt.claim.sub','user_p90',false) \g /dev/null
select proposta_id as prop_k from propor_radar(:'leg3', null, null, 90000, 'Tenho uma Caloi') \gset
select set_config('request.jwt.claim.sub','user_leg90',false) \g /dev/null
select whatsapp from escolher_proposta(:'prop_k');
select set_config('request.jwt.claim.sub','user_p90',false) \g /dev/null
select * from propor_radar(:'leg3', null, null, 500000, 'Agora custa mais');
select modo, whatsapp, editada from propor_radar(:'leg3');
select set_config('request.jwt.claim.sub','user_leg90',false) \g /dev/null
select preco_centavos, mensagem, escolhida from propostas_do_pedido(:'leg3');

\echo '[40] tela do pedido mostra o motivo do fechamento so para o dono'
select situacao, fechado_motivo from radar_pedido(:'leg1');
select set_config('request.jwt.claim.sub','user_p90',false) \g /dev/null
select fechado_motivo as loja_ve_motivo from radar_pedido(:'leg3');

\echo '[41] cada pessoa liga e desliga seus avisos; desligado nao e gravado (3 ERROS esperados: tipo fora da lista, gravar direto, visitante)'
select set_config('request.jwt.claim.sub','user_l90',false) \g /dev/null
select salvar_preferencia_aviso('pedido_novo', false) as ligado;
select salvar_preferencia_aviso('golpe', false);
insert into preferencias_avisos (usuario_id, tipo, ligado) values ('user_c90', 'proposta_nova', false);
select set_config('request.jwt.claim.sub','user_c90',false) \g /dev/null
select count(*) as ve_preferencia_de_outro from preferencias_avisos;
select set_config('request.jwt.claim.sub','user_b90',false) \g /dev/null
select (criar_pedido_radar('Procuro ventilador de teto', 'Corrente')) ->> 'id' as b1 \gset
reset role;
select count(*) filter (where usuario_id='user_l90') as desligado_nao_recebe,
       count(*) filter (where usuario_id='user_t90') as outra_loja_recebe
  from notificacoes where chave='pedido_novo:'||:'b1';
set role authenticated; select set_config('request.jwt.claim.sub','user_l90',false) \g /dev/null
select salvar_preferencia_aviso('pedido_novo', true) as religou;
select tipo, ligado from preferencias_avisos;
set role anon; select set_config('request.jwt.claim.role','anon',false), set_config('request.jwt.claim.sub','',false) \g /dev/null
select salvar_preferencia_aviso('pedido_novo', false);

\echo '[42] propostas mandadas ao mesmo tempo nao passam do teste gratis (ERRO esperado: usou todas as propostas)'
reset role; select set_config('request.jwt.claim.role','',false), set_config('request.jwt.claim.sub','',false) \g /dev/null
create extension if not exists dblink;
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','user_b90',false) \g /dev/null
select (criar_pedido_radar('Procuro tanquinho de lavar 1', 'Corrente')) ->> 'id' as q1 \gset
select (criar_pedido_radar('Procuro tanquinho de lavar 2', 'Corrente')) ->> 'id' as q2 \gset
select (criar_pedido_radar('Procuro tanquinho de lavar 3', 'Corrente')) ->> 'id' as q3 \gset
select (criar_pedido_radar('Procuro tanquinho de lavar 4', 'Corrente')) ->> 'id' as q4 \gset
select set_config('request.jwt.claim.sub','user_q90',false) \g /dev/null
select modo from propor_radar(:'q1', null, null, 10000);
select modo from propor_radar(:'q2', null, null, 10000);
select propostas_restantes() as sobra_uma;
reset role; select set_config('request.jwt.claim.role','',false), set_config('request.jwt.claim.sub','',false) \g /dev/null
select dblink_connect('c1', 'dbname=olaki') as c1, dblink_connect('c2', 'dbname=olaki') as c2;
select dblink_exec('c1', 'set role authenticated') \g /dev/null
select dblink_exec('c1', 'set request.jwt.claim.role = ''authenticated''') \g /dev/null
select dblink_exec('c1', 'set request.jwt.claim.sub = ''user_q90''') \g /dev/null
select dblink_exec('c2', 'set role authenticated') \g /dev/null
select dblink_exec('c2', 'set request.jwt.claim.role = ''authenticated''') \g /dev/null
select dblink_exec('c2', 'set request.jwt.claim.sub = ''user_q90''') \g /dev/null
select dblink_exec('c1', 'begin') \g /dev/null
select modo as primeira_sem_commit from dblink('c1', format('select modo from propor_radar(%L, null, null, 10000)', :'q3')) as t(modo text);
select dblink_send_query('c2', format('select modo from propor_radar(%L, null, null, 10000)', :'q4')) as segunda_enviada;
select pg_sleep(1) \g /dev/null
select dblink_is_busy('c2') = 1 as segunda_esperando_a_primeira;
select dblink_exec('c1', 'commit') \g /dev/null
select * from dblink_get_result('c2') as t(modo text);
select * from dblink_get_result('c2') as t(modo text);
select dblink_disconnect('c1'), dblink_disconnect('c2');
select count(*) as propostas_da_loja_teste from radar_propostas where vitrine_id = (select id from vitrines_lojas where dono_id='user_q90');

\echo '[43] pedidos mandados ao mesmo tempo nao passam do limite por dia (ERRO esperado: ja fez N pedidos hoje)'
select count(*) as pedidos_hoje_b90 from radar_pedidos where comprador_id='user_b90' \gset
update configuracoes set valor = (:pedidos_hoje_b90 + 1)::text::jsonb where chave='radar.pedidos_por_dia' and microrregiao_id is null;
select dblink_connect('c1', 'dbname=olaki') as c1, dblink_connect('c2', 'dbname=olaki') as c2;
select dblink_exec('c1', 'set role authenticated') \g /dev/null
select dblink_exec('c1', 'set request.jwt.claim.role = ''authenticated''') \g /dev/null
select dblink_exec('c1', 'set request.jwt.claim.sub = ''user_b90''') \g /dev/null
select dblink_exec('c2', 'set role authenticated') \g /dev/null
select dblink_exec('c2', 'set request.jwt.claim.role = ''authenticated''') \g /dev/null
select dblink_exec('c2', 'set request.jwt.claim.sub = ''user_b90''') \g /dev/null
select dblink_exec('c1', 'begin') \g /dev/null
select status as primeiro_sem_commit from dblink('c1', 'select criar_pedido_radar(''Procuro sanduicheira elétrica'', ''Corrente'') ->> ''status''') as t(status text);
select dblink_send_query('c2', 'select criar_pedido_radar(''Procuro torradeira elétrica'', ''Corrente'') ->> ''status''') as segundo_enviado;
select pg_sleep(1) \g /dev/null
select dblink_is_busy('c2') = 1 as segundo_esperando_o_primeiro;
select dblink_exec('c1', 'commit') \g /dev/null
select * from dblink_get_result('c2') as t(status text);
select * from dblink_get_result('c2') as t(status text);
select dblink_disconnect('c1'), dblink_disconnect('c2');
select count(*) - :pedidos_hoje_b90 as pedidos_novos_b90 from radar_pedidos where comprador_id='user_b90';
update configuracoes set valor='100' where chave='radar.pedidos_por_dia' and microrregiao_id is null;

\echo '[44] endurecimento das partes novas'
select has_function_privilege('authenticated', 'salvar_preferencia_aviso(text,boolean)', 'execute') as logado_escolhe,
       has_function_privilege('anon', 'salvar_preferencia_aviso(text,boolean)', 'execute') as anon_escolhe,
       relrowsecurity as rls_preferencias
  from pg_class where relname='preferencias_avisos';

-- volta os limites ao padrão
update configuracoes set valor='10' where chave in ('radar.pedidos_por_dia','radar.pedidos_abertos_max') and microrregiao_id is null;
