-- P5a (revisão): a proteção do super admin também vale dentro das funções do painel.
-- equipe_salvar e equipe_desativar rodam como dono do banco (security definer), então
-- current_user = postgres não prova que é o SQL Editor. Vale só: chave secreta (service_role)
-- ou sessão aberta direto no banco (session_user postgres) sem papel de usuário do site.
create or replace function public.proteger_super_admin()
returns trigger language plpgsql set search_path = public
as $$
declare banco boolean := coalesce(auth.role(), '') = 'service_role'
  or (coalesce(auth.role(), '') = '' and session_user in ('postgres', 'supabase_admin'));
begin
  if tg_op = 'INSERT' then
    if new.e_super_admin and not banco then new.e_super_admin := false; end if;
  elsif new.e_super_admin is distinct from old.e_super_admin and not banco then
    new.e_super_admin := old.e_super_admin;
  end if;
  if tg_op = 'UPDATE' and old.e_super_admin and not new.e_admin and not banco then
    raise exception 'Não é possível tirar o administrador de um super admin.' using errcode = '42501';
  end if;
  if not new.e_admin then new.e_super_admin := false; end if;
  return new;
end $$;
