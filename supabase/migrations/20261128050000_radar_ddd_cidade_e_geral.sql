-- Telefone por cidade e pedido do Radar em "geral" (revisão de 25/11/2026). Não edita as migrações anteriores:
-- 1. cidades.ddd: cidade com DDD diferente do da região (Barreiras-BA e Formosa do Rio Preto-BA são 77; a região-piloto é 89).
--    Número sem DDD de quem mora nessa cidade não recebe o DDD da região: a tela pede o DDD (regra em src/lib/telefone-regiao.ts).
-- 2. Pedido do Aki em imóvel, veículo ou móvel (tipo no enum, sem categoria da tabela) não é "geral": não gera sugestão
--    e não muda de categoria ao juntar ou aprovar. Vale só "geral" de verdade ou Outros/Diversos do site.
-- 3. O gatilho de geral não fica aberto para papéis de cliente (revoke).

-- ---------------------------------------------------------------------
-- 1. Cidade com DDD próprio
-- ---------------------------------------------------------------------
alter table public.cidades add column if not exists ddd text;
alter table public.cidades drop constraint if exists cidades_ddd_valido;
alter table public.cidades add constraint cidades_ddd_valido
  check (ddd is null or ddd ~ '^(1[1-9]|2[12478]|3[1-578]|4[1-9]|5[1345]|6[1-9]|7[13-579]|8[1-9]|9[1-9])$');

-- Só onde a cidade sabidamente tem outro DDD (e está vazio). Nenhum DDD já preenchido muda.
update public.cidades
   set ddd = '77'
 where uf = 'BA' and nome in ('Barreiras', 'Formosa do Rio Preto') and ddd is null;

-- ---------------------------------------------------------------------
-- 2. Gatilho de geral e decisão (mesmas assinaturas; create or replace)
-- ---------------------------------------------------------------------
create or replace function public.radar_sugerir_categoria_geral()
returns trigger language plpgsql security definer
set search_path = public
as $$
declare
  v_texto   text := left(btrim(regexp_replace(coalesce(new.titulo, ''), '\s+', ' ', 'g')), 60);
  v_norm    text;
  v_proxima uuid;
begin
  -- Só "geral": a categoria Outros / Diversos do site, ou pedido sem categoria da tabela e do tipo "geral".
  -- Pedido do Aki em imóvel, veículo ou móvel não tem categoria da tabela, mas tem o tipo dele: não é geral.
  if new.categoria_id is not null then
    if not exists (select 1 from public.categorias c where c.id = new.categoria_id and c.slug in ('outros', 'diversos')) then
      return new;
    end if;
  elsif coalesce(new.categoria::text, '') <> 'geral' then
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

    -- Pedido do Radar: vai para a categoria escolhida, se ainda está em geral (sem categoria) ou onde a sugestão o colocou.
    if p_acao <> 'recusar' and s.pedido_radar_id is not null then
      update public.radar_pedidos r
         set categoria_id = final_id
       where r.id = s.pedido_radar_id
         and ((r.categoria_id is null and coalesce(r.categoria::text, '') = 'geral') or r.categoria_id = s.categoria_proxima_id);
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

-- ---------------------------------------------------------------------
-- 3. Gatilho sem acesso de cliente
-- ---------------------------------------------------------------------
revoke all on function public.radar_sugerir_categoria_geral() from public, anon, authenticated;
