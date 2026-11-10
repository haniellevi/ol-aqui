\set ON_ERROR_STOP on
begin;
create function pg_temp.checar(ok boolean, texto text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FALHOU: %', texto; end if; end $$;
-- Visitas e favoritos atualizam contadores por funções protegidas, sem exigir cadastro.
select id as loja from vitrines_lojas where dono_id='user_loja' \gset
select id as cat from categorias where slug='moveis' \gset
insert into anuncios(id,vitrine_id,categoria_id,titulo,cidade,preco_centavos,status) values
 ('87000000-0000-4000-a000-000000000001',:'loja',:'cat','Mesa teste confirmação','Corrente',85000,'ativo');
set local role anon;
set local request.jwt.claim.role='anon';
set local request.jwt.claim.sub='';
select pg_temp.checar(registrar_evento('87000000-0000-4000-a000-000000000001','visualizacao'),'Visitante registra visualização');
select pg_temp.checar(registrar_evento('87000000-0000-4000-a000-000000000001','clique_whatsapp'),'Visitante registra contato');
set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='user_semcodigo';
insert into favoritos(usuario_id,anuncio_id) values('user_semcodigo','87000000-0000-4000-a000-000000000001');
select pg_temp.checar((select total_favoritos=1 and visualizacoes=1 and cliques_whatsapp=1 from anuncios where id='87000000-0000-4000-a000-000000000001'),'Contadores independem da confirmação do visitante');
delete from favoritos where usuario_id='user_semcodigo' and anuncio_id='87000000-0000-4000-a000-000000000001';
select pg_temp.checar((select total_favoritos=0 from anuncios where id='87000000-0000-4000-a000-000000000001'),'Remover favorito atualiza contador');
reset role;
update perfis set whatsapp_verificado_em=null where id='user_loja';
set local role authenticated;
set local request.jwt.claim.sub='user_loja';
do $$ begin
 begin
  update anuncios set titulo='Edição sem confirmação' where id='87000000-0000-4000-a000-000000000001';
  raise exception 'Edição indevidamente permitida';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
update perfis set whatsapp_verificado_em=now() where id='user_loja';
select pg_temp.checar(not has_function_privilege('authenticated','reservar_codigo_whatsapp(text,uuid,text,text)','execute'),'Cliente não pode reservar');
select pg_temp.checar(not has_function_privilege('anon','confirmar_codigo_whatsapp(text,uuid,text)','execute'),'Visitante não pode confirmar');
select pg_temp.checar(not has_table_privilege('authenticated','whatsapp_desafios','select'),'Resumo é privado');
select pg_temp.checar(reservar_codigo_whatsapp('user_semcodigo','70000000-0000-4000-a000-000000000001','5589999990011',repeat('a',64))='reservado','Reserva inicial');
select pg_temp.checar(reservar_codigo_whatsapp('user_semcodigo',gen_random_uuid(),'5589999990012',repeat('a',64))='aguarde','Limite por conta');
select pg_temp.checar(reservar_codigo_whatsapp('user_loja',gen_random_uuid(),'5589999990011',repeat('a',64))='aguarde','Limite por destinatário entre contas');
select pg_temp.checar(confirmar_codigo_whatsapp('user_loja','70000000-0000-4000-a000-000000000001',repeat('a',64))='invalido','Código de outra conta');
select pg_temp.checar(confirmar_codigo_whatsapp('user_semcodigo','70000000-0000-4000-a000-000000000001',repeat('b',64))='incorreto','Primeiro erro');
select pg_temp.checar(confirmar_codigo_whatsapp('user_semcodigo','70000000-0000-4000-a000-000000000001',repeat('b',64))='incorreto','Segundo erro');
select pg_temp.checar(confirmar_codigo_whatsapp('user_semcodigo','70000000-0000-4000-a000-000000000001',repeat('b',64))='bloqueado','Terceiro erro');
select pg_temp.checar(confirmar_codigo_whatsapp('user_semcodigo','70000000-0000-4000-a000-000000000001',repeat('a',64))='bloqueado','Nem correto depois do terceiro erro');
select pg_temp.checar((select whatsapp_verificado_em is null from perfis where id='user_semcodigo'),'Falhas não confirmam');
update whatsapp_desafios set criado_em=now()-interval '61 seconds';
select pg_temp.checar(reservar_codigo_whatsapp('user_semcodigo','70000000-0000-4000-a000-000000000002','5589999990012',repeat('c',64))='reservado','Reenvio após intervalo');
select pg_temp.checar((select cancelado from whatsapp_desafios where id='70000000-0000-4000-a000-000000000001'),'Invalida anterior');
select pg_temp.checar(confirmar_codigo_whatsapp('user_semcodigo','70000000-0000-4000-a000-000000000002',repeat('c',64))='confirmado','Código válido');
select pg_temp.checar((select whatsapp='5589999990012' and whatsapp_origem='evolution' and whatsapp_verificado_em is not null from perfis where id='user_semcodigo'),'Número e origem juntos');
select pg_temp.checar(confirmar_codigo_whatsapp('user_semcodigo','70000000-0000-4000-a000-000000000002',repeat('c',64))='invalido','Não pode reutilizar');
-- Webhook atrasado precisa condicionar a escrita à fonte.
update perfis set whatsapp=null,whatsapp_verificado_em=null where id='user_semcodigo' and whatsapp_origem='clerk';
select pg_temp.checar(whatsapp_confirmado('user_semcodigo'),'Webhook antigo preserva confirmação externa');
set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='user_semcodigo';
update perfis set whatsapp='5589999990099',whatsapp_origem='clerk',whatsapp_verificado_em=now() where id='user_semcodigo';
reset role;
select pg_temp.checar((select whatsapp='5589999990012' and whatsapp_origem='evolution' from perfis where id='user_semcodigo'),'Cliente não troca contato nem origem');
update whatsapp_desafios set criado_em=now()-interval '61 seconds';
select reservar_codigo_whatsapp('user_semcodigo','70000000-0000-4000-a000-000000000003','5589999990013',repeat('d',64));
update whatsapp_desafios set expira_em=clock_timestamp() where id='70000000-0000-4000-a000-000000000003';
select pg_temp.checar(confirmar_codigo_whatsapp('user_semcodigo','70000000-0000-4000-a000-000000000003',repeat('d',64))='expirado','Limite exato do prazo');
select pg_temp.checar((select whatsapp='5589999990012' from perfis where id='user_semcodigo'),'Troca pendente não apaga contato atual');
update whatsapp_desafios set criado_em=now()-interval '61 seconds';
select reservar_codigo_whatsapp('user_semcodigo','70000000-0000-4000-a000-000000000004','5589999990014',repeat('e',64));
update whatsapp_desafios set envio='falha' where id='70000000-0000-4000-a000-000000000004';
select pg_temp.checar(confirmar_codigo_whatsapp('user_semcodigo','70000000-0000-4000-a000-000000000004',repeat('e',64))='invalido','Falha explícita invalida código');
update whatsapp_desafios set envio='incerto' where id='70000000-0000-4000-a000-000000000004';
select pg_temp.checar(confirmar_codigo_whatsapp('user_semcodigo','70000000-0000-4000-a000-000000000004',repeat('e',64))='confirmado','Entrega atrasada permite confirmação');
update whatsapp_desafios set criado_em=now()-interval '61 seconds';
select reservar_codigo_whatsapp('user_semcodigo','70000000-0000-4000-a000-000000000005','5589999990015',repeat('f',64));
update whatsapp_desafios set criado_em=now()-interval '61 seconds';
select pg_temp.checar(reservar_codigo_whatsapp('user_semcodigo',gen_random_uuid(),'5589999990016',repeat('f',64))='reservado','A conta pode pedir outro código após cinco reservas no dia');
insert into whatsapp_desafios(id,usuario_id,numero,resumo,criado_em)
select gen_random_uuid(),'user_semcodigo','5589999990017',repeat('a',64),now()-(n+2)*interval '1 minute'
from generate_series(1,100) as n;
select pg_temp.checar(reservar_codigo_whatsapp('user_loja',gen_random_uuid(),'5589999990017',repeat('f',64))='reservado','O histórico diário do destinatário e do serviço permite novo envio');
rollback;
