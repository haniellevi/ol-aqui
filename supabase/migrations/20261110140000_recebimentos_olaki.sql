-- A reserva feita antes da criação no Asaas registra o ambiente da cobrança.
-- Registros anteriores sem reserva ficam sem classificação.
create function public.recebimentos_olaki(p_inicio timestamptz, p_fim timestamptz, p_regiao uuid)
returns table (pago_em timestamptz, tipo text, valor_centavos integer, ambiente text)
language sql stable
set search_path = public
as $$
  select p.pago_em, p.tipo, p.valor_centavos, c.ambiente
    from public.pagamentos p
    left join public.asaas_criacoes c on c.pagamento_id = p.id
   where p.status = 'pago'
     and (p_inicio is null or p.pago_em >= p_inicio)
     and p.pago_em < p_fim
     and (p_regiao is null or p.microrregiao_id = p_regiao)
$$;

revoke all on function public.recebimentos_olaki(timestamptz, timestamptz, uuid) from public, anon, authenticated;

-- Mantém a assinatura e o formato usados pela tela e pelo CSV de relatórios.
create or replace function public.relatorio_receita(p_de date default null, p_ate date default null, p_regiao uuid default null)
returns table (mes date, tipo text, quantidade bigint, total_centavos bigint)
language plpgsql stable security definer
set search_path = public, extensions
as $$
declare
  per record := public.relatorio_periodo(p_de, p_ate);
begin
  return query
  select date_trunc('month', r.pago_em at time zone 'America/Fortaleza')::date, r.tipo, count(*), sum(r.valor_centavos)
    from public.recebimentos_olaki(per.de, least(per.ate, now()), p_regiao) r
   where r.ambiente = 'producao'
   group by 1, 2
   order by 1, 2;
end $$;
