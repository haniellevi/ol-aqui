\set ON_ERROR_STOP on
\set QUIET on
-- Radar piloto: categoria obrigatória (com a árvore inteira) e só propostas no pedido do site; aviso de pedido novo
-- no WhatsApp só com a chave ligada e a loja de acordo (padrão desligado); um aviso por pedido e loja; SAIR desliga
-- e cancela (com ou sem o 9 do número); a fila pula o Radar de quem desligou e o de pedido fechado; janela de 8h às
-- 20h na hora de enviar e no reenvio, com instantes fixos; Meu plano (plano inativo, cortesia, renovação); permissões.
begin;
reset role;

create function pg_temp.confere830(ok boolean, caso text) returns void language plpgsql as $$
begin
  if ok is not true then raise exception 'Falhou: %', caso; end if;
end $$;
create function pg_temp.recusa830(comando text, codigo text) returns void language plpgsql as $$
begin
  begin execute comando;
  exception when others then
    if sqlstate = codigo then return; end if;
    raise exception 'Estado inesperado: %, esperado %: %', sqlstate, codigo, sqlerrm;
  end;
  raise exception 'Comando aceito indevidamente: %', comando;
end $$;
create function pg_temp.na_janela830(quando timestamptz) returns boolean language sql as $$
  select (quando at time zone 'America/Fortaleza')::time >= time '08:00' and (quando at time zone 'America/Fortaleza')::time < time '20:00'
$$;

select id as reg from microrregioes where slug = 'corrente-pi' \gset
select id as moveis from categorias where slug = 'sofas-e-poltronas' \gset
select pai_id as pai from categorias where id = :'moveis' \gset

-- Chaves: aviso do Radar por WhatsApp ligado só para este teste (a transação desfaz).
update configuracoes set valor = 'true'::jsonb where chave = 'radar.whatsapp_ativo' and microrregiao_id is null;
update configuracoes set valor = '100' where chave in ('radar.pedidos_por_dia', 'radar.pedidos_abertos_max') and microrregiao_id is null;
-- Limite de 2 avisos por comprador e loja por dia: este teste faz 4 pedidos do mesmo comprador.
update configuracoes set valor = '10' where chave = 'radar.avisos_lojas_por_comprador_dia' and microrregiao_id is null;

insert into perfis(id, microrregiao_id, nome, cidade, whatsapp, whatsapp_verificado_em) values
  ('user_830comprador', :'reg', 'Comprador 830', 'Corrente', '5589999940100', now()),
  ('user_830loja1',     :'reg', 'Loja 830 um', 'Corrente', '5589999950001', now()),
  ('user_830loja2',     :'reg', 'Loja 830 dois', 'Corrente', '5589999950002', now()),
  ('user_830semwa',     :'reg', 'Sem WhatsApp 830', 'Corrente', null, null),
  ('user_830cota',      :'reg', 'Loja 830 cota', 'Corrente', '5589999950003', now());
insert into vitrines_lojas(dono_id, microrregiao_id, slug, nome, cidade, tipo, plano, plano_expira_em, criado_em)
select dono, :'reg', 'teste-830-' || n, 'Vitrine 830 ' || n, 'Corrente', 'loja', 'full', now() + interval '30 days', now()
  from (values ('user_830loja1', 'um'), ('user_830loja2', 'dois')) v(dono, n);
update vitrines_lojas set verificacao_estado = 'aprovada', selo_loja_verificada = true
 where dono_id in ('user_830loja1', 'user_830loja2');
insert into anuncios(vitrine_id, categoria_id, titulo, cidade, preco_centavos, atributos, status)
select v.id, :'moveis'::uuid, 'Anúncio de teste 830', 'Corrente', 10000, '{"estado":"usado"}', 'ativo'::public.status_anuncio
  from vitrines_lojas v where v.dono_id in ('user_830loja1', 'user_830loja2');
select id as vit1 from vitrines_lojas where dono_id = 'user_830loja1' \gset
select id as vit2 from vitrines_lojas where dono_id = 'user_830loja2' \gset
-- Instante fixo dentro da janela: 10h de Fortaleza, hoje (a suíte vale a qualquer hora do dia).
select (date_trunc('day', now() at time zone 'America/Fortaleza') + interval '10 hours') at time zone 'America/Fortaleza' as t0 \gset

