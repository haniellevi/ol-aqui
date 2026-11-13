-- Radar v2, fase 3 (IA) — docs/superpowers/plans/2026-11-13-radar-v2-fase3-ia.md
-- 1. Chaves (todas desligadas), limite por pessoa e teto do mês só do Radar.
-- 2. Reserva num livro-caixa próprio (radar_ia_uso) antes de cada chamada à IA; o servidor conclui com o custo real.
--    Próprio de propósito: os tetos do Aki, da moderação e das outras IAs somam robo_uso inteiro; o Radar não pode apertá-los.
-- 3. Anúncio novo parecido com pedido aberto: candidatos para a IA conferir e aviso no sino, no máximo 1 por dia por pedido.
-- Nada do que a IA escolhe é guardado; só o custo.

-- ---------------------------------------------------------------------
-- 1. Configurações e livro-caixa
-- ---------------------------------------------------------------------
insert into public.configuracoes (chave, valor, grupo, publico, descricao)
select x.chave, x.valor, 'radar', false, x.descricao
  from (values
    ('radar_ia.ativa',                    'false'::jsonb, 'IA do Radar: chave geral. Desligada, nenhuma parte da IA do Radar funciona'),
    ('radar_ia.perguntas_ativa',          'false'::jsonb, 'IA do Radar: até 2 perguntas com botões quando o pedido está vago'),
    ('radar_ia.parecidos_ativa',          'false'::jsonb, 'IA do Radar: "Achamos isso na região. Quer ver?" antes de terminar o pedido'),
    ('radar_ia.vitrine_ativa',            'false'::jsonb, 'IA do Radar: marca os 3 anúncios da loja que mais combinam com o pedido'),
    ('radar_ia.novidades_ativa',          'false'::jsonb, 'IA do Radar: avisa o cliente quando entra anúncio novo parecido com o pedido (1 por dia por pedido)'),
    ('radar_ia.orcamento_mensal_centavos', '3000'::jsonb, 'IA do Radar: teto de gasto do mês, em centavos (R$ 30,00 = 3000). Acabou, o Radar segue sem IA até o mês seguinte'),
    ('radar_ia.usos_por_dia',             '20'::jsonb,    'IA do Radar: quantas vezes cada pessoa usa a IA do Radar por dia'),
    ('radar_ia.novidades_por_rodada',     '15'::jsonb,    'IA do Radar: quantos pedidos a rotina de anúncio novo confere por hora, no máximo'),
    ('radar.aviso.radar_novidade.titulo', '"Chegou algo parecido com “{pedido}”"'::jsonb,
       'Aviso ao comprador: título quando entra anúncio parecido com o pedido. Pode usar {pedido}'),
    ('radar.aviso.radar_novidade.texto',  '"Uma loja da região anunciou “{anuncio}”. Toque para ver."'::jsonb,
       'Aviso ao comprador: texto quando entra anúncio parecido com o pedido. Pode usar {pedido} e {anuncio}')
  ) as x(chave, valor, descricao)
 where not exists (select 1 from public.configuracoes c where c.chave = x.chave and c.microrregiao_id is null);

update public.configuracoes
   set valor = valor || '["radar_novidade"]'::jsonb
 where chave in ('radar.avisos_ligados', 'radar.avisos_escolha')
   and jsonb_typeof(valor) = 'array' and not (valor ? 'radar_novidade');

create table public.radar_ia_uso (
  id              bigint generated always as identity primary key,
  usuario_id      text references public.perfis(id) on delete set null on update cascade,
  microrregiao_id uuid references public.microrregioes(id) on delete set null,
  parte           text not null check (parte in ('perguntas', 'parecidos', 'vitrine', 'novidades')),
  provedor        text not null,
  modelo          text not null,
  tokens_entrada  integer not null default 0 check (tokens_entrada >= 0),
  tokens_saida    integer not null default 0 check (tokens_saida >= 0),
  custo_centavos  numeric(14,4) not null default 0 check (custo_centavos >= 0),
  cotacao_dolar   numeric(10,4),
  erro            text check (char_length(erro) <= 300),
  criado_em       timestamptz not null default now()
);
create index radar_ia_uso_usuario_idx on public.radar_ia_uso (usuario_id, criado_em desc);
create index radar_ia_uso_criado_idx on public.radar_ia_uso (criado_em);
alter table public.radar_ia_uso enable row level security;
create policy "radar ia uso admin" on public.radar_ia_uso for select using (public.e_admin());
revoke all on public.radar_ia_uso from anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. Reserva e conclusão (só o servidor, com a chave secreta)
-- ---------------------------------------------------------------------
create function public.radar_ia_reservar(p_usuario text, p_parte text)
returns bigint language plpgsql security definer
set search_path = public, extensions
as $$
declare
  cot numeric; orc numeric; gasto numeric; reserva numeric; limite numeric;
  provedor text; modelo text;
  uid bigint;
