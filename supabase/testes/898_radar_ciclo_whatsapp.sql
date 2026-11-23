\set ON_ERROR_STOP on
\set QUIET on
-- Fechamento do ciclo de avisos por WhatsApp do Radar (comprador e lojista):
-- proposta_nova -> comprador, proposta_escolhida -> lojista, fechar_pedido_radar -> cancela pendentes,
-- chave geral, janela 8h-20h de Fortaleza, SAIR/VOLTAR (com e sem 9), sino do app, idempotência e permissões.
begin;
reset role;

create function pg_temp.confere898(ok boolean, caso text) returns void language plpgsql as $$
begin
  if ok is not true then raise exception 'Falhou: %', caso; end if;
end $$;
create function pg_temp.h898(t text) returns text language sql as $$
  select encode(sha256(convert_to(t, 'UTF8')), 'hex')
$$;
create function pg_temp.na_janela898(quando timestamptz) returns boolean language sql as $$
  select (quando at time zone 'America/Fortaleza')::time >= time '08:00' and (quando at time zone 'America/Fortaleza')::time < time '20:00'
$$;

select id as reg from microrregioes where slug = 'corrente-pi' \gset
select id as sofas from categorias where slug = 'sofas-e-poltronas' \gset
select (date_trunc('day', now() at time zone 'America/Fortaleza') + interval '10 hours') at time zone 'America/Fortaleza' as t_janela \gset
select (date_trunc('day', now() at time zone 'America/Fortaleza') + interval '22 hours') at time zone 'America/Fortaleza' as t_fora \gset

-- Começa com a chave geral desligada (estado padrão do piloto)
update configuracoes set valor = 'false'::jsonb where chave = 'radar.whatsapp_ativo' and microrregiao_id is null;
update configuracoes set valor = '100' where chave in ('radar.pedidos_por_dia', 'radar.pedidos_abertos_max') and microrregiao_id is null;
update configuracoes set valor = '10' where chave = 'radar.avisos_lojas_por_comprador_dia' and microrregiao_id is null;
update whatsapp_fila set estado = 'cancelada', erro = 'limpeza_898' where estado = 'pendente';

insert into perfis(id, microrregiao_id, nome, cidade, whatsapp, whatsapp_verificado_em) values
  ('user_898comp',   :'reg', 'Comprador 898',        'Corrente', '5589998980001', now()),
  ('user_898comp2',  :'reg', 'Comprador 898 dois',   'Corrente', '5589998980002', now()),
  ('user_898loja1',  :'reg', 'Loja 898 um',          'Corrente', '5589998980011', now()),
  ('user_898loja2',  :'reg', 'Loja 898 dois',        'Corrente', '5589998980012', now()),
  ('user_898semver', :'reg', 'Loja 898 sem verif',   'Corrente', '5589998980013', null);

insert into vitrines_lojas(id, dono_id, microrregiao_id, slug, nome, cidade, whatsapp, tipo, plano, plano_expira_em, criado_em) values
  ('89800000-0000-4000-b000-000000000001', 'user_898loja1', :'reg', 'loja-898-um',   'Loja 898 Um',   'Corrente', '5589998980011', 'loja', 'full', now() + interval '30 days', now()),
  ('89800000-0000-4000-b000-000000000002', 'user_898loja2', :'reg', 'loja-898-dois', 'Loja 898 Dois', 'Corrente', '5589998980012', 'loja', 'full', now() + interval '30 days', now());
update vitrines_lojas set verificacao_estado = 'aprovada', selo_loja_verificada = true
 where dono_id in ('user_898loja1', 'user_898loja2');

insert into anuncios(id, vitrine_id, categoria_id, titulo, cidade, preco_centavos, atributos, status) values
  ('89800000-0000-4000-c000-000000000001', '89800000-0000-4000-b000-000000000001', :'sofas'::uuid, 'Sofá Loja 1 898', 'Corrente', 120000, '{"estado":"usado"}', 'ativo'::public.status_anuncio),
  ('89800000-0000-4000-c000-000000000002', '89800000-0000-4000-b000-000000000002', :'sofas'::uuid, 'Sofá Loja 2 898', 'Corrente', 115000, '{"estado":"usado"}', 'ativo'::public.status_anuncio);

-- [1] Chave geral desligada: nada entra na fila para proposta_nova nem proposta_escolhida (sino do app continua normal)
set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = 'user_898comp';
select criar_pedido_radar_site('89800000-0000-4000-a000-000000000001', 'Procuro sofá retrátil 898', 'Corrente', 'propostas_prazo', 72, null, :'sofas'::uuid) ->> 'id' as ped1 \gset
set local request.jwt.claim.sub = 'user_898loja1';
select proposta_id as prop1_1 from propor_radar(:'ped1'::uuid, '89800000-0000-4000-c000-000000000001'::uuid, null, 120000, 'Sofá pronto') \gset
set local request.jwt.claim.sub = 'user_898comp';
select whatsapp as fone1 from escolher_proposta(:'prop1_1'::uuid) \gset
reset role;
select pg_temp.confere898(:'fone1' = '5589998980011', 'escolher_proposta devolve WhatsApp da loja');
select pg_temp.confere898((select count(*) = 0 from whatsapp_fila where chave like 'radar_proposta_%:' || :'ped1' || ':%'), 'chave geral desligada: nada de proposta_nova/escolhida na fila');
select pg_temp.confere898((select count(*) = 1 from notificacoes where chave = 'proposta_nova:' || :'prop1_1')
  and (select count(*) = 1 from notificacoes where chave = 'proposta_escolhida:' || :'prop1_1'), 'sino do app continua funcionando mesmo com WhatsApp desligado');

-- [2] Modelo proposta_escolhida e proposta_nova existentes, com marca nova, SAIR e sem OLAKI
select pg_temp.confere898((select count(*) = 1 and bool_and(ativo and texto like '%Mercado da Região%' and texto not like '%OLAKI%' and texto like '%SAIR%')
  from modelos_mensagem where chave = 'proposta_escolhida' and canal = 'whatsapp'), 'modelo proposta_escolhida criado com marca e SAIR');
select pg_temp.confere898((select count(*) = 1 and bool_and(ativo and texto like '%Mercado da Região%' and texto not like '%OLAKI%' and texto like '%SAIR%' and texto_padrao like '%SAIR%')
  from modelos_mensagem where chave = 'proposta_nova' and canal = 'whatsapp'), 'modelo proposta_nova pronto com marca e SAIR');

