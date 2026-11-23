-- Compatibilidade dos wrappers antigos e dos períodos Full já concedidos.
\set ON_ERROR_STOP on
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','user_reserva890',true);
do $$ begin
  assert exists (select 1 from public.meus_vouchers() where codigo='RESERVA890' and reservado_em is not null),
    'reserva anterior sumiu depois que a campanha encerrou';
end $$;
reset role;
update public.voucher_campanhas set duracao_dias=13 where codigo='RESERVA890';
set local role authenticated;
do $$ begin
  assert public.resgatar_voucher('RESERVA890') is not null, 'reserva anterior não pode ser ativada';
  assert not exists (select 1 from public.meus_vouchers() where codigo='RESERVA890'), 'reserva consumida ainda aparece';
end $$;
do $$ begin
  assert exists (select 1 from public.meu_promocional() where codigo='RESERVA890' and vence_em-ativado_em=interval '312 hours'),
    'reserva não ativou o Promocional de imediato com a duração vigente';
end $$;
reset role;
insert into public.perfis(id,microrregiao_id,nome,cidade,e_admin,e_super_admin)
select 'user_adminvoucher890',id,'Master voucher','Corrente',true,true from public.microrregioes where slug='corrente-pi';
insert into public.perfis(id,microrregiao_id,nome,cidade,whatsapp,whatsapp_verificado_em)
select pessoa.id,regiao.id,pessoa.nome,'Corrente',pessoa.fone,now()
from public.microrregioes regiao cross join (values
  ('user_legado890','Loja legada','5589999990890'),
  ('user_pagovoucher890','Loja paga','5589999990891'),
  ('user_destinovoucher890','Novo dono','5589999990892')
) pessoa(id,nome,fone)
where regiao.slug='corrente-pi';

set local role authenticated;
select set_config('request.jwt.claim.sub','user_adminvoucher890',true);
select public.voucher_admin_criar('TESTE890', now()+interval '1 month');
select set_config('request.jwt.claim.sub','user_legado890',true);
do $$ begin
  assert not exists (select 1 from public.meus_vouchers() where codigo='RESERVA890');
  begin
    perform public.resgatar_voucher('RESERVA890');
    raise exception 'conta sem reserva ativou campanha encerrada';
  exception when invalid_parameter_value then
    assert sqlerrm='Cupom desativado.';
  end;
end $$;
select public.quero_vender('loja','Loja legada','loja-legada-890','89999990890');
select set_config('request.jwt.claim.sub','user_pagovoucher890',true);
select public.quero_vender('loja','Loja paga voucher','loja-paga-voucher-890','89999990891');
reset role;

select set_config('olaki.sistema','1',true);
update public.vitrines_lojas set plano='full',plano_expira_em=now()+interval '19 days' where dono_id='user_legado890';
select set_config('olaki.sistema','',true);
insert into public.voucher_atribuicoes(campanha_id,dono_id,vitrine_id,resgatado_em,concedido_de,concedido_ate)
select c.id,v.dono_id,v.id,now()-interval '2 months',now()-interval '2 months',v.plano_expira_em
from public.vitrines_lojas v cross join public.voucher_campanhas c where v.dono_id='user_legado890' and c.codigo='TESTE890';

insert into public.pagamentos(vitrine_id,microrregiao_id,tipo,plano_codigo,valor_centavos,status,meses,asaas_cobranca_id)
select id,microrregiao_id,'assinatura','slim',2990,'pendente',6,'pay_voucher890'
from public.vitrines_lojas where dono_id='user_pagovoucher890';
select public.confirmar_pagamento('pay_voucher890');
set local role authenticated;
select public.resgatar_voucher('TESTE890');
reset role;

