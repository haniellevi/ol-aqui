-- Etapa P2 da reestruturação dos produtos (docs/PLANO-PRODUTOS.md, decisões 5 e 6):
-- o vendedor sugere uma categoria que não existe ("Ração"), o anúncio vai ao ar na categoria
-- mais próxima e o admin decide: aprovar (cria a categoria), juntar com uma que existe ou recusar.
-- Aprovar ou juntar move os anúncios sozinho e avisa no sino.
-- Até a etapa P5 (super admin), quem decide é o administrador (e_admin).

-- ---------------------------------------------------------------------
-- 1. Texto normalizado: junta "Rações", "racao" e "ração " no mesmo grupo
-- ---------------------------------------------------------------------
create function public.normalizar_sugestao_categoria(p_texto text)
returns text language plpgsql immutable
set search_path = public
as $$
declare
  limpo text;
  palavra text;
  saida text[] := '{}';
begin
  limpo := regexp_replace(public.sem_acento(lower(coalesce(p_texto, ''))), '[^a-z0-9]+', ' ', 'g');
  foreach palavra in array regexp_split_to_array(btrim(limpo), ' +') loop
    continue when palavra = '';
    -- plural simples do português: racoes > racao, animais > animal, flores > flor, bolsas > bolsa, bases > base
    if char_length(palavra) > 4 and palavra ~ '(oes|aes)$' then
      palavra := left(palavra, -3) || 'ao';
    elsif char_length(palavra) > 4 and palavra ~ 'ais$' then
      palavra := left(palavra, -2) || 'l';
    elsif char_length(palavra) > 4 and palavra ~ '(res|zes)$' then
      palavra := left(palavra, -2);
    elsif char_length(palavra) > 3 and palavra ~ '[^s]s$' then
      palavra := left(palavra, -1);
    end if;
    saida := saida || palavra;
  end loop;
  return array_to_string(saida, ' ');
end $$;

-- Endereço de categoria: minúsculas, sem acento, hífen, até 60 letras.
create function public.slug_texto(p_texto text)
returns text language sql immutable
set search_path = public
as $$
  select left(btrim(regexp_replace(public.sem_acento(lower(coalesce(p_texto, ''))), '[^a-z0-9]+', '-', 'g'), '-'), 60)
$$;

-- ---------------------------------------------------------------------
-- 2. Tabela
-- ---------------------------------------------------------------------
create table public.categorias_sugeridas (
  id                  uuid primary key default gen_random_uuid(),
  texto               text not null check (char_length(btrim(texto)) between 2 and 60),
  texto_norm          text not null check (char_length(texto_norm) between 2 and 60),
  categoria_proxima_id uuid not null references public.categorias(id),
  anuncio_id          uuid references public.anuncios(id) on delete set null,
  autor_id            text references public.perfis(id) on delete set null,
  estado              text not null default 'pendente' check (estado in ('pendente', 'aprovada', 'juntada', 'recusada')),
  categoria_final_id  uuid references public.categorias(id),
  decidido_por        text references public.perfis(id) on delete set null,
  decidido_em         timestamptz,
  criado_em           timestamptz not null default now(),
  check ((estado in ('aprovada', 'juntada')) = (categoria_final_id is not null))
);
-- Um anúncio tem no máximo uma sugestão esperando decisão.
create unique index categorias_sugeridas_anuncio_pendente on public.categorias_sugeridas (anuncio_id)
  where estado = 'pendente' and anuncio_id is not null;
create index categorias_sugeridas_pendentes on public.categorias_sugeridas (texto_norm) where estado = 'pendente';
create index categorias_sugeridas_autor on public.categorias_sugeridas (autor_id, criado_em desc);

alter table public.categorias_sugeridas enable row level security;
create policy "sugestoes de categoria proprias" on public.categorias_sugeridas
  for select using (autor_id = public.usuario_id() or public.e_admin());
-- Escrita só pelas funções abaixo.
revoke all on public.categorias_sugeridas from anon, authenticated;
grant select on public.categorias_sugeridas to authenticated;

