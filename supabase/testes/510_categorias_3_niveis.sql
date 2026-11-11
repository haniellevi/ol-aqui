\set ON_ERROR_STOP on
\set QUIET on
-- Etapa P1: árvore de categorias com 3 níveis, travas, busca, Radar, nicho e sugestão da troca. Fixtures descartáveis.
begin;
reset role;
set local request.jwt.claim.role='';
set local request.jwt.claim.sub='';
select id as reg from microrregioes where slug='corrente-pi' \gset
select id as pet from categorias where slug='animais-de-estimacao' \gset
select id as produtos from categorias where slug='produtos-para-pets' \gset
select id as racao from categorias where slug='racao' \gset
insert into perfis(id,microrregiao_id,nome,cidade,whatsapp,whatsapp_verificado_em) values
 ('user_loja510',:'reg','Loja 510','Corrente','5589999990510',now());
insert into vitrines_lojas(id,dono_id,microrregiao_id,slug,nome,cidade,whatsapp,tipo,plano,plano_expira_em) values
 ('51000000-0000-4000-a000-000000000001','user_loja510',:'reg','loja-510','Loja 510','Corrente','5589999990510','loja','full',now()+interval '30 days');

do $$
declare
  pet uuid := (select id from categorias where slug='animais-de-estimacao');
  racao uuid := (select id from categorias where slug='racao');
  produtos uuid := (select id from categorias where slug='produtos-para-pets');
  sofas uuid := (select id from categorias where slug='sofas-e-poltronas');
  nova uuid;
begin
  -- [1] Árvore: 21 principais ativas, no máximo 3 níveis, caminho e raiz.
  assert (select count(*) from categorias where pai_id is null and ativa) = 21, 'Vinte e uma categorias principais';
  assert not exists(select 1 from categorias where categoria_nivel(id) > 3), 'No máximo 3 níveis';
  assert categoria_nivel(racao) = 3 and categoria_nivel(produtos) = 2 and categoria_nivel(pet) = 1, 'Níveis';
  assert categoria_raiz(racao) = pet, 'Raiz da ração é Pet';
  assert categoria_nome_caminho(racao) = 'Pet › Produtos para pets › Ração', 'Nome do caminho';
  assert racao in (select categoria_e_descendentes(pet)), 'Descendentes incluem o 3º nível';
  assert (select array_agg(x) from categoria_caminho(racao) x) = array[racao, produtos, pet], 'Caminho da folha até a raiz';
  assert not (select ativa from categorias where slug='eletronicos'), 'Eletrônicos antiga saiu do menu';
  assert (select p.slug from categorias c join categorias p on p.id = c.pai_id where c.slug='celulares') = 'celulares-e-telefonia', 'Celulares mudou de mãe';
  assert (select pai_id is null and campos = '[]'::jsonb from categorias where slug='moveis'), 'Móveis virou principal sem campos';
  assert not exists(select 1 from categorias p where jsonb_array_length(p.campos) > 0
                     and exists(select 1 from categorias f where f.pai_id = p.id)), 'Quem tem filhas não tem campos';

  -- [2] Travas: 4º nível, ciclo e subir demais.
  begin
    insert into categorias(slug,nome,pai_id) values ('quarto-nivel-510','Quarto nível 510',racao);
    assert false, 'Aceitou o 4º nível';
  exception when sqlstate '22023' then null; end;
  begin
    update categorias set pai_id = racao where id = produtos;
    assert false, 'Aceitou ciclo';
  exception when sqlstate '22023' then null; end;
  begin
    update categorias set pai_id = (select id from categorias where slug='cachorros') where id = produtos;
    assert false, 'Aceitou passar de 3 níveis ao mover';
  exception when sqlstate '22023' then null; end;
  insert into categorias(slug,nome,pai_id) values ('tipo-novo-510','Tipo novo 510',(select id from categorias where slug='acessorios-de-celular')) returning id into nova;
  assert categoria_nivel(nova) = 3, 'Tipo novo no 3º nível';

  -- [3] Disponível só com o caminho inteiro ativo.
  update categorias set ativa = false where id = pet;
  assert not categoria_disponivel(racao), 'Principal desligada esconde o 3º nível';
  update categorias set ativa = true where id = pet;
  assert categoria_disponivel(racao), 'Volta ao religar';

  -- [4] Anúncio só em folha; a ração pede animal e peso ao publicar.
  begin
    insert into anuncios(vitrine_id,categoria_id,titulo,cidade,preco_centavos,status)
    values ('51000000-0000-4000-a000-000000000001',produtos,'Ração 510','Corrente',10000,'rascunho');
    assert false, 'Aceitou categoria com filhas';
  exception when sqlstate '23514' then null; end;
  begin
    insert into anuncios(vitrine_id,categoria_id,titulo,cidade,preco_centavos,status,publicado_em)
    values ('51000000-0000-4000-a000-000000000001',racao,'Ração 510 sem peso','Corrente',10000,'ativo',now());
    assert false, 'Publicou ração sem os campos obrigatórios';
  exception when sqlstate '23514' then null; end;
end $$;

insert into anuncios(id,vitrine_id,categoria_id,titulo,cidade,preco_centavos,status,publicado_em,atributos) values
 ('51100000-0000-4000-a000-000000000001','51000000-0000-4000-a000-000000000001',:'racao','Ração Golden 15 kg 510','Corrente',15000,'ativo',now(),
  '{"para_animal":"Cachorro","peso_kg":15}');

