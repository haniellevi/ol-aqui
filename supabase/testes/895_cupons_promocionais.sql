\set ON_ERROR_STOP on
begin;

do $$ begin
  assert (select row(p.limite_anuncios,p.acesso_radar,p.propostas_radar_mes,p.aviso_radar_na_hora,
                     p.vitrine_foto_fachada,p.vitrine_secoes_max,p.vitrine_fixados_max)
                 is not distinct from
                 row(f.limite_anuncios,f.acesso_radar,f.propostas_radar_mes,f.aviso_radar_na_hora,
                     f.vitrine_foto_fachada,f.vitrine_secoes_max,f.vitrine_fixados_max)
          from public.planos p cross join public.planos f where p.codigo='promocional' and f.codigo='full'),
    'a migração não copiou as permissões do Full';
end $$;

set local role anon;
do $$ begin
  assert not exists(select 1 from public.planos where codigo='promocional');
  begin
    perform public.resgatar_voucher('CURTO895');
    raise exception 'visitante acessou o resgate';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

insert into public.perfis(id,microrregiao_id,nome,cidade,e_admin,e_super_admin)
select pessoa.id, regiao.id, pessoa.nome, 'Corrente', pessoa.admin, pessoa.master
from public.microrregioes regiao cross join (values
  ('user_master895','Master',true,true),
  ('user_admin895','Admin',true,false),
  ('user_cliente895','Cliente',false,false),
  ('user_outro895','Outra conta',false,false),
  ('user_pfpausa895','Pessoa física',false,false)
) pessoa(id,nome,admin,master)
where regiao.slug='corrente-pi';

set local role authenticated;
select set_config('request.jwt.claim.sub','user_master895',true);
select public.voucher_admin_criar(p_codigo=>'LONGO895', p_duracao_dias=>18);
select public.voucher_admin_criar(p_codigo=>'CURTO895', p_duracao_dias=>2);
select public.voucher_admin_criar(p_codigo=>'VENCIDO895', p_duracao_dias=>2);
select public.voucher_admin_configurar((select id from public.voucher_campanhas where codigo='VENCIDO895'), true, 2, now()-interval '1 day');
do $$ declare campanha uuid; begin
  select id into campanha from public.voucher_campanhas where codigo='LONGO895';
  begin
    perform public.voucher_admin_criar('EXTREMO895',2147483647);
    raise exception 'duração que estoura timestamptz aceita na criação';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.voucher_admin_configurar(campanha,true,2147483647);
    raise exception 'duração que estoura timestamptz aceita na edição';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.voucher_admin_criar('INFINITO895',2,'infinity');
    raise exception 'data limite infinita aceita';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.voucher_admin_configurar(campanha,true,2,'-infinity');
    raise exception 'data limite infinita aceita na edição';
  exception when invalid_parameter_value then null; end;
end $$;
update public.planos set limite_anuncios=7, acesso_radar=true, propostas_radar_mes=4,
  aviso_radar_na_hora=true, vitrine_foto_fachada=true, vitrine_secoes_max=4, vitrine_fixados_max=2
where codigo='promocional';

select set_config('request.jwt.claim.sub','user_admin895',true);
do $$ begin
  assert not has_table_privilege('public.planos','TRUNCATE'), 'papel da API pode contornar a RLS via TRUNCATE';
  begin
    perform public.voucher_admin_criar('BURLA895', now()+interval '1 day');
    raise exception 'admin comum criou cupom pela assinatura antiga';
  exception when insufficient_privilege then null; end;
  begin
    perform public.voucher_admin_criar('BURLA895', 2);
    raise exception 'admin comum criou cupom pela assinatura nova';
  exception when insufficient_privilege then null; end;
  begin
    perform public.voucher_admin_configurar(null,false,now());
    raise exception 'admin comum alterou pela assinatura antiga';
  exception when insufficient_privilege then null; end;
  begin
    perform public.voucher_admin_configurar((select id from public.voucher_campanhas where codigo='LONGO895'),false,2);
    raise exception 'admin comum alterou campanha';
  exception when insufficient_privilege then null; end;
  begin
    update public.planos set limite_anuncios=1000 where codigo='promocional';
    assert not found, 'admin comum alterou plano promocional';
  exception when insufficient_privilege then null; end;
end $$;

