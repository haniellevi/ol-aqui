-- Pedido do Radar em "geral" vira sugestão de categoria (20261128030000).
-- Pedido sem categoria (o Aki cria assim quando não sabe) ou em "Outros" / "Diversos" (o site) entra no
-- fluxo de categorias sugeridas (mesma tabela e mesma tela da equipe), marcado como "Pedido do Radar".
-- O texto é só o título do pedido: o comprador não aparece (autor vazio). Um pedido tem no máximo uma sugestão.
-- Juntar move o pedido para a categoria escolhida; aprovar cria a categoria e move o pedido; recusar deixa como está.
-- Anúncios continuam iguais. A regra de pedido do site (categoria obrigatória) não muda.

-- ---------------------------------------------------------------------
-- 1. Colunas: de onde veio a sugestão e qual pedido do Radar
-- ---------------------------------------------------------------------
alter table public.categorias_sugeridas
  add column origem text not null default 'anuncio' check (origem in ('anuncio', 'radar_pedido')),
  add column pedido_radar_id uuid references public.radar_pedidos(id) on delete cascade,
  add constraint categorias_sugeridas_origem_pedido check ((origem = 'radar_pedido') = (pedido_radar_id is not null));
-- Dedup: um pedido do Radar tem no máximo uma sugestão, mesmo que a decisão mude depois.
create unique index categorias_sugeridas_pedido_radar on public.categorias_sugeridas (pedido_radar_id)
  where pedido_radar_id is not null;

-- ---------------------------------------------------------------------
-- 2. Gatilho: pedido novo em "geral" ou em "Outros"/"Diversos" registra a sugestão
-- ---------------------------------------------------------------------
create function public.radar_sugerir_categoria_geral()
returns trigger language plpgsql security definer
set search_path = public
as $$
declare
  v_texto   text := left(btrim(regexp_replace(coalesce(new.titulo, ''), '\s+', ' ', 'g')), 60);
  v_norm    text;
  v_proxima uuid;
begin
  -- Só "geral": sem categoria, ou a categoria Outros / Diversos. Outras categorias não entram.
  if new.categoria_id is not null
     and not exists (select 1 from public.categorias c where c.id = new.categoria_id and c.slug in ('outros', 'diversos')) then
    return new;
  end if;
  v_norm := left(public.normalizar_sugestao_categoria(v_texto), 60);
  if char_length(v_texto) < 2 or char_length(v_norm) < 2 then
    return new;
  end if;
  -- "Mais perto de": a própria categoria do pedido, ou Diversos (a gaveta de geral) quando não tem.
  v_proxima := coalesce(new.categoria_id,
    (select c.id from public.categorias c where c.slug = 'diversos'),
    (select c.id from public.categorias c where c.slug = 'outros'));
  if v_proxima is null then
    return new;
  end if;
  insert into public.categorias_sugeridas (texto, texto_norm, categoria_proxima_id, origem, pedido_radar_id, autor_id)
  values (v_texto, v_norm, v_proxima, 'radar_pedido', new.id, null)
  on conflict do nothing;
  return new;
end $$;

create trigger radar_sugerir_categoria_geral after insert on public.radar_pedidos
  for each row execute function public.radar_sugerir_categoria_geral();

-- ---------------------------------------------------------------------
-- 3. Lista do admin: marca "Pedido do Radar" e os pedidos do grupo (até 10, os mais novos)
-- ---------------------------------------------------------------------
drop function public.admin_categorias_sugeridas();
create function public.admin_categorias_sugeridas()
returns table (texto_norm text, texto text, quantidade integer, anuncios integer,
               proximas jsonb, primeira timestamptz, ultima timestamptz, parecidas text[],
               radar integer, pedidos_radar uuid[])
