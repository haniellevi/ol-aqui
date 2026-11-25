-- Somente leitura agregada administrativa. Sem coleta, purga ou novas tabelas.
create function public.admin_lancamento(p_de date,p_ate date)
returns jsonb language plpgsql stable security definer set search_path='' set timezone='America/Fortaleza' as $$
declare inicio timestamptz; fim timestamptz; resultado jsonb;
begin
 if not public.e_admin() then raise exception 'Acesso restrito.' using errcode='42501'; end if;
 if p_de is null or p_ate is null or not isfinite(p_de) or not isfinite(p_ate) or p_de>p_ate or p_ate-p_de>366 then
   raise exception 'Confira o período (até 367 dias).' using errcode='22023'; end if;
 inicio:=p_de::timestamp at time zone 'America/Fortaleza';
 fim:=(p_ate+1)::timestamp at time zone 'America/Fortaleza';
 with lojas as (
   select v.id,v.criado_em,exists(select 1 from public.anuncios a where a.vitrine_id=v.id and a.status='ativo') as oferta
   from public.vitrines_lojas v where v.tipo='loja' and v.status='ativa'
 ), maduras as (
   select * from lojas where criado_em>=inicio and criado_em<fim and criado_em<=now()-interval '48 hours'
 ), pedidos as (
   select p.id,exists(select 1 from public.radar_propostas r where r.pedido_id=p.id and r.status='ativa') as proposta
   from public.radar_pedidos p where p.criado_em>=inicio and p.criado_em<fim
     and p.criado_em<=now()-interval '24 hours' and p.status in ('aberto','atendido','encerrado')
 ), demanda as (
   select coalesce(c.nome,'Sem categoria') as categoria,coalesce(m.nome,'Sem região') as regiao,
     sum(b.vezes) as buscas,coalesce(sum(b.vezes) filter(where b.faixa='zero'),0) as sem_resultado
   from public.buscas_faixas_dia b left join public.categorias c on c.id=b.categoria_id
   left join public.microrregioes m on m.id=b.microrregiao_id
   where b.dia between p_de and p_ate and b.coorte='consentida_v1'
   group by b.categoria_id,b.microrregiao_id,c.nome,m.nome
   having coalesce(sum(b.vezes) filter(where b.faixa='zero'),0)>=5
     and (coalesce(sum(b.vezes) filter(where b.faixa<>'zero'),0)=0 or coalesce(sum(b.vezes) filter(where b.faixa<>'zero'),0)>=5)
 ), catalogo as (
   select coalesce(c.nome,'Sem categoria') as categoria,coalesce(cid.nome,'Cidade fora do catálogo') as cidade,count(*) as anuncios
   from public.anuncios a join public.vitrines_lojas v on v.id=a.vitrine_id and v.status='ativa'
   left join public.categorias c on c.id=a.categoria_id
   left join lateral (select distinct ci.nome from public.cidades ci where ci.nome=a.cidade and ci.microrregiao_id=a.microrregiao_id and ci.ativa) cid on true where a.status='ativo'
   group by c.id,c.nome,cid.nome
 ), origens as (
   select case when v.origem in ('instagram','whatsapp','google','radio','qr_loja','facebook','panfleto','indicacao','outro_site','direto') then v.origem else 'direto' end as origem,count(*) as pageviews from public.visitas v
   where v.coorte='consentida_v1' and v.criado_em>=inicio and v.criado_em<fim
   group by 1
 )
 select jsonb_build_object(
   'de',p_de,'ate',p_ate,'gerado_em',now(),
   'corte',(select mm.inicio from public.metricas_marcos mm where codigo='consentida_v1'),
   'medicao',public.admin_medicao_resumo(p_de,p_ate),
   'ultima_visita',(select max(criado_em) from public.visitas where coorte='consentida_v1'),
   'oferta',jsonb_build_object('lojas',(select count(*) from lojas),'sem_anuncios',(select count(*) from lojas where not oferta),
     'anuncios',(select coalesce(sum(anuncios),0) from catalogo)),
   'ativacao',jsonb_build_object('maduras',(select count(*) from maduras),'com_oferta',(select count(*) from maduras where oferta)),
   'radar',jsonb_build_object('maduros',(select count(*) from pedidos),'com_proposta',(select count(*) from pedidos where proposta),
     'sem_proposta',(select count(*) from pedidos where not proposta)),
   'negocio',jsonb_build_object(
     'publicados',(select count(*) from public.anuncios where publicado_em>=inicio and publicado_em<fim),
     'vendas_declaradas',(select count(*) from public.anuncios where vendido_em>=inicio and vendido_em<fim and vendido_pelo_olaki is true),
     'contatos',(select coalesce(sum(cliques_whatsapp),0) from public.anuncios_numeros_dia where dia between p_de and p_ate),
     'cupons',(select count(*) from public.voucher_atribuicoes where resgatado_em>=inicio and resgatado_em<fim),
     'receita_centavos',(select coalesce(sum(valor_centavos),0) from public.recebimentos_olaki(inicio,fim,null) where ambiente='producao')),
   'demanda',coalesce((select jsonb_agg(to_jsonb(d)) from (select * from demanda order by sem_resultado desc,categoria,regiao limit 20) d),'[]'::jsonb),
   'catalogo',coalesce((select jsonb_agg(to_jsonb(c)) from (select * from catalogo order by anuncios,categoria,cidade limit 20) c),'[]'::jsonb),
   'origens',coalesce((select jsonb_agg(to_jsonb(o)) from (select * from origens order by pageviews desc,origem) o),'[]'::jsonb)
 ) into resultado;
 return resultado;
end $$;
revoke all on function public.admin_lancamento(date,date) from public,anon;
grant execute on function public.admin_lancamento(date,date) to authenticated;
