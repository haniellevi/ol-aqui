\set ON_ERROR_STOP on
begin;
set local session_replication_role = replica;
insert into public.perfis(id,microrregiao_id,nome,cidade)
select 'user_ia886',id,'Loja capa','Corrente' from public.microrregioes where slug='corrente-pi';
insert into public.vitrines_lojas(id,dono_id,microrregiao_id,nome,slug,cidade,tipo,plano,status,teste_expira_em)
select '88600000-0000-4000-a000-000000000001',id,microrregiao_id,'Loja capa','loja-capa-886','Corrente','loja','teste','ativa',now()+interval '30 days' from public.perfis where id='user_ia886';
insert into public.loja_ia_rascunhos(id,dono_id,estado,vitrine_id) values('88600000-0000-4000-a000-000000000002','user_ia886','publicado','88600000-0000-4000-a000-000000000001');
insert into public.loja_ia_imagens(id,rascunho_id,caminho,tipo,origem,estado,mime,tamanho,sha256) values
('88600000-0000-4000-a000-000000000003','88600000-0000-4000-a000-000000000002','teste-886','capa','merc','pronta','image/webp',1,repeat('a',64));
insert into public.loja_ia_imagens_vinculos(imagem_id,vitrine_id,uso) values('88600000-0000-4000-a000-000000000003','88600000-0000-4000-a000-000000000001','capa');
update public.vitrines_lojas set capa_url='/api/loja/imagem/88600000-0000-4000-a000-000000000003' where id='88600000-0000-4000-a000-000000000001';
set local session_replication_role = origin;
do $$ declare v jsonb; begin
 v := public.vitrine_publica('loja-capa-886');
 assert v->>'banner_url'='/api/loja/imagem/88600000-0000-4000-a000-000000000003', 'capa Merc deve aparecer no teste';
end $$;
set local session_replication_role = replica;
update public.loja_ia_imagens set origem='enviada' where id='88600000-0000-4000-a000-000000000003';
set local session_replication_role = origin;
do $$ begin assert public.vitrine_publica('loja-capa-886')->>'banner_url' is null, 'teste não libera foto comum'; end $$;
set local session_replication_role = replica;
update public.vitrines_lojas set plano='slim', plano_expira_em=now()+interval '30 days', teste_expira_em=now()-interval '1 day' where id='88600000-0000-4000-a000-000000000001';
set local session_replication_role = origin;
do $$ begin assert public.vitrine_publica('loja-capa-886')->>'banner_url'='/api/loja/imagem/88600000-0000-4000-a000-000000000003', 'plano permite foto'; end $$;
set local session_replication_role = replica;
update public.vitrines_lojas set banner_tipo='foto',banner_url='https://exemplo.test/foto.webp' where id='88600000-0000-4000-a000-000000000001';
set local session_replication_role = origin;
do $$ begin assert public.vitrine_publica('loja-capa-886')->>'banner_url'='https://exemplo.test/foto.webp', 'banner próprio deve ser preservado'; end $$;
set local session_replication_role = replica;
update public.vitrines_lojas set banner_tipo='modelo',banner_url=null where id='88600000-0000-4000-a000-000000000001';
delete from public.loja_ia_imagens_vinculos where imagem_id='88600000-0000-4000-a000-000000000003';
set local session_replication_role = origin;
do $$ begin assert public.vitrine_publica('loja-capa-886')->>'banner_url' is null, 'não usa imagem sem vínculo'; end $$;
rollback;
