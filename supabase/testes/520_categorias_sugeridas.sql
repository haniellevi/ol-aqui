\set ON_ERROR_STOP on
\set QUIET on
-- Etapa P2: sugerir categoria nova, lista agrupada do admin, aprovar, juntar, recusar e aviso no sino.
begin;
reset role;
set local request.jwt.claim.role='';
set local request.jwt.claim.sub='';
select id as reg from microrregioes where slug='corrente-pi' \gset
select id as diversos from categorias where slug='diversos' \gset
insert into perfis(id,microrregiao_id,nome,cidade,whatsapp,whatsapp_verificado_em) values
 ('user_dono520',:'reg','Dono 520','Corrente','5589999990520',now()),
 ('user_outro520',:'reg','Outro 520','Corrente','5589999990521',now());
insert into perfis(id,microrregiao_id,nome,cidade,e_admin) values ('user_admin520',:'reg','Admin 520','Corrente',true);
insert into vitrines_lojas(id,dono_id,microrregiao_id,slug,nome,cidade,whatsapp,tipo,plano,plano_expira_em) values
 ('52000000-0000-4000-a000-000000000001','user_dono520',:'reg','loja-520','Loja 520','Corrente','5589999990520','loja','full',now()+interval '30 days');
insert into anuncios(id,vitrine_id,categoria_id,titulo,cidade,preco_centavos,status,publicado_em) values
 ('52100000-0000-4000-a000-000000000001','52000000-0000-4000-a000-000000000001',:'diversos','Sal grosso 25 kg A','Corrente',5000,'ativo',now()),
 ('52100000-0000-4000-a000-000000000002','52000000-0000-4000-a000-000000000001',:'diversos','Sal grosso 25 kg B','Corrente',5000,'ativo',now()),
 ('52100000-0000-4000-a000-000000000003','52000000-0000-4000-a000-000000000001',:'diversos','Sal grosso 25 kg C','Corrente',5000,'ativo',now()),
 ('52100000-0000-4000-a000-000000000004','52000000-0000-4000-a000-000000000001',:'diversos','Coisa estranha 520','Corrente',5000,'ativo',now()),
 ('52100000-0000-4000-a000-000000000005','52000000-0000-4000-a000-000000000001',:'diversos','Outra coisa 520','Corrente',5000,'rascunho',null);

do $$ begin
  assert normalizar_sugestao_categoria('  Rações ') = 'racao', 'Plural e acento';
  assert normalizar_sugestao_categoria('Animais') = 'animal' and normalizar_sugestao_categoria('Flores') = 'flor', 'Plurais';
  assert normalizar_sugestao_categoria('Sal  Grosso!') = 'sal grosso', 'Espaços e sinais';
  assert slug_texto('Sal Grosso & Cia') = 'sal-grosso-cia', 'Slug';
end $$;

-- [1] O dono sugere.
set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='user_dono520';
select sugerir_categoria('52100000-0000-4000-a000-000000000001', 'Sal grosso');
select sugerir_categoria('52100000-0000-4000-a000-000000000002', 'sal  GROSSO');
select sugerir_categoria('52100000-0000-4000-a000-000000000003', 'Sal groso');
select sugerir_categoria('52100000-0000-4000-a000-000000000004', 'Coisa estranha');
select sugerir_categoria('52100000-0000-4000-a000-000000000005', 'Primeiro nome');
select sugerir_categoria('52100000-0000-4000-a000-000000000005', 'Outra coisa nova');
do $$ begin
  assert (select count(*) from categorias_sugeridas where autor_id = 'user_dono520') = 5, 'Uma sugestão por anúncio (a segunda substitui)';
  assert (select texto from minha_sugestao_categoria('52100000-0000-4000-a000-000000000005')) = 'Outra coisa nova', 'Lê a própria sugestão';
  begin
    perform sugerir_categoria('52100000-0000-4000-a000-000000000001', 'Rações');
    assert false, 'Aceitou sugerir categoria que já existe';
  exception when sqlstate '22023' then null; end;
  begin
    perform sugerir_categoria('52100000-0000-4000-a000-000000000001', 'x');
    assert false, 'Aceitou nome curto';
  exception when sqlstate '22023' then null; end;
  begin
    perform admin_categorias_sugeridas();
    assert false, 'Dono viu a lista do admin';
  exception when sqlstate '42501' then null; end;
  begin
    perform decidir_categorias_sugeridas(array['sal grosso'], 'recusar');
    assert false, 'Dono decidiu sugestão';
  exception when sqlstate '42501' then null; end;
end $$;
select cancelar_sugestao_categoria('52100000-0000-4000-a000-000000000005');

-- [2] Outra pessoa não sugere no anúncio dos outros nem vê as sugestões dele.
set local request.jwt.claim.sub='user_outro520';
do $$ begin
  begin
    perform sugerir_categoria('52100000-0000-4000-a000-000000000001', 'Qualquer');
    assert false, 'Sugeriu no anúncio de outra pessoa';
  exception when sqlstate '42501' then null; end;
  assert not exists(select 1 from categorias_sugeridas), 'Vê sugestão dos outros';
  assert not exists(select 1 from minha_sugestao_categoria('52100000-0000-4000-a000-000000000001')), 'Lê sugestão dos outros';
end $$;

-- [3] Admin: lista agrupada, com o erro de digitação ao lado.
set local request.jwt.claim.sub='user_admin520';
do $$
declare
  r record;
  res jsonb;
  nova uuid;
