-- Etapa P4 (docs/PLANO-PRODUTOS.md): métricas do produto.
-- Só números somados por dia e termos normalizados. Nada liga um número a uma pessoa:
-- sem visitante, sem usuário, sem uma linha por aparição.
-- 1. Tipo 'favoritar' (o banco grava quando alguém favorita; o site não envia).
-- 2. Tabela diária somada anuncios_numeros_dia (alimentada por gatilho em eventos_anuncio).
-- 3. Termos de busca do dia (anuncios_termos_dia): só quando a pessoa buscou e abriu o anúncio.
-- 4. Aparições por dia e página (anuncios_aparicoes_dia): sem linha por aparição.
-- 5. Tempo até sair: anuncios.saiu_do_ar_em (gatilho quando o status deixa 'ativo').
-- 6. Leituras: dono da loja (minha_loja_metricas_produtos) e administrador (admin_metricas_produtos).

-- ---------------------------------------------------------------------
-- 1. Tipo 'favoritar'
-- ---------------------------------------------------------------------
alter table public.eventos_anuncio drop constraint eventos_anuncio_tipo_check;
alter table public.eventos_anuncio add constraint eventos_anuncio_tipo_check
  check (tipo in ('visualizacao', 'clique_whatsapp', 'compartilhar', 'favoritar'));

-- Dia de uma métrica: sempre pelo horário de Brasília.
create function public.dia_metrica(instante timestamptz) returns date
language sql stable
set search_path = public
as $$ select (instante at time zone 'America/Sao_Paulo')::date $$;

-- ---------------------------------------------------------------------
-- 2. Tabelas diárias (só números)
-- ---------------------------------------------------------------------
create table public.anuncios_numeros_dia (
  anuncio_id         uuid not null references public.anuncios(id) on delete cascade,
  dia                date not null,
  aparicoes          integer not null default 0 check (aparicoes >= 0),
  soma_posicao       bigint not null default 0 check (soma_posicao >= 0),
  visualizacoes      integer not null default 0 check (visualizacoes >= 0),
  cliques_whatsapp   integer not null default 0 check (cliques_whatsapp >= 0),
  compartilhamentos  integer not null default 0 check (compartilhamentos >= 0),
  favoritos          integer not null default 0 check (favoritos >= 0),
  primary key (anuncio_id, dia)
);
create index anuncios_numeros_dia_dia_idx on public.anuncios_numeros_dia (dia);

-- Termo já normalizado (minúsculas, sem acento, só letras e números separados por espaço, até 60).
create table public.anuncios_termos_dia (
  anuncio_id  uuid not null references public.anuncios(id) on delete cascade,
  dia         date not null,
  termo       text not null check (char_length(termo) between 1 and 60 and termo ~ '^[a-z0-9]+( [a-z0-9]+)*$'),
  vezes       integer not null default 0 check (vezes >= 0),
  primary key (anuncio_id, dia, termo)
);
create index anuncios_termos_dia_dia_idx on public.anuncios_termos_dia (dia);

create table public.anuncios_aparicoes_dia (
  anuncio_id    uuid not null references public.anuncios(id) on delete cascade,
  dia           date not null,
  pagina        text not null check (pagina in ('inicio', 'busca', 'categoria', 'loja')),
  aparicoes     integer not null default 0 check (aparicoes >= 0),
  soma_posicao  bigint not null default 0 check (soma_posicao >= 0),
  primary key (anuncio_id, dia, pagina)
);

-- Leitura: o dono vê só os próprios anúncios; o administrador vê todos. Escrita: só funções e gatilhos.
alter table public.anuncios_numeros_dia enable row level security;
alter table public.anuncios_termos_dia enable row level security;
alter table public.anuncios_aparicoes_dia enable row level security;
create policy "numeros dia leitura" on public.anuncios_numeros_dia for select using (
  public.e_admin() or exists (select 1 from public.anuncios a join public.vitrines_lojas v on v.id = a.vitrine_id
     where a.id = anuncio_id and v.dono_id = public.usuario_id()));
create policy "termos dia leitura" on public.anuncios_termos_dia for select using (
  public.e_admin() or exists (select 1 from public.anuncios a join public.vitrines_lojas v on v.id = a.vitrine_id
     where a.id = anuncio_id and v.dono_id = public.usuario_id()));
create policy "aparicoes dia leitura" on public.anuncios_aparicoes_dia for select using (
  public.e_admin() or exists (select 1 from public.anuncios a join public.vitrines_lojas v on v.id = a.vitrine_id
     where a.id = anuncio_id and v.dono_id = public.usuario_id()));
