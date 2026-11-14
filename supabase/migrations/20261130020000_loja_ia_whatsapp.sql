-- A autorização registra a confirmação vigente junto com o número.
alter table public.loja_ia_rascunhos add column whatsapp_verificado_autorizado_em timestamptz;
create function public.loja_ia_guardar_verificacao() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  select p.whatsapp_verificado_em into new.whatsapp_verificado_autorizado_em
  from public.perfis p where p.id=new.dono_id and p.whatsapp=new.whatsapp_autorizado and p.whatsapp_verificado_em is not null;
  if tg_op='UPDATE' and (
    (old.entrada->'consultarWhatsapp'='true'::jsonb and new.entrada->'consultarWhatsapp'='true'::jsonb)
    or (old.entrada->'avisarWhatsapp'='true'::jsonb and new.entrada->'avisarWhatsapp'='true'::jsonb)
  ) and (new.whatsapp_autorizado is distinct from old.whatsapp_autorizado
      or new.whatsapp_verificado_autorizado_em is distinct from old.whatsapp_verificado_autorizado_em) then
    raise exception 'O WhatsApp confirmado mudou. Retire as autorizações anteriores e escolha novamente.' using errcode='42501';
  end if;
  return new;
end $$;
revoke all on function public.loja_ia_guardar_verificacao() from public,anon,authenticated,service_role;
create trigger loja_ia_guardar_verificacao before insert or update of entrada,whatsapp_autorizado
on public.loja_ia_rascunhos for each row execute function public.loja_ia_guardar_verificacao();

-- Ticket opaco, de uso único, vinculado à tentativa e ao consentimento atual.
create table public.loja_ia_tickets (
  id uuid primary key default gen_random_uuid(),
  trabalho_id uuid not null references public.loja_ia_trabalhos(id) on delete cascade,
  tentativa uuid not null,
  expira_em timestamptz not null default now()+interval '60 seconds',
  usado_em timestamptz
);
alter table public.loja_ia_tickets enable row level security;
revoke all on public.loja_ia_tickets from public, anon, authenticated, service_role;

create function public.loja_ia_emitir_ticket(p_trabalho uuid,p_tentativa uuid) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare ticket uuid;
begin
  if coalesce(auth.role(),'') <> 'service_role' and session_user not in ('postgres','supabase_admin') then raise exception 'Acesso restrito.' using errcode='42501'; end if;
  if not exists(select 1 from public.loja_ia_trabalhos t join public.loja_ia_rascunhos r on r.id=t.rascunho_id join public.perfis p on p.id=r.dono_id
    where t.id=p_trabalho and t.tentativa=p_tentativa and t.fonte='whatsapp' and t.estado='reservado' and t.reserva_ate>now()
      and r.estado in ('processando','pronto') and r.entrada->'consultarWhatsapp'='true'::jsonb
      and p.whatsapp=r.whatsapp_autorizado and p.whatsapp_verificado_em is not null and p.whatsapp_verificado_em=r.whatsapp_verificado_autorizado_em
      and exists(select 1 from public.loja_ia_convites c where c.usuario_id=p.id)
      and not exists(select 1 from public.contas_revogadas c where c.usuario_id=p.id)
      and not exists(select 1 from public.contas_bloqueadas c where c.usuario_id=p.id)
      and not exists(select 1 from public.lixeira_contas c where c.usuario_id=p.id)) then return null; end if;
  delete from public.loja_ia_tickets where expira_em < now()-interval '1 day';
  insert into public.loja_ia_tickets(trabalho_id,tentativa) values(p_trabalho,p_tentativa) returning id into ticket;
  return ticket;
end $$;
create function public.loja_ia_resgatar_ticket(p_ticket uuid) returns text
language plpgsql security definer set search_path=public,pg_temp as $$
declare ticket public.loja_ia_tickets; numero text;
begin
  if coalesce(auth.role(),'') <> 'service_role' and session_user not in ('postgres','supabase_admin') then raise exception 'Acesso restrito.' using errcode='42501'; end if;
  select * into ticket from public.loja_ia_tickets where id=p_ticket and usado_em is null and expira_em>now() for update;
  if not found then return null; end if;
  update public.loja_ia_tickets set usado_em=now() where id=ticket.id;
  select p.whatsapp into numero from public.loja_ia_trabalhos t join public.loja_ia_rascunhos r on r.id=t.rascunho_id join public.perfis p on p.id=r.dono_id
    where t.id=ticket.trabalho_id and t.tentativa=ticket.tentativa and t.fonte='whatsapp' and t.estado='reservado' and t.reserva_ate>now()
      and r.estado in ('processando','pronto') and r.entrada->'consultarWhatsapp'='true'::jsonb
      and p.whatsapp=r.whatsapp_autorizado and p.whatsapp_verificado_em is not null and p.whatsapp_verificado_em=r.whatsapp_verificado_autorizado_em
      and exists(select 1 from public.loja_ia_convites c where c.usuario_id=p.id)
      and not exists(select 1 from public.contas_revogadas c where c.usuario_id=p.id)
      and not exists(select 1 from public.contas_bloqueadas c where c.usuario_id=p.id)
      and not exists(select 1 from public.lixeira_contas c where c.usuario_id=p.id)
    for share of t,r,p;
  return numero;