language plpgsql stable security definer
set search_path = public, extensions
as $$
begin
  if not public.e_admin() then
    raise exception using errcode = '42501', message = 'Só a equipe pode ver as sugestões.';
  end if;
  return query
  with p as (
    select s.* from public.categorias_sugeridas s where s.estado = 'pendente'
  ), g as (
    select p.texto_norm,
           (select x.texto from p x where x.texto_norm = p.texto_norm
             group by x.texto order by count(*) desc, min(x.criado_em) limit 1) as texto,
           count(*)::int as quantidade,
           count(distinct p.anuncio_id)::int as anuncios,
           min(p.criado_em) as primeira, max(p.criado_em) as ultima
      from p group by p.texto_norm
  )
  select g.texto_norm, g.texto, g.quantidade, g.anuncios,
         (select coalesce(jsonb_agg(jsonb_build_object('id', k.id, 'caminho', public.categoria_nome_caminho(k.id), 'vezes', k.n)
                                    order by k.n desc), '[]'::jsonb)
            from (select x.categoria_proxima_id as id, count(*) as n from p x
                   where x.texto_norm = g.texto_norm group by x.categoria_proxima_id) k) as proximas,
         g.primeira, g.ultima,
         -- Erros de digitação: outros grupos pendentes com texto parecido.
         (select coalesce(array_agg(o.texto_norm order by o.texto_norm), '{}')
            from (select distinct x.texto_norm from p x) o
           where o.texto_norm <> g.texto_norm and extensions.similarity(o.texto_norm, g.texto_norm) >= 0.5) as parecidas,
         (select count(*)::int from p y where y.texto_norm = g.texto_norm and y.pedido_radar_id is not null) as radar,
         (select coalesce(array_agg(z.pedido_radar_id), '{}'::uuid[]) from (
            select y.pedido_radar_id from p y
             where y.texto_norm = g.texto_norm and y.pedido_radar_id is not null
             order by y.criado_em desc limit 10) z) as pedidos_radar
    from g
   order by g.quantidade desc, g.ultima desc;
end $$;
revoke all on function public.admin_categorias_sugeridas() from public, anon;
grant execute on function public.admin_categorias_sugeridas() to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 4. Decisão: o pedido do Radar muda de categoria junto com os anúncios (só se ainda está em "geral")
-- ---------------------------------------------------------------------
create or replace function public.decidir_categorias_sugeridas(
  p_grupos text[], p_acao text, p_nome text default null, p_pai uuid default null, p_categoria uuid default null)
returns jsonb language plpgsql security definer
set search_path = public
as $$
declare
  eu text := public.usuario_id();
  final_id uuid;
  pai public.categorias;
  v_nome text := left(regexp_replace(btrim(coalesce(p_nome, '')), '\s+', ' ', 'g'), 60);
  base text;
  v_slug text;
  k integer := 2;
  s record;
  movidos integer := 0;
  pedidos integer := 0;
  revisar integer := 0;
  decididas integer := 0;
  caminho text;
  an public.anuncios;
  sistema_anterior text := coalesce(current_setting('olaki.sistema', true), '');
