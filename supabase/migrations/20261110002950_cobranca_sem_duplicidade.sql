-- Uma tentativa persistente antes do POST ao provedor. Timeout não libera uma nova cobrança.
create table public.asaas_criacoes (
  pagamento_id uuid primary key references public.pagamentos(id) on delete cascade,
  ambiente text not null check (ambiente in ('sandbox','producao')),
  criado_em timestamptz not null default now()
);
alter table public.asaas_criacoes enable row level security;
revoke all on public.asaas_criacoes from public, anon, authenticated;
grant select, insert, delete on public.asaas_criacoes to service_role;
create function public.reservar_criacao_asaas(p_pagamento_id uuid, p_ambiente text)
returns boolean language plpgsql security definer set search_path=public,extensions as $$
declare pg public.pagamentos; ambiente_anterior text; n integer;
begin
  select * into pg from public.pagamentos where id=p_pagamento_id for update;
  if pg.id is null or pg.status <> 'pendente' or pg.asaas_cobranca_id is not null then return false; end if;
  select ambiente into ambiente_anterior from public.asaas_criacoes where pagamento_id=pg.id;
  if ambiente_anterior is not null and ambiente_anterior <> p_ambiente then
    raise exception 'A cobrança pertence a outro ambiente.' using errcode='22023';
  end if;
  insert into public.asaas_criacoes(pagamento_id,ambiente) values(pg.id,p_ambiente) on conflict do nothing;
  get diagnostics n=row_count;
  return n=1;
end $$;
revoke all on function public.reservar_criacao_asaas(uuid,text) from public,anon,authenticated;
grant execute on function public.reservar_criacao_asaas(uuid,text) to service_role;

-- Confere o preço apresentado na mesma transação que cria/reaproveita o pedido.
-- Se o catálogo mudou, a exceção desfaz também os cancelamentos feitos por pedir_assinatura.
create function public.pedir_assinatura_site(p_plano text,p_meses integer,p_valor_esperado integer)
returns table(pagamento_id uuid,valor_centavos integer,regra text,inicio timestamptz,fim timestamptz,cancelados text[])
language plpgsql security definer set search_path=public,extensions as $$
declare r record;
begin
  if p_valor_esperado is null or p_valor_esperado <= 0 then raise exception 'Confira o valor do plano.' using errcode='22023'; end if;
  select * into r from public.pedir_assinatura(p_plano,p_meses);
  if r.valor_centavos is distinct from p_valor_esperado then
    raise exception 'O preço mudou. Atualize a página e confira o valor antes de pagar.' using errcode='22023';
  end if;
  return query select r.pagamento_id,r.valor_centavos,r.regra,r.inicio,r.fim,r.cancelados;
end $$;
revoke all on function public.pedir_assinatura_site(text,integer,integer) from public,anon;
grant execute on function public.pedir_assinatura_site(text,integer,integer) to authenticated;
