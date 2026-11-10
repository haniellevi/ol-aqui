insert into public.configuracoes (chave, valor, grupo, descricao)
values ('busca.facetas_ativas', 'true', 'busca', 'Mostra a disponibilidade dos filtros de Carros e Casas. Pode ser desligada por região.')
on conflict do nothing;

-- A lista e as facetas partem dos mesmos anúncios públicos. Cada candidato
-- registra quais filtros específicos falharam para reaproveitar essa avaliação.
create function public.resultado_busca_anuncios(
  q text, categoria_slug text, cidade text, preco_min bigint, preco_max bigint,
  filtros jsonb, ordem text, microrregiao_slug text, limite integer,
  deslocamento integer, campos_facetas jsonb
) returns table (anuncios public.anuncio_card[], total bigint, facetas jsonb)
language sql stable
set search_path = public, extensions
as $$
  with par as (
    select nullif(btrim(q), '') as termo,
           nullif(btrim(categoria_slug), '') as cat_slug,
           nullif(public.sem_acento(lower(btrim(cidade))), '') as cidade_n,
           nullif(btrim(microrregiao_slug), '') as reg_slug,
           coalesce(public.numero_ou_nulo(public.config('busca.similaridade_minima', null, '0.45')), 0.45)::real as sim_min,
           case when jsonb_typeof(filtros) = 'object' then filtros else '{}'::jsonb end as filt,
           to_char(now() at time zone 'America/Fortaleza', 'YYYYMMDD') as dia
  ), consulta as (
    select par.*,
           case when termo is not null then websearch_to_tsquery('portuguese', public.sem_acento(termo)) end as tsq,
           public.sem_acento(lower(termo)) as termo_n,
           (select m.id from public.microrregioes m where m.slug = par.reg_slug) as reg_id
      from par
  ), cats as (
    select c.id from public.categorias c, consulta
     where c.slug = consulta.cat_slug
        or c.pai_id in (select p.id from public.categorias p where p.slug = consulta.cat_slug)
  ), base as (
    select a.id, a.titulo, a.preco_centavos, a.aceita_troca, a.cidade, a.bairro,
           a.fotos[1] as capa, a.atributos, coalesce(a.publicado_em, a.criado_em) as criado_em,
           c.slug as cat_slug, c.nome as cat_nome,
           case when v.tipo = 'pf' then split_part(btrim(v.nome), ' ', 1) else v.nome end as vitrine_nome,
           v.slug as vitrine_slug, v.selo_loja_verificada, v.tipo,
           coalesce(a.destaque_ate > now(), false) as destaque,
           greatest(coalesce(a.publicado_em, a.criado_em), a.subido_em) as recente,
           case when consulta.termo is null then 0
                else ts_rank(a.busca, consulta.tsq)
                     + extensions.word_similarity(consulta.termo_n, public.sem_acento(lower(coalesce(a.titulo, ''))))
           end as rel, consulta.dia,
           array(
             select f.key from jsonb_each(consulta.filt) f
              where jsonb_typeof(f.value) <> 'null' and not (
                case
                  when jsonb_typeof(f.value) = 'object' then
                    public.numero_ou_nulo(a.atributos->f.key) is not null
                    and (public.numero_ou_nulo(f.value->'min') is null
                         or public.numero_ou_nulo(a.atributos->f.key) >= public.numero_ou_nulo(f.value->'min'))
                    and (public.numero_ou_nulo(f.value->'max') is null
                         or public.numero_ou_nulo(a.atributos->f.key) <= public.numero_ou_nulo(f.value->'max'))
                  when jsonb_typeof(f.value) = 'array' then
                    exists (select 1 from jsonb_array_elements(f.value) e
                             where public.sem_acento(lower(e #>> '{}')) = public.sem_acento(lower(a.atributos->>f.key)))
                  else
                    coalesce(public.sem_acento(lower(a.atributos->>f.key)) = public.sem_acento(lower(f.value #>> '{}')), false)
                end)
           ) as falhas
      from public.anuncios a
      join public.vitrines_lojas v on v.id = a.vitrine_id and v.status = 'ativa'
      left join public.categorias c on c.id = a.categoria_id
      cross join consulta
     where a.status = 'ativo'
       and (consulta.reg_slug is null or a.microrregiao_id = consulta.reg_id)
       and (consulta.cat_slug is null or a.categoria_id in (select cats.id from cats))
       and (consulta.cidade_n is null or public.sem_acento(lower(a.cidade)) = consulta.cidade_n)
       and (resultado_busca_anuncios.preco_min is null or a.preco_centavos >= resultado_busca_anuncios.preco_min)
       and (resultado_busca_anuncios.preco_max is null or a.preco_centavos <= resultado_busca_anuncios.preco_max)
       and (consulta.termo is null
            or a.busca @@ consulta.tsq
            or extensions.word_similarity(consulta.termo_n, public.sem_acento(lower(coalesce(a.titulo, '')))) >= consulta.sim_min)
  ), achados as (
    select * from base where cardinality(falhas) = 0
  ), contagem as (
    select count(*) as total from achados
  ), campos as (
    select c.chave, c.tipo, c.opcoes
      from jsonb_to_recordset(campos_facetas) as c(chave text, tipo text, filtro boolean, opcoes jsonb)
     where c.filtro
  ), valores as (
    select c.chave, c.tipo, b.atributos->c.chave as valor
      from campos c join base b on b.falhas <@ array[c.chave] and b.atributos ? c.chave
  ), opcoes as (
    select c.chave, o.rotulo as chave_opcao, public.sem_acento(lower(o.rotulo)) as valor
      from campos c cross join lateral jsonb_array_elements_text(c.opcoes) o(rotulo)
     where c.tipo = 'lista'
    union all
    select c.chave, o.chave_opcao, o.valor
      from campos c cross join (values ('sim', 'true'), ('nao', 'false')) o(chave_opcao, valor)
     where c.tipo = 'sim_nao'
  ), contagens_opcoes as (
    select o.chave, o.chave_opcao, count(*) as quantidade
      from opcoes o join valores v on v.chave = o.chave and o.valor = public.sem_acento(lower(v.valor #>> '{}'))
     group by o.chave, o.chave_opcao
  ), faixas as (
    select chave, min(public.numero_ou_nulo(valor)) as minimo, max(public.numero_ou_nulo(valor)) as maximo
      from valores where tipo = 'numero' group by chave
  ), facetas as (
    select chave, jsonb_build_object('opcoes', jsonb_object_agg(chave_opcao, quantidade)) as valor
      from contagens_opcoes group by chave
    union all
    select chave, jsonb_build_object('min', minimo, 'max', maximo) from faixas where minimo is not null
    union all
    select distinct chave, '{}'::jsonb from valores
     where tipo = 'texto' and nullif(btrim(valor #>> '{}'), '') is not null
  )
  select array(
    select row(x.id, x.titulo, x.preco_centavos, x.aceita_troca, x.cidade, x.bairro, x.capa,
               x.atributos, x.criado_em, x.cat_slug, x.cat_nome, x.vitrine_nome, x.vitrine_slug,
               x.selo_loja_verificada, x.tipo, x.destaque, contagem.total)::public.anuncio_card
      from achados x
     order by x.destaque desc,
              case when x.destaque then md5(x.id::text || x.dia) end,
              case when ordem = 'menor_preco' then x.preco_centavos end asc nulls last,
              case when ordem = 'maior_preco' then x.preco_centavos end desc nulls last,
              case when coalesce(ordem, '') not in ('recentes', 'menor_preco', 'maior_preco') then x.rel end desc,
              x.recente desc, x.id
     limit least(greatest(coalesce(limite, 24), 1), 48)
    offset greatest(coalesce(deslocamento, 0), 0)
  ), contagem.total, case when campos_facetas is not null then (
    select coalesce(jsonb_object_agg(chave, valor), '{}'::jsonb) from facetas
  ) end
  from contagem
$$;
revoke all on function public.resultado_busca_anuncios(text, text, text, bigint, bigint, jsonb, text, text, integer, integer, jsonb) from public, anon, authenticated;

-- Preserva a assinatura e a ordem para os chamadores que só precisam da lista.
create or replace function public.buscar_anuncios(
  q text default null, categoria_slug text default null, cidade text default null,
  preco_min bigint default null, preco_max bigint default null, filtros jsonb default null,
  ordem text default 'relevancia', microrregiao_slug text default null,
  limite integer default 24, deslocamento integer default 0
) returns setof public.anuncio_card
language sql stable security definer
set search_path = public, extensions
as $$
  select (r.anuncios[n.i]).*
    from public.resultado_busca_anuncios(q, categoria_slug, cidade, preco_min, preco_max,
      filtros, ordem, microrregiao_slug, limite, deslocamento, null) r
   cross join lateral generate_subscripts(r.anuncios, 1) n(i)
   order by n.i
$$;

create function public.buscar_anuncios_com_facetas(
  q text default null, categoria_slug text default null, cidade text default null,
  preco_min bigint default null, preco_max bigint default null, filtros jsonb default null,
  ordem text default 'relevancia', microrregiao_slug text default null,
  limite integer default 24, deslocamento integer default 0
) returns jsonb
language plpgsql stable security definer
set search_path = public, extensions
as $$
declare
  campos jsonb;
  regiao_id uuid;
  filtro record;
  campo record;
  resultado jsonb;
begin
  select c.campos into campos from public.categorias c
   where c.slug = categoria_slug and c.pai_id is not null and public.categoria_disponivel(c.id);
  select m.id into regiao_id from public.microrregioes m where m.slug = microrregiao_slug and m.ativa;
  if campos is null or regiao_id is null then
    raise exception 'Escolha uma subcategoria e uma região disponíveis.' using errcode = '22023';
  end if;

  if filtros is not null and jsonb_typeof(filtros) <> 'object' then
    raise exception 'Os filtros precisam estar em um objeto.' using errcode = '22023';
  end if;
  for filtro in select key, value from jsonb_each(filtros) loop
    select c.* into campo
      from jsonb_to_recordset(campos) as c(chave text, tipo text, filtro boolean, opcoes jsonb)
     where c.chave = filtro.key and c.filtro;
    if not found or not (case
      when campo.tipo = 'numero' and jsonb_typeof(filtro.value) = 'object' then
        (filtro.value ? 'min' or filtro.value ? 'max')
        and filtro.value - 'min' - 'max' = '{}'::jsonb
        and (not (filtro.value ? 'min') or jsonb_typeof(filtro.value->'min') = 'number')
        and (not (filtro.value ? 'max') or jsonb_typeof(filtro.value->'max') = 'number')
        and (not (filtro.value ?& array['min', 'max']) or (filtro.value->'min') <= (filtro.value->'max'))
      when campo.tipo = 'lista' and jsonb_typeof(filtro.value) = 'array' then
        jsonb_array_length(filtro.value) between 1 and 20
        and not exists (
          select 1 from jsonb_array_elements(filtro.value) o
           where jsonb_typeof(o) <> 'string' or not (campo.opcoes ? (o #>> '{}'))
        )
      when campo.tipo = 'sim_nao' then jsonb_typeof(filtro.value) = 'boolean'
      when campo.tipo = 'texto' then jsonb_typeof(filtro.value) = 'string' and char_length(filtro.value #>> '{}') between 1 and 120
      else false
    end) then
      raise exception 'Filtro indisponível ou inválido para esta categoria.' using errcode = '22023';
    end if;
  end loop;

  if public.config('busca.facetas_ativas', regiao_id, 'true') = 'false'::jsonb then
    campos := null;
  end if;
  select jsonb_build_object('anuncios', r.anuncios, 'total', r.total, 'facetas', r.facetas)
    into resultado
    from public.resultado_busca_anuncios(q, categoria_slug, cidade, preco_min, preco_max,
      filtros, ordem, microrregiao_slug, limite, deslocamento, campos) r;
  return resultado;
end;
$$;
revoke all on function public.buscar_anuncios_com_facetas(text, text, text, bigint, bigint, jsonb, text, text, integer, integer) from public;
grant execute on function public.buscar_anuncios_com_facetas(text, text, text, bigint, bigint, jsonb, text, text, integer, integer) to anon, authenticated;
