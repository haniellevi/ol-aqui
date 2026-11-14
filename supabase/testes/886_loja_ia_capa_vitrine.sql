\set ON_ERROR_STOP on
begin;
set local session_replication_role = replica;
insert into public.perfis(id,microrregiao_id,nome,cidade)
select uid,id,'Loja capa','Corrente' from public.microrregioes cross join unnest(array['user_ia886','user_mod886','user_admin886']) uid where slug='corrente-pi';
insert into public.equipe(usuario_id,papel) values ('user_mod886','moderador');
update public.perfis set e_admin=true where id='user_admin886';
insert into public.vitrines_lojas(id,dono_id,microrregiao_id,nome,slug,cidade,tipo,plano,status,teste_expira_em)
select '88600000-0000-4000-a000-000000000001',id,microrregiao_id,'Loja capa','loja-capa-886','Corrente','loja','teste','ativa',now()+interval '30 days' from public.perfis where id='user_ia886';
insert into public.loja_ia_rascunhos(id,dono_id,estado,vitrine_id) values('88600000-0000-4000-a000-000000000002','user_ia886','publicado','88600000-0000-4000-a000-000000000001');
insert into public.loja_ia_imagens(id,rascunho_id,caminho,tipo,origem,estado,mime,tamanho,sha256) values
('88600000-0000-4000-a000-000000000003','88600000-0000-4000-a000-000000000002','teste-886','capa','merc','pronta','image/webp',1,repeat('a',64));
update public.loja_ia_imagens set criado_em=now()-interval '2 days' where id='88600000-0000-4000-a000-000000000003';
insert into public.loja_ia_imagens_vinculos(imagem_id,vitrine_id,uso) values('88600000-0000-4000-a000-000000000003','88600000-0000-4000-a000-000000000001','capa');
update public.vitrines_lojas set capa_url='/api/loja/imagem/88600000-0000-4000-a000-000000000003' where id='88600000-0000-4000-a000-000000000001';
insert into public.aki_imagens(id,usuario_id,tipo,gratuito,estado,url)
values ('88600000-0000-4000-a000-000000000004','user_ia886','banner',true,'pronta','https://exemplo.test/nova-arte.webp');
set local session_replication_role = origin;
update public.configuracoes set valor='"https://abc.supabase.co"' where chave='fotos.origem' and microrregiao_id is null;
do $$ declare v jsonb; begin
 v := public.vitrine_publica('loja-capa-886');
 assert v->>'banner_url'='/api/loja/imagem/88600000-0000-4000-a000-000000000003', 'capa Merc deve aparecer no teste';
 assert public.loja_ia_imagem_publica('88600000-0000-4000-a000-000000000003')='teste-886', 'rota entrega a capa vigente do Merc';
end $$;
set local role authenticated;
set local request.jwt.claim.sub='user_admin886';
do $$ declare
 loja constant uuid := '88600000-0000-4000-a000-000000000001';
 v jsonb := public.admin_loja_detalhe(loja);
begin
 assert public.admin_salvar_loja(loja,(v->>'atualizado_em')::timestamptz,jsonb_build_object('descricao','Descrição atualizada','capa_url',v->>'capa_url'),'Atualizar descrição')=loja, 'edição de gestão deve preservar a capa aprovada';
 begin
  perform public.admin_salvar_loja(loja,(public.admin_loja_detalhe(loja)->>'atualizado_em')::timestamptz,
    '{"capa_url":"/api/loja/imagem/88600000-0000-4000-a000-000000000009"}','Confere validação');
  raise exception 'gestão aceitou imagem privada sem aprovação';
 exception when check_violation then null;
 end;
end $$;
reset role;
set local request.jwt.claim.sub='';
do $$ begin
 assert public.vitrine_publica('loja-capa-886')->>'banner_url'='/api/loja/imagem/88600000-0000-4000-a000-000000000003', 'edição pela gestão removeu a capa aprovada';
end $$;
set local session_replication_role = replica;
update public.loja_ia_imagens set origem='enviada' where id='88600000-0000-4000-a000-000000000003';
set local session_replication_role = origin;
do $$ begin
 assert public.vitrine_publica('loja-capa-886')->>'banner_url' is null, 'teste não libera foto comum';
 assert public.loja_ia_imagem_publica('88600000-0000-4000-a000-000000000003') is null, 'rota não libera foto comum fora do plano';
end $$;
set local session_replication_role = replica;
update public.vitrines_lojas set plano='slim', plano_expira_em=now()+interval '30 days', teste_expira_em=now()-interval '1 day' where id='88600000-0000-4000-a000-000000000001';
set local session_replication_role = origin;
do $$ begin
 assert public.vitrine_publica('loja-capa-886')->>'banner_url'='/api/loja/imagem/88600000-0000-4000-a000-000000000003', 'plano permite foto';
 assert public.loja_ia_imagem_publica('88600000-0000-4000-a000-000000000003')='teste-886', 'rota libera foto vigente no plano';
