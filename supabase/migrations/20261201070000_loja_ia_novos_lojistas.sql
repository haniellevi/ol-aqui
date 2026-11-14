-- O cadastro assistido passa a atender todos os novos lojistas.
-- Mantém o contrato das RPCs existentes e as verificações de propriedade e suspensão.
create or replace function public.loja_ia_exigir_elegibilidade() returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare uid text := public.usuario_id(); v public.vitrines_lojas;
begin
  if uid is null then raise exception 'Faça login para continuar.' using errcode='28000'; end if;
  if not exists(select 1 from public.perfis where id=uid) then
    raise exception 'Complete seu perfil antes de criar uma loja.' using errcode='42501';
  end if;
  select * into v from public.vitrines_lojas where dono_id=uid;
  if v.status = 'suspensa' then raise exception 'Conta de vendedor suspensa.' using errcode='42501'; end if;
  if v.tipo = 'loja' then raise exception 'Esta conta já tem loja.' using errcode='42501', detail=v.id::text; end if;
  -- O worker, as imagens e o WhatsApp usam esta inscrição interna.
  -- A inscrição passa a ocorrer automaticamente na primeira ação de um novo lojista.
  insert into public.loja_ia_convites(usuario_id) values (uid) on conflict (usuario_id) do nothing;
  return uid;
end $$;

create or replace function public.loja_ia_piloto_autorizado() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists(select 1 from public.perfis where id=public.usuario_id())
    and not exists(select 1 from public.vitrines_lojas
      where dono_id=public.usuario_id() and (tipo='loja' or status='suspensa'))
$$;

revoke all on function public.loja_ia_exigir_elegibilidade() from public, anon, authenticated;
revoke all on function public.loja_ia_piloto_autorizado() from public, anon;
grant execute on function public.loja_ia_piloto_autorizado() to authenticated;

update public.home_blocos set titulo='LOJAS DESTAQUE DA REGIÃO'
where chave='lojas_regiao' and (titulo is null or titulo in ('Lojas de {lugar}', 'Lojas da região'));
