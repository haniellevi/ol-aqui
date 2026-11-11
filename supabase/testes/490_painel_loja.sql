\set ON_ERROR_STOP on
\set QUIET on
-- Vitrine com IA, etapa 5a: eventos da loja, painel do dono, sugestões por regra e resumo semanal. Fixtures descartáveis.
begin;
reset role;
set local request.jwt.claim.role='';
set local request.jwt.claim.sub='';
select id as reg from microrregioes where slug='corrente-pi' \gset
select id as cat from categorias where slug='moveis' \gset
insert into perfis(id,microrregiao_id,nome,cidade,whatsapp,whatsapp_verificado_em) values
 ('user_loja490',:'reg','Loja 490','Corrente','5589999990490',now()),
 ('user_pf490',:'reg','Pessoa 490','Corrente','5589999990491',now()),
 ('user_outro490',:'reg','Outro 490','Corrente','5589999990492',now());
insert into vitrines_lojas(id,dono_id,microrregiao_id,slug,nome,cidade,whatsapp,tipo,plano,plano_expira_em) values
 ('49000000-0000-4000-a000-000000000001','user_loja490',:'reg','loja-490','Loja 490','Corrente','5589999990490','loja','slim',now()+interval '30 days'),
 ('49000000-0000-4000-a000-000000000002','user_pf490',:'reg','pessoa-490','Pessoa 490','Corrente','5589999990491','pf','pf_gratis',null);
insert into anuncios(id,vitrine_id,categoria_id,titulo,descricao,cidade,preco_centavos,fotos,status,publicado_em) values
 ('49100000-0000-4000-a000-000000000001','49000000-0000-4000-a000-000000000001',:'cat','Sofá 490',null,'Corrente',null,'{}','ativo',now()),
 ('49100000-0000-4000-a000-000000000002','49000000-0000-4000-a000-000000000001',:'cat','Mesa de jantar 6 lugares 490',
  'Mesa de madeira maciça, 1,80 m, com seis cadeiras estofadas. Pouco uso, sem riscos. Retirada no centro.','Corrente',120000,
  array['https://abc.supabase.co/storage/v1/object/public/anuncios/user_loja490/49100000-0000-4000-a000-000000000002/1.webp',
        'https://abc.supabase.co/storage/v1/object/public/anuncios/user_loja490/49100000-0000-4000-a000-000000000002/2.webp',
        'https://abc.supabase.co/storage/v1/object/public/anuncios/user_loja490/49100000-0000-4000-a000-000000000002/3.webp'],'ativo',now()),
 ('49100000-0000-4000-a000-000000000003','49000000-0000-4000-a000-000000000001',:'cat','Rack para sala de estar 490',
  'Rack de MDF branco com duas portas e nicho para aparelhos. Mede 1,60 m de largura. Ótimo estado.','Corrente',40000,
  array['https://abc.supabase.co/storage/v1/object/public/anuncios/user_loja490/49100000-0000-4000-a000-000000000003/1.webp'],'ativo',now());
-- Eventos dos produtos: semana atual e a anterior.
insert into eventos_anuncio(anuncio_id,tipo,criado_em)
 select '49100000-0000-4000-a000-000000000002'::uuid,'visualizacao',now()-interval '1 day' from generate_series(1,5)
 union all select '49100000-0000-4000-a000-000000000003','visualizacao',now()-interval '2 days' from generate_series(1,2)
 union all select '49100000-0000-4000-a000-000000000002','clique_whatsapp',now()-interval '1 day'
 union all select '49100000-0000-4000-a000-000000000001','compartilhar',now()-interval '1 day'
 union all select '49100000-0000-4000-a000-000000000002','visualizacao',now()-interval '10 days' from generate_series(1,3);
insert into favoritos(usuario_id,anuncio_id,criado_em) values ('user_outro490','49100000-0000-4000-a000-000000000002',now()-interval '1 day');

do $$ begin
  -- [1] Eventos da loja: dono, repetição, tipo inválido e pessoa física não contam.
  assert registrar_evento_loja('49000000-0000-4000-a000-000000000001','visita','10.0.0.1',null), 'Visita conta';
  assert not registrar_evento_loja('49000000-0000-4000-a000-000000000001','visita','10.0.0.1',null), 'Mesma pessoa não repete';
  assert registrar_evento_loja('49000000-0000-4000-a000-000000000001','visita','10.0.0.2',null), 'Outra pessoa conta';
  assert not registrar_evento_loja('49000000-0000-4000-a000-000000000001','visita','10.0.0.3','user_loja490'), 'Dono não conta';
  assert not registrar_evento_loja('49000000-0000-4000-a000-000000000001','compra','10.0.0.1',null), 'Tipo inválido';
  assert not registrar_evento_loja('49000000-0000-4000-a000-000000000002','visita','10.0.0.1',null), 'Pessoa física não tem painel de loja';
  assert registrar_evento_loja('49000000-0000-4000-a000-000000000001','clique_whatsapp','10.0.0.1',null), 'Clique no WhatsApp';
  assert registrar_evento_loja('49000000-0000-4000-a000-000000000001','clique_mapa','10.0.0.1',null), 'Clique no mapa';
  assert (select count(*)=4 from eventos_loja where vitrine_id='49000000-0000-4000-a000-000000000001'), 'Quatro eventos';
  assert (select bool_and(visitante_hash !~ '10\.0\.0') from eventos_loja), 'IP não fica guardado';