select set_config('request.jwt.claim.sub','user_cliente895',true);
do $$ begin
  assert not exists (select 1 from public.meus_vouchers()), 'campanha foi publicada para conta sem atribuição';
  begin
    perform public.resgatar_voucher('VENCIDO895');
    raise exception 'cupom vencido foi aceito';
  exception when invalid_parameter_value then null; end;
end $$;
select public.resgatar_voucher(' longo895 ');
select public.resgatar_voucher('CURTO895');
do $$ begin
  assert exists (select 1 from public.planos where codigo='promocional' and limite_anuncios=7),
    'titular sem vitrine não conseguiu ler as permissões';
  assert (select codigo='LONGO895' and vence_em-ativado_em=interval '432 hours' from public.meu_promocional()),
    'prazo inexato ou sobreposição encurtou benefício';
  assert not exists(select 1 from public.meus_vouchers() where codigo in ('LONGO895','CURTO895'));
  begin
    perform public.resgatar_voucher('LONGO895');
    raise exception 'cupom reaplicado';
  exception when invalid_parameter_value then null; end;
end $$;

select set_config('request.jwt.claim.sub','user_outro895',true);
do $$ begin
  assert not exists(select 1 from public.meu_promocional()), 'consulta vazou promoção de outra conta';
  assert not exists(select 1 from public.planos where codigo='promocional'), 'plano exposto a conta sem promoção';
end $$;
reset role;

insert into public.vitrines_lojas(dono_id,microrregiao_id,slug,nome,cidade,whatsapp,tipo,plano)
select id,microrregiao_id,'vitrine-pf-895',nome,cidade,'5589999990895','pf','pf_gratis'
from public.perfis where id='user_cliente895';
insert into public.vitrines_lojas(dono_id,microrregiao_id,slug,nome,cidade,whatsapp,tipo,plano)
select id,microrregiao_id,'vitrine-pj-895',nome,cidade,'5589999990896','loja','loja_gratis'
from public.perfis where id='user_outro895';

do $$ declare v public.vitrines_lojas; begin
  select * into v from public.vitrines_lojas where dono_id='user_cliente895';
  assert v.plano='pf_gratis' and (public.plano_efetivo(v)).codigo='promocional', 'PF perdeu plano base ou não recebeu direitos';
  assert public.limite_anuncios(v)=7, 'limite promocional não chegou à publicação';
  assert not public.pode_atender_radar(v.dono_id), 'Radar liberado sem verificação';
  v.arquivada_em := now();
  assert (public.plano_efetivo(v)).codigo is distinct from 'promocional', 'promoção em vitrine arquivada';
  v.arquivada_em := null;
  v.excluida_em := now();
  assert (public.plano_efetivo(v)).codigo is distinct from 'promocional', 'promoção em vitrine na lixeira';
  v.excluida_em := null;
  v.status := 'suspensa';
  assert (public.plano_efetivo(v)).codigo is null, 'direitos em vitrine suspensa';
  select * into v from public.vitrines_lojas where dono_id='user_outro895';
  assert (public.plano_efetivo(v)).codigo='loja_gratis', 'outra loja recebeu direitos';
end $$;

update public.perfis set selo_negociador_certificado=true,verificacao_pf_em=now() where id='user_cliente895';
do $$ begin
  assert public.pode_atender_radar('user_cliente895'), 'PF verificada não recebeu Radar';
  assert public.propostas_restantes('user_cliente895')=4, 'cota de propostas incorreta';
  assert public.recebe_aviso_radar_na_hora('user_cliente895'), 'aviso que o plano libera foi bloqueado';
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub','user_master895',true);
select public.voucher_admin_configurar((select id from public.voucher_campanhas where codigo='LONGO895'),false,1);
update public.planos set limite_anuncios=6 where codigo='promocional';
reset role;
do $$ begin
  assert (select public.limite_anuncios(v)=6 from public.vitrines_lojas v where dono_id='user_cliente895');
end $$;

insert into public.voucher_atribuicoes(campanha_id,dono_id)
select id,'user_outro895' from public.voucher_campanhas where codigo='CURTO895';
set local role authenticated;
select set_config('request.jwt.claim.sub','user_outro895',true);
do $$ begin
  assert (select codigo='CURTO895' and duracao_dias=2 and valido_ate is null and resgatado_em is null and reservado_em is null
          from public.meus_vouchers()), 'atribuição legada não apareceu para seu titular';
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','user_cliente895',true);
do $$ begin
  assert (select vence_em-ativado_em=interval '432 hours' from public.meu_promocional()), 'edição alterou concessão vigente';
