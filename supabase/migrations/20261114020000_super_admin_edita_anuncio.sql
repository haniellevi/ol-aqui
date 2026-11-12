-- Etapa P5b-2a: o super admin edita o anúncio de outra pessoa na mesma tela do vendedor.
-- Ele digita o motivo uma vez ao abrir a edição; a autorização vale 2 horas; o dono recebe
-- 1 aviso no sino com o motivo; cada mudança entra no histórico com esse motivo (papel equipe).
create table public.admin_edicoes_anuncio (
  id uuid primary key default gen_random_uuid(),
  anuncio_id uuid not null references public.anuncios(id) on delete cascade,
  admin_id text not null references public.perfis(id) on delete cascade,
  motivo text not null check (char_length(btrim(motivo)) between 3 and 300),
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null default (now() + interval '2 hours')
);
create index admin_edicoes_anuncio_idx on public.admin_edicoes_anuncio(anuncio_id, admin_id, expira_em desc);
alter table public.admin_edicoes_anuncio enable row level security;
revoke all on public.admin_edicoes_anuncio from public, anon, authenticated;

-- Super admin com edição aberta (e dentro do prazo) para este anúncio.
create or replace function public.super_edita_anuncio(p_anuncio uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select public.e_super_admin() and exists (
    select 1 from public.admin_edicoes_anuncio e
     where e.anuncio_id = p_anuncio and e.admin_id = public.usuario_id() and e.expira_em > now())
$$;
revoke all on function public.super_edita_anuncio(uuid) from public, anon;
grant execute on function public.super_edita_anuncio(uuid) to authenticated, service_role;

-- Abre (ou reaproveita) a edição: motivo de 3 a 300 letras; só o primeiro pedido avisa o dono.
create or replace function public.admin_abrir_edicao_anuncio(p_anuncio uuid, p_motivo text)
returns timestamptz language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  a public.anuncios;
  dono text;
  eu text := public.usuario_id();
  v_motivo text := btrim(regexp_replace(coalesce(p_motivo, ''), '\s+', ' ', 'g'));
  ate timestamptz;
begin
  if not public.e_super_admin() then raise exception 'Só o super admin pode fazer isso.' using errcode = '42501'; end if;
  if char_length(v_motivo) not between 3 and 300 then
    raise exception 'Informe um motivo de 3 a 300 caracteres.' using errcode = '22023';
  end if;
  select * into a from public.anuncios where id = p_anuncio for update;
  if a.id is null then raise exception 'Anúncio não encontrado.' using errcode = '22023'; end if;
  if a.status in ('excluido', 'congelado', 'rascunho') then
    raise exception 'Este anúncio não pode ser editado agora.' using errcode = '22023';
  end if;
  select dono_id into dono from public.vitrines_lojas where id = a.vitrine_id;
  if dono = eu then raise exception 'Este anúncio é seu. Edite em Meus anúncios.' using errcode = '22023'; end if;
  -- Edição aberta pela mesma pessoa: só renova o prazo (sem novo aviso).
  update public.admin_edicoes_anuncio set expira_em = now() + interval '2 hours'
   where id = (select e.id from public.admin_edicoes_anuncio e
                where e.anuncio_id = a.id and e.admin_id = eu and e.expira_em > now()
                order by e.criado_em desc limit 1)
  returning expira_em into ate;
  if ate is not null then return ate; end if;
  insert into public.admin_edicoes_anuncio(anuncio_id, admin_id, motivo) values (a.id, eu, v_motivo)
  returning expira_em into ate;
  insert into public.admin_gestao_eventos(tipo, alvo, autor, acao, motivo)
    values ('anuncio', a.id::text, eu, 'editar', v_motivo);
  if dono is not null then
    perform public.notificar(dono, 'anuncio_edicao_equipe', 'A equipe vai ajustar seu anúncio',
      left(format('A Equipe Mercado da Região vai editar %s. Motivo: %s. Cada mudança aparece no histórico do anúncio.',
        public.nome_anuncio_aviso(a.titulo, false), v_motivo), 500),
      '/minha-conta/anuncios/' || a.id::text || '/historico',
      'anuncio_edicao_equipe:' || a.id::text || ':' || extract(epoch from now())::bigint::text,
      jsonb_build_object('anuncio_id', a.id));
  end if;
  return ate;
end $$;
revoke all on function public.admin_abrir_edicao_anuncio(uuid, text) from public, anon;
grant execute on function public.admin_abrir_edicao_anuncio(uuid, text) to authenticated;

-- Edição aberta agora pelo super admin logado (para a faixa de aviso no formulário).
create or replace function public.minha_edicao_admin(p_anuncio uuid)
returns table (motivo text, expira_em timestamptz)
language sql stable security definer set search_path = public
as $$
  select e.motivo, e.expira_em from public.admin_edicoes_anuncio e
   where public.e_super_admin() and e.anuncio_id = p_anuncio and e.admin_id = public.usuario_id() and e.expira_em > now()
   order by e.criado_em desc limit 1
$$;
revoke all on function public.minha_edicao_admin(uuid) from public, anon;
grant execute on function public.minha_edicao_admin(uuid) to authenticated;

-- O super admin só edita anúncio dos outros com a edição aberta (motivo e prazo).
drop policy if exists "super admin edita anuncios" on public.anuncios;
create policy "super admin edita anuncios" on public.anuncios
  for update using (public.super_edita_anuncio(id)) with check (public.super_edita_anuncio(id));

-- Fotos e histórico: versões atuais com o super admin em edição aberta.

create or replace function public.pode_enviar_foto(nome text)
returns boolean language plpgsql stable security definer
set search_path = public, extensions
as $$
declare
  uid    text := public.usuario_id();
  partes text[] := string_to_array(coalesce(pode_enviar_foto.nome, ''), '/');
  regiao uuid;
  vit    public.vitrines_lojas;
  chave_max text := 'fotos.max_por_pasta';
  maximo integer;
  total  integer := 0;
begin
  if uid is null or cardinality(partes) <> 3
     or partes[3] !~ '^[A-Za-z0-9_-][A-Za-z0-9._-]*$' then
    return false;
  end if;
  -- P5b: só a pasta de anúncio aceita a pasta do dono (ajudante); as outras são da própria pessoa.
  if partes[1] <> uid and partes[2] !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  if partes[2] = 'loja' then
    select v.microrregiao_id into regiao from public.vitrines_lojas v
     where v.dono_id = uid and v.tipo = 'loja' and v.status <> 'suspensa';
    if not found then return false; end if;
  elsif partes[2] = 'vitrine' then
    select * into vit from public.vitrines_lojas v
     where v.dono_id = uid and v.tipo = 'loja' and v.status <> 'suspensa';
    if vit.id is null then return false; end if;
    if not coalesce((select r.foto_fachada from public.recursos_vitrine(vit) r), false) then return false; end if;
    regiao := vit.microrregiao_id;
  elsif partes[2] ~ '^radar-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    if not public.tem_plano_pago(uid) then return false; end if;
    select p.microrregiao_id into regiao
      from public.radar_pedidos p
      join public.vitrines_lojas v on v.dono_id = uid and v.microrregiao_id = p.microrregiao_id and v.status = 'ativa'
     where p.id = substr(partes[2], 7)::uuid and p.status = 'aberto' and p.expira_em > now()
       and p.comprador_id <> uid
       and (p.modo_contato = 'whatsapp_direto' or p.propostas_ate > now());
    if not found then return false; end if;
    chave_max := 'radar.fotos_max_pasta';
  elsif partes[2] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select a.microrregiao_id into regiao from public.anuncios a join public.vitrines_lojas v on v.id = a.vitrine_id
     where a.id = partes[2]::uuid and v.dono_id = partes[1]
       and (public.pode_mexer_vitrine(v.id) or public.super_edita_anuncio(a.id)) and a.status not in ('congelado', 'em_analise');
    if not found then return false; end if;
  else
    return false;
  end if;
  maximo := public.numero_ou_nulo(public.config(chave_max, regiao, 'null'))::int;
  if maximo is not null and to_regclass('storage.objects') is not null then
    execute 'select count(*) from storage.objects where bucket_id = $1 and name like $2'
       into total using 'anuncios', partes[1] || '/' || partes[2] || '/%';
    if total >= maximo then return false; end if;
  end if;
  return true;
end $$;

create or replace function public.pasta_foto_que_cuido(nome text)
returns boolean language plpgsql stable security definer set search_path = public
as $$
declare partes text[] := string_to_array(coalesce(nome, ''), '/');
begin
  if cardinality(partes) <> 3 or partes[2] !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return exists (select 1 from public.anuncios a join public.vitrines_lojas v on v.id = a.vitrine_id
                  where a.id = partes[2]::uuid and v.dono_id = partes[1]
                    and (public.pode_mexer_vitrine(v.id) or public.super_edita_anuncio(a.id)));
end $$;

create or replace function public.registrar_historico(
  p_vitrine uuid, p_anuncio uuid, p_acao text, p_de text default null, p_para text default null)
returns void language plpgsql security definer set search_path = public
as $$
declare
  eu text := public.usuario_id();
  v_motivo text := nullif(left(btrim(coalesce(current_setting('olaki.motivo', true), '')), 300), '');
  ultimo bigint;
begin
  if eu is not null and not exists (select 1 from public.perfis where id = eu) then eu := null; end if;
  -- P5b-2: edição do super admin leva o motivo digitado ao abrir a edição.
  if v_motivo is null and p_anuncio is not null and eu is not null then
    select e.motivo into v_motivo from public.admin_edicoes_anuncio e
     where e.anuncio_id = p_anuncio and e.admin_id = eu and e.expira_em > now()
     order by e.criado_em desc limit 1;
  end if;
  if p_acao = 'editou' then
    select id into ultimo from public.historico_alteracoes
     where vitrine_id = p_vitrine and anuncio_id is not distinct from p_anuncio and acao = 'editou'
       and quem is not distinct from eu and atualizado_em > now() - interval '15 minutes'
     order by id desc limit 1;
    if ultimo is not null then
      update public.historico_alteracoes set atualizado_em = now(), motivo = coalesce(v_motivo, historico_alteracoes.motivo)
       where id = ultimo;
      return;
    end if;
  end if;
  insert into public.historico_alteracoes (vitrine_id, anuncio_id, quem, papel, acao, de, para, motivo)
  values (p_vitrine, p_anuncio, eu, public.papel_historico(p_vitrine, eu), p_acao, p_de, p_para, v_motivo);
end $$;