revoke all on public.anuncios_numeros_dia, public.anuncios_termos_dia, public.anuncios_aparicoes_dia from anon, authenticated;
grant select on public.anuncios_numeros_dia, public.anuncios_termos_dia, public.anuncios_aparicoes_dia to authenticated;

-- Cada evento soma no dia dele (usado pelo gatilho e pelo preenchimento).
create function public.contar_evento_dia() returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.anuncios_numeros_dia as n (anuncio_id, dia, visualizacoes, cliques_whatsapp, compartilhamentos, favoritos)
  values (new.anuncio_id, public.dia_metrica(new.criado_em),
          (new.tipo = 'visualizacao')::int, (new.tipo = 'clique_whatsapp')::int,
          (new.tipo = 'compartilhar')::int, (new.tipo = 'favoritar')::int)
  on conflict (anuncio_id, dia) do update set
    visualizacoes     = n.visualizacoes + excluded.visualizacoes,
    cliques_whatsapp  = n.cliques_whatsapp + excluded.cliques_whatsapp,
    compartilhamentos = n.compartilhamentos + excluded.compartilhamentos,
    favoritos         = n.favoritos + excluded.favoritos;
  return null;
end $$;

-- Recalcula os números de evento a partir de eventos_anuncio (idempotente: troca, não soma).
create function public.preencher_numeros_dia() returns integer
language plpgsql security definer
set search_path = public
as $$
declare total integer;
begin
  insert into public.anuncios_numeros_dia as n (anuncio_id, dia, visualizacoes, cliques_whatsapp, compartilhamentos, favoritos)
  select e.anuncio_id, public.dia_metrica(e.criado_em),
         count(*) filter (where e.tipo = 'visualizacao'),
         count(*) filter (where e.tipo = 'clique_whatsapp'),
         count(*) filter (where e.tipo = 'compartilhar'),
         count(*) filter (where e.tipo = 'favoritar')
    from public.eventos_anuncio e
   group by e.anuncio_id, public.dia_metrica(e.criado_em)
  on conflict (anuncio_id, dia) do update set
    visualizacoes     = excluded.visualizacoes,
    cliques_whatsapp  = excluded.cliques_whatsapp,
    compartilhamentos = excluded.compartilhamentos,
    favoritos         = excluded.favoritos;
  get diagnostics total = row_count;
  return total;
end $$;
revoke all on function public.preencher_numeros_dia() from public, anon, authenticated;
select public.preencher_numeros_dia();
create trigger eventos_anuncio_contar_dia after insert on public.eventos_anuncio
  for each row execute function public.contar_evento_dia();

-- Favoritar conta (o banco grava; o cliente não consegue mandar esse tipo). O dono não conta.
create function public.contar_favorito_metrica() returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.anuncios a join public.vitrines_lojas v on v.id = a.vitrine_id
                  where a.id = new.anuncio_id and v.dono_id = new.usuario_id) then
    insert into public.eventos_anuncio (anuncio_id, tipo) values (new.anuncio_id, 'favoritar');
  end if;
  return null;
end $$;
create trigger favoritos_contar_metrica after insert on public.favoritos
  for each row execute function public.contar_favorito_metrica();

