-- Etapa P5b-2b: o ajudante da loja (gerente com convite aceito) cuida da Minha loja:
-- capa, logo, cidade e bairro, horários e informações, seções próprias, produtos no
-- topo e desempenho. Nome e WhatsApp da loja, plano, pagamento, Destacar, apagar a
-- loja e o que gasta IA seguem só do dono. Toda mudança entra no histórico (papel
-- 'ajudante', já tratado por papel_historico).

-- 1) Leituras da loja escolhida (dono ou ajudante).
create or replace function public.contatos_da_loja(p_vitrine uuid)
returns table (whatsapp text, instagram text, site_url text, telefone_publico text)
language sql stable security definer set search_path = public
as $$
  select v.whatsapp, v.instagram, v.site_url, v.telefone_publico
    from public.vitrines_lojas v
   where v.id = p_vitrine and public.pode_mexer_vitrine(v.id)
$$;
revoke all on function public.contatos_da_loja(uuid) from public, anon;
grant execute on function public.contatos_da_loja(uuid) to authenticated;

create or replace function public.recursos_da_loja(p_vitrine uuid)
returns table (foto_fachada boolean, secoes_max integer, fixados_max integer,
               secoes_total integer, fixados_total integer,
               banner_moderado_em timestamptz, banner_moderado_motivo text)
language plpgsql stable security definer
set search_path = public, extensions
as $$
declare
  v   public.vitrines_lojas;
  rec record;
begin
  select * into v from public.vitrines_lojas x where x.id = p_vitrine and public.pode_mexer_vitrine(x.id);
  if v.id is null then return; end if;
  select * into rec from public.recursos_vitrine(v);
  return query select rec.foto_fachada, rec.secoes_max, rec.fixados_max,
    (select count(*)::int from public.loja_secoes s where s.vitrine_id = v.id),
    (select count(*)::int from public.anuncios a where a.vitrine_id = v.id and a.fixado_na_loja is not null),
    v.banner_moderado_em, v.banner_moderado_motivo;
end $$;
revoke all on function public.recursos_da_loja(uuid) from public, anon;
grant execute on function public.recursos_da_loja(uuid) to authenticated;

-- 2) A loja: o ajudante lê e edita, mas só os campos liberados.
drop policy if exists "vitrine ajudante ler" on public.vitrines_lojas;
create policy "vitrine ajudante ler" on public.vitrines_lojas for select
  using (id = any((select public.lojas_que_ajudo())::uuid[]));
drop policy if exists "vitrine ajudante editar" on public.vitrines_lojas;
create policy "vitrine ajudante editar" on public.vitrines_lojas for update
  using (id = any((select public.lojas_que_ajudo())::uuid[]))
  with check (id = any((select public.lojas_que_ajudo())::uuid[]));

create or replace function public.ajudante_campos_loja()
returns trigger language plpgsql
set search_path = public
as $$
declare
  liberados text[] := array['cidade', 'bairro', 'logo_url', 'capa_url', 'descricao', 'banner_tipo', 'banner_url',
                            'banner_modelo', 'banner_cor', 'endereco', 'lat', 'lng', 'horarios', 'sobre',
                            'formas_pagamento', 'faz_entrega', 'entrega_obs', 'instagram', 'site_url',
                            'telefone_publico', 'atualizado_em'];
begin
  -- Dono, equipe e funções do sistema seguem as regras de antes.
  if public.acesso_sistema() or old.dono_id = public.usuario_id() then
    return new;
  end if;
  if new.nome is distinct from old.nome or new.whatsapp is distinct from old.whatsapp then
    raise exception 'Só o dono muda o nome e o WhatsApp da loja.' using errcode = '42501';
  end if;
  -- Ajudante: tudo fora da lista volta a ser o que era (plano, status, dono, slug, IA...).
  new := jsonb_populate_record(old, (select coalesce(jsonb_object_agg(k, v), '{}'::jsonb)
                                       from jsonb_each(to_jsonb(new)) as e(k, v) where k = any(liberados)));
  return new;
