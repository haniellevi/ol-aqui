-- Marcador mínimo de revogação: continua existindo quando o perfil é apagado.
-- Impede que JWT já emitido recupere acesso ou recrie o perfil após user.deleted.
create table public.contas_revogadas (
  usuario_id text primary key check (usuario_id ~ '^user_[A-Za-z0-9]+$'),
  revogada_em timestamptz not null default now()
);
alter table public.contas_revogadas enable row level security;
revoke all on public.contas_revogadas from public,anon,authenticated,service_role;
grant select,insert on public.contas_revogadas to service_role;

create or replace function public.usuario_id()
returns text language sql stable security definer set search_path=public,pg_temp
as $$
  select identidade.uid
  from (select nullif(auth.jwt()->>'sub','') as uid) identidade
  where identidade.uid is not null
    and not exists(select 1 from public.contas_revogadas r where r.usuario_id=identidade.uid)
$$;