end $$;

create function public.loja_ia_enfileirar_avisos(p_limite integer default 10) returns integer
language plpgsql security definer set search_path=public,pg_temp as $$
declare r record; n integer := 0;
begin
  if coalesce(auth.role(),'') <> 'service_role' and session_user not in ('postgres','supabase_admin') then raise exception 'Acesso restrito.' using errcode='42501'; end if;
  for r in select d.id,d.dono_id from public.loja_ia_rascunhos d join public.perfis p on p.id=d.dono_id
    where d.estado='pronto' and d.entrada->'avisarWhatsapp'='true'::jsonb and d.whatsapp_autorizado=p.whatsapp and p.whatsapp_verificado_em is not null and p.whatsapp_verificado_em=d.whatsapp_verificado_autorizado_em
      and exists(select 1 from public.loja_ia_convites c where c.usuario_id=p.id)
      and not exists(select 1 from public.contas_revogadas c where c.usuario_id=p.id)
      and not exists(select 1 from public.contas_bloqueadas c where c.usuario_id=p.id)
      and not exists(select 1 from public.lixeira_contas c where c.usuario_id=p.id)
      and not exists(select 1 from public.whatsapp_fila f where f.chave='loja_ia_pronta:'||d.id::text)
    order by d.atualizado_em limit greatest(1,least(coalesce(p_limite,10),50)) for update of d skip locked
  loop
    perform 1 from public.perfis p where p.id=r.dono_id and p.whatsapp=(select whatsapp_autorizado from public.loja_ia_rascunhos where id=r.id) and p.whatsapp_verificado_em=(select whatsapp_verificado_autorizado_em from public.loja_ia_rascunhos where id=r.id) for share;
    if found and public.whatsapp_enfileirar(r.dono_id,'Seu rascunho de loja está pronto para revisão.','/minha-conta/lojas','loja_ia_pronta:'||r.id::text) then n:=n+1; end if;
  end loop;
  return n;
end $$;

alter function public.whatsapp_fila_confirmar_envio(uuid) rename to whatsapp_fila_confirmar_envio_anterior_ia;
revoke all on function public.whatsapp_fila_confirmar_envio_anterior_ia(uuid) from public,anon,authenticated,service_role;
create function public.whatsapp_fila_confirmar_envio(p_id uuid) returns text
language plpgsql security definer set search_path=public,pg_temp as $$
declare f public.whatsapp_fila;
begin
  if coalesce(auth.role(),'') <> 'service_role' and session_user not in ('postgres','supabase_admin') then raise exception 'Acesso restrito.' using errcode='42501'; end if;
  select * into f from public.whatsapp_fila where id=p_id and estado='enviando' for update;
  if not found then return 'ignorada'; end if;
  if f.chave like 'loja_ia_pronta:%' then
    if not exists(select 1 from public.loja_ia_rascunhos r join public.perfis p on p.id=r.dono_id
      where 'loja_ia_pronta:'||r.id::text=f.chave and r.dono_id=f.usuario_id and r.estado='pronto'
      and r.entrada->'avisarWhatsapp'='true'::jsonb and r.whatsapp_autorizado=f.numero and p.whatsapp=f.numero and p.whatsapp_verificado_em is not null and p.whatsapp_verificado_em=r.whatsapp_verificado_autorizado_em
      and exists(select 1 from public.loja_ia_convites c where c.usuario_id=p.id)
      and not exists(select 1 from public.contas_revogadas c where c.usuario_id=p.id)
      and not exists(select 1 from public.contas_bloqueadas c where c.usuario_id=p.id)
      and not exists(select 1 from public.lixeira_contas c where c.usuario_id=p.id)) then
      update public.whatsapp_fila set estado='cancelada',erro='autorizacao_alterada' where id=f.id;
      return 'cancelada';
    end if;
    return 'pode';
  end if;
  return public.whatsapp_fila_confirmar_envio_anterior_ia(p_id);
end $$;
revoke all on function public.loja_ia_emitir_ticket(uuid,uuid),public.loja_ia_resgatar_ticket(uuid),public.loja_ia_enfileirar_avisos(integer),public.whatsapp_fila_confirmar_envio(uuid) from public,anon,authenticated;
grant execute on function public.loja_ia_emitir_ticket(uuid,uuid),public.loja_ia_resgatar_ticket(uuid),public.loja_ia_enfileirar_avisos(integer),public.whatsapp_fila_confirmar_envio(uuid) to service_role;