end $$;
drop trigger if exists vitrines_0_ajudante_campos on public.vitrines_lojas;
create trigger vitrines_0_ajudante_campos before update on public.vitrines_lojas
  for each row execute function public.ajudante_campos_loja();

-- 3) Seções próprias: o ajudante cria, renomeia, esconde, ordena e escolhe os produtos.
drop policy if exists "secoes do ajudante" on public.loja_secoes;
create policy "secoes do ajudante" on public.loja_secoes for all
  using (vitrine_id = any((select public.lojas_que_ajudo())::uuid[]))
  with check (vitrine_id = any((select public.lojas_que_ajudo())::uuid[]));
drop policy if exists "secao anuncios do ajudante" on public.loja_secao_anuncios;
create policy "secao anuncios do ajudante" on public.loja_secao_anuncios for all
  using (exists (select 1 from public.loja_secoes s
                  where s.id = secao_id and s.vitrine_id = any((select public.lojas_que_ajudo())::uuid[])))
  with check (exists (select 1 from public.loja_secoes s
                       where s.id = secao_id and s.vitrine_id = any((select public.lojas_que_ajudo())::uuid[])));

-- 4) Fotos da loja, produtos no topo e desempenho: dono ou ajudante (pode_mexer_vitrine).
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
  -- P5b: pastas de anúncio, logo e capa aceitam a pasta do dono (ajudante); as outras são da própria pessoa.
  if partes[1] <> uid and partes[2] !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' and partes[2] not in ('loja', 'vitrine') then
    return false;
  end if;
  if partes[2] = 'loja' then
    select v.microrregiao_id into regiao from public.vitrines_lojas v
     where v.dono_id = partes[1] and v.tipo = 'loja' and v.status <> 'suspensa'
       and (v.dono_id = uid or v.id = any(public.lojas_que_ajudo()));
    if not found then return false; end if;
  elsif partes[2] = 'vitrine' then
    select * into vit from public.vitrines_lojas v
     where v.dono_id = partes[1] and v.tipo = 'loja' and v.status <> 'suspensa'
       and (v.dono_id = uid or v.id = any(public.lojas_que_ajudo()));
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
     where a.id = partes[2]::uuid and v.dono_id = partes[1] and a.status <> 'congelado'
       -- P5b-2a: em análise só a equipe com edição aberta troca foto.
       and ((public.pode_mexer_vitrine(v.id) and a.status <> 'em_analise') or public.super_edita_anuncio(a.id));
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
  -- P5b-2b: logo e capa da loja que a pessoa ajuda.
  if cardinality(partes) = 3 and partes[2] in ('loja', 'vitrine') then
    return exists (select 1 from public.vitrines_lojas v
                    where v.dono_id = partes[1] and v.id = any(public.lojas_que_ajudo()));
  end if;
  if cardinality(partes) <> 3 or partes[2] !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return exists (select 1 from public.anuncios a join public.vitrines_lojas v on v.id = a.vitrine_id
                  where a.id = partes[2]::uuid and v.dono_id = partes[1]
                    and (public.pode_mexer_vitrine(v.id) or public.super_edita_anuncio(a.id)));
end $$;

create or replace function public.fixar_anuncio(p_anuncio uuid, p_fixar boolean default true)
returns integer language plpgsql
set search_path = public, extensions
as $$
declare
  a    record;
  nova integer;
begin
  if public.usuario_id() is null then
    raise exception 'Faça login para continuar.' using errcode = '28000';
  end if;
  select x.id, x.vitrine_id, x.fixado_na_loja into a
    from public.anuncios x join public.vitrines_lojas v on v.id = x.vitrine_id
   where x.id = p_anuncio and public.pode_mexer_vitrine(v.id);
  if a.id is null then
    raise exception using errcode = '42501', message = 'Anúncio não encontrado.';
  end if;
  if not coalesce(p_fixar, true) then
    update public.anuncios x set fixado_na_loja = null where x.id = a.id and x.fixado_na_loja is not null;
    return null;
  end if;
  if a.fixado_na_loja is not null then
    return a.fixado_na_loja;                                   -- já fixado (toque repetido)
  end if;
  select coalesce(max(x.fixado_na_loja), 0) + 1 into nova from public.anuncios x where x.vitrine_id = a.vitrine_id;
  update public.anuncios x set fixado_na_loja = least(nova, 1000) where x.id = a.id;
  return least(nova, 1000);