end $$;
set local session_replication_role = replica;
update public.vitrines_lojas set banner_tipo='foto',banner_url='https://exemplo.test/foto.webp' where id='88600000-0000-4000-a000-000000000001';
set local session_replication_role = origin;
do $$ begin
 assert public.vitrine_publica('loja-capa-886')->>'banner_url'='https://exemplo.test/foto.webp', 'banner próprio deve ser preservado';
 assert public.loja_ia_imagem_publica('88600000-0000-4000-a000-000000000003') is null, 'rota não entrega a capa encoberta pelo banner';
end $$;

-- O gatilho faz parte da atualização normal. As fixtures antigas acima usaram replica.
update public.vitrines_lojas set banner_tipo='modelo',banner_url=null where id='88600000-0000-4000-a000-000000000001';
do $$ begin
 assert public.vitrine_publica('loja-capa-886')->>'banner_url' is null, 'capa do piloto voltou ao remover banner substituto';
 assert public.loja_ia_imagem_publica('88600000-0000-4000-a000-000000000003') is null, 'rota entrega capa aposentada';
end $$;

update public.vitrines_lojas set capa_url='/api/loja/imagem/88600000-0000-4000-a000-000000000003' where id='88600000-0000-4000-a000-000000000001';
insert into public.loja_ia_imagens_vinculos(imagem_id,vitrine_id,uso) values('88600000-0000-4000-a000-000000000003','88600000-0000-4000-a000-000000000001','capa');
set local role authenticated;
set local request.jwt.claim.sub='user_ia886';
select public.aki_aplicar_banner('88600000-0000-4000-a000-000000000004',50,null);
reset role;
do $$ begin
 assert public.vitrine_publica('loja-capa-886')->>'banner_url'='https://exemplo.test/nova-arte.webp', 'nova arte do Merc não aparece';
 assert (select capa_url is null from public.vitrines_lojas where id='88600000-0000-4000-a000-000000000001'), 'aplicar arte do Merc reteve a capa antiga';
end $$;

-- A equipe consegue encontrar e tirar uma capa do piloto sem banner convencional.
set local session_replication_role = replica;
update public.vitrines_lojas set banner_tipo='modelo',banner_url=null,banner_aki_posicao=null,capa_url='/api/loja/imagem/88600000-0000-4000-a000-000000000003' where id='88600000-0000-4000-a000-000000000001';
insert into public.loja_ia_imagens_vinculos(imagem_id,vitrine_id,uso) values('88600000-0000-4000-a000-000000000003','88600000-0000-4000-a000-000000000001','capa');
set local session_replication_role = origin;
set local role authenticated;
do $$ begin
 assert not exists (select 1 from public.banners_para_moderacao()), 'dono acessa fila da equipe';
end $$;
set local request.jwt.claim.sub='user_mod886';
do $$ begin
 assert exists (select 1 from public.banners_para_moderacao() where slug='loja-capa-886' and banner_url='/api/loja/imagem/88600000-0000-4000-a000-000000000003'), 'capa piloto ausente na fila de moderação';
 assert public.moderar_banner_vitrine('88600000-0000-4000-a000-000000000001','Foto fora das regras')='/api/loja/imagem/88600000-0000-4000-a000-000000000003', 'moderação não identifica a capa removida';
 assert not exists (select 1 from public.banners_para_moderacao() where slug='loja-capa-886'), 'capa moderada continua na fila';
end $$;
reset role;
do $$ begin
 assert public.vitrine_publica('loja-capa-886')->>'banner_url' is null, 'capa moderada continua na vitrine';
 assert public.loja_ia_imagem_publica('88600000-0000-4000-a000-000000000003') is null, 'rota entrega capa moderada';
end $$;
set local role authenticated;
set local request.jwt.claim.sub='user_ia886';
do $$ begin
 begin
  update public.vitrines_lojas set capa_url='/api/loja/imagem/88600000-0000-4000-a000-000000000003' where id='88600000-0000-4000-a000-000000000001';
  raise exception 'dono republicou capa moderada';
 exception when invalid_parameter_value then null;
 end;
end $$;
reset role;
do $$ begin
 assert public.loja_ia_marcar_descarte('88600000-0000-4000-a000-000000000003')='teste-886', 'limpeza não encontra capa removida';
end $$;

set local session_replication_role = replica;
update public.loja_ia_imagens set estado='pronta' where id='88600000-0000-4000-a000-000000000003';
update public.vitrines_lojas set capa_url='/api/loja/imagem/88600000-0000-4000-a000-000000000003' where id='88600000-0000-4000-a000-000000000001';
set local session_replication_role = origin;
do $$ begin assert public.vitrine_publica('loja-capa-886')->>'banner_url' is null, 'não usa imagem sem vínculo'; end $$;
rollback;
