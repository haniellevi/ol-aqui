\set ON_ERROR_STOP on
begin;
update configuracoes set valor = 'true' where chave = 'radar.whatsapp_ativo' and microrregiao_id is null;
insert into perfis(id, microrregiao_id, nome, cidade, whatsapp, whatsapp_verificado_em)
select 'user_899',id,'Conta fictícia','Corrente','5589998990001',now()
from microrregioes where slug='corrente-pi';
do $$ begin
  perform whatsapp_sair('5589998990001','SAIR');
  assert not exists(select from preferencias_avisos where usuario_id='user_899'), 'SAIR sem histórico cria preferência falsa';
  assert whatsapp_mensagem_recebida('5589998990001','voltar',repeat('a',64)) = 'orientacao';
  assert not exists(select from preferencias_avisos where usuario_id='user_899');
end $$;
set local role authenticated;
set local request.jwt.claim.sub='user_899';
select salvar_preferencia_whatsapp_radar_tipo('proposta_nova',true);
reset role;
do $$ begin
  assert (select count(*) = 1 and bool_and(tipo='proposta_nova' and ligado and consentido_em is not null)
            from preferencias_avisos where usuario_id='user_899');
  assert not has_table_privilege('service_role','radar_piloto_controle','SELECT');
  assert not has_table_privilege('authenticated','radar_piloto_participantes','INSERT');
  assert not has_function_privilege('anon','salvar_preferencia_whatsapp_radar_tipo(text,boolean)','EXECUTE');
end $$;
rollback;

begin;
select id as reg899 from microrregioes where slug='corrente-pi' \gset
select id as cat899 from categorias where slug='sofas-e-poltronas' \gset
update configuracoes set valor = 'true' where chave='radar.whatsapp_ativo' and microrregiao_id is null;
update configuracoes set valor = '100' where chave in ('radar.pedidos_por_dia','radar.pedidos_abertos_max','radar.avisos_lojas_por_comprador_dia') and microrregiao_id is null;
insert into perfis(id,microrregiao_id,nome,cidade,whatsapp,whatsapp_verificado_em) values
  ('user_899buyer',:'reg899','Comprador fictício','Corrente','5589998990010',now()),
  ('user_899shop',:'reg899','Loja fictícia','Corrente','5589998990011',now()),
  ('user_899out',:'reg899','Loja fora','Corrente','5589998990012',now());
insert into vitrines_lojas(id,dono_id,microrregiao_id,slug,nome,cidade,whatsapp,tipo,plano,plano_expira_em) values
  ('89900000-0000-4000-b000-000000000001','user_899shop',:'reg899','loja-899-um','Vitrine 899 do Radar','Corrente','5589998990011','loja','full',now()+interval '30 days'),
  ('89900000-0000-4000-b000-000000000002','user_899out',:'reg899','loja-899-fora','Vitrine 899 fora do Radar','Corrente','5589998990012','loja','full',now()+interval '30 days');
update vitrines_lojas set verificacao_estado='aprovada',selo_loja_verificada=true where dono_id in ('user_899shop','user_899out');
insert into anuncios(id,vitrine_id,categoria_id,titulo,cidade,preco_centavos,atributos,status) values
  ('89900000-0000-4000-c000-000000000001','89900000-0000-4000-b000-000000000001',:'cat899','Sofá fictício','Corrente',120000,'{"estado":"usado"}','ativo'),
  ('89900000-0000-4000-c000-000000000002','89900000-0000-4000-b000-000000000002',:'cat899','Sofá fictício de fora','Corrente',120000,'{"estado":"usado"}','ativo');
set local role authenticated;
set local request.jwt.claim.sub='user_899out';
select salvar_preferencia_whatsapp_radar_tipo('pedido_novo',true);
reset role;
update radar_piloto_controle set modo='fechado',rodada_id='89900000-0000-4000-d000-000000000001',
  microrregiao_id=:'reg899',inicio_em=statement_timestamp(),piso_fila_em=statement_timestamp(),fim_em=clock_timestamp()+interval '30 days';
