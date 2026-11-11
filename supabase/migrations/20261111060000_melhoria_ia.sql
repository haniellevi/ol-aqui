-- Vitrine com IA, etapa 5b: a IA sugere título e descrição melhores e orienta sobre as fotos
-- (docs/PLANO-VITRINE-IA.md). A IA não altera nenhuma foto: só diz o problema e como tirar outra.
-- 1. O lojista pede a sugestão de um produto (limite por mês conforme o plano: vitrine_ia.melhorias_mes).
-- 2. O servidor chama o modelo barato e o banco confere tudo de novo ao guardar.
-- 3. O lojista vê o antes e o depois e decide. Ao aceitar, o texto muda pelo UPDATE comum do anúncio,
--    então os filtros de moderação (termos sensíveis, palavras bloqueadas) continuam valendo.
-- Só funciona com vitrine_ia.ativa e vitrine_ia.melhoria_ativa ligadas na região da loja.
-- O custo entra em robo_uso (tipo melhoria) e respeita o orçamento mensal do robô.

alter table public.robo_uso drop constraint robo_uso_tipo_check;
alter table public.robo_uso add constraint robo_uso_tipo_check
  check (tipo in ('conversa', 'foto', 'teste', 'moderacao', 'categorizacao', 'melhoria'));

insert into public.configuracoes (chave, valor, grupo, publico, descricao)
select x.chave, x.valor, 'vitrine', x.publico, x.descricao
  from (values
    -- Pública: a tela da loja mostra o atalho "Melhorar com IA" só quando está ligada.
    ('vitrine_ia.melhoria_ativa', 'false'::jsonb, true, 'Liga a IA que sugere título, descrição e dicas de foto aos produtos das lojas'),
    ('vitrine_ia.melhorias_mes', '{"teste": 20, "slim": 20, "full": 100}'::jsonb, false, 'Quantas melhorias com IA cada loja pode pedir por mês, por plano')
  ) as x(chave, valor, publico, descricao)
 where not exists (select 1 from public.configuracoes c where c.chave = x.chave and c.microrregiao_id is null);

create table public.melhorias_ia (
  id              uuid primary key default gen_random_uuid(),
  reserva         uuid not null default gen_random_uuid(),
  anuncio_id      uuid not null references public.anuncios(id) on delete cascade,
  vitrine_id      uuid not null references public.vitrines_lojas(id) on delete cascade,
  uso_id          bigint references public.robo_uso(id) on delete set null,
  estado          text not null default 'processando'
                  check (estado in ('processando', 'pronta', 'aplicada', 'recusada', 'falhou')),
  titulo_antes    text not null,
  descricao_antes text,
  titulo_novo     text check (char_length(titulo_novo) between 5 and 90),
  descricao_nova  text check (char_length(descricao_nova) <= 1500),
  dicas_foto      jsonb not null default '[]'::jsonb check (jsonb_typeof(dicas_foto) = 'array'),
  criado_em       timestamptz not null default now(),
  concluido_em    timestamptz,
  decidido_em     timestamptz
);
create index melhorias_ia_loja_mes_idx on public.melhorias_ia (vitrine_id, criado_em);
create index melhorias_ia_anuncio_idx on public.melhorias_ia (anuncio_id, criado_em desc);
alter table public.melhorias_ia enable row level security;
create policy "melhorias ia dono le" on public.melhorias_ia for select
  using (exists (select 1 from public.vitrines_lojas v where v.id = vitrine_id and v.dono_id = public.usuario_id()));
create policy "melhorias ia admin le" on public.melhorias_ia for select using (public.e_admin());
revoke all on public.melhorias_ia from anon, authenticated;
grant select on public.melhorias_ia to authenticated;

-- Texto que a IA devolve não pode trazer link, e-mail ou telefone (ninguém troca o contato pela IA).
create function public.melhoria_texto_seguro(p text)
returns boolean language sql immutable set search_path = public
as $$
  select p is not null and p !~* '(https?://|www\.|[a-z0-9._-]+@[a-z0-9-]+\.|[0-9][0-9 .()-]{7,}[0-9])'
$$;

