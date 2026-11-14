\set ON_ERROR_STOP on
\set QUIET on
begin;
reset role;
set local request.jwt.claim.role='';
set local request.jwt.claim.sub='';
select id as reg from microrregioes where slug='corrente-pi' \gset
insert into microrregioes(id,slug,nome) values ('88000000-0000-4000-a000-000000000009','marketing-distante-880','Distante 880');
insert into categorias(id,slug,nome,pai_id) values
 ('88000000-0000-4000-a000-000000000001','marketing-nicho-880','Marketing nicho 880',null),
 ('88000000-0000-4000-a000-000000000002','marketing-folhas-880','Marketing folhas 880','88000000-0000-4000-a000-000000000001'),
 ('88000000-0000-4000-a000-000000000003','marketing-vizinho-880','Marketing vizinho 880',null),
 ('88000000-0000-4000-a000-000000000004','marketing-outra-880','Marketing outra 880','88000000-0000-4000-a000-000000000003');
insert into perfis(id,microrregiao_id,nome,cidade,whatsapp,whatsapp_verificado_em)
select 'user_'||p||'880',:'reg',p||' 880','Corrente','558999999'||lpad((879+n)::text,4,'0'),now()
from unnest(array['dono','outro','ajud','revog','estranho','bloq','comprador','vazia']) with ordinality t(p,n);
insert into vitrines_lojas(id,dono_id,microrregiao_id,slug,nome,cidade,whatsapp,tipo,plano,plano_expira_em,nicho_id) values
 ('88100000-0000-4000-a000-000000000001','user_dono880',:'reg','marketing-loja-880','Loja 880','Corrente','5589999990880','loja','full',now()+interval '30 days','88000000-0000-4000-a000-000000000001'),
 ('88100000-0000-4000-a000-000000000002','user_outro880',:'reg','marketing-outra-880','Outra 880','Corrente','5589999990881','loja','full',now()+interval '30 days','88000000-0000-4000-a000-000000000001'),
 ('88100000-0000-4000-a000-000000000004','user_ajud880','88000000-0000-4000-a000-000000000009','marketing-ajudante-880','Ajudante 880','Outra cidade','5589999990882','loja','full',now()+interval '30 days','88000000-0000-4000-a000-000000000003'),
 ('88100000-0000-4000-a000-000000000003','user_vazia880',:'reg','marketing-vazia-880','Vazia 880','Corrente','5589999990887','loja','full',now()+interval '30 days',null);
insert into convites_gerente_loja(vitrine_id,token_hash,telefone_hash,final_telefone,aceito_por,aceito_em,revogado_em) values
 ('88100000-0000-4000-a000-000000000001','\x8801','\x8801','0881','user_ajud880',now(),null),
 ('88100000-0000-4000-a000-000000000001','\x8802','\x8802','0882','user_revog880',now(),now()),
 ('88100000-0000-4000-a000-000000000001','\x8803','\x8803','0883','user_bloq880',now(),null);
insert into contas_bloqueadas(usuario_id) values ('user_bloq880');

-- Quatro candidatos, seis estados não públicos e um produto sem foto.
insert into anuncios(id,vitrine_id,categoria_id,titulo,descricao,cidade,preco_centavos,preco_antes_centavos,fotos,status,publicado_em)
select ('88200000-0000-4000-a000-'||lpad(n::text,12,'0'))::uuid,
       '88100000-0000-4000-a000-000000000001','88000000-0000-4000-a000-000000000002',
       case n when 1 then 'Produto anunciado 880' when 2 then 'literalX880 da loja' else 'Produto próprio 880 '||n end,
       'Descrição preenchida', 'Corrente', case when n=4 then null else 15000 end,
       case when n=1 then 20000 end,
       case when n=8 then '{}'::text[] else array['https://abc.supabase.co/storage/v1/object/public/anuncios/user_dono880/88200000-0000-4000-a000-'||lpad(n::text,12,'0')||'/1.webp'] end,
       (case n when 5 then 'pausado' when 6 then 'vendido' when 7 then 'rascunho' when 9 then 'pausado' when 10 then 'em_analise' when 11 then 'congelado' else 'ativo' end)::status_anuncio,
       now()-interval '1 day'
