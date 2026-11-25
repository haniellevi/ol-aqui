-- Análise Item 22 A: exemplos sintéticos de comparação nominal insuficiente.
-- Não define composição nem modifica política comercial. Tudo volta no rollback.
begin;
select set_config('olaki.sistema','1',true);
insert into public.perfis(id,microrregiao_id,nome,cidade)
select 'user_matriz897',id,'Matriz sintética','Corrente' from public.microrregioes where slug='corrente-pi';
insert into public.voucher_campanhas(codigo,duracao_dias) values ('MATRIZ897',90),('OUTRO897',90);
set local role authenticated;
select set_config('request.jwt.claim.sub','user_matriz897',true);
select public.resgatar_voucher('MATRIZ897');
reset role;
insert into public.vitrines_lojas(dono_id,microrregiao_id,slug,nome,cidade,tipo,plano,plano_expira_em)
select id,microrregiao_id,'matriz897',nome,cidade,'loja','slim',
 public.robo_inicio('mes')+(now()-public.robo_inicio('mes'))/2+interval '30 days'
from public.perfis where id='user_matriz897';

-- Matriz proveniente das migrações e configurações, sem acesso remoto.
select jsonb_build_object('codigo',p.codigo,'anuncios',p.limite_anuncios,
 'radar',p.acesso_radar,'propostas',p.propostas_radar_mes,'aviso_imediato',p.aviso_radar_na_hora,
 'fachada',p.vitrine_foto_fachada,'secoes',p.vitrine_secoes_max,'fixados',p.vitrine_fixados_max,
 'creditos_destaque',coalesce((select jsonb_object_agg(c.tipo,c.quantidade_mes) from public.destaque_creditos_plano c where c.plano_codigo=p.codigo),'{}'),
 'melhorias',public.config('vitrine_ia.melhorias_mes',null,'{}')->p.codigo,
 'imagens',public.aki_limite_configurado('robo.lojista_creditos_'||p.codigo,1000),
 'periodo_pago_dias',p.periodo_dias) as matriz_local
from public.planos p where p.codigo in ('slim','full','promocional') order by p.codigo;

do $$ declare b public.planos; p public.planos; v public.vitrines_lojas; begin
 select * into b from public.planos where codigo='slim';
 select * into p from public.planos where codigo='promocional';
 select * into v from public.vitrines_lojas where dono_id='user_matriz897';
 assert b.limite_anuncios=10 and p.limite_anuncios is null;
 assert b.acesso_radar and p.acesso_radar and b.propostas_radar_mes is null and p.propostas_radar_mes is null;
 assert not b.aviso_radar_na_hora and p.aviso_radar_na_hora;
 assert b.vitrine_foto_fachada and p.vitrine_foto_fachada;
 assert b.vitrine_secoes_max=3 and p.vitrine_secoes_max=10 and b.vitrine_fixados_max=3 and p.vitrine_fixados_max=6;
 assert (select quantidade_mes=2 from public.destaque_creditos_plano where plano_codigo='slim' and tipo='subir');
 assert (select quantidade_mes=4 from public.destaque_creditos_plano where plano_codigo='promocional' and tipo='subir');
 assert (select restantes=3 from public.aki_creditos_imagem(v.dono_id));
 -- Sem consumo anterior, o saldo promocional é maior. Não se consome a concessão existente ao manter a base.
 update public.vitrines_lojas set plano_expira_em=now()-interval '1 second' where id=v.id;
 assert (select restantes=20 from public.aki_creditos_imagem(v.dono_id));
 update public.vitrines_lojas set plano_expira_em=v.plano_expira_em where id=v.id;
end $$;

-- Cenário legítimo: consumo de Full/cupom antes do início do Slim, no mesmo mês.
-- Um comparador nominal 20 >= 3 diria upgrade; o saldo real cai de 3 para 2.
insert into public.aki_imagens(id,usuario_id,tipo,gratuito,estado,url,criada_em)
select gen_random_uuid(),'user_matriz897','banner',false,'pronta','https://fixture.invalid/matriz-'||n,
 public.robo_inicio('mes')+(now()-public.robo_inicio('mes'))/4
