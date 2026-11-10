\set ON_ERROR_STOP on
\set QUIET on
begin;
create function pg_temp.confere(ok boolean, caso text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FALHOU: %', caso; end if; end $$;

-- Revogação é privada e sobrevive sem perfil. Não confundir conta nova com revogada.
savepoint revogacao;
insert into contas_revogadas(usuario_id) values ('user_loja');
insert into perfis(id,microrregiao_id,nome,e_admin)
 select 'user_admin300',microrregiao_id,'Admin preservado',true from perfis where id='user_comprador';
set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='user_loja';
select pg_temp.confere(public.usuario_id() is null,'JWT anterior da conta revogada vira visitante');
select pg_temp.confere(not exists(select 1 from meu_perfil()),'Perfil retido não fica acessível pelo token antigo');
select pg_temp.confere(not public.pode_enviar_foto('user_loja/loja/foto.webp'),'JWT revogado não passa na autorização de upload');
do $$ begin
  begin perform usuario_id from contas_revogadas; raise exception 'Cliente leu marcador privado';
  exception when insufficient_privilege then null; end;
  begin insert into contas_revogadas(usuario_id) values ('user_comprador'); raise exception 'Cliente revogou terceiro';
  exception when insufficient_privilege then null; end;
  begin delete from contas_revogadas where usuario_id='user_loja'; raise exception 'Cliente removeu revogação';
  exception when insufficient_privilege then null; end;
  begin insert into anuncios(vitrine_id,microrregiao_id,categoria,titulo,cidade,status)
    select id,microrregiao_id,'geral','Rascunho indevido','Corrente','rascunho' from vitrines_lojas where dono_id='user_loja';
    raise exception 'JWT revogado criou rascunho'; exception when insufficient_privilege then null; end;
  begin insert into perfis(id,microrregiao_id,nome) select 'user_loja',id,'Tentativa' from microrregioes limit 1;
    raise exception 'JWT revogado recriou perfil'; exception when insufficient_privilege then null; end;
end $$;
set local request.jwt.claim.sub='user_comprador';
select pg_temp.confere(public.usuario_id()='user_comprador','Outra conta mantém identidade');
set local request.jwt.claim.sub='user_admin300';
select pg_temp.confere(public.e_admin(),'Admin diferente mantém acesso');
set local request.jwt.claim.sub='user_novo300';
select pg_temp.confere(public.usuario_id()='user_novo300','Cadastro novo sem perfil continua permitido');
insert into perfis(id,microrregiao_id,nome) select 'user_novo300',id,'Novo cadastro' from microrregioes where slug='corrente-pi';
select pg_temp.confere(exists(select 1 from meu_perfil()),'Conta nova conclui criação do perfil');
set local role anon;
set local request.jwt.claim.role='anon';
set local request.jwt.claim.sub='';
select pg_temp.confere(public.usuario_id() is null,'Visitante continua sem identidade');
do $$ begin
  begin perform usuario_id from contas_revogadas; raise exception 'Visitante leu marcador privado';
  exception when insufficient_privilege then null; end;
  begin insert into contas_revogadas(usuario_id) values ('user_comprador'); raise exception 'Visitante gravou marcador';
  exception when insufficient_privilege then null; end;
end $$;
rollback to savepoint revogacao;

-- Consultas da exportação: as colunas precisam estar concedidas ao cliente da pessoa.
set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='user_loja';
select id, tipo, slug, nome, descricao, logo_url, capa_url, cidade, bairro,
       plano, status, teste_expira_em, plano_expira_em, selo_loja_verificada, criado_em,
       banner_tipo, banner_url, banner_modelo, banner_cor, endereco, lat, lng, horarios,
       sobre, formas_pagamento, faz_entrega, entrega_obs
  from vitrines_lojas where dono_id=public.usuario_id() order by id limit 500;
select whatsapp, instagram from meus_contatos_vitrine();
select id, tipo, status, analisado_em, motivo_recusa, criado_em
  from perfis_verificacoes where perfil_id=public.usuario_id() order by id limit 500;
select id, titulo, criado_em, atualizado_em from robo_conversas where usuario_id=public.usuario_id() order by id limit 500;
select id, conversa_id, papel, conteudo, tipo, criado_em from robo_mensagens where usuario_id=public.usuario_id() order by id limit 500;
select id, tipo, versao, aceito_em from aceites where usuario_id=public.usuario_id() order by id limit 500;
select id, tipo, titulo, texto, link, canal, dados, lida_em, enviada_em, criado_em
  from notificacoes where usuario_id=public.usuario_id() order by id limit 500;
select tipo, canal, ligado, atualizado_em from preferencias_avisos where usuario_id=public.usuario_id() order by tipo,canal limit 500;
select id, mensagem_id, nota, comentario, criado_em, atualizado_em from robo_avaliacoes where usuario_id=public.usuario_id() order by id limit 500;
set local request.jwt.claim.sub='user_comprador';
select rp.id, rp.pedido_id, rp.vitrine_id, rp.anuncio_id, rp.mensagem, rp.preco_centavos, rp.foto_url,
       rp.escolhida, rp.escolhida_em, rp.status, rp.moderado_motivo, rp.criado_em, rp.atualizado_em
  from radar_propostas rp join radar_pedidos p on p.id=rp.pedido_id
 where p.comprador_id=public.usuario_id() and rp.status='ativa' order by rp.id limit 500;
select pg_temp.confere(not exists(select 1 from robo_conversas where usuario_id<>'user_comprador'), 'RLS das conversas isola a conta');
select pg_temp.confere(not exists(select 1 from robo_mensagens where usuario_id<>'user_comprador'), 'RLS das mensagens isola a conta');
reset role;

-- Consultas que fazem o webhook parar antes do Storage, mesmo sem cobrança.
savepoint retencao;
update anuncios set status='congelado' where vitrine_id in (select id from vitrines_lojas where dono_id='user_cota');
insert into radar_pedidos(id,comprador_id,microrregiao_id,titulo,cidade,status)
 select '93000000-0000-4000-a000-000000000001','user_cota',microrregiao_id,'Pedido sob retenção','Corrente','congelado' from perfis where id='user_cota';
insert into radar_propostas(pedido_id,vitrine_id,mensagem)
 select '93000000-0000-4000-a000-000000000001',id,'Proposta preservada' from vitrines_lojas where dono_id='user_loja';
set local request.jwt.claim.role='service_role';
set local request.jwt.claim.sub='';
set local role service_role;
select pg_temp.confere(exists(select 1 from anuncios a join vitrines_lojas v on v.id=a.vitrine_id
  where v.dono_id='user_cota' and a.status='congelado' limit 1),'Bloqueio encontra anúncio próprio congelado');
select pg_temp.confere(exists(select 1 from radar_pedidos where comprador_id='user_cota' and status='congelado' limit 1),
  'Bloqueio encontra pedido próprio congelado');
select pg_temp.confere(exists(select 1 from radar_propostas rp join vitrines_lojas v on v.id=rp.vitrine_id
  join radar_pedidos p on p.id=rp.pedido_id where v.dono_id='user_loja' and p.status='congelado' limit 1),
  'Bloqueio encontra proposta própria ligada a pedido congelado de outro comprador');
select pg_temp.confere(not exists(select 1 from radar_propostas rp join vitrines_lojas v on v.id=rp.vitrine_id
  join radar_pedidos p on p.id=rp.pedido_id where v.dono_id='user_semcodigo' and p.status='congelado' limit 1),
  'Congelamento de outra conta não bloqueia conta sem vínculo');
do $$ begin
  begin delete from perfis where id='user_cota'; raise exception 'Cascata removeu conta congelada';
  exception when object_not_in_prerequisite_state then null; end;
  begin delete from radar_pedidos where id='93000000-0000-4000-a000-000000000001'; raise exception 'Pedido congelado excluído';
  exception when object_not_in_prerequisite_state then null; end;
  begin delete from radar_propostas where pedido_id='93000000-0000-4000-a000-000000000001'; raise exception 'Proposta congelada excluída';
  exception when object_not_in_prerequisite_state then null; end;
end $$;
select pg_temp.confere(exists(select 1 from perfis where id='user_cota'),'Cascata abortada preserva conta e suas relações');
set local request.jwt.claim.sub='user_cota';
select public.mover_anuncio_lixeira(id) from anuncios where vitrine_id in (select id from vitrines_lojas where dono_id='user_cota');
set local request.jwt.claim.sub='';
do $$ begin
  begin delete from perfis where id='user_cota'; raise exception 'Cascata removeu congelado na lixeira';
  exception when object_not_in_prerequisite_state then null; end;
end $$;
rollback to savepoint retencao;

-- Uma cobrança impede a cascata de perfil/vitrine, mas não deve manter conteúdo comum.
insert into pagamentos(vitrine_id,microrregiao_id,tipo,plano_codigo,valor_centavos,status)
 select id,microrregiao_id,'assinatura','full',10000,'pago' from vitrines_lojas where dono_id='user_loja';
insert into robo_conversas(usuario_id,titulo) values ('user_loja','Conversa privada');
insert into robo_mensagens(conversa_id,usuario_id,papel,conteudo)
 select id,'user_loja','usuario','{"texto":"Informação pessoal"}' from robo_conversas where usuario_id='user_loja';
insert into radar_pedidos(comprador_id,microrregiao_id,titulo,cidade)
 select 'user_loja',microrregiao_id,'Procuro equipamento pessoal','Corrente' from perfis where id='user_loja';
set local request.jwt.claim.role='service_role';
set local request.jwt.claim.sub='';
set local role service_role;
do $$ declare nome_fk text; begin
  begin
    delete from perfis where id='user_loja';
    raise exception 'Perfil com cobrança foi excluído';
  exception when foreign_key_violation then
    get stacked diagnostics nome_fk=constraint_name;
    assert nome_fk='pagamentos_vitrine_id_fkey', 'FK financeira mudou: revisar webhook';
  end;
end $$;
-- O webhook grava a revogação antes da anonimização financeira.
insert into contas_revogadas(usuario_id) values ('user_loja') on conflict do nothing;
-- Operações que poderiam falhar por FK, gatilho ou validação de campo.
delete from anuncios where vitrine_id in (select id from vitrines_lojas where dono_id='user_loja');
delete from radar_propostas where vitrine_id in (select id from vitrines_lojas where dono_id='user_loja');
delete from radar_pedidos where comprador_id='user_loja';
delete from robo_conversas where usuario_id='user_loja';
update vitrines_lojas set status='suspensa',nome='Loja encerrada',slug='encerrada-'||id,
 cidade='Conta excluída',bairro=null,criado_ip=null,selo_loja_verificada=false,
 descricao=null,whatsapp=null,cnpj=null,logo_url=null,capa_url=null,sobre=null,endereco=null,
 lat=null,lng=null,instagram=null,entrega_obs=null,horarios=null,formas_pagamento='{}',faz_entrega=null,
 banner_tipo='modelo',banner_url=null,banner_moderado_url=null,banner_moderado_motivo=null,banner_moderado_em=null
 where dono_id='user_loja';
delete from equipe where usuario_id='user_loja';
update perfis set nome='Conta excluída',whatsapp=null,whatsapp_verificado_em=null,whatsapp_origem='clerk',
 avatar_url=null,cidade=null,bairro=null,criado_ip=null,selo_negociador_certificado=false,e_admin=false where id='user_loja';
select pg_temp.confere(not exists(select 1 from radar_pedidos where comprador_id='user_loja'),'Pedidos pessoais removidos');
select pg_temp.confere(not exists(select 1 from robo_mensagens where usuario_id='user_loja'),'Mensagens removidas em cascata');
select pg_temp.confere(exists(select 1 from pagamentos p join vitrines_lojas v on v.id=p.vitrine_id where v.dono_id='user_loja'),'Cobrança e vínculo preservados');
select pg_temp.confere((select nome='Conta excluída' and whatsapp is null from perfis where id='user_loja'),'Perfil retido sem nome ou telefone');
reset role;
rollback;