-- [2b] Chave geral ligada, mas sem opt-in explícito: proposta_nova e proposta_escolhida NÃO entram na fila, nem passam na retirada/confirmação
update configuracoes set valor = 'true'::jsonb where chave = 'radar.whatsapp_ativo' and microrregiao_id is null;
set local role authenticated;
set local request.jwt.claim.sub = 'user_898comp';
select pg_temp.confere898((minha_preferencia_whatsapp_radar()->>'ligado')::boolean = false and (minha_preferencia_whatsapp_radar()->>'parcial')::boolean = false,
  'preferência de WhatsApp começa desligada (opt-in obrigatório)');
select criar_pedido_radar_site('89800000-0000-4000-a000-000000000008', 'Procuro rack sem opt-in 898', 'Corrente', 'propostas_prazo', 72, null, :'sofas'::uuid) ->> 'id' as ped_sem_opt \gset
set local request.jwt.claim.sub = 'user_898loja1';
select proposta_id as prop_sem_opt from propor_radar(:'ped_sem_opt'::uuid, '89800000-0000-4000-c000-000000000001'::uuid, null, 75000, 'Rack loja 1') \gset
set local request.jwt.claim.sub = 'user_898comp';
select * from escolher_proposta(:'prop_sem_opt'::uuid);
reset role;
select pg_temp.confere898((select count(*) = 0 from whatsapp_fila where chave like 'radar_proposta_%:' || :'ped_sem_opt' || ':%'),
  'sem opt-in explícito: nada entra na fila de WhatsApp para proposta_nova nem proposta_escolhida');
select pg_temp.confere898((select count(*) = 1 from notificacoes where chave = 'proposta_nova:' || :'prop_sem_opt')
  and (select count(*) = 1 from notificacoes where chave = 'proposta_escolhida:' || :'prop_sem_opt'),
  'sem opt-in no WhatsApp: sino do app continua funcionando');

-- Defesa em profundidade na retirada e na confirmação contra linhas sem opt-in explícito
insert into whatsapp_fila(id, usuario_id, numero, texto, link, chave, enviar_apos, estado, tentativas) values
  ('89800000-0000-4000-d000-000000000001', 'user_898comp',  '5589998980001', 'Teste sem opt-in pegar nova', '/radar/pedido/' || :'ped_sem_opt', 'radar_proposta_nova:' || :'ped_sem_opt' || ':' || :'prop_sem_opt', (:'t_janela'::timestamptz) - interval '1 minute', 'pendente', 0),
  ('89800000-0000-4000-d000-000000000002', 'user_898loja1', '5589998980011', 'Teste sem opt-in pegar esc',  '/radar/' || :'ped_sem_opt', 'radar_proposta_escolhida:' || :'ped_sem_opt' || ':' || :'prop_sem_opt', (:'t_janela'::timestamptz) - interval '1 minute', 'pendente', 0),
  ('89800000-0000-4000-d000-000000000003', 'user_898comp',  '5589998980001', 'Teste sem opt-in conf nova',  '/radar/pedido/' || :'ped_sem_opt', 'radar_proposta_nova:' || :'ped_sem_opt' || ':00000000-0000-4000-b000-000000000099', (:'t_janela'::timestamptz) - interval '1 minute', 'enviando', 1),
  ('89800000-0000-4000-d000-000000000004', 'user_898loja1', '5589998980011', 'Teste sem opt-in conf esc',   '/radar/' || :'ped_sem_opt', 'radar_proposta_escolhida:' || :'ped_sem_opt' || ':00000000-0000-4000-b000-000000000099', (:'t_janela'::timestamptz) - interval '1 minute', 'enviando', 1);
create temp table pegos898_sem_opt as select * from whatsapp_fila_pegar_em(5, :'t_janela'::timestamptz);
select pg_temp.confere898((select count(*) = 0 from pegos898_sem_opt where id in ('89800000-0000-4000-d000-000000000001', '89800000-0000-4000-d000-000000000002'))
  and (select count(*) = 2 and bool_and(estado = 'cancelada' and erro = 'radar_desligado') from whatsapp_fila where id in ('89800000-0000-4000-d000-000000000001', '89800000-0000-4000-d000-000000000002')),
  'retirada cancela linha sem opt-in explícito com radar_desligado');
select whatsapp_fila_confirmar_envio('89800000-0000-4000-d000-000000000003') as conf_sem_opt_n \gset
select whatsapp_fila_confirmar_envio('89800000-0000-4000-d000-000000000004') as conf_sem_opt_e \gset
select pg_temp.confere898(:'conf_sem_opt_n' = 'cancelada' and :'conf_sem_opt_e' = 'cancelada'
  and (select count(*) = 2 and bool_and(estado = 'cancelada' and erro = 'radar_desligado') from whatsapp_fila where id in ('89800000-0000-4000-d000-000000000003', '89800000-0000-4000-d000-000000000004')),
  'confirmação cancela linha sem opt-in explícito com radar_desligado');
delete from whatsapp_fila where id in ('89800000-0000-4000-d000-000000000001', '89800000-0000-4000-d000-000000000002', '89800000-0000-4000-d000-000000000003', '89800000-0000-4000-d000-000000000004');

-- Agora compradores e lojistas ligam o opt-in explicitamente pelo site (RPC completa)
-- e validamos que a RPC legada salvar_preferencia_whatsapp_radar(true) inscreve SOMENTE em pedido_novo.
set local role authenticated;
set local request.jwt.claim.sub = 'user_898comp';
select salvar_preferencia_whatsapp_radar_completa(true) as opt_comp1 \gset
select pg_temp.confere898(:'opt_comp1' = 't'
  and (minha_preferencia_whatsapp_radar()->>'ligado')::boolean = true
  and (minha_preferencia_whatsapp_radar()->>'parcial')::boolean = false,
  'comprador 1 faz opt-in completo');
set local request.jwt.claim.sub = 'user_898comp2';
select salvar_preferencia_whatsapp_radar_tipo(t,true) from unnest(array['pedido_novo','proposta_nova','proposta_escolhida']) t;
select pg_temp.confere898(salvar_preferencia_whatsapp_radar_completa(true) = true, 'comprador 2 faz opt-in completo');
set local request.jwt.claim.sub = 'user_898loja1';
select salvar_preferencia_whatsapp_radar_tipo(t,true) from unnest(array['pedido_novo','proposta_nova','proposta_escolhida']) t;
select pg_temp.confere898(salvar_preferencia_whatsapp_radar_completa(true) = true, 'loja 1 faz opt-in completo');
set local request.jwt.claim.sub = 'user_898loja2';
select salvar_preferencia_whatsapp_radar_tipo(t,true) from unnest(array['pedido_novo','proposta_nova','proposta_escolhida']) t;
select pg_temp.confere898(salvar_preferencia_whatsapp_radar_completa(true) = true, 'loja 2 faz opt-in completo');
reset role;

