-- Promoção: uma loja nova recebe um cupom individualmente resgatável uma vez.
-- Três meses são corridos a partir do resgate, inclusive quando passam para 2027.
\set ON_ERROR_STOP on
begin;
reset role;
insert into public.perfis(id,microrregiao_id,nome,cidade,e_admin)
select 'user_adminvoucher890', id, 'Admin voucher', 'Corrente', true from public.microrregioes where slug='corrente-pi';
insert into public.perfis(id,microrregiao_id,nome,cidade,whatsapp,whatsapp_verificado_em)
select 'user_lojavoucher890', id, 'Loja voucher', 'Corrente','5589999990890',now() from public.microrregioes where slug='corrente-pi';
set local role authenticated;
select set_config('request.jwt.claim.sub','user_adminvoucher890',true);
select public.voucher_admin_criar('TESTE890', now() + interval '1 month');
select set_config('request.jwt.claim.sub','user_lojavoucher890',true);
do $$ begin
  begin
    perform public.voucher_admin_criar('NAOAUTORIZADO', now()+interval '1 month');
    raise exception 'usuário criou campanha de administrador';
  exception when insufficient_privilege then null; end;
end $$;
select public.quero_vender('loja','Loja voucher','loja-voucher-890','89999990890');
do $$ begin
  assert exists (select 1 from public.meus_vouchers() where codigo='TESTE890'), 'novo lojista não recebeu voucher';
end $$;
select public.resgatar_voucher('TESTE890');
reset role;
do $$ declare v public.vitrines_lojas; begin
  select * into v from public.vitrines_lojas where dono_id='user_lojavoucher890';
  assert v.plano='full', 'o resgate não ativou o plano completo';
  assert not exists (select 1 from public.pagamentos where vitrine_id=v.id), 'voucher gerou pagamento fictício';
  assert v.plano_expira_em >= now() + interval '3 months' - interval '1 second', 'a duração não é de três meses';
  begin
    perform public.resgatar_voucher('TESTE890');
    raise exception 'voucher aceito duas vezes';
  exception when invalid_parameter_value then null; end;
end $$;
-- A troca para Full conserva o período já pago em outro plano.
insert into public.perfis(id,microrregiao_id,nome,cidade,whatsapp,whatsapp_verificado_em)
select 'user_pagovoucher890', id, 'Loja paga', 'Corrente','5589999990891',now() from public.microrregioes where slug='corrente-pi';
set local role authenticated;
select set_config('request.jwt.claim.sub','user_pagovoucher890',true);
select public.quero_vender('loja','Loja paga voucher','loja-paga-voucher-890','89999990891');
reset role;
insert into public.pagamentos(vitrine_id,microrregiao_id,tipo,plano_codigo,valor_centavos,status,meses,asaas_cobranca_id)
select id,microrregiao_id,'assinatura','slim',2990,'pendente',6,'pay_voucher890'
from public.vitrines_lojas where dono_id='user_pagovoucher890';
select public.confirmar_pagamento('pay_voucher890');
set local role authenticated;
select public.resgatar_voucher('TESTE890');
reset role;
do $$ declare v public.vitrines_lojas; begin
  select * into v from public.vitrines_lojas where dono_id='user_pagovoucher890';
  assert v.plano='slim' and v.plano_proximo is null and v.plano_expira_em>=now()+interval '179 days', 'período pago foi alterado';
  assert exists (select 1 from public.voucher_atribuicoes where vitrine_id=v.id and reservado_em is not null and resgatado_em is null), 'voucher não ficou reservado';
