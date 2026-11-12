\set ON_ERROR_STOP on
\set QUIET on
begin;
create function pg_temp.confere620(ok boolean, caso text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FALHOU: %', caso; end if; end $$;
create function pg_temp.destinatarios620(p_pedido uuid) returns text[] language sql as $$
  select coalesce(array_agg(usuario_id order by usuario_id), '{}'::text[])
    from notificacoes where chave = 'pedido_novo:' || p_pedido::text and canal = 'app'
$$;

select id as reg from microrregioes where slug = 'corrente-pi' \gset
select id as c_corrente from cidades where microrregiao_id = :'reg' and nome = 'Corrente' \gset
select id as moveis from categorias where slug = 'sofas-e-poltronas' \gset
select id as outra_cat from categorias where slug = 'mesas-e-cadeiras' \gset

update configuracoes set valor = '100'
 where chave in ('radar.pedidos_por_dia', 'radar.pedidos_abertos_max',
                 'radar.avisos_lojas_por_dia', 'radar.avisos_lojas_por_comprador_dia') and microrregiao_id is null;
update configuracoes set valor = '200' where chave = 'radar.avisos_lojas_max_por_pedido' and microrregiao_id is null;

insert into perfis(id, microrregiao_id, nome, whatsapp, whatsapp_verificado_em, cidade, tipo_pessoa) values
  ('user_q620full',   :'reg', 'Full Corrente 620',  '5589999962001', now(), 'Corrente', 'pj'),
  ('user_q620cort',   :'reg', 'Cortesia 620',       '5589999962002', now(), 'Corrente', 'pj'),
  ('user_q620slim',   :'reg', 'Slim Corrente 620',  '5589999962003', now(), 'Corrente', 'pj'),
  ('user_q620parn',   :'reg', 'Full Parnagua 620',  '5589999962004', now(), 'Parnaguá', 'pj'),
  ('user_q620semnic', :'reg', 'Full sem nicho 620', '5589999962005', now(), 'Corrente', 'pj'),
  ('user_q620adm',    :'reg', 'Admin 620',          '5589999962006', now(), 'Corrente', 'pf'),
  ('user_q620comp',   :'reg', 'Comprador 620',      '5589999962007', now(), 'Corrente', 'pf');
update perfis set e_admin = true where id = 'user_q620adm';

insert into vitrines_lojas(dono_id, microrregiao_id, slug, nome, cidade, tipo, plano, plano_expira_em, teste_expira_em, criado_em) values
  ('user_q620full',   :'reg', 'q620-full',   'Loja Full 620',   'Corrente', 'loja', 'full', now() + interval '10 days', now() - interval '1 day', now() + interval '1 second'),
  ('user_q620cort',   :'reg', 'q620-cort',   'Loja Cortesia 620', 'Corrente', 'loja', 'slim', now() + interval '10 days', now() - interval '1 day', now() + interval '2 second'),
  ('user_q620slim',   :'reg', 'q620-slim',   'Loja Slim 620',   'Corrente', 'loja', 'slim', now() + interval '10 days', now() - interval '1 day', now() + interval '3 second'),
  ('user_q620parn',   :'reg', 'q620-parn',   'Loja Parnagua 620', 'Parnaguá', 'loja', 'full', now() + interval '10 days', now() - interval '1 day', now() + interval '4 second'),
  ('user_q620semnic', :'reg', 'q620-semnic', 'Loja sem nicho 620', 'Corrente', 'loja', 'full', now() + interval '10 days', now() - interval '1 day', now() + interval '5 second');
update vitrines_lojas set verificacao_estado = 'aprovada', selo_loja_verificada = true
 where slug in ('q620-full', 'q620-slim', 'q620-parn', 'q620-semnic');

insert into anuncios(vitrine_id, categoria_id, titulo, cidade, preco_centavos, atributos, status)
select v.id, case when v.slug = 'q620-semnic' then :'outra_cat' else :'moveis' end::uuid,
       'Anúncio de teste 620 ' || v.slug, v.cidade, 10000, '{"estado":"usado"}', 'ativo'
  from vitrines_lojas v where v.slug like 'q620-%';

-- a cortesia vale sem plano pago: o plano da loja vence depois de ela ter anúncio
update vitrines_lojas set plano_expira_em = now() - interval '1 day' where slug = 'q620-cort';
select id as vit_cort from vitrines_lojas where slug = 'q620-cort' \gset
set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = 'user_q620adm';
select dar_cortesia_radar(:'vit_cort', (now() at time zone 'America/Fortaleza')::date + 5, 'Cortesia de teste 620');
reset role;

-- pedido de Corrente no nicho: só Full verificada e cortesia, da área e com anúncio no nicho
insert into radar_pedidos(id, comprador_id, microrregiao_id, categoria_id, titulo, cidade, cidades_ids) values
  ('62000000-0000-4000-a000-000000000001', 'user_q620comp', :'reg', :'moveis', 'Procuro um sofá de teste 620', 'Corrente', array[:'c_corrente']::uuid[]);
select pg_temp.confere620(
  pg_temp.destinatarios620('62000000-0000-4000-a000-000000000001') = array['user_q620cort','user_q620full'],
  'avisa só Full verificada e cortesia de Corrente com anúncio no nicho (não Slim, nem Full de Parnaguá, nem Full sem anúncio no nicho)');

-- a Full cai para Slim: pedido novo não avisa mais
update vitrines_lojas set plano = 'slim' where slug = 'q620-full';
insert into radar_pedidos(id, comprador_id, microrregiao_id, categoria_id, titulo, cidade, cidades_ids) values
  ('62000000-0000-4000-a000-000000000002', 'user_q620comp', :'reg', :'moveis', 'Procuro outro sofá de teste 620', 'Corrente', array[:'c_corrente']::uuid[]);
select pg_temp.confere620(
  pg_temp.destinatarios620('62000000-0000-4000-a000-000000000002') = array['user_q620cort'],
  'depois de cair para Slim, a loja não recebe mais aviso na hora; a cortesia continua');
rollback;
