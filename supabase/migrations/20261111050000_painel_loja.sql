-- Vitrine com IA, etapa 5a: painel do lojista e resumo semanal (docs/PLANO-VITRINE-IA.md).
-- 1. Visitas da loja e cliques no WhatsApp/Mapa da página da loja (só números, como eventos_anuncio).
-- 2. Números da loja no período (7 ou 30 dias) comparados com o período anterior e os produtos mais vistos.
-- 3. Sugestões por regra (sem foto, poucas fotos, descrição curta, sem preço, muito visto e sem clique).
-- 4. Resumo semanal no sino, onde a vitrine nova está ligada (chave da região da loja).
-- Nada diz quem viu o quê: o lojista só recebe contagens.

-- ---------------------------------------------------------------------
-- 1. Eventos da página da loja
-- ---------------------------------------------------------------------
create table public.eventos_loja (
  id              bigint generated always as identity primary key,
  vitrine_id      uuid not null references public.vitrines_lojas(id) on delete cascade,
  tipo            text not null check (tipo in ('visita', 'clique_whatsapp', 'clique_mapa')),
  visitante_hash  text,
  criado_em       timestamptz not null default now()
);
create index eventos_loja_idx on public.eventos_loja (vitrine_id, tipo, criado_em desc);
create index eventos_loja_criado_idx on public.eventos_loja (criado_em);
alter table public.eventos_loja enable row level security;
create policy "eventos loja leitura" on public.eventos_loja for select using (
  public.e_admin() or exists (select 1 from public.vitrines_lojas v where v.id = vitrine_id and v.dono_id = public.usuario_id()));
revoke all on public.eventos_loja from anon, authenticated;
grant select on public.eventos_loja to authenticated;

-- Só o servidor do site chama (ele informa o visitante). Mesmas regras de registrar_evento:
-- o dono não conta, loja fora do ar não conta e o mesmo visitante só conta de novo depois da janela.
create function public.registrar_evento_loja(p_vitrine uuid, p_tipo text, p_visitante text default null, p_usuario text default null)
returns boolean language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v       record;
  uid     text := nullif(btrim(p_usuario), '');
  chave   text := nullif(left(btrim(coalesce(p_visitante, '')), 200), '');
  h       text;
  janela  integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' and session_user not in ('postgres', 'supabase_admin') then
    raise exception 'Acesso restrito.' using errcode = '42501';
  end if;
  if coalesce(p_tipo, '') not in ('visita', 'clique_whatsapp', 'clique_mapa') then return false; end if;
  select x.id, x.status, x.tipo, x.dono_id, x.microrregiao_id into v from public.vitrines_lojas x where x.id = p_vitrine;
  if v.id is null or v.status <> 'ativa' or v.tipo <> 'loja' then return false; end if;
  if v.dono_id = uid then return false; end if;
  if chave is not null or uid is not null then
    h := left(encode(sha256(convert_to(
           coalesce(chave, '') || '|' || coalesce(uid, '') || '|' || current_date::text, 'UTF8')), 'hex'), 32);
    janela := coalesce(public.numero_ou_nulo(public.config('eventos.repetir_apos_minutos', v.microrregiao_id, '30')), 30)::int;
    if exists (select 1 from public.eventos_loja e
                where e.vitrine_id = v.id and e.tipo = p_tipo and e.visitante_hash = h
                  and e.criado_em > now() - make_interval(mins => janela)) then
      return false;
    end if;
  end if;
  insert into public.eventos_loja (vitrine_id, tipo, visitante_hash) values (v.id, p_tipo, h);
  return true;
end $$;

