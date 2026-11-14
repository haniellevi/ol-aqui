\set ON_ERROR_STOP on
begin;
insert into perfis(id,microrregiao_id,nome,cidade)
select x,id,'Teste imagem','Corrente' from microrregioes cross join unnest(array['user_ia883a','user_ia883b']) x where slug='corrente-pi';
insert into loja_ia_convites(usuario_id) values ('user_ia883a'),('user_ia883b');
set local role authenticated;
set local request.jwt.claim.sub='user_ia883a';
select loja_ia_abrir_coleta() as draft \gset
select set_config('test.imagem_draft', :'draft'::jsonb->>'id', true);
select loja_ia_reservar_imagem((:'draft'::jsonb->>'id')::uuid,'logo','image/png',100) as reserva \gset
select set_config('test.imagem_original', :'reserva'::jsonb->>'id', true);
do $$ begin
  assert loja_ia_obter_imagem_propria(current_setting('test.imagem_draft')::uuid,current_setting('test.imagem_original')::uuid) is not null, 'dono não encontra arquivo';
  begin perform * from loja_ia_imagens; raise exception 'tabela exposta'; exception when insufficient_privilege then null; end;
  begin perform loja_ia_reservar_imagem(current_setting('test.imagem_draft')::uuid,'logo','image/png',20971521); raise exception 'aceitou arquivo excessivo'; exception when invalid_parameter_value then null; end;
end $$;
set local request.jwt.claim.sub='user_ia883b';
do $$ begin
  assert loja_ia_obter_imagem_propria(current_setting('test.imagem_draft')::uuid,current_setting('test.imagem_original')::uuid) is null, 'outro dono leu';
  begin perform loja_ia_reservar_imagem(current_setting('test.imagem_draft')::uuid,'logo','image/png',100); raise exception 'outro dono enviou'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select gen_random_uuid() as nova \gset
select set_config('test.imagem_nova', :'nova', true);
select loja_ia_reservar_normalizada(current_setting('test.imagem_original')::uuid, :'nova'::uuid, current_setting('test.imagem_draft') || '/pronta/' || :'nova' || '.webp', 90);
select loja_ia_finalizar_imagem(current_setting('test.imagem_original')::uuid, :'nova'::uuid, current_setting('test.imagem_draft') || '/pronta/' || :'nova' || '.webp', repeat('a',64), 90);
do $$ begin
  assert loja_ia_imagem_publica(current_setting('test.imagem_nova')::uuid) is null, 'imagem vazou antes da publicação';
  assert (select estado='descarte' from loja_ia_imagens where id=current_setting('test.imagem_original')::uuid), 'original não descartado';
end $$;
insert into vitrines_lojas(dono_id,microrregiao_id,slug,nome,cidade,tipo,status,plano)
select id,microrregiao_id,'imagem-ia883','Teste imagem','Corrente','loja','ativa','teste' from perfis where id='user_ia883a';
update loja_ia_rascunhos set estado='publicado', vitrine_id=(select id from vitrines_lojas where dono_id='user_ia883a') where id=current_setting('test.imagem_draft')::uuid;
insert into loja_ia_imagens_vinculos(imagem_id,vitrine_id,uso)
select current_setting('test.imagem_nova')::uuid, id, 'capa' from vitrines_lojas where dono_id='user_ia883a';
update vitrines_lojas set banner_tipo='foto',banner_url='/api/loja/imagem/'||current_setting('test.imagem_nova'),banner_aki_posicao=50 where dono_id='user_ia883a';
update loja_ia_imagens set criado_em=now()-interval '2 days' where id=current_setting('test.imagem_nova')::uuid;
do $$ begin
  assert loja_ia_imagem_publica(current_setting('test.imagem_nova')::uuid) is not null, 'banner visível negado';
  assert vitrine_publica('imagem-ia883')->>'banner_url'='/api/loja/imagem/'||current_setting('test.imagem_nova'), 'banner público diverge da RPC';
  assert loja_ia_marcar_descarte(current_setting('test.imagem_nova')::uuid) is null, 'banner vigente descartado';
end $$;
update vitrines_lojas set banner_tipo='modelo' where dono_id='user_ia883a';
do $$ begin assert loja_ia_imagem_publica(current_setting('test.imagem_nova')::uuid) is null, 'banner oculto exposto'; assert vitrine_publica('imagem-ia883')->>'banner_url' is null, 'banner oculto na RPC'; end $$;
update vitrines_lojas set banner_tipo='foto',status='suspensa',arquivada_em=now() where dono_id='user_ia883a';
do $$ begin assert loja_ia_imagem_publica(current_setting('test.imagem_nova')::uuid) is null, 'vitrine arquivada exposta'; end $$;
update vitrines_lojas set arquivada_em=null,excluida_em=now() where dono_id='user_ia883a';
do $$ begin assert loja_ia_imagem_publica(current_setting('test.imagem_nova')::uuid) is null, 'vitrine excluída exposta'; end $$;
rollback;