end $$;
-- Direito reservado continua ativável após fim da campanha e estorno da assinatura.
set local role authenticated;
select set_config('request.jwt.claim.sub','user_adminvoucher890',true);
select public.voucher_admin_configurar((select id from public.voucher_campanhas where codigo='TESTE890'),false,now()-interval '1 day');
reset role;
select public.cancelar_pagamento('pay_voucher890','estornado');
set local role authenticated;
select set_config('request.jwt.claim.sub','user_pagovoucher890',true);
select public.resgatar_voucher('TESTE890');
reset role;
do $$ declare v public.vitrines_lojas; begin
  select * into v from public.vitrines_lojas where dono_id='user_pagovoucher890';
  assert v.plano='full' and v.plano_expira_em>=now()+interval '3 months'-interval '1 second', 'reserva não foi preservada após fim da campanha';
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','user_adminvoucher890',true);
select public.voucher_admin_configurar((select id from public.voucher_campanhas where codigo='TESTE890'),true,now()+interval '1 month');
reset role;
-- Uma concessão administrativa vigente também deve ser preservada.
insert into public.perfis(id,microrregiao_id,nome,cidade,whatsapp,whatsapp_verificado_em)
select 'user_adminplano890', id, 'Loja plano vigente', 'Corrente','5589999990893',now() from public.microrregioes where slug='corrente-pi';
set local role authenticated;
select set_config('request.jwt.claim.sub','user_adminplano890',true);
select public.quero_vender('loja','Loja plano vigente','loja-plano-vigente-890','89999990893');
reset role;
select id as loja_adminplano from public.vitrines_lojas where dono_id='user_adminplano890' \gset
set local role authenticated;
select set_config('request.jwt.claim.sub','user_adminvoucher890',true);
select public.admin_acao_loja(:'loja_adminplano','trocar_plano','Teste de plano vigente',365,'slim');
select set_config('request.jwt.claim.sub','user_adminplano890',true);
select public.resgatar_voucher('TESTE890');
reset role;
do $$ declare v public.vitrines_lojas; begin
  select * into v from public.vitrines_lojas where dono_id='user_adminplano890';
  assert v.plano='slim' and v.plano_expira_em>=now()+interval '364 days', 'concessão vigente foi encurtada';
  assert exists (select 1 from public.voucher_atribuicoes where vitrine_id=v.id and reservado_em is not null and resgatado_em is null), 'voucher não foi reservado';
end $$;
-- Pagamento recebido ainda sem concessão deve impedir ativação imediata.
insert into public.perfis(id,microrregiao_id,nome,cidade,whatsapp,whatsapp_verificado_em)
select 'user_concilia890', id, 'Loja conciliacao', 'Corrente','5589999990894',now() from public.microrregioes where slug='corrente-pi';
set local role authenticated;
select set_config('request.jwt.claim.sub','user_concilia890',true);
select public.quero_vender('loja','Loja conciliacao','loja-conciliacao-890','89999990894');
reset role;
insert into public.pagamentos(vitrine_id,microrregiao_id,tipo,plano_codigo,valor_centavos,status,pago_em)
select id,microrregiao_id,'assinatura','full',9900,'pago',now() from public.vitrines_lojas where dono_id='user_concilia890';
set local role authenticated;
select public.resgatar_voucher('TESTE890');
reset role;
do $$ declare v public.vitrines_lojas; begin
  select * into v from public.vitrines_lojas where dono_id='user_concilia890';
  assert v.plano='teste' and exists (select 1 from public.voucher_atribuicoes a where a.vitrine_id=v.id and a.reservado_em is not null and a.resgatado_em is null), 'cobrança em conciliação não preservou reserva';
end $$;
-- Quando uma loja montada é transferida, o novo dono recebe os cupons ainda não usados.
set local role authenticated;
select set_config('request.jwt.claim.sub','user_adminvoucher890',true);
select public.voucher_admin_criar('TRANSFER890', now() + interval '1 month');
reset role;
insert into public.perfis(id,microrregiao_id,nome,cidade,whatsapp,whatsapp_verificado_em)
select 'user_destinovoucher890', id, 'Novo dono', 'Corrente','5589999990892',now() from public.microrregioes where slug='corrente-pi';
select id as loja_transferir, atualizado_em as versao_transferir from public.vitrines_lojas where dono_id='user_lojavoucher890' \gset
set local role authenticated;
select set_config('request.jwt.claim.sub','user_adminvoucher890',true);
select public.admin_salvar_loja(:'loja_transferir', :'versao_transferir', jsonb_build_object('dono_id','user_destinovoucher890','whatsapp','5589999990892'), 'Teste de transferência com voucher');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','user_destinovoucher890',true);
do $$ begin
  assert exists (select 1 from public.meus_vouchers() where codigo='TRANSFER890'), 'novo dono não recebeu voucher';
  assert not exists (select 1 from public.meus_vouchers() where codigo='TESTE890'), 'voucher já usado reapareceu após transferência';