begin
  if not public.e_super_admin() then
    raise exception using errcode = '42501', message = 'Só o super admin pode decidir sugestões de categoria.';
  end if;
  if p_acao not in ('aprovar', 'juntar', 'recusar') then
    raise exception using errcode = '22023', message = 'Escolha aprovar, juntar ou recusar.';
  end if;
  -- Trava o grupo antes de criar qualquer categoria: dois admins não decidem o mesmo grupo.
  perform 1 from public.categorias_sugeridas
    where texto_norm = any(p_grupos) and estado = 'pendente'
    order by id for update;
  if coalesce(array_length(p_grupos, 1), 0) = 0
     or not exists (select 1 from public.categorias_sugeridas
                     where texto_norm = any(p_grupos) and estado = 'pendente') then
    raise exception using errcode = '22023', message = 'Essas sugestões já foram decididas.';
  end if;

  if p_acao = 'aprovar' then
    if char_length(v_nome) < 2 then
      raise exception using errcode = '22023', message = 'Escreva o nome da categoria nova.';
    end if;
    select c.* into pai from public.categorias c where c.id = p_pai;
    if pai.id is null or not coalesce(public.categoria_disponivel(pai.id), false) then
      raise exception using errcode = '22023', message = 'Escolha onde a categoria nova vai ficar.';
    end if;
    if exists (select 1 from public.categorias c where c.pai_id = pai.id
                and public.normalizar_sugestao_categoria(c.nome) = public.normalizar_sugestao_categoria(v_nome)) then
      raise exception using errcode = '22023', message = 'Já existe uma categoria com esse nome nesse lugar. Use "Juntar".';
    end if;
    base := public.slug_texto(v_nome);
    if char_length(base) < 2 then
      raise exception using errcode = '22023', message = 'O nome precisa ter letras ou números.';
    end if;
    v_slug := base;
    if exists (select 1 from public.categorias c where c.slug = base) then
      v_slug := left(public.slug_texto(base || '-' || pai.slug), 60);
    end if;
    while exists (select 1 from public.categorias c where c.slug = v_slug) loop
      v_slug := left(base, 56) || '-' || k;
      k := k + 1;
    end loop;
    -- A trava de categorias confere o limite de 3 níveis.
    insert into public.categorias (slug, nome, pai_id, ordem, ativa, tipo_legado, campos)
    values (v_slug, v_nome, pai.id,
            coalesce((select max(c.ordem) from public.categorias c where c.pai_id = pai.id), 0) + 10,
            true, pai.tipo_legado, '[]'::jsonb)
    returning id into final_id;
  elsif p_acao = 'juntar' then
    if p_categoria is null or not coalesce(public.categoria_disponivel(p_categoria), false)
       or exists (select 1 from public.categorias f where f.pai_id = p_categoria and f.ativa) then
      raise exception using errcode = '22023', message = 'Escolha uma categoria final (sem subcategorias) que esteja no ar.';
    end if;
    final_id := p_categoria;
  end if;

  caminho := public.categoria_nome_caminho(final_id);

  for s in select x.*, v.dono_id
             from public.categorias_sugeridas x
             left join public.anuncios a on a.id = x.anuncio_id
             left join public.vitrines_lojas v on v.id = a.vitrine_id
            where x.texto_norm = any(p_grupos) and x.estado = 'pendente'
            order by x.criado_em
            for update of x loop
    update public.categorias_sugeridas
       set estado = case p_acao when 'aprovar' then 'aprovada' when 'juntar' then 'juntada' else 'recusada' end,
           categoria_final_id = final_id, decidido_por = eu, decidido_em = now()
     where id = s.id;
    decididas := decididas + 1;

    -- Pedido do Radar: vai para a categoria escolhida, se ainda está onde a sugestão o colocou (geral).
    if p_acao <> 'recusar' and s.pedido_radar_id is not null then
      update public.radar_pedidos r
         set categoria_id = final_id
       where r.id = s.pedido_radar_id
         and (r.categoria_id is null or r.categoria_id = s.categoria_proxima_id);
      if found then
        pedidos := pedidos + 1;
      end if;
    end if;

    continue when p_acao = 'recusar' or s.anuncio_id is null;
    -- Trava o anúncio e confere de novo: o dono pode ter trocado a categoria nesse meio-tempo.
    select x.* into an from public.anuncios x where x.id = s.anuncio_id for update;
    continue when an.id is null or an.status in ('excluido', 'congelado')
                  or an.categoria_id is distinct from s.categoria_proxima_id;
    begin
      -- Mudança feita pelo sistema, a pedido da equipe: não cobra o WhatsApp de quem decidiu.
      perform set_config('olaki.sistema', '1', true);
      -- Outra sugestão pendente perde o sentido: o anúncio já vai para a categoria pedida pelo dono.
      update public.anuncios
         set categoria_id = final_id,
             categoria_sugerida_id = null, categoria_sugestao_estado = null, categoria_sugerida_em = null
       where id = an.id;
      perform set_config('olaki.sistema', sistema_anterior, true);
      movidos := movidos + 1;
      perform public.notificar(s.dono_id, 'categoria_sugerida',
        case p_acao when 'aprovar' then 'Sua categoria foi aceita' else 'Seu anúncio mudou de categoria' end,
        format('%s agora está em %s.', public.nome_anuncio_aviso(an.titulo, true), caminho),
        '/minha-conta/anuncios', 'categoria_sugerida:' || s.id::text,
        jsonb_build_object('anuncio_id', an.id, 'categoria_id', final_id));
    exception when sqlstate '23514' or sqlstate '22023' then
      -- A categoria nova pede um campo obrigatório que o anúncio não tem. "Revise suas categorias" só
      -- aceita ou recusa (não pede campos), então o anúncio fica onde está e o dono é avisado.
      revisar := revisar + 1;
      perform public.notificar(s.dono_id, 'categoria_sugerida',
        'Sua sugestão de categoria foi aceita',
        format('%s, mas %s continua onde estava: ela pede informações que ele ainda não tem.',
               case p_acao when 'aprovar' then format('A categoria %s foi criada', caminho)
                           else format('Sua sugestão foi juntada à categoria %s', caminho) end,
               public.nome_anuncio_aviso(an.titulo, false)),
        '/minha-conta/anuncios', 'categoria_sugerida:' || s.id::text,
        jsonb_build_object('anuncio_id', an.id, 'categoria_id', final_id, 'movido', false));
    end;
  end loop;

  return jsonb_build_object('categoria_id', final_id, 'decididas', decididas, 'movidos', movidos, 'revisar', revisar,
                            'pedidos', pedidos);
end $$;