end $$;
reset role;
select set_config('olaki.sistema','1',true);
update public.perfis set whatsapp='5589999990895',whatsapp_verificado_em=now() where id='user_cliente895';
-- Full vigente tem prioridade; fixamos recursos para manter o teste de conversão.
update public.planos set vitrine_secoes_max=4,vitrine_fixados_max=2 where codigo='full';
update public.vitrines_lojas set plano='full',plano_expira_em=now()+interval '30 days' where dono_id='user_cliente895';
select set_config('olaki.sistema','',true);
update public.configuracoes set valor='"https://abc.supabase.co"' where chave='fotos.origem' and microrregiao_id is null;
update public.configuracoes set valor='1' where chave='anuncio.fotos_minimo' and microrregiao_id is null;
insert into public.anuncios(id,vitrine_id,categoria_id,titulo,descricao,cidade,preco_centavos,atributos,status,fotos)
select '89500000-0000-4000-a000-000000000001',v.id,c.id,'Sofá de teste','Produto fictício para verificar limites.',
       'Corrente',10000,'{"estado":"usado"}','ativo',
       array['https://abc.supabase.co/storage/v1/object/public/anuncios/user_cliente895/89500000-0000-4000-a000-000000000001/1.webp']
from public.vitrines_lojas v cross join public.categorias c
where v.dono_id='user_cliente895' and c.slug='sofas-e-poltronas';

set local role authenticated;
do $$ declare vitrine uuid; begin
  select id into strict vitrine from public.vitrines_lojas where dono_id='user_cliente895';
  begin
    insert into public.loja_secoes(vitrine_id,nome) values(vitrine,'Seção da PF');
    raise exception 'PF promocional criou seção';
  exception when insufficient_privilege then
    assert sqlerrm = 'Só lojas têm seções na vitrine.';
  end;
  begin
    update public.vitrines_lojas set banner_tipo='foto',
      banner_url='https://abc.supabase.co/storage/v1/object/public/anuncios/user_cliente895/vitrine/banner.webp'
    where id=vitrine;
    raise exception 'PF promocional gravou foto de fachada';
  exception when insufficient_privilege then
    assert sqlerrm like 'A foto da fachada %';
  end;
  begin
    perform public.fixar_anuncio('89500000-0000-4000-a000-000000000001');
    raise exception 'PF promocional fixou anúncio';
  exception when raise_exception then
    assert sqlerrm like 'Fixar produtos no topo %', sqlerrm;
  end;
  assert (select not foto_fachada and secoes_max=0 and fixados_max=0 from public.recursos_vitrine_id(vitrine)),
    'PF recebeu recursos próprios de loja';
  perform set_config('teste.promocao_pf895',(select to_jsonb(p)::text from public.meu_promocional() p),true);
end $$;

select public.quero_vender('loja','Loja convertida 895','loja-convertida-895','89999990895');
do $$ declare vitrine uuid; begin
  select id into strict vitrine from public.vitrines_lojas where dono_id='user_cliente895';
  assert (select to_jsonb(p)=current_setting('teste.promocao_pf895')::jsonb from public.meu_promocional() p),
    'conversão alterou a concessão vigente';
  assert (select foto_fachada and secoes_max=4 and fixados_max=2 from public.recursos_vitrine_id(vitrine)),
    'loja convertida não recebeu os recursos promocionais';
  begin
    insert into public.loja_secoes(vitrine_id,nome) values(vitrine,'Maconha boa');
    raise exception 'loja convertida gravou nome bloqueado pela moderação';
  exception when check_violation then
    assert sqlerrm like '%palavra%não é permitida%';
  end;
  insert into public.loja_secoes(vitrine_id,nome)
  select vitrine,'Seção '||n from generate_series(1,4) n;
  begin
    insert into public.loja_secoes(vitrine_id,nome) values(vitrine,'Seção excedente');
    raise exception 'limite de seções ignorado';
  exception when raise_exception then
    assert sqlerrm like 'Seu plano permite até 4 seções.%', sqlerrm;
  end;
  update public.vitrines_lojas set banner_tipo='foto',
    banner_url='https://abc.supabase.co/storage/v1/object/public/anuncios/user_cliente895/vitrine/banner.webp'
  where id=vitrine;
  assert found, 'loja convertida não gravou foto de fachada';
  assert public.fixar_anuncio('89500000-0000-4000-a000-000000000001') = 1, 'loja convertida não fixou anúncio';
  perform set_config('teste.vitrine_convertida895',vitrine::text,true);