end $$;
-- Excluir o antigo titular não permite usar de novo um voucher já resgatado na loja.
reset role;
delete from public.perfis where id='user_lojavoucher890';
set local role authenticated;
select set_config('request.jwt.claim.sub','user_destinovoucher890',true);
do $$ begin
  assert not exists (select 1 from public.meus_vouchers() where codigo='TESTE890'), 'exclusão do antigo dono liberou voucher usado';
  begin
    perform public.resgatar_voucher('TESTE890');
    raise exception 'voucher usado foi aceito após exclusão do titular anterior';
  exception when invalid_parameter_value then null; end;
end $$;
-- Uma campanha desativada não pode ser resgatada.
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','user_adminvoucher890',true);
select public.voucher_admin_configurar((select id from public.voucher_campanhas where codigo='TRANSFER890'),false,now()+interval '1 month');
select set_config('request.jwt.claim.sub','user_destinovoucher890',true);
do $$ begin
  begin
    perform public.resgatar_voucher('TRANSFER890');
    raise exception 'cupom desativado foi aceito';
  exception when invalid_parameter_value then null; end;
end $$;
-- Após o período promocional, a loja mantém a vitrine e o limite de 10 anúncios.
reset role;
update public.configuracoes set valor='"https://abc.supabase.co"' where chave='fotos.origem' and microrregiao_id is null;
update public.configuracoes set valor='1' where chave='anuncio.fotos_minimo' and microrregiao_id is null;
select set_config('olaki.sistema','1',true);
update public.vitrines_lojas set plano='full', plano_expira_em=now()+interval '1 month' where dono_id='user_destinovoucher890';
with itens as (select gen_random_uuid() as id, n from generate_series(1,11) n)
insert into public.anuncios(id,vitrine_id,categoria_id,titulo,descricao,cidade,preco_centavos,atributos,status,fotos)
select i.id,v.id,c.id,'Produto voucher teste '||i.n,'Produto fictício para verificar limites.','Corrente',10000,'{"estado":"usado"}','ativo',
  array['https://abc.supabase.co/storage/v1/object/public/anuncios/user_destinovoucher890/'||i.id||'/1.webp']
from itens i cross join public.vitrines_lojas v cross join public.categorias c
where v.dono_id='user_destinovoucher890' and c.slug='sofas-e-poltronas';
select set_config('olaki.sistema','',true);
select set_config('olaki.sistema','1',true);
update public.vitrines_lojas set plano='full', plano_expira_em=now()-interval '1 second' where dono_id='user_destinovoucher890';
select set_config('olaki.sistema','',true);
do $$ declare v public.vitrines_lojas; begin
  select * into v from public.vitrines_lojas where dono_id='user_destinovoucher890';
  assert (public.plano_efetivo(v)).codigo='loja_gratis', 'loja não caiu no plano gratuito';
  assert public.limite_anuncios(v)=10, 'limite gratuito da loja não é 10';
  assert (public.plano_efetivo(v)).vitrine_foto_fachada and (public.plano_efetivo(v)).vitrine_secoes_max>=10, 'vitrine perdeu recursos';
end $$;
select public.aplicar_limite_loja_gratis();
do $$ begin
  assert (select count(*)=10 from public.anuncios a join public.vitrines_lojas v on v.id=a.vitrine_id where v.dono_id='user_destinovoucher890' and a.status='ativo'), 'não manteve 10 anúncios ativos';
  assert (select count(*)=1 from public.anuncios a join public.vitrines_lojas v on v.id=a.vitrine_id where v.dono_id='user_destinovoucher890' and a.status='pausado'), 'não pausou o excedente';
end $$;
rollback;