-- [3] Chave geral ligada + opt-in explícito: proposta_nova vai ao comprador (com instrução SAIR e sem duplicar em edição) e proposta_escolhida vai ao lojista (sem duplicar ao repetir escolha)
set local role authenticated;
set local request.jwt.claim.sub = 'user_898comp';
select criar_pedido_radar_site('89800000-0000-4000-a000-000000000002', 'Procuro mesa de jantar 898', 'Corrente', 'propostas_prazo', 72, null, :'sofas'::uuid) ->> 'id' as ped2 \gset
set local request.jwt.claim.sub = 'user_898loja1';
select proposta_id as prop2_1 from propor_radar(:'ped2'::uuid, '89800000-0000-4000-c000-000000000001'::uuid, null, 95000, 'Mesa de madeira') \gset
-- Editar a mesma proposta não cria segunda notificação
select * from propor_radar(:'ped2'::uuid, '89800000-0000-4000-c000-000000000001'::uuid, null, 90000, 'Mesa de madeira com desconto');
set local request.jwt.claim.sub = 'user_898comp';
select * from escolher_proposta(:'prop2_1'::uuid);
select * from escolher_proposta(:'prop2_1'::uuid);
reset role;

select pg_temp.confere898((select count(*) = 1 and bool_and(
  usuario_id = 'user_898comp' and numero = '5589998980001' and estado = 'pendente'
  and link = '/radar/pedido/' || :'ped2' and pg_temp.na_janela898(enviar_apos)
  and texto like '%Loja 898 Um%' and texto like '%Procuro mesa de jantar 898%' and texto like '%SAIR%' and texto not like '%OLAKI%'
) from whatsapp_fila where chave = 'radar_proposta_nova:' || :'ped2' || ':' || :'prop2_1'), 'proposta_nova enfileirada uma vez, com instrução de SAIR, dentro da janela, para o comprador');

select pg_temp.confere898((select count(*) = 1 and bool_and(
  usuario_id = 'user_898loja1' and numero = '5589998980011' and estado = 'pendente'
  and link = '/radar/' || :'ped2' and pg_temp.na_janela898(enviar_apos)
  and texto like '%Procuro mesa de jantar 898%' and texto like '%Loja 898 Um%' and texto not like '%OLAKI%'
) from whatsapp_fila where chave = 'radar_proposta_escolhida:' || :'ped2' || ':' || :'prop2_1'), 'proposta_escolhida enfileirada uma vez, dentro da janela, para o lojista');

-- Personalização existente que já cita SAIR não é alterada; "sem sair de casa" e modelo perto de 1.000 chars com variável grande mantêm SAIR intacto
alter table public.modelos_mensagem disable trigger modelos_mensagem_proteger;
select texto as modelo_orig_nova from modelos_mensagem where chave = 'proposta_nova' and canal = 'whatsapp' \gset
update modelos_mensagem set texto = 'Custom {loja}: veja "{pedido}". Responda SAIR para parar.' where chave = 'proposta_nova' and canal = 'whatsapp';
set local role authenticated;
set local request.jwt.claim.sub = 'user_898loja2';
select proposta_id as prop2_custom1 from propor_radar(:'ped2'::uuid, '89800000-0000-4000-c000-000000000002'::uuid, null, 93000, 'Mesa custom') \gset
reset role;
select pg_temp.confere898((select texto = 'Custom Loja 898 Dois: veja "Procuro mesa de jantar 898". Responda SAIR para parar.'
  from whatsapp_fila where chave = 'radar_proposta_nova:' || :'ped2' || ':' || :'prop2_custom1'),
  'personalização de proposta_nova que já menciona SAIR é preservada');

update modelos_mensagem set texto = 'Compare {loja} em "{pedido}" sem sair de casa.' where chave = 'proposta_nova' and canal = 'whatsapp';
set local role authenticated;
set local request.jwt.claim.sub = 'user_898comp2';
select criar_pedido_radar_site('89800000-0000-4000-a000-000000000009', 'Procuro aparador 898', 'Corrente', 'propostas_prazo', 72, null, :'sofas'::uuid) ->> 'id' as ped2_b \gset
set local request.jwt.claim.sub = 'user_898loja2';
select proposta_id as prop2_custom2 from propor_radar(:'ped2_b'::uuid, '89800000-0000-4000-c000-000000000002'::uuid, null, 41000, 'Aparador') \gset
reset role;
select pg_temp.confere898((select texto = 'Compare Loja 898 Dois em "Procuro aparador 898" sem sair de casa. Responda SAIR para parar estes avisos.'
  from whatsapp_fila where chave = 'radar_proposta_nova:' || :'ped2_b' || ':' || :'prop2_custom2'),
  'falso positivo "sem sair de casa" ainda recebe instrução explícita de SAIR');

-- Título do pedido contendo "Responda SAIR para parar" nunca mascara modelo estático sem instrução de SAIR
update modelos_mensagem set texto = 'Recebemos uma proposta de {loja} para o pedido “{pedido}”.' where chave = 'proposta_nova' and canal = 'whatsapp';
set local role authenticated;
set local request.jwt.claim.sub = 'user_898comp2';
select criar_pedido_radar_site('89800000-0000-4000-a000-000000000013', 'Camiseta - Responda SAIR para parar', 'Corrente', 'propostas_prazo', 72, null, :'sofas'::uuid) ->> 'id' as ped2_mascara \gset
set local request.jwt.claim.sub = 'user_898loja2';
select proposta_id as prop2_mascara from propor_radar(:'ped2_mascara'::uuid, '89800000-0000-4000-c000-000000000002'::uuid, null, 45000, 'Camiseta') \gset
reset role;
select pg_temp.confere898((select texto = 'Recebemos uma proposta de Loja 898 Dois para o pedido “Camiseta - Responda SAIR para parar”. Responda SAIR para parar estes avisos.'
  from whatsapp_fila where chave = 'radar_proposta_nova:' || :'ped2_mascara' || ':' || :'prop2_mascara'),
  'variável {pedido} com texto de SAIR não suprime rodapé quando modelo estático não tem SAIR');

