-- Objetos sempre privados. Apenas versões normalizadas podem ser vinculadas.
-- O simulador de Postgres não instala Storage; no Supabase o bucket é privado.
do $$ begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('loja-ia', 'loja-ia', false, 20971520, array['image/jpeg','image/png','image/webp'])
    on conflict (id) do update set public=false, file_size_limit=20971520, allowed_mime_types=excluded.allowed_mime_types;
  end if;
end $$;

create table public.loja_ia_imagens (
  id uuid primary key default gen_random_uuid(),
  rascunho_id uuid not null references public.loja_ia_rascunhos(id) on delete cascade,
  caminho text not null unique,
  tipo text not null check (tipo in ('logo','foto','capa')),
  origem text not null check (origem in ('enviada','merc')),
  estado text not null check (estado in ('upload','preparando','pronta','descarte','apagada')),
  mime text not null,
  tamanho bigint not null check (tamanho > 0 and tamanho <= 20971520),
  sha256 text,
  criado_em timestamptz not null default now(),
  constraint loja_ia_hash check (estado <> 'pronta' or (sha256 ~ '^[0-9a-f]{64}$' and mime='image/webp'))
);
alter table public.loja_ia_imagens enable row level security;
revoke all on public.loja_ia_imagens from public, anon, authenticated;

create function public.loja_ia_reservar_imagem(p_rascunho uuid, p_tipo text, p_mime text, p_tamanho bigint)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare uid text := public.loja_ia_exigir_elegibilidade(); r public.loja_ia_rascunhos; i uuid := gen_random_uuid(); caminho text;
begin
  select * into r from public.loja_ia_rascunhos where id=p_rascunho and dono_id=uid for update;
  if not found or r.estado <> 'coleta' then raise exception 'Rascunho não encontrado.' using errcode='42501'; end if;
  if p_tipo not in ('logo','foto') or p_mime not in ('image/jpeg','image/png','image/webp') or p_tamanho is null or p_tamanho < 1 or p_tamanho > 20971520 then raise exception 'Arquivo inválido.' using errcode='22023'; end if;
  if (select count(*) from public.loja_ia_imagens where rascunho_id=r.id and estado in ('upload','pronta')) >= 24 then raise exception 'Limite de imagens atingido.' using errcode='22023'; end if;
  caminho := r.id::text || '/upload/' || i::text;
  insert into public.loja_ia_imagens(id,rascunho_id,caminho,tipo,origem,estado,mime,tamanho) values(i,r.id,caminho,p_tipo,'enviada','upload',p_mime,p_tamanho);
  return jsonb_build_object('id',i,'caminho',caminho);
end $$;

create function public.loja_ia_obter_imagem_propria(p_rascunho uuid, p_imagem uuid)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
  select jsonb_build_object('id',i.id,'caminho',i.caminho,'mime',i.mime,'tamanho',i.tamanho,'tipo',i.tipo,'estado',i.estado)
  from public.loja_ia_imagens i join public.loja_ia_rascunhos r on r.id=i.rascunho_id
  where i.id=p_imagem and r.id=p_rascunho and r.dono_id=public.usuario_id() and r.estado <> 'publicado' and i.estado <> 'descarte'
$$;

-- Registra o destino antes do upload para permitir limpeza após falhas.
create function public.loja_ia_reservar_normalizada(p_original uuid, p_novo uuid, p_caminho text, p_tamanho bigint)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare i public.loja_ia_imagens;
begin
  select * into i from public.loja_ia_imagens where id=p_original for update;
  if not found or i.estado <> 'upload' or p_caminho <> i.rascunho_id::text || '/pronta/' || p_novo::text || '.webp' or p_tamanho < 1 or p_tamanho > 20971520 then raise exception 'Imagem inválida.' using errcode='22023'; end if;
  insert into public.loja_ia_imagens(id,rascunho_id,caminho,tipo,origem,estado,mime,tamanho) values(p_novo,i.rascunho_id,p_caminho,i.tipo,i.origem,'preparando','image/webp',p_tamanho);
