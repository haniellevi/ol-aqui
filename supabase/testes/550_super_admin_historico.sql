\set ON_ERROR_STOP on
\set QUIET on
-- Etapa P5a: super admin (só o banco liga), histórico visível ao dono, lixeira e "apagar de vez" pela equipe.
begin;
reset role;
set local request.jwt.claim.role='';
set local request.jwt.claim.sub='';
select id as reg from microrregioes where slug='corrente-pi' \gset
select id as diversos from categorias where slug='diversos' \gset
insert into perfis(id,microrregiao_id,nome,cidade,whatsapp,whatsapp_verificado_em) values
 ('user_dono550',:'reg','Dono Quinhentos','Corrente','5589999990550',now()),
 ('user_outro550',:'reg','Outro 550','Corrente','5589999990551',now());
insert into perfis(id,microrregiao_id,nome,cidade,whatsapp,whatsapp_verificado_em,e_admin) values
 ('user_adm550',:'reg','Admin Comum','Corrente','5589999990552',now(),true);
insert into perfis(id,microrregiao_id,nome,cidade,whatsapp,whatsapp_verificado_em,e_admin,e_super_admin) values
 ('user_super550',:'reg','Super Chefe','Corrente','5589999990553',now(),true,true),
 ('user_semadm550',:'reg','Sem Admin','Corrente','5589999990554',now(),false,true);
insert into vitrines_lojas(id,dono_id,microrregiao_id,slug,nome,cidade,whatsapp,tipo,plano,plano_expira_em) values
 ('55000000-0000-4000-a000-000000000001','user_dono550',:'reg','loja-550','Loja 550','Corrente','5589999990550','loja','full',now()+interval '30 days');
insert into anuncios(id,vitrine_id,categoria_id,titulo,cidade,preco_centavos,status,publicado_em) values
 ('55100000-0000-4000-a000-000000000001','55000000-0000-4000-a000-000000000001',:'diversos','Mesa de madeira 550','Corrente',5000,'ativo',now()),
 ('55100000-0000-4000-a000-000000000002','55000000-0000-4000-a000-000000000001',:'diversos','Cadeira simples 550','Corrente',5000,'ativo',now()),
 ('55100000-0000-4000-a000-000000000003','55000000-0000-4000-a000-000000000001',:'diversos','Rascunho 550','Corrente',5000,'rascunho',null);

do $$ begin
  assert public.e_super_admin('user_super550') and not public.e_super_admin('user_adm550'), 'Quem é super admin';
  assert not (select e_super_admin from perfis where id = 'user_semadm550'), 'Super admin sem administrador vira falso';
  assert (select count(*) from historico_alteracoes where anuncio_id = '55100000-0000-4000-a000-000000000001') = 1, 'Criar no ar gera linha';
  assert not exists (select 1 from historico_alteracoes where anuncio_id = '55100000-0000-4000-a000-000000000003'), 'Rascunho não gera linha';
  assert (select papel from historico_alteracoes where anuncio_id = '55100000-0000-4000-a000-000000000001') = 'sistema', 'Sem login = sistema';
end $$;

-- [1] Administrador do site não liga super admin nem tira o administrador de um super admin.
set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='user_adm550';
do $$ begin
  begin
    update perfis set e_super_admin = true where id = 'user_adm550';
  exception when sqlstate '42501' then null; end;
  begin
    update perfis set e_admin = false where id = 'user_super550';
  exception when sqlstate '42501' then null; end;
end $$;
reset role;
do $$ begin
  assert not (select e_super_admin from perfis where id = 'user_adm550'), 'Admin se fez super admin';
  assert (select e_super_admin and e_admin from perfis where id = 'user_super550'), 'Admin tirou o super admin';
end $$;