-- ---------------------------------------------------------------------
-- 2. Números da loja
-- ---------------------------------------------------------------------
-- Contagens de um intervalo [inicio, fim). Uso interno.
create function public.loja_numeros(p_vitrine uuid, p_inicio timestamptz, p_fim timestamptz)
returns jsonb language sql stable
set search_path = public
as $$
  select jsonb_build_object(
    'visitas', (select count(*) from public.eventos_loja e
                 where e.vitrine_id = p_vitrine and e.tipo = 'visita' and e.criado_em >= p_inicio and e.criado_em < p_fim),
    'visualizacoes', (select count(*) from public.eventos_anuncio e join public.anuncios a on a.id = e.anuncio_id
                       where a.vitrine_id = p_vitrine and e.tipo = 'visualizacao' and e.criado_em >= p_inicio and e.criado_em < p_fim),
    'cliques_whatsapp', (select count(*) from public.eventos_loja e
                          where e.vitrine_id = p_vitrine and e.tipo = 'clique_whatsapp' and e.criado_em >= p_inicio and e.criado_em < p_fim)
                      + (select count(*) from public.eventos_anuncio e join public.anuncios a on a.id = e.anuncio_id
                          where a.vitrine_id = p_vitrine and e.tipo = 'clique_whatsapp' and e.criado_em >= p_inicio and e.criado_em < p_fim),
    'cliques_mapa', (select count(*) from public.eventos_loja e
                      where e.vitrine_id = p_vitrine and e.tipo = 'clique_mapa' and e.criado_em >= p_inicio and e.criado_em < p_fim),
    'favoritos', (select count(*) from public.favoritos f join public.anuncios a on a.id = f.anuncio_id
                   where a.vitrine_id = p_vitrine and f.criado_em >= p_inicio and f.criado_em < p_fim))
$$;

-- Painel do dono: período de 7 ou 30 dias, o período anterior e os 5 produtos mais vistos.
create function public.minha_loja_desempenho(p_vitrine uuid, p_dias integer default 7)
returns jsonb language plpgsql stable security definer
set search_path = public
as $$
declare
  dias integer := case when p_dias = 30 then 30 else 7 end;
  -- Período atual vai até agora, sem limite em cima (eventos deste instante também contam).
  fim timestamptz := 'infinity';
  inicio timestamptz := now() - make_interval(days => case when p_dias = 30 then 30 else 7 end);
begin
  if not exists (select 1 from public.vitrines_lojas where id = p_vitrine and dono_id = public.usuario_id() and tipo = 'loja') then
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
               order by 4 desc, 5 desc, a.id
               limit 5) t), '[]'::jsonb));
end $$;

-- ---------------------------------------------------------------------
-- 3. Sugestões por regra (sem IA)
-- ---------------------------------------------------------------------
-- No máximo uma por produto, as mais importantes primeiro, dos produtos mais vistos para os menos.
create function public.loja_sugestoes(p_vitrine uuid, p_limite integer default 5)
returns table (anuncio_id uuid, titulo text, motivo text, texto text)
language sql stable
set search_path = public
as $$
  select s.id, s.titulo, s.motivo, s.texto from (
    select distinct on (a.id) a.id, a.titulo, r.motivo, r.texto, r.peso,
           (select count(*) from public.eventos_anuncio e
             where e.anuncio_id = a.id and e.tipo = 'visualizacao' and e.criado_em > now() - interval '30 days') as vis
      from public.anuncios a
      cross join lateral (values
        ('sem_foto', 'Coloque uma foto. Produto sem foto quase não recebe contato.', 1,
          coalesce(cardinality(a.fotos), 0) = 0),
        ('vistos_sem_clique', 'Muita gente viu e ninguém chamou. Confira o preço e explique melhor na descrição.', 2,
          (select count(*) from public.eventos_anuncio e where e.anuncio_id = a.id and e.tipo = 'visualizacao'
             and e.criado_em > now() - interval '30 days') >= 30
          and not exists (select 1 from public.eventos_anuncio e where e.anuncio_id = a.id and e.tipo = 'clique_whatsapp'
             and e.criado_em > now() - interval '30 days')),
        ('sem_preco', 'Mostre o preço. Anúncio com preço recebe mais contato.', 3, a.preco_centavos is null),
        ('poucas_fotos', 'Coloque mais fotos (3 ou mais), de ângulos diferentes.', 4, coalesce(cardinality(a.fotos), 0) between 1 and 2),
        ('descricao_curta', 'Conte mais na descrição: tamanho, estado, cor, o que vem junto.', 5, char_length(btrim(coalesce(a.descricao, ''))) < 80),
        ('titulo_curto', 'Deixe o título mais completo, com marca ou modelo.', 6, char_length(btrim(coalesce(a.titulo, ''))) < 15)
      ) as r(motivo, texto, peso, vale)
     where a.vitrine_id = p_vitrine and a.status = 'ativo' and r.vale
     order by a.id, r.peso) s
  order by s.peso, s.vis desc, s.id
  limit greatest(least(coalesce(p_limite, 5), 20), 1)
