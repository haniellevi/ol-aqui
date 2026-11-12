\set ON_ERROR_STOP on
\set QUIET on
-- Etapa P5b-1: o ajudante da loja cuida dos anúncios como o dono; nome da loja, plano e Destacar seguem do dono.
begin;
reset role;
set local request.jwt.claim.role='';
set local request.jwt.claim.sub='';
select id as reg from microrregioes where slug='corrente-pi' \gset
select id as diversos from categorias where slug='diversos' \gset
insert into perfis(id,microrregiao_id,nome,cidade,whatsapp,whatsapp_verificado_em) values
 ('user_dono560',:'reg','Dono 560','Corrente','5589999990560',now()),
 ('user_ajud560',:'reg','Ajudante 560','Corrente','5589999990561',now()),
 ('user_revog560',:'reg','Revogado 560','Corrente','5589999990562',now()),
 ('user_estranho560',:'reg','Estranho 560','Corrente','5589999990563',now());
insert into perfis(id,microrregiao_id,nome,cidade,whatsapp) values
 ('user_semzap560',:'reg','Sem Zap 560','Corrente','5589999990564');
insert into perfis(id,microrregiao_id,nome,cidade,whatsapp,whatsapp_verificado_em,e_admin) values
 ('user_adm560',:'reg','Admin 560','Corrente','5589999990565',now(),true);
insert into vitrines_lojas(id,dono_id,microrregiao_id,slug,nome,cidade,whatsapp,tipo,plano,plano_expira_em) values
 ('56000000-0000-4000-a000-000000000001','user_dono560',:'reg','loja-560','Loja 560','Corrente','5589999990560','loja','full',now()+interval '30 days');
insert into convites_gerente_loja(vitrine_id,token_hash,telefone_hash,final_telefone,aceito_por,aceito_em,revogado_em) values
 ('56000000-0000-4000-a000-000000000001','\x01','\x01','0561','user_ajud560',now(),null),
 ('56000000-0000-4000-a000-000000000001','\x02','\x02','0562','user_revog560',now(),now()),
 ('56000000-0000-4000-a000-000000000001','\x03','\x03','0564','user_semzap560',now(),null),
 ('56000000-0000-4000-a000-000000000001','\x04','\x04','0565','user_adm560',now(),null);
insert into anuncios(id,vitrine_id,categoria_id,titulo,cidade,preco_centavos,status,publicado_em) values
 ('56100000-0000-4000-a000-000000000001','56000000-0000-4000-a000-000000000001',:'diversos','Mesa de madeira 560','Corrente',5000,'ativo',now()),
 ('56100000-0000-4000-a000-000000000002','56000000-0000-4000-a000-000000000001',:'diversos','Rascunho 560','Corrente',5000,'rascunho',null),
 ('56100000-0000-4000-a000-000000000003','56000000-0000-4000-a000-000000000001',:'diversos','Cadeira 560','Corrente',5000,'ativo',now()),
 ('56100000-0000-4000-a000-000000000004','56000000-0000-4000-a000-000000000001',:'diversos','Banco 560','Corrente',5000,'pausado',now());

-- [1] Dono vê a equipe com a marca da Equipe Mercado da Região.
set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='user_dono560';
do $$ begin
  assert (select e_equipe from equipe_minha_loja('56000000-0000-4000-a000-000000000001') where gerente = 'Admin 560'), 'Admin ajudante tem a marca';
  assert not (select e_equipe from equipe_minha_loja('56000000-0000-4000-a000-000000000001') where gerente = 'Ajudante 560'), 'Ajudante comum sem a marca';
end $$;