-- Limite do mês e quantas a loja já usou (falha não conta).
create function public.melhoria_ia_cota(v public.vitrines_lojas)
returns jsonb language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'limite', coalesce(public.numero_ou_nulo(
                public.config('vitrine_ia.melhorias_mes', v.microrregiao_id, '{}') -> (public.plano_efetivo(v)).codigo), 0),
    'usadas', (select count(*) from public.melhorias_ia m
                where m.vitrine_id = v.id and m.criado_em >= public.robo_inicio('mes') and m.estado <> 'falhou'))
$$;

-- ---------------------------------------------------------------------
-- 1. Pedido (só o servidor, que informa quem está logado)
-- ---------------------------------------------------------------------
-- Devolve {erro: ...} quando não pode, ou o trabalho para a IA.
create function public.melhoria_ia_reservar(p_anuncio uuid, p_usuario text)
returns jsonb language plpgsql security definer
set search_path = public, extensions
as $$
declare
  a public.anuncios; v public.vitrines_lojas; m public.melhorias_ia;
  cota jsonb; cot numeric; orc numeric; gasto numeric; reserva_custo numeric; uid bigint;
begin
  if coalesce(auth.role(), '') <> 'service_role' and session_user not in ('postgres', 'supabase_admin') then
    raise exception 'Acesso restrito.' using errcode = '42501';
  end if;
  select * into a from public.anuncios where id = p_anuncio;
  select * into v from public.vitrines_lojas where id = a.vitrine_id;
  if a.id is null or v.id is null or v.dono_id is distinct from p_usuario or v.tipo <> 'loja' or v.status <> 'ativa'
     or a.status <> 'ativo' then
    return jsonb_build_object('erro', 'nao_encontrado');
  end if;
  if public.config('vitrine_ia.ativa', v.microrregiao_id, 'false') is distinct from 'true'::jsonb
     or public.config('vitrine_ia.melhoria_ativa', v.microrregiao_id, 'false') is distinct from 'true'::jsonb then
    return jsonb_build_object('erro', 'indisponivel');
  end if;

  -- Um pedido por loja de cada vez: a cota não estoura com dois toques seguidos.
  perform pg_advisory_xact_lock(hashtext('melhoria_ia:' || v.id));
  -- Pedido que travou (o servidor caiu no meio) não conta na cota. A reserva fica no livro-caixa.
  update public.melhorias_ia set estado = 'falhou', concluido_em = now()
   where vitrine_id = v.id and estado = 'processando' and criado_em < now() - interval '3 minutes';
  if exists (select 1 from public.melhorias_ia where anuncio_id = a.id and estado = 'processando') then
    return jsonb_build_object('erro', 'ocupado');
  end if;
  cota := public.melhoria_ia_cota(v);
  if (cota->>'usadas')::numeric >= (cota->>'limite')::numeric then
    return jsonb_build_object('erro', 'limite') || cota;
  end if;

  cot := public.numero_ou_nulo(public.config('robo.cotacao_dolar', null, 'null'));
  orc := public.numero_ou_nulo(public.config('robo.orcamento_mensal_centavos', null, 'null'));
  -- US$ 0,02 cobre com folga um anúncio com até 3 fotos em baixa resolução no modelo barato.
  reserva_custo := 0.02 * cot * 100;
  perform pg_advisory_xact_lock(hashtext('robo_uso:orcamento'));
  select coalesce(sum(custo_centavos), 0) into gasto from public.robo_uso where criado_em >= public.robo_inicio('mes');
  if cot is null or cot <= 0 or orc is null or orc < 0 or gasto + reserva_custo > orc then
    return jsonb_build_object('erro', 'orcamento');
  end if;

  insert into public.robo_uso (usuario_id, microrregiao_id, tipo, provedor, modelo, custo_centavos, cotacao_dolar, erro)
  values (p_usuario, v.microrregiao_id, 'melhoria', 'openrouter', 'openai/gpt-4.1-mini', reserva_custo, cot, 'em_andamento')
  returning id into uid;
  insert into public.melhorias_ia (anuncio_id, vitrine_id, uso_id, titulo_antes, descricao_antes)
  values (a.id, v.id, uid, a.titulo, a.descricao) returning * into m;

  -- Só o produto: título, descrição, categoria, características e até 3 fotos. Nada da pessoa nem da loja.
  return jsonb_build_object(
    'id', m.id, 'reserva', m.reserva, 'modelo', 'openai/gpt-4.1-mini',
    'titulo', a.titulo, 'descricao', left(coalesce(a.descricao, ''), 1500),
    'categoria', (select case when p.id is null then c.nome else p.nome || ' > ' || c.nome end
                    from public.categorias c left join public.categorias p on p.id = c.pai_id where c.id = a.categoria_id),
    'atributos', coalesce(a.atributos, '{}'::jsonb),
    'fotos', to_jsonb(coalesce(a.fotos[1:3], '{}'::text[])));
