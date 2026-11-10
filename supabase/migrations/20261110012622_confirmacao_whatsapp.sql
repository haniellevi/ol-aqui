-- Códigos e limites compartilhados entre todas as instâncias da aplicação.
-- Preparação aditiva. A exigência de confirmação é ativada na migração seguinte.
alter table public.perfis add column whatsapp_origem text not null default 'clerk'
  check (whatsapp_origem in ('clerk', 'evolution'));

create table public.whatsapp_desafios (
  id uuid primary key,
  usuario_id text not null references public.perfis(id) on delete cascade,
  numero text not null check (numero ~ '^55[1-9][0-9]9[0-9]{8}$'),
  resumo text not null check (resumo ~ '^[a-f0-9]{64}$'),
  criado_em timestamptz not null default clock_timestamp(),
  expira_em timestamptz not null default (clock_timestamp() + interval '5 minutes'),
  erros smallint not null default 0 check (erros between 0 and 3),
  envio text not null default 'pendente' check (envio in ('pendente','enviado','incerto','falha')),
  consumido_em timestamptz,
  cancelado boolean not null default false
);
create index on public.whatsapp_desafios(usuario_id, criado_em desc);
create index on public.whatsapp_desafios(numero, criado_em desc);
create index on public.whatsapp_desafios(criado_em);
alter table public.whatsapp_desafios enable row level security;
revoke all on public.whatsapp_desafios from public, anon, authenticated;
grant select, insert, update, delete on public.whatsapp_desafios to service_role;

create function public.proteger_origem_whatsapp() returns trigger language plpgsql set search_path = public as $$
begin
  if current_user in ('postgres','supabase_admin','service_role') or auth.role() = 'service_role' then return new; end if;
  if tg_op = 'INSERT' then
    new.whatsapp := null; new.whatsapp_verificado_em := null; new.whatsapp_origem := 'clerk';
  else
    new.whatsapp := old.whatsapp; new.whatsapp_verificado_em := old.whatsapp_verificado_em;
    new.whatsapp_origem := old.whatsapp_origem;
  end if;
  return new;
end $$;
create trigger z_proteger_origem_whatsapp before insert or update on public.perfis
  for each row execute function public.proteger_origem_whatsapp();

create function public.reservar_codigo_whatsapp(p_usuario text, p_id uuid, p_numero text, p_resumo text)
returns text language plpgsql security definer set search_path = public as $$
begin
  -- Serializa as cotas, inclusive quando contas diferentes usam o mesmo número.
  perform pg_advisory_xact_lock(771192004);
  if p_numero !~ '^55[1-9][0-9]9[0-9]{8}$' or p_resumo !~ '^[a-f0-9]{64}$' or p_id is null then return 'invalido'; end if;
  perform 1 from perfis where id = p_usuario for update;
  if not found then return 'conta'; end if;
  -- Retenção máxima operacional: a limpeza ocorre no próximo envio solicitado.
  delete from whatsapp_desafios where criado_em < clock_timestamp() - interval '2 days';
  if exists(select 1 from whatsapp_desafios where (usuario_id = p_usuario or numero = p_numero)
    and criado_em > clock_timestamp() - interval '60 seconds') then return 'aguarde'; end if;
  if (select count(*) from whatsapp_desafios where usuario_id = p_usuario and criado_em > clock_timestamp() - interval '24 hours') >= 5
    or (select count(*) from whatsapp_desafios where numero = p_numero and criado_em > clock_timestamp() - interval '24 hours') >= 5
    or (select count(*) from whatsapp_desafios where criado_em > clock_timestamp() - interval '24 hours') >= 100 then return 'limite'; end if;
  update whatsapp_desafios set cancelado = true where usuario_id = p_usuario and consumido_em is null and not cancelado;
  insert into whatsapp_desafios(id,usuario_id,numero,resumo) values(p_id,p_usuario,p_numero,p_resumo);
  return 'reservado';
end $$;

create function public.confirmar_codigo_whatsapp(p_usuario text, p_id uuid, p_resumo text)
returns text language plpgsql security definer set search_path = public as $$
declare d public.whatsapp_desafios;
begin
  -- Mesma ordem de travas do envio. Perfil e consumo são confirmados numa transação.
  perform 1 from perfis where id = p_usuario for update;
  if not found then return 'invalido'; end if;
  select * into d from whatsapp_desafios where id = p_id and usuario_id = p_usuario for update;
  if not found or d.cancelado or d.consumido_em is not null or d.envio = 'falha' then return 'invalido'; end if;
  if d.erros >= 3 then return 'bloqueado'; end if;
  if d.expira_em <= clock_timestamp() then return 'expirado'; end if;
  if p_resumo is null or p_resumo is distinct from d.resumo then
    update whatsapp_desafios set erros = erros + 1 where id = d.id;
    return case when d.erros + 1 >= 3 then 'bloqueado' else 'incorreto' end;
  end if;
  update perfis set whatsapp = d.numero, whatsapp_verificado_em = clock_timestamp(), whatsapp_origem = 'evolution' where id = p_usuario;
  update whatsapp_desafios set consumido_em = clock_timestamp() where id = d.id;
  return 'confirmado';
end $$;
revoke all on function public.reservar_codigo_whatsapp(text,uuid,text,text), public.confirmar_codigo_whatsapp(text,uuid,text) from public, anon, authenticated;
grant execute on function public.reservar_codigo_whatsapp(text,uuid,text,text), public.confirmar_codigo_whatsapp(text,uuid,text) to service_role;