do $$ declare v public.vitrines_lojas; begin
  select * into v from public.vitrines_lojas where dono_id='user_legado890';
  assert (public.plano_efetivo(v)).codigo='full' and v.plano_expira_em=now()+interval '19 days', 'datas ou Full legado alterados';
  select * into v from public.vitrines_lojas where dono_id='user_pagovoucher890';
  assert v.plano='slim' and v.plano_proximo is null and v.plano_expira_em>=now()+interval '179 days', 'período pago foi alterado';
  assert (public.plano_efetivo(v)).codigo='promocional', 'pagamento impediu ativação imediata';
  assert (select count(*)=1 from public.pagamentos where vitrine_id=v.id), 'cupom gerou pagamento';
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub','user_adminvoucher890',true);
select public.voucher_admin_configurar((select id from public.voucher_campanhas where codigo='TESTE890'),false,now()-interval '1 day');
select set_config('request.jwt.claim.sub','user_pagovoucher890',true);
do $$ begin
  assert (select vence_em-ativado_em=interval '2160 hours' from public.meu_promocional()), 'wrapper não preservou o padrão de 90 dias';
end $$;
reset role;
select public.cancelar_pagamento('pay_voucher890','estornado');
set local role authenticated;
do $$ begin
  assert (select codigo='TESTE890' from public.meu_promocional()), 'estorno revogou cupom';
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','user_adminvoucher890',true);
select public.voucher_admin_criar('TRANSFER890',2);
select set_config('request.jwt.claim.sub','user_legado890',true);
select public.resgatar_voucher('TRANSFER890');
reset role;
select id as loja_transferir, atualizado_em as versao_transferir from public.vitrines_lojas where dono_id='user_legado890' \gset
set local role authenticated;
select set_config('request.jwt.claim.sub','user_adminvoucher890',true);
select public.admin_salvar_loja(:'loja_transferir', :'versao_transferir', jsonb_build_object('dono_id','user_destinovoucher890','whatsapp','5589999990892'), 'Teste de transferência com voucher');
select set_config('request.jwt.claim.sub','user_destinovoucher890',true);
do $$ begin
  assert not exists(select 1 from public.meu_promocional()), 'transferência entregou cupom ao novo dono';
  begin
    perform public.resgatar_voucher('TESTE890');
    raise exception 'cupom desativado foi aceito';
  exception when invalid_parameter_value then null; end;
end $$;
-- Após o período promocional, a loja mantém a vitrine e o limite de 10 anúncios.
reset role;
update public.configuracoes set valor='"https://abc.supabase.co"' where chave='fotos.origem' and microrregiao_id is null;
update public.configuracoes set valor='1' where chave='anuncio.fotos_minimo' and microrregiao_id is null;
select set_config('olaki.sistema','1',true);
update public.vitrines_lojas set plano='loja_gratis', plano_expira_em=null where dono_id='user_destinovoucher890';
select set_config('olaki.sistema','',true);
set local role authenticated;
select set_config('request.jwt.claim.sub','user_adminvoucher890',true);
update public.planos set limite_anuncios=11 where codigo='promocional';
select set_config('request.jwt.claim.sub','user_destinovoucher890',true);
select public.resgatar_voucher('TRANSFER890');
reset role;
with itens as (select gen_random_uuid() as id, n from generate_series(1,11) n)
insert into public.anuncios(id,vitrine_id,categoria_id,titulo,descricao,cidade,preco_centavos,atributos,status,fotos)
select i.id,v.id,c.id,'Produto voucher teste '||i.n,'Produto fictício para verificar limites.','Corrente',10000,'{"estado":"usado"}','ativo',
  array['https://abc.supabase.co/storage/v1/object/public/anuncios/user_destinovoucher890/'||i.id||'/1.webp']
from itens i cross join public.vitrines_lojas v cross join public.categorias c
where v.dono_id='user_destinovoucher890' and c.slug='sofas-e-poltronas';
select public.aplicar_limite_loja_gratis();
do $$ begin
  assert (select count(*)=11 from public.anuncios a join public.vitrines_lojas v on v.id=a.vitrine_id
          where v.dono_id='user_destinovoucher890' and a.status='ativo'), 'rotina pausou anúncio durante promoção';
end $$;
update public.voucher_atribuicoes set concedido_de=now()-interval '3 days', concedido_ate=now()-interval '1 second'
where dono_id='user_destinovoucher890' and acesso_promocional;
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