-- ---------------------------------------------------------------------
-- 3. O vendedor sugere (a categoria próxima é a que o anúncio já tem)
-- ---------------------------------------------------------------------
create function public.sugerir_categoria(p_anuncio uuid, p_texto text)
returns uuid language plpgsql security definer
set search_path = public
as $$
declare
  a public.anuncios;
  eu text := public.usuario_id();
  v_texto text := left(regexp_replace(btrim(coalesce(p_texto, '')), '\s+', ' ', 'g'), 60);
  v_norm text := public.normalizar_sugestao_categoria(p_texto);
  sid uuid;
begin
  if eu is null then
    raise exception using errcode = '42501', message = 'Entre na sua conta para sugerir uma categoria.';
  end if;
  select x.* into a from public.anuncios x
    join public.vitrines_lojas v on v.id = x.vitrine_id
   where x.id = p_anuncio and v.dono_id = eu and x.status <> 'excluido'
   for update of x;
  if not found then
    raise exception using errcode = '42501', message = 'Anúncio não encontrado.';
  end if;
  if char_length(v_texto) < 2 or char_length(v_norm) < 2 then
    raise exception using errcode = '22023', message = 'Escreva o nome da categoria com pelo menos 2 letras.';
  end if;
  if a.categoria_id is null then
    raise exception using errcode = '22023', message = 'Escolha primeiro a categoria mais parecida.';
  end if;
  -- Já existe uma categoria com esse nome: não precisa sugerir.
  if exists (select 1 from public.categorias c
              where c.ativa and public.normalizar_sugestao_categoria(c.nome) = v_norm) then
    raise exception using errcode = '22023', message = 'Essa categoria já existe. Procure por ela na lista.';
  end if;
  -- Limite contra abuso: 20 sugestões esperando decisão por pessoa.
  if (select count(*) from public.categorias_sugeridas s
       where s.autor_id = eu and s.estado = 'pendente' and s.anuncio_id is distinct from a.id) >= 20 then
    raise exception using errcode = '22023', message = 'Você já tem 20 sugestões esperando resposta. Aguarde a equipe decidir.';
  end if;

  update public.categorias_sugeridas
     set texto = v_texto, texto_norm = v_norm, categoria_proxima_id = a.categoria_id, criado_em = now()
   where anuncio_id = a.id and estado = 'pendente'
  returning id into sid;
  if sid is null then
    insert into public.categorias_sugeridas (texto, texto_norm, categoria_proxima_id, anuncio_id, autor_id)
    values (v_texto, v_norm, a.categoria_id, a.id, eu)
    returning id into sid;
  end if;
  return sid;
end $$;

-- A sugestão pendente do meu anúncio (para mostrar no cadastro).
create function public.minha_sugestao_categoria(p_anuncio uuid)
returns table (id uuid, texto text, categoria_proxima_id uuid, criado_em timestamptz)
language sql stable security definer
set search_path = public
as $$
  select s.id, s.texto, s.categoria_proxima_id, s.criado_em
    from public.categorias_sugeridas s
    join public.anuncios a on a.id = s.anuncio_id
    join public.vitrines_lojas v on v.id = a.vitrine_id
   where s.anuncio_id = p_anuncio and s.estado = 'pendente' and v.dono_id = public.usuario_id()
$$;

-- O vendedor desiste da sugestão (ex.: achou a categoria certa depois).
create function public.cancelar_sugestao_categoria(p_anuncio uuid)
returns void language plpgsql security definer
set search_path = public
as $$
begin
  delete from public.categorias_sugeridas s
   using public.anuncios a, public.vitrines_lojas v
   where s.anuncio_id = p_anuncio and s.estado = 'pendente'
     and a.id = s.anuncio_id and v.id = a.vitrine_id and v.dono_id = public.usuario_id();
end $$;

-- ---------------------------------------------------------------------
-- 4. Admin: lista agrupada e decisão
-- ---------------------------------------------------------------------
create function public.admin_categorias_sugeridas()
returns table (texto_norm text, texto text, quantidade integer, anuncios integer,
               proximas jsonb, primeira timestamptz, ultima timestamptz, parecidas text[])
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
           where o.texto_norm <> g.texto_norm and extensions.similarity(o.texto_norm, g.texto_norm) >= 0.5) as parecidas
    from g
   order by g.quantidade desc, g.ultima desc;
end $$;