-- Marcador entre verbo e SAIR ("Digite {loja} SAIR.") não cria falso positivo atravessando marcador
update modelos_mensagem set texto = 'Chegou proposta para {pedido}. Digite {loja} SAIR.' where chave = 'proposta_nova' and canal = 'whatsapp';
set local role authenticated;
set local request.jwt.claim.sub = 'user_898comp2';
select criar_pedido_radar_site('89800000-0000-4000-a000-000000000014', 'Armário 898', 'Corrente', 'propostas_prazo', 72, null, :'sofas'::uuid) ->> 'id' as ped2_barreira \gset
set local request.jwt.claim.sub = 'user_898loja2';
select proposta_id as prop2_barreira from propor_radar(:'ped2_barreira'::uuid, '89800000-0000-4000-c000-000000000002'::uuid, null, 46000, 'Armário') \gset
reset role;
select pg_temp.confere898((select char_length(texto) <= 1000
  and texto = 'Chegou proposta para Armário 898. Digite Loja 898 Dois SAIR. Responda SAIR para parar estes avisos.'
  from whatsapp_fila where chave = 'radar_proposta_nova:' || :'ped2_barreira' || ':' || :'prop2_barreira'),
  'barreira entre marcadores impede falso positivo em "Digite {loja} SAIR." e anexa rodapé padrão');

-- Marcador colado antes ou depois do comando (SAIR{loja} / {pedido}SAIR) não cria falso positivo de fronteira de palavra
update modelos_mensagem set texto = 'Chegou proposta para {pedido}. Para parar, digite SAIR{loja}.' where chave = 'proposta_nova' and canal = 'whatsapp';
set local role authenticated;
set local request.jwt.claim.sub = 'user_898comp2';
select criar_pedido_radar_site('89800000-0000-4000-a000-000000000015', 'Sapateira 898', 'Corrente', 'propostas_prazo', 72, null, :'sofas'::uuid) ->> 'id' as ped2_colado1 \gset
set local request.jwt.claim.sub = 'user_898loja2';
select proposta_id as prop2_colado_a from propor_radar(:'ped2_colado1'::uuid, '89800000-0000-4000-c000-000000000002'::uuid, null, 47000, 'Sapateira') \gset
reset role;
select pg_temp.confere898((select char_length(texto) <= 1000
  and texto = 'Chegou proposta para Sapateira 898. Para parar, digite SAIRLoja 898 Dois. Responda SAIR para parar estes avisos.'
  from whatsapp_fila where chave = 'radar_proposta_nova:' || :'ped2_colado1' || ':' || :'prop2_colado_a'),
  'marcador colado após SAIR ("SAIR{loja}") não passa como instrução e recebe rodapé padrão');

update modelos_mensagem set texto = 'Chegou proposta para {loja}: digite {pedido}SAIR para parar.' where chave = 'proposta_nova' and canal = 'whatsapp';
set local role authenticated;
set local request.jwt.claim.sub = 'user_898comp2';
select criar_pedido_radar_site('89800000-0000-4000-a000-000000000016', 'Poltrona 898', 'Corrente', 'propostas_prazo', 72, null, :'sofas'::uuid) ->> 'id' as ped2_colado2 \gset
set local request.jwt.claim.sub = 'user_898loja2';
select proposta_id as prop2_colado_b from propor_radar(:'ped2_colado2'::uuid, '89800000-0000-4000-c000-000000000002'::uuid, null, 48000, 'Poltrona') \gset
reset role;
select pg_temp.confere898((select char_length(texto) <= 1000
  and texto = 'Chegou proposta para Loja 898 Dois: digite Poltrona 898SAIR para parar. Responda SAIR para parar estes avisos.'
  from whatsapp_fila where chave = 'radar_proposta_nova:' || :'ped2_colado2' || ':' || :'prop2_colado_b'),
  'marcador colado antes de SAIR ("{pedido}SAIR") não passa como instrução e recebe rodapé padrão');

-- Modelo de até 1.000 chars com {pedido} grande (estouraria 1.000 após variáveis) preserva espaço para SAIR completo no fim
update modelos_mensagem
   set texto = repeat('A', 935) || ' {loja} "{pedido}". Responda SAIR para parar estes avisos.'
 where chave = 'proposta_nova' and canal = 'whatsapp';
set local role authenticated;
set local request.jwt.claim.sub = 'user_898comp2';
select criar_pedido_radar_site('89800000-0000-4000-a000-000000000012', 'Procuro guarda-roupa planejado de seis portas em madeira maciça para quarto 898', 'Corrente', 'propostas_prazo', 72, null, :'sofas'::uuid) ->> 'id' as ped2_c \gset
set local request.jwt.claim.sub = 'user_898loja2';
select proposta_id as prop2_custom3 from propor_radar(:'ped2_c'::uuid, '89800000-0000-4000-c000-000000000002'::uuid, null, 42000, 'Mesa longa') \gset
reset role;
select pg_temp.confere898((select char_length(texto) <= 1000 and right(texto, 38) = 'Responda SAIR para parar estes avisos.'
  from whatsapp_fila where chave = 'radar_proposta_nova:' || :'ped2_c' || ':' || :'prop2_custom3'),
  'expansão de variável acima de 1.000 chars reserva espaço e mantém instrução de SAIR intacta');

-- Personalização legítima de 1.000 chars com 'OLAKI' não é expandida pela lógica da migração (evita models_mensagem_check2)
update modelos_mensagem set texto = repeat('x', 989) || 'OLAKI{loja}' where chave = 'proposta_nova' and canal = 'whatsapp';
update public.modelos_mensagem
   set texto = case
         when texto in (
           '{loja} mandou uma proposta no Radar do Mercado da Região para “{pedido}”. Abra o Mercado da Região para ver e comparar.',
           '{loja} mandou uma proposta no Radar do OLAKI para “{pedido}”. Abra o OLAKI para ver e comparar.'
         )
         then '{loja} mandou uma proposta no Radar do Mercado da Região para “{pedido}”. Abra o Mercado da Região para ver e comparar. Responda SAIR para parar estes avisos.'
         else texto
       end,
       texto_padrao = '{loja} mandou uma proposta no Radar do Mercado da Região para “{pedido}”. Abra o Mercado da Região para ver e comparar. Responda SAIR para parar estes avisos.'
 where chave = 'proposta_nova' and canal = 'whatsapp';
select pg_temp.confere898((select char_length(texto) = 1000 and texto like '%OLAKI{loja}' from modelos_mensagem where chave = 'proposta_nova' and canal = 'whatsapp'),
  'migração preserva personalização de 1.000 chars contendo OLAKI sem estourar check');

update modelos_mensagem set texto = :'modelo_orig_nova' where chave = 'proposta_nova' and canal = 'whatsapp';
alter table public.modelos_mensagem enable trigger modelos_mensagem_proteger;

