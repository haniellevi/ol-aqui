\set ON_ERROR_STOP on
\set QUIET on
-- Etapa P5b-2a: super admin edita anúncio dos outros só com a edição aberta (motivo, 2 horas, 1 aviso).
begin;
reset role;
set local request.jwt.claim.role='';
set local request.jwt.claim.sub='';
select id as reg from microrregioes where slug='corrente-pi' \gset
select id as diversos from categorias where slug='diversos' \gset
insert into perfis(id,microrregiao_id,nome,cidade,whatsapp,whatsapp_verificado_em) values
 ('user_dono570',:'reg','Dono 570','Corrente','5589999990570',now());
insert into perfis(id,microrregiao_id,nome,cidade,whatsapp,whatsapp_verificado_em,e_admin) values
 ('user_adm570',:'reg','Admin 570','Corrente','5589999990571',now(),true);
insert into perfis(id,microrregiao_id,nome,cidade,whatsapp,whatsapp_verificado_em,e_admin,e_super_admin) values
 ('user_super570',:'reg','Ana Super','Corrente','5589999990572',now(),true,true);
insert into vitrines_lojas(id,dono_id,microrregiao_id,slug,nome,cidade,whatsapp,tipo,plano,plano_expira_em) values
 ('57000000-0000-4000-a000-000000000001','user_dono570',:'reg','loja-570','Loja 570','Corrente','5589999990570','loja','full',now()+interval '30 days');
insert into anuncios(id,vitrine_id,categoria_id,titulo,cidade,preco_centavos,status,publicado_em) values
 ('57100000-0000-4000-a000-000000000001','57000000-0000-4000-a000-000000000001',:'diversos','Mesa 570','Corrente',5000,'ativo',now()),
 ('57100000-0000-4000-a000-000000000002','57000000-0000-4000-a000-000000000001',:'diversos','Cadeira 570','Corrente',5000,'congelado',now()),
 ('57100000-0000-4000-a000-000000000003','57000000-0000-4000-a000-000000000001',:'diversos','Sofá 570','Corrente',5000,'em_analise',now());

set local role authenticated;
set local request.jwt.claim.role='authenticated';

-- [1] Sem abrir a edição, o super admin não mexe; admin comum não abre.
set local request.jwt.claim.sub='user_super570';
do $$
declare n int;
begin
  update anuncios set titulo = 'Sem motivo' where id = '57100000-0000-4000-a000-000000000001';
  get diagnostics n = row_count; assert n = 0, 'Super editou sem abrir a edição';
  assert not public.pode_enviar_foto('user_dono570/57100000-0000-4000-a000-000000000001/a.webp'), 'Foto sem edição aberta';
  begin perform admin_abrir_edicao_anuncio('57100000-0000-4000-a000-000000000001', 'x'); assert false, 'Motivo curto';
  exception when sqlstate '22023' then null; end;
  begin perform admin_abrir_edicao_anuncio('57100000-0000-4000-a000-000000000002', 'Ajuste'); assert false, 'Anúncio bloqueado';
  exception when sqlstate '22023' then null; end;
end $$;
set local request.jwt.claim.sub='user_adm570';
do $$ begin
  begin perform admin_abrir_edicao_anuncio('57100000-0000-4000-a000-000000000001', 'Ajuste de título'); assert false, 'Admin comum abriu';
  exception when sqlstate '42501' then null; end;
  assert (select count(*) from minha_edicao_admin('57100000-0000-4000-a000-000000000001')) = 0, 'Admin comum vê edição';
end $$;

