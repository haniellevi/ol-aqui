\set ON_ERROR_STOP on
begin;
insert into perfis(id,microrregiao_id,nome,cidade) select 'user_ia885',id,'Modelo','Corrente' from microrregioes where slug='corrente-pi';
set local role authenticated;
set local request.jwt.claim.sub='user_ia885';
select loja_ia_abrir_coleta() as draft \gset
select set_config('test.modelo_draft', :'draft'::jsonb->>'id', true);
reset role;
update loja_ia_rascunhos set estado='pronto' where id=current_setting('test.modelo_draft')::uuid;
set local role authenticated;
select loja_ia_reservar_modelo_capa(current_setting('test.modelo_draft')::uuid) as reserva \gset
select set_config('test.modelo_id', :'reserva'::jsonb->>'id', true);
do $$ begin assert loja_ia_reservar_modelo_capa(current_setting('test.modelo_draft')::uuid)->>'estado'='preparando', 'reserva paralela aceita'; end $$;
reset role;
select loja_ia_concluir_modelo_capa(current_setting('test.modelo_id')::uuid, repeat('a',64), 100);
set local role authenticated;
do $$ begin assert loja_ia_reservar_modelo_capa(current_setting('test.modelo_draft')::uuid)->>'id'=current_setting('test.modelo_id'), 'geração repetida'; end $$;
reset role;
update loja_ia_imagens set criado_em=now()-interval '2 days' where id=current_setting('test.modelo_id')::uuid;
update loja_ia_rascunhos set campos=jsonb_set(campos,'{capa,valor}',to_jsonb(current_setting('test.modelo_id'))) where id=current_setting('test.modelo_draft')::uuid;
do $$ begin
  assert loja_ia_marcar_descarte(current_setting('test.modelo_id')::uuid) is null, 'capa selecionada descartada';
  assert not ((loja_ia_lote_limpeza()->'imagens') ? current_setting('test.modelo_id')), 'capa selecionada entrou em lote';
end $$;
update loja_ia_rascunhos set campos=jsonb_set(jsonb_set(campos,'{capa,valor}','null'::jsonb),'{capa,sugestao}',jsonb_build_object('valor',current_setting('test.modelo_id'))) where id=current_setting('test.modelo_draft')::uuid;
do $$ begin assert loja_ia_marcar_descarte(current_setting('test.modelo_id')::uuid) is null, 'sugestão descartada'; end $$;
update loja_ia_rascunhos set campos=jsonb_set(campos,'{capa,sugestao}','null'::jsonb) where id=current_setting('test.modelo_draft')::uuid;
do $$ begin assert loja_ia_marcar_descarte(current_setting('test.modelo_id')::uuid) is not null, 'capa removida não descartada'; end $$;
set local role authenticated;
do $$ begin assert loja_ia_reservar_modelo_capa(current_setting('test.modelo_draft')::uuid)->>'estado'='esgotada', 'segunda geração após descarte'; end $$;
reset role;
rollback;
