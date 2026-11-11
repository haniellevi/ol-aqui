-- Vitrine com IA, etapa 4: categorização com IA (docs/PLANO-VITRINE-IA.md).
-- 1. Lote: de tempos em tempos o servidor pega até 20 anúncios de lojas, a IA sugere uma categoria
--    da lista e o banco guarda como "pendente". O lojista confirma com 1 toque ("Revise suas categorias").
--    Anúncio novo entra no próximo lote sozinho. Cada anúncio passa pela IA uma vez.
-- 2. Nicho da loja: sugerido pela categoria principal mais comum dos produtos (sem custo de IA).
-- 3. O dono decide: uma sugestão, todas de uma vez ou o nicho.
-- Só roda com vitrine_ia.categorizacao_ativa = true (desligada: medir o custo com 20 anúncios antes).
-- O custo entra em robo_uso (tipo categorizacao) e respeita o orçamento mensal do robô.

alter table public.robo_uso drop constraint robo_uso_tipo_check;
alter table public.robo_uso add constraint robo_uso_tipo_check
  check (tipo in ('conversa', 'foto', 'teste', 'moderacao', 'categorizacao'));

insert into public.configuracoes (chave, valor, grupo, publico, descricao)
select x.chave, x.valor, 'vitrine', false, x.descricao
  from (values
    ('vitrine_ia.categorizacao_ativa', 'false'::jsonb, 'Liga a IA que sugere categorias aos anúncios das lojas'),
    ('vitrine_ia.categorizacao_por_dia', '300'::jsonb, 'Quantos anúncios a IA de categorias avalia por dia, no máximo')
  ) as x(chave, valor, descricao)
 where not exists (select 1 from public.configuracoes c where c.chave = x.chave and c.microrregiao_id is null);

-- Cada chamada à IA (um lote). Só a equipe lê.
create table public.categorizacao_ia (
  id            uuid primary key default gen_random_uuid(),
  reserva       uuid not null default gen_random_uuid(),
  uso_id        bigint references public.robo_uso(id) on delete set null,
  anuncios      uuid[] not null,
  estado        text not null default 'processando' check (estado in ('processando', 'concluido', 'falhou')),
  sugeridos     integer not null default 0 check (sugeridos >= 0),
  criado_em     timestamptz not null default now(),
  concluido_em  timestamptz
);
create index categorizacao_ia_dia_idx on public.categorizacao_ia (criado_em);
alter table public.categorizacao_ia enable row level security;
create policy "categorizacao ia admin leitura" on public.categorizacao_ia for select using (public.e_admin());
revoke all on public.categorizacao_ia from anon, authenticated;
grant select on public.categorizacao_ia to authenticated;

-- Folhas da árvore que aceitam anúncio (a IA só escolhe entre elas).
create function public.categoria_folha_disponivel(p_categoria uuid)
returns boolean language sql stable
set search_path = public
as $$
  select public.categoria_disponivel(p_categoria)
     and not exists (select 1 from public.categorias f where f.pai_id = p_categoria and public.categoria_disponivel(f.id))
$$;

-- Anúncios que ainda não passaram pela IA (lojas no ar, anúncio no ar).
create function public.categorizacao_ia_tem_trabalho()
returns boolean language sql stable
set search_path = public
as $$
  select exists (
    select 1 from public.anuncios a join public.vitrines_lojas v on v.id = a.vitrine_id
     where a.status = 'ativo' and a.categoria_sugerida_em is null and a.categoria_sugestao_estado is null
       and v.tipo = 'loja' and v.status = 'ativa')
  -- Lote travado também é trabalho: a reserva seguinte devolve os anúncios dele para a fila.
  or exists (select 1 from public.categorizacao_ia c
              where c.estado = 'processando' and c.criado_em < now() - interval '10 minutes')
$$;

-- ---------------------------------------------------------------------
-- 1. Lote da IA
-- ---------------------------------------------------------------------
create function public.categorizacao_ia_reservar()
returns jsonb language plpgsql security definer
set search_path = public, extensions
as $$
declare
  ids uuid[];
  cot numeric; orc numeric; gasto numeric; reserva_custo numeric; por_dia numeric;
  uid bigint;
  j public.categorizacao_ia;
