-- Exclusão reversível. Fotos, cobranças e histórico permanecem vinculados ao anúncio.
alter table public.anuncios
  add column excluido_em timestamptz,
  add column status_antes_exclusao public.status_anuncio,
  add constraint anuncios_lixeira_coerente check (
    (status = 'excluido' and excluido_em is not null and status_antes_exclusao is not null and status_antes_exclusao <> 'excluido')
    or (status <> 'excluido' and excluido_em is null and status_antes_exclusao is null)
  );
grant select (excluido_em, status_antes_exclusao) on public.anuncios to authenticated;
-- O cliente não apaga definitivamente. Rotinas autorizadas de exclusão de conta continuam funcionando.
revoke delete on public.anuncios from authenticated;

create or replace function public.proteger_lixeira_anuncio()
returns trigger language plpgsql set search_path = public
as $$
declare interna boolean := coalesce(current_setting('olaki.lixeira', true), '') = '1';
begin
  if tg_op = 'INSERT' then
    if new.status = 'excluido' or new.excluido_em is not null or new.status_antes_exclusao is not null then
      raise exception 'Crie o anúncio antes de usar a lixeira.' using errcode = '42501';
    end if;
    return new;
  end if;
  if not interna and (
    new.excluido_em is distinct from old.excluido_em
    or new.status_antes_exclusao is distinct from old.status_antes_exclusao
    or (new.status is distinct from old.status and (old.status = 'excluido' or new.status = 'excluido'))
  ) then
    raise exception 'Use as ações de lixeira e restauração em Meus anúncios.' using errcode = '42501';
  end if;
  if old.status = 'excluido' and not interna and not public.acesso_sistema() then
    raise exception 'Restaure o anúncio antes de editar.' using errcode = '42501';
  end if;
  -- Executa após proteger_anuncios_v3, que limpa a venda quando o status muda.
  if old.status = 'vendido' and new.status = 'excluido' then
    new.vendido_em := old.vendido_em;
    new.vendido_pelo_olaki := old.vendido_pelo_olaki;
  end if;
  return new;
end $$;
create trigger z_proteger_lixeira before insert or update on public.anuncios
  for each row execute function public.proteger_lixeira_anuncio();

create or replace function public.mover_anuncio_lixeira(p_anuncio_id uuid)
returns text language plpgsql security definer set search_path = public
as $$
declare a public.anuncios; anterior text := current_setting('olaki.lixeira', true);
begin
  if public.usuario_id() is null then raise exception 'Faça login para continuar.' using errcode = '28000'; end if;
  select * into a from public.anuncios where id = p_anuncio_id for update;
  if a.id is null or not exists(select 1 from public.vitrines_lojas where id = a.vitrine_id and dono_id = public.usuario_id()) then
    raise exception 'Anúncio não encontrado.' using errcode = '42501';
  end if;
  if a.status = 'excluido' then return 'excluido'; end if;
  perform set_config('olaki.lixeira', '1', true);
  update public.anuncios set status = 'excluido', excluido_em = now(), status_antes_exclusao = a.status where id = a.id;
  perform set_config('olaki.lixeira', coalesce(anterior, ''), true);
  return 'excluido';
end $$;
revoke all on function public.mover_anuncio_lixeira(uuid) from public, anon;
grant execute on function public.mover_anuncio_lixeira(uuid) to authenticated;

create or replace function public.restaurar_anuncio(p_anuncio_id uuid)
returns text language plpgsql security definer set search_path = public
as $$
declare
  a public.anuncios;
  destino public.status_anuncio;
  anterior text := current_setting('olaki.lixeira', true);
  sistema_anterior text := current_setting('olaki.sistema', true);
  maximo integer;
begin
  if public.usuario_id() is null then raise exception 'Faça login para continuar.' using errcode = '28000'; end if;
  select * into a from public.anuncios where id = p_anuncio_id for update;
  if a.id is null or not exists(select 1 from public.vitrines_lojas where id = a.vitrine_id and dono_id = public.usuario_id()) then
    raise exception 'Anúncio não encontrado.' using errcode = '42501';
  end if;
  if a.status <> 'excluido' then return a.status::text; end if;
  destino := case when a.status_antes_exclusao in ('rascunho', 'vendido', 'em_analise', 'congelado')
    then a.status_antes_exclusao else 'pausado'::public.status_anuncio end;
  if destino = 'rascunho' then
    perform 1 from public.vitrines_lojas where id = a.vitrine_id for update;
    maximo := public.numero_ou_nulo(public.config('anuncio.rascunhos_max', a.microrregiao_id, 'null'))::int;
    if maximo is not null and (select count(*) from public.anuncios where vitrine_id = a.vitrine_id and status = 'rascunho') >= maximo then
      raise exception 'Você atingiu o limite de rascunhos. Conclua um anúncio antes de restaurar este.' using errcode = 'P0001';
    end if;
  end if;
  perform set_config('olaki.lixeira', '1', true);
  -- Preserva venda/moderação anterior mesmo que a categoria tenha sido desativada.
  -- O destino nunca é ativo; voltar à venda exige publicar_anuncio e suas validações.
  perform set_config('olaki.sistema', '1', true);
  update public.anuncios set status = destino, excluido_em = null, status_antes_exclusao = null where id = a.id;
  perform set_config('olaki.sistema', coalesce(sistema_anterior, ''), true);
  perform set_config('olaki.lixeira', coalesce(anterior, ''), true);
  return destino::text;
end $$;
revoke all on function public.restaurar_anuncio(uuid) from public, anon;
grant execute on function public.restaurar_anuncio(uuid) to authenticated;

create or replace function public.limitar_rascunhos()
returns trigger language plpgsql
set search_path = public
as $$
declare
  maximo integer;
  total  integer;
begin
  if public.acesso_sistema() or new.status <> 'rascunho' then
    return new;
  end if;
  maximo := public.numero_ou_nulo(public.config('anuncio.rascunhos_max',
                (select v.microrregiao_id from public.vitrines_lojas v where v.id = new.vitrine_id), 'null'))::int;
  if maximo is null then return new; end if;
  -- Serializa criação e restauração de rascunhos da mesma vitrine.
  perform 1 from public.vitrines_lojas where id = new.vitrine_id for update;
  select count(*) into total from public.anuncios a where a.vitrine_id = new.vitrine_id and a.status = 'rascunho';
  if total >= maximo then
    raise exception using errcode = 'P0001',
      message = format('Você já tem %s rascunhos guardados. Termine ou mova um para a lixeira antes de começar outro.', total);
  end if;
  return new;
end $$;
