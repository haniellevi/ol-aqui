\set ON_ERROR_STOP on
\set QUIET on
-- Vitrine com IA, etapa 4: lote de categorias com IA, nicho sugerido e decisão do dono. Fixtures descartáveis.
begin;
reset role;
set local request.jwt.claim.role='';
set local request.jwt.claim.sub='';
select id as reg from microrregioes where slug='corrente-pi' \gset
select id as moveis from categorias where slug='moveis' \gset
select id as carros from categorias where slug='eletrodomesticos' \gset
select id as raiz_casa from categorias where slug='casa-e-moveis' \gset
insert into perfis(id,microrregiao_id,nome,cidade,whatsapp,whatsapp_verificado_em) values
 ('user_loja480',:'reg','Loja 480','Corrente','5589999990480',now()),
 ('user_pf480',:'reg','Pessoa 480','Corrente','5589999990481',now()),
 ('user_outro480',:'reg','Outro 480','Corrente','5589999990482',now());
insert into vitrines_lojas(id,dono_id,microrregiao_id,slug,nome,cidade,whatsapp,tipo,plano,plano_expira_em) values
 ('48000000-0000-4000-a000-000000000001','user_loja480',:'reg','loja-480','Loja 480','Corrente','5589999990480','loja','full',now()+interval '30 days'),
 ('48000000-0000-4000-a000-000000000002','user_pf480',:'reg','pessoa-480','Pessoa 480','Corrente','5589999990481','pf','pf_gratis',null);
-- Publicados "amanhã" para entrarem primeiro no lote, mesmo com anúncios de exemplo no banco.
insert into anuncios(id,vitrine_id,categoria_id,titulo,descricao,cidade,preco_centavos,status,publicado_em) values
 ('48100000-0000-4000-a000-000000000001','48000000-0000-4000-a000-000000000001',:'carros','Sofá retrátil 480','Sofá de 3 lugares','Corrente',150000,'ativo',now()+interval '1 day'),
 ('48100000-0000-4000-a000-000000000002','48000000-0000-4000-a000-000000000001',:'carros','Geladeira 480',null,'Corrente',2000000,'ativo',now()+interval '1 day'),
 ('48100000-0000-4000-a000-000000000003','48000000-0000-4000-a000-000000000001',:'moveis','Mesa pausada 480',null,'Corrente',30000,'pausado',now()+interval '1 day'),
 ('48100000-0000-4000-a000-000000000004','48000000-0000-4000-a000-000000000002',:'carros','Cadeira da pessoa 480',null,'Corrente',9000,'ativo',now()+interval '1 day'),
 ('48100000-0000-4000-a000-000000000005','48000000-0000-4000-a000-000000000001',:'moveis','Rack 480',null,'Corrente',40000,'ativo',now()+interval '1 day');
update configuracoes set valor='10000' where chave='robo.orcamento_mensal_centavos' and microrregiao_id is null;

do $$ begin
  assert (select valor ? 'categorias_revisar' from configuracoes where chave='radar.avisos_escolha' and microrregiao_id is null), 'Aviso na lista de escolha';
  -- [1] Chave desligada: nada é reservado.
  assert categorizacao_ia_reservar() is null, 'Desligada não reserva';
end $$;
update configuracoes set valor='true' where chave='vitrine_ia.categorizacao_ativa' and microrregiao_id is null;
update configuracoes set valor='true' where chave='vitrine_ia.ativa' and microrregiao_id is null;