-- [4] fechar_pedido_radar (cancelado e resolvido) cancela imediatamente avisos pendentes do pedido na fila
set local role authenticated;
set local request.jwt.claim.sub = 'user_898comp';
select fechar_pedido_radar(:'ped2'::uuid, 'cancelado') as status_canc \gset
reset role;
select pg_temp.confere898(:'status_canc' = 'encerrado', 'fechar_pedido_radar cancela o pedido');
select pg_temp.confere898((select count(*) = 2 and bool_and(estado = 'cancelada' and erro = 'pedido_fechado')
  from whatsapp_fila where chave in ('radar_proposta_nova:' || :'ped2' || ':' || :'prop2_1', 'radar_proposta_escolhida:' || :'ped2' || ':' || :'prop2_1')),
  'cancelar pedido cancela proposta_nova e proposta_escolhida pendentes na fila');

-- Pedido fechado por resolvido também cancela pendentes; escolher_proposta em pedido já resolvido segue devolvendo telefone sem enfileirar WhatsApp
set local role authenticated;
set local request.jwt.claim.sub = 'user_898comp';
select criar_pedido_radar_site('89800000-0000-4000-a000-000000000003', 'Procuro rack para sala 898', 'Corrente', 'propostas_prazo', 72, null, :'sofas'::uuid) ->> 'id' as ped3 \gset
set local request.jwt.claim.sub = 'user_898loja1';
select proposta_id as prop3_1 from propor_radar(:'ped3'::uuid, '89800000-0000-4000-c000-000000000001'::uuid, null, 50000, 'Rack novo') \gset
set local request.jwt.claim.sub = 'user_898loja2';
select proposta_id as prop3_2 from propor_radar(:'ped3'::uuid, '89800000-0000-4000-c000-000000000002'::uuid, null, 52000, 'Rack entrega grátis') \gset
set local request.jwt.claim.sub = 'user_898comp';
select * from escolher_proposta(:'prop3_1'::uuid);
select fechar_pedido_radar(:'ped3'::uuid, 'resolvido') as status_res \gset
select whatsapp as fone_pos_res from escolher_proposta(:'prop3_2'::uuid) \gset
reset role;
select pg_temp.confere898(:'status_res' = 'atendido' and :'fone_pos_res' = '5589998980012', 'fechar_pedido_radar resolvido permite contato posterior sem travar');
select pg_temp.confere898((select count(*) = 3 and bool_and(estado = 'cancelada' and erro = 'pedido_fechado')
  from whatsapp_fila where chave like 'radar_proposta_%:' || :'ped3' || ':%' and chave <> 'radar_proposta_escolhida:' || :'ped3' || ':' || :'prop3_2'),
  'fechar_pedido_radar resolvido cancela avisos pendentes do pedido');
select pg_temp.confere898((select count(*) = 0 from whatsapp_fila where chave = 'radar_proposta_escolhida:' || :'ped3' || ':' || :'prop3_2'),
  'escolher_proposta em pedido já fechado não enfileira WhatsApp');

-- [4b] DELETE em radar_pedidos (como moderação "remover") cancela radar_pedido_novo e demais chaves do pedido imediatamente
set local role authenticated;
set local request.jwt.claim.sub = 'user_898comp';
select criar_pedido_radar_site('89800000-0000-4000-a000-000000000010', 'Procuro escrivaninha removida 898', 'Corrente', 'propostas_prazo', 72, null, :'sofas'::uuid) ->> 'id' as ped_del \gset
reset role;
select pg_temp.confere898((select count(*) >= 1 and bool_and(estado = 'pendente') from whatsapp_fila where chave like 'radar_pedido_novo:' || :'ped_del' || ':%'),
  'controle antes do delete: radar_pedido_novo entra pendente para loja com opt-in');
delete from radar_pedidos where id = :'ped_del'::uuid;
select pg_temp.confere898((select count(*) >= 1 and bool_and(estado = 'cancelada' and erro = 'pedido_fechado') from whatsapp_fila where chave like 'radar_pedido_novo:' || :'ped_del' || ':%'),
  'DELETE em radar_pedidos cancela radar_pedido_novo imediatamente na fila');

-- [5] Janela 8h-20h de Fortaleza, chave geral e conferência antes do envio (whatsapp_fila_pegar_em e whatsapp_fila_confirmar_envio)
set local role authenticated;
set local request.jwt.claim.sub = 'user_898comp';
select criar_pedido_radar_site('89800000-0000-4000-a000-000000000004', 'Procuro poltrona reclinável 898', 'Corrente', 'propostas_prazo', 72, null, :'sofas'::uuid) ->> 'id' as ped4 \gset
set local request.jwt.claim.sub = 'user_898loja1';
select proposta_id as prop4_1 from propor_radar(:'ped4'::uuid, '89800000-0000-4000-c000-000000000001'::uuid, null, 80000, 'Poltrona macia') \gset
set local request.jwt.claim.sub = 'user_898comp';
select * from escolher_proposta(:'prop4_1'::uuid);
reset role;
update whatsapp_fila set enviar_apos = (:'t_janela'::timestamptz) - interval '1 hour'
 where chave in ('radar_proposta_nova:' || :'ped4' || ':' || :'prop4_1', 'radar_proposta_escolhida:' || :'ped4' || ':' || :'prop4_1');

-- Fora da janela (22h) não pega
create temp table pegos898 as select * from whatsapp_fila_pegar_em(5, :'t_fora'::timestamptz) with no data;
insert into pegos898 select * from whatsapp_fila_pegar_em(5, :'t_fora'::timestamptz);
select pg_temp.confere898((select count(*) = 0 from pegos898), 'fora da janela (22h) proposta_nova e proposta_escolhida esperam');

-- Chave geral desligada na hora de pegar (mesmo dentro da janela) segura na fila sem enviar
update configuracoes set valor = 'false'::jsonb where chave = 'radar.whatsapp_ativo' and microrregiao_id is null;
insert into pegos898 select * from whatsapp_fila_pegar_em(5, :'t_janela'::timestamptz);
select pg_temp.confere898((select count(*) = 0 from pegos898), 'chave geral desligada segura proposta_nova e proposta_escolhida como pendentes');

-- Se o pedido vencer enquanto aguardava na fila, é cancelado ao pegar
update radar_pedidos set expira_em = (:'t_janela'::timestamptz) - interval '1 minute' where id = :'ped4'::uuid;
insert into pegos898 select * from whatsapp_fila_pegar_em(5, :'t_janela'::timestamptz);
select pg_temp.confere898((select count(*) = 2 and bool_and(estado = 'cancelada' and erro = 'pedido_fechado')
  from whatsapp_fila where chave in ('radar_proposta_nova:' || :'ped4' || ':' || :'prop4_1', 'radar_proposta_escolhida:' || :'ped4' || ':' || :'prop4_1')),
  'pedido vencido na fila é cancelado mesmo com chave geral desligada');

