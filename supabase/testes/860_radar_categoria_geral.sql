\set ON_ERROR_STOP on
\set QUIET on
-- Pedido do Radar em "geral" (860): sem categoria (Aki) ou em Outros/Diversos (site) registra uma sugestão de
-- categoria com origem radar_pedido, só com o título, sem o comprador, uma por pedido. Outra categoria não entra.
-- A lista do admin mostra a marca e os pedidos; juntar move o pedido; aprovar cria categoria e move; recusar não move.
-- Só o super admin decide; o comprador não lê nada disso.
begin;
reset role;

create function pg_temp.confere860(ok boolean, caso text) returns void language plpgsql as $$
begin
  if ok is not true then raise exception 'Falhou: %', caso; end if;
end $$;
create function pg_temp.recusa860(comando text, codigo text) returns void language plpgsql as $$
begin
  begin execute comando;
  exception when others then
    if sqlstate = codigo then return; end if;
    raise exception 'Estado inesperado: %, esperado %: %', sqlstate, codigo, sqlerrm;
  end;
  raise exception 'Comando aceito indevidamente: %', comando;
end $$;

select id as reg from microrregioes where slug = 'corrente-pi' \gset
select id as diversos from categorias where slug = 'diversos' \gset
select id as outros from categorias where slug = 'outros' \gset
select id as moveis from categorias where slug = 'sofas-e-poltronas' \gset

-- Limites do Radar altos só para este teste (a transação desfaz).
update configuracoes set valor = '100' where chave in ('radar.pedidos_por_dia', 'radar.pedidos_abertos_max') and microrregiao_id is null;

insert into perfis(id, microrregiao_id, nome, cidade, whatsapp, whatsapp_verificado_em) values
  ('user_860comprador', :'reg', 'Comprador 860', 'Corrente', '5589999960001', now()),
  ('user_860outro',     :'reg', 'Outro 860', 'Corrente', '5589999960002', now());
insert into perfis(id, microrregiao_id, nome, cidade, e_admin, e_super_admin) values
  ('user_860admin',   :'reg', 'Admin 860', 'Corrente', true, true),
  ('user_860equipe',  :'reg', 'Equipe 860', 'Corrente', true, false);

-- [1] Pedidos do comprador: dois do Aki (sem categoria), um na categoria Diversos (site), um de sofá (não entra).
set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = 'user_860comprador';
select criar_pedido_radar(p_titulo => 'Procuro bicicleta infantil aro 16', p_modo => 'propostas_prazo',
  p_prazo_horas => 72, p_origem => 'aki') ->> 'id' as p_bike \gset
select criar_pedido_radar(p_titulo => 'Procuro guitarra usada para estudar', p_modo => 'propostas_prazo',
  p_prazo_horas => 72, p_categoria_id => :'diversos'::uuid, p_origem => 'site') ->> 'id' as p_guitarra \gset
select criar_pedido_radar(p_titulo => 'Procuro sofá de três lugares', p_modo => 'propostas_prazo',
  p_prazo_horas => 72, p_categoria_id => :'moveis'::uuid, p_origem => 'site') ->> 'id' as p_sofa \gset
select criar_pedido_radar(p_titulo => 'Procuro cadeira de escritório giratória', p_modo => 'propostas_prazo',
  p_prazo_horas => 72, p_origem => 'aki') ->> 'id' as p_cadeira \gset
select criar_pedido_radar(p_titulo => 'Procuro máquina de costura antiga', p_modo => 'propostas_prazo',
  p_prazo_horas => 72, p_origem => 'aki') ->> 'id' as p_costura \gset
-- Aki continua podendo criar em geral: o pedido foi aberto normalmente.
select pg_temp.confere860((select status = 'aberto' from radar_pedidos where id = :'p_bike'::uuid), 'Aki cria em geral');

-- [2] A sugestão nasce junto do pedido, só com o título e sem o comprador.
reset role;
select pg_temp.confere860((select count(*) = 4 from categorias_sugeridas where origem = 'radar_pedido'), 'Quatro sugestões: 3 em geral + Diversos');
select pg_temp.confere860(not exists (select 1 from categorias_sugeridas where pedido_radar_id = :'p_sofa'::uuid), 'Sofá (outra categoria) não entra');
select pg_temp.confere860((select texto = 'Procuro bicicleta infantil aro 16' and texto_norm <> '' and autor_id is null
                                  and categoria_proxima_id = :'diversos'::uuid and estado = 'pendente' and anuncio_id is null
                             from categorias_sugeridas where pedido_radar_id = :'p_bike'::uuid), 'Título, sem autor, mais perto de Diversos');
select pg_temp.confere860((select categoria_proxima_id = :'diversos'::uuid from categorias_sugeridas where pedido_radar_id = :'p_guitarra'::uuid), 'Diversos mantém a própria categoria');

-- [3] Uma sugestão por pedido: a regra do banco impede a segunda, e o gatilho não duplica.
do $$ begin
  begin
    insert into categorias_sugeridas (texto, texto_norm, categoria_proxima_id, origem, pedido_radar_id)
    select 'Duplicada', 'duplicada', categoria_proxima_id, 'radar_pedido', pedido_radar_id
      from categorias_sugeridas where pedido_radar_id is not null limit 1;
    raise exception 'Aceitou segunda sugestão para o mesmo pedido';
  exception when unique_violation then null; end;
end $$;
select pg_temp.confere860((select count(*) = 1 from categorias_sugeridas where pedido_radar_id = :'p_bike'::uuid), 'Dedup por pedido');

-- [4] O comprador não lê as sugestões; o outro comprador também não.
set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = 'user_860comprador';
select pg_temp.confere860((select count(*) = 0 from categorias_sugeridas), 'Comprador não lê sugestões');
select pg_temp.recusa860($q$select admin_categorias_sugeridas()$q$, '42501');

