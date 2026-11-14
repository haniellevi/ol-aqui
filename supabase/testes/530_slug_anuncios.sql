\set ON_ERROR_STOP on
\set QUIET on
-- Etapa P3: link curto e fixo do anúncio (slug), resolvedor do link, backfill e campos das RPCs.
begin;
reset role;
set local request.jwt.claim.role='';
set local request.jwt.claim.sub='';
select id as reg from microrregioes where slug='corrente-pi' \gset
select id as diversos from categorias where slug='diversos' \gset
insert into perfis(id,microrregiao_id,nome,cidade,whatsapp,whatsapp_verificado_em) values
 ('user_dono530',:'reg','Dono 530','Corrente','5589999990530',now());
insert into vitrines_lojas(id,dono_id,microrregiao_id,slug,nome,cidade,whatsapp,tipo,plano,plano_expira_em) values
 ('53000000-0000-4000-a000-000000000001','user_dono530',:'reg','loja-530','Loja 530','Corrente','5589999990530','loja','full',now()+interval '30 days');
insert into anuncios(id,vitrine_id,categoria_id,titulo,cidade,preco_centavos,status,publicado_em) values
 ('53100000-0000-4000-a000-000000000001','53000000-0000-4000-a000-000000000001',:'diversos','Geladeira Brastemp K3X','Corrente',85000,'ativo',now()),
 ('53100000-0000-4000-a000-000000000002','53000000-0000-4000-a000-000000000001',:'diversos','Geladeira Brastemp K3X','Corrente',85000,'ativo',now()),
 ('53100000-0000-4000-a000-000000000003','53000000-0000-4000-a000-000000000001',:'diversos','Rascunho 530 sem endereco','Corrente',5000,'rascunho',null),
 ('53100000-0000-4000-a000-000000000004','53000000-0000-4000-a000-000000000001',:'diversos','Sofá & Cama Mola Ação','Corrente',12000,'ativo',now()),
 ('53100000-0000-4000-a000-000000000005','53000000-0000-4000-a000-000000000001',:'diversos','Anúncio em análise 530','Corrente',5000,'em_analise',null),
 ('53100000-0000-4000-a000-000000000006','53000000-0000-4000-a000-000000000001',:'diversos','Anúncio pausado 530','Corrente',5000,'pausado',now());

-- [1] Rascunho não tem endereço; publicar cria o endereço no formato certo; dois títulos iguais ganham endereços diferentes.
do $$ begin
  assert (select slug from anuncios where id = '53100000-0000-4000-a000-000000000003') is null, 'Rascunho ganhou endereço';
  assert (select slug from anuncios where id = '53100000-0000-4000-a000-000000000001') ~ '^geladeira-brastemp-k3x-[a-z0-9]{4}$', 'Formato do endereço';
  assert (select slug from anuncios where id = '53100000-0000-4000-a000-000000000002') ~ '^geladeira-brastemp-k3x-[a-z0-9]{4}$', 'Formato do segundo endereço';
  assert (select slug from anuncios where id = '53100000-0000-4000-a000-000000000001') <> (select slug from anuncios where id = '53100000-0000-4000-a000-000000000002'), 'Títulos iguais repetiram o endereço';
  assert (select slug from anuncios where id = '53100000-0000-4000-a000-000000000004') ~ '^sofa-cama-mola-acao-[a-z0-9]{4}$', 'Acento e símbolo: Sofá & Cama Mola Ação';
  assert (select slug from anuncios where id = '53100000-0000-4000-a000-000000000005') ~ '^anuncio-em-analise-530-[a-z0-9]{4}$', 'Anúncio em análise também ganha endereço';
end $$;

-- [2] Forma do endereço (mesmos casos do tests/slug-anuncio.test.cjs).
do $$ begin
  assert slug_texto('Straße Øl') = 'strasse-ol', 'ß e Ø do unaccent';
  assert slug_texto('Sofá & Cama Mola Ação') = 'sofa-cama-mola-acao', 'Símbolo e acento';
end $$;
-- [2b] Forma do endereço: sem título útil usa "anuncio"; título longo corta em 60 letras sem hífen no fim.
do $$ begin
  assert novo_slug_anuncio('!!!!!') ~ '^anuncio-[a-z0-9]{4}$', 'Sem letras usa anuncio';
  assert novo_slug_anuncio('Aaaaaaaaa Bbbbbbbbb Ccccccccc Ddddddddd Eeeeeeeee Fffffffff Ggggggggg Hhhhhhhhh') ~ '^aaaaaaaaa-bbbbbbbbb-ccccccccc-ddddddddd-eeeeeeeee-fffffffff-[a-z0-9]{4}$', 'Corte de 60 letras';
  assert char_length(novo_slug_anuncio('Aaaaaaaaa Bbbbbbbbb Ccccccccc Ddddddddd Eeeeeeeee Fffffffff Ggggggggg Hhhhhhhhh')) = 64, 'Tamanho do endereço cortado';