-- p_acao: 'aprovar' (cria p_nome dentro de p_pai), 'juntar' (com p_categoria) ou 'recusar'.
-- p_grupos: um ou mais textos normalizados decididos juntos (grupos parecidos).
create function public.decidir_categorias_sugeridas(
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
  revisar integer := 0;
  decididas integer := 0;
  caminho text;
  an public.anuncios;
  sistema_anterior text := coalesce(current_setting('olaki.sistema', true), '');
begin
  if not public.e_admin() then
    raise exception using errcode = '42501', message = 'Só a equipe pode decidir sugestões de categoria.';
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
        'Sua categoria foi aceita',
        format('O anúncio "%s" agora está em %s.', left(coalesce(an.titulo, ''), 80), caminho),
        '/minha-conta/anuncios', 'categoria_sugerida:' || s.id::text,
        jsonb_build_object('anuncio_id', an.id, 'categoria_id', final_id));
    exception when sqlstate '23514' or sqlstate '22023' then
      -- A categoria nova pede um campo obrigatório que o anúncio não tem. "Revise suas categorias" só
      -- aceita ou recusa (não pede campos), então o anúncio fica onde está e o dono é avisado.
      revisar := revisar + 1;
      perform public.notificar(s.dono_id, 'categoria_sugerida',
        'Sua sugestão de categoria foi aceita',
        format('A categoria %s foi criada, mas o anúncio "%s" continua onde estava: ela pede informações que ele ainda não tem.',
               caminho, left(coalesce(an.titulo, ''), 80)),
        '/minha-conta/anuncios', 'categoria_sugerida:' || s.id::text,
        jsonb_build_object('anuncio_id', an.id, 'categoria_id', final_id, 'movido', false));
    end;
  end loop;

  return jsonb_build_object('categoria_id', final_id, 'decididas', decididas, 'movidos', movidos, 'revisar', revisar);
end $$;

-- Trava do WhatsApp (20261110014434): também deixa passar a mudança feita pelo sistema dentro de uma função.
create or replace function public.exigir_whatsapp_operacao() returns trigger language plpgsql security definer set search_path = public as $$
declare uid text := public.usuario_id();
begin
  if current_setting('role', true) not in ('authenticated','anon') then return new; end if;
  if tg_table_name = 'anuncios' then
    if coalesce(current_setting('olaki.sistema', true), '') = '1' then return new; end if;
    if new.status::text <> 'ativo' then return new; end if;
    -- Contadores protegidos não exigem cadastro. "busca" é gerada após os gatilhos BEFORE.
    if tg_op = 'UPDATE' and
      (to_jsonb(new) - array['visualizacoes','cliques_whatsapp','total_favoritos','atualizado_em','busca']) =
      (to_jsonb(old) - array['visualizacoes','cliques_whatsapp','total_favoritos','atualizado_em','busca']) then
      return new;
    end if;
  end if;
  if not public.whatsapp_confirmado(uid) then
    raise exception using errcode='42501', message='Confirme seu WhatsApp para continuar.', detail='campo:celular';
  end if;
  return new;
end $$;

revoke all on function public.normalizar_sugestao_categoria(text), public.slug_texto(text),
  public.sugerir_categoria(uuid, text), public.minha_sugestao_categoria(uuid), public.cancelar_sugestao_categoria(uuid),
  public.admin_categorias_sugeridas(), public.decidir_categorias_sugeridas(text[], text, text, uuid, uuid) from public;
grant execute on function public.normalizar_sugestao_categoria(text), public.slug_texto(text)
  to anon, authenticated, service_role;
grant execute on function public.sugerir_categoria(uuid, text), public.minha_sugestao_categoria(uuid),
  public.cancelar_sugestao_categoria(uuid), public.admin_categorias_sugeridas(),
  public.decidir_categorias_sugeridas(text[], text, text, uuid, uuid)
  to authenticated, service_role;
revoke execute on function public.sugerir_categoria(uuid, text), public.minha_sugestao_categoria(uuid),
  public.cancelar_sugestao_categoria(uuid), public.admin_categorias_sugeridas(),
  public.decidir_categorias_sugeridas(text[], text, text, uuid, uuid) from anon;

-- O aviso "Sua categoria foi aceita" entra na lista que a pessoa pode ligar e desligar.
update public.configuracoes
   set valor = valor || '["categoria_sugerida"]'::jsonb
 where chave = 'radar.avisos_escolha' and jsonb_typeof(valor) = 'array' and not (valor ? 'categoria_sugerida');