from generate_series(1,11) n;
set local request.jwt.claim.sub='user_dono880';
select mover_anuncio_lixeira('88200000-0000-4000-a000-000000000009');
set local request.jwt.claim.sub='';
insert into anuncios(id,vitrine_id,categoria_id,titulo,cidade,preco_centavos,status,publicado_em)
select ('88210000-0000-4000-a000-'||lpad(n::text,12,'0'))::uuid,
       '88100000-0000-4000-a000-000000000002',
       case when n=5 then '88000000-0000-4000-a000-000000000004' else '88000000-0000-4000-a000-000000000002' end::uuid,
       case n when 1 then 'Estante rara 880' when 2 then 'Estante rara 880 reserva' when 3 then 'literal_880 especial' else 'Banco ambiguo 880' end,
       'Corrente',10000,'ativo',now()
from generate_series(1,5) n;
insert into anuncios_numeros_dia(anuncio_id,dia,visualizacoes,cliques_whatsapp,favoritos) values
 ('88200000-0000-4000-a000-000000000001',dia_metrica(now()),7,2,1),
 ('88200000-0000-4000-a000-000000000001',dia_metrica(now())-29,5,1,0),
 ('88200000-0000-4000-a000-000000000002',dia_metrica(now()),20,0,5),
 ('88200000-0000-4000-a000-000000000003',dia_metrica(now()),100,0,0),
 ('88200000-0000-4000-a000-000000000004',dia_metrica(now())-30,9999,999,999),
 ('88200000-0000-4000-a000-000000000004',dia_metrica(now())+1,9999,999,999),
 ('88200000-0000-4000-a000-000000000005',dia_metrica(now()),9999,999,999),
 ('88200000-0000-4000-a000-000000000008',dia_metrica(now()),9999,999,999);
insert into buscas_termos(microrregiao_id,dia,termo_normalizado,categoria_id,vezes,vezes_sem_resultado) values
 (:'reg',dia_metrica(now()),'estante rara 880',null,5,2),
 (:'reg',dia_metrica(now())-29,'estante rara 880','88000000-0000-4000-a000-000000000002',4,1),
 (:'reg',dia_metrica(now()),'prateleira azul 880','88000000-0000-4000-a000-000000000002',7,4),
 (:'reg',dia_metrica(now()),'literal_880',null,6,1),
 (:'reg',dia_metrica(now()),'desconto %','88000000-0000-4000-a000-000000000002',5,1),
 (:'reg',dia_metrica(now()),'produto anunciado 880','88000000-0000-4000-a000-000000000002',10,0),
 (:'reg',dia_metrica(now()),'marketing folhas 880',null,3,0),
 (:'reg',dia_metrica(now()),'banco ambiguo 880',null,999,999),
 (:'reg',dia_metrica(now()),'termo sem prova 880',null,999,999),
 (:'reg',dia_metrica(now()),'outro nicho 880','88000000-0000-4000-a000-000000000004',999,999),
 (:'reg',dia_metrica(now())-30,'busca antiga 880','88000000-0000-4000-a000-000000000002',999,999),
 (:'reg',dia_metrica(now())+1,'busca futura 880','88000000-0000-4000-a000-000000000002',999,999),
 ('88000000-0000-4000-a000-000000000009',dia_metrica(now()),'outra regiao 880','88000000-0000-4000-a000-000000000002',999,999);
insert into radar_pedidos(id,comprador_id,microrregiao_id,categoria_id,titulo,detalhes,cidade,criado_em,expira_em,visibilidade)
select ('88300000-0000-4000-a000-'||lpad(n::text,12,'0'))::uuid,'user_comprador880',
       case when n=6 then '88000000-0000-4000-a000-000000000009'::uuid else :'reg'::uuid end,
       case when n=7 then '88000000-0000-4000-a000-000000000004' else '88000000-0000-4000-a000-000000000002' end::uuid,
       case n when 1 then 'Procuro prateleira azul 880' when 2 then 'Prateleira azul 880' when 3 then 'Gaveta nova 880'
         when 4 then 'Pedido fechado 880' when 5 then 'Pedido expirado 880' when 6 then 'Pedido distante 880'
         when 7 then 'Pedido outro nicho 880' when 8 then 'Procuro produto anunciado 880'
         when 9 then 'Falar com 89999999999' else 'Pedido antigo 880' end,
       'Contato privado do comprador user_comprador880', 'Corrente',now(),now()+interval '5 days','todos'