-- Reabre prazo e chave geral: pegar marca enviando e confirmar_envio recheca antes do disparo
update radar_pedidos set expira_em = (:'t_janela'::timestamptz) + interval '5 days' where id = :'ped4'::uuid;
update configuracoes set valor = 'true'::jsonb where chave = 'radar.whatsapp_ativo' and microrregiao_id is null;
update whatsapp_fila set estado = 'pendente', erro = null
 where chave in ('radar_proposta_nova:' || :'ped4' || ':' || :'prop4_1', 'radar_proposta_escolhida:' || :'ped4' || ':' || :'prop4_1');
delete from pegos898;
insert into pegos898 select * from whatsapp_fila_pegar_em(5, :'t_janela'::timestamptz);
select pg_temp.confere898((select count(*) = 2 from pegos898), 'dentro da janela e com pedido aberto pega proposta_nova e proposta_escolhida');

select whatsapp_fila_confirmar_envio((select id from whatsapp_fila where chave = 'radar_proposta_nova:' || :'ped4' || ':' || :'prop4_1')) as c_nova \gset
select whatsapp_fila_confirmar_envio((select id from whatsapp_fila where chave = 'radar_proposta_escolhida:' || :'ped4' || ':' || :'prop4_1')) as c_esc \gset
select pg_temp.confere898(:'c_nova' = 'pode' and :'c_esc' = 'pode', 'confirmar_envio libera quando tudo está válido');

-- Loja suspensa ou número alterado depois do enfileiramento são barrados na conferência final
update vitrines_lojas set status = 'suspensa' where dono_id = 'user_898loja1';
select whatsapp_fila_confirmar_envio((select id from whatsapp_fila where chave = 'radar_proposta_escolhida:' || :'ped4' || ':' || :'prop4_1')) as c_susp \gset
select pg_temp.confere898(:'c_susp' = 'cancelada' and (select erro = 'sem_direito_aviso' from whatsapp_fila where chave = 'radar_proposta_escolhida:' || :'ped4' || ':' || :'prop4_1'),
  'loja suspensa antes do envio é cancelada com sem_direito_aviso');
update vitrines_lojas set status = 'ativa' where dono_id = 'user_898loja1';

update perfis set whatsapp = '5589998989999' where id = 'user_898comp';
select whatsapp_fila_confirmar_envio((select id from whatsapp_fila where chave = 'radar_proposta_nova:' || :'ped4' || ':' || :'prop4_1')) as c_num \gset
select pg_temp.confere898(:'c_num' = 'cancelada' and (select erro = 'sem_direito_aviso' from whatsapp_fila where chave = 'radar_proposta_nova:' || :'ped4' || ':' || :'prop4_1'),
  'comprador que trocou de número antes do envio é cancelado com sem_direito_aviso');
update perfis set whatsapp = '5589998980001' where id = 'user_898comp';

-- [6] SAIR e VOLTAR (comprador e lojista, inclusive número sem o 9) + sino do app
set local role authenticated;
set local request.jwt.claim.sub = 'user_898comp2';
select criar_pedido_radar_site('89800000-0000-4000-a000-000000000005', 'Procuro estante 898', 'Corrente', 'propostas_prazo', 72, null, :'sofas'::uuid) ->> 'id' as ped5 \gset
set local request.jwt.claim.sub = 'user_898loja2';
select proposta_id as prop5_2 from propor_radar(:'ped5'::uuid, '89800000-0000-4000-c000-000000000002'::uuid, null, 60000, 'Estante de aço') \gset
reset role;

-- Comprador 2 responde SAIR (sem o 9): cancela a proposta_nova pendente e bloqueia futuras
set local role service_role;
select whatsapp_sair('558998980002', 'SAIR') as comp_saiu \gset
reset role;
select pg_temp.confere898(:'comp_saiu' = 't', 'SAIR sem o 9 encontra o comprador');
select pg_temp.confere898((select estado = 'cancelada' and erro = 'saiu'
  from whatsapp_fila where chave = 'radar_proposta_nova:' || :'ped5' || ':' || :'prop5_2'),
  'SAIR cancela proposta_nova pendente na fila');

-- Nova proposta (loja 1) após SAIR não entra na fila para comprador 2
set local role authenticated;
set local request.jwt.claim.sub = 'user_898loja1';
select proposta_id as prop5_1 from propor_radar(:'ped5'::uuid, '89800000-0000-4000-c000-000000000001'::uuid, null, 58000, 'Estante branca') \gset
reset role;
select pg_temp.confere898((select count(*) = 0 from whatsapp_fila where chave = 'radar_proposta_nova:' || :'ped5' || ':' || :'prop5_1'),
  'comprador que pediu SAIR não recebe proposta_nova no WhatsApp');

-- Comprador 2 responde VOLTAR: volta a receber proposta_nova (e se sino do app estiver desligado, não envia)
set local role service_role;
select whatsapp_radar_evento('5589998980002','voltar',null,encode(sha256(gen_random_uuid()::text::bytea),'hex'),clock_timestamp(),null) as comp_voltou \gset
reset role;
select pg_temp.confere898(:'comp_voltou' = 'voltou', 'VOLTAR reativa os avisos do comprador');

set local role authenticated;
set local request.jwt.claim.sub = 'user_898comp2';
select criar_pedido_radar_site('89800000-0000-4000-a000-000000000006', 'Procuro cômoda 898', 'Corrente', 'propostas_prazo', 72, null, :'sofas'::uuid) ->> 'id' as ped6 \gset
select salvar_preferencia_aviso('proposta_nova', false);
set local request.jwt.claim.sub = 'user_898loja1';
select proposta_id as prop6_1 from propor_radar(:'ped6'::uuid, '89800000-0000-4000-c000-000000000001'::uuid, null, 70000, 'Cômoda nova') \gset
reset role;
select pg_temp.confere898((select count(*) = 0 from whatsapp_fila where chave = 'radar_proposta_nova:' || :'ped6' || ':' || :'prop6_1'),
  'sino proposta_nova desligado no app impede WhatsApp mesmo após VOLTAR');

set local role authenticated;
set local request.jwt.claim.sub = 'user_898comp2';
select salvar_preferencia_aviso('proposta_nova', true);
set local request.jwt.claim.sub = 'user_898loja2';
select proposta_id as prop6_2 from propor_radar(:'ped6'::uuid, '89800000-0000-4000-c000-000000000002'::uuid, null, 69000, 'Cômoda grande') \gset
reset role;
select pg_temp.confere898((select count(*) = 1 from whatsapp_fila where chave = 'radar_proposta_nova:' || :'ped6' || ':' || :'prop6_2'),
  'após VOLTAR e sino ligado, proposta_nova volta a enfileirar');