create temp table lote480 as select categorizacao_ia_reservar() as r;
do $$
declare r jsonb := (select r from lote480); ids text[];
begin
  -- [2] Lote: só anúncios no ar de lojas no ar; só título, descrição e categoria; categorias folha.
  assert r is not null, 'Reservou';
  ids := array(select x->>'id' from jsonb_array_elements(r->'anuncios') x);
  assert '48100000-0000-4000-a000-000000000001' = any(ids) and '48100000-0000-4000-a000-000000000002' = any(ids), 'Anúncios da loja no lote';
  assert not ('48100000-0000-4000-a000-000000000003' = any(ids)), 'Pausado fica fora';
  assert not ('48100000-0000-4000-a000-000000000004' = any(ids)), 'Pessoa física fica fora';
  assert cardinality(ids) <= 20, 'No máximo 20 por lote';
  assert (select array_agg(distinct k order by k) from jsonb_array_elements(r->'anuncios') x, jsonb_object_keys(x) k)
         = array['categoria','descricao','id','titulo'], 'Nada da pessoa vai para a IA';
  assert exists(select 1 from jsonb_array_elements(r->'categorias') c where c->>'slug'='moveis' and c->>'nome' like '% > Móveis'), 'Folha com caminho';
  assert not exists(select 1 from jsonb_array_elements(r->'categorias') c where c->>'slug' in ('veiculos','casa-e-moveis')), 'Categoria principal com filhas não entra';
  assert (select categoria_sugerida_em is not null from anuncios where id='48100000-0000-4000-a000-000000000001'), 'Marcado como em análise';
  assert exists(select 1 from robo_uso where tipo='categorizacao' and erro='em_andamento' and usuario_id is null), 'Custo reservado sem pessoa';
end $$;

do $$
declare r jsonb := (select r from lote480);
begin
  -- [3] Conclusão: só sugestão confiante, de folha disponível, diferente da atual e de anúncio do lote.
  assert categorizacao_ia_concluir((r->>'id')::uuid, (r->>'reserva')::uuid, jsonb_build_array(
    jsonb_build_object('anuncio_id','48100000-0000-4000-a000-000000000001','categoria','moveis','confianca',0.95),
    jsonb_build_object('anuncio_id','48100000-0000-4000-a000-000000000002','categoria','eletrodomesticos','confianca',0.99),
    jsonb_build_object('anuncio_id','48100000-0000-4000-a000-000000000005','categoria','carros','confianca',0.5),
    jsonb_build_object('anuncio_id','48100000-0000-4000-a000-000000000004','categoria','moveis','confianca',0.99),
    jsonb_build_object('anuncio_id','48100000-0000-4000-a000-000000000002','categoria','nao-existe','confianca',0.99),
    jsonb_build_object('anuncio_id','não é uuid','categoria','moveis','confianca',0.99),
    '"texto solto"'::jsonb), 0.001, 900, 120) = 1, 'Só uma sugestão vale';
  assert (select categoria_sugestao_estado='pendente' and categoria_sugerida_id=(select id from categorias where slug='moveis')
            from anuncios where id='48100000-0000-4000-a000-000000000001'), 'Sofá sugerido em Móveis';
  assert (select categoria_sugestao_estado is null and categoria_sugerida_em is not null from anuncios where id='48100000-0000-4000-a000-000000000002'), 'Mesma categoria: avaliado, sem sugestão';
  assert (select categoria_sugerida_em is null from anuncios where id='48100000-0000-4000-a000-000000000004'), 'Anúncio de fora do lote não muda';
  assert (select erro is null and custo_centavos > 0 and tokens_entrada=900 from robo_uso where id=(select uso_id from categorizacao_ia where id=(r->>'id')::uuid)), 'Custo real registrado';
  assert (select nicho_sugerido_id=(select id from categorias where slug='casa-e-moveis') from vitrines_lojas where id='48000000-0000-4000-a000-000000000001'), 'Nicho sugerido pela maioria';
  assert (select count(*)=1 from notificacoes where usuario_id='user_loja480' and tipo='categorias_revisar' and link='/minha-conta/loja/categorias'), 'Lojista avisado';
  -- [4] Lote fechado não aceita de novo.
  assert categorizacao_ia_concluir((r->>'id')::uuid, (r->>'reserva')::uuid, '[]'::jsonb) is null, 'Não conclui duas vezes';
  assert categorizacao_ia_concluir((r->>'id')::uuid, gen_random_uuid(), '[]'::jsonb) is null, 'Reserva errada';
end $$;

-- [5] Falha da IA devolve para a fila; limite do dia e orçamento seguram.
insert into anuncios(id,vitrine_id,categoria_id,titulo,cidade,preco_centavos,status,publicado_em) values
 ('48100000-0000-4000-a000-000000000006','48000000-0000-4000-a000-000000000001',:'carros','Poltrona 480','Corrente',50000,'ativo',now()+interval '2 days');