end $$;

-- [2] Painel do dono.
set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='user_loja490';
do $$
declare d jsonb := minha_loja_desempenho('49000000-0000-4000-a000-000000000001', 7);
begin
  assert d->>'dias' = '7', 'Sete dias';
  assert d->'atual' = jsonb_build_object('visitas',2,'visualizacoes',7,'cliques_whatsapp',2,'cliques_mapa',1,'favoritos',1), 'Números da semana: '||(d->'atual')::text;
  assert (d->'anterior'->>'visualizacoes')::int = 3, 'Semana anterior';
  assert d->'mais_vistos'->0->>'titulo' = 'Mesa de jantar 6 lugares 490' and (d->'mais_vistos'->0->>'visualizacoes')::int = 5
     and (d->'mais_vistos'->0->>'cliques')::int = 1, 'Mais visto primeiro';
  assert jsonb_array_length(d->'mais_vistos') = 2, 'Só produtos vistos (compartilhado sem vista não entra)';
  assert (minha_loja_desempenho('49000000-0000-4000-a000-000000000001', 99)->>'dias') = '7', 'Período inválido vira 7';
  assert (minha_loja_desempenho('49000000-0000-4000-a000-000000000001', 30)->'atual'->>'visualizacoes')::int = 10, 'Trinta dias';
  -- [3] Sugestões: sem foto primeiro; produto completo sem dica.
  assert (select array_agg(motivo order by ord) from (select motivo, row_number() over () ord from minhas_sugestoes_loja('49000000-0000-4000-a000-000000000001')) x)
         = array['sem_foto','poucas_fotos'], 'Dicas por regra';
  assert not exists(select 1 from minhas_sugestoes_loja('49000000-0000-4000-a000-000000000001') where anuncio_id='49100000-0000-4000-a000-000000000002'), 'Completo sem dica';
  assert not exists(select 1 from eventos_loja where vitrine_id <> '49000000-0000-4000-a000-000000000001'), 'Dono só lê a própria loja';
end $$;
set local request.jwt.claim.sub='user_outro490';
do $$ begin
  begin
    perform minha_loja_desempenho('49000000-0000-4000-a000-000000000001', 7);
    raise exception 'Outra pessoa viu o painel';
  exception when insufficient_privilege then null; end;
  begin
    perform minhas_sugestoes_loja('49000000-0000-4000-a000-000000000001');
    raise exception 'Outra pessoa viu as dicas';
  exception when insufficient_privilege then null; end;
  assert (select count(*)=0 from eventos_loja), 'Eventos só do dono';
  begin
    perform registrar_evento_loja('49000000-0000-4000-a000-000000000001','visita','x',null);
    raise exception 'Navegador registrou evento direto';
  exception when insufficient_privilege then null; end;
  begin
    perform loja_resumo_semanal();
    raise exception 'Navegador disparou o resumo';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- [4] Resumo semanal: só com a vitrine nova ligada; um por semana.
do $$ begin
  assert (select valor ? 'resumo_semanal' from configuracoes where chave='radar.avisos_escolha' and microrregiao_id is null), 'Aviso na lista de escolha';
  perform loja_resumo_semanal();
  assert not exists(select 1 from notificacoes where usuario_id='user_loja490' and tipo='resumo_semanal'), 'Desligada não envia';
  update configuracoes set valor='true' where chave='vitrine_ia.ativa' and microrregiao_id is null;
  assert loja_resumo_semanal() >= 1, 'Enviou';
  assert (select texto like '2 visitas na loja, 7 em produtos e 2 cliques no WhatsApp. Mais visto: Mesa de jantar 6 lugares 490. 2 dicas para vender mais.'
            and link='/minha-conta/loja/desempenho' from notificacoes where usuario_id='user_loja490' and tipo='resumo_semanal'), 'Texto do resumo';
  perform loja_resumo_semanal();
  assert (select count(*)=1 from notificacoes where usuario_id='user_loja490' and tipo='resumo_semanal'), 'Um por semana';
  assert not exists(select 1 from notificacoes where usuario_id='user_pf490' and tipo='resumo_semanal'), 'Pessoa física não recebe';
end $$;
rollback;
