\set ON_ERROR_STOP on
begin;
update anuncios set status='pausado' where status='em_analise';
update configuracoes set valor='true' where chave='moderacao.ia_ativa';
update configuracoes set valor='10000' where chave='robo.orcamento_mensal_centavos';
create function pg_temp.anuncio_ia() returns uuid language plpgsql as $$
declare aid uuid:=gen_random_uuid(); vid uuid; cid uuid;
begin
 select id into vid from vitrines_lojas where dono_id='user_loja';
 select id into cid from categorias where slug='casas';
 insert into anuncios(id,vitrine_id,categoria_id,titulo,cidade,preco_centavos,atributos,fotos,status)
 values(aid,vid,cid,'Casa para avaliação local','Corrente',100000,'{"finalidade":"Venda"}',
 array['https://abc.supabase.co/storage/v1/object/public/anuncios/user_loja/'||aid||'/1.webp'],'rascunho');
 update anuncios set status='em_analise',motivo_analise='Preço fora do normal para a categoria' where id=aid;
 return aid;
end $$;
do $$
declare a uuid; j jsonb; r jsonb:='{"decisao":"aprovar","confianca":0.99,"motivo":"Preço explicado e conteúdo coerente, sem sinais de infração.","riscos":[],"imagens_avaliadas":1}'; n integer; gasto numeric;
begin
 assert not has_function_privilege('authenticated','moderacao_ia_reservar()','execute');
 assert not has_function_privilege('anon','moderacao_ia_concluir(uuid,uuid,jsonb,numeric,integer,integer)','execute');
 a:=pg_temp.anuncio_ia(); j:=moderacao_ia_reservar();
 assert j->>'anuncio_id'=a::text;
 assert moderacao_ia_reservar() is null, 'Não reserva anúncio em processamento outra vez';
 assert moderacao_ia_concluir((j->>'id')::uuid,gen_random_uuid(),r,0.001)='ignorado', 'Token errado não decide';
 assert moderacao_ia_concluir((j->>'id')::uuid,(j->>'reserva')::uuid,r,0.001)='aprovado';
 assert (select status='ativo' and motivo_analise is null from anuncios where id=a);
 assert (select count(*)=1 from notificacoes where chave='moderacao-ia:'||(j->>'id'));
 assert moderacao_ia_concluir((j->>'id')::uuid,(j->>'reserva')::uuid,r,0.001)='ignorado', 'Repetição não republica ou notifica';
 select custo_centavos into gasto from robo_uso where id=(select uso_id from moderacao_ia where id=(j->>'id')::uuid);
 assert gasto=0.001*5.5*100, 'Custo real substitui reserva';

 a:=pg_temp.anuncio_ia(); j:=moderacao_ia_reservar();
 assert moderacao_ia_concluir((j->>'id')::uuid,(j->>'reserva')::uuid,r||'{"confianca":0.7}',0.001)='manual';
 assert (select status='em_analise' from anuncios where id=a);
 a:=pg_temp.anuncio_ia(); j:=moderacao_ia_reservar();
 update anuncios set descricao='Conteúdo alterado depois da reserva' where id=a;
 assert moderacao_ia_concluir((j->>'id')::uuid,(j->>'reserva')::uuid,r,0.001)='obsoleto';
 assert (select status='em_analise' from anuncios where id=a);
 update anuncios set status='pausado' where id=a;

 a:=pg_temp.anuncio_ia(); j:=moderacao_ia_reservar();
 update anuncios set status='congelado',congelado_motivo='Restrição administrativa' where id=a;
 assert moderacao_ia_concluir((j->>'id')::uuid,(j->>'reserva')::uuid,r,0.001)='obsoleto';
 assert (select status='congelado' from anuncios where id=a);

 a:=pg_temp.anuncio_ia(); j:=moderacao_ia_reservar();
 insert into denuncias(denunciante_id,alvo_tipo,alvo_id,motivo) values('user_comprador','anuncio',a,'golpe');
 assert moderacao_ia_concluir((j->>'id')::uuid,(j->>'reserva')::uuid,r,0.001) in ('manual','obsoleto');
 assert (select status='em_analise' from anuncios where id=a);
 assert exists(select 1 from denuncias where alvo_id=a and status='aberta'), 'IA não fecha denúncia';

 a:=pg_temp.anuncio_ia(); j:=moderacao_ia_reservar();
 assert moderacao_ia_concluir((j->>'id')::uuid,(j->>'reserva')::uuid,r,null)='manual', 'Custo ausente não aprova';
 assert (select custo_centavos=275 from robo_uso where id=(select uso_id from moderacao_ia where id=(j->>'id')::uuid)), 'Falha conserva reserva';

 a:=pg_temp.anuncio_ia(); j:=moderacao_ia_reservar();
 update perfis set whatsapp_verificado_em=null where id='user_loja';
 assert moderacao_ia_concluir((j->>'id')::uuid,(j->>'reserva')::uuid,r,0.001)='manual', 'Confirmação revogada não publica';
 update perfis set whatsapp_verificado_em=now() where id='user_loja';

 a:=pg_temp.anuncio_ia(); j:=moderacao_ia_reservar();
 update moderacao_ia set iniciado_em=now()-interval '4 minutes' where id=(j->>'id')::uuid;
 perform moderacao_ia_reservar();
 assert (select estado='manual' from moderacao_ia where id=(j->>'id')::uuid), 'Worker interrompido vai para exceção';
 assert moderacao_ia_concluir((j->>'id')::uuid,(j->>'reserva')::uuid,r,0.001)='ignorado', 'Resposta atrasada não publica';

 a:=pg_temp.anuncio_ia(); j:=moderacao_ia_reservar();
 update vitrines_lojas set plano='teste',teste_expira_em=now()+interval '1 day' where dono_id='user_loja';
 assert moderacao_ia_concluir((j->>'id')::uuid,(j->>'reserva')::uuid,r,0.001)='manual', 'A aprovação não contorna a cota ocupada';
 assert (select status='em_analise' from anuncios where id=a);
 update vitrines_lojas set plano='full' where dono_id='user_loja';

 a:=pg_temp.anuncio_ia();
 update configuracoes set valor='0' where chave='robo.orcamento_mensal_centavos';
 select count(*) into n from robo_uso where tipo='moderacao';
 perform moderacao_ia_reservar();
 assert (select count(*)=n from robo_uso where tipo='moderacao'), 'Sem orçamento não faz reserva nem chamada';
 assert (select estado='manual' from moderacao_ia where anuncio_id=a);
end $$;
set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='user_loja';
do $$ begin
 assert (select count(*)=0 from moderacao_ia), 'Anunciante não lê fila privada';
end $$;
reset role;
rollback;