do $$
declare r jsonb := categorizacao_ia_reservar();
begin
  assert exists(select 1 from jsonb_array_elements(r->'anuncios') x where x->>'id'='48100000-0000-4000-a000-000000000006'), 'Anúncio novo entra no próximo lote';
  assert not exists(select 1 from jsonb_array_elements(r->'anuncios') x where x->>'id'='48100000-0000-4000-a000-000000000001'), 'Já avaliado não volta';
  assert categorizacao_ia_concluir((r->>'id')::uuid, (r->>'reserva')::uuid, null, null) = 0, 'Falha';
  assert (select categoria_sugerida_em is null from anuncios where id='48100000-0000-4000-a000-000000000006'), 'Volta para a fila';
  assert (select erro='custo_indeterminado' from robo_uso where id=(select uso_id from categorizacao_ia where id=(r->>'id')::uuid)), 'Sem custo informado mantém a reserva';
  update configuracoes set valor='0' where chave='vitrine_ia.categorizacao_por_dia' and microrregiao_id is null;
  assert categorizacao_ia_reservar() is null, 'Limite do dia';
  update configuracoes set valor='300' where chave='vitrine_ia.categorizacao_por_dia' and microrregiao_id is null;
  update configuracoes set valor='0' where chave='robo.orcamento_mensal_centavos' and microrregiao_id is null;
  assert categorizacao_ia_reservar() is null, 'Sem orçamento';
  assert (select categoria_sugerida_em is null from anuncios where id='48100000-0000-4000-a000-000000000006'), 'Sem orçamento não marca';
end $$;

-- [6] O dono decide; outra pessoa não.
set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='user_outro480';
do $$ begin
  begin
    perform decidir_todas_categorias('48000000-0000-4000-a000-000000000001', true);
    raise exception 'Outra pessoa decidiu';
  exception when insufficient_privilege then null; end;
  begin
    perform definir_nicho_loja('48000000-0000-4000-a000-000000000001', (select id from categorias where slug='veiculos'));
    raise exception 'Outra pessoa mudou o nicho';
  exception when insufficient_privilege then null; end;
  assert (select count(*)=0 from categorizacao_ia), 'Lotes só para a equipe';
  begin
    perform categorizacao_ia_reservar();
    raise exception 'Navegador reservou lote';
  exception when insufficient_privilege then null; end;
end $$;
set local request.jwt.claim.sub='user_loja480';
do $$ begin
  assert (select count(*)=1 from minhas_sugestoes_categoria('48000000-0000-4000-a000-000000000001')), 'Fila do dono';
  assert decidir_todas_categorias('48000000-0000-4000-a000-000000000001', true) = 1, 'Aceitou todas';
  assert (select count(*)=0 from minhas_sugestoes_categoria('48000000-0000-4000-a000-000000000001')), 'Fila vazia';
  assert (select sugerido_id=(select id from categorias where slug='casa-e-moveis') from minha_sugestao_nicho('48000000-0000-4000-a000-000000000001')), 'Dono vê o nicho sugerido';
  assert not exists(select 1 from nichos_disponiveis() n join categorias c on c.id=n.id where c.pai_id is not null), 'Só categorias principais';
  begin
    perform definir_nicho_loja('48000000-0000-4000-a000-000000000001', (select id from categorias where slug='moveis'));
    raise exception 'Subcategoria virou nicho';
  exception when check_violation then null; end;
  perform definir_nicho_loja('48000000-0000-4000-a000-000000000001', (select id from categorias where slug='casa-e-moveis'));
  assert (select nicho_id=(select id from categorias where slug='casa-e-moveis') and sugerido_id is null from minha_sugestao_nicho('48000000-0000-4000-a000-000000000001')), 'Nicho aceito pelo dono';
end $$;
reset role;
do $$ begin
  assert (select categoria_id=(select id from categorias where slug='moveis') and categoria_sugestao_estado='aceita'
            from anuncios where id='48100000-0000-4000-a000-000000000001'), 'Sofá mudou para Móveis';
  assert (select nicho_id=(select id from categorias where slug='casa-e-moveis') and nicho_sugerido_id is null
            from vitrines_lojas where id='48000000-0000-4000-a000-000000000001'), 'Nicho aceito';
end $$;
rollback;