-- [1] Pedido do site: categoria obrigatória (com a árvore inteira) e só propostas com prazo
set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = 'user_830comprador';
select pg_temp.recusa830($q$select criar_pedido_radar_site('83000000-0000-4000-a000-000000000001','Procuro sofá sem categoria','Corrente')$q$, '23514');
select pg_temp.recusa830($q$select criar_pedido_radar_site('83000000-0000-4000-a000-000000000005','Procuro sofá do modo antigo','Corrente','whatsapp_direto',null,null,(select id from categorias where slug = 'sofas-e-poltronas'))$q$, '22023');
select pg_temp.recusa830($q$select criar_pedido_radar_site('83000000-0000-4000-a000-000000000007','Procuro sofá sem prazo','Corrente','propostas_prazo',null,null,(select id from categorias where slug = 'sofas-e-poltronas'))$q$, '23514');
select criar_pedido_radar_site('83000000-0000-4000-a000-000000000002','Procuro sofá de três lugares', 'Corrente',
  'propostas_prazo', 72, null, :'moveis'::uuid) ->> 'id' as pedido1 \gset
reset role;
select pg_temp.confere830((select categoria_id = :'moveis'::uuid from radar_pedidos where id = :'pedido1'::uuid), 'pedido com categoria gravado');
select pg_temp.confere830(not exists (select 1 from whatsapp_fila where chave like 'radar_pedido_novo:%'), 'sem consentimento: nada na fila');
select pg_temp.confere830((select count(*) >= 1 from notificacoes where chave = 'pedido_novo:' || :'pedido1'), 'o sino do pedido continua funcionando como antes');
-- Subcategoria ativa com a categoria de cima desligada: o pedido não pode entrar
update categorias set ativa = false where id = :'pai';
set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = 'user_830comprador';
select pg_temp.recusa830($q$select criar_pedido_radar_site('83000000-0000-4000-a000-000000000006','Procuro sofá com pai desligado','Corrente','propostas_prazo',72,null,(select id from categorias where slug = 'sofas-e-poltronas'))$q$, '23514');
reset role;
update categorias set ativa = true where id = :'pai';

-- [2] Consentimento: só com número confirmado, só com a chave geral ligada; padrão desligado
set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = 'user_830semwa';
select pg_temp.recusa830($q$select salvar_preferencia_whatsapp_radar(true)$q$, '42501');
reset role;
set local role authenticated;
set local request.jwt.claim.sub = 'user_830loja1';
select pg_temp.confere830(salvar_preferencia_whatsapp_radar(false) = false, 'loja pode desligar sem confirmar nada');
select pg_temp.confere830((minha_preferencia_whatsapp_radar()->>'ligado')::boolean = false and (minha_preferencia_whatsapp_radar()->>'ativo')::boolean = true, 'estado da preferência: desligada e chave ligada');
reset role;
update configuracoes set valor = 'false'::jsonb where chave = 'radar.whatsapp_ativo' and microrregiao_id is null;
set local role authenticated;
set local request.jwt.claim.sub = 'user_830loja1';
select pg_temp.recusa830($q$select salvar_preferencia_whatsapp_radar(true)$q$, '55000');
reset role;
update configuracoes set valor = 'true'::jsonb where chave = 'radar.whatsapp_ativo' and microrregiao_id is null;
select pg_temp.confere830((select count(*) = 0 from preferencias_avisos where tipo = 'pedido_novo' and canal = 'whatsapp' and usuario_id = 'user_830loja1' and ligado), 'sem linha ligada = não envia; chave desligada não deixa ligar');

-- Loja 2 liga o aviso de propósito.
set local role authenticated;
set local request.jwt.claim.sub = 'user_830loja2';
select pg_temp.confere830(salvar_preferencia_whatsapp_radar(true) = true, 'loja liga o aviso de WhatsApp');
reset role;

-- [3] Pedido novo: só a loja que ligou entra na fila; uma vez por pedido e loja.
set local role authenticated;
set local request.jwt.claim.sub = 'user_830comprador';
select criar_pedido_radar_site('83000000-0000-4000-a000-000000000003','Procuro cadeira de escritório', 'Corrente',
  'propostas_prazo', 72, 'Detalhe com 5589999940100 que não pode sair', :'moveis'::uuid) ->> 'id' as pedido2 \gset
reset role;
select pg_temp.confere830((select count(*) = 1 and bool_and(usuario_id = 'user_830loja2') from whatsapp_fila where chave like 'radar_pedido_novo:' || :'pedido2' || ':%'), 'só a loja que ligou entra na fila');
select pg_temp.confere830((select count(*) = 1 and bool_and(estado = 'pendente' and link = '/radar/' || :'pedido2' and numero = '5589999950002' and pg_temp.na_janela830(enviar_apos) and enviar_apos >= now() - interval '1 minute')
  from whatsapp_fila where chave like 'radar_pedido_novo:' || :'pedido2' || ':%'), 'fila: pendente, link do pedido, dentro da janela');