from generate_series(1,18) n;
do $$ declare v public.vitrines_lojas; concessao jsonb; begin
 select * into v from public.vitrines_lojas where dono_id='user_matriz897';
 select to_jsonb(a) into concessao from public.voucher_atribuicoes a where dono_id=v.dono_id;
 assert (select restantes=3 from public.aki_creditos_imagem(v.dono_id)), 'janela Slim inclui uso anterior indevidamente';
 assert (public.plano_efetivo(v)).codigo='slim';
 update public.vitrines_lojas set plano_expira_em=now()-interval '1 second' where id=v.id;
 assert (select restantes=2 from public.aki_creditos_imagem(v.dono_id)), 'contraprova de perda de saldo deixou de ocorrer';
 update public.vitrines_lojas set plano_expira_em=v.plano_expira_em where id=v.id;
 assert (select count(*)=18 from public.aki_imagens where usuario_id=v.dono_id);
 assert (select to_jsonb(a)=concessao from public.voucher_atribuicoes a where dono_id=v.dono_id), 'comparação alterou atribuição existente';
end $$;

-- Personalização nominal já é suficiente para impedir equivalência de direitos.
savepoint antes_personalizacoes;
update public.planos set limite_anuncios=5,propostas_radar_mes=1,acesso_radar=false,
 aviso_radar_na_hora=false,vitrine_foto_fachada=false,vitrine_secoes_max=1,vitrine_fixados_max=1 where codigo='promocional';
update public.destaque_creditos_plano set quantidade_mes=1 where plano_codigo='promocional';
update public.configuracoes set valor='1' where chave='robo.lojista_creditos_promocional';
update public.configuracoes set valor=valor||'{"promocional":1}' where chave='vitrine_ia.melhorias_mes';
do $$ declare v public.vitrines_lojas; p public.planos; begin
 select * into v from public.vitrines_lojas where dono_id='user_matriz897';
 p:=public.plano_efetivo(v);
 assert p.codigo='slim' and p.limite_anuncios=10 and p.acesso_radar and p.propostas_radar_mes is null;
 assert p.vitrine_foto_fachada and p.vitrine_secoes_max=3 and p.vitrine_fixados_max=3;
 assert public.destaque_creditos_restantes(v.id,'subir')=2;
 assert (public.melhoria_ia_cota(v)->>'limite')::int=20;
 assert (select restantes=3 from public.aki_creditos_imagem(v.dono_id));
end $$;
rollback to savepoint antes_personalizacoes;
-- Mesmo Full nominalmente igual ao Promocional conserva sua janela paga e os direitos.
update public.vitrines_lojas set plano='full' where dono_id='user_matriz897';
do $$ begin
 assert (select (public.plano_efetivo(v)).codigo='full' from public.vitrines_lojas v where dono_id='user_matriz897');
 assert (select restantes=20 from public.aki_creditos_imagem('user_matriz897'));
end $$;
set local role authenticated;
do $$ begin
 begin
  perform public.resgatar_voucher('OUTRO897');
  raise exception 'consumiu cupom sem equivalência integral demonstrada';
 exception when invalid_parameter_value then assert sqlerrm like '%plano atual%'; end;
end $$;
reset role;
do $$ begin
 assert not exists(select 1 from public.voucher_atribuicoes a join public.voucher_campanhas c on c.id=a.campanha_id where c.codigo='OUTRO897');
 assert (select count(*)=1 from public.voucher_atribuicoes where dono_id='user_matriz897');
 assert not exists(select 1 from public.pagamentos where vitrine_id in(select id from public.vitrines_lojas where dono_id='user_matriz897'));
end $$;
rollback;