-- [2] Abre com motivo: 2 horas, 1 aviso; abrir de novo só renova o prazo.
set local request.jwt.claim.sub='user_super570';
do $$
declare ate timestamptz; n int;
begin
  ate := admin_abrir_edicao_anuncio('57100000-0000-4000-a000-000000000001', '  Foto  com   telefone ');
  assert ate between now() + interval '119 minutes' and now() + interval '121 minutes', 'Prazo de 2 horas';
  perform admin_abrir_edicao_anuncio('57100000-0000-4000-a000-000000000001', 'Outro motivo');
  assert (select motivo from minha_edicao_admin('57100000-0000-4000-a000-000000000001')) = 'Foto com telefone', 'Motivo limpo e mantido';
  update anuncios set titulo = 'Mesa de madeira 570' where id = '57100000-0000-4000-a000-000000000001';
  get diagnostics n = row_count; assert n = 1, 'Super não editou com edição aberta';
  assert public.pode_enviar_foto('user_dono570/57100000-0000-4000-a000-000000000001/a.webp'), 'Super envia foto na pasta do dono';
  assert public.pasta_foto_que_cuido('user_dono570/57100000-0000-4000-a000-000000000001/a.webp'), 'Super apaga foto do anúncio';
  assert not public.pode_enviar_foto('user_dono570/loja/a.webp'), 'Super não envia logo';
  -- Em análise: só a equipe com edição aberta troca foto.
  assert not public.pode_enviar_foto('user_dono570/57100000-0000-4000-a000-000000000003/a.webp'), 'Foto em análise sem edição';
  perform admin_abrir_edicao_anuncio('57100000-0000-4000-a000-000000000003', 'Trocar foto com telefone');
  assert public.pode_enviar_foto('user_dono570/57100000-0000-4000-a000-000000000003/a.webp'), 'Super troca foto em análise';
end $$;
set local request.jwt.claim.sub='user_dono570';
do $$ begin
  assert not public.pode_enviar_foto('user_dono570/57100000-0000-4000-a000-000000000003/a.webp'), 'Dono troca foto em análise';
  assert public.pode_enviar_foto('user_dono570/57100000-0000-4000-a000-000000000001/a.webp'), 'Dono envia foto do anúncio ativo';
end $$;
reset role;
do $$ begin
  assert (select count(*) from notificacoes where usuario_id = 'user_dono570' and tipo = 'anuncio_edicao_equipe' and texto like '%Mesa 570%') = 1, 'Um aviso só';
  assert (select texto from notificacoes where usuario_id = 'user_dono570' and tipo = 'anuncio_edicao_equipe' and texto like '%Mesa 570%') like '%Motivo: Foto com telefone%', 'Aviso com o motivo';
  assert (select count(*) from admin_gestao_eventos where alvo = '57100000-0000-4000-a000-000000000001' and acao = 'editar') = 1, 'Evento da equipe';
  assert exists (select 1 from historico_alteracoes where anuncio_id = '57100000-0000-4000-a000-000000000001'
    and acao = 'editou' and papel = 'equipe' and quem = 'user_super570' and motivo = 'Foto com telefone'), 'Histórico com motivo';
end $$;

-- [3] Prazo vencido: não edita mais.
update admin_edicoes_anuncio set expira_em = now() - interval '1 minute';
set local role authenticated;
set local request.jwt.claim.sub='user_super570';
do $$
declare n int;
begin
  update anuncios set titulo = 'Depois do prazo' where id = '57100000-0000-4000-a000-000000000001';
  get diagnostics n = row_count; assert n = 0, 'Editou depois do prazo';
  assert (select count(*) from minha_edicao_admin('57100000-0000-4000-a000-000000000001')) = 0, 'Edição vencida aparece';
end $$;

-- [4] Dono não abre edição "da equipe" no próprio anúncio.
reset role;
set local request.jwt.claim.role='';
update perfis set e_admin = true, e_super_admin = true where id = 'user_dono570';
set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='user_dono570';
do $$ begin
  begin perform admin_abrir_edicao_anuncio('57100000-0000-4000-a000-000000000001', 'Meu ajuste'); assert false, 'Dono abriu edição da equipe';
  exception when sqlstate '22023' then null; end;
end $$;
rollback;