select pg_temp.confere830((select texto = 'Mercado da Região: chegou um pedido novo no Radar para Corrente. Veja o pedido no link. Responda SAIR para parar estes avisos.'
  from whatsapp_fila where chave like 'radar_pedido_novo:' || :'pedido2' || ':%'), 'texto: marca, região, link e SAIR; sem dado do comprador');
select pg_temp.confere830((select count(*) = 0 from whatsapp_fila where texto ~ '5589999940100|Detalhe|Procuro|OLAKI'), 'nenhum dado do comprador nem o nome antigo na fila');
select pg_temp.confere830(not whatsapp_enfileirar('user_830loja2', 'Repetida', '/radar/x', 'radar_pedido_novo:' || :'pedido2' || ':' || :'vit2'),
  'mesma chave (pedido + loja) não entra duas vezes');
select pg_temp.confere830((select count(*) = 1 from whatsapp_fila where chave like 'radar_pedido_novo:' || :'pedido2' || ':%'), 'dedup: uma linha');

-- [4] SAIR: desliga, cancela o que estava na fila e registra sem guardar o número. Vale com o número sem o 9.
set local role service_role;
select whatsapp_sair('5589999950002', 'SAIR') as achou \gset
reset role;
select pg_temp.confere830(:'achou' = 't', 'SAIR acha a conta com o número');
select pg_temp.confere830((select ligado = false from preferencias_avisos where usuario_id = 'user_830loja2' and tipo = 'pedido_novo' and canal = 'whatsapp'), 'SAIR desliga a preferência');
select pg_temp.confere830((select estado = 'cancelada' from whatsapp_fila where chave like 'radar_pedido_novo:' || :'pedido2' || ':%'), 'SAIR cancela a mensagem que estava na fila');
select pg_temp.confere830((select count(*) = 1 and bool_and(comando = 'SAIR') from whatsapp_respostas where usuario_id = 'user_830loja2'), 'SAIR fica registrado');
select pg_temp.confere830((select count(*) = 0 from information_schema.columns where table_name = 'whatsapp_respostas' and column_name in ('numero', 'texto', 'telefone')), 'registro não guarda número nem texto');
set local role authenticated;
set local request.jwt.claim.sub = 'user_830loja2';
select pg_temp.confere830(salvar_preferencia_whatsapp_radar(true) = true, 'loja 2 liga de novo para testar a forma sem o 9');
reset role;
set local role service_role;
select whatsapp_sair('558999950002', 'PARAR') as achou_sem_nove \gset
reset role;
select pg_temp.confere830(:'achou_sem_nove' = 't', 'SAIR com o número sem o 9 acha a mesma conta');
select pg_temp.confere830((select ligado = false from preferencias_avisos where usuario_id = 'user_830loja2' and tipo = 'pedido_novo' and canal = 'whatsapp'), 'PARAR sem o 9 também desliga');
select pg_temp.confere830((select count(*) = 2 from whatsapp_respostas where usuario_id = 'user_830loja2'), 'as duas saídas ficam registradas');
set local role service_role;
select whatsapp_sair('5589999999999', 'SAIR') as desconhecido \gset
select pg_temp.recusa830($q$select whatsapp_sair('5589999950002', 'OI')$q$, '22023');
reset role;
select pg_temp.confere830(:'desconhecido' = 'f', 'número sem conta: nada acontece');
select pg_temp.confere830((select count(*) = 2 from whatsapp_respostas where usuario_id = 'user_830loja2'), 'número sem conta não registra');

-- [5] Pegar (instante fixo): só o aviso que não é do Radar sai; o Radar de quem desligou fica cancelado.
delete from whatsapp_fila;
insert into whatsapp_fila(usuario_id, numero, texto, link, chave, enviar_apos) values
  ('user_830loja2', '5589999950002', 'Radar de quem saiu', '/radar/x', 'radar_pedido_novo:' || :'pedido2' || ':' || :'vit2', (:'t0'::timestamptz) - interval '2 minutes'),
  ('user_830loja1', '5589999950001', 'Radar sem consentimento', '/radar/y', 'radar_pedido_novo:' || :'pedido2' || ':' || :'vit1', (:'t0'::timestamptz) - interval '2 minutes'),
  ('user_830loja1', '5589999950001', 'Aviso de verificação', '/minha-conta', 'teste-830-geral', (:'t0'::timestamptz) - interval '2 minutes');