end $$;
create function public.loja_ia_finalizar_imagem(p_original uuid, p_novo uuid, p_caminho text, p_sha256 text, p_tamanho bigint)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare i public.loja_ia_imagens; n public.loja_ia_imagens;
begin
  select * into i from public.loja_ia_imagens where id=p_original for update;
  select * into n from public.loja_ia_imagens where id=p_novo for update;
  if i.estado is distinct from 'upload' or n.estado is distinct from 'preparando' or n.rascunho_id is distinct from i.rascunho_id or n.caminho is distinct from p_caminho or n.tamanho is distinct from p_tamanho or p_sha256 !~ '^[0-9a-f]{64}$' then raise exception 'Imagem inválida.' using errcode='22023'; end if;
  update public.loja_ia_imagens set estado='pronta', sha256=p_sha256 where id=n.id;
  update public.loja_ia_imagens set estado='descarte' where id=i.id;
  return p_novo;
end $$;

create table public.loja_ia_imagens_vinculos (
  imagem_id uuid not null references public.loja_ia_imagens(id) on delete cascade,
  vitrine_id uuid not null references public.vitrines_lojas(id) on delete cascade,
  uso text not null check (uso in ('logo','capa')),
  primary key (imagem_id,vitrine_id,uso)
);
alter table public.loja_ia_imagens_vinculos enable row level security;
revoke all on public.loja_ia_imagens_vinculos from public, anon, authenticated;

-- Executada pela publicação na mesma transação antes de gravar a URL.
create function public.loja_ia_vincular_imagem(p_rascunho uuid, p_imagem uuid, p_vitrine uuid, p_uso text)
returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare i public.loja_ia_imagens; r public.loja_ia_rascunhos;
begin
  select * into r from public.loja_ia_rascunhos where id=p_rascunho and dono_id=public.usuario_id() for update;
  if not found or p_uso not in ('logo','capa') or not exists(select 1 from public.vitrines_lojas v where v.id=p_vitrine and v.dono_id=r.dono_id) then raise exception 'Imagem não autorizada.' using errcode='42501'; end if;
  select * into i from public.loja_ia_imagens where id=p_imagem and rascunho_id=r.id for update;
  if not found or i.estado <> 'pronta' then raise exception 'Imagem indisponível.' using errcode='42501'; end if;
  insert into public.loja_ia_imagens_vinculos(imagem_id,vitrine_id,uso) values(i.id,p_vitrine,p_uso) on conflict do nothing;
  return '/api/loja/imagem/' || i.id::text;
end $$;

-- A rota usa esta consulta com service_role; nenhuma chave do Storage é pública.
create function public.loja_ia_imagem_publica(p_imagem uuid) returns text
language sql stable security definer set search_path=public,pg_temp as $$
  select i.caminho from public.loja_ia_imagens i
  join public.loja_ia_rascunhos r on r.id=i.rascunho_id
  join public.vitrines_lojas v on v.id=r.vitrine_id and v.dono_id=r.dono_id
  join public.loja_ia_imagens_vinculos vinculo on vinculo.imagem_id=i.id and vinculo.vitrine_id=v.id
  where i.id=p_imagem and i.estado='pronta' and r.estado='publicado' and v.tipo='loja' and v.status='ativa'
    and ((vinculo.uso='logo' and v.logo_url='/api/loja/imagem/' || i.id::text) or (vinculo.uso='capa' and v.capa_url='/api/loja/imagem/' || i.id::text))
$$;

-- A fila independe do rascunho, inclusive depois da exclusão da conta.
create table public.loja_ia_imagens_lixeira (caminho text primary key, criado_em timestamptz not null default now());
alter table public.loja_ia_imagens_lixeira enable row level security;
revoke all on public.loja_ia_imagens_lixeira from public,anon,authenticated;
create function public.loja_ia_enfileirar_imagem_excluida() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if old.estado <> 'apagada' then
    insert into public.loja_ia_imagens_lixeira(caminho) values(old.caminho) on conflict do nothing;
  end if;
  return old;
end $$;
revoke all on function public.loja_ia_enfileirar_imagem_excluida() from public,anon,authenticated;
create trigger loja_ia_enfileirar_imagem_excluida before delete on public.loja_ia_imagens
for each row execute function public.loja_ia_enfileirar_imagem_excluida();