end $$;

-- ---------------------------------------------------------------------
-- 2. Resultado da IA (só o servidor)
-- ---------------------------------------------------------------------
-- Devolve o estado final ('pronta' ou 'falhou'); null = pedido desconhecido ou já fechado.
create function public.melhoria_ia_concluir(p_id uuid, p_reserva uuid, p_resultado jsonb,
  p_custo_usd numeric default null, p_tokens_entrada integer default 0, p_tokens_saida integer default 0)
returns text language plpgsql security definer
set search_path = public, extensions
as $$
declare
  m public.melhorias_ia;
  t text; d text; e jsonb; dica text; idx integer;
  dicas jsonb := '[]'::jsonb;
  n_fotos integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' and session_user not in ('postgres', 'supabase_admin') then
    raise exception 'Acesso restrito.' using errcode = '42501';
  end if;
  select * into m from public.melhorias_ia where id = p_id for update;
  if m.id is null or m.estado <> 'processando' or m.reserva is distinct from p_reserva then return null; end if;

  update public.robo_uso set
    custo_centavos = case when p_custo_usd >= 0 and p_custo_usd <= 0.02 then round(p_custo_usd * cotacao_dolar * 100, 4) else custo_centavos end,
    tokens_entrada = greatest(coalesce(p_tokens_entrada, 0), 0), tokens_saida = greatest(coalesce(p_tokens_saida, 0), 0),
    erro = case when p_custo_usd >= 0 and p_custo_usd <= 0.02 then null else 'custo_indeterminado' end
   where id = m.uso_id;

  if p_resultado is not null and jsonb_typeof(p_resultado) = 'object' then
    t := nullif(btrim(regexp_replace(coalesce(p_resultado->>'titulo', ''), '\s+', ' ', 'g')), '');
    d := nullif(btrim(coalesce(p_resultado->>'descricao', '')), '');
    if t is null or char_length(t) not between 5 and 90 or not public.melhoria_texto_seguro(t) or t = m.titulo_antes then t := null; end if;
    if d is null or char_length(d) > 1500 or not public.melhoria_texto_seguro(d) or d = coalesce(m.descricao_antes, '') then d := null; end if;
    select coalesce(cardinality(fotos), 0) into n_fotos from public.anuncios where id = m.anuncio_id;
    if jsonb_typeof(p_resultado->'fotos') = 'array' then
      for e in select value from jsonb_array_elements(p_resultado->'fotos') limit 3 loop
        continue when jsonb_typeof(e) <> 'object' or jsonb_typeof(e->'indice') <> 'number';
        idx := (e->>'indice')::numeric::integer;
        dica := btrim(coalesce(e->>'dica', ''));
        continue when idx < 1 or idx > least(n_fotos, 3) or dicas @> jsonb_build_array(jsonb_build_object('indice', idx))
          or coalesce(e->>'problema', '') not in ('escura', 'tremida', 'fundo', 'pequeno', 'cortado')
          or char_length(dica) not between 10 and 200 or not public.melhoria_texto_seguro(dica);
        dicas := dicas || jsonb_build_array(jsonb_build_object('indice', idx, 'problema', e->>'problema', 'dica', dica));
      end loop;
    end if;
  end if;

  if t is null and d is null and jsonb_array_length(dicas) = 0 and p_resultado is not null and jsonb_typeof(p_resultado) = 'object'
     and jsonb_typeof(p_resultado->'fotos') = 'array' then
    -- A IA respondeu e não achou nada a melhorar: conta como pronta (o lojista vê "já está bom").
    update public.melhorias_ia set estado = 'pronta', concluido_em = now() where id = m.id;
    return 'pronta';
  end if;
  if t is null and d is null and jsonb_array_length(dicas) = 0 then
    update public.melhorias_ia set estado = 'falhou', concluido_em = now() where id = m.id;
    return 'falhou';
  end if;
  update public.melhorias_ia
     set estado = 'pronta', titulo_novo = t, descricao_nova = d, dicas_foto = dicas, concluido_em = now()
   where id = m.id;
  return 'pronta';