create temp table pegos830 as select * from whatsapp_fila_pegar_em(5, :'t0'::timestamptz) with no data;
insert into pegos830 select * from whatsapp_fila_pegar_em(5, :'t0'::timestamptz);
select pg_temp.confere830((select count(*) = 1 and bool_and(texto = 'Aviso de verificação') from pegos830), 'pegar: só o aviso que não é do Radar sai');
select pg_temp.confere830((select count(*) = 2 and bool_and(estado = 'cancelada' and erro = 'radar_desligado') from whatsapp_fila where chave like 'radar_pedido_novo:%'), 'Radar de quem desligou fica cancelado');

-- [6] Chave geral desligada: o Radar fica na fila sem sair. Pedido encerrado: o aviso é cancelado.
update configuracoes set valor = 'true'::jsonb where chave = 'radar.whatsapp_ativo' and microrregiao_id is null;
delete from whatsapp_fila;
insert into preferencias_avisos (usuario_id, tipo, canal, ligado) values ('user_830loja1', 'pedido_novo', 'whatsapp', true)
  on conflict (usuario_id, tipo, canal) do update set ligado = true;
update configuracoes set valor = 'false'::jsonb where chave = 'radar.whatsapp_ativo' and microrregiao_id is null;
insert into whatsapp_fila(usuario_id, numero, texto, link, chave, enviar_apos) values
  ('user_830loja1', '5589999950001', 'Radar com chave desligada', '/radar/z', 'radar_pedido_novo:' || :'pedido2' || ':' || :'vit1', (:'t0'::timestamptz) - interval '2 minutes');
delete from pegos830;
insert into pegos830 select * from whatsapp_fila_pegar_em(5, :'t0'::timestamptz);
select pg_temp.confere830((select count(*) = 0 from pegos830 where texto like 'Radar%'), 'chave geral desligada: Radar não é pego');
select pg_temp.confere830((select estado = 'pendente' from whatsapp_fila where texto = 'Radar com chave desligada'), 'chave geral desligada: Radar continua pendente (não sai)');
update configuracoes set valor = 'true'::jsonb where chave = 'radar.whatsapp_ativo' and microrregiao_id is null;
update radar_pedidos set status = 'encerrado' where id = :'pedido2'::uuid;
delete from pegos830;
insert into pegos830 select * from whatsapp_fila_pegar_em(5, :'t0'::timestamptz);
select pg_temp.confere830((select estado = 'cancelada' and erro = 'pedido_fechado' from whatsapp_fila where texto = 'Radar com chave desligada'), 'pedido encerrado: o aviso do Radar é cancelado, não sai');
select pg_temp.confere830((select count(*) = 0 from pegos830 where texto like 'Radar%'), 'pedido encerrado não sai');

-- [6b] Pedido novo com a chave ligada e a loja 1 de acordo: entra na fila (controle). Com a chave desligada: não entra.
set local role authenticated;
set local request.jwt.claim.sub = 'user_830comprador';
select criar_pedido_radar_site('83000000-0000-4000-a000-000000000008','Procuro mesa de jantar', 'Corrente',
  'propostas_prazo', 72, null, :'moveis'::uuid) ->> 'id' as pedido3 \gset
reset role;
select pg_temp.confere830((select count(*) = 1 from whatsapp_fila where chave = 'radar_pedido_novo:' || :'pedido3' || ':' || :'vit1'), 'controle: com a chave ligada, a loja 1 de acordo entra na fila');
update configuracoes set valor = 'false'::jsonb where chave = 'radar.whatsapp_ativo' and microrregiao_id is null;
set local role authenticated;
set local request.jwt.claim.sub = 'user_830comprador';
select criar_pedido_radar_site('83000000-0000-4000-a000-000000000009','Procuro guarda-roupa grande', 'Corrente',
  'propostas_prazo', 72, null, :'moveis'::uuid) ->> 'id' as pedido4 \gset
reset role;
select pg_temp.confere830((select count(*) = 0 from whatsapp_fila where chave like 'radar_pedido_novo:' || :'pedido4' || ':%'), 'chave geral desligada: pedido novo não entra na fila mesmo com a loja de acordo');
update configuracoes set valor = 'true'::jsonb where chave = 'radar.whatsapp_ativo' and microrregiao_id is null;