-- [2] O dono edita: uma linha por rodada de edição; pausar vira mudança de situação.
set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='user_dono550';
update anuncios set titulo = 'Mesa de madeira maciça 550' where id = '55100000-0000-4000-a000-000000000001';
update anuncios set descricao = 'Mesa grande, bem conservada.' where id = '55100000-0000-4000-a000-000000000001';
update anuncios set descricao = 'Rascunho mexido' where id = '55100000-0000-4000-a000-000000000003';
update anuncios set status = 'pausado' where id = '55100000-0000-4000-a000-000000000002';
update vitrines_lojas set sobre = 'Loja de móveis da família.' where id = '55000000-0000-4000-a000-000000000001';
reset role;
do $$ begin
  assert (select count(*) from historico_alteracoes where anuncio_id = '55100000-0000-4000-a000-000000000001'
           and acao = 'editou' and papel = 'dono' and quem = 'user_dono550') = 1, 'Edições seguidas viram uma linha';
  assert not exists (select 1 from historico_alteracoes where anuncio_id = '55100000-0000-4000-a000-000000000003'), 'Rascunho mexido não gera linha';
  assert exists (select 1 from historico_alteracoes where anuncio_id = '55100000-0000-4000-a000-000000000002'
           and acao = 'status' and de = 'ativo' and para = 'pausado'), 'Pausar registrado';
  assert exists (select 1 from historico_alteracoes where vitrine_id = '55000000-0000-4000-a000-000000000001'
           and anuncio_id is null and acao = 'editou' and papel = 'dono'), 'Loja editada registrada';
end $$;
-- Contador (visita) não conta como edição.
update anuncios set visualizacoes = visualizacoes + 5 where id = '55100000-0000-4000-a000-000000000001';
do $$ begin
  assert (select count(*) from historico_alteracoes where anuncio_id = '55100000-0000-4000-a000-000000000001') = 2, 'Contador gerou linha';
end $$;

-- [3] Editar anúncio dos outros: administrador comum não consegue; super admin sim, e aparece como equipe.
set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='user_adm550';
update anuncios set titulo = 'Mexido pelo admin' where id = '55100000-0000-4000-a000-000000000001';
set local request.jwt.claim.sub='user_super550';
update anuncios set preco_centavos = 4500 where id = '55100000-0000-4000-a000-000000000001';
reset role;
do $$ begin
  assert (select titulo from anuncios where id = '55100000-0000-4000-a000-000000000001') = 'Mesa de madeira maciça 550', 'Admin comum editou';
  assert (select preco_centavos from anuncios where id = '55100000-0000-4000-a000-000000000001') = 4500, 'Super admin não editou';
  assert exists (select 1 from historico_alteracoes where anuncio_id = '55100000-0000-4000-a000-000000000001'
           and acao = 'editou' and papel = 'equipe' and quem = 'user_super550'), 'Edição da equipe registrada';
end $$;

-- [4] Lixeira pela equipe: só super admin, com motivo; o dono recebe aviso e o histórico guarda o motivo.
set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='user_adm550';
do $$ begin
  begin
    perform admin_lixeira_anuncio('55100000-0000-4000-a000-000000000002', 'Regra do site');
    assert false, 'Admin comum mandou para a lixeira';
  exception when sqlstate '42501' then null; end;
  begin
    perform admin_antecipar_limpeza('anuncio', '55100000-0000-4000-a000-000000000002', 'Cadeira simples 550', 'Teste');
    assert false, 'Admin comum apagou de vez';
  exception when sqlstate '42501' then null; end;
  begin
    perform decidir_categorias_sugeridas(array['qualquer'], 'recusar');
    assert false, 'Admin comum decidiu categoria';
  exception when sqlstate '42501' then null; end;
end $$;
set local request.jwt.claim.sub='user_super550';
do $$ begin
  begin
    perform admin_lixeira_anuncio('55100000-0000-4000-a000-000000000002', 'x');
    assert false, 'Aceitou motivo curto';
  exception when sqlstate '22023' then null; end;
  begin
    perform admin_antecipar_limpeza('anuncio', '55100000-0000-4000-a000-000000000002', 'Cadeira simples 550', 'Fora da lixeira');
    assert false, 'Apagou o que não está na lixeira';
  exception when sqlstate '22023' then null; end;
  assert admin_lixeira_anuncio('55100000-0000-4000-a000-000000000002', 'Produto proibido pelas regras') = 'excluido', 'Lixeira';
  assert admin_lixeira_anuncio('55100000-0000-4000-a000-000000000002', 'De novo') = 'excluido', 'Repetir é seguro';
  begin
    perform admin_antecipar_limpeza('anuncio', '55100000-0000-4000-a000-000000000002', 'Cadeira', 'Apagar agora');
    assert false, 'Aceitou nome errado';
  exception when sqlstate '23514' then null; end;
  perform admin_antecipar_limpeza('anuncio', '55100000-0000-4000-a000-000000000002', 'Cadeira simples 550', 'Apagar agora');
