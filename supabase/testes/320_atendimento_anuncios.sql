\set ON_ERROR_STOP on
begin;
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

insert into perfis(id,microrregiao_id,nome,e_admin,whatsapp,whatsapp_verificado_em)
select 'user_adminchat',id,'Admin de teste',true,'5589999990071',now() from microrregioes where slug='corrente-pi';
update configuracoes set valor='true' where chave='robo.ativo' and microrregiao_id is null;
update configuracoes set valor='100000' where chave='robo.orcamento_mensal_centavos' and microrregiao_id is null;
update configuracoes set valor='20' where chave='robo.limite_diario_pessoa' and microrregiao_id is null;
select gen_random_uuid() as anuncio, gen_random_uuid() as chave_equipe \gset
insert into anuncios(id,vitrine_id,categoria_id,titulo,cidade,preco_centavos,atributos,fotos,status)
select :'anuncio',v.id,c.id,'Casa de teste para atendimento','Corrente',35000000,'{"finalidade":"Venda"}',
  array['https://abc.supabase.co/storage/v1/object/public/anuncios/user_loja/'||:'anuncio'||'/1.webp'],'rascunho'
from vitrines_lojas v cross join categorias c where v.dono_id='user_loja' and c.slug='casas';
update anuncios set status='ativo' where id=:'anuncio' returning atualizado_em as revisao \gset
select pg_temp.confere(not has_table_privilege('anon','atendimento_mensagens','select'), 'visitante não lê mensagens');
select pg_temp.confere(not has_function_privilege('authenticated','reservar_atendimento_aki(bigint,text)','execute'), 'usuário não chama o worker');

set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='user_comprador';
select pg_temp.recusa(format('select abrir_atendimento_anuncio(%L)', :'anuncio'),'42501');
select pg_temp.recusa(format('select admin_whatsapp_anunciante(%L)', :'anuncio'),'42501');
select pg_temp.recusa(format('select admin_gerenciar_anuncio(%L,%L,%L,%L,%L)', :'anuncio','revisar','ativo',:'revisao','Motivo de teste'),'42501');

set local request.jwt.claim.sub='user_adminchat';
select pg_temp.confere(admin_whatsapp_anunciante(:'anuncio')='5589999990002','somente administrador lê contato confirmado');
select pg_temp.recusa(format('select admin_gerenciar_anuncio(%L,%L,%L,%L,%L)', :'anuncio','revisar','ativo','2000-01-01','Motivo de teste'),'P0001');
select pg_temp.confere(admin_gerenciar_anuncio(:'anuncio','revisar','ativo',:'revisao','Conferir dados do anúncio')='em_analise','retira anúncio para revisão humana');
select pg_temp.confere((select motivo_analise='Revisão da equipe: Conferir dados do anúncio' from anuncios where id=:'anuncio'),'motivo fica visível');
set local request.jwt.claim.sub='user_loja';
update anuncios set revisao_manual_admin=false, motivo_analise='Preço fora do normal para a categoria' where id=:'anuncio';
select pg_temp.confere((select revisao_manual_admin and motivo_analise like 'Revisão da equipe:%' from anuncios where id=:'anuncio'),'anunciante não pode trocar revisão humana por automática');
select pg_temp.recusa(format('update anuncios set status=%L where id=%L','ativo',:'anuncio'),'P0001');
set local request.jwt.claim.sub='user_adminchat';
select pg_temp.confere(admin_gerenciar_anuncio(:'anuncio','aprovar','em_analise', (select atualizado_em from anuncios where id=:'anuncio'), null)='ativo','administrador aprova pela moderação');
select pg_temp.confere((select not revisao_manual_admin from anuncios where id=:'anuncio'),'aprovação libera o anúncio');
select admin_gerenciar_anuncio(:'anuncio','revisar','ativo', (select atualizado_em from anuncios where id=:'anuncio'), 'Conferir dados de novo');
select pg_temp.confere(admin_gerenciar_anuncio(:'anuncio','recusar','em_analise', (select atualizado_em from anuncios where id=:'anuncio'), 'Dados ainda incompletos')='pausado','recusa deixa fora do ar');
set local request.jwt.claim.sub='user_loja';
select pg_temp.confere(publicar_anuncio(:'anuncio')='em_analise','reenviar após recusa volta para revisão humana');
set local request.jwt.claim.sub='user_adminchat';
select abrir_atendimento_anuncio(:'anuncio') as conversa \gset
select pg_temp.confere(abrir_atendimento_anuncio(:'anuncio')=:'conversa','abrir conversa duas vezes não duplica');
select enviar_mensagem_atendimento(:'conversa',:'chave_equipe','Olá, podemos conferir seu anúncio?') as msg_equipe \gset
select pg_temp.confere(enviar_mensagem_atendimento(:'conversa',:'chave_equipe','Olá, podemos conferir seu anúncio?')=:'msg_equipe','reenvio devolve o mesmo ID');
select pg_temp.recusa(format('select enviar_mensagem_atendimento(%L,%L,%L)', :'conversa',:'chave_equipe','Texto trocado'),'22023');
select delegar_atendimento_aki(:'conversa',true,0);

