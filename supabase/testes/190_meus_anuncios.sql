\set ON_ERROR_STOP on
\set QUIET on
begin;
select id as loja from vitrines_lojas where dono_id='user_loja' \gset
select id as cat from categorias where slug='moveis' \gset
insert into anuncios(id,vitrine_id,status,categoria_id,titulo,descricao,atributos,preco_centavos,cidade,fotos)
values ('70000000-0000-4000-a000-000000000001',:'loja','rascunho',:'cat','Mesa de teste da lixeira','Item fictício apenas para os testes.', '{"estado":"novo"}',10000,'Corrente',array['https://abc.supabase.co/storage/v1/object/public/anuncios/user_loja/70000000-0000-4000-a000-000000000001/1.webp']);
set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='user_loja';
do $$ declare a anuncios; anterior timestamptz; begin
 assert publicar_anuncio('70000000-0000-4000-a000-000000000001')='ativo';
 assert mover_anuncio_lixeira('70000000-0000-4000-a000-000000000001')='excluido';
 select * into a from anuncios where id='70000000-0000-4000-a000-000000000001';
 assert a.status_antes_exclusao='ativo' and a.excluido_em is not null and cardinality(a.fotos)=1;
 anterior:=a.excluido_em;
 assert mover_anuncio_lixeira(a.id)='excluido';
 assert (select excluido_em=anterior from anuncios where id=a.id), 'Repetição não altera histórico';
 begin perform publicar_anuncio(a.id); raise exception 'Publicou da lixeira'; exception when insufficient_privilege then null; end;
 begin update anuncios set status='ativo' where id=a.id; raise exception 'Publicou diretamente da lixeira'; exception when insufficient_privilege then null; end;
 begin update anuncios set titulo='Tentativa de editar na lixeira' where id=a.id; raise exception 'Editou da lixeira'; exception when insufficient_privilege then null; end;
 begin delete from anuncios where id=a.id; raise exception 'Apagou definitivamente'; exception when insufficient_privilege then null; end;
end $$;
set local request.jwt.claim.sub='user_comprador';
do $$ begin
 assert not exists(select 1 from anuncios where id='70000000-0000-4000-a000-000000000001'), 'RLS da lixeira';
 assert not exists(select 1 from anuncio_publico('70000000-0000-4000-a000-000000000001')), 'Link privado';
 begin perform restaurar_anuncio('70000000-0000-4000-a000-000000000001'); raise exception 'Outro dono restaurou'; exception when insufficient_privilege then null; end;
 begin perform mover_anuncio_lixeira('70000000-0000-4000-a000-000000000001'); raise exception 'Outro dono excluiu'; exception when insufficient_privilege then null; end;
end $$;
set local role anon;
set local request.jwt.claim.role='anon';
set local request.jwt.claim.sub='';
do $$ begin
 assert not exists(select 1 from anuncio_publico('70000000-0000-4000-a000-000000000001'));
 assert not exists(select 1 from buscar_anuncios(q=>'Mesa de teste da lixeira'));
 begin perform restaurar_anuncio('70000000-0000-4000-a000-000000000001'); raise exception 'Anônimo restaurou'; exception when insufficient_privilege then null; end;
end $$;
set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='user_loja';
do $$ declare a anuncios; begin
 assert restaurar_anuncio('70000000-0000-4000-a000-000000000001')='pausado', 'Restaurar não publica';
 assert restaurar_anuncio('70000000-0000-4000-a000-000000000001')='pausado', 'Restaurar idempotente';
 assert publicar_anuncio('70000000-0000-4000-a000-000000000001')='ativo';
 assert marcar_vendido('70000000-0000-4000-a000-000000000001',true)='vendido';
 select * into a from anuncios where id='70000000-0000-4000-a000-000000000001';
 perform mover_anuncio_lixeira(a.id);
 assert (select vendido_em=a.vendido_em and vendido_pelo_olaki=true from anuncios where id=a.id), 'Lixeira preserva venda';
 assert restaurar_anuncio(a.id)='vendido';
 assert (select vendido_em=a.vendido_em and vendido_pelo_olaki=true and excluido_em is null and cardinality(fotos)=1 from anuncios where id=a.id), 'Restaurar preserva venda e fotos';
end $$;
reset role;
-- Todos os estados anteriores, incluindo moderação, são preservados sem reativação automática.
do $$ declare s status_anuncio; destino text; begin
 foreach s in array array['rascunho','pausado','expirado','em_analise','congelado']::status_anuncio[] loop
  update anuncios set status=s where id='70000000-0000-4000-a000-000000000001';
  perform mover_anuncio_lixeira('70000000-0000-4000-a000-000000000001');
  destino:=restaurar_anuncio('70000000-0000-4000-a000-000000000001');
  assert destino=case when s='expirado' then 'pausado' else s::text end, 'Estado anterior foi perdido';
 end loop;
end $$;
-- Restaurar um rascunho também respeita a cota, sem apagar o item da lixeira.
reset role;
update anuncios set status='rascunho' where id='70000000-0000-4000-a000-000000000001';
select mover_anuncio_lixeira('70000000-0000-4000-a000-000000000001');
update configuracoes set valor='0' where chave='anuncio.rascunhos_max' and microrregiao_id is null;
set local role authenticated;
do $$ begin
 begin perform restaurar_anuncio('70000000-0000-4000-a000-000000000001'); raise exception 'Ignorou cota de rascunhos';
 exception when raise_exception then
  if sqlerrm not like '%limite de rascunhos%' then raise; end if;
 end;
 assert (select status='excluido' and cardinality(fotos)=1 from anuncios where id='70000000-0000-4000-a000-000000000001');
end $$;
rollback;