begin
  if coalesce(auth.role(), '') <> 'service_role' and session_user not in ('postgres', 'supabase_admin') then
    raise exception 'Acesso restrito.' using errcode = '42501';
  end if;
  if public.config('vitrine_ia.categorizacao_ativa', null, 'false') is distinct from 'true'::jsonb then
    return null;
  end if;
  -- Lote que travou (o servidor caiu no meio): os anúncios voltam para a fila.
  update public.anuncios set categoria_sugerida_em = null
   where categoria_sugestao_estado is null
     and id in (select unnest(c.anuncios) from public.categorizacao_ia c
                 where c.estado = 'processando' and c.criado_em < now() - interval '10 minutes');
  update public.categorizacao_ia set estado = 'falhou', concluido_em = now()
   where estado = 'processando' and criado_em < now() - interval '10 minutes';

  por_dia := coalesce(public.numero_ou_nulo(public.config('vitrine_ia.categorizacao_por_dia', null, '300')), 0);
  if (select coalesce(sum(cardinality(c.anuncios)), 0) from public.categorizacao_ia c
       where c.criado_em >= public.robo_inicio('dia')) >= por_dia then
    return null;
  end if;

  select array_agg(x.id) into ids from (
    select a.id from public.anuncios a join public.vitrines_lojas v on v.id = a.vitrine_id
     where a.status = 'ativo' and a.categoria_sugerida_em is null and a.categoria_sugestao_estado is null
       and v.tipo = 'loja' and v.status = 'ativa'
     order by a.publicado_em desc nulls last, a.id
     limit 20
     for update of a skip locked) x;
  if ids is null then return null; end if;

  cot := public.numero_ou_nulo(public.config('robo.cotacao_dolar', null, 'null'));
  orc := public.numero_ou_nulo(public.config('robo.orcamento_mensal_centavos', null, 'null'));
  -- US$ 0,05 cobre com folga 20 anúncios curtos e a lista de categorias no modelo barato.
  reserva_custo := 0.05 * cot * 100;
  -- Mesma trava do orçamento da moderação e do Aki: duas reservas ao mesmo tempo não passam do limite do mês.
  perform pg_advisory_xact_lock(hashtext('robo_uso:orcamento'));
  select coalesce(sum(custo_centavos), 0) into gasto from public.robo_uso where criado_em >= public.robo_inicio('mes');
  if cot is null or cot <= 0 or orc is null or orc < 0 or gasto + reserva_custo > orc then
    return null;
  end if;

  insert into public.robo_uso (usuario_id, microrregiao_id, tipo, provedor, modelo, custo_centavos, cotacao_dolar, erro)
  values (null, null, 'categorizacao', 'openrouter', 'openai/gpt-4.1-mini', reserva_custo, cot, 'em_andamento')
  returning id into uid;
  update public.anuncios set categoria_sugerida_em = now() where id = any(ids);
  insert into public.categorizacao_ia (anuncios, uso_id) values (ids, uid) returning * into j;

  -- Só título, descrição curta e categoria atual: nada da pessoa nem da loja vai para a IA.
  return jsonb_build_object(
    'id', j.id, 'reserva', j.reserva, 'modelo', 'openai/gpt-4.1-mini',
    'anuncios', (select jsonb_agg(jsonb_build_object('id', a.id, 'titulo', a.titulo,
                                    'descricao', left(coalesce(a.descricao, ''), 400), 'categoria', c.slug) order by a.id)
                   from public.anuncios a left join public.categorias c on c.id = a.categoria_id
                  where a.id = any(ids)),
    'categorias', (select jsonb_agg(jsonb_build_object('slug', c.slug,
                                      'nome', case when p.id is null then c.nome else p.nome || ' > ' || c.nome end)
                                    order by p.ordem nulls first, c.ordem, c.slug)
                     from public.categorias c left join public.categorias p on p.id = c.pai_id
                    where public.categoria_folha_disponivel(c.id)));
end $$;

-- Guarda as sugestões. Devolve quantas viraram "pendente" (null = lote desconhecido ou já fechado).
create function public.categorizacao_ia_concluir(p_id uuid, p_reserva uuid, p_sugestoes jsonb,
  p_custo_usd numeric default null, p_tokens_entrada integer default 0, p_tokens_saida integer default 0)
returns integer language plpgsql security definer
set search_path = public, extensions
as $$
declare
  j public.categorizacao_ia;
  e jsonb;
  aid uuid; cid uuid; conf numeric;
  n integer := 0;
  lojas uuid[] := '{}';
  l record;
