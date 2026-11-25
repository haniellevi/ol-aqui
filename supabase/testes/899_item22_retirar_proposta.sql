\set ON_ERROR_STOP on
begin;
select id as reg from microrregioes where slug='corrente-pi' \gset
select id as cat from categorias where slug='sofas-e-poltronas' \gset
insert into perfis(id,microrregiao_id,nome,cidade,whatsapp,whatsapp_verificado_em)
select 'user_d22'||n, :'reg', 'Sintético D22 '||n,'Corrente','558999220000'||n,now() from generate_series(1,4) n;
insert into vitrines_lojas(id,dono_id,microrregiao_id,slug,nome,cidade,whatsapp,tipo,plano,plano_expira_em)
values ('22200000-0000-4000-b000-000000000001','user_d221',:'reg','loja-d22','Loja sintética','Corrente','5589992200001','loja','full',now()+interval '30 days');
update vitrines_lojas set verificacao_estado='aprovada', selo_loja_verificada=true where dono_id='user_d221';
set local request.jwt.claim.sub='user_d221';
select aceitar_documentos_legais(array(select id from termos_pendentes()));
set local request.jwt.claim.sub='user_d223';
select aceitar_documentos_legais(array(select id from termos_pendentes()));
set local request.jwt.claim.sub='';
insert into anuncios(id,vitrine_id,categoria_id,titulo,cidade,preco_centavos,atributos,status)
values ('22200000-0000-4000-c000-000000000001','22200000-0000-4000-b000-000000000001',:'cat','Sofá sintético D22','Corrente',50000,'{"estado":"usado"}','ativo');
set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='user_d222';
select criar_pedido_radar_site('22200000-0000-4000-a000-000000000001','Procuro sofá sintético D22','Corrente','propostas_prazo',72,null,:'cat'::uuid)->>'id' as ped \gset
set local request.jwt.claim.sub='user_d221';
select proposta_id as prop from propor_radar(:'ped','22200000-0000-4000-c000-000000000001',null,50000,'Oferta sintética') \gset
reset role;
create function pg_temp.retirar_d22(id uuid, esperado text) returns void language plpgsql as $$
begin
  perform retirar_proposta_radar(id);
  raise exception 'Operação indevidamente permitida';
exception when others then
  if sqlstate <> esperado then raise; end if;
end $$;
select set_config('d22.prop',:'prop',true),set_config('d22.ped',:'ped',true);
do $$ begin
  assert not has_function_privilege('anon','retirar_proposta_radar(uuid)','execute');
  assert has_function_privilege('authenticated','retirar_proposta_radar(uuid)','execute');
  assert not has_table_privilege('authenticated','radar_propostas','update');