end $$;
select set_config('request.jwt.claim.sub','user_outro895',true);
do $$ begin
  begin
    insert into public.loja_secoes(vitrine_id,nome)
    values(current_setting('teste.vitrine_convertida895')::uuid,'Seção de terceiros');
    raise exception 'outra conta criou seção na loja convertida';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
  assert (select tipo='loja' and plano='full' and plano_expira_em=now()+interval '30 days'
          from public.vitrines_lojas where dono_id='user_cliente895'), 'converter PF em loja durante promoção descartou o Full';
  assert (select fixado_na_loja=1 from public.anuncios where id='89500000-0000-4000-a000-000000000001'),
    'fixação da loja convertida não foi gravada';
end $$;
update public.voucher_atribuicoes set concedido_de=now()-interval '20 days', concedido_ate=now()-interval '1 second'
where dono_id='user_cliente895';
do $$ begin
  assert (select (public.plano_efetivo(v)).codigo='full' from public.vitrines_lojas v where dono_id='user_cliente895');
end $$;
-- A rotina de limite também trata a vitrine PF e preserva os anúncios avulsos.
update public.perfis set whatsapp='5589999990897',whatsapp_verificado_em=now() where id='user_pfpausa895';
set local role authenticated;
select set_config('request.jwt.claim.sub','user_master895',true);
update public.planos set limite_anuncios=12 where codigo='promocional';
select set_config('request.jwt.claim.sub','user_pfpausa895',true);
select public.resgatar_voucher('CURTO895');
select public.quero_vender('pf');
reset role;
with itens as (select gen_random_uuid() as id,n from generate_series(1,13) n)
insert into public.anuncios(id,vitrine_id,categoria_id,titulo,descricao,cidade,preco_centavos,atributos,status,fotos,pago_ate)
select i.id,v.id,c.id,'Produto de teste '||i.n,'Produto fictício para verificar limites.','Corrente',10000,
       '{"estado":"usado"}','ativo',array['https://abc.supabase.co/storage/v1/object/public/anuncios/user_pfpausa895/'||i.id||'/1.webp'],
       case when i.n=13 then now()+interval '10 days' end
from itens i cross join public.vitrines_lojas v cross join public.categorias c
where v.dono_id='user_pfpausa895' and c.slug='sofas-e-poltronas';

set local role authenticated;
select set_config('request.jwt.claim.sub','user_master895',true);
update public.planos set limite_anuncios=8 where codigo='promocional';
reset role;
select public.aplicar_limite_loja_gratis();
do $$ begin
  assert (select count(*)=8 from public.anuncios a join public.vitrines_lojas v on v.id=a.vitrine_id
          where v.dono_id='user_pfpausa895' and a.status='ativo' and a.pago_ate is null), 'limite promocional reduzido não foi aplicado';
end $$;
set local role authenticated;
update public.planos set limite_anuncios=12 where codigo='promocional';
reset role;
update public.anuncios set status='ativo' where status='pausado'
  and vitrine_id=(select id from public.vitrines_lojas where dono_id='user_pfpausa895');

update public.voucher_atribuicoes set concedido_de=now()-interval '3 days', concedido_ate=now()-interval '1 second'
where dono_id='user_pfpausa895';
select public.aplicar_limite_loja_gratis();
do $$ begin
  assert (select count(*)=3 from public.anuncios a join public.vitrines_lojas v on v.id=a.vitrine_id
          where v.dono_id='user_pfpausa895' and a.status='ativo' and a.pago_ate is null), 'PF não voltou ao limite grátis';
  assert (select count(*)=1 from public.anuncios a join public.vitrines_lojas v on v.id=a.vitrine_id
          where v.dono_id='user_pfpausa895' and a.status='ativo' and a.pago_ate>now()), 'rotina pausou avulso pago';
  assert (select count(*)=9 from public.anuncios a join public.vitrines_lojas v on v.id=a.vitrine_id
          where v.dono_id='user_pfpausa895' and a.status='pausado'), 'anúncios excedentes não foram preservados';
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','user_pfpausa895',true);
do $$ declare vitrine uuid; begin
  select id into vitrine from public.vitrines_lojas where dono_id='user_pfpausa895';
  begin
    insert into public.loja_secoes(vitrine_id,nome) values(vitrine,'Seção após vencimento');
    raise exception 'PF criou seção depois do vencimento';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
