\set ON_ERROR_STOP on
\set QUIET on
-- Radar v2: "Com quem você resolveu?", nota 👍/👎 e "Eu sei onde tem". Fixtures descartáveis.
begin;
reset role;
set local request.jwt.claim.role='';
set local request.jwt.claim.sub='';

create function pg_temp.confere(ok boolean, caso text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FALHOU: %', caso; end if;
end $$;
create function pg_temp.recusa(comando text, codigo text, trecho text default null) returns void language plpgsql as $$
begin
  begin execute comando;
  exception when others then
    if sqlstate = codigo and (trecho is null or sqlerrm like '%' || trecho || '%') then return; end if;
    raise exception 'Estado inesperado: % (%), esperado %: %', sqlstate, sqlerrm, codigo, comando;
  end;
  raise exception 'Comando aceito indevidamente: %', comando;
end $$;

select id as regiao from microrregioes where slug='corrente-pi' \gset
select id as moveis from categorias where slug = 'sofas-e-poltronas' \gset
update configuracoes set valor = '100' where chave in ('radar.pedidos_por_dia', 'radar.pedidos_abertos_max') and microrregiao_id is null;

insert into perfis(id, microrregiao_id, nome, whatsapp, whatsapp_verificado_em, cidade, tipo_pessoa) values
  ('user_q640comp',  :'regiao', 'Compradora 640',  '5589999964001', now(), 'Corrente', 'pf'),
  ('user_q640loja',  :'regiao', 'Loja Full 640',   '5589999964002', now(), 'Corrente', 'pj'),
  ('user_q640slim',  :'regiao', 'Loja Slim 640',   '5589999964003', now(), 'Corrente', 'pj'),
  ('user_q640ind',   :'regiao', 'Indicadora 640',  '5589999964004', now(), 'Corrente', 'pf'),
  ('user_q640ind2',  :'regiao', 'Indicadora 2 640','5589999964005', now(), 'Corrente', 'pf'),
  ('user_q640adm',   :'regiao', 'Admin 640',       '5589999964006', now(), 'Corrente', 'pf'),
  ('user_q640ajud',  :'regiao', 'Ajudante 640',    '5589999964007', now(), 'Corrente', 'pf');
update perfis set e_admin = true where id = 'user_q640adm';

insert into vitrines_lojas(dono_id, microrregiao_id, slug, nome, cidade, tipo, plano, plano_expira_em, teste_expira_em, criado_em) values
  ('user_q640loja', :'regiao', 'q640-loja', 'Loja Full 640', 'Corrente', 'loja', 'full', now() + interval '10 days', now() - interval '1 day', now() + interval '1 second'),
  ('user_q640slim', :'regiao', 'q640-slim', 'Loja Slim 640', 'Corrente', 'loja', 'slim', now() + interval '10 days', now() - interval '1 day', now() + interval '2 second');
update vitrines_lojas set verificacao_estado = 'aprovada', selo_loja_verificada = true where slug = 'q640-loja';
select id as vit_loja from vitrines_lojas where slug = 'q640-loja' \gset
select id as vit_slim from vitrines_lojas where slug = 'q640-slim' \gset
insert into convites_gerente_loja(vitrine_id, token_hash, telefone_hash, final_telefone, aceito_por, aceito_em)
  values (:'vit_loja', '\x640640'::bytea, '\x640641'::bytea, '4007', 'user_q640ajud', now());

-- 12 anúncios da loja Full (os 2 primeiros com foto) e 1 da Slim
insert into anuncios(id, vitrine_id, categoria_id, titulo, cidade, preco_centavos, atributos, status, fotos)
select ('64000000-0000-4000-b000-' || lpad(g::text, 12, '0'))::uuid, :'vit_loja', :'moveis',
       'Sofá de teste 640 número ' || g, 'Corrente', 10000 + g, '{"estado":"usado"}', 'ativo',
       case when g <= 2 then array['https://exemplo.test/foto' || g || '.jpg'] else '{}'::text[] end
  from generate_series(1, 12) g;
insert into anuncios(id, vitrine_id, categoria_id, titulo, cidade, preco_centavos, atributos, status) values
  ('64000000-0000-4000-b000-0000000000a1', :'vit_slim', :'moveis', 'Sofá da loja Slim 640', 'Corrente', 20000, '{"estado":"usado"}', 'ativo');
insert into anuncios(id, vitrine_id, categoria_id, titulo, cidade, preco_centavos, atributos, status) values
  ('64000000-0000-4000-b000-0000000000a2', :'vit_loja', :'moveis', 'Sofá pausado 640', 'Corrente', 20000, '{"estado":"usado"}', 'pausado');

insert into radar_pedidos(id, comprador_id, microrregiao_id, titulo, cidade, modo_contato, visibilidade, categoria_id) values
  ('64000000-0000-4000-a000-000000000001','user_q640comp',:'regiao','Procuro sofá 640 A','Corrente','whatsapp_direto','todos',:'moveis'),
  ('64000000-0000-4000-a000-000000000002','user_q640comp',:'regiao','Procuro sofá 640 B','Corrente','whatsapp_direto','todos',:'moveis'),
  ('64000000-0000-4000-a000-000000000003','user_q640comp',:'regiao','Procuro sofá 640 C','Corrente','whatsapp_direto','todos',:'moveis'),
  ('64000000-0000-4000-a000-000000000004','user_q640comp',:'regiao','Procuro sofá 640 D','Corrente','whatsapp_direto','todos',:'moveis'),
  ('64000000-0000-4000-a000-000000000005','user_q640comp',:'regiao','Procuro sofá 640 E','Corrente','whatsapp_direto','lojas',:'moveis'),
  ('64000000-0000-4000-a000-000000000006','user_q640comp',:'regiao','Procuro sofá 640 F','Corrente','whatsapp_direto','todos',:'moveis');
insert into radar_propostas(id, pedido_id, vitrine_id) values
  ('64000000-0000-4000-c000-000000000001','64000000-0000-4000-a000-000000000001',:'vit_loja'),
  ('64000000-0000-4000-c000-000000000002','64000000-0000-4000-a000-000000000002',:'vit_loja'),
  ('64000000-0000-4000-c000-000000000003','64000000-0000-4000-a000-000000000004',:'vit_loja');
-- proposta 3 (do pedido 4) fica oculta pela equipe
update radar_propostas set status = 'oculta' where id = '64000000-0000-4000-c000-000000000003';

-- ===== Com quem você resolveu? =====
set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='user_q640ind';
select pg_temp.recusa($q$select resolver_pedido_radar('64000000-0000-4000-a000-000000000001')$q$, '42501');  -- não é o comprador
set local request.jwt.claim.sub='user_q640comp';
select pg_temp.recusa($q$select resolver_pedido_radar('64000000-0000-4000-a000-000000000001','64000000-0000-4000-c000-000000000002')$q$, '23514');  -- proposta de outro pedido
select pg_temp.recusa($q$select resolver_pedido_radar('64000000-0000-4000-a000-000000000004','64000000-0000-4000-c000-000000000003')$q$, '23514');  -- proposta oculta
select pg_temp.recusa($q$select resolver_pedido_radar('64000000-0000-4000-a000-000000000001','64000000-0000-4000-c000-000000000001', true)$q$, '23514');  -- proposta e "fora" juntos
select pg_temp.confere((select status::text='aberto' and resolvido_proposta_id is null and not coalesce(resolvido_fora,false) from radar_pedidos where id='64000000-0000-4000-a000-000000000001'),'Recusas não mexem no pedido');

select resolver_pedido_radar('64000000-0000-4000-a000-000000000001','64000000-0000-4000-c000-000000000001');
select pg_temp.confere((select status::text='atendido' and fechado_motivo='resolvido' and fechado_em is not null
  and resolvido_proposta_id='64000000-0000-4000-c000-000000000001' and not coalesce(resolvido_fora,false)
  from radar_pedidos where id='64000000-0000-4000-a000-000000000001'),'Resolver com proposta fecha e grava a proposta');
select pg_temp.recusa($q$select resolver_pedido_radar('64000000-0000-4000-a000-000000000001')$q$, 'P0001');  -- já fechado

select resolver_pedido_radar('64000000-0000-4000-a000-000000000002', null, true);
select pg_temp.confere((select status::text='atendido' and fechado_motivo='resolvido' and resolvido_fora and resolvido_proposta_id is null
  from radar_pedidos where id='64000000-0000-4000-a000-000000000002'),'Resolver fora do Olaki');

-- fechar_pedido_radar continua funcionando, sem loja
select fechar_pedido_radar('64000000-0000-4000-a000-000000000003','resolvido');
select pg_temp.confere((select status::text='atendido' and fechado_motivo='resolvido' and resolvido_proposta_id is null and resolvido_fora is not true
  from radar_pedidos where id='64000000-0000-4000-a000-000000000003'),'Já resolvi simples segue valendo');

-- ===== Nota 👍/👎 =====
set local request.jwt.claim.sub='user_q640ind';
select pg_temp.recusa($q$select avaliar_pedido_radar('64000000-0000-4000-a000-000000000001', 1::smallint)$q$, '42501');
set local request.jwt.claim.sub='user_q640comp';
select pg_temp.recusa($q$select avaliar_pedido_radar('64000000-0000-4000-a000-000000000001', 0::smallint)$q$, '23514');
select pg_temp.recusa($q$select avaliar_pedido_radar('64000000-0000-4000-a000-000000000002', 1::smallint)$q$, 'P0001');  -- resolvido fora: sem loja para avaliar
select pg_temp.recusa($q$select avaliar_pedido_radar('64000000-0000-4000-a000-000000000003', 1::smallint)$q$, 'P0001');  -- sem proposta
select pg_temp.recusa($q$select avaliar_pedido_radar('64000000-0000-4000-a000-000000000006', 1::smallint)$q$, 'P0001');  -- ainda aberto
select avaliar_pedido_radar('64000000-0000-4000-a000-000000000001', 1::smallint);
select pg_temp.confere((select avaliacao=1 from radar_pedidos where id='64000000-0000-4000-a000-000000000001'),'Nota 👍');
select avaliar_pedido_radar('64000000-0000-4000-a000-000000000001', -1::smallint);
select pg_temp.confere((select avaliacao=-1 from radar_pedidos where id='64000000-0000-4000-a000-000000000001'),'Trocar para 👎');
-- edição direta não mexe nas colunas novas
update radar_pedidos set avaliacao = 1, resolvido_fora = true, resolvido_proposta_id = null where id='64000000-0000-4000-a000-000000000001';
select pg_temp.confere((select avaliacao=-1 and not resolvido_fora and resolvido_proposta_id='64000000-0000-4000-c000-000000000001'
  from radar_pedidos where id='64000000-0000-4000-a000-000000000001'),'Edição direta das colunas novas bloqueada');
update radar_pedidos set avaliacao = 1, resolvido_fora = true where id='64000000-0000-4000-a000-000000000006';
select pg_temp.confere((select avaliacao is null and resolvido_fora is not true from radar_pedidos where id='64000000-0000-4000-a000-000000000006'),'Edição direta em pedido aberto também bloqueada');

-- ===== Eu sei onde tem =====
set local request.jwt.claim.sub='user_q640ind';
select pg_temp.recusa($q$select indicar_anuncio_radar('64000000-0000-4000-a000-000000000005','64000000-0000-4000-b000-000000000001')$q$, '42501', 'só para lojas');
select pg_temp.recusa($q$select indicar_anuncio_radar('64000000-0000-4000-a000-000000000001','64000000-0000-4000-b000-000000000001')$q$, 'P0002');  -- pedido fechado
select pg_temp.recusa($q$select indicar_anuncio_radar('64000000-0000-4000-a000-000000000006','64000000-0000-4000-b000-0000000000a2')$q$, 'P0002');  -- anúncio pausado
select pg_temp.recusa($q$select indicar_anuncio_radar('64000000-0000-4000-a000-000000000006','64000000-0000-4000-b000-0000000000ff')$q$, 'P0002');  -- anúncio não existe
set local request.jwt.claim.sub='user_q640comp';
select pg_temp.recusa($q$select indicar_anuncio_radar('64000000-0000-4000-a000-000000000006','64000000-0000-4000-b000-000000000001')$q$, '42501');  -- o próprio comprador
set local request.jwt.claim.sub='user_q640loja';
select pg_temp.recusa($q$select indicar_anuncio_radar('64000000-0000-4000-a000-000000000006','64000000-0000-4000-b000-000000000001')$q$, 'P0001', 'Mandar oferta');  -- loja que atende
set local request.jwt.claim.sub='user_q640ajud';
select pg_temp.recusa($q$select indicar_anuncio_radar('64000000-0000-4000-a000-000000000006','64000000-0000-4000-b000-000000000001')$q$, 'P0001', 'outra pessoa');  -- ajudante da loja
set local request.jwt.claim.sub='user_q640slim';
select pg_temp.recusa($q$select indicar_anuncio_radar('64000000-0000-4000-a000-000000000006','64000000-0000-4000-b000-0000000000a1')$q$, 'P0001', 'outra pessoa');  -- loja que não atende
select indicar_anuncio_radar('64000000-0000-4000-a000-000000000006','64000000-0000-4000-b000-000000000001') as ind1 \gset
select pg_temp.confere(:'ind1' is not null,'Loja Slim pode indicar anúncio de outra loja');
set local request.jwt.claim.sub='user_q640ind';
select indicar_anuncio_radar('64000000-0000-4000-a000-000000000006','64000000-0000-4000-b000-000000000002') as ind2 \gset
select indicar_anuncio_radar('64000000-0000-4000-a000-000000000006','64000000-0000-4000-b000-000000000002') as ind2b \gset
select pg_temp.confere(:'ind2' = :'ind2b','Indicação repetida devolve o mesmo id');
reset role;
select pg_temp.confere((select count(*)=1 from notificacoes where usuario_id='user_q640comp' and tipo='indicacao'
  and chave='indicacao:64000000-0000-4000-a000-000000000006:64000000-0000-4000-b000-000000000002'
  and titulo='Alguém sabe onde tem' and texto like '%Procuro sofá 640 F%' and link='/radar/pedido/64000000-0000-4000-a000-000000000006'),'Um aviso só ao comprador');

-- RLS: ninguém grava pela API; autor e comprador leem; estranho não
set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='user_q640ind';
select pg_temp.recusa($q$insert into radar_indicacoes(pedido_id, autor_id, anuncio_id) values ('64000000-0000-4000-a000-000000000006','user_q640ind','64000000-0000-4000-b000-000000000003')$q$, '42501');
select pg_temp.confere((select count(*)=1 from radar_indicacoes),'Autor lê só a sua');
set local request.jwt.claim.sub='user_q640ind2';
select pg_temp.confere((select count(*)=0 from radar_indicacoes),'Estranho não lê');
set local request.jwt.claim.sub='user_q640comp';
select pg_temp.confere((select count(*)=0 from radar_indicacoes),'Comprador não lê a tabela (só pela função, sem autor)');

-- leitura do comprador: sem dados do autor
select pg_temp.confere((select count(*)=2 from indicacoes_do_pedido('64000000-0000-4000-a000-000000000006')),'Comprador vê as 2 indicações');
select pg_temp.confere((select not (to_jsonb(i) ? 'autor_id') and not (to_jsonb(i) ? 'usuario_id') from indicacoes_do_pedido('64000000-0000-4000-a000-000000000006') i limit 1),'Sem autor_id na leitura');
select pg_temp.confere((select titulo='Sofá de teste 640 número 2' and preco_centavos=10002 and foto='https://exemplo.test/foto2.jpg' and vitrine_nome='Loja Full 640'
  from indicacoes_do_pedido('64000000-0000-4000-a000-000000000006') where anuncio_id='64000000-0000-4000-b000-000000000002'),'Título, preço, foto e loja');
set local request.jwt.claim.sub='user_q640ind';
select pg_temp.recusa($q$select * from indicacoes_do_pedido('64000000-0000-4000-a000-000000000006')$q$, '42501');
set local request.jwt.claim.sub='user_q640adm';
select pg_temp.confere((select count(*)=2 from indicacoes_do_pedido('64000000-0000-4000-a000-000000000006')),'Admin também vê');

-- limite de 10 por dia por autor (a 11ª recusa; repetida não conta)
set local request.jwt.claim.sub='user_q640ind2';
select indicar_anuncio_radar('64000000-0000-4000-a000-000000000006', ('64000000-0000-4000-b000-' || lpad(g::text, 12, '0'))::uuid)
  from generate_series(3, 12) g;
select pg_temp.recusa($q$select indicar_anuncio_radar('64000000-0000-4000-a000-000000000006','64000000-0000-4000-b000-0000000000a1')$q$, 'P0001', 'hoje');
select pg_temp.confere((select indicar_anuncio_radar('64000000-0000-4000-a000-000000000006','64000000-0000-4000-b000-000000000003') is not null),'Repetida passa mesmo no limite');
reset role;
select pg_temp.confere((select count(*)=10 from radar_indicacoes where autor_id='user_q640ind2'),'Só 10 indicações gravadas');
rollback;