from generate_series(1,10) n;
update radar_pedidos set status='encerrado' where id='88300000-0000-4000-a000-000000000004';
update radar_pedidos set expira_em=now()-interval '1 day' where id='88300000-0000-4000-a000-000000000005';
update radar_pedidos set criado_em=now()-interval '31 days' where id='88300000-0000-4000-a000-000000000010';

-- Restrito a lojas habilitadas, público fora da cidade e prazo de propostas encerrado.
insert into radar_pedidos(id,comprador_id,microrregiao_id,categoria_id,titulo,cidade,visibilidade,cidades_ids)
values ('88300000-0000-4000-a000-000000000011','user_comprador880',:'reg','88000000-0000-4000-a000-000000000002','Demanda privada 880','Corrente','lojas',null),
 ('88300000-0000-4000-a000-000000000012','user_comprador880',:'reg','88000000-0000-4000-a000-000000000002','Demanda fora da cidade 880','Gilbués','todos',array[(select id from cidades where microrregiao_id=:'reg' and nome='Gilbués')]),
 ('88300000-0000-4000-a000-000000000013','user_comprador880',:'reg','88000000-0000-4000-a000-000000000002','Prazo de propostas encerrado 880','Corrente','todos',null);
update radar_pedidos set modo_contato='propostas_prazo',propostas_ate=now()-interval '1 hour' where id='88300000-0000-4000-a000-000000000013';
insert into buscas_termos(microrregiao_id,dia,termo_normalizado,categoria_id,vezes)
values (:'reg',dia_metrica(now()),'email@example.com','88000000-0000-4000-a000-000000000002',900),
 (:'reg',dia_metrica(now()),'https://exemplo.com','88000000-0000-4000-a000-000000000002',900),
 (:'reg',dia_metrica(now()),'telefone 89999999999','88000000-0000-4000-a000-000000000002',900);