do $$
declare
  pet uuid := (select id from categorias where slug='animais-de-estimacao');
  racao uuid := (select id from categorias where slug='racao');
begin
  -- [5] Busca pela principal, pela sub e pelo tipo acha o anúncio do 3º nível.
  assert exists(select 1 from resultado_busca_anuncios(null,'animais-de-estimacao',null,null,null,null,null,'corrente-pi',24,0,null) r,
                unnest(r.anuncios) a where a.id='51100000-0000-4000-a000-000000000001'), 'Busca pela principal';
  assert exists(select 1 from resultado_busca_anuncios(null,'produtos-para-pets',null,null,null,null,null,'corrente-pi',24,0,null) r,
                unnest(r.anuncios) a where a.id='51100000-0000-4000-a000-000000000001'), 'Busca pela sub';
  assert exists(select 1 from resultado_busca_anuncios(null,'racao',null,null,null,null,null,'corrente-pi',24,0,null) r,
                unnest(r.anuncios) a where a.id='51100000-0000-4000-a000-000000000001'), 'Busca pelo tipo';
  assert not exists(select 1 from resultado_busca_anuncios(null,'gatos',null,null,null,null,null,'corrente-pi',24,0,null) r,
                unnest(r.anuncios) a where a.id='51100000-0000-4000-a000-000000000001'), 'Irmã não traz';

  -- [6] Radar e nicho entendem o 3º nível.
  assert radar_nicho_corresponde(pet, racao), 'Pedido de Pet acha a ração';
  assert not radar_nicho_corresponde((select id from categorias where slug='gatos'), racao), 'Pedido de gatos não acha ração';
  assert exists(select 1 from catalogo_lojas((select id from microrregioes where slug='corrente-pi'),'Corrente','animais-de-estimacao',48,0)
                where slug='loja-510'), 'Nicho Pet acha a loja da ração';
  assert (select slug from categorias where id = radar_categoria_pedido(null,'movel')) = 'moveis', 'Legado móvel vai para Móveis';

  -- [7] Troca: todo anúncio que já estava numa categoria que ganhou filhas recebeu sugestão de folha.
  assert not exists(select 1 from anuncios a
                     where a.status <> 'excluido' and a.criado_em < now() - interval '1 second'
                       and exists(select 1 from categorias f where f.pai_id = a.categoria_id and f.ativa)
                       and (a.categoria_sugestao_estado is distinct from 'pendente'
                            or exists(select 1 from categorias g where g.pai_id = a.categoria_sugerida_id))), 'Troca sugeriu folha';
end $$;

-- [8] Categoria que ganha filha: anúncios dela e sugestões para ela passam a apontar para a filha.
insert into anuncios(id,vitrine_id,categoria_id,titulo,cidade,preco_centavos,status,publicado_em) values
 ('51100000-0000-4000-a000-000000000002','51000000-0000-4000-a000-000000000001',(select id from categorias where slug='diversos'),'Coisa 510 A','Corrente',1000,'ativo',now()),
 ('51100000-0000-4000-a000-000000000003','51000000-0000-4000-a000-000000000001',(select id from categorias where slug='diversos'),'Coisa 510 B','Corrente',1000,'ativo',now());
insert into categorias(slug,nome,pai_id) values ('diversos-novo-510','Diversos novo 510',(select id from categorias where slug='diversos'));
do $$
declare
  nova uuid := (select id from categorias where slug='diversos-novo-510');
begin
  assert (select count(*) from anuncios where id in ('51100000-0000-4000-a000-000000000002','51100000-0000-4000-a000-000000000003')
            and categoria_sugerida_id = nova and categoria_sugestao_estado = 'pendente') = 2, 'Filha nova vira sugestão dos anúncios da mãe';
end $$;

-- [9] Dono aceita: um por um e "todas" sem desfazer o lote.
set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='user_loja510';
select decidir_categoria_sugerida('51100000-0000-4000-a000-000000000002', true);
do $$ begin
  assert decidir_todas_categorias('51000000-0000-4000-a000-000000000001', true) = 1, 'Aceitar todas trocou o que faltava';
  assert (select count(*) from anuncios where id in ('51100000-0000-4000-a000-000000000002','51100000-0000-4000-a000-000000000003')
            and categoria_id = (select id from categorias where slug='diversos-novo-510') and categoria_sugestao_estado = 'aceita') = 2, 'Os dois foram para a filha';
end $$;

-- [10] Categoria desligada: para o visitante, o caminho inteiro conta (mãe desligada esconde a filha).
reset role;
set local request.jwt.claim.role='';
set local request.jwt.claim.sub='';
update categorias set ativa = false where slug = 'animais-de-estimacao';
set local role anon;
set local request.jwt.claim.role='anon';
do $$
declare
  racao uuid := (select id from categorias where slug='racao');
begin
  assert not categoria_disponivel(racao), 'Filha de categoria desligada não fica disponível para o visitante';
  assert categoria_escondida('racao') and categoria_escondida('animais-de-estimacao') and categoria_escondida('eletronicos'), 'Escondida por slug';
  assert not categoria_escondida('veiculos') and not categoria_escondida('slug-que-nao-existe-510'), 'Não escondida';
  assert (select array_agg(slug) from categorias_do_caminho(racao)) = array['animais-de-estimacao','produtos-para-pets','racao'], 'Caminho do topo até a folha';
end $$;
reset role;

select 'ok' as categorias_3_niveis;
rollback;