begin
  if coalesce(auth.role(), '') <> 'service_role' and session_user not in ('postgres', 'supabase_admin') then
    raise exception 'Acesso restrito.' using errcode = '42501';
  end if;
  if p_parte is null or p_parte not in ('perguntas', 'parecidos', 'vitrine', 'novidades') then
    raise exception 'Parte desconhecida.' using errcode = '22023';
  end if;
  if public.config('radar_ia.ativa', null, 'false') is distinct from 'true'::jsonb
     or public.config('radar_ia.' || p_parte || '_ativa', null, 'false') is distinct from 'true'::jsonb then
    return null;
  end if;

  -- perguntas e novidades começam no JEV (julgar); parecidos e vitrine no Gemini (escrever).
  -- A 2ª chamada das perguntas (o Gemini escreve) usa a mesma tabela: só o custo real muda no concluir.
  if p_parte in ('perguntas', 'novidades') then provedor := 'typesafe'; modelo := 'jev-latest';
  else provedor := 'openrouter'; modelo := 'google/gemini-2.5-flash-lite'; end if;

  cot := public.numero_ou_nulo(public.config('robo.cotacao_dolar', null, 'null'));
  orc := public.numero_ou_nulo(public.config('radar_ia.orcamento_mensal_centavos', null, 'null'));
  limite := public.numero_ou_nulo(public.config('radar_ia.usos_por_dia', null, '20'));
  if cot is null or cot <= 0 or orc is null or orc < 0 then return null; end if;
  -- US$ 0,001 cobre com folga uma chamada (pedido + 20 anúncios curtos no Flash-Lite, ou uma do JEV).
  reserva := round(0.001 * cot * 100, 4);

  perform pg_advisory_xact_lock(hashtext('robo_uso:radar'));
  if p_usuario is not null and (select count(*) from public.radar_ia_uso u
       where u.usuario_id = p_usuario and u.criado_em >= public.robo_inicio('dia')) >= coalesce(limite, 0) then
    return null;
  end if;
  select coalesce(sum(custo_centavos), 0) into gasto from public.radar_ia_uso where criado_em >= public.robo_inicio('mes');
  if gasto + reserva > orc then return null; end if;

  insert into public.radar_ia_uso (usuario_id, microrregiao_id, parte, provedor, modelo, custo_centavos, cotacao_dolar, erro)
  values (p_usuario, (select microrregiao_id from public.perfis where id = p_usuario), p_parte, provedor, modelo, reserva, cot, 'em_andamento')
  returning id into uid;
  return uid;
end $$;

create function public.radar_ia_concluir(p_uso bigint, p_custo_usd numeric, p_tokens_entrada integer,
  p_tokens_saida integer, p_erro text)
returns void language plpgsql security definer
set search_path = public, extensions
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' and session_user not in ('postgres', 'supabase_admin') then
    raise exception 'Acesso restrito.' using errcode = '42501';
  end if;
  update public.radar_ia_uso set
    custo_centavos = case when p_custo_usd >= 0 and p_custo_usd <= 0.05 then round(p_custo_usd * cotacao_dolar * 100, 4) else custo_centavos end,
    tokens_entrada = greatest(coalesce(p_tokens_entrada, 0), 0),
    tokens_saida = greatest(coalesce(p_tokens_saida, 0), 0),
    erro = left(nullif(btrim(coalesce(p_erro, '')), ''), 300)
   where id = p_uso and erro = 'em_andamento';
end $$;

-- Quais partes estão ligadas (a tela do pedido pula a ida ao servidor quando nada está ligado).
create function public.radar_ia_estado()
returns jsonb language plpgsql stable security definer
set search_path = public, extensions
as $$
declare
  geral boolean;
begin
  if coalesce(auth.role(), '') <> 'service_role' and session_user not in ('postgres', 'supabase_admin') then
    raise exception 'Acesso restrito.' using errcode = '42501';
  end if;
  geral := public.config('radar_ia.ativa', null, 'false') = 'true'::jsonb;
  return jsonb_build_object(
    'perguntas', geral and public.config('radar_ia.perguntas_ativa', null, 'false') = 'true'::jsonb,
    'parecidos', geral and public.config('radar_ia.parecidos_ativa', null, 'false') = 'true'::jsonb,
    'vitrine',   geral and public.config('radar_ia.vitrine_ativa', null, 'false') = 'true'::jsonb,
    'novidades', geral and public.config('radar_ia.novidades_ativa', null, 'false') = 'true'::jsonb);