-- Uma marcação precede a remoção física; a mesma trava é usada ao vincular.
create function public.loja_ia_marcar_descarte(p_imagem uuid) returns text
language plpgsql security definer set search_path=public,pg_temp as $$
declare i public.loja_ia_imagens; r public.loja_ia_rascunhos;
begin
  select * into r from public.loja_ia_rascunhos where id=(select rascunho_id from public.loja_ia_imagens where id=p_imagem) for update;
  if not found then return null; end if;
  select * into i from public.loja_ia_imagens where id=p_imagem and rascunho_id=r.id for update;
  if not found then return null; end if;
  if i.estado = 'apagada' or i.criado_em > now() - interval '1 day' or (r.estado <> 'publicado' and (r.entrada->'materiais') ? i.id::text) or (r.estado <> 'publicado' and i.id::text in (r.campos->'logo'->>'valor', r.campos->'capa'->>'valor', r.campos->'logo'->'sugestao'->>'valor', r.campos->'capa'->'sugestao'->>'valor')) or exists(select 1 from public.vitrines_lojas v where ('/api/loja/imagem/' || i.id::text) in (v.logo_url,v.capa_url)) then return null; end if;
  update public.loja_ia_imagens set estado='descarte' where id=i.id;
  return i.caminho;
end $$;
create function public.loja_ia_lote_limpeza() returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
  select jsonb_build_object(
    'imagens', coalesce((select jsonb_agg(id) from (select i.id from public.loja_ia_imagens i join public.loja_ia_rascunhos r on r.id=i.rascunho_id
      where i.estado <> 'apagada' and i.criado_em < now()-interval '1 day'
      and not (r.estado <> 'publicado' and coalesce((r.entrada->'materiais') ? i.id::text,false))
      and not (r.estado <> 'publicado' and i.id::text in (coalesce(r.campos->'logo'->>'valor',''),coalesce(r.campos->'capa'->>'valor',''),coalesce(r.campos->'logo'->'sugestao'->>'valor',''),coalesce(r.campos->'capa'->'sugestao'->>'valor','')))
      and not exists(select 1 from public.vitrines_lojas v where ('/api/loja/imagem/' || i.id::text) in (v.logo_url,v.capa_url))
      order by i.criado_em limit 100) x),'[]'::jsonb),
    'lixeira', coalesce((select jsonb_agg(caminho) from (select caminho from public.loja_ia_imagens_lixeira order by criado_em limit 100) x),'[]'::jsonb))
$$;
create function public.loja_ia_confirmar_descarte(p_imagem uuid) returns void
language sql security definer set search_path=public,pg_temp as $$
  update public.loja_ia_imagens set estado='apagada' where id=p_imagem and estado='descarte'
$$;
create function public.loja_ia_confirmar_lixeira(p_caminho text) returns void
language sql security definer set search_path=public,pg_temp as $$
  delete from public.loja_ia_imagens_lixeira where caminho=p_caminho
$$;
revoke all on function public.loja_ia_lote_limpeza(), public.loja_ia_confirmar_descarte(uuid), public.loja_ia_confirmar_lixeira(text) from public,anon,authenticated;
grant execute on function public.loja_ia_lote_limpeza(), public.loja_ia_confirmar_descarte(uuid), public.loja_ia_confirmar_lixeira(text) to service_role;
revoke all on function public.loja_ia_reservar_imagem(uuid,text,text,bigint), public.loja_ia_obter_imagem_propria(uuid,uuid), public.loja_ia_vincular_imagem(uuid,uuid,uuid,text), public.loja_ia_reservar_normalizada(uuid,uuid,text,bigint), public.loja_ia_finalizar_imagem(uuid,uuid,text,text,bigint), public.loja_ia_imagem_publica(uuid), public.loja_ia_marcar_descarte(uuid) from public,anon,authenticated;
grant execute on function public.loja_ia_reservar_imagem(uuid,text,text,bigint), public.loja_ia_obter_imagem_propria(uuid,uuid) to authenticated;
grant execute on function public.loja_ia_reservar_normalizada(uuid,uuid,text,bigint), public.loja_ia_finalizar_imagem(uuid,uuid,text,text,bigint), public.loja_ia_imagem_publica(uuid), public.loja_ia_marcar_descarte(uuid) to service_role;