-- [6c] Na hora de enviar, o aviso confere de novo se o pedido ainda aceita proposta (prazo e limite).
update whatsapp_fila set enviar_apos = (:'t0'::timestamptz) - interval '2 minutes' where chave = 'radar_pedido_novo:' || :'pedido3' || ':' || :'vit1';
update radar_pedidos set propostas_ate = (:'t0'::timestamptz) - interval '1 minute' where id = :'pedido3'::uuid;
delete from pegos830;
insert into pegos830 select * from whatsapp_fila_pegar_em(5, :'t0'::timestamptz);
select pg_temp.confere830((select estado = 'cancelada' and erro = 'pedido_fechado' from whatsapp_fila where chave = 'radar_pedido_novo:' || :'pedido3' || ':' || :'vit1'), 'prazo de propostas acabou: o aviso do Radar é cancelado');
update whatsapp_fila set estado = 'pendente', erro = null where chave = 'radar_pedido_novo:' || :'pedido3' || ':' || :'vit1';
update radar_pedidos set propostas_ate = (:'t0'::timestamptz) + interval '1 day', total_propostas = max_propostas where id = :'pedido3'::uuid;
delete from pegos830;
insert into pegos830 select * from whatsapp_fila_pegar_em(5, :'t0'::timestamptz);
select pg_temp.confere830((select estado = 'cancelada' and erro = 'pedido_fechado' from whatsapp_fila where chave = 'radar_pedido_novo:' || :'pedido3' || ':' || :'vit1'), 'limite de propostas cheio: o aviso do Radar é cancelado');
update whatsapp_fila set estado = 'pendente', erro = null where chave = 'radar_pedido_novo:' || :'pedido3' || ':' || :'vit1';
update radar_pedidos set total_propostas = 0 where id = :'pedido3'::uuid;
delete from pegos830;
insert into pegos830 select * from whatsapp_fila_pegar_em(5, :'t0'::timestamptz);
select pg_temp.confere830((select count(*) = 1 from pegos830 where link = '/radar/' || :'pedido3'), 'controle: pedido que ainda aceita proposta sai');

-- [7] Janela de 8h às 20h e reenvio, com instantes fixos.
select pg_temp.confere830(whatsapp_reenvio_em('2026-11-12 19:58:00-03') = '2026-11-13 08:00:00-03', 'reenvio de 19:58 cai às 8h do dia seguinte (20h03 está fora)');
select pg_temp.confere830(whatsapp_reenvio_em('2026-11-12 20:03:00-03') = '2026-11-13 08:00:00-03', 'reenvio de 20h03 cai às 8h do dia seguinte');
select pg_temp.confere830(whatsapp_reenvio_em('2026-11-12 07:30:00-03') = '2026-11-12 08:00:00-03', 'reenvio de 7h30 cai às 8h do mesmo dia');
select pg_temp.confere830(whatsapp_reenvio_em('2026-11-12 10:00:00-03') = '2026-11-12 10:05:00-03', 'reenvio de 10h cai 5 minutos depois');
delete from whatsapp_fila;
insert into whatsapp_fila(usuario_id, numero, texto, link, chave, enviar_apos) values
  ('user_830loja1', '5589999950001', 'Antes da janela', '/a', 'janela-830-a', '2026-11-12 07:00:00-03'),
  ('user_830loja1', '5589999950001', 'Vence 19h58', '/a', 'janela-830-b', '2026-11-12 19:58:00-03');
select count(*) = 0 as fora_0730 from whatsapp_fila_pegar_em(5, '2026-11-12 07:30:00-03') \gset
select count(*) = 0 as fora_2003 from whatsapp_fila_pegar_em(5, '2026-11-12 20:03:00-03') \gset
select pg_temp.confere830(:'fora_0730' = 't' and :'fora_2003' = 't', 'fora da janela (7h30 e 20h03) nada sai, mesmo com mensagem vencida');
select count(*) = 2 as dentro_1958 from whatsapp_fila_pegar_em(5, '2026-11-12 19:58:00-03') \gset
select pg_temp.confere830(:'dentro_1958' = 't', 'dentro da janela (19h58) as duas vencidas saem');
select whatsapp_fila_resultado((select id from whatsapp_fila where chave = 'janela-830-b'), 'falha') as r \gset
select pg_temp.confere830(:'r' = 'pendente' and (select enviar_apos = whatsapp_reenvio_em(now()) and pg_temp.na_janela830(enviar_apos) from whatsapp_fila where chave = 'janela-830-b'),
  'falha: o reenvio usa o cálculo da janela (5 min ou próxima janela)');