-- Lojista 2 responde SAIR: não recebe proposta_escolhida; salvar_preferencia_whatsapp_radar(true) religa e (false) desliga os três
set local role service_role;
select whatsapp_sair('5589998980012', 'PARAR') as loja_saiu \gset
reset role;
select pg_temp.confere898(:'loja_saiu' = 't', 'SAIR da loja desliga os avisos');
set local role authenticated;
set local request.jwt.claim.sub = 'user_898comp2';
select * from escolher_proposta(:'prop6_2'::uuid);
reset role;
select pg_temp.confere898((select count(*) = 0 from whatsapp_fila where chave = 'radar_proposta_escolhida:' || :'ped6' || ':' || :'prop6_2'),
  'loja que pediu SAIR não recebe proposta_escolhida no WhatsApp');

set local role authenticated;
set local request.jwt.claim.sub = 'user_898loja2';
select pg_temp.confere898(salvar_preferencia_whatsapp_radar(true) = true, 'loja religa avisos pelo site');
select pg_temp.confere898(salvar_preferencia_whatsapp_radar(false) = false, 'loja desliga avisos pelo site');
reset role;
select pg_temp.confere898((select count(*) = 3 and bool_and(not ligado) from preferencias_avisos
  where usuario_id = 'user_898loja2' and canal = 'whatsapp' and tipo in ('pedido_novo', 'proposta_nova', 'proposta_escolhida')),
  'desligar pelo site desliga os três tipos de aviso do Radar no WhatsApp');

set local role authenticated;
set local request.jwt.claim.sub = 'user_898comp2';
select * from escolher_proposta(:'prop6_1'::uuid);
reset role;
select pg_temp.confere898((select count(*) = 1 from whatsapp_fila where chave = 'radar_proposta_escolhida:' || :'ped6' || ':' || :'prop6_1'),
  'outra loja ativa recebe proposta_escolhida normalmente');

-- Desligar pelo site após SAIR/ligar também bloqueia proposta_nova para quem desligou
set local role authenticated;
set local request.jwt.claim.sub = 'user_898comp';
select pg_temp.confere898(salvar_preferencia_whatsapp_radar(false) = false, 'comprador desliga WhatsApp pelo site');
select criar_pedido_radar_site('89800000-0000-4000-a000-000000000007', 'Procuro rack desligado 898', 'Corrente', 'propostas_prazo', 72, null, :'sofas'::uuid) ->> 'id' as ped7 \gset
set local request.jwt.claim.sub = 'user_898loja1';
select proposta_id as prop7_1 from propor_radar(:'ped7'::uuid, '89800000-0000-4000-c000-000000000001'::uuid, null, 45000, 'Rack teste') \gset
reset role;
select pg_temp.confere898((select count(*) = 0 from whatsapp_fila where chave = 'radar_proposta_nova:' || :'ped7' || ':' || :'prop7_1'),
  'quem desligou o WhatsApp pelo site não recebe proposta_nova');

-- [6b] Envio já em "enviando" -> SAIR -> VOLTAR não libera mensagem anterior ao SAIR, mas libera nova após VOLTAR
set local role authenticated;
set local request.jwt.claim.sub = 'user_898comp2';
select pg_temp.confere898(salvar_preferencia_whatsapp_radar(true) = true, 'comprador 2 religa antes do teste de envio em curso');
select criar_pedido_radar_site('89800000-0000-4000-a000-000000000011', 'Procuro banco 898', 'Corrente', 'propostas_prazo', 72, null, :'sofas'::uuid) ->> 'id' as ped8 \gset
set local request.jwt.claim.sub = 'user_898loja1';
select proposta_id as prop8_ant from propor_radar(:'ped8'::uuid, '89800000-0000-4000-c000-000000000001'::uuid, null, 30000, 'Banco pré-SAIR') \gset
reset role;
update whatsapp_fila set estado = 'cancelada', erro = 'limpeza_898_pre' where estado = 'pendente' and chave <> 'radar_proposta_nova:' || :'ped8' || ':' || :'prop8_ant';
update whatsapp_fila set enviar_apos = (:'t_janela'::timestamptz) - interval '1 minute' where chave = 'radar_proposta_nova:' || :'ped8' || ':' || :'prop8_ant';
create temp table pegos898_sair as select * from whatsapp_fila_pegar_em(5, :'t_janela'::timestamptz);
select pg_temp.confere898((select count(*) = 1 and bool_and(estado = 'enviando') from whatsapp_fila where chave = 'radar_proposta_nova:' || :'ped8' || ':' || :'prop8_ant'),
  'aviso pré-SAIR entrou em enviando');
set local role service_role;
select whatsapp_sair('5589998980002', 'SAIR') as comp2_saiu \gset
select whatsapp_radar_evento('5589998980002','voltar',null,encode(sha256(gen_random_uuid()::text::bytea),'hex'),clock_timestamp(),null) as comp2_voltou \gset
reset role;
select pg_temp.confere898(:'comp2_saiu' = 't' and :'comp2_voltou' = 'voltou', 'SAIR seguido de VOLTAR concluído');
select whatsapp_fila_confirmar_envio((select id from whatsapp_fila where chave = 'radar_proposta_nova:' || :'ped8' || ':' || :'prop8_ant')) as conf_pre_sair \gset
select pg_temp.confere898(:'conf_pre_sair' = 'cancelada'
  and (select estado = 'cancelada' and erro = 'radar_desligado' from whatsapp_fila where chave = 'radar_proposta_nova:' || :'ped8' || ':' || :'prop8_ant'),
  'VOLTAR não libera aviso em enviando criado antes do SAIR');

-- Nova proposta depois do VOLTAR entra normalmente e é liberada na confirmação
set local role authenticated;
set local request.jwt.claim.sub = 'user_898loja2';
select proposta_id as prop8_pos from propor_radar(:'ped8'::uuid, '89800000-0000-4000-c000-000000000002'::uuid, null, 29000, 'Banco pós-VOLTAR') \gset
reset role;
update whatsapp_fila set enviar_apos = (:'t_janela'::timestamptz) - interval '1 minute' where chave = 'radar_proposta_nova:' || :'ped8' || ':' || :'prop8_pos';
delete from pegos898_sair;
insert into pegos898_sair select * from whatsapp_fila_pegar_em(5, :'t_janela'::timestamptz);
select pg_temp.confere898(whatsapp_fila_confirmar_envio((select id from whatsapp_fila where chave = 'radar_proposta_nova:' || :'ped8' || ':' || :'prop8_pos')) = 'pode',
  'aviso criado após VOLTAR passa na confirmação');

