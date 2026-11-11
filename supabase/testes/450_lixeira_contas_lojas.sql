\set ON_ERROR_STOP on
\set QUIET on
begin;
create or replace function pg_temp.confere(ok boolean, caso text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FALHOU: %',caso; end if; end $$;
create or replace function pg_temp.recusa(comando text, codigo text) returns void language plpgsql as $$
begin execute comando; raise exception 'Aceitou comando proibido: %',comando;
exception when others then if sqlstate<>codigo then raise; end if; end $$;
select id as reg from microrregioes where slug='corrente-pi' \gset
select id as cat from categorias where slug='sofas-e-poltronas' \gset
insert into perfis(id,microrregiao_id,nome,whatsapp,whatsapp_verificado_em,e_admin) values
 ('user_lixAdmin',:'reg','Admin lixeira','5589999920101',now(),true),
 ('user_lixDono',:'reg','Dono lixeira','5589999920102',now(),false),
 ('user_lixGerente',:'reg','Gerente lixeira','5589999920103',now(),false),
 ('user_lixOutro',:'reg','Outro lixeira','5589999920104',now(),false);
set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='user_lixAdmin';
select admin_salvar_loja(null,null,jsonb_build_object('dono_id','user_lixDono','nome','Loja Lixeira',
  'slug','loja-lixeira-teste','microrregiao_id',:'reg','cidade','Corrente','tipo','loja'),'Criar para testar') as loja \gset
reset role;
select set_config('olaki.sistema','1',true);
insert into anuncios(vitrine_id,categoria_id,titulo,cidade,status,atributos,preco_centavos,descricao) values
 (:'loja',:'cat','Casa no ar','Corrente','ativo','{"estado":"novo"}',10000,'Item de teste.'),
 (:'loja',:'cat','Casa pausada','Corrente','pausado','{"estado":"novo"}',10000,'Item de teste.'),
 (:'loja',:'cat','Casa prova','Corrente','rascunho','{"estado":"novo"}',10000,'Item de teste.'),
 (:'loja',:'cat','Casa na lixeira antes','Corrente','rascunho','{"estado":"novo"}',10000,'Item de teste.');
select id as ativo from anuncios where titulo='Casa no ar' \gset
select id as pausado from anuncios where titulo='Casa pausada' \gset
select id as prova from anuncios where titulo='Casa prova' \gset
select id as antes from anuncios where titulo='Casa na lixeira antes' \gset
update anuncios set status='congelado',congelado_motivo='Prova de teste' where id=:'prova';
select set_config('olaki.sistema','',true);
insert into convites_gerente_loja(vitrine_id,token_hash,telefone_hash,final_telefone,aceito_por,aceito_em)
  values(:'loja','\x01'::bytea,'\x02'::bytea,'0103','user_lixGerente',now());

-- Sem permissão
set local role authenticated;
set local request.jwt.claim.sub='user_lixOutro';
select pg_temp.recusa($q$select admin_lixeira()$q$,'42501');
select pg_temp.recusa(format('select admin_lixeira_loja(%L,true,%L)',:'loja','motivo teste'),'42501');
select pg_temp.recusa($q$select limpeza_pendente()$q$,'42501');
select pg_temp.recusa(format('select purgar_loja(%L)',:'loja'),'42501');
select pg_temp.recusa(format('select lixeira_mover_loja(%L,%L,null,null)',:'loja','admin'),'42501');
select pg_temp.recusa($q$select excluir_minha_loja('EXCLUIR')$q$,'22023');
select pg_temp.confere(minha_loja_exclusao() is null,'sem loja nao ve situacao');

-- Dono move um anúncio para a lixeira antes; depois exclui a loja
set local request.jwt.claim.sub='user_lixDono';
select mover_anuncio_lixeira(:'antes');
select pg_temp.recusa($q$select excluir_minha_loja('sim')$q$,'23514');
select pg_temp.confere(minha_loja_exclusao() @> '{"na_lixeira":false,"tem_pagamentos":false}','loja no ar fora da lixeira');
select pg_temp.confere(excluir_minha_loja('excluir') > now()+interval '29 days','loja vai para lixeira por 30 dias');
select pg_temp.confere(minha_loja_exclusao() @> '{"na_lixeira":true,"pode_restaurar":true}' and (minha_loja_exclusao()->>'apagar_apos') is not null,'dono ve prazo e pode restaurar');
reset role;
select pg_temp.confere((select status='suspensa' and excluida_em is not null from vitrines_lojas where id=:'loja'),'loja sai do ar');
select pg_temp.confere(situacao_vitrine(v)='excluida','situacao excluida') from vitrines_lojas v where id=:'loja';
select pg_temp.confere((select status='excluido' and excluido_com_loja and status_antes_exclusao='ativo' from anuncios where id=:'ativo'),'anuncio no ar vai junto');
select pg_temp.confere((select status='excluido' and excluido_com_loja from anuncios where id=:'pausado'),'anuncio pausado vai junto');
select pg_temp.confere((select status='congelado' and not excluido_com_loja from anuncios where id=:'prova'),'congelado fica guardado');
select pg_temp.confere((select not excluido_com_loja from anuncios where id=:'antes'),'anuncio ja excluido nao e marcado');
select pg_temp.confere(exists(select 1 from notificacoes where usuario_id='user_lixGerente' and tipo='loja_saiu_do_ar'),'gerente recebe aviso');
set local role authenticated;
set local request.jwt.claim.sub='user_lixGerente';
select pg_temp.confere(not exists(select 1 from minhas_lojas()),'gerente perde acesso');

-- Dono restaura: volta tudo como estava, menos o que já estava na lixeira
set local request.jwt.claim.sub='user_lixDono';
select restaurar_minha_loja();
reset role;
select pg_temp.confere((select status='ativa' and excluida_em is null from vitrines_lojas where id=:'loja'),'loja volta');
select pg_temp.confere((select status='ativo' from anuncios where id=:'ativo'),'anuncio volta ao ar');
select pg_temp.confere((select status='pausado' from anuncios where id=:'pausado'),'pausado volta pausado');
select pg_temp.confere((select status='excluido' from anuncios where id=:'antes'),'lixeira anterior continua');
select pg_temp.confere(not exists(select 1 from lixeira_lojas where vitrine_id=:'loja'),'lixeira da loja limpa');

-- Conta: pedir exclusão leva a loja junto e corta o acesso
set local role authenticated;
set local request.jwt.claim.sub='user_lixDono';
select pg_temp.recusa($q$select pedir_exclusao_conta('nao')$q$,'23514');
select pedir_exclusao_conta('EXCLUIR');
select pg_temp.confere(usuario_id() is null,'conta na lixeira perde acesso');
select pg_temp.confere((minha_exclusao_pendente()->>'pode_cancelar')::boolean,'usuario pode cancelar');
reset role;
select pg_temp.confere((select origem='conta' from lixeira_lojas where vitrine_id=:'loja'),'loja acompanha a conta');
select pg_temp.confere((select status='excluido' from anuncios where id=:'ativo'),'anuncio sai com a conta');
set local role authenticated;
set local request.jwt.claim.sub='user_lixAdmin';
select pg_temp.recusa(format('select admin_lixeira_loja(%L,false,%L)',:'loja','restaurar so a loja'),'23514');
select pg_temp.confere(jsonb_array_length(admin_lixeira()->'contas')=1,'painel lista a conta');
-- Usuário entra de novo e cancela
set local request.jwt.claim.sub='user_lixDono';
select cancelar_exclusao_conta();
select pg_temp.confere(usuario_id()='user_lixDono','cancelar devolve o acesso');
select pg_temp.confere(minha_exclusao_pendente() is null,'sem pendencia');
reset role;
select pg_temp.confere((select status='ativa' from vitrines_lojas where id=:'loja'),'loja volta com a conta');
select pg_temp.confere((select status='ativo' from anuncios where id=:'ativo'),'anuncio volta com a conta');

-- Exclusão feita pelo admin não pode ser cancelada pelo usuário
set local role authenticated;
set local request.jwt.claim.sub='user_lixAdmin';
select pg_temp.recusa($q$select admin_lixeira_conta('user_lixAdmin',true,'teste')$q$,'23514');
select admin_lixeira_conta('user_lixDono',true,'Pedido LGPD por telefone');
set local request.jwt.claim.sub='user_lixDono';
select pg_temp.confere(not (minha_exclusao_pendente()->>'pode_cancelar')::boolean,'exclusao do admin nao cancela');
select pg_temp.recusa($q$select cancelar_exclusao_conta()$q$,'42501');
-- Apagar de vez agora exige o nome
set local request.jwt.claim.sub='user_lixAdmin';
select pg_temp.recusa($q$select admin_antecipar_limpeza('conta','user_lixDono','errado','LGPD')$q$,'23514');
select admin_antecipar_limpeza('conta','user_lixDono','Dono lixeira','Pedido LGPD');
select pg_temp.confere(exists(select 1 from admin_gestao_eventos where alvo='user_lixDono' and acao='apagar_definitivo'),'auditoria');
reset role;
select pg_temp.confere((limpeza_pendente()->'contas') ? 'user_lixDono','conta entra na fila de limpeza');
select pg_temp.confere(not ((limpeza_pendente()->'lojas') ? :'loja'),'loja da conta sai junto com a conta');
-- Admin restaura
set local role authenticated;
set local request.jwt.claim.sub='user_lixAdmin';
select admin_lixeira_conta('user_lixDono',false,'Engano');
reset role;
select pg_temp.confere((select status='ativo' from anuncios where id=:'ativo'),'restaurar pelo admin devolve tudo');

-- Reserva da limpeza: depois de reservada, a conta não volta mais
set local role authenticated;
set local request.jwt.claim.sub='user_lixDono';
select pedir_exclusao_conta('EXCLUIR');
reset role;
update lixeira_contas set apagar_apos=now() where usuario_id='user_lixDono';
select pg_temp.confere(limpeza_reservar_conta('user_lixDono'),'limpeza reserva a conta vencida');
select pg_temp.confere(not limpeza_reservar_conta('user_lixOutro'),'conta fora da lixeira nao e reservada');
set local role authenticated;
set local request.jwt.claim.sub='user_lixDono';
select pg_temp.confere(not (minha_exclusao_pendente()->>'pode_cancelar')::boolean,'reservada nao pode cancelar');
select pg_temp.recusa($q$select cancelar_exclusao_conta()$q$,'23514');
set local request.jwt.claim.sub='user_lixAdmin';
select pg_temp.recusa($q$select admin_lixeira_conta('user_lixDono',false,'Engano')$q$,'23514');
reset role;
update lixeira_contas set reservada_em=null, apagar_apos=now()+interval '30 days' where usuario_id='user_lixDono';
set local role authenticated;
set local request.jwt.claim.sub='user_lixDono';
select cancelar_exclusao_conta();

-- Loja tirada pela equipe continua fora do ar se o dono pedir e cancelar a exclusão da conta
set local request.jwt.claim.sub='user_lixAdmin';
select admin_lixeira_loja(:'loja',true,'Denuncia de golpe');
set local request.jwt.claim.sub='user_lixDono';
select pedir_exclusao_conta('EXCLUIR');
select cancelar_exclusao_conta();
reset role;
select pg_temp.confere((select origem='admin' from lixeira_lojas where vitrine_id=:'loja'),'exclusao da equipe continua da equipe');
select pg_temp.confere((select excluida_em is not null from vitrines_lojas where id=:'loja'),'loja continua fora do ar');
select pg_temp.confere((select status='excluido' from anuncios where id=:'ativo'),'anuncios continuam fora do ar');
set local role authenticated;
set local request.jwt.claim.sub='user_lixAdmin';
select admin_lixeira_loja(:'loja',false,'Revisado');
reset role;
select pg_temp.confere((select status='ativo' from anuncios where id=:'ativo'),'equipe restaura a loja');

-- Suspensão: tira loja e anúncios do ar e devolve igual
set local role authenticated;
set local request.jwt.claim.sub='user_lixAdmin';
select admin_bloquear_usuario('user_lixDono',true,'Golpe denunciado');
reset role;
select pg_temp.confere((select status='suspensa' from vitrines_lojas where id=:'loja'),'suspensao tira a loja do ar');
select pg_temp.confere((select status='pausado' from anuncios where id=:'ativo'),'suspensao pausa anuncios');
select pg_temp.confere((select whatsapp='5589999920102' from perfis where id='user_lixDono'),'celular continua preso ao perfil');
set local role authenticated;
set local request.jwt.claim.sub='user_lixAdmin';
select admin_bloquear_usuario('user_lixDono',false,'Resolvido');
reset role;
select pg_temp.confere((select status='ativa' from vitrines_lojas where id=:'loja'),'reativar devolve a loja');
select pg_temp.confere((select status='ativo' from anuncios where id=:'ativo'),'reativar devolve anuncios');
select pg_temp.confere((select status='pausado' from anuncios where id=:'pausado'),'pausado antes continua pausado');

-- Limpeza: anúncio vencido sai, congelado fica, loja com prova fica anonimizada
update anuncios set fotos=array['https://x.supabase.co/storage/v1/object/public/anuncios/user_lixDono/a/1.webp'] where id=:'antes';
select set_config('olaki.lixeira','1',true);
update anuncios set excluido_em=now()-interval '31 days' where id=:'antes';
select set_config('olaki.lixeira','',true);
select pg_temp.confere((limpeza_pendente()->'anuncios') ? :'antes','anuncio vencido na fila');
select pg_temp.confere(purgar_anuncio(:'antes')=array['https://x.supabase.co/storage/v1/object/public/anuncios/user_lixDono/a/1.webp'],'devolve foto sem uso');
select pg_temp.confere(not exists(select 1 from anuncios where id=:'antes'),'anuncio apagado');
select pg_temp.confere(exists(select 1 from limpeza_arquivos where url like '%/user_lixDono/a/1.webp'),'foto do anuncio na fila');
-- Anúncio citado em pedido congelado é prova; foto de proposta comum sai do Storage
select set_config('olaki.sistema','1',true);
insert into anuncios(vitrine_id,categoria_id,titulo,cidade,status,atributos,preco_centavos,descricao)
 values (:'loja',:'cat','Casa citada','Corrente','ativo','{"estado":"novo"}',10000,'Item de teste.');
select id as citada from anuncios where titulo='Casa citada' \gset
insert into radar_pedidos(id,comprador_id,microrregiao_id,titulo,cidade,status) values
 ('45000000-0000-4000-a000-000000000001','user_lixOutro',:'reg','Pedido congelado de teste','Corrente','congelado'),
 ('45000000-0000-4000-a000-000000000002','user_lixOutro',:'reg','Pedido aberto de teste','Corrente','aberto');
insert into radar_propostas(pedido_id,vitrine_id,anuncio_id,mensagem,foto_url) values
 ('45000000-0000-4000-a000-000000000001',:'loja',:'citada','Tenho este',null),
 ('45000000-0000-4000-a000-000000000002',:'loja',null,'Tenho na foto','https://x.supabase.co/storage/v1/object/public/anuncios/user_lixDono/p/1.webp');
select set_config('olaki.sistema','',true);
set local role authenticated;
set local request.jwt.claim.sub='user_lixAdmin';
select admin_lixeira_loja(:'loja',true,'Loja abandonada');
select admin_antecipar_limpeza('loja',:'loja','Loja Lixeira','Apagar agora');
reset role;
select pg_temp.confere((limpeza_pendente()->'lojas') ? :'loja','loja na fila');
select purgar_loja(:'loja') as purgadas \gset
select pg_temp.confere(:'purgadas'::text[] @> array['https://x.supabase.co/storage/v1/object/public/anuncios/user_lixDono/p/1.webp'],'foto da proposta volta para o Storage');
select pg_temp.confere(exists(select 1 from limpeza_arquivos where url='https://x.supabase.co/storage/v1/object/public/anuncios/user_lixDono/p/1.webp'),'foto entra na fila de arquivos');
select pg_temp.confere(exists(select 1 from anuncios where id=:'citada'),'anuncio citado em pedido congelado fica');
select pg_temp.confere(exists(select 1 from radar_propostas where pedido_id='45000000-0000-4000-a000-000000000001'),'proposta do pedido congelado fica');
select pg_temp.confere((select nome like 'Loja encerrada%' from vitrines_lojas where id=:'loja'),'loja com prova fica anonimizada');
select pg_temp.confere(exists(select 1 from anuncios where id=:'prova'),'prova preservada');
select pg_temp.confere(not exists(select 1 from anuncios where id in (:'ativo',:'pausado')),'demais anuncios apagados');
select pg_temp.confere(not exists(select 1 from lixeira_lojas where vitrine_id=:'loja'),'sai da fila');
select pg_temp.confere((select status='suspensa' and excluida_em is not null from vitrines_lojas where id=:'loja'),'continua fora do ar');
rollback;