set local request.jwt.claim.sub='user_comprador';
select pg_temp.confere((select count(*)=0 from atendimentos_anuncio where id=:'conversa'),'outra conta não lê a conversa');
select pg_temp.confere((select count(id)=0 from atendimento_mensagens where conversa_id=:'conversa'),'outra conta não lê mensagens');
select pg_temp.recusa(format('select enviar_mensagem_atendimento(%L,gen_random_uuid(),%L)', :'conversa','Mensagem alheia'),'42501');
select pg_temp.recusa(format('select delegar_atendimento_aki(%L,true,1)', :'conversa'),'42501');
select pg_temp.recusa(format('insert into atendimento_mensagens(conversa_id,autor,texto) values (%L,%L,%L)', :'conversa','aki','Mensagem forjada'),'42501');

set local request.jwt.claim.sub='user_loja';
select pg_temp.confere((select count(id)=1 from atendimento_mensagens where conversa_id=:'conversa'),'anunciante vê a mensagem da equipe');
select pg_temp.confere((select count(*)=1 from notificacoes where chave='atendimento:'||:'msg_equipe'),'notificação privada só uma vez');
select pg_temp.recusa(format('select enviar_mensagem_atendimento(%L,gen_random_uuid(),%L)', :'conversa',E'\n\t'),'22023');
select enviar_mensagem_atendimento(:'conversa',gen_random_uuid(),'Preciso falar com a equipe',false) as msg_humano \gset
select enviar_mensagem_atendimento(:'conversa',gen_random_uuid(),'Como edito meu anúncio?',true) as pergunta \gset

set local role service_role;
set local request.jwt.claim.role='service_role';
select pg_temp.confere(reservar_atendimento_aki(:'msg_humano','user_loja') is null,'mensagem direta à equipe nunca vai ao Aki');
select pg_temp.confere(reservar_atendimento_aki(:'pergunta','user_comprador') is null,'worker confere o dono da mensagem');
select reservar_atendimento_aki(:'pergunta','user_loja') as reserva \gset
select (:'reserva'::jsonb->>'uso_id') as uso \gset
select pg_temp.confere(reservar_atendimento_aki(:'pergunta','user_loja') is null,'reserva única para o mesmo envio');
select pg_temp.confere(not concluir_atendimento_aki(:'pergunta',:'uso','Orientação aprovada.'),'reserva em aberto não publica');
select * from robo_registrar_resposta('user_loja',null,'teste',:'reserva'::jsonb->>'provedor',:'reserva'::jsonb->>'modelo',100,5,0,0,p_uso_id=>:'uso');
select pg_temp.confere(concluir_atendimento_aki(:'pergunta',:'uso','Orientação aprovada.'),'Aki responde mensagem autorizada');
select pg_temp.confere(not concluir_atendimento_aki(:'pergunta',:'uso','Repetição.'),'Aki não responde duas vezes');

set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='user_loja';
select pg_temp.confere((select aguarda_equipe from atendimentos_anuncio where id=:'conversa'),'resposta automática não encerra pergunta humana anterior');
select pg_temp.confere((select count(id)=1 from atendimento_mensagens where conversa_id=:'conversa' and autor='aki'),'anunciante vê autoria do Aki');
select enviar_mensagem_atendimento(:'conversa',gen_random_uuid(),'Qual é meu código 123456?',true) as sensivel \gset
set local role service_role;
set local request.jwt.claim.role='service_role';
select pg_temp.confere(reservar_atendimento_aki(:'sensivel','user_loja') is null,'código vai só para a equipe');

set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='user_loja';
select enviar_mensagem_atendimento(:'conversa',gen_random_uuid(),'Como posso publicar?',true) as pendente \gset
set local role service_role;
set local request.jwt.claim.role='service_role';
select reservar_atendimento_aki(:'pendente','user_loja') as reserva_pendente \gset
select (:'reserva_pendente'::jsonb->>'uso_id') as uso_pendente \gset
select * from robo_registrar_resposta('user_loja',null,'teste',:'reserva_pendente'::jsonb->>'provedor',:'reserva_pendente'::jsonb->>'modelo',100,5,0,0,p_uso_id=>:'uso_pendente');

set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='user_adminchat';
select delegar_atendimento_aki(:'conversa',false,1);
select pg_temp.recusa(format('select delegar_atendimento_aki(%L,true,1)', :'conversa'),'P0001');
select delegar_atendimento_aki(:'conversa',true,2);
set local role service_role;
set local request.jwt.claim.role='service_role';
select pg_temp.confere(not concluir_atendimento_aki(:'pendente',:'uso_pendente','Resposta atrasada.'),'retomada invalida resposta pendente mesmo ao delegar de novo');

reset role;
select pg_temp.confere((select count(*)=0 from robo_mensagens where conteudo::text like '%Orientação aprovada%'),'chat privado não aparece no balão público do Aki');
insert into contas_revogadas(usuario_id) values ('user_loja');
set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='user_adminchat';
select pg_temp.confere(admin_whatsapp_anunciante(:'anuncio') is null,'conta revogada não expõe WhatsApp');
select pg_temp.recusa(format('select enviar_mensagem_atendimento(%L,gen_random_uuid(),%L)', :'conversa','Mensagem para conta revogada'),'P0001');
reset role;
delete from anuncios where id=:'anuncio';
select pg_temp.confere(not exists(select 1 from atendimento_mensagens where conversa_id=:'conversa'),'exclusão do anúncio elimina o atendimento vinculado');
rollback;
