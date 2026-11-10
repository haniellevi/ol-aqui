-- Indicadores agregados do administrador. O histórico usa todos os registros disponíveis.
create function public.admin_estatisticas(
  p_periodo text default 'mes', p_referencia date default null, p_regiao uuid default null
)
returns table (
  anuncios_no_ar bigint,
  anuncios_publicados bigint,
  usuarios_cadastrados bigint,
  usuarios_novos bigint,
  clientes_radar_atendidos bigint,
  pedidos_com_proposta bigint,
  propostas_total bigint,
  propostas_com_valor bigint,
  propostas_centavos bigint,
  receita_centavos bigint,
  receita_planos_centavos bigint,
  receita_avulsos_centavos bigint,
  receita_destaques_centavos bigint,
  recebimentos_sem_origem bigint,
  recebimentos_sem_origem_centavos bigint,
  pedidos_criados bigint,
  contatos_solicitados bigint,
  primeiro_ano integer
)
language plpgsql stable security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  agora timestamptz := now();
  zona constant text := 'America/Fortaleza';
  referencia date := coalesce(p_referencia, (agora at time zone zona)::date);
  -- O limite é exclusivo e inclui os registros no instante da consulta.
  fim timestamptz := agora + interval '1 microsecond';
  inicio timestamptz;
  inicio_civil timestamp;
begin
  if public.e_admin() is not true then
    raise exception 'Só o administrador pode consultar as estatísticas.' using errcode = '42501';
  end if;
  if p_periodo is null or p_periodo not in ('mes', 'ano', 'historico') then
    raise exception 'Escolha mês, ano ou histórico.' using errcode = '22023';
  end if;

  if p_periodo <> 'historico' then
    if not isfinite(referencia) then
      raise exception 'Escolha uma data válida.' using errcode = '22023';
    end if;
    if p_periodo = 'mes' then
      inicio_civil := date_trunc('month', referencia::timestamp);
      fim := least(fim, (inicio_civil + interval '1 month') at time zone zona);
    else
      inicio_civil := date_trunc('year', referencia::timestamp);
      fim := least(fim, (inicio_civil + interval '1 year') at time zone zona);
    end if;
    inicio := inicio_civil at time zone zona;
  end if;

  return query
  with anuncios_ativos as (
    select count(*) as total
      from public.anuncios a
      join public.vitrines_lojas v on v.id = a.vitrine_id and v.status = 'ativa'
     where a.status = 'ativo'
       and (p_regiao is null or a.microrregiao_id = p_regiao)
  ), anuncios_periodo as (
    select count(*) as total
      from public.anuncios a
     where a.publicado_em < fim
       and (inicio is null or a.publicado_em >= inicio)
       and (p_regiao is null or a.microrregiao_id = p_regiao)
  ), usuarios as (
    select count(*) as cadastrados,
           count(*) filter (where (inicio is null or p.criado_em >= inicio) and p.criado_em < fim) as novos
      from public.perfis p
     where not p.e_admin
       and p.criado_em <= agora
       and (p_regiao is null or p.microrregiao_id = p_regiao)
       and not exists (select 1 from public.equipe e where e.usuario_id = p.id)
       and not exists (select 1 from public.contas_revogadas r where r.usuario_id = p.id)
  ), pedidos_validos as not materialized (
    select p.id, p.comprador_id, p.criado_em
      from public.radar_pedidos p
     where p.status not in ('em_analise', 'congelado')
       and p.fechado_motivo is distinct from 'moderacao'
       and (p_regiao is null or p.microrregiao_id = p_regiao)
  ), pedidos_periodo as (
    select count(*) as total
      from pedidos_validos p
     where p.criado_em < fim and (inicio is null or p.criado_em >= inicio)
  ), contatos_periodo as (
    select count(*) as total
      from public.radar_propostas rp
      join pedidos_validos p on p.id = rp.pedido_id
     where rp.status = 'ativa'
       and rp.escolhida_em < fim
       and (inicio is null or rp.escolhida_em >= inicio)
  ), radar as (
    select count(distinct p.comprador_id) as clientes,
           count(distinct p.id) as pedidos,
           count(*) as propostas,
           count(rp.preco_centavos) as com_valor,
           coalesce(sum(rp.preco_centavos), 0)::bigint as centavos
      from public.radar_propostas rp
      join pedidos_validos p on p.id = rp.pedido_id
     where rp.status = 'ativa'
       and rp.criado_em < fim
       and (inicio is null or rp.criado_em >= inicio)
  ), receita as (
    select coalesce(sum(r.valor_centavos) filter (where r.ambiente = 'producao'), 0)::bigint as total,
           coalesce(sum(r.valor_centavos) filter (where r.ambiente = 'producao' and r.tipo = 'assinatura'), 0)::bigint as planos,
           coalesce(sum(r.valor_centavos) filter (where r.ambiente = 'producao' and r.tipo = 'anuncio_avulso'), 0)::bigint as avulsos,
           coalesce(sum(r.valor_centavos) filter (where r.ambiente = 'producao' and r.tipo = 'destaque'), 0)::bigint as destaques,
           count(*) filter (where r.ambiente is null) as sem_origem,
           coalesce(sum(r.valor_centavos) filter (where r.ambiente is null), 0)::bigint as sem_origem_centavos
      from public.recebimentos_olaki(inicio, fim, p_regiao) r
  )
  select aa.total, ap.total, u.cadastrados, u.novos,
         ra.clientes, ra.pedidos, ra.propostas, ra.com_valor, ra.centavos,
         re.total, re.planos, re.avulsos, re.destaques, re.sem_origem, re.sem_origem_centavos,
         pp.total, cp.total,
         extract(year from least(
           agora,
           (select min(a.publicado_em) from public.anuncios a where isfinite(a.publicado_em)),
           (select min(p.criado_em) from public.perfis p where isfinite(p.criado_em)),
           (select min(rp.criado_em) from public.radar_propostas rp where isfinite(rp.criado_em)),
           (select min(p.pago_em) from public.pagamentos p where p.status = 'pago' and isfinite(p.pago_em))
         ) at time zone zona)::integer
    from anuncios_ativos aa
    cross join anuncios_periodo ap
    cross join usuarios u
    cross join pedidos_periodo pp
    cross join contatos_periodo cp
    cross join radar ra
    cross join receita re;
end $$;

revoke all on function public.admin_estatisticas(text, date, uuid) from public, anon, authenticated;
grant execute on function public.admin_estatisticas(text, date, uuid) to authenticated;