-- Forma de um termo: minúsculas, sem acento, só letras e números separados por um espaço, até 60 letras.
-- Igual à função normalizarTermo() de src/lib/metricas/termos.ts (tests/metricas.test.cjs).
create function public.normaliza_termo(texto text) returns text
language sql immutable
set search_path = public
as $$
  select nullif(btrim(left(btrim(regexp_replace(
           translate(lower(coalesce(texto, '')), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn'),
           '[^a-z0-9]+', ' ', 'g')), 60)), '')
$$;

-- Termo: só conta quando a visualização conta (mesmas regras de repetição, dono e anúncio fora do ar).
-- A versão de 4 argumentos sai: senão as chamadas com 2 ou 3 argumentos ficam ambíguas.
drop function public.registrar_evento(uuid, text, text, text);
create function public.registrar_evento(anuncio_id uuid, tipo text, visitante text default null, usuario text default null, termo text default null)
returns boolean language plpgsql security definer
set search_path = public
as $$
declare
  a        record;
  servidor boolean := coalesce(auth.role(), '') = 'service_role';
  ip       inet := public.ip_requisicao();
  uid      text;
  chave    text;
  h        text;
  janela   integer;
  t        text;
begin
  if coalesce(registrar_evento.tipo, '') not in ('visualizacao', 'clique_whatsapp', 'compartilhar') then
    return false;                                   -- tipo desconhecido: ignora
  end if;
  uid := case when servidor then nullif(btrim(registrar_evento.usuario), '') else public.usuario_id() end;
  chave := case when servidor and nullif(btrim(registrar_evento.visitante), '') is not null
                then 'v:' || left(btrim(registrar_evento.visitante), 200)
                else host(ip) end;
  select x.id, x.status, x.microrregiao_id, v.dono_id into a
    from public.anuncios x join public.vitrines_lojas v on v.id = x.vitrine_id
   where x.id = registrar_evento.anuncio_id;
  if a.id is null or a.status <> 'ativo' then return false; end if;
  if a.dono_id = uid then return false; end if;       -- o próprio vendedor não conta

  if chave is not null or uid is not null then
    h := left(encode(sha256(convert_to(
           coalesce(chave, '') || '|' || coalesce(uid, '') || '|' || current_date::text, 'UTF8')), 'hex'), 32);
    janela := coalesce(public.numero_ou_nulo(public.config('eventos.repetir_apos_minutos', a.microrregiao_id, '30')), 30)::int;
    if exists (select 1 from public.eventos_anuncio e
                where e.anuncio_id = a.id and e.tipo = registrar_evento.tipo and e.visitante_hash = h
                  and e.criado_em > now() - make_interval(mins => janela)) then
      return false;
    end if;
  end if;

  insert into public.eventos_anuncio (anuncio_id, tipo, visitante_hash) values (a.id, registrar_evento.tipo, h);
  if registrar_evento.tipo in ('visualizacao', 'clique_whatsapp') then
    perform set_config('olaki.sistema', '1', true);   -- libera contador protegido
    update public.anuncios x
       set visualizacoes    = x.visualizacoes    + case when registrar_evento.tipo = 'visualizacao'    then 1 else 0 end,
           cliques_whatsapp = x.cliques_whatsapp + case when registrar_evento.tipo = 'clique_whatsapp' then 1 else 0 end
     where x.id = a.id;
    perform set_config('olaki.sistema', '', true);
  end if;
  -- Termo de busca: só com a visualização que acabou de contar. Sem ligação com a pessoa.
  if registrar_evento.tipo = 'visualizacao' then
    t := public.normaliza_termo(registrar_evento.termo);
    if t is not null then
      insert into public.anuncios_termos_dia (anuncio_id, dia, termo, vezes)
      values (a.id, public.dia_metrica(now()), t, 1)
      on conflict on constraint anuncios_termos_dia_pkey do update set vezes = anuncios_termos_dia.vezes + 1;
    end if;
  end if;
  return true;
end $$;
revoke all on function public.registrar_evento(uuid, text, text, text, text) from public;
grant execute on function public.registrar_evento(uuid, text, text, text, text) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- 3. Aparições (lista de cards: busca, categoria, início e loja)
-- ---------------------------------------------------------------------
-- Só o servidor do site chama. Soma no dia: quantas vezes apareceu e a soma das posições
-- (média = soma / aparições). No máximo 60 anúncios por chamada; o dono do anúncio não conta.
create function public.registrar_aparicoes(p_pagina text, p_itens jsonb, p_usuario text default null)
returns integer language plpgsql security definer
set search_path = public
as $$
declare
  r     record;
  total integer := 0;
begin
  if coalesce(auth.role(), '') <> 'service_role' and session_user not in ('postgres', 'supabase_admin') then
    raise exception 'Acesso restrito.' using errcode = '42501';
  end if;
  if coalesce(p_pagina, '') not in ('inicio', 'busca', 'categoria', 'loja') or jsonb_typeof(p_itens) is distinct from 'array' then
    return 0;
  end if;
  for r in
    with brutos as (
      select x->>'id' as id, x->>'posicao' as pos
        from jsonb_array_elements(p_itens) with ordinality as t(x, n)
       where t.n <= 60
    ), validos as (
      select b.id::uuid as anuncio_id, least(greatest(b.pos::integer, 1), 500) as posicao
        from brutos b
       where b.id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
         and b.pos ~ '^[0-9]{1,3}$'
    ), ativos as (
      select v.anuncio_id, v.posicao
        from validos v
        join public.anuncios a on a.id = v.anuncio_id
        join public.vitrines_lojas l on l.id = a.vitrine_id
       where a.status = 'ativo' and l.dono_id is distinct from nullif(btrim(p_usuario), '')
    )
    select anuncio_id, count(*)::integer as n, sum(posicao)::bigint as soma from ativos group by anuncio_id
  loop
    insert into public.anuncios_numeros_dia as d (anuncio_id, dia, aparicoes, soma_posicao)
    values (r.anuncio_id, public.dia_metrica(now()), r.n, r.soma)
    on conflict on constraint anuncios_numeros_dia_pkey do update set
      aparicoes = d.aparicoes + excluded.aparicoes,
      soma_posicao = d.soma_posicao + excluded.soma_posicao;
    insert into public.anuncios_aparicoes_dia as p (anuncio_id, dia, pagina, aparicoes, soma_posicao)
    values (r.anuncio_id, public.dia_metrica(now()), p_pagina, r.n, r.soma)
    on conflict on constraint anuncios_aparicoes_dia_pkey do update set
      aparicoes = p.aparicoes + excluded.aparicoes,
      soma_posicao = p.soma_posicao + excluded.soma_posicao;
    total := total + 1;
  end loop;
  return total;
end $$;
revoke all on function public.registrar_aparicoes(text, jsonb, text) from public, anon, authenticated;
grant execute on function public.registrar_aparicoes(text, jsonb, text) to service_role;

-- ---------------------------------------------------------------------
-- 4. Tempo até sair: data em que o anúncio deixou de estar 'ativo'
-- ---------------------------------------------------------------------
-- Vendido, pausado, expirado ou excluído: o momento em que saiu. Volta a 'ativo' = limpa.
-- O primeiro momento em que saiu é mantido (ex.: pausado e depois excluído).
-- O valor é sempre o do banco, mesmo se alguém tentar gravar outro pela API.
alter table public.anuncios add column saiu_do_ar_em timestamptz;

-- Preenche os anúncios que já estavam fora do ar, antes de existir o gatilho.
-- Vendido e excluído têm data própria; pausado/expirado usam a última alteração (aproximação).
update public.anuncios
   set saiu_do_ar_em = coalesce(vendido_em, excluido_em, atualizado_em, criado_em)
 where status <> 'ativo' and publicado_em is not null and saiu_do_ar_em is null;

create function public.marcar_saida_anuncio() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'ativo' then
    new.saiu_do_ar_em := null;
  elsif old.status = 'ativo' then
    new.saiu_do_ar_em := now();
  else
    new.saiu_do_ar_em := old.saiu_do_ar_em;
  end if;
  return new;
end $$;
-- Gatilho criado depois do preenchimento acima, para o preenchimento não ser desfeito.
create trigger z_anuncio_saiu_do_ar before update on public.anuncios
  for each row execute function public.marcar_saida_anuncio();

-- ---------------------------------------------------------------------
-- 5. Leituras
-- ---------------------------------------------------------------------
-- Uso interno: números de um período (7, 30 ou 90 dias, até hoje), por anúncio.
-- Entra o anúncio que já foi ao ar e que está no ar, saiu no período ou teve número no período.
create function public.metricas_produtos_periodo(p_dias integer, p_vitrine uuid default null)
returns table (
  anuncio_id uuid, titulo text, foto text, status text,
  vitrine_id uuid, vitrine_nome text, categoria_id uuid, categoria_nome text,
  microrregiao_id uuid, regiao_nome text,
  aparicoes bigint, soma_posicao bigint, visualizacoes bigint, cliques_whatsapp bigint,
  compartilhamentos bigint, favoritos bigint, tempo_ate_sair_dias integer, termos jsonb)
language sql stable
set search_path = public
as $$
  with p as (select public.dia_metrica(now()) - (p_dias - 1) as ini)
  select a.id, a.titulo, a.fotos[1], a.status::text,
         v.id, v.nome, c.id, c.nome, m.id, m.nome,
         coalesce(sum(d.aparicoes), 0), coalesce(sum(d.soma_posicao), 0), coalesce(sum(d.visualizacoes), 0),
         coalesce(sum(d.cliques_whatsapp), 0), coalesce(sum(d.compartilhamentos), 0), coalesce(sum(d.favoritos), 0),
         case when a.saiu_do_ar_em is not null and a.publicado_em is not null
              then floor(extract(epoch from (a.saiu_do_ar_em - a.publicado_em)) / 86400)::integer end,
         coalesce((select jsonb_agg(jsonb_build_object('termo', t.termo, 'vezes', t.vezes) order by t.vezes desc, t.termo)
                     from (select tt.termo, sum(tt.vezes)::integer as vezes
                             from public.anuncios_termos_dia tt
                            where tt.anuncio_id = a.id and tt.dia >= p.ini
                            group by tt.termo
                            order by sum(tt.vezes) desc, tt.termo
                            limit 3) t), '[]'::jsonb)
    from public.anuncios a
    join public.vitrines_lojas v on v.id = a.vitrine_id
    left join public.categorias c on c.id = a.categoria_id
    left join public.microrregioes m on m.id = a.microrregiao_id
    cross join p
    left join public.anuncios_numeros_dia d on d.anuncio_id = a.id and d.dia >= p.ini
   where a.publicado_em is not null
     and (p_vitrine is null or a.vitrine_id = p_vitrine)
     and (a.status = 'ativo'
          or (a.saiu_do_ar_em at time zone 'America/Sao_Paulo')::date >= p.ini
          or exists (select 1 from public.anuncios_numeros_dia x where x.anuncio_id = a.id and x.dia >= p.ini))
   group by a.id, v.id, c.id, m.id, p.ini
$$;
revoke all on function public.metricas_produtos_periodo(integer, uuid) from public, anon, authenticated;

-- Dono da loja: um produto por linha, com os números do período (7, 30 ou 90 dias; padrão 30).
create function public.minha_loja_metricas_produtos(p_vitrine uuid, p_dias integer default 30)
returns jsonb language plpgsql stable security definer
set search_path = public
as $$
declare
  periodo integer := case when p_dias in (7, 30, 90) then p_dias else 30 end;
begin
  if not exists (select 1 from public.vitrines_lojas where id = p_vitrine and dono_id = public.usuario_id() and tipo = 'loja') then
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

-- Administrador: "produto" (30 mais vistos), "categoria" ou "regiao" (somas por grupo).
create function public.admin_metricas_produtos(p_dias integer default 30, p_visao text default 'produto')
returns jsonb language plpgsql stable security definer
set search_path = public
as $$
declare
  periodo integer := case when p_dias in (7, 30, 90) then p_dias else 30 end;
begin
  if not public.e_admin() then
    raise exception using errcode = '42501', message = 'Acesso restrito.';
  end if;
  if p_visao in ('categoria', 'regiao') then
    return coalesce((
      select jsonb_agg(jsonb_build_object(
          'rotulo', g.rotulo, 'produtos', g.produtos, 'aparicoes', g.aparicoes,
          'visualizacoes', g.visualizacoes, 'cliques_whatsapp', g.cliques_whatsapp, 'favoritos', g.favoritos,
          'posicao_media', case when g.aparicoes > 0 then round(g.soma_posicao::numeric / g.aparicoes, 1) end,
          'pct_chamou', case when g.visualizacoes > 0 then least(100, round(100.0 * g.cliques_whatsapp / g.visualizacoes)) end,
          'tempo_medio_dias', g.tempo_medio_dias)
        order by g.visualizacoes desc, g.rotulo)
        from (select case when p_visao = 'categoria' then coalesce(m.categoria_nome, 'Sem categoria')
                          else coalesce(m.regiao_nome, 'Sem região') end as rotulo,
                     count(*) as produtos,
                     sum(m.aparicoes) as aparicoes, sum(m.soma_posicao) as soma_posicao,
                     sum(m.visualizacoes) as visualizacoes, sum(m.cliques_whatsapp) as cliques_whatsapp,
                     sum(m.favoritos) as favoritos,
                     round(avg(m.tempo_ate_sair_dias), 1) as tempo_medio_dias
                from public.metricas_produtos_periodo(periodo) m
               group by 1) g), '[]'::jsonb);
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
        'anuncio_id', m.anuncio_id, 'titulo', m.titulo, 'status', m.status,
        'loja', m.vitrine_nome, 'categoria', coalesce(m.categoria_nome, 'Sem categoria'),
        'regiao', coalesce(m.regiao_nome, 'Sem região'),
        'aparicoes', m.aparicoes, 'visualizacoes', m.visualizacoes,
        'cliques_whatsapp', m.cliques_whatsapp, 'favoritos', m.favoritos,
        'pct_chamou', case when m.visualizacoes > 0 then least(100, round(100.0 * m.cliques_whatsapp / m.visualizacoes)) end,
        'termos', m.termos, 'tempo_ate_sair_dias', m.tempo_ate_sair_dias)
      order by m.visualizacoes desc, m.cliques_whatsapp desc, m.titulo, m.anuncio_id)
      from (select * from public.metricas_produtos_periodo(periodo)
             order by visualizacoes desc, cliques_whatsapp desc, titulo, anuncio_id limit 30) m), '[]'::jsonb);
end $$;

revoke all on function public.minha_loja_metricas_produtos(uuid, integer), public.admin_metricas_produtos(integer, text) from public, anon;
grant execute on function public.minha_loja_metricas_produtos(uuid, integer), public.admin_metricas_produtos(integer, text) to authenticated;
revoke all on function public.contar_evento_dia(), public.contar_favorito_metrica(), public.marcar_saida_anuncio() from public, anon, authenticated;