$$;

create function public.minhas_sugestoes_loja(p_vitrine uuid)
returns table (anuncio_id uuid, titulo text, motivo text, texto text)
language plpgsql stable security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.vitrines_lojas where id = p_vitrine and dono_id = public.usuario_id() and tipo = 'loja') then
    raise exception using errcode = '42501', message = 'Loja não encontrada.';
  end if;
  return query select * from public.loja_sugestoes(p_vitrine, 5);
end $$;

-- ---------------------------------------------------------------------
-- 4. Resumo semanal no sino
-- ---------------------------------------------------------------------
create function public.loja_resumo_semanal()
returns integer language plpgsql security definer
set search_path = public, extensions
as $$
declare
  l record;
  n jsonb;
  top text;
  qtd_sug integer;
  enviados integer := 0;
  semana text := to_char(now(), 'IYYY-IW');
begin
  if coalesce(auth.role(), '') <> 'service_role' and session_user not in ('postgres', 'supabase_admin') then
    raise exception 'Só o sistema envia o resumo.' using errcode = '42501';
  end if;
  for l in select v.id, v.dono_id from public.vitrines_lojas v
            where v.tipo = 'loja' and v.status = 'ativa'
              and public.config('vitrine_ia.ativa', v.microrregiao_id, 'false') = 'true'::jsonb
            order by v.id loop
    n := public.loja_numeros(l.id, now() - interval '7 days', 'infinity');
    select count(*) into qtd_sug from public.loja_sugestoes(l.id, 5);
    -- Semana parada e nada para melhorar: não incomoda.
    continue when (n->>'visitas')::int + (n->>'visualizacoes')::int + (n->>'cliques_whatsapp')::int = 0 and qtd_sug = 0;
    select a.titulo into top from public.anuncios a join public.eventos_anuncio e on e.anuncio_id = a.id
     where a.vitrine_id = l.id and a.status = 'ativo' and e.tipo = 'visualizacao' and e.criado_em > now() - interval '7 days'
     group by a.id, a.titulo order by count(*) desc, a.id limit 1;
    if public.notificar(l.dono_id, 'resumo_semanal', 'Sua loja na semana',
         left(
           (n->>'visitas') || case when (n->>'visitas')::int = 1 then ' visita' else ' visitas' end || ' na loja, '
           || (n->>'visualizacoes') || ' em produtos e '
           || (n->>'cliques_whatsapp') || case when (n->>'cliques_whatsapp')::int = 1 then ' clique' else ' cliques' end || ' no WhatsApp.'
           || coalesce(' Mais visto: ' || top || '.', '')
           || case when qtd_sug = 0 then '' when qtd_sug = 1 then ' 1 dica para vender mais.' else ' ' || qtd_sug || ' dicas para vender mais.' end,
           300),
         '/minha-conta/loja/desempenho', 'resumo_semanal:' || l.id || ':' || semana,
         jsonb_build_object('vitrine_id', l.id, 'numeros', n, 'sugestoes', qtd_sug)) then
      enviados := enviados + 1;
    end if;
  end loop;
  return enviados;
end $$;

-- Novo aviso que o lojista pode ligar ou desligar.
update public.configuracoes
   set valor = valor || '["resumo_semanal"]'::jsonb
 where chave = 'radar.avisos_escolha' and jsonb_typeof(valor) = 'array' and not (valor ? 'resumo_semanal');

-- ---------------------------------------------------------------------
-- 5. Permissões e rotina (segunda-feira, 9h no horário da região = 12h UTC)
-- ---------------------------------------------------------------------
revoke all on function public.registrar_evento_loja(uuid, text, text, text), public.loja_numeros(uuid, timestamptz, timestamptz),
  public.loja_sugestoes(uuid, integer), public.loja_resumo_semanal() from public, anon, authenticated;
grant execute on function public.registrar_evento_loja(uuid, text, text, text), public.loja_resumo_semanal() to service_role;
revoke all on function public.minha_loja_desempenho(uuid, integer), public.minhas_sugestoes_loja(uuid) from public, anon;
grant execute on function public.minha_loja_desempenho(uuid, integer), public.minhas_sugestoes_loja(uuid) to authenticated;

do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('olaki-resumo-semanal-loja', '0 12 * * 1', 'select public.loja_resumo_semanal()');
  end if;
end $$;