end $$;

create or replace function public.ordenar_fixados(p_ids uuid[])
returns integer language plpgsql
set search_path = public, extensions
as $$
declare n integer;
begin
  if public.usuario_id() is null then
    raise exception 'Faça login para continuar.' using errcode = '28000';
  end if;
  update public.anuncios a set fixado_na_loja = least(x.pos, 1000)::int
    from unnest(p_ids) with ordinality as x(id, pos)
   where a.id = x.id and a.fixado_na_loja is not null
     and exists (select 1 from public.vitrines_lojas v where v.id = a.vitrine_id and public.pode_mexer_vitrine(v.id));
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.minha_loja_desempenho(p_vitrine uuid, p_dias integer default 7)
returns jsonb language plpgsql stable security definer
set search_path = public
as $$
declare
  dias integer := case when p_dias = 30 then 30 else 7 end;
  -- Período atual vai até agora, sem limite em cima (eventos deste instante também contam).
  fim timestamptz := 'infinity';
  inicio timestamptz := now() - make_interval(days => case when p_dias = 30 then 30 else 7 end);
begin
  if not exists (select 1 from public.vitrines_lojas where id = p_vitrine and public.pode_mexer_vitrine(id) and tipo = 'loja') then
    raise exception using errcode = '42501', message = 'Loja não encontrada.';
  end if;
  return jsonb_build_object(
    'dias', dias,
    'atual', public.loja_numeros(p_vitrine, inicio, fim),
    'anterior', public.loja_numeros(p_vitrine, inicio - make_interval(days => dias), inicio),
    'mais_vistos', coalesce((
      select jsonb_agg(jsonb_build_object('anuncio_id', t.id, 'titulo', t.titulo, 'foto', t.foto,
                                          'visualizacoes', t.vis, 'cliques', t.cli) order by t.vis desc, t.cli desc, t.id)
        from (select a.id, a.titulo, a.fotos[1] as foto,
                     count(*) filter (where e.tipo = 'visualizacao') as vis,
                     count(*) filter (where e.tipo = 'clique_whatsapp') as cli
                from public.anuncios a join public.eventos_anuncio e on e.anuncio_id = a.id
               where a.vitrine_id = p_vitrine and a.status = 'ativo' and e.criado_em >= inicio and e.criado_em < fim
               group by a.id
              having count(*) filter (where e.tipo = 'visualizacao') > 0
               order by 4 desc, 5 desc, a.id
               limit 5) t), '[]'::jsonb));
end $$;

create or replace function public.minha_loja_metricas_produtos(p_vitrine uuid, p_dias integer default 30)
returns jsonb language plpgsql stable security definer
set search_path = public
as $$
declare
  periodo integer := case when p_dias in (7, 30, 90) then p_dias else 30 end;
begin
  if not exists (select 1 from public.vitrines_lojas where id = p_vitrine and public.pode_mexer_vitrine(id) and tipo = 'loja') then
    raise exception using errcode = '42501', message = 'Loja não encontrada.';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
        'anuncio_id', m.anuncio_id, 'titulo', m.titulo, 'foto', m.foto, 'status', m.status,
        'no_ar', m.status = 'ativo',
        'aparicoes', m.aparicoes, 'visualizacoes', m.visualizacoes,
        'cliques_whatsapp', m.cliques_whatsapp, 'favoritos', m.favoritos,
        'posicao_media', case when m.aparicoes > 0 then round(m.soma_posicao::numeric / m.aparicoes, 1) end,
        'pct_chamou', case when m.visualizacoes > 0 then least(100, round(100.0 * m.cliques_whatsapp / m.visualizacoes)) end,
        'termos', m.termos,
        'tempo_ate_sair_dias', m.tempo_ate_sair_dias)
      order by m.visualizacoes desc, m.cliques_whatsapp desc, m.titulo, m.anuncio_id)
      from public.metricas_produtos_periodo(periodo, p_vitrine) m), '[]'::jsonb);