end $$;

-- ---------------------------------------------------------------------
-- 3. Anúncio novo parecido com pedido aberto
-- ---------------------------------------------------------------------
-- Até onde a rotina já olhou cada pedido. Tabela à parte: não dispara o log nem as travas do pedido.
create table public.radar_novidades_conferido (
  pedido_id     uuid primary key references public.radar_pedidos(id) on delete cascade,
  conferido_em  timestamptz not null
);
alter table public.radar_novidades_conferido enable row level security;
revoke all on public.radar_novidades_conferido from anon, authenticated;

-- O anúncio pode avisar este pedido? (no ar, da região e da área, de outra pessoa)
create function public.radar_novidade_combina(p_pedido public.radar_pedidos, p_anuncio public.anuncios)
returns boolean language sql stable security definer
set search_path = public, extensions
as $$
  select p_anuncio.id is not null and p_pedido.id is not null
     and p_anuncio.status = 'ativo'
     and p_anuncio.microrregiao_id = p_pedido.microrregiao_id
     and not exists (select 1 from public.vitrines_lojas v where v.id = p_anuncio.vitrine_id and v.dono_id = p_pedido.comprador_id)
     and (p_pedido.cidades_ids is null
          or exists (select 1 from public.cidades c
                      where c.id = any(p_pedido.cidades_ids)
                        and public.sem_acento(lower(btrim(c.nome))) = public.sem_acento(lower(btrim(coalesce(p_anuncio.cidade, ''))))))
$$;

-- O pedido ainda pode receber aviso hoje? (aberto, no prazo, aviso ligado e nenhum aviso hoje)
create function public.radar_novidade_pode_avisar(p_pedido public.radar_pedidos)
returns boolean language sql stable security definer
set search_path = public, extensions
as $$
  select p_pedido.id is not null
     and p_pedido.status = 'aberto' and p_pedido.expira_em > now()
     and not exists (select 1 from public.preferencias_avisos pa
                      where pa.usuario_id = p_pedido.comprador_id and pa.tipo = 'radar_novidade' and pa.canal = 'app' and not pa.ligado)
     and not exists (select 1 from public.notificacoes n
                      where n.usuario_id = p_pedido.comprador_id
                        and n.chave = 'radar_novidade:' || p_pedido.id || ':' || (now() at time zone 'America/Fortaleza')::date)
$$;

-- Pedidos com anúncio novo parecido (para a IA conferir). Pedido sem candidato já fica marcado;
-- pedido com candidato só é marcado (radar_novidade_conferida, com o "ate" devolvido aqui) depois que a IA julga:
-- IA fora do ar, teto do mês ou rodada cortada no meio → o pedido volta na hora seguinte.
create function public.radar_novidades_candidatos(p_limite integer)
returns jsonb language plpgsql security definer
set search_path = public, extensions
as $$
declare
  r record;
  lista jsonb;
  saida jsonb := '[]'::jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' and session_user not in ('postgres', 'supabase_admin') then
    raise exception 'Acesso restrito.' using errcode = '42501';
  end if;
  for r in
    select p as pedido, coalesce(k.conferido_em, p.criado_em) as desde
      from public.radar_pedidos p
      left join public.radar_novidades_conferido k on k.pedido_id = p.id
     where public.radar_novidade_pode_avisar(p)
     order by coalesce(k.conferido_em, p.criado_em), p.id
     limit greatest(least(coalesce(p_limite, 0), 500), 0)
  loop
    select jsonb_agg(jsonb_build_object('id', x.id, 'titulo', x.titulo, 'preco_centavos', x.preco_centavos) order by x.sim desc, x.publicado_em desc)
      into lista
      from (
        select a.id, a.titulo, a.preco_centavos, a.publicado_em,
               greatest(extensions.word_similarity(public.sem_acento(lower((r.pedido).titulo)), public.sem_acento(lower(a.titulo))),
                        extensions.word_similarity(public.sem_acento(lower(a.titulo)), public.sem_acento(lower((r.pedido).titulo)))) as sim
          from public.anuncios a
         where a.publicado_em > r.desde
           and public.radar_novidade_combina(r.pedido, a)
           and ((r.pedido).categoria_id is not null and a.categoria_id = (r.pedido).categoria_id
                or greatest(extensions.word_similarity(public.sem_acento(lower((r.pedido).titulo)), public.sem_acento(lower(a.titulo))),
                            extensions.word_similarity(public.sem_acento(lower(a.titulo)), public.sem_acento(lower((r.pedido).titulo)))) >= 0.3)
         order by sim desc, a.publicado_em desc
         limit 5) x;
    if lista is null then
      insert into public.radar_novidades_conferido (pedido_id, conferido_em) values ((r.pedido).id, now())
      on conflict (pedido_id) do update set conferido_em = excluded.conferido_em;
    else
      saida := saida || jsonb_build_array(jsonb_build_object(
        'pedido_id', (r.pedido).id, 'titulo', (r.pedido).titulo, 'ate', now(),
        'detalhes', left(coalesce((r.pedido).detalhes, ''), 300), 'anuncios', lista));
    end if;
  end loop;
  return saida;