begin
  if coalesce(auth.role(), '') <> 'service_role' and session_user not in ('postgres', 'supabase_admin') then
    raise exception 'Acesso restrito.' using errcode = '42501';
  end if;
  select * into j from public.categorizacao_ia where id = p_id for update;
  if j.id is null or j.estado <> 'processando' or j.reserva is distinct from p_reserva then return null; end if;

  -- Custo ausente ou fora do esperado mantém a reserva (como na moderação).
  update public.robo_uso set
    custo_centavos = case when p_custo_usd >= 0 and p_custo_usd <= 0.05 then round(p_custo_usd * cotacao_dolar * 100, 4) else custo_centavos end,
    tokens_entrada = greatest(coalesce(p_tokens_entrada, 0), 0), tokens_saida = greatest(coalesce(p_tokens_saida, 0), 0),
    erro = case when p_custo_usd >= 0 and p_custo_usd <= 0.05 then null else 'custo_indeterminado' end
   where id = j.uso_id;

  -- IA falhou: os anúncios voltam para a fila (o limite diário segura repetições).
  if p_sugestoes is null or jsonb_typeof(p_sugestoes) <> 'array' then
    update public.anuncios set categoria_sugerida_em = null
     where id = any(j.anuncios) and categoria_sugestao_estado is null;
    update public.categorizacao_ia set estado = 'falhou', concluido_em = now() where id = j.id;
    return 0;
  end if;

  for e in select value from jsonb_array_elements(p_sugestoes) limit 50 loop
    continue when jsonb_typeof(e) <> 'object'
      or coalesce(e->>'anuncio_id', '') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
    aid := (e->>'anuncio_id')::uuid;
    continue when not (aid = any(j.anuncios));
    conf := public.numero_ou_nulo(e->'confianca');
    continue when conf is null or conf < 0.8 or conf > 1;
    select c.id into cid from public.categorias c
     where c.slug = e->>'categoria' and public.categoria_folha_disponivel(c.id);
    continue when cid is null;
    update public.anuncios
       set categoria_sugerida_id = cid, categoria_sugestao_estado = 'pendente', categoria_sugerida_em = now()
     where id = aid and status = 'ativo' and categoria_sugestao_estado is null and categoria_id is distinct from cid;
    if found then
      n := n + 1;
      lojas := lojas || (select vitrine_id from public.anuncios where id = aid);
    end if;
  end loop;

  -- Nicho: loja do lote, sem nicho e sem sugestão ainda, recebe a categoria principal mais comum
  -- de TODOS os produtos no ar dela (não só os deste lote).
  update public.vitrines_lojas v
     set nicho_sugerido_id = s.raiz, nicho_sugerido_em = now()
    from (select distinct on (a.vitrine_id) a.vitrine_id, coalesce(c.pai_id, c.id) as raiz
            from public.anuncios a join public.categorias c on c.id = coalesce(a.categoria_sugerida_id, a.categoria_id)
           where a.vitrine_id in (select b.vitrine_id from public.anuncios b where b.id = any(j.anuncios)) and a.status = 'ativo'
           group by a.vitrine_id, coalesce(c.pai_id, c.id)
           order by a.vitrine_id, count(*) desc, coalesce(c.pai_id, c.id)) s
   where v.id = s.vitrine_id and v.nicho_id is null and v.nicho_sugerido_id is null and v.nicho_sugerido_em is null
     and exists (select 1 from public.categorias r where r.id = s.raiz and r.pai_id is null and public.categoria_disponivel(r.id));

  -- Aviso no sino, no máximo um por loja por semana, só onde a vitrine nova está ligada (chave da região da loja).
  for l in select v.id, v.dono_id, count(*) as total
             from public.vitrines_lojas v join public.anuncios a on a.vitrine_id = v.id
            where v.id = any(lojas) and a.categoria_sugestao_estado = 'pendente' and a.status = 'ativo'
              and public.config('vitrine_ia.ativa', v.microrregiao_id, 'false') = 'true'::jsonb
            group by v.id, v.dono_id loop
    perform public.notificar(l.dono_id, 'categorias_revisar', 'Revise as categorias dos seus produtos',
        case when l.total = 1 then 'Sugerimos uma categoria melhor para 1 produto. Confira e confirme com 1 toque.'
             else 'Sugerimos categorias melhores para ' || l.total || ' produtos. Confira e confirme com 1 toque.' end,
        '/minha-conta/loja/categorias', 'categorias_revisar:' || l.id || ':' || to_char(now(), 'IYYY-IW'),
        jsonb_build_object('vitrine_id', l.id, 'total', l.total));
  end loop;

  update public.categorizacao_ia set estado = 'concluido', sugeridos = n, concluido_em = now() where id = j.id;
  return n;
end $$;

-- ---------------------------------------------------------------------
-- 2. O dono decide
-- ---------------------------------------------------------------------
-- Todas as sugestões pendentes da loja de uma vez. Devolve quantas foram decididas.
create function public.decidir_todas_categorias(p_vitrine uuid, p_aceitar boolean)
returns integer language plpgsql security definer
set search_path = public
as $$
declare
  a record;
  n integer := 0;
