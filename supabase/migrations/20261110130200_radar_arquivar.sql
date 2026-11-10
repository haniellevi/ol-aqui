-- A lista pessoal e o encerramento do pedido têm estados separados.
alter table public.radar_pedidos
  add column arquivado_em timestamptz,
  add constraint radar_pedidos_arquivo_fechado
    check (arquivado_em is null or status <> 'aberto');

alter table public.radar_pedidos
  drop constraint radar_pedidos_fechado_motivo_check,
  add constraint radar_pedidos_fechado_motivo_check
    check (fechado_motivo in ('resolvido', 'cancelado', 'prazo', 'moderacao', 'arquivado'));

create function public.proteger_arquivo_radar()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('postgres', 'supabase_admin', 'service_role') then
    if tg_op = 'INSERT' then
      new.arquivado_em := null;
    else
      new.arquivado_em := old.arquivado_em;
    end if;
  end if;

  -- Se a moderação devolver um pedido ao Radar, ele volta à lista de pedidos.
  if new.status = 'aberto' then
    new.arquivado_em := null;
  end if;
  return new;
end $$;
create trigger z_proteger_arquivo_radar before insert or update on public.radar_pedidos
  for each row execute function public.proteger_arquivo_radar();

create function public.arquivar_pedido_radar(p_pedido uuid, p_arquivar boolean)
returns boolean
language plpgsql security definer
set search_path = public
as $$
declare
  uid text := public.usuario_id();
  pedido public.radar_pedidos;
begin
  if uid is null then
    raise exception 'Entre na sua conta para continuar.' using errcode = '28000';
  end if;
  if p_arquivar is null then
    raise exception 'Escolha arquivar ou retirar do arquivo.' using errcode = '22023';
  end if;

  -- Propor e encerrar também travam este pedido, inclusive em envios simultâneos.
  select * into pedido from public.radar_pedidos p
   where p.id = p_pedido and p.comprador_id = uid for update;
  if not found then
    raise exception 'Pedido não encontrado.' using errcode = '42501';
  end if;
  if (pedido.arquivado_em is not null) = p_arquivar then
    return p_arquivar;
  end if;
  if pedido.status in ('em_analise', 'congelado') then
    raise exception 'Este pedido está sob revisão da equipe.' using errcode = 'P0002';
  end if;

  if p_arquivar and pedido.status = 'aberto' then
    update public.radar_pedidos
       set arquivado_em = now(), status = 'encerrado', fechado_em = now(),
           fechado_motivo = case when pedido.expira_em <= now()
                                       or (pedido.modo_contato = 'propostas_prazo' and pedido.propostas_ate <= now())
                                 then 'prazo' else 'arquivado' end
     where id = pedido.id;
  else
    update public.radar_pedidos
       set arquivado_em = case when p_arquivar then now() end
     where id = pedido.id;
  end if;

  return p_arquivar;
end $$;

-- Sobrecarga com filtro aplicado antes do limite. O RPC anterior mantém o contrato.
create function public.meus_pedidos_radar(p_arquivados boolean)
returns table (
  id uuid, titulo text, cidade text, categoria_nome text, status text, situacao text, modo_contato text,
  propostas_ate timestamptz, expira_em timestamptz, criado_em timestamptz,
  total_propostas integer, menor_preco_centavos bigint, fechado_motivo text, moderado_motivo text)
language sql stable security definer
set search_path = public
as $$
  select p.id, p.titulo, p.cidade, c.nome, p.status::text,
         case when p.status = 'em_analise' then 'em_analise'
              when p.status <> 'aberto' or p.expira_em <= now() then 'fechado'
              when p.modo_contato = 'propostas_prazo' and p.propostas_ate <= now() then 'prazo_acabou'
              else 'aberto' end,
         p.modo_contato, p.propostas_ate, p.expira_em, p.criado_em,
         ofertas.total, ofertas.menor, p.fechado_motivo, p.moderado_motivo
    from public.radar_pedidos p
    left join public.categorias c on c.id = p.categoria_id
    cross join lateral (
      select count(*)::int as total, min(rp.preco_centavos) as menor
        from public.radar_propostas rp where rp.pedido_id = p.id and rp.status = 'ativa'
    ) ofertas
   where p.comprador_id = public.usuario_id()
     and (p.arquivado_em is not null) = p_arquivados
   order by p.arquivado_em desc nulls last, p.criado_em desc, p.id desc
   limit 50
$$;

create function public.radar_pedido_esta_arquivado(p_pedido uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.radar_pedidos p
     where p.id = p_pedido and p.comprador_id = public.usuario_id() and p.arquivado_em is not null
  )
$$;

revoke all on function public.proteger_arquivo_radar(),
  public.arquivar_pedido_radar(uuid, boolean), public.meus_pedidos_radar(boolean),
  public.radar_pedido_esta_arquivado(uuid) from public, anon, authenticated;
grant execute on function public.arquivar_pedido_radar(uuid, boolean), public.meus_pedidos_radar(boolean),
  public.radar_pedido_esta_arquivado(uuid) to authenticated;
