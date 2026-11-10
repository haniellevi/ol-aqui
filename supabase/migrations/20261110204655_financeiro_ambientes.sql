-- Só a equipe financeira lê a origem registrada antes da criação da cobrança.
grant select (pagamento_id, ambiente) on public.asaas_criacoes to authenticated;
create policy "equipe financeira ve ambiente" on public.asaas_criacoes for select to authenticated
  using ((select public.tem_papel('financeiro')));

create function public.admin_resumo_pagamentos_filtrado(
  p_status text default null, p_tipo text default null, p_regiao uuid default null,
  p_de date default null, p_ate date default null,
  p_ambiente text default null, p_loja uuid default null)
returns table (status text, tipo text, quantidade bigint, total_centavos bigint)
language plpgsql stable security definer
set search_path = public, extensions
as $$
begin
  if not public.tem_papel('financeiro') then
    raise exception 'Só a equipe OLAKI vê os pagamentos.' using errcode = '42501';
  end if;
  return query
  select p.status, p.tipo, count(*), coalesce(sum(p.valor_centavos), 0)::bigint
    from public.pagamentos p
    left join public.asaas_criacoes c on c.pagamento_id = p.id
   where (p_status is null or p.status = p_status)
     and (p_tipo is null or p.tipo = p_tipo)
     and (p_regiao is null or p.microrregiao_id = p_regiao)
     and (p_loja is null or p.vitrine_id = p_loja)
     and (p_ambiente is null or coalesce(c.ambiente, 'sem_origem') = p_ambiente)
     and (p_de is null or (coalesce(p.pago_em, p.criado_em) at time zone 'America/Fortaleza')::date >= p_de)
     and (p_ate is null or (coalesce(p.pago_em, p.criado_em) at time zone 'America/Fortaleza')::date <= p_ate)
   group by p.status, p.tipo
   order by p.status, p.tipo;
end $$;

revoke all on function public.admin_resumo_pagamentos_filtrado(text, text, uuid, date, date, text, uuid) from public, anon;
grant execute on function public.admin_resumo_pagamentos_filtrado(text, text, uuid, date, date, text, uuid) to authenticated;