-- [2] Ajudante: vê rascunho, edita, cria, publica, pausa, vende, lixeira e restaura.
set local request.jwt.claim.sub='user_ajud560';
do $$
declare n int; novo uuid;
begin
  assert public.pode_mexer_vitrine('56000000-0000-4000-a000-000000000001'), 'Ajudante pode mexer';
  assert exists (select 1 from anuncios where id = '56100000-0000-4000-a000-000000000002'), 'Ajudante vê o rascunho';
  update anuncios set titulo = 'Mesa de madeira maciça 560' where id = '56100000-0000-4000-a000-000000000001';
  get diagnostics n = row_count; assert n = 1, 'Ajudante editou';
  insert into anuncios(vitrine_id,categoria_id,titulo,cidade,preco_centavos,status)
  values ('56000000-0000-4000-a000-000000000001',(select id from categorias where slug='diversos'),'Novo do ajudante','Corrente',100,'rascunho')
  returning id into novo;
  assert novo is not null, 'Ajudante criou rascunho';
  -- Publicar passa da permissão e para na regra de foto (o mesmo que aconteceria com o dono).
  begin
    perform publicar_anuncio('56100000-0000-4000-a000-000000000004');
  exception when sqlstate '23514' then null; end;
  assert marcar_vendido('56100000-0000-4000-a000-000000000003') = 'vendido', 'Ajudante marcou vendido';
  assert mover_anuncio_lixeira('56100000-0000-4000-a000-000000000001') = 'excluido', 'Ajudante mandou para a lixeira';
  assert restaurar_anuncio('56100000-0000-4000-a000-000000000001') = 'pausado', 'Ajudante restaurou';
  assert (select count(*) from plano_da_loja('56000000-0000-4000-a000-000000000001')) = 1, 'Ajudante vê o plano da loja';
  assert (select count(*) from historico_alteracoes_ver('56100000-0000-4000-a000-000000000001', null, 50)) >= 3, 'Ajudante vê o histórico';
  assert (select count(*) from ultimas_alteracoes_anuncios(array['56100000-0000-4000-a000-000000000001'::uuid])) = 1, 'Ajudante vê a última mudança';
  assert (select e_dono from anuncio_publico('56100000-0000-4000-a000-000000000002')), 'Ajudante vê a prévia do rascunho';
  assert public.pode_enviar_foto('user_dono560/56100000-0000-4000-a000-000000000002/a.webp'), 'Ajudante envia foto na pasta do anúncio';
  assert not public.pode_enviar_foto('user_dono560/loja/a.webp'), 'Ajudante não envia logo da loja';
  assert not public.pode_enviar_foto('user_dono560/vitrine/a.webp'), 'Ajudante não envia fachada';
  assert public.pasta_foto_que_cuido('user_dono560/56100000-0000-4000-a000-000000000002/a.webp'), 'Ajudante apaga foto do anúncio';
  assert not public.pasta_foto_que_cuido('user_estranho560/56100000-0000-4000-a000-000000000002/a.webp'), 'Pasta de outra pessoa não';
  -- Nome e WhatsApp da loja seguem só do dono.
  update vitrines_lojas set nome = 'Tomada 560' where id = '56000000-0000-4000-a000-000000000001';
  get diagnostics n = row_count; assert n = 0, 'Ajudante mudou o nome da loja';
end $$;
reset role;
do $$ begin
  assert (select papel from historico_alteracoes where anuncio_id = '56100000-0000-4000-a000-000000000001' and acao = 'editou' limit 1) = 'ajudante', 'Histórico marca ajudante';
  assert (select quem from historico_alteracoes where anuncio_id = '56100000-0000-4000-a000-000000000003' and acao = 'status' order by id desc limit 1) = 'user_ajud560', 'Histórico guarda quem vendeu';
  assert not exists (select 1 from notificacoes where usuario_id = 'user_dono560' and tipo like 'anuncio%equipe%'), 'Ajudante não gera aviso no sino';
end $$;

-- [3] Estranho, revogado e sem WhatsApp confirmado não mexem.
set local role authenticated;
set local request.jwt.claim.role='authenticated';
do $$
declare quem text; n int;
begin
  foreach quem in array array['user_estranho560','user_revog560','user_semzap560'] loop
    perform set_config('request.jwt.claim.sub', quem, true);
    assert not public.pode_mexer_vitrine('56000000-0000-4000-a000-000000000001'), quem || ' pode mexer';
    assert not exists (select 1 from anuncios where id = '56100000-0000-4000-a000-000000000002'), quem || ' vê o rascunho';
    update anuncios set titulo = 'Tomado' where id = '56100000-0000-4000-a000-000000000004';
    get diagnostics n = row_count; assert n = 0, quem || ' editou';
    begin
      perform mover_anuncio_lixeira('56100000-0000-4000-a000-000000000004');
      assert false, quem || ' mandou para a lixeira';
    exception when sqlstate '42501' then null; end;
    begin
      perform publicar_anuncio('56100000-0000-4000-a000-000000000004');
      assert false, quem || ' publicou';
    exception when sqlstate '42501' then null; end;
    begin
      insert into anuncios(vitrine_id,categoria_id,titulo,cidade,preco_centavos,status)
      values ('56000000-0000-4000-a000-000000000001',(select id from categorias where slug='diversos'),'Intruso','Corrente',100,'rascunho');
      assert false, quem || ' criou anúncio';
    exception when sqlstate '42501' then null; end;
    assert (select count(*) from plano_da_loja('56000000-0000-4000-a000-000000000001')) = 0, quem || ' vê o plano';
    assert not public.pode_enviar_foto('user_dono560/56100000-0000-4000-a000-000000000002/b.webp'), quem || ' envia foto';
    begin
      perform historico_alteracoes_ver('56100000-0000-4000-a000-000000000001', null, 50);
      assert false, quem || ' viu o histórico';
    exception when sqlstate '42501' then null; end;
  end loop;
end $$;

-- [4] Loja fora do ar: o ajudante perde o acesso.
reset role;
update vitrines_lojas set status = 'suspensa' where id = '56000000-0000-4000-a000-000000000001';
set local role authenticated;
set local request.jwt.claim.sub='user_ajud560';
do $$ begin
  assert not public.pode_mexer_vitrine('56000000-0000-4000-a000-000000000001'), 'Ajudante mexe em loja suspensa';
end $$;
rollback;