begin
  if not exists (select 1 from public.vitrines_lojas where id = p_vitrine and dono_id = public.usuario_id()) then
    raise exception using errcode = '42501', message = 'Loja não encontrada.';
  end if;
  for a in select x.id from public.anuncios x
            where x.vitrine_id = p_vitrine and x.categoria_sugestao_estado = 'pendente' and x.status <> 'excluido'
            order by x.categoria_sugerida_em, x.id limit 500 loop
    begin
      perform public.decidir_categoria_sugerida(a.id, p_aceitar);
      n := n + 1;
    exception when sqlstate '22023' or sqlstate '42501' then
      null; -- congelado ou categoria que saiu do ar: fica para decidir um por um
    end;
  end loop;
  return n;
end $$;

-- Nicho da loja: aceita a sugestão, escolhe outro (p_nicho) ou dispensa a sugestão (p_nicho nulo).
create function public.definir_nicho_loja(p_vitrine uuid, p_nicho uuid)
returns void language plpgsql security definer
set search_path = public
as $$
declare
  v public.vitrines_lojas;
begin
  select * into v from public.vitrines_lojas where id = p_vitrine and dono_id = public.usuario_id() for update;
  if not found then
    raise exception using errcode = '42501', message = 'Loja não encontrada.';
  end if;
  if v.status = 'suspensa' then
    raise exception using errcode = '42501', message = 'Loja suspensa. Fale com o suporte.';
  end if;
  if p_nicho is null then
    update public.vitrines_lojas set nicho_sugerido_id = null, nicho_sugerido_em = coalesce(nicho_sugerido_em, now())
     where id = v.id;
  else
    -- O gatilho validar_nicho_loja confere se é uma categoria principal disponível.
    update public.vitrines_lojas set nicho_id = p_nicho, nicho_sugerido_id = null,
           nicho_sugerido_em = coalesce(nicho_sugerido_em, now())
     where id = v.id;
  end if;
end $$;

-- Lista fixa de nichos para o dono escolher.
create function public.nichos_disponiveis()
returns table (id uuid, nome text)
language sql stable security definer
set search_path = public
as $$
  select c.id, c.nome from public.categorias c
   where c.pai_id is null and public.categoria_disponivel(c.id)
   order by c.ordem, c.nome
$$;

-- ---------------------------------------------------------------------
-- 3. Rotina: a cada 5 minutos, se houver trabalho e a chave estiver ligada
-- ---------------------------------------------------------------------
-- Usa o mesmo segredo interno da moderação (cofre olaki_moderacao_ia_token / MODERACAO_IA_SECRET).
create function public.categorizacao_ia_disparar()
returns bigint language plpgsql security definer
set search_path = public, extensions
as $$
declare
  segredo text;
  pedido bigint;
begin
  if public.config('vitrine_ia.categorizacao_ativa', null, 'false') is distinct from 'true'::jsonb
     or not public.categorizacao_ia_tem_trabalho() then
    return null;
  end if;
  select decrypted_secret into segredo from vault.decrypted_secrets where name = 'olaki_moderacao_ia_token';
  if segredo is null or length(segredo) < 32 then return null; end if;
  select net.http_post(url := 'https://ol-aqui.vercel.app/api/interno/categorizacao',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || segredo),
    body := '{}'::jsonb, timeout_milliseconds := 60000) into pedido;
  return pedido;
end $$;

-- Novo aviso que o lojista pode ligar ou desligar.
update public.configuracoes
   set valor = valor || '["categorias_revisar"]'::jsonb
 where chave = 'radar.avisos_escolha' and jsonb_typeof(valor) = 'array' and not (valor ? 'categorias_revisar');

-- ---------------------------------------------------------------------
-- 4. Permissões
-- ---------------------------------------------------------------------
revoke all on function public.categoria_folha_disponivel(uuid), public.categorizacao_ia_tem_trabalho(),
  public.categorizacao_ia_reservar(), public.categorizacao_ia_concluir(uuid, uuid, jsonb, numeric, integer, integer),
  public.categorizacao_ia_disparar() from public, anon, authenticated;
grant execute on function public.categorizacao_ia_reservar(), public.categorizacao_ia_concluir(uuid, uuid, jsonb, numeric, integer, integer),
  public.categorizacao_ia_disparar() to service_role;
revoke all on function public.decidir_todas_categorias(uuid, boolean), public.definir_nicho_loja(uuid, uuid),
  public.nichos_disponiveis() from public, anon;
grant execute on function public.decidir_todas_categorias(uuid, boolean), public.definir_nicho_loja(uuid, uuid),
  public.nichos_disponiveis() to authenticated;

do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') and exists (select 1 from pg_extension where extname = 'pg_net') then
    perform cron.schedule('olaki-categorizacao-ia', '*/5 * * * *', 'select public.categorizacao_ia_disparar()');
  end if;
end $$;