-- [8] Modelos: marca nova, aviso do pedido sem dado do comprador, proposta sem OLAKI.
select pg_temp.confere830((select count(*) = 0 from modelos_mensagem where canal = 'whatsapp' and (texto like '%OLAKI%' or texto_padrao like '%OLAKI%')
  and chave = 'proposta_nova'), 'proposta_nova do WhatsApp sem OLAKI');
select pg_temp.confere830((select texto like '%Mercado da Região%' from modelos_mensagem where chave = 'proposta_nova' and canal = 'whatsapp'), 'proposta_nova com a marca nova');
select pg_temp.confere830((select count(*) = 1 and bool_and(variaveis = array['cidade']::text[]) from modelos_mensagem where chave = 'pedido_novo' and canal = 'whatsapp'), 'modelo pedido_novo: só a cidade');

-- [9] Meu plano: plano contratado mesmo inativo; cortesia só da própria loja e só se a loja está ativa; renovação só no recomendado.
insert into vitrines_lojas(dono_id, microrregiao_id, slug, nome, cidade, tipo, plano, plano_expira_em, criado_em)
values ('user_830cota', :'reg', 'teste-830-cota', 'Vitrine 830 cota', 'Corrente', 'loja', 'slim', now() + interval '30 days', now());
-- O recomendado hoje é o Slim; o Full passa a ser o recomendado (o trigger tira o Slim da marca) antes de o Slim sair de venda.
update planos set recomendado = true where codigo = 'full';
update planos set ativo = false where codigo = 'slim';
select nome as nome_slim from planos where codigo = 'slim' \gset
set local role authenticated;
set local request.jwt.claim.sub = 'user_830cota';
select pg_temp.confere830((select nome = :'nome_slim' and ativo = false from meu_plano_contratado()), 'plano contratado inativo volta com nome');
select pg_temp.confere830(minha_cortesia_radar() is null, 'sem cortesia: nada a mostrar');
select pg_temp.confere830((select count(*) > 0 and bool_and(recomendado) from opcoes_assinatura()), 'plano atual inativo: a renovação só oferece o recomendado');
reset role;
insert into radar_cortesias(vitrine_id, ate, motivo, criado_por)
  select id, now() + interval '10 days', 'Teste 830 de cortesia', 'user_830admin' from vitrines_lojas where dono_id = 'user_830cota';
set local role authenticated;
set local request.jwt.claim.sub = 'user_830cota';
select pg_temp.confere830(minha_cortesia_radar() > now() + interval '9 days', 'cortesia ativa aparece para a própria loja');
set local request.jwt.claim.sub = 'user_830loja1';
select pg_temp.confere830(minha_cortesia_radar() is null, 'cortesia de outra loja não aparece');
reset role;
update vitrines_lojas set status = 'suspensa' where dono_id = 'user_830cota';
set local role authenticated;
set local request.jwt.claim.sub = 'user_830cota';
select pg_temp.confere830(minha_cortesia_radar() is null, 'loja suspensa não mostra cortesia');
reset role;
update vitrines_lojas set status = 'ativa' where dono_id = 'user_830cota';

-- [10] Permissões
select pg_temp.confere830(not has_function_privilege('authenticated', 'whatsapp_sair(text,text)', 'execute'), 'SAIR não é para a conta');
select pg_temp.confere830(has_function_privilege('service_role', 'whatsapp_sair(text,text)', 'execute'), 'SAIR é do servidor');
select pg_temp.confere830(not has_table_privilege('authenticated', 'whatsapp_respostas', 'select') and not has_table_privilege('service_role', 'whatsapp_respostas', 'select'), 'registro do SAIR não é lido pela API');
select pg_temp.confere830(has_function_privilege('authenticated', 'salvar_preferencia_whatsapp_radar(boolean)', 'execute'), 'ligar/desligar é da conta');
select pg_temp.confere830(not has_function_privilege('anon', 'salvar_preferencia_whatsapp_radar(boolean)', 'execute'), 'visitante não liga aviso');
select pg_temp.confere830(not has_function_privilege('authenticated', 'whatsapp_fila_pegar_em(integer,timestamptz)', 'execute')
  and not has_function_privilege('service_role', 'whatsapp_fila_pegar_em(integer,timestamptz)', 'execute'), 'pegar com instante é só interno');
select pg_temp.confere830(not has_function_privilege('authenticated', 'whatsapp_reenvio_em(timestamptz)', 'execute'), 'cálculo do reenvio é interno');
rollback;