insert into radar_piloto_participantes(rodada_id,usuario_id,microrregiao_id,inicio_em,fim_em)
select c.rodada_id,p.id,p.microrregiao_id,c.inicio_em,c.fim_em
from radar_piloto_controle c cross join perfis p where p.id in ('user_899buyer','user_899shop');
set local role authenticated;
set local request.jwt.claim.sub='user_899out';
do $$ begin
  assert not (minha_preferencia_whatsapp_radar()->>'pode_ligar')::boolean;
  begin perform salvar_preferencia_whatsapp_radar_tipo('pedido_novo',true); assert false;
  exception when sqlstate '55000' then null;
  end;
end $$;
set local request.jwt.claim.sub='user_899buyer';
select salvar_preferencia_whatsapp_radar_tipo('proposta_nova',true);
set local request.jwt.claim.sub='user_899shop';
select salvar_preferencia_whatsapp_radar_tipo('pedido_novo',true), salvar_preferencia_whatsapp_radar_tipo('proposta_escolhida',true);
\if :{?concorrencia899}
commit;
\quit
\endif
set local request.jwt.claim.sub='user_899buyer';
select criar_pedido_radar_site('89900000-0000-4000-a000-000000000001','Procuro sofá teste 899','Corrente','propostas_prazo',72,null,:'cat899'::uuid)->>'id' as ped899 \gset
set local request.jwt.claim.sub='user_899shop';
select proposta_id as prop899 from propor_radar(:'ped899'::uuid,'89900000-0000-4000-c000-000000000001',null,120000,'Sofá disponível') \gset
set local request.jwt.claim.sub='user_899buyer';
select whatsapp from escolher_proposta(:'prop899'::uuid);
select whatsapp from escolher_proposta(:'prop899'::uuid);
reset role;

do $$ begin
  assert not exists(select from whatsapp_fila where usuario_id='user_899out'), 'loja com preferência ativa fora da coorte não recebe';
  assert (select count(*)=3 and count(distinct split_part(chave,':',1))=3 from whatsapp_fila
          where usuario_id in ('user_899buyer','user_899shop')), 'três gatilhos, sem duplicar proposta escolhida';
  assert exists(select from notificacoes where usuario_id='user_899out' and tipo='pedido_novo'), 'sino de fora preservado';
end $$;

update whatsapp_fila set estado='enviando' where usuario_id in ('user_899buyer','user_899shop');
do $$ declare item uuid; begin
  for item in select id from whatsapp_fila where usuario_id in ('user_899buyer','user_899shop')
  loop assert whatsapp_fila_confirmar_envio(item)='pode', 'item válido chegou à conferência'; end loop;
end $$;
update radar_piloto_participantes set revogado_em=clock_timestamp() where usuario_id='user_899shop';
do $$ declare item uuid; begin
  for item in select id from whatsapp_fila where usuario_id='user_899shop'
  loop assert whatsapp_fila_confirmar_envio(item)='cancelada', 'retirada após colher bloqueia envio'; end loop;
end $$;
update radar_piloto_participantes set fim_em=clock_timestamp() where usuario_id='user_899buyer';
do $$ begin
  assert (select whatsapp_fila_confirmar_envio(id)='cancelada' from whatsapp_fila where usuario_id='user_899buyer'),
    'expiração após colher bloqueia envio';
end $$;
update radar_piloto_participantes set fim_em=clock_timestamp()+interval '1 day' where usuario_id='user_899buyer';

do $$ begin
  assert whatsapp_sair('5589998990010','SAIR');
  assert whatsapp_mensagem_recebida('5589998990010','outra',repeat('b',64))='pergunta';
end $$;
update whatsapp_fila set estado='enviando' where usuario_id='user_899buyer' and split_part(chave,':',3)='pergunta';
update radar_piloto_controle set modo='pausado';
do $$ begin
  assert (select whatsapp_fila_confirmar_envio(id)='cancelada'
    from whatsapp_fila where usuario_id='user_899buyer' and split_part(chave,':',3)='pergunta'), 'pergunta colhida cancelada na pausa';
  assert (select estado='pendente' from whatsapp_fila where usuario_id='user_899buyer' and chave like 'whatsapp_saida:%');
end $$;
update radar_piloto_controle set modo='fechado',piso_fila_em=clock_timestamp();
do $$ begin
  assert whatsapp_mensagem_recebida('5589998990010','sim',repeat('c',64))='nada';
  assert not (select ligado from preferencias_avisos where usuario_id='user_899buyer' and tipo='proposta_nova' and canal='whatsapp');
  assert whatsapp_mensagem_recebida('5589998990010','voltar',repeat('d',64))='voltou';
end $$;
rollback;