end $$;

create or replace function public.minhas_sugestoes_loja(p_vitrine uuid)
returns table (anuncio_id uuid, titulo text, motivo text, texto text)
language plpgsql stable security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.vitrines_lojas where id = p_vitrine and public.pode_mexer_vitrine(id) and tipo = 'loja') then
    raise exception using errcode = '42501', message = 'Loja não encontrada.';
  end if;
  return query select * from public.loja_sugestoes(p_vitrine, 5);
end $$;

create or replace function public.validar_secao_loja()
returns trigger language plpgsql
set search_path = public, extensions
as $$
declare
  sistema boolean := public.acesso_sistema();
  v       record;
  rec     record;
  total   integer;
  nomes   text;
  palavra text;
begin
  if tg_op = 'UPDATE' then
    new.vitrine_id := old.vitrine_id;
    new.criado_em := old.criado_em;
  end if;
  new.nome := regexp_replace(btrim(coalesce(new.nome, '')), '\s+', ' ', 'g');
  if char_length(new.nome) not between 2 and 40 then
    raise exception using errcode = '23514', message = 'Escreva o nome da seção (de 2 a 40 letras).', detail = 'campo:nome';
  end if;
  select x.id, x.tipo, x.microrregiao_id, x.dono_id into v from public.vitrines_lojas x where x.id = new.vitrine_id;
  if v.id is null or (not sistema and not public.pode_mexer_vitrine(v.id)) then
    raise exception using errcode = '42501', message = 'Loja não encontrada.';
  end if;
  if v.tipo <> 'loja' then
    raise exception using errcode = '42501', message = 'Só lojas têm seções na vitrine.';
  end if;
  if not sistema and (tg_op = 'INSERT' or new.nome is distinct from old.nome) then
    palavra := public.texto_bloqueado(new.nome, v.microrregiao_id);
    if palavra is not null then
      raise exception using errcode = '23514', detail = 'campo:nome',
        message = format('O nome da seção tem uma palavra que não é permitida no OLAKI: "%s".', palavra);
    end if;
  end if;
  if exists (select 1 from public.loja_secoes s
              where s.vitrine_id = new.vitrine_id and lower(s.nome) = lower(new.nome) and s.id <> new.id) then
    raise exception using errcode = '23505', message = 'Você já tem uma seção com esse nome.', detail = 'campo:nome';
  end if;
  if tg_op = 'INSERT' then
    if not sistema then
      perform 1 from public.vitrines_lojas where id = v.id for update;   -- duas abas ao mesmo tempo não passam do limite
      select * into rec from public.recursos_vitrine_id(v.id);
      select count(*) into total from public.loja_secoes s where s.vitrine_id = v.id;
      if rec.secoes_max is not null and total >= rec.secoes_max then
        nomes := public.planos_com_recurso('secoes');
        raise exception using errcode = 'P0001',
          message = case
            when rec.secoes_max = 0 and nomes is null then 'Seções próprias não fazem parte do seu plano.'
            when rec.secoes_max = 0 then format('Seções próprias fazem parte destes planos: %s.', nomes)
            else format('Seu plano permite até %s seções. Apague uma ou troque de plano.', rec.secoes_max) end;
      end if;
    end if;
    new.ordem := least(coalesce((select max(s.ordem) from public.loja_secoes s where s.vitrine_id = v.id), 0) + 1, 10000);
    new.criado_em := now();
  end if;
  new.atualizado_em := now();
  return new;
end $$;
