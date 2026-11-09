\set ON_ERROR_STOP on
\set QUIET on
-- Fluxo de publicação com dados fictícios, somente no PostgreSQL descartável.
begin;
select id as loja from vitrines_lojas where dono_id='user_loja' \gset
select id as cat from categorias where slug='moveis' \gset
set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='user_loja';
insert into anuncios(id,vitrine_id,status) values ('60000000-0000-4000-a000-000000000001',:'loja','rascunho');
do $$ begin
  begin perform publicar_anuncio('60000000-0000-4000-a000-000000000001');
    raise exception 'Rascunho incompleto foi publicado';
  exception when check_violation then null; end;
end $$;
update anuncios set fotos=array['https://abc.supabase.co/storage/v1/object/public/anuncios/user_loja/60000000-0000-4000-a000-000000000001/1.webp']
 where id='60000000-0000-4000-a000-000000000001' and fotos='{}';
-- Uma lista antiga não pode apagar a foto que acabou de ser salva.
do $$ declare n int; begin
  update anuncios set fotos='{}' where id='60000000-0000-4000-a000-000000000001' and fotos='{}';
  get diagnostics n=row_count;
  assert n=0, 'Comparação atômica deve impedir perda de fotos';
end $$;
update anuncios set categoria_id=:'cat',titulo='Mesa de madeira teste local',descricao='Produto fictício usado somente no banco de testes.',
 atributos='{"estado":"novo"}',preco_centavos=150050,aceita_troca=true,cidade='Corrente',bairro='Centro'
 where id='60000000-0000-4000-a000-000000000001';
set local request.jwt.claim.sub='user_comprador';
do $$ declare n int; begin
  update anuncios set preco_centavos=1 where id='60000000-0000-4000-a000-000000000001';
  get diagnostics n=row_count;
  assert n=0, 'Outro usuário não pode editar';
  assert not exists(select 1 from anuncio_publico('60000000-0000-4000-a000-000000000001')), 'Rascunho é privado';
  begin perform publicar_anuncio('60000000-0000-4000-a000-000000000001');
    raise exception 'Outro usuário conseguiu publicar';
  exception when insufficient_privilege then null; end;
end $$;
set local request.jwt.claim.sub='user_loja';
do $$ begin
 assert publicar_anuncio('60000000-0000-4000-a000-000000000001')='ativo', 'Publica anúncio completo';
 assert publicar_anuncio('60000000-0000-4000-a000-000000000001')='ativo', 'Publicar novamente é idempotente';
 assert (select preco_centavos=150050 and bairro='Centro' and cardinality(fotos)=1 from anuncios where id='60000000-0000-4000-a000-000000000001'), 'Preço, foto e localização preservados';
 begin update anuncios set fotos='{}' where id='60000000-0000-4000-a000-000000000001';
   raise exception 'Foto obrigatória foi removida de anúncio publicado';
 exception when check_violation then null; end;
end $$;
set local role anon;
set local request.jwt.claim.role='anon';
set local request.jwt.claim.sub='';
do $$ begin
 assert (select preco_centavos=150050 and cidade='Corrente' and whatsapp='5589999990002' from anuncio_publico('60000000-0000-4000-a000-000000000001')), 'Publicado tem preço, local e contato autorizados';
end $$;
rollback;
