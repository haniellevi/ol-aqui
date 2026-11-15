-- Reserva uma única tentativa de envio de cada convite, com limite por loja.
alter table public.convites_gerente_loja add column envio_tentado_em timestamptz;
create table public.convite_gerente_envios (
  id uuid primary key default gen_random_uuid(),
  vitrine_id uuid not null references public.vitrines_lojas(id) on delete cascade,
  criado_em timestamptz not null default now()
);
create index convite_gerente_envios_limite_idx on public.convite_gerente_envios(vitrine_id,criado_em);
alter table public.convite_gerente_envios enable row level security;
revoke all on public.convite_gerente_envios from public,anon,authenticated,service_role;
create function public.convite_gerente_reservar_envio(p_loja uuid,p_token uuid,p_whatsapp text)
returns boolean language plpgsql security definer set search_path='' as $$
declare convite public.convites_gerente_loja;
begin
  perform 1 from public.vitrines_lojas v where v.id=p_loja and v.dono_id=public.usuario_id() and v.tipo='loja' and v.status='ativa' for update;
  if not found then return false; end if;
  select c.* into convite from public.convites_gerente_loja c
  where c.vitrine_id=p_loja and c.token_hash=sha256(convert_to(p_token::text,'UTF8'))
    and c.telefone_hash=sha256(convert_to(p_token::text || ':' || p_whatsapp,'UTF8'))
    and c.revogado_em is null and c.aceito_por is null and c.expira_em>now() for update;
  if convite.id is null or convite.envio_tentado_em is not null then return false; end if;
  if (select count(*) from public.convite_gerente_envios e where e.vitrine_id=p_loja and e.criado_em>now()-interval '1 day')>=10 then return false; end if;
  update public.convites_gerente_loja set envio_tentado_em=now() where id=convite.id;
  insert into public.convite_gerente_envios(vitrine_id) values(p_loja);
  return true;
end $$;
revoke all on function public.convite_gerente_reservar_envio(uuid,uuid,text) from public,anon;
grant execute on function public.convite_gerente_reservar_envio(uuid,uuid,text) to authenticated;