end $$;
set local role authenticated;
set local request.jwt.claim.sub='user_d223';
select pg_temp.retirar_d22(:'prop','42501');
do $$ begin assert not exists(select 1 from propostas_retiraveis_loja('22200000-0000-4000-b000-000000000001')); end $$;
set local request.jwt.claim.sub='user_d222';
select pg_temp.retirar_d22(:'prop','42501');
set local request.jwt.claim.sub='';
select pg_temp.retirar_d22(:'prop','28000');
reset role;
-- Gerente sintético aceito e confirmado, depois revogado.
insert into convites_gerente_loja(vitrine_id,token_hash,telefone_hash,final_telefone,aceito_por,aceito_em)
values ('22200000-0000-4000-b000-000000000001',sha256('d22token'),sha256('d22fone'),'0003','user_d223',now());
set local role authenticated;
set local request.jwt.claim.sub='user_d223';
do $$ begin assert (select count(*)=1 from propostas_retiraveis_loja('22200000-0000-4000-b000-000000000001')); end $$;
reset role;
update convites_gerente_loja set revogado_em=now() where aceito_por='user_d223';
set local role authenticated;
set local request.jwt.claim.sub='user_d223';
select pg_temp.retirar_d22(:'prop','42501');
reset role;
update convites_gerente_loja set revogado_em=null where aceito_por='user_d223';
update perfis set whatsapp_verificado_em=null where id='user_d223';
set local role authenticated;
set local request.jwt.claim.sub='user_d223';
select pg_temp.retirar_d22(:'prop','42501');
reset role;
update perfis set whatsapp_verificado_em=now() where id='user_d223';
-- Escolhida, fechada, congelada ou oculta nunca podem ser retiradas.
update radar_propostas set escolhida=true where id=:'prop';
set local role authenticated;
set local request.jwt.claim.sub='user_d221';
select pg_temp.retirar_d22(:'prop','P0002');
reset role;
update radar_propostas set escolhida=false where id=:'prop';
update radar_pedidos set status='encerrado' where id=:'ped';
set local role authenticated;
select pg_temp.retirar_d22(:'prop','P0002');
reset role;
update radar_pedidos set status='congelado' where id=:'ped';
set local role authenticated;
select pg_temp.retirar_d22(:'prop','P0002');
reset role;
update radar_pedidos set status='aberto' where id=:'ped';
update radar_propostas set status='oculta' where id=:'prop';
set local role authenticated;
select pg_temp.retirar_d22(:'prop','P0002');
reset role;
update radar_propostas set status='ativa' where id=:'prop';
-- Mídia compartilhada é mantida; órfã usa fila de limpeza existente, nunca remove Storage na action.
update radar_propostas set foto_url='https://synthetic.invalid/foto1.webp',anuncio_id=null where id=:'prop';
update anuncios set fotos=array['https://synthetic.invalid/foto1.webp'] where id='22200000-0000-4000-c000-000000000001';
update radar_propostas set foto_url='https://synthetic.invalid/foto2.webp' where id=:'prop';
do $$ begin assert not exists(select 1 from limpeza_arquivos where url='https://synthetic.invalid/foto1.webp'); end $$;
update radar_propostas set foto_url='https://synthetic.invalid/foto3.webp' where id=:'prop';
do $$ begin assert exists(select 1 from limpeza_arquivos where url='https://synthetic.invalid/foto2.webp'); end $$;
update radar_pedidos set status='congelado' where id=:'ped';
do $$ begin
  begin
    update radar_propostas set foto_url='https://synthetic.invalid/negada.webp' where id=current_setting('d22.prop')::uuid;
    raise exception 'Alteração de evidência permitida';
  exception when sqlstate '55000' then null; end;
end $$;
update radar_pedidos set status='aberto' where id=:'ped';
-- Retirada por gerente, repetição idempotente e histórico preservado.
insert into whatsapp_fila(usuario_id,numero,texto,link,chave)
values ('user_d222','5589992200002','Aviso sintético','/radar/'||:'ped','radar_proposta_nova:'||:'ped'||':'||:'prop'),
       ('user_d222','5589992200002','Outro aviso sintético','/radar','item22_outro_aviso');
do $$ begin assert exists(select 1 from whatsapp_fila where estado='pendente' and chave like '%'||current_setting('d22.prop')); end $$;
set local role authenticated;
set local request.jwt.claim.sub='user_d223';
select retirar_proposta_radar(:'prop');
select retirar_proposta_radar(:'prop');
reset role;
do $$ begin
  assert (select status='retirada' and foto_url='https://synthetic.invalid/foto3.webp' from radar_propostas where id=current_setting('d22.prop')::uuid);
  assert (select total_propostas=1 from radar_pedidos where id=current_setting('d22.ped')::uuid);
  assert exists(select 1 from logs_atividade where tabela='radar_propostas' and registro_id=current_setting('d22.prop') and dados_depois->>'status'='retirada');
  assert not exists(select 1 from whatsapp_fila where estado='pendente' and chave like '%'||current_setting('d22.prop'));
  assert exists(select 1 from whatsapp_fila where estado='cancelada' and chave like '%'||current_setting('d22.prop'));
  assert exists(select 1 from whatsapp_fila where estado='pendente' and chave='item22_outro_aviso');
  begin
    update radar_propostas set status='ativa' where id=current_setting('d22.prop')::uuid;
    raise exception 'Reativação permitida';
  exception when sqlstate 'P0002' then null; end;
end $$;
set local role authenticated;
set local request.jwt.claim.sub='user_d222';
do $$ begin
  assert not exists(select 1 from propostas_do_pedido(current_setting('d22.ped')::uuid));
end $$;
rollback;
