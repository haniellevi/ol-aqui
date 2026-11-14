\set ON_ERROR_STOP on
begin;
create function pg_temp.revisao_da(p uuid) returns boolean language sql security definer set search_path = public as $$ select revisao_manual_admin from anuncios where id = p $$;
create function pg_temp.confere(ok boolean, caso text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FALHOU: %', caso; end if; end $$;
create function pg_temp.recusa(comando text, codigo text) returns void language plpgsql as $$
begin
  begin execute comando;
  exception when others then
    if sqlstate = codigo then return; end if;
    raise exception 'Estado inesperado: %, esperado %: %', sqlstate, codigo, sqlerrm;
  end;
  raise exception 'Comando aceito indevidamente: %', comando;
end $$;

select id as reg from microrregioes where slug='corrente-pi' \gset
select id as loja from vitrines_lojas where dono_id='user_loja' \gset
select id as cat from categorias where slug='sofas-e-poltronas' \gset
insert into perfis(id,microrregiao_id,nome,e_admin,whatsapp,whatsapp_verificado_em)
values ('user_mod390',:'reg','Moderação de teste',true,'5589999990390',now());
update configuracoes set valor='["sexo","sexual","violência","matar","arma de fogo","a+b"]'
where chave='moderacao.termos_sensiveis_anuncios' and microrregiao_id is null;
update configuracoes set valor='["legado390"]' where chave='moderacao.palavras_bloqueadas' and microrregiao_id is null;
select pg_temp.confere(termo_sensivel_anuncio('Oferta de SEXO.',:'reg')='sexo','caixa e pontuação');
select pg_temp.confere(termo_sensivel_anuncio('Cena de VIOLENCIA!',:'reg')='violência','acentos');
select pg_temp.confere(termo_sensivel_anuncio(E'Arma  de\nfogo',:'reg')='arma de fogo','espaços entre termos');
select pg_temp.confere(termo_sensivel_anuncio('Armário, parafuso sextavado e pistola de pintura',:'reg') is null,'palavras parecidas não retêm');
select pg_temp.confere(termo_sensivel_anuncio('Oferta aaab',:'reg') is null,'termos nunca executam expressão regular');
select pg_temp.confere(termo_sensivel_anuncio('Oferta a+b',:'reg')='a+b','termo configurado é literal');

insert into anuncios(id,vitrine_id,categoria_id,titulo,descricao,cidade,preco_centavos,atributos,fotos,status)
select ('89000000-0000-4000-a000-00000000000'||n)::uuid,:'loja',:'cat',
 case when n=1 then 'Armário sextavado legado390' when n=2 then 'Oferta de sexo local' else 'Mesa para teste local '||n end,
 case when n=3 then 'Descrição com violência explícita.' else 'Produto fictício para teste local.' end,
 'Corrente',100000,'{"estado":"Novo"}',
 array['https://abc.supabase.co/storage/v1/object/public/anuncios/user_loja/89000000-0000-4000-a000-00000000000'||n||'/1.webp'],
 'rascunho'::status_anuncio from generate_series(1,8) n;
update anuncios set categoria_id=(select id from categorias where slug='celulares'), atributos='{"marca":"sexual"}'
where id='89000000-0000-4000-a000-000000000007';
update anuncios set categoria_id=(select id from categorias where slug='bovinos'), atributos='{"quantidade":1,"sexo":"Machos"}'
where id='89000000-0000-4000-a000-000000000008';

set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='user_loja';
select pg_temp.confere(publicar_anuncio('89000000-0000-4000-a000-000000000001')='ativo','anúncio comum vai ao ar imediatamente, sem lista antiga');
select pg_temp.confere(publicar_anuncio('89000000-0000-4000-a000-000000000001')='ativo','publicação comum é idempotente');
select pg_temp.confere(publicar_anuncio('89000000-0000-4000-a000-000000000002')='em_analise','termo sexual no título retém');
select pg_temp.confere(publicar_anuncio('89000000-0000-4000-a000-000000000003')='em_analise','violência na descrição retém');
select pg_temp.confere(publicar_anuncio('89000000-0000-4000-a000-000000000007')='em_analise','valor de atributo também passa pelo filtro');
select pg_temp.confere(publicar_anuncio('89000000-0000-4000-a000-000000000008')='ativo','chave sexo do cadastro de animais não retém');
select pg_temp.recusa($q$update anuncios set preco_centavos=-1 where id='89000000-0000-4000-a000-000000000001'$q$,'23514');
select pg_temp.confere(publicar_anuncio('89000000-0000-4000-a000-000000000004')='ativo','publicação antes da edição');
update anuncios set descricao='Material com conteúdo sexual.' where id='89000000-0000-4000-a000-000000000004';
select pg_temp.confere((select status='em_analise' from anuncios where id='89000000-0000-4000-a000-000000000004'),'edição de anúncio ativo reavalia conteúdo');
select pg_temp.confere(publicar_anuncio('89000000-0000-4000-a000-000000000005')='ativo','publicação antes da venda');
select marcar_vendido('89000000-0000-4000-a000-000000000005',true);
update anuncios set descricao='Descrição com violência.' where id='89000000-0000-4000-a000-000000000005';
select pg_temp.confere((select status='em_analise' from anuncios where id='89000000-0000-4000-a000-000000000005'),'edição do anúncio vendido também retém');
select pg_temp.confere(publicar_anuncio('89000000-0000-4000-a000-000000000006')='ativo','publicação antes de pausar');
update anuncios set status='pausado',titulo='Oferta de arma de fogo' where id='89000000-0000-4000-a000-000000000006';
select pg_temp.confere(publicar_anuncio('89000000-0000-4000-a000-000000000006')='em_analise','reativação passa pelo filtro');

-- A gravação direta pela API deve ter o mesmo resultado do formulário.
insert into anuncios(id,vitrine_id,categoria_id,titulo,cidade,preco_centavos,atributos,fotos,status)
values ('89000000-0000-4000-a000-000000000009',:'loja',:'cat','Oferta sexual direta','Corrente',10000,'{"estado":"Novo"}',
 array['https://abc.supabase.co/storage/v1/object/public/anuncios/user_loja/89000000-0000-4000-a000-000000000009/1.webp'],'ativo');
select pg_temp.confere((select status='em_analise' from anuncios where id='89000000-0000-4000-a000-000000000009'),'insert direto não contorna moderação');
update anuncios set revisao_manual_admin=false,motivo_analise='Preço fora do normal para a categoria'
where id='89000000-0000-4000-a000-000000000002';
select pg_temp.confere((select motivo_analise like 'Termo sexual ou violento:%' from anuncios where id='89000000-0000-4000-a000-000000000002'),'titular não troca motivo por fila automática');
select pg_temp.recusa($q$update anuncios set status='ativo' where id='89000000-0000-4000-a000-000000000002'$q$,'P0001');
update anuncios set titulo='Texto corrigido pelo titular' where id='89000000-0000-4000-a000-000000000002';
select pg_temp.confere(publicar_anuncio('89000000-0000-4000-a000-000000000002')='em_analise','edição não elimina decisão humana pendente');

set local role anon;
set local request.jwt.claim.role='anon';
set local request.jwt.claim.sub='';
select pg_temp.confere(not exists(select 1 from anuncio_publico('89000000-0000-4000-a000-000000000003')),'pendência não aparece publicamente');
reset role;
select pg_temp.confere((select bool_and(revisao_manual_admin) from anuncios where id::text like '89000000-%' and status='em_analise'),'todos os retidos novos exigem equipe');
update configuracoes set valor='true' where chave='moderacao.ia_ativa';
select moderacao_ia_reservar();
select pg_temp.confere(not exists(select 1 from moderacao_ia where anuncio_id::text like '89000000-%'),'IA não reserva os novos termos');
-- Mesmo uma resposta de IA forjada/tardia não substitui a decisão humana.
do $$ declare jid uuid; token uuid:=gen_random_uuid(); begin
 insert into moderacao_ia(anuncio_id,revisao,estado,reserva,iniciado_em)
 select id,moderacao_ia_revisao(anuncios),'processando',token,now() from anuncios where id='89000000-0000-4000-a000-000000000003'
 returning id into jid;
 perform pg_temp.confere(moderacao_ia_concluir(jid,token,'{"decisao":"aprovar","confianca":1,"motivo":"Conteúdo aprovado pela resposta simulada para teste.","riscos":[],"imagens_avaliadas":1}',0.001)='manual','resposta de IA não libera caso humano');
 perform pg_temp.confere((select status='em_analise' from anuncios where id='89000000-0000-4000-a000-000000000003'),'anúncio continua retido após IA');
end $$;

set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='user_mod390';
select moderar_anuncio('89000000-0000-4000-a000-000000000003','aprovar');
select pg_temp.confere((select status='ativo' and motivo_analise is null from anuncios where id='89000000-0000-4000-a000-000000000003') and not pg_temp.revisao_da('89000000-0000-4000-a000-000000000003'),'equipe consegue aprovar após conferência');
set local request.jwt.claim.sub='user_loja';
update anuncios set preco_centavos=1 where id='89000000-0000-4000-a000-000000000003';
select pg_temp.confere((select status='ativo' from anuncios where id='89000000-0000-4000-a000-000000000003'),'editar só preço preserva aprovação humana');
select marcar_vendido('89000000-0000-4000-a000-000000000003',true);
select pg_temp.confere((select status='vendido' from anuncios where id='89000000-0000-4000-a000-000000000003'),'marcar vendido preserva aprovação do mesmo conteúdo');
set local request.jwt.claim.sub='user_comprador';
select pg_temp.confere(criar_pedido_radar('Procuro legado390 local','Corrente') is not null,'pedido Radar criado');
select pg_temp.confere(exists(select 1 from radar_pedidos where comprador_id='user_comprador' and titulo='Procuro legado390 local' and status='em_analise'),'Radar preserva sua lista independente');
rollback;
