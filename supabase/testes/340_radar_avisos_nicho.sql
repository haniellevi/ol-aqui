\set ON_ERROR_STOP on
\set QUIET on
begin;
create function pg_temp.confere340(ok boolean, caso text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FALHOU: %', caso; end if; end $$;
create function pg_temp.destinatarios340(p_pedido uuid) returns text[] language sql as $$
  select coalesce(array_agg(usuario_id order by usuario_id), '{}'::text[])
    from notificacoes where chave = 'pedido_novo:' || p_pedido::text and canal = 'app'
$$;

select id as reg from microrregioes where slug = 'corrente-pi' \gset
insert into microrregioes (slug, nome, cidade_sede)
values ('teste-distante-radar340', 'Região 340', 'Cidade 340') returning id as distante \gset
insert into cidades (microrregiao_id, nome, uf) values (:'distante', 'Cidade 340', 'PI');
select id as moveis from categorias where slug = 'sofas-e-poltronas' \gset
select id as decoracao from categorias where slug = 'mesas-e-cadeiras' \gset

update configuracoes set valor = '100'
 where chave in ('radar.pedidos_por_dia', 'radar.pedidos_abertos_max',
                 'radar.avisos_lojas_por_dia', 'radar.avisos_lojas_por_comprador_dia') and microrregiao_id is null;
update configuracoes set valor = '200' where chave = 'radar.avisos_lojas_max_por_pedido' and microrregiao_id is null;
update planos set propostas_radar_mes = 0 where codigo = 'slim';

create temp table candidatos340 as
select 'user_radar340' || nome as dono, nome, indice,
       case when nome = 'distante' then :'distante' else :'reg' end::uuid as regiao,
       case when nome = 'distante' then 'Cidade 340' else 'Corrente' end as cidade,
       case when nome in ('pf', 'gratis') then 'pf' else 'loja' end as tipo,
       case nome when 'teste' then 'teste' when 'gratis' then 'pf_gratis' when 'cota' then 'slim' else 'full' end as plano
  from (values
    ('loja', 1), ('pf', 2), ('teste', 3), ('vencido', 4), ('distante', 5), ('mudo', 6),
    ('irmao', 7), ('inativo', 8), ('semcodigo', 9), ('cota', 10), ('gratis', 11), ('suspensa', 12)
  ) v(nome, indice);

insert into perfis(id, microrregiao_id, nome, whatsapp, whatsapp_verificado_em, cidade)
select dono, regiao, 'Perfil de teste 340 ' || nome, '558999994' || lpad(indice::text, 4, '0'),
       case when nome <> 'semcodigo' then now() end, cidade from candidatos340;
insert into perfis(id, microrregiao_id, nome, whatsapp, whatsapp_verificado_em, cidade) values
  ('user_radar340comprador', :'reg', 'Comprador de teste 340', '5589999940100', now(), 'Corrente'),
  ('user_radar340comprador2', :'reg', 'Comprador de teste 340 B', '5589999940101', now(), 'Corrente');

insert into vitrines_lojas(dono_id, microrregiao_id, slug, nome, cidade, tipo, plano, plano_expira_em, criado_em)
select dono, regiao, 'teste-radar-340-' || nome, 'Vitrine de teste 340 ' || nome,
       cidade, tipo, plano, now() + interval '1 day', now() + make_interval(secs => indice)
  from candidatos340;
-- Radar v2: atender e receber aviso exige selo (loja verificada / PF certificada); o plano segue valendo
update vitrines_lojas set verificacao_estado = 'aprovada', selo_loja_verificada = true
 where slug like 'teste-radar-340-%' and tipo = 'loja';
update perfis set selo_negociador_certificado = true, verificacao_pf_em = now()
 where id in (select dono from candidatos340 where tipo = 'pf');
insert into anuncios(vitrine_id, categoria_id, titulo, cidade, preco_centavos, atributos, status)
select v.id, case when c.nome = 'irmao' then :'decoracao' else :'moveis' end::uuid,
       'Anúncio de teste 340 ' || c.nome, c.cidade, 10000, '{"estado":"usado"}',
       case when c.nome = 'inativo' then 'pausado'::public.status_anuncio else 'ativo'::public.status_anuncio end
  from candidatos340 c join vitrines_lojas v on v.dono_id = c.dono;
update vitrines_lojas set plano_expira_em = now() - interval '1 second' where dono_id = 'user_radar340vencido';
update vitrines_lojas set status = 'suspensa' where dono_id = 'user_radar340suspensa';
insert into preferencias_avisos(usuario_id, tipo, canal, ligado)
values ('user_radar340mudo', 'pedido_novo', 'app', false);

insert into radar_pedidos(id, comprador_id, microrregiao_id, categoria_id, titulo, cidade) values
  ('34000000-0000-4000-a000-000000000001', 'user_radar340comprador', :'reg', :'moveis', 'Procuro um móvel de teste 340', 'Corrente');
select pg_temp.confere340(
  pg_temp.destinatarios340('34000000-0000-4000-a000-000000000001') = array['user_radar340loja','user_radar340pf'],
  'avisa somente loja e PF pagantes, ativos, da região e da subcategoria, aptos e com preferências ligadas'
);
select pg_temp.confere340((select bool_and(link = '/radar/34000000-0000-4000-a000-000000000001')
  from notificacoes where chave = 'pedido_novo:34000000-0000-4000-a000-000000000001'), 'aviso abre o pedido no aplicativo');

insert into radar_pedidos(id, comprador_id, microrregiao_id, categoria, titulo, cidade) values
  ('34000000-0000-4000-a000-000000000002', 'user_radar340comprador', :'reg', 'geral', 'Procuro item sem categoria 340', 'Corrente'),
  ('34000000-0000-4000-a000-000000000003', 'user_radar340comprador', :'reg', 'movel', 'Procuro um móvel no fluxo legado 340', 'Corrente');
select pg_temp.confere340(pg_temp.destinatarios340('34000000-0000-4000-a000-000000000002') = '{}'::text[],
  'pedido geral sem categoria não dispara avisos');
select pg_temp.confere340(
  pg_temp.destinatarios340('34000000-0000-4000-a000-000000000003') = array['user_radar340irmao','user_radar340loja','user_radar340pf'],
  'categoria-mãe reconhecida no legado inclui as subcategorias'
);

insert into radar_pedidos(id, comprador_id, microrregiao_id, categoria_id, titulo, cidade, status) values
  ('34000000-0000-4000-a000-000000000004', 'user_radar340loja', :'reg', :'moveis', 'Pedido próprio em análise 340', 'Corrente', 'em_analise');
select pg_temp.confere340(pg_temp.destinatarios340('34000000-0000-4000-a000-000000000004') = '{}'::text[],
  'pedido em análise não avisa');
update radar_pedidos set status = 'aberto' where id = '34000000-0000-4000-a000-000000000004';
select pg_temp.confere340(pg_temp.destinatarios340('34000000-0000-4000-a000-000000000004') = array['user_radar340pf'],
  'a aprovação avisa outros vendedores elegíveis e exclui o próprio comprador');
update radar_pedidos set status = 'em_analise' where id = '34000000-0000-4000-a000-000000000004';
update radar_pedidos set status = 'aberto' where id = '34000000-0000-4000-a000-000000000004';
select pg_temp.confere340(pg_temp.destinatarios340('34000000-0000-4000-a000-000000000004') = array['user_radar340pf'],
  'nova liberação não duplica aviso');

update configuracoes set valor = '1' where chave = 'radar.avisos_lojas_max_por_pedido' and microrregiao_id is null;
insert into radar_pedidos(id, comprador_id, microrregiao_id, categoria_id, titulo, cidade) values
  ('34000000-0000-4000-a000-000000000005', 'user_radar340comprador', :'reg', :'moveis', 'Procuro um móvel com teto 340', 'Corrente');
select pg_temp.confere340(pg_temp.destinatarios340('34000000-0000-4000-a000-000000000005') = array['user_radar340loja'],
  'teto por pedido limita o envio aos primeiros elegíveis');
update radar_pedidos set status = 'em_analise' where id = '34000000-0000-4000-a000-000000000005';
update radar_pedidos set status = 'aberto' where id = '34000000-0000-4000-a000-000000000005';
select pg_temp.confere340(pg_temp.destinatarios340('34000000-0000-4000-a000-000000000005') = array['user_radar340loja'],
  'segunda liberação preserva teto total por pedido');

update configuracoes set valor = '1' where chave = 'radar.avisos_lojas_por_comprador_dia' and microrregiao_id is null;
insert into radar_pedidos(id, comprador_id, microrregiao_id, categoria_id, titulo, cidade) values
  ('34000000-0000-4000-a000-000000000006', 'user_radar340comprador', :'reg', :'moveis', 'Pedido repetido no dia 340', 'Corrente'),
  ('34000000-0000-4000-a000-000000000007', 'user_radar340comprador2', :'reg', :'moveis', 'Primeiro pedido da conta 340 B', 'Corrente');
select pg_temp.confere340(pg_temp.destinatarios340('34000000-0000-4000-a000-000000000006') = '{}'::text[],
  'respeita o teto diário por comprador');
select pg_temp.confere340(pg_temp.destinatarios340('34000000-0000-4000-a000-000000000007') = array['user_radar340loja'],
  'teto de um comprador não bloqueia outro comprador');

update configuracoes set valor = '1' where chave = 'radar.avisos_lojas_por_dia' and microrregiao_id is null;
insert into radar_pedidos(id, comprador_id, microrregiao_id, categoria_id, titulo, cidade) values
  ('34000000-0000-4000-a000-000000000008', 'user_radar340comprador2', :'reg', :'moveis', 'Pedido com teto geral diário 340', 'Corrente');
select pg_temp.confere340(pg_temp.destinatarios340('34000000-0000-4000-a000-000000000008') = '{}'::text[],
  'respeita o teto diário de pedidos abertos por vendedor');

update configuracoes set valor = '100'
 where chave in ('radar.avisos_lojas_por_dia', 'radar.avisos_lojas_por_comprador_dia', 'radar.avisos_lojas_max_por_pedido')
   and microrregiao_id is null;
insert into radar_pedidos(id, comprador_id, microrregiao_id, categoria_id, titulo, cidade, modo_contato, propostas_ate, status) values
  ('34000000-0000-4000-a000-000000000009', 'user_radar340comprador', :'reg', :'moveis',
   'Pedido liberado após o prazo 340', 'Corrente', 'propostas_prazo', now() - interval '1 second', 'em_analise');
update radar_pedidos set status = 'aberto' where id = '34000000-0000-4000-a000-000000000009';
select pg_temp.confere340(pg_temp.destinatarios340('34000000-0000-4000-a000-000000000009') = '{}'::text[],
  'liberação após o prazo não gera aviso');

insert into radar_pedidos(id, comprador_id, microrregiao_id, categoria_id, titulo, cidade, status) values
  ('34000000-0000-4000-a000-000000000010', 'user_radar340comprador', :'reg', :'moveis',
   'Pedido liberado sem vagas 340', 'Corrente', 'em_analise');
update radar_pedidos set total_propostas = max_propostas, status = 'aberto'
 where id = '34000000-0000-4000-a000-000000000010';
select pg_temp.confere340(pg_temp.destinatarios340('34000000-0000-4000-a000-000000000010') = '{}'::text[],
  'pedido sem vagas não gera aviso');

set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = 'user_radar340comprador';
select criar_pedido_radar_site(
  '34000000-0000-4000-a000-000000000011', 'Procuro um móvel pelo formulário 340',
  'Corrente', 'whatsapp_direto', null, null, :'moveis'
)->>'id' as pelo_site \gset
reset role;
select pg_temp.confere340(pg_temp.destinatarios340(:'pelo_site') = array['user_radar340loja','user_radar340pf'],
  'pedido do formulário autenticado também avisa os vendedores correspondentes');
rollback;
