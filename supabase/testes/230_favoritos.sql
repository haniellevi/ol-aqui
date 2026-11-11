\set ON_ERROR_STOP on
\set QUIET on
begin;
create function pg_temp.confere(ok boolean, caso text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FALHOU: %',caso; end if; end $$;
create function pg_temp.recusa(comando text,codigo text) returns void language plpgsql as $$
begin
 begin execute comando; exception when others then
   if sqlstate=codigo then return; end if;
   raise exception 'Estado inesperado: %, esperado %: %',sqlstate,codigo,sqlerrm;
 end;
 raise exception 'Comando aceito indevidamente: %',comando;
end $$;
select id as loja from vitrines_lojas where dono_id='user_loja' \gset
select id as cat from categorias where slug='sofas-e-poltronas' \gset
insert into anuncios(id,vitrine_id,categoria_id,titulo,cidade,preco_centavos,status) values
 ('85000000-0000-4000-a000-000000000001',:'loja',:'cat','Mesa favorita teste','Corrente',85000,'ativo'),
 ('85000000-0000-4000-a000-000000000002',:'loja',:'cat','Cadeira favorita teste','Corrente',12000,'ativo'),
 ('85000000-0000-4000-a000-000000000003',:'loja',:'cat','Rascunho privado teste','Corrente',85000,'rascunho'),
 ('85000000-0000-4000-a000-000000000004',:'loja',:'cat','Armário favorito teste','Corrente',85000,'ativo');
set local role anon;set local request.jwt.claim.role='anon';set local request.jwt.claim.sub='';
select pg_temp.confere((select count(*)=0 from favoritos),'Visitante não lê favoritos');
select pg_temp.recusa($q$insert into favoritos(usuario_id,anuncio_id) values('user_comprador','85000000-0000-4000-a000-000000000001')$q$,'42501');
set local role authenticated;set local request.jwt.claim.role='authenticated';set local request.jwt.claim.sub='user_comprador';
insert into favoritos(usuario_id,anuncio_id) values('user_comprador','85000000-0000-4000-a000-000000000001'),('user_comprador','85000000-0000-4000-a000-000000000002');
select pg_temp.confere((select count(*)=2 from favoritos),'Lista própria mostra os itens salvos');
select pg_temp.recusa($q$insert into favoritos(usuario_id,anuncio_id) values('user_comprador','85000000-0000-4000-a000-000000000001')$q$,'23505');
select pg_temp.confere((select total_favoritos=1 from anuncios where id='85000000-0000-4000-a000-000000000001'),'Repetição não duplica contagem');
select pg_temp.recusa($q$insert into favoritos(usuario_id,anuncio_id) values('user_distante','85000000-0000-4000-a000-000000000001')$q$,'42501');
select pg_temp.recusa($q$insert into favoritos(usuario_id,anuncio_id) values('user_comprador','85000000-0000-4000-a000-000000000003')$q$,'42501');
set local request.jwt.claim.sub='user_distante';
select pg_temp.confere((select count(*)=0 from favoritos),'Outra conta não vê a lista do comprador');
with removidos as(delete from favoritos where usuario_id='user_comprador' returning anuncio_id)
select pg_temp.confere((select count(*)=0 from removidos),'Outra conta não remove favoritos');
insert into favoritos(usuario_id,anuncio_id) values('user_distante','85000000-0000-4000-a000-000000000001');
select pg_temp.confere((select total_favoritos=2 from anuncios where id='85000000-0000-4000-a000-000000000001'),'Contagem soma contas distintas');
reset role;
update anuncios set status='pausado' where id='85000000-0000-4000-a000-000000000001';
update anuncios set status='vendido' where id='85000000-0000-4000-a000-000000000002';
set local role authenticated;set local request.jwt.claim.sub='user_comprador';
select pg_temp.confere((select a.id is null from favoritos f left join anuncios a on a.id=f.anuncio_id where f.anuncio_id='85000000-0000-4000-a000-000000000001'),'Favorito pausado permanece sem revelar detalhes privados');
select pg_temp.confere((select a.status='vendido' from favoritos f left join anuncios a on a.id=f.anuncio_id where f.anuncio_id='85000000-0000-4000-a000-000000000002'),'Favorito vendido preserva abertura do detalhe');
select pg_temp.confere((select whatsapp is null from anuncio_publico('85000000-0000-4000-a000-000000000002')),'Vendido abre sem oferecer contato');
delete from favoritos where usuario_id='user_comprador' and anuncio_id='85000000-0000-4000-a000-000000000001';
delete from favoritos where usuario_id='user_comprador' and anuncio_id='85000000-0000-4000-a000-000000000001';
select pg_temp.confere((select count(*)=1 from favoritos),'Remoção repetida funciona inclusive fora do ar');
reset role;
select pg_temp.confere((select total_favoritos=1 from anuncios where id='85000000-0000-4000-a000-000000000001'),'Remoção não apaga o favorito da outra conta nem duplica decremento');
update vitrines_lojas set status='suspensa' where id=:'loja';
set local role authenticated;set local request.jwt.claim.sub='user_comprador';
select pg_temp.recusa($q$insert into favoritos(usuario_id,anuncio_id) values('user_comprador','85000000-0000-4000-a000-000000000004')$q$,'42501');
set local request.jwt.claim.sub='user_loja';
select pg_temp.recusa($q$insert into favoritos(usuario_id,anuncio_id) values('user_loja','85000000-0000-4000-a000-000000000004')$q$,'42501');
rollback;