begin
  select * into r from admin_categorias_sugeridas() where texto_norm = 'sal grosso';
  assert r.quantidade = 2 and r.anuncios = 2, 'Grupo junta as duas';
  assert 'sal groso' = any(r.parecidas), 'Mostra o parecido';
  assert (r.proximas->0->>'caminho') = 'Outros › Diversos', 'Categoria próxima com caminho';
  assert not exists(select 1 from admin_categorias_sugeridas() where texto_norm = 'outra coisa nova'), 'Cancelada some da lista';

  -- [4] Aprovar os dois grupos juntos: cria a categoria e move os 3 anúncios.
  begin
    perform decidir_categorias_sugeridas(array['sal grosso'], 'aprovar', 'Sal grosso', (select id from categorias where slug='racao'));
    assert false, 'Criou 4º nível';
  exception when sqlstate '22023' then null; end;
  res := decidir_categorias_sugeridas(array['sal grosso', 'sal groso'], 'aprovar', 'Sal grosso', (select id from categorias where slug='outros'));
  nova := (res->>'categoria_id')::uuid;
  assert (res->>'decididas')::int = 3 and (res->>'movidos')::int = 3, 'Decidiu e moveu 3';
  assert (select slug from categorias where id = nova) = 'sal-grosso', 'Slug da nova';
  assert categoria_nome_caminho(nova) = 'Outros › Sal grosso', 'Lugar da nova';
  assert (select count(*) from anuncios where categoria_id = nova) = 3, 'Anúncios na nova';
  begin
    perform decidir_categorias_sugeridas(array['sal grosso'], 'recusar');
    assert false, 'Decidiu de novo';
  exception when sqlstate '22023' then null; end;

  -- [5] Juntar só com categoria final no ar; recusar deixa o anúncio onde está.
  begin
    perform decidir_categorias_sugeridas(array['coisa estranha'], 'juntar', null, null, (select id from categorias where slug='outros'));
    assert false, 'Juntou com categoria que tem filhas';
  exception when sqlstate '22023' then null; end;
  res := decidir_categorias_sugeridas(array['coisa estranha'], 'recusar');
  assert (res->>'decididas')::int = 1 and (res->>'movidos')::int = 0, 'Recusou';
  assert (select categoria_id from anuncios where id = '52100000-0000-4000-a000-000000000004') = (select id from categorias where slug='diversos'), 'Recusa não move';
  assert (select estado from categorias_sugeridas where anuncio_id = '52100000-0000-4000-a000-000000000004') = 'recusada', 'Estado recusada';
end $$;

-- [6] Juntar com uma que existe.
set local request.jwt.claim.sub='user_dono520';
select sugerir_categoria('52100000-0000-4000-a000-000000000004', 'Sal grossinho');
set local request.jwt.claim.sub='user_admin520';
do $$
declare res jsonb;
begin
  res := decidir_categorias_sugeridas(array['sal grossinho'], 'juntar', null, null, (select id from categorias where slug='sal-grosso'));
  assert (res->>'movidos')::int = 1, 'Juntou e moveu';
  assert (select estado from categorias_sugeridas where anuncio_id = '52100000-0000-4000-a000-000000000004' and estado <> 'recusada') = 'juntada', 'Estado juntada';
end $$;
-- [7] Juntar com categoria que pede campos: o anúncio fica onde está e o dono é avisado (admin sem WhatsApp).
--     E o dono que trocou de categoria antes da decisão não é movido.
reset role;
insert into anuncios(id,vitrine_id,categoria_id,titulo,cidade,preco_centavos,status,publicado_em) values
 ('52100000-0000-4000-a000-000000000006','52000000-0000-4000-a000-000000000001',(select id from categorias where slug='diversos'),'Comida de bicho 520','Corrente',5000,'ativo',now()),
 ('52100000-0000-4000-a000-000000000007','52000000-0000-4000-a000-000000000001',(select id from categorias where slug='diversos'),'Comida de bicho 520 B','Corrente',5000,'ativo',now());
set local role authenticated;
set local request.jwt.claim.sub='user_dono520';
select sugerir_categoria('52100000-0000-4000-a000-000000000006', 'Comida de bicho');
select sugerir_categoria('52100000-0000-4000-a000-000000000007', 'Comida de bicho');
update anuncios set categoria_id = (select id from categorias where slug='sal-grosso') where id = '52100000-0000-4000-a000-000000000007';
set local request.jwt.claim.sub='user_admin520';
do $$
declare res jsonb;
begin
  res := decidir_categorias_sugeridas(array['comida de bicho'], 'juntar', null, null, (select id from categorias where slug='racao'));
  assert (res->>'decididas')::int = 2 and (res->>'movidos')::int = 0 and (res->>'revisar')::int = 1, 'Uma para revisar, outra pulada: ' || res::text;
end $$;
reset role;
do $$ begin
  assert (select categoria_id = (select id from categorias where slug='diversos') and categoria_sugestao_estado is null
            from anuncios where id = '52100000-0000-4000-a000-000000000006'), 'Ficou onde estava, sem revisão impossível';
  assert (select categoria_id = (select id from categorias where slug='sal-grosso') from anuncios where id = '52100000-0000-4000-a000-000000000007'), 'Troca do dono respeitada';
  assert coalesce(current_setting('olaki.sistema', true), '') = '', 'Atalho do sistema desligado no fim';
end $$;

do $$ begin
  assert (select count(*) from notificacoes where usuario_id = 'user_dono520' and tipo = 'categoria_sugerida') = 5, 'Aviso no sino (3 aprovados + 1 juntado + 1 revisar)';
end $$;

select 'ok' as categorias_sugeridas;
rollback;
