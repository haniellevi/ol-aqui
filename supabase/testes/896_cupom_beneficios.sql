-- Regressões Item 22 A, apenas dados sintéticos e rollback.
begin;
insert into public.perfis(id,microrregiao_id,nome,cidade)
select 'user_benef896',id,'Benefícios sintéticos','Corrente' from public.microrregioes where slug='corrente-pi';
insert into public.voucher_campanhas(codigo,duracao_dias) values ('BENEF896',30);
set local role authenticated;
select set_config('request.jwt.claim.sub','user_benef896',true);
select public.resgatar_voucher('BENEF896');
reset role;
insert into public.vitrines_lojas(dono_id,microrregiao_id,slug,nome,cidade,tipo,plano)
select id,microrregiao_id,'benef896',nome,cidade,'loja','loja_gratis' from public.perfis where id='user_benef896';
do $$ declare v public.vitrines_lojas; begin
 select * into v from public.vitrines_lojas where dono_id='user_benef896';
 assert public.destaque_creditos_restantes(v.id,'subir')=(select quantidade_mes from public.destaque_creditos_plano where plano_codigo='full' and tipo='subir'), 'cupom sem créditos Full de Subir';
 assert (select not gratuito and restantes=public.aki_limite_configurado('robo.lojista_creditos_full',1000) from public.aki_creditos_imagem(v.dono_id)), 'cupom sem imagens mensais Full';
 assert (public.melhoria_ia_cota(v)->>'limite')::int=(public.config('vitrine_ia.melhorias_mes',v.microrregiao_id,'{}')->>'full')::int, 'cupom sem melhorias Full';
 v.plano := 'full'; v.plano_expira_em := now()+interval '20 days';
 assert (public.plano_efetivo(v)).codigo='full', 'cupom rebaixou Full vigente';
 v.plano_expira_em := now()-interval '1 second';
 assert (public.plano_efetivo(v)).codigo='promocional', 'cupom não voltou após fim pago';
 assert (public.plano_efetivo_em(v,now()+interval '31 days')).codigo='loja_gratis', 'cupom não expirou';
end $$;
-- Uso anterior à correção (gratuito=true) também desconta da janela promocional.
insert into public.aki_imagens(id,usuario_id,tipo,gratuito,estado,url,criada_em)
values(gen_random_uuid(),'user_benef896','banner',true,'pronta','https://fixture.invalid/sintetico.webp',clock_timestamp());
do $$ declare v public.vitrines_lojas; begin
 select * into v from public.vitrines_lojas where dono_id='user_benef896';
 assert (select restantes=public.aki_limite_configurado('robo.lojista_creditos_full',1000)-1 and not gratuito
 from public.aki_creditos_imagem(v.dono_id)), 'migração apagou uso prévio do cupom';
end $$;
-- Alterar limite mantém os registros de uso; reduzir a zero não os apaga.
update public.configuracoes set valor='1' where chave='robo.lojista_creditos_promocional';
do $$ begin
 assert (select restantes=0 from public.aki_creditos_imagem('user_benef896')), 'limite não configurável';
end $$;
update public.configuracoes set valor='7' where chave='robo.lojista_creditos_promocional';
do $$ begin
 assert (select restantes=6 from public.aki_creditos_imagem('user_benef896')), 'edição zerou consumo';
end $$;
select set_config('olaki.sistema','1',true);
update public.vitrines_lojas set plano='full',plano_expira_em=now()+interval '20 days' where dono_id='user_benef896';
do $$ begin
 assert (select restantes=public.aki_limite_configurado('robo.lojista_creditos_full',1000)-1
 from public.aki_creditos_imagem('user_benef896')), 'Full recuperado esqueceu uso durante cupom antigo';
end $$;
insert into public.voucher_campanhas(codigo,duracao_dias) values ('NOVO896',30);
set local role authenticated;
do $$ begin
 begin
 perform public.resgatar_voucher('NOVO896');
 raise exception 'consumiu cupom durante Full pago';
 exception when invalid_parameter_value then assert sqlerrm like '%plano atual%'; end;
end $$;
reset role;
do $$ begin
 assert not exists(select 1 from public.voucher_atribuicoes a join public.voucher_campanhas c on c.id=a.campanha_id where c.codigo='NOVO896'), 'rejeição consumiu cupom';
 assert not exists(select 1 from public.pagamentos where vitrine_id in(select id from public.vitrines_lojas where dono_id='user_benef896')), 'resgate gerou cobrança';
end $$;
-- ACL: clientes e admins comuns não podem alterar benefícios promocionais.
insert into public.perfis(id,microrregiao_id,nome,cidade,e_admin,e_super_admin)
select 'user_admin896',id,'Admin sintético','Corrente',true,false from public.microrregioes where slug='corrente-pi';
set local role authenticated;
select set_config('request.jwt.claim.sub','user_admin896',true);
do $$ begin
 begin
   update public.configuracoes set valor='9' where chave='robo.lojista_creditos_promocional';
   raise exception 'admin alterou imagens promocionais';
 exception when insufficient_privilege then null; end;
 begin
   update public.configuracoes set valor=valor || '{"promocional":9}' where chave='vitrine_ia.melhorias_mes';
   raise exception 'admin alterou melhorias promocionais';
 exception when insufficient_privilege then null; end;
 update public.destaque_creditos_plano set quantidade_mes=9 where plano_codigo='promocional';
 assert not found, 'admin alterou créditos promocionais';
end $$;
reset role;
update public.perfis set e_super_admin=true where id='user_admin896';
set local role authenticated;
do $$ begin
 update public.configuracoes set valor='9' where chave='robo.lojista_creditos_promocional';
 assert found, 'master não configurou imagens';
 update public.configuracoes set valor=valor || '{"promocional":9}' where chave='vitrine_ia.melhorias_mes';
 assert found, 'master não configurou melhorias';
 update public.destaque_creditos_plano set quantidade_mes=9 where plano_codigo='promocional';
 assert found, 'master não configurou créditos';
end $$;
reset role;
rollback;