-- [5] Equipe sem super admin lista, mas não decide.
set local request.jwt.claim.sub = 'user_860equipe';
select pg_temp.confere860((select count(*) = 4 from admin_categorias_sugeridas() where radar >= 1), 'Lista mostra os grupos do Radar');
select pg_temp.confere860((select radar = 1 and pedidos_radar = array[:'p_bike'::uuid]
                             from admin_categorias_sugeridas() where texto_norm = (select texto_norm from categorias_sugeridas where pedido_radar_id = :'p_bike'::uuid)),
                          'Marca e pedido do grupo');
select pg_temp.confere860((select (proximas->0->>'caminho') = 'Outros › Diversos' from admin_categorias_sugeridas()
                             where texto_norm = (select texto_norm from categorias_sugeridas where pedido_radar_id = :'p_guitarra'::uuid)),
                          'Caminho da categoria próxima');
select pg_temp.recusa860($q$select decidir_categorias_sugeridas(array['x'], 'recusar')$q$, '42501');

-- [6] Super admin: juntar move o pedido (o anúncio não existe aqui, então só o pedido muda).
set local request.jwt.claim.sub = 'user_860admin';
select decidir_categorias_sugeridas(
  array[(select texto_norm from categorias_sugeridas where pedido_radar_id = :'p_bike'::uuid)],
  'juntar', null, null, :'moveis'::uuid) ->> 'pedidos' as juntou_pedidos \gset
select pg_temp.confere860(:'juntou_pedidos'::int = 1, 'Juntar conta o pedido movido');
reset role;
select pg_temp.confere860((select categoria_id = :'moveis'::uuid from radar_pedidos where id = :'p_bike'::uuid), 'Juntar move o pedido');
select pg_temp.confere860((select categoria::text = (select tipo_legado::text from categorias where id = :'moveis'::uuid)
                             from radar_pedidos where id = :'p_bike'::uuid), 'Enum antigo do pedido acompanha');
select pg_temp.confere860((select estado = 'juntada' and categoria_final_id = :'moveis'::uuid from categorias_sugeridas where pedido_radar_id = :'p_bike'::uuid),
                          'Sugestão juntada');

-- [7] Aprovar: cria a categoria dentro de Outros e move o pedido para ela.
set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = 'user_860admin';
select decidir_categorias_sugeridas(
  array[(select texto_norm from categorias_sugeridas where pedido_radar_id = :'p_costura'::uuid)],
  'aprovar', 'Máquinas de costura', :'outros'::uuid) ->> 'categoria_id' as nova \gset
reset role;
select pg_temp.confere860(categoria_nome_caminho(:'nova'::uuid) = 'Outros › Máquinas de costura', 'Categoria criada no lugar certo');
select pg_temp.confere860((select categoria_id = :'nova'::uuid from radar_pedidos where id = :'p_costura'::uuid), 'Aprovar move o pedido');

-- [8] Recusar: o pedido fica como estava (sem categoria) e nada muda.
set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = 'user_860admin';
select decidir_categorias_sugeridas(
  array[(select texto_norm from categorias_sugeridas where pedido_radar_id = :'p_cadeira'::uuid)], 'recusar') ->> 'pedidos' as recusou_pedidos \gset
reset role;
select pg_temp.confere860(:'recusou_pedidos'::int = 0, 'Recusar não move pedido');
select pg_temp.confere860((select categoria_id is null from radar_pedidos where id = :'p_cadeira'::uuid), 'Recusado segue sem categoria (geral)');
select pg_temp.confere860((select estado = 'recusada' from categorias_sugeridas where pedido_radar_id = :'p_cadeira'::uuid), 'Estado recusada');

-- [9] Pedido que mudou de categoria antes da decisão não é movido (juntar com Diversos).
update radar_pedidos set categoria_id = :'moveis'::uuid where id = :'p_guitarra'::uuid;
set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = 'user_860admin';
select decidir_categorias_sugeridas(
  array[(select texto_norm from categorias_sugeridas where pedido_radar_id = :'p_guitarra'::uuid)],
  'juntar', null, null, :'diversos'::uuid) ->> 'pedidos' as guitarra_pedidos \gset
reset role;
select pg_temp.confere860(:'guitarra_pedidos'::int = 0, 'Pedido já trocado não conta');
select pg_temp.confere860((select categoria_id = :'moveis'::uuid from radar_pedidos where id = :'p_guitarra'::uuid), 'Pedido trocado pelo dono fica como está');

-- [10] Pedidos sem categoria que já viraram sugestão continuam abertos e nenhum outro foi criado.
select pg_temp.confere860((select count(*) = 0 from categorias_sugeridas where pedido_radar_id is not null and estado = 'pendente'), 'Nenhuma sugestão do Radar sobrou pendente');

-- [11] Pedido do Aki em imóvel (tipo no enum, sem categoria da tabela) não é geral: sem sugestão, e fica no tipo dele.
set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = 'user_860comprador';
select criar_pedido_radar(p_titulo => 'Procuro casa para alugar no centro', p_modo => 'propostas_prazo',
  p_prazo_horas => 72, p_categoria => 'imovel', p_origem => 'aki') ->> 'id' as p_imovel \gset
reset role;
select pg_temp.confere860(not exists (select 1 from categorias_sugeridas where pedido_radar_id = :'p_imovel'::uuid), 'Pedido de imóvel (Aki) não vira sugestão de geral');
select pg_temp.confere860((select categoria::text = 'imovel' and categoria_id is null from radar_pedidos where id = :'p_imovel'::uuid), 'Pedido de imóvel fica no tipo imóvel, sem categoria da tabela');

select 'ok' as radar_categoria_geral;
rollback;