end $$;
reset role;
do $$ begin
  assert (select status = 'excluido' and status_antes_exclusao = 'pausado' and excluido_em <= now() - interval '30 days'
            from anuncios where id = '55100000-0000-4000-a000-000000000002'), 'Marcado para a limpeza';
  assert (limpeza_pendente()->'anuncios') ? '55100000-0000-4000-a000-000000000002', 'Limpeza pega o anúncio';
  assert exists (select 1 from historico_alteracoes where anuncio_id = '55100000-0000-4000-a000-000000000002'
           and acao = 'lixeira' and papel = 'equipe' and motivo = 'Produto proibido pelas regras'), 'Histórico com motivo';
  assert (select count(*) from historico_alteracoes where anuncio_id = '55100000-0000-4000-a000-000000000002' and acao = 'lixeira') = 1, 'Uma linha de lixeira';
  assert (select count(*) from notificacoes where usuario_id = 'user_dono550' and tipo = 'anuncio_lixeira_equipe'
           and texto like '%Produto proibido pelas regras%') = 1, 'Aviso no sino';
  assert (select count(*) from admin_gestao_eventos where tipo = 'anuncio' and alvo = '55100000-0000-4000-a000-000000000002') = 2, 'Registro do painel';
  assert coalesce(current_setting('olaki.lixeira', true), '') = '' and coalesce(current_setting('olaki.motivo', true), '') = '', 'Atalhos desligados';
end $$;

-- [5] Leitura do histórico: dono e equipe veem; outra pessoa não. Nome da equipe com o primeiro nome.
set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='user_dono550';
do $$
declare r record;
begin
  assert (select count(*) from historico_alteracoes_ver('55100000-0000-4000-a000-000000000001')) = 3, 'Dono vê as 3 linhas';
  select * into r from historico_alteracoes_ver('55100000-0000-4000-a000-000000000001') limit 1;
  assert r.papel = 'equipe' and r.nome = 'Super' and not r.e_voce, 'Mais recente é da equipe: ' || row_to_json(r)::text;
  assert exists (select 1 from historico_alteracoes_ver('55100000-0000-4000-a000-000000000001') where e_voce and papel = 'dono'), 'Linha do próprio dono';
  assert (select count(*) from historico_alteracoes_ver(null, '55000000-0000-4000-a000-000000000001')) = 1, 'Histórico da loja';
  assert (select count(*) from ultimas_alteracoes_anuncios(array['55100000-0000-4000-a000-000000000001',
            '55100000-0000-4000-a000-000000000002']::uuid[])) = 2, 'Última mudança de cada anúncio';
  assert (select acao from ultimas_alteracoes_anuncios(array['55100000-0000-4000-a000-000000000002']::uuid[])) = 'lixeira', 'Última é a lixeira';
  begin
    perform historico_alteracoes_ver('55100000-0000-4000-a000-000000000001', '55000000-0000-4000-a000-000000000001');
    assert false, 'Aceitou anúncio e loja juntos';
  exception when sqlstate '22023' then null; end;
end $$;
set local request.jwt.claim.sub='user_outro550';
do $$ begin
  begin
    perform historico_alteracoes_ver('55100000-0000-4000-a000-000000000001');
    assert false, 'Outra pessoa viu o histórico';
  exception when sqlstate '42501' then null; end;
  assert not exists (select 1 from ultimas_alteracoes_anuncios(array['55100000-0000-4000-a000-000000000001']::uuid[])), 'Outra pessoa viu a última mudança';
  begin
    perform 1 from historico_alteracoes;
    assert false, 'Tabela aberta';
  exception when sqlstate '42501' then null; end;
end $$;
set local request.jwt.claim.sub='user_adm550';
do $$ begin
  assert (select count(*) from historico_alteracoes_ver('55100000-0000-4000-a000-000000000001')) = 3, 'Equipe vê o histórico';
end $$;

select 'ok' as super_admin_historico;
rollback;