set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='user_dono880';
do $$
declare m jsonb; o jsonb;
begin
  m := meu_marketing_loja('88100000-0000-4000-a000-000000000001');
  assert (m->>'dias')::int=30 and (m->>'nicho_definido')::boolean, 'Janela e nicho';
  assert nullif(m->>'regiao_nome','') is not null, 'Nome da região';
  assert (m->>'total_buscas')::int=40, 'Buscas de 30 dias, região e nicho, sem multiplicar catálogo';
  assert jsonb_array_length(m->'criativos')=3, 'No máximo três criativos públicos com foto';
  assert m#>>'{criativos,0,id}'='88200000-0000-4000-a000-000000000001', 'Clique tem prioridade';
  assert m#>>'{criativos,1,id}'='88200000-0000-4000-a000-000000000002', 'Favorito antes de visita';
  assert m#>>'{criativos,2,id}'='88200000-0000-4000-a000-000000000003', 'Visitas desempata';
  assert m#>>'{criativos,0,visualizacoes}'='12' and m#>>'{criativos,0,cliques}'='3', 'Métricas somadas uma vez, incluindo o primeiro dia';
  assert m#>>'{criativos,0,preco_centavos}'='15000' and m#>>'{criativos,0,preco_antes_centavos}'='20000', 'Preços em centavos';
  assert (m#>'{criativos,0,motivos}') @> '["3 cliques no WhatsApp nos últimos 30 dias"]', 'Motivo corresponde à métrica';
  assert jsonb_array_length(m->'oportunidades')=6, 'Exclui catálogo próprio, região, nicho, ambiguidade, prazo, estado e contatos';
  select value into o from jsonb_array_elements(m->'oportunidades') where value->>'termo'='estante rara 880';
  assert o->>'buscas'='9' and o->>'sem_resultado'='3', 'Busca antiga associada por catálogo, com duas ofertas sem duplicar';
  select value into o from jsonb_array_elements(m->'oportunidades') where value->>'termo'='prateleira azul 880';
  assert o->>'buscas'='7' and o->>'pedidos'='2', 'Busca e Radar agregados sem multiplicar contagens';
  assert exists(select 1 from jsonb_array_elements(m->'oportunidades') v where v->>'termo'='literal_880'), 'Sublinhado literal ao associar e excluir produto existente';
  assert exists(select 1 from jsonb_array_elements(m->'oportunidades') v where v->>'termo'='desconto %'), 'Porcentagem literal';
  assert exists(select 1 from jsonb_array_elements(m->'oportunidades') v where v->>'termo'='marketing folhas 880'), 'Busca antiga associada por nome da categoria';
  assert m::text !~ '(user_comprador|Contato privado|comprador_id|pedido_id|89999999999)', 'Nenhuma pessoa, contato, detalhe ou ID de pedido';
  assert not exists(select 1 from jsonb_array_elements(m->'oportunidades') v
    where not (v ?& array['termo','categoria_id','categoria_slug','categoria_nome','buscas','pedidos','sem_resultado'])), 'Contrato completo das oportunidades';
  perform set_config('request.jwt.claim.sub','user_vazia880',true);
  m := meu_marketing_loja('88100000-0000-4000-a000-000000000003');
  assert m->'nicho_definido'='false' and m->'criativos'='[]' and m->'oportunidades'='[]' and m->>'total_buscas'='0', 'Loja vazia sem nicho tem estado próprio';
end $$;

set local request.jwt.claim.sub='user_ajud880';
do $$ begin
  assert jsonb_array_length(meu_marketing_loja('88100000-0000-4000-a000-000000000001')->'criativos')=3, 'Ajudante autorizado lê';
end $$;
reset role;
set local request.jwt.claim.role='';
set local request.jwt.claim.sub='';
update perfis set whatsapp_verificado_em=null where id='user_outro880';
set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='user_dono880';
do $$ declare m jsonb; o jsonb; begin
  m := meu_marketing_loja('88100000-0000-4000-a000-000000000001');
  assert m->>'total_buscas'='29', 'Busca antiga só usa catálogo com contato público';
  select value into o from jsonb_array_elements(m->'oportunidades') where value->>'termo'='estante rara 880';
  assert o->>'buscas'='4', 'Busca categorizada permanece sem atribuir busca antiga a anúncio sem contato';
  assert not exists(select 1 from jsonb_array_elements(m->'oportunidades') v where v->>'termo'='literal_880'), 'Catálogo sem contato não desambigua termo antigo';
end $$;
reset role;
set local request.jwt.claim.role='';
set local request.jwt.claim.sub='';
update perfis set whatsapp_verificado_em=now() where id='user_outro880';
update vitrines_lojas set verificacao_estado='aprovada',selo_loja_verificada=true,teste_expira_em=now()-interval '1 day'
where id='88100000-0000-4000-a000-000000000001';
set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='user_ajud880';
do $$ declare m jsonb; begin
  m := meu_marketing_loja('88100000-0000-4000-a000-000000000001');
  assert exists(select 1 from jsonb_array_elements(m->'oportunidades') v where v->>'termo'='demanda privada 880'), 'Ajudante vê demanda restrita pela habilitação da loja selecionada';
  assert not exists(select 1 from jsonb_array_elements(m->'oportunidades') v where v->>'termo'='demanda fora da cidade 880'), 'Habilitação mantém área da loja';
  assert not exists(select 1 from jsonb_array_elements(meu_marketing_loja('88100000-0000-4000-a000-000000000004')->'oportunidades')), 'Própria loja do ajudante mantém região e nicho próprios';
end $$;
reset role;
set local request.jwt.claim.role='';
set local request.jwt.claim.sub='';
update vitrines_lojas set plano_expira_em=now()-interval '1 day',teste_expira_em=now()-interval '1 day'
where id='88100000-0000-4000-a000-000000000001';
set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='user_dono880';
do $$ begin
  assert not exists(select 1 from jsonb_array_elements(meu_marketing_loja('88100000-0000-4000-a000-000000000001')->'oportunidades') v where v->>'termo'='demanda privada 880'), 'Plano vencido retira demanda privada sem retirar módulo';
end $$;
reset role;
set local request.jwt.claim.role='';
set local request.jwt.claim.sub='';
insert into buscas_termos(microrregiao_id,dia,termo_normalizado,categoria_id,vezes)
select :'reg',dia_metrica(now()),'demanda extra '||lpad(n::text,2,'0'),'88000000-0000-4000-a000-000000000002',100+n
from generate_series(1,10) n;
update anuncios set status='pausado'
where id in ('88200000-0000-4000-a000-000000000001','88200000-0000-4000-a000-000000000002','88200000-0000-4000-a000-000000000003');
set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='user_dono880';
do $$ declare m jsonb; begin
  m := meu_marketing_loja('88100000-0000-4000-a000-000000000001');
  assert jsonb_array_length(m->'oportunidades')=8 and m#>>'{oportunidades,0,termo}'='demanda extra 10', 'Oito oportunidades ordenadas por demanda';
  assert jsonb_array_length(m->'criativos')=1 and m#>>'{criativos,0,id}'='88200000-0000-4000-a000-000000000004', 'Sem métricas recentes ainda oferece anúncio elegível';
  assert m#>'{criativos,0,preco_centavos}'='null'::jsonb and m#>'{criativos,0,preco_antes_centavos}'='null'::jsonb, 'Preço ausente preserva null';
  assert m#>>'{criativos,0,visualizacoes}'='0' and m#>>'{criativos,0,cliques}'='0', 'Métricas antigas e futuras não entram';
end $$;
reset role;
set local request.jwt.claim.role='';
set local request.jwt.claim.sub='';
update vitrines_lojas set verificacao_estado='pendente',selo_loja_verificada=false where id='88100000-0000-4000-a000-000000000001';
update perfis set whatsapp_verificado_em=null where id='user_dono880';
set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='user_dono880';
do $$ begin
  assert meu_marketing_loja('88100000-0000-4000-a000-000000000001')->'criativos'='[]', 'Anúncio sem contato público não é selecionado para divulgação';
end $$;
reset role;
set local request.jwt.claim.role='';
set local request.jwt.claim.sub='';
update perfis set whatsapp_verificado_em=now() where id='user_dono880';
insert into categorias(id,slug,nome) values ('88000000-0000-4000-a000-000000000005','marketing-sem-demanda-880','Nicho sem demanda 880');
update vitrines_lojas set nicho_id='88000000-0000-4000-a000-000000000005' where id='88100000-0000-4000-a000-000000000003';
set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='user_vazia880';
do $$ declare m jsonb; begin
  m := meu_marketing_loja('88100000-0000-4000-a000-000000000003');
  assert m->'nicho_definido'='true' and m->'criativos'='[]' and m->'oportunidades'='[]' and m->>'total_buscas'='0', 'Nicho definido com zero sinais tem estado próprio';
end $$;
do $$ declare quem text; begin
  foreach quem in array array['user_estranho880','user_revog880','user_bloq880','user_outro880',''] loop
    perform set_config('request.jwt.claim.sub',quem,true);
    begin
      perform meu_marketing_loja('88100000-0000-4000-a000-000000000001');
      assert false, 'Conta sem acesso conseguiu ler';
    exception when insufficient_privilege then null;
    end;
  end loop;
end $$;
set local role anon;
do $$ begin
  begin
    perform meu_marketing_loja('88100000-0000-4000-a000-000000000001');
    assert false, 'Visitante executou RPC';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
set local request.jwt.claim.sub='';
set local request.jwt.claim.role='';
-- Mesmo com convite válido e JWT ainda presente, revogação e bloqueio são imediatos.
update convites_gerente_loja set revogado_em=now() where aceito_por='user_ajud880';
set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='user_ajud880';
do $$ begin
  begin perform meu_marketing_loja('88100000-0000-4000-a000-000000000001'); assert false, 'Revogação ignorada';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set local request.jwt.claim.sub='';
set local request.jwt.claim.role='';
insert into contas_bloqueadas(usuario_id) values ('user_dono880');
set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='user_dono880';
do $$ begin
  begin perform meu_marketing_loja('88100000-0000-4000-a000-000000000001'); assert false, 'Dono bloqueado leu';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
