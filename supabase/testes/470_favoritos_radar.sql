\set ON_ERROR_STOP on
\set QUIET on
-- Vitrine com IA, etapa 3: lembrete de favoritos no sino. Fixtures descartáveis.
begin;
reset role;
set local request.jwt.claim.role='';
set local request.jwt.claim.sub='';
select id as reg from microrregioes where slug='corrente-pi' \gset
select id as cat from categorias where slug='sofas-e-poltronas' \gset
insert into perfis(id,microrregiao_id,nome,cidade,whatsapp,whatsapp_verificado_em) values
 ('user_loja470',:'reg','Loja 470','Corrente','5589999990470',now()),
 ('user_comprador470',:'reg','Comprador 470','Corrente','5589999990471',now()),
 ('user_desligou470',:'reg','Desligou 470','Corrente','5589999990472',now()),
 ('user_pediu470',:'reg','Pediu 470','Corrente','5589999990473',now());
insert into vitrines_lojas(id,dono_id,microrregiao_id,slug,nome,cidade,whatsapp,tipo,plano,plano_expira_em) values
 ('47000000-0000-4000-a000-000000000001','user_loja470',:'reg','loja-470','Loja 470','Corrente','5589999990470','loja','full',now()+interval '30 days');
insert into anuncios(id,vitrine_id,categoria_id,titulo,cidade,preco_centavos,status,publicado_em) values
 ('47100000-0000-4000-a000-000000000001','47000000-0000-4000-a000-000000000001',:'cat','Sofá antigo 470','Corrente',50000,'ativo',now()),
 ('47100000-0000-4000-a000-000000000002','47000000-0000-4000-a000-000000000001',:'cat','Mesa pausada 470','Corrente',30000,'pausado',now()),
 ('47100000-0000-4000-a000-000000000003','47000000-0000-4000-a000-000000000001',:'cat','Cadeira nova 470','Corrente',9000,'ativo',now());
insert into favoritos(usuario_id,anuncio_id,criado_em) values
 ('user_comprador470','47100000-0000-4000-a000-000000000001',now()-interval '8 days'),
 ('user_comprador470','47100000-0000-4000-a000-000000000002',now()),
 ('user_comprador470','47100000-0000-4000-a000-000000000003',now()),
 ('user_loja470','47100000-0000-4000-a000-000000000002',now()),
 ('user_desligou470','47100000-0000-4000-a000-000000000002',now()),
 ('user_pediu470','47100000-0000-4000-a000-000000000002',now());
insert into preferencias_avisos(usuario_id,tipo,canal,ligado) values ('user_desligou470','favorito_radar','app',false);
insert into radar_pedidos(comprador_id,microrregiao_id,titulo,cidade)
 values ('user_pediu470',:'reg','Procuro mesa de jantar','Corrente');

do $$ begin
  assert (select valor ? 'favorito_radar' from configuracoes where chave='radar.avisos_escolha' and microrregiao_id is null), 'Aviso na lista de escolha';
  -- [1] Vitrine nova desligada: nada acontece.
  assert favoritos_lembrar_radar() = 0, 'Desligada não envia';
  assert (select count(*)=0 from favoritos where radar_lembrado_em is not null), 'Desligada não marca';
end $$;
update configuracoes set valor='true' where chave='vitrine_ia.ativa' and microrregiao_id is null;
do $$ begin
  -- [2] Primeiro dia: um aviso por pessoa, o favorito fora do ar primeiro e sem o título.
  assert favoritos_lembrar_radar() = 1, 'Só o comprador recebe (desligou e quem pediu no Radar não)';
  assert (select titulo='Um favorito seu saiu do ar' and link='/minha-conta/favoritos'
                 and dados->>'anuncio_id'='47100000-0000-4000-a000-000000000002' and position('Mesa' in texto)=0
            from notificacoes where usuario_id='user_comprador470' and tipo='favorito_radar'), 'Fora do ar primeiro, sem título';
  assert (select radar_lembrado_em is not null from favoritos where usuario_id='user_desligou470'), 'Quem desligou fica marcado';
  assert not exists(select 1 from notificacoes where usuario_id in ('user_desligou470','user_loja470','user_pediu470') and tipo='favorito_radar'), 'Sem aviso para quem desligou, para o dono e para quem pediu';
  assert (select radar_lembrado_em is null from favoritos where usuario_id='user_loja470'), 'Favorito do próprio dono ignorado';
  assert (select radar_lembrado_em is null from favoritos where usuario_id='user_pediu470'), 'Quem pediu no Radar volta a ser avaliado depois';
  -- Rodar de novo no mesmo dia não manda outro.
  assert favoritos_lembrar_radar() = 0, 'Um por dia, mesmo rodando de novo';
  -- [3] Segundo dia: o salvo há 8 dias; o salvo hoje espera.
  update favoritos set radar_lembrado_em = radar_lembrado_em - interval '1 day' where radar_lembrado_em is not null;
  assert favoritos_lembrar_radar() = 1, 'Segundo lembrete';
  update favoritos set radar_lembrado_em = radar_lembrado_em - interval '1 day' where radar_lembrado_em is not null;
  assert exists(select 1 from notificacoes where usuario_id='user_comprador470' and titulo='Ainda procura Sofá antigo 470?'), 'Parado com título';
  assert favoritos_lembrar_radar() = 0, 'Favorito de hoje ainda não';
  assert (select count(*)=2 from notificacoes where usuario_id='user_comprador470' and tipo='favorito_radar'), 'Cada favorito lembra uma vez';
end $$;

-- [3b] Região com a vitrine nova desligada não recebe, mesmo com a chave geral ligada.
insert into favoritos(usuario_id,anuncio_id,criado_em) values ('user_pediu470','47100000-0000-4000-a000-000000000001',now()-interval '10 days');
delete from radar_pedidos where comprador_id='user_pediu470';
insert into configuracoes(chave,valor,grupo,publico,descricao,microrregiao_id)
 select 'vitrine_ia.ativa','false','vitrine',true,'teste região',microrregiao_id from perfis where id='user_pediu470';
do $$ begin
  assert favoritos_lembrar_radar() = 0, 'Região desligada não recebe';
  update configuracoes set valor='true' where chave='vitrine_ia.ativa' and microrregiao_id=(select microrregiao_id from perfis where id='user_pediu470');
  update configuracoes set valor='false' where chave='vitrine_ia.ativa' and microrregiao_id is null;
  assert favoritos_lembrar_radar() = 1, 'Região ligada recebe com a geral desligada';
end $$;

-- [4] Pessoa logada não chama a rotina.
set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='user_comprador470';
do $$ begin
  begin
    perform favoritos_lembrar_radar();
    raise exception 'Navegador não pode disparar os lembretes';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