end $$;

-- A IA julgou os candidatos do pedido até `p_ate`: a próxima rodada só olha anúncios depois disso.
create function public.radar_novidade_conferida(p_pedido uuid, p_ate timestamptz)
returns void language plpgsql security definer
set search_path = public, extensions
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' and session_user not in ('postgres', 'supabase_admin') then
    raise exception 'Acesso restrito.' using errcode = '42501';
  end if;
  if p_pedido is null or p_ate is null or p_ate > now() then return; end if;
  insert into public.radar_novidades_conferido (pedido_id, conferido_em)
  select id, p_ate from public.radar_pedidos where id = p_pedido
  on conflict (pedido_id) do update set conferido_em = greatest(public.radar_novidades_conferido.conferido_em, excluded.conferido_em);
end $$;

create function public.radar_avisar_novidade(p_pedido uuid, p_anuncio uuid)
returns boolean language plpgsql security definer
set search_path = public, extensions
as $$
declare
  p public.radar_pedidos;
  a public.anuncios;
begin
  if coalesce(auth.role(), '') <> 'service_role' and session_user not in ('postgres', 'supabase_admin') then
    raise exception 'Acesso restrito.' using errcode = '42501';
  end if;
  select * into p from public.radar_pedidos where id = p_pedido;
  select * into a from public.anuncios where id = p_anuncio;
  if not coalesce(public.radar_novidade_pode_avisar(p), false) or not coalesce(public.radar_novidade_combina(p, a), false) then
    return false;
  end if;
  return public.radar_aviso(p.comprador_id, 'radar_novidade', p.microrregiao_id,
    jsonb_build_object('pedido', p.titulo, 'anuncio', a.titulo),
    '/anuncio/' || coalesce(a.slug, a.id::text),
    'radar_novidade:' || p.id || ':' || (now() at time zone 'America/Fortaleza')::date);
end $$;

-- Rotina: de hora em hora (minuto 7), se as chaves estiverem ligadas. Mesmo segredo interno da moderação.
create function public.radar_ia_novidades_disparar()
returns bigint language plpgsql security definer
set search_path = public, extensions
as $$
declare
  segredo text;
  pedido bigint;
begin
  if public.config('radar_ia.ativa', null, 'false') is distinct from 'true'::jsonb
     or public.config('radar_ia.novidades_ativa', null, 'false') is distinct from 'true'::jsonb then
    return null;
  end if;
  select decrypted_secret into segredo from vault.decrypted_secrets where name = 'olaki_moderacao_ia_token';
  if segredo is null or length(segredo) < 32 then return null; end if;
  select net.http_post(url := 'https://ol-aqui.vercel.app/api/interno/radar-novidades',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || segredo),
    body := '{}'::jsonb, timeout_milliseconds := 60000) into pedido;
  return pedido;
end $$;

-- ---------------------------------------------------------------------
-- 4. Permissões
-- ---------------------------------------------------------------------
revoke all on function public.radar_ia_reservar(text, text), public.radar_ia_concluir(bigint, numeric, integer, integer, text),
  public.radar_ia_estado(), public.radar_novidade_conferida(uuid, timestamptz),
  public.radar_novidade_combina(public.radar_pedidos, public.anuncios), public.radar_novidade_pode_avisar(public.radar_pedidos),
  public.radar_novidades_candidatos(integer), public.radar_avisar_novidade(uuid, uuid), public.radar_ia_novidades_disparar()
  from public, anon, authenticated;
grant execute on function public.radar_ia_reservar(text, text), public.radar_ia_concluir(bigint, numeric, integer, integer, text),
  public.radar_ia_estado(), public.radar_novidade_conferida(uuid, timestamptz),
  public.radar_novidades_candidatos(integer), public.radar_avisar_novidade(uuid, uuid), public.radar_ia_novidades_disparar()
  to service_role;

do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') and exists (select 1 from pg_extension where extname = 'pg_net') then
    perform cron.schedule('olaki-radar-novidades', '7 * * * *', 'select public.radar_ia_novidades_disparar()');
  end if;
end $$;