end $$;

-- ---------------------------------------------------------------------
-- 3. O dono decide
-- ---------------------------------------------------------------------
-- Devolve 'aplicada', 'recusada' ou 'desatualizada' (o anúncio mudou depois do pedido: nada é trocado).
create function public.melhoria_ia_decidir(p_id uuid, p_aceitar boolean)
returns text language plpgsql security definer
set search_path = public
as $$
declare
  m public.melhorias_ia; a public.anuncios;
begin
  select mi.* into m from public.melhorias_ia mi join public.vitrines_lojas v on v.id = mi.vitrine_id
   where mi.id = p_id and v.dono_id = public.usuario_id() for update of mi;
  if m.id is null then raise exception using errcode = '42501', message = 'Sugestão não encontrada.'; end if;
  if m.estado <> 'pronta' then return m.estado; end if;
  if not coalesce(p_aceitar, false) or (m.titulo_novo is null and m.descricao_nova is null) then
    update public.melhorias_ia set estado = 'recusada', decidido_em = now() where id = m.id;
    return 'recusada';
  end if;
  select * into a from public.anuncios where id = m.anuncio_id for update;
  if a.status <> 'ativo' or a.titulo is distinct from m.titulo_antes or a.descricao is distinct from m.descricao_antes then
    update public.melhorias_ia set estado = 'recusada', decidido_em = now() where id = m.id;
    return 'desatualizada';
  end if;
  -- UPDATE comum: os gatilhos de moderação do anúncio conferem o texto novo.
  update public.anuncios
     set titulo = coalesce(m.titulo_novo, titulo), descricao = coalesce(m.descricao_nova, descricao)
   where id = a.id;
  update public.melhorias_ia set estado = 'aplicada', decidido_em = now() where id = m.id;
  return 'aplicada';
end $$;

-- Tela do produto: o anúncio, a cota do mês e a sugestão mais recente ainda aberta (até 30 dias).
create function public.minha_melhoria_ia(p_anuncio uuid)
returns jsonb language plpgsql stable security definer
set search_path = public
as $$
declare
  a public.anuncios; v public.vitrines_lojas; m public.melhorias_ia;
begin
  select * into a from public.anuncios where id = p_anuncio;
  select * into v from public.vitrines_lojas where id = a.vitrine_id;
  if a.id is null or v.id is null or v.dono_id is distinct from public.usuario_id() or v.tipo <> 'loja' then
    raise exception using errcode = '42501', message = 'Produto não encontrado.';
  end if;
  select * into m from public.melhorias_ia
   where anuncio_id = a.id and estado in ('processando', 'pronta') and criado_em > now() - interval '30 days'
   order by criado_em desc limit 1;
  return jsonb_build_object(
    'ativa', public.config('vitrine_ia.melhoria_ativa', v.microrregiao_id, 'false') = 'true'::jsonb,
    'anuncio', jsonb_build_object('id', a.id, 'titulo', a.titulo, 'descricao', a.descricao, 'status', a.status,
                                  'fotos', to_jsonb(coalesce(a.fotos[1:3], '{}'::text[]))),
    'melhoria', case when m.id is null then null else jsonb_build_object(
      'id', m.id, 'estado', m.estado, 'titulo_antes', m.titulo_antes, 'descricao_antes', m.descricao_antes,
      'titulo_novo', m.titulo_novo, 'descricao_nova', m.descricao_nova, 'dicas_foto', m.dicas_foto) end
  ) || public.melhoria_ia_cota(v);
end $$;

revoke all on function public.melhoria_texto_seguro(text), public.melhoria_ia_cota(public.vitrines_lojas),
  public.melhoria_ia_reservar(uuid, text), public.melhoria_ia_concluir(uuid, uuid, jsonb, numeric, integer, integer),
  public.melhoria_ia_decidir(uuid, boolean), public.minha_melhoria_ia(uuid) from public, anon, authenticated;
grant execute on function public.melhoria_ia_reservar(uuid, text),
  public.melhoria_ia_concluir(uuid, uuid, jsonb, numeric, integer, integer) to service_role;
grant execute on function public.melhoria_ia_decidir(uuid, boolean), public.minha_melhoria_ia(uuid) to authenticated;