end $$;

-- [3] O título muda e o endereço fica; alterar o endereço direto (sem o sistema) é desfeito.
do $$ declare antigo text; begin
  select slug into antigo from anuncios where id = '53100000-0000-4000-a000-000000000001';
  update anuncios set titulo = 'Geladeira Brastemp K3X Nova' where id = '53100000-0000-4000-a000-000000000001';
  assert (select slug from anuncios where id = '53100000-0000-4000-a000-000000000001') = antigo, 'Título novo trocou o endereço';
  update anuncios set slug = 'outro-link-0000' where id = '53100000-0000-4000-a000-000000000001';
  assert (select slug from anuncios where id = '53100000-0000-4000-a000-000000000001') = antigo, 'Alteração direta do endereço não foi desfeita';
  update anuncios set slug = null where id = '53100000-0000-4000-a000-000000000001';
  assert (select slug from anuncios where id = '53100000-0000-4000-a000-000000000001') = antigo, 'Apagar o endereço não foi desfeito';
end $$;

-- [4] Resolver do link, como visitante: ativo e pausado (fora do ar) aparecem; em análise não.
do $$ declare s1 text; sem text; pau text; achado uuid; detalhe text; begin
  select slug into s1 from anuncios where id = '53100000-0000-4000-a000-000000000001';
  select slug into sem from anuncios where id = '53100000-0000-4000-a000-000000000005';
  select slug into pau from anuncios where id = '53100000-0000-4000-a000-000000000006';
  set local role anon;
  select anuncio_id_por_slug(s1) into achado;
  assert achado = '53100000-0000-4000-a000-000000000001', 'Link curto não achou o anúncio ativo';
  select anuncio_id_por_slug(sem) into achado;
  assert achado is null, 'Anúncio em análise apareceu pelo link curto';
  select anuncio_id_por_slug(pau) into achado;
  assert achado = '53100000-0000-4000-a000-000000000006', 'O resolvedor deve reconhecer o endereço fixo do pausado';
  assert not exists (select 1 from anuncio_fora_do_ar(achado)), 'Anúncio pausado usou a página "fora do ar"';
  select anuncio_id_por_slug('nao-existe-0000') into achado;
  assert achado is null, 'Endereço inexistente achou anúncio';
  select anuncio_id_por_slug(null) into achado;
  assert achado is null, 'Endereço vazio achou anúncio';
  select slug into detalhe from anuncio_publico('53100000-0000-4000-a000-000000000001');
  assert detalhe = s1, 'anuncio_publico não devolve o endereço';
  reset role;
end $$;

-- O aviso de fora do ar continua disponível para anúncios expirados.
update anuncios set status='expirado' where id='53100000-0000-4000-a000-000000000006';
set local role anon;
do $$ begin
  assert exists (select 1 from anuncio_fora_do_ar('53100000-0000-4000-a000-000000000006')), 'Anúncio expirado perdeu o aviso';
end $$;
reset role;

-- [5] Busca e destaques trazem o endereço nos cartões (visitante).
do $$ declare s1 text; achado text; begin
  select slug into s1 from anuncios where id = '53100000-0000-4000-a000-000000000001';
  set local role anon;
  select b.slug into achado from buscar_anuncios(q => 'Geladeira Brastemp', microrregiao_slug => 'corrente-pi') b
   where b.id = '53100000-0000-4000-a000-000000000001';
  assert achado = s1, 'Busca não trouxe o endereço do cartão';
  reset role;
end $$;

-- [6] Backfill: anúncios fora de rascunho recebem endereço (o gatilho fica desligado só para simular o estado antigo).
alter table anuncios disable trigger anuncios_0_slug;
update anuncios set slug = null where status <> 'rascunho';
do $$ declare preenchidos integer; begin
  preenchidos := preencher_slugs_anuncios();
  assert preenchidos = 5, 'Backfill processou ' || preenchidos || ' anúncios, esperado 5';
end $$;
alter table anuncios enable trigger anuncios_0_slug;
do $$ begin
  assert (select count(*) from anuncios where status <> 'rascunho' and slug is null) = 0, 'Backfill deixou anúncio sem endereço';
  assert (select count(*) from anuncios where status = 'rascunho' and slug is not null) = 0, 'Backfill deu endereço a rascunho';
  assert (select slug from anuncios where id = '53100000-0000-4000-a000-000000000001') ~ '^geladeira-brastemp-k3x-nova-[a-z0-9]{4}$', 'Backfill usa o título atual';
  assert (select count(distinct slug) from anuncios where slug is not null) = 5, 'Backfill repetiu endereço';
end $$;

select 'PASS 530' as resultado;
rollback;