-- [6c] Conta antiga e RPC legada:
-- 1) Conta nova chamando RPC legada salvar_preferencia_whatsapp_radar(true) inscreve SOMENTE em pedido_novo (blindagem entre migration e deploy).
insert into perfis(id, microrregiao_id, nome, cidade, whatsapp, whatsapp_verificado_em)
values ('user_898legado', :'reg', 'Conta 898 Tela Antiga', 'Corrente', '5589998980015', now());
set local role authenticated;
set local request.jwt.claim.sub = 'user_898legado';
select pg_temp.confere898(salvar_preferencia_whatsapp_radar(true) = true, 'RPC legada continua retornando true');
select minha_preferencia_whatsapp_radar() as pref_legada \gset
reset role;
select pg_temp.confere898((select ligado from preferencias_avisos where usuario_id = 'user_898legado' and tipo = 'pedido_novo' and canal = 'whatsapp')
  and (select count(*) = 0 from preferencias_avisos where usuario_id = 'user_898legado' and canal = 'whatsapp' and tipo in ('proposta_nova', 'proposta_escolhida'))
  and ((:'pref_legada'::jsonb)->>'ligado')::boolean = true and ((:'pref_legada'::jsonb)->>'parcial')::boolean = true,
  'RPC legada inscreve apenas pedido_novo e marca parcial=true');

-- 2) Conta antiga (somente pedido_novo=true): aparece ativa (parcial=true), pode desligar em 1 clique mesmo com recurso pausado,
-- responde ja_ativo coerente ao mandar VOLTAR e SAIR -> VOLTAR preserva somente pedido_novo sem assinar propostas
insert into perfis(id, microrregiao_id, nome, cidade, whatsapp, whatsapp_verificado_em)
values ('user_898antiga', :'reg', 'Loja 898 Antiga', 'Corrente', '5589998980014', now());
insert into preferencias_avisos(usuario_id, tipo, canal, ligado)
values ('user_898antiga', 'pedido_novo', 'whatsapp', true);

-- Mesmo com chave geral desligada, conta antiga enxerga ligado=true, parcial=true e consegue desligar com 1 clique
update configuracoes set valor = 'false'::jsonb where chave = 'radar.whatsapp_ativo' and microrregiao_id is null;
set local role authenticated;
set local request.jwt.claim.sub = 'user_898antiga';
select minha_preferencia_whatsapp_radar() as pref_antiga \gset
select pg_temp.confere898(((:'pref_antiga'::jsonb)->>'ligado')::boolean = true
  and ((:'pref_antiga'::jsonb)->>'parcial')::boolean = true
  and ((:'pref_antiga'::jsonb)->>'ativo')::boolean = false,
  'conta antiga (só pedido_novo=true) retorna ligado=true e parcial=true mesmo com chave desligada');
select salvar_preferencia_whatsapp_radar_completa(false) as desligou_antiga \gset
select minha_preferencia_whatsapp_radar() as pref_antiga_desl \gset
select pg_temp.confere898(:'desligou_antiga' = 'f' and ((:'pref_antiga_desl'::jsonb)->>'ligado')::boolean = false
  and ((:'pref_antiga_desl'::jsonb)->>'parcial')::boolean = false,
  'conta antiga desliga seus avisos com 1 clique pelo site');
reset role;
update configuracoes set valor = 'true'::jsonb where chave = 'radar.whatsapp_ativo' and microrregiao_id is null;

-- Conta antiga ativa: VOLTAR antes do SAIR retorna ja_ativo; SAIR -> VOLTAR reativa APENAS pedido_novo
update preferencias_avisos set ligado = true where usuario_id = 'user_898antiga' and tipo = 'pedido_novo' and canal = 'whatsapp';
set local role service_role;
select whatsapp_radar_evento('5589998980014','voltar',null,encode(sha256(gen_random_uuid()::text::bytea),'hex'),clock_timestamp(),null) as ant_ja \gset
select whatsapp_sair('5589998980014', 'SAIR') as ant_saiu \gset
select whatsapp_radar_evento('5589998980014','voltar',null,encode(sha256(gen_random_uuid()::text::bytea),'hex'),clock_timestamp(),null) as ant_voltou \gset
reset role;
select pg_temp.confere898(:'ant_ja' = 'ja_ativo' and :'ant_saiu' = 't' and :'ant_voltou' = 'orientacao',
  'conta antiga: VOLTAR antes do SAIR diz ja_ativo e SAIR -> VOLTAR orienta voltar pelo site');
select pg_temp.confere898((select not ligado from preferencias_avisos where usuario_id = 'user_898antiga' and tipo = 'pedido_novo' and canal = 'whatsapp')
  and (select count(*) = 0 from preferencias_avisos where usuario_id = 'user_898antiga' and canal = 'whatsapp' and tipo in ('proposta_nova', 'proposta_escolhida')),
  'SAIR -> VOLTAR sem prova deixa pedido_novo desligado e não assina propostas');

-- Conta com opt-in completo recebe confirmação explícita mencionando pedidos e propostas no VOLTAR
select pg_temp.confere898((select count(*) >= 1 and bool_and(texto like '%pedidos e propostas do Radar%')
  from whatsapp_fila where numero = '5589998980002' and chave like 'whatsapp_resposta:5589998980002:voltar%'),
  'conta com propostas no WhatsApp recebe confirmação de VOLTAR citando pedidos e propostas');

-- [7] Permissões fechadas
select pg_temp.confere898(
  not has_function_privilege('authenticated', 'radar_cancelar_fila_pedido(uuid)', 'execute')
  and not has_function_privilege('service_role', 'radar_cancelar_fila_pedido(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'whatsapp_fila_confirmar_envio_anterior_ia(uuid)', 'execute')
  and not has_function_privilege('service_role', 'whatsapp_fila_confirmar_envio_anterior_ia(uuid)', 'execute')
  and has_function_privilege('authenticated', 'minha_preferencia_whatsapp_radar()', 'execute')
  and not has_function_privilege('anon', 'minha_preferencia_whatsapp_radar()', 'execute')
  and has_function_privilege('authenticated', 'salvar_preferencia_whatsapp_radar(boolean)', 'execute')
  and not has_function_privilege('anon', 'salvar_preferencia_whatsapp_radar(boolean)', 'execute')
  and has_function_privilege('authenticated', 'salvar_preferencia_whatsapp_radar_completa(boolean)', 'execute')
  and not has_function_privilege('anon', 'salvar_preferencia_whatsapp_radar_completa(boolean)', 'execute'),
  'funções internas permanecem restritas e preferências acessíveis só autenticado');

rollback;
