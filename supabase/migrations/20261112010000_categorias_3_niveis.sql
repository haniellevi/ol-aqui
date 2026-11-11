-- Etapa P1 da reestruturação dos produtos (docs/PLANO-PRODUTOS.md e docs/etapa-p1/ARVORE-PROPOSTA.md):
-- 1. Árvore de categorias com até 3 níveis (Grande › Sub › Tipo).
-- 2. Funções de caminho para busca, Radar, nicho e IA entenderem os 3 níveis.
-- 3. Árvore nova (base OLX + regional), mantendo id e endereço das categorias que já existem.
-- 4. Anúncios que ficaram numa categoria que agora tem filhas ganham uma sugestão pendente
--    ("Revise suas categorias"): continuam no ar até o dono confirmar.

-- ---------------------------------------------------------------------
-- 1. Funções de caminho (limite de 10 passos contra ciclos)
--    Rodam como dono do banco para enxergar a árvore inteira, ligada ou não, mesmo se o RLS
--    de categorias ficar mais fechado no futuro. Só devolvem ids, números e nomes de categoria.
-- ---------------------------------------------------------------------
-- A categoria e as de cima, da própria até a principal.
create function public.categoria_caminho(p_id uuid)
returns setof uuid language sql stable security definer
set search_path = public
as $$
  with recursive acima(id, pai_id, n) as (
    select c.id, c.pai_id, 1 from public.categorias c where c.id = p_id
    union all
    select c.id, c.pai_id, acima.n + 1 from public.categorias c join acima on c.id = acima.pai_id where acima.n < 10
  )
  select id from acima order by n
$$;

-- 1 = categoria principal, 2 = subcategoria, 3 = tipo.
create function public.categoria_nivel(p_id uuid)
returns integer language sql stable security definer
set search_path = public
as $$
  select count(*)::int from public.categoria_caminho(p_id)
$$;

create function public.categoria_raiz(p_id uuid)
returns uuid language sql stable security definer
set search_path = public
as $$
  with recursive acima(id, pai_id, n) as (
    select c.id, c.pai_id, 1 from public.categorias c where c.id = p_id
    union all
    select c.id, c.pai_id, acima.n + 1 from public.categorias c join acima on c.id = acima.pai_id where acima.n < 10
  )
  select id from acima order by n desc limit 1
$$;

-- A categoria e todas as de baixo.
create function public.categoria_e_descendentes(p_id uuid)
returns setof uuid language sql stable security definer
set search_path = public
as $$
  with recursive abaixo(id, n) as (
    select c.id, 1 from public.categorias c where c.id = p_id
    union all
    select c.id, abaixo.n + 1 from public.categorias c join abaixo on c.pai_id = abaixo.id where abaixo.n < 10
  )
  select id from abaixo
$$;

-- Quantos níveis a categoria ocupa com as de baixo (1 = não tem filhas).
create function public.categoria_altura(p_id uuid)
returns integer language sql stable security definer
set search_path = public
as $$
  with recursive abaixo(id, n) as (
    select c.id, 1 from public.categorias c where c.id = p_id
    union all
    select c.id, abaixo.n + 1 from public.categorias c join abaixo on c.pai_id = abaixo.id where abaixo.n < 10
  )
  select coalesce(max(n), 0)::int from abaixo
$$;

-- "Pet › Produtos para pets › Ração"
create function public.categoria_nome_caminho(p_id uuid)
returns text language sql stable security definer
set search_path = public
as $$
  with recursive acima(id, pai_id, nome, n) as (
    select c.id, c.pai_id, c.nome, 1 from public.categorias c where c.id = p_id
    union all
    select c.id, c.pai_id, c.nome, acima.n + 1 from public.categorias c join acima on c.id = acima.pai_id where acima.n < 10
  )
  select string_agg(nome, ' › ' order by n desc) from acima
$$;

revoke all on function public.categoria_caminho(uuid), public.categoria_nivel(uuid), public.categoria_raiz(uuid),
  public.categoria_e_descendentes(uuid), public.categoria_altura(uuid), public.categoria_nome_caminho(uuid) from public;
grant execute on function public.categoria_caminho(uuid), public.categoria_nivel(uuid), public.categoria_raiz(uuid),
  public.categoria_e_descendentes(uuid), public.categoria_altura(uuid), public.categoria_nome_caminho(uuid)
  to anon, authenticated, service_role;

-- Disponível = ela e todas as de cima estão ativas.
create or replace function public.categoria_disponivel(p_id uuid)
returns boolean language sql stable security definer
set search_path = public, extensions
as $$
  select exists (select 1 from public.categorias c where c.id = p_id)
     and not exists (select 1 from public.categorias k
                      where k.id in (select public.categoria_caminho(p_id)) and not k.ativa)
$$;

-- Até 3 níveis, sem ciclo.
create or replace function public.validar_categoria()
returns trigger language plpgsql
set search_path = public
as $$
begin
  new.campos := public.validar_campos_categoria(new.campos);
  if new.pai_id is not null then
    if new.pai_id = new.id
       or (tg_op = 'UPDATE' and new.pai_id in (select public.categoria_e_descendentes(new.id))) then
      raise exception 'Uma categoria não pode ficar dentro dela mesma.' using errcode = '22023';
    end if;
    if public.categoria_nivel(new.pai_id) >= 3 then
      raise exception 'Só existem três níveis: categoria, subcategoria e tipo.' using errcode = '22023';
    end if;
    if tg_op = 'UPDATE' and public.categoria_nivel(new.pai_id) + public.categoria_altura(new.id) > 3 then
      raise exception 'Com as subcategorias que tem, esta categoria passaria de três níveis.' using errcode = '22023';
    end if;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 2. Funções que só olhavam a categoria-mãe passam a olhar o caminho inteiro
--    (mesma definição de antes, só a parte de categoria muda).
-- ---------------------------------------------------------------------
create or replace function public.resultado_busca_anuncios(
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
    select d.id from consulta
     cross join lateral public.categoria_e_descendentes(
       (select p.id from public.categorias p where p.slug = consulta.cat_slug)) as d(id)
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

create or replace function public.catalogo_anuncios(p_regiao uuid, p_cidade text, p_nicho text,
  p_modo text, p_limite integer, p_offset integer)
returns setof jsonb
language sql stable security definer set search_path = public
as $$
  with itens as (
    select a.*, c.slug as cat_slug, c.nome as cat_nome,
           v.nome as vendedor, v.slug as vendedor_slug, v.tipo as vendedor_tipo, v.selo_loja_verificada,
           case when v.tipo = 'pf' then pf.selo_negociador_certificado and pf.verificacao_pf_em is not null else false end as pf_verificada,
           coalesce(p.preco_centavos > 0 and not p.e_teste, false) as plano_pago,
           exists (select 1 from public.destaques d where d.anuncio_id = a.id and d.tipo = 'home'
                    and d.microrregiao_id = p_regiao and d.status = 'ativo' and d.inicio <= now() and d.fim > now()) as destaque_home
      from public.anuncios a
      join public.vitrines_lojas v on v.id = a.vitrine_id and v.status = 'ativa'
      join public.perfis pf on pf.id = v.dono_id
      left join lateral public.plano_efetivo(v) p on true
      left join public.categorias c on c.id = a.categoria_id
      left join public.categorias pai on pai.id = c.pai_id
     where a.status = 'ativo' and a.microrregiao_id = p_regiao
       and (p_modo <> 'lojas' or v.tipo = 'loja')
       and (p_nicho is null or (public.categoria_disponivel(c.id) and p_nicho in (select k.slug from public.categorias k where k.id in (select public.categoria_caminho(c.id)))))
  ), ordenados as (
    select i.*, case when p_modo in ('lojas', 'patrocinados') then destaque_home
                     else coalesce(destaque_ate > now(), false) end as patrocinado,
           count(*) over () as total
      from itens i
     where p_modo in ('lojas', 'feed') or (p_modo = 'patrocinados' and destaque_home)
     order by coalesce(public.nome_comparavel(i.cidade) = public.nome_comparavel(p_cidade), false) desc,
              patrocinado desc,
              case when p_modo = 'patrocinados' or (p_modo = 'lojas' and destaque_home)
                   then md5(i.id::text || to_char(now() at time zone 'America/Fortaleza', 'YYYYMMDDHH24')) end,
              greatest(coalesce(i.publicado_em, i.criado_em), i.subido_em) desc, i.id
     limit least(greatest(coalesce(p_limite, 24), 1), 48)
     offset least(greatest(coalesce(p_offset, 0), 0), 100000)
  )
  select to_jsonb(row(i.id, i.titulo, i.preco_centavos, i.aceita_troca, i.cidade, i.bairro,
             i.fotos[1], i.atributos, coalesce(i.publicado_em, i.criado_em), i.cat_slug, i.cat_nome,
             case when i.vendedor_tipo = 'pf' then split_part(btrim(i.vendedor), ' ', 1) else i.vendedor end,
             i.vendedor_slug, i.selo_loja_verificada, i.vendedor_tipo, i.patrocinado, i.total)::public.anuncio_card)
         || jsonb_build_object('vendedor_pago', i.plano_pago, 'vendedor_pf_verificado', i.pf_verificada)
    from ordenados i
$$;

create or replace function public.catalogo_lojas(p_regiao uuid, p_cidade text, p_nicho text, p_limite integer, p_offset integer, p_destaques boolean default false)
returns table (id uuid, slug text, nome text, cidade text, logo_url text, verificada boolean, total bigint)
language sql stable security definer set search_path = public
as $$
  select v.id, v.slug, v.nome, v.cidade, v.logo_url, v.selo_loja_verificada, count(*) over ()
    from public.vitrines_lojas v
   where v.tipo = 'loja' and v.status = 'ativa' and v.microrregiao_id = p_regiao
     and (not p_destaques or exists (
       select 1 from public.destaques d where d.vitrine_id = v.id and d.tipo = 'loja'
         and d.microrregiao_id = p_regiao and d.status = 'ativo' and d.inicio <= now() and d.fim > now()
     ))
     and (p_nicho is null or exists (
       select 1 from public.anuncios a
       join public.categorias c on c.id = a.categoria_id
       left join public.categorias pai on pai.id = c.pai_id
       where a.vitrine_id = v.id and a.status = 'ativo'
         and public.categoria_disponivel(c.id) and p_nicho in (select k.slug from public.categorias k where k.id in (select public.categoria_caminho(c.id)))
     ))
   order by coalesce(public.nome_comparavel(v.cidade) = public.nome_comparavel(p_cidade), false) desc,
            case when p_destaques then md5(v.id::text || to_char(now() at time zone 'America/Fortaleza', 'YYYYMMDDHH24')) end,
            v.selo_loja_verificada desc, v.nome, v.id
   limit least(greatest(coalesce(p_limite, 24), 1), 48)
   offset least(greatest(coalesce(p_offset, 0), 0), 100000)
$$;

create or replace function public.radar_nicho_corresponde(p_pedido_categoria uuid, p_anuncio_categoria uuid)
returns boolean language sql stable
set search_path = public
as $$
  select public.categoria_disponivel(p_pedido_categoria)
     and public.categoria_disponivel(p_anuncio_categoria)
     and p_pedido_categoria in (select public.categoria_caminho(p_anuncio_categoria))
$$;

create or replace function public.radar_categoria_pedido(p_categoria_id uuid, p_legado public.categoria_anuncio)
returns uuid language sql stable
set search_path = public
as $$
  select case when p_categoria_id is not null then
           case when public.categoria_disponivel(p_categoria_id) then p_categoria_id end
         else (
           select c.id from public.categorias c
            where c.pai_id is null and c.ativa and c.tipo_legado = p_legado
              and c.slug = case p_legado
                when 'veiculo' then 'veiculos'
                when 'imovel' then 'imoveis'
                when 'movel' then 'moveis'
              end
         ) end
$$;

create or replace function public.categorizacao_ia_concluir(p_id uuid, p_reserva uuid, p_sugestoes jsonb,
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
    from (select distinct on (a.vitrine_id) a.vitrine_id, public.categoria_raiz(c.id) as raiz
            from public.anuncios a join public.categorias c on c.id = coalesce(a.categoria_sugerida_id, a.categoria_id)
           where a.vitrine_id in (select b.vitrine_id from public.anuncios b where b.id = any(j.anuncios)) and a.status = 'ativo'
           group by a.vitrine_id, public.categoria_raiz(c.id)
           order by a.vitrine_id, count(*) desc, public.categoria_raiz(c.id)) s
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

create or replace function public.categorizacao_ia_reservar()
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
                                      'nome', replace(public.categoria_nome_caminho(c.id), ' › ', ' > '))
                                    order by p.ordem nulls first, c.ordem, c.slug)
                     from public.categorias c left join public.categorias p on p.id = c.pai_id
                    where public.categoria_folha_disponivel(c.id)));
end $$;

create or replace function public.melhoria_ia_reservar(p_anuncio uuid, p_usuario text)
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
    'categoria', replace(public.categoria_nome_caminho(a.categoria_id), ' › ', ' > '),
    'atributos', coalesce(a.atributos, '{}'::jsonb),
    'fotos', to_jsonb(coalesce(a.fotos[1:3], '{}'::text[])));
end $$;

create or replace function public.moderacao_ia_concluir(p_id uuid,p_reserva uuid,p_resultado jsonb,p_custo_usd numeric default null,
 p_tokens_entrada integer default 0,p_tokens_saida integer default 0)
returns text language plpgsql security definer set search_path=public,extensions as $$
declare j public.moderacao_ia; a public.anuncios; v public.vitrines_lojas; aprovar boolean; fim text; razao text; publicado public.status_anuncio;
begin
 if coalesce(auth.role(),'') <> 'service_role' and session_user not in ('postgres','supabase_admin') then
   raise exception 'Acesso restrito.' using errcode='42501';
 end if;
 select * into j from public.moderacao_ia where id=p_id for update;
 if j.id is null or j.estado<>'processando' or j.reserva is distinct from p_reserva then return 'ignorado'; end if;
 update public.robo_uso set
   custo_centavos=case when p_custo_usd>=0 and p_custo_usd<=0.50 then round(p_custo_usd*cotacao_dolar*100,4) else custo_centavos end,
   tokens_entrada=greatest(coalesce(p_tokens_entrada,0),0),tokens_saida=greatest(coalesce(p_tokens_saida,0),0),
   erro=case when p_custo_usd>=0 and p_custo_usd<=0.50 then null else 'custo_indeterminado' end
 where id=j.uso_id;
 select * into a from public.anuncios where id=j.anuncio_id for update;
 if a.id is null or a.status<>'em_analise' or public.moderacao_ia_revisao(a)<>j.revisao then
   update public.moderacao_ia set estado='obsoleto',concluido_em=now() where id=j.id;
   return 'obsoleto';
 end if;
 razao:=left(coalesce(nullif(btrim(p_resultado->>'motivo'),''),'Resposta inconclusiva. Revisão manual necessária.'),300);
 aprovar := coalesce(p_resultado->>'decisao'='aprovar'
   and jsonb_typeof(p_resultado->'confianca')='number'
   and public.numero_ou_nulo(p_resultado->'confianca') between 0.98 and 1
   and p_resultado->'riscos'='[]'::jsonb
   and public.numero_ou_nulo(p_resultado->'imagens_avaliadas')=cardinality(a.fotos)
   and cardinality(a.fotos)>0 and char_length(razao)>=20
   and p_custo_usd between 0 and 0.50,false);
 select * into v from public.vitrines_lojas where id=a.vitrine_id for update;
 if public.config('moderacao.ia_ativa',null,'false') <> 'true'::jsonb or v.status<>'ativa'
   or not public.whatsapp_confirmado(v.dono_id) or a.congelado_motivo is not null or a.vendido_em is not null
   or a.revisao_manual_admin
   or public.termo_sensivel_anuncio(concat_ws(' ',a.titulo,a.descricao,
     (select string_agg(value,' ') from jsonb_each_text(a.atributos))),a.microrregiao_id) is not null
   or exists(select 1 from public.denuncias where alvo_tipo='anuncio' and alvo_id=a.id and status='aberta')
   or not coalesce(public.categoria_disponivel(a.categoria_id), false) then
   aprovar:=false; razao:='O conteúdo ou a situação do anúncio exige conferência da equipe.';
 end if;
 fim:='manual';
 if aprovar then
   begin
     update public.anuncios set status='ativo',motivo_analise=null where id=a.id returning status into publicado;
     if publicado='ativo' then
       fim:='aprovado';
       perform public.notificar(v.dono_id,'anuncio_aprovado','Seu anúncio foi aprovado',
         'A análise automática foi concluída e seu anúncio está no ar.','/minha-conta/anuncios',
         'moderacao-ia:'||j.id::text);
     else
       razao:='A publicação exige conferência da equipe.';
     end if;
   exception when check_violation or raise_exception or insufficient_privilege then
     razao:='A publicação encontrou uma restrição de cadastro, categoria ou plano. Revisão manual necessária.';
   end;
 end if;
 update public.moderacao_ia set estado=fim,motivo=razao,
   confianca=case when public.numero_ou_nulo(p_resultado->'confianca') between 0 and 1 then public.numero_ou_nulo(p_resultado->'confianca') else null end,
   riscos=case when jsonb_typeof(p_resultado->'riscos')='array' then p_resultado->'riscos' else null end,
   concluido_em=now() where id=j.id;
 return fim;
end $$;

create or replace function public.admin_categorias()
returns table (id uuid, slug text, nome text, icone text, pai_id uuid, ordem integer, ativa boolean, campos jsonb,
               preco_min_centavos bigint, preco_max_centavos bigint, tipo_legado text,
               anuncios_ativos integer, anuncios_total integer, pedidos_radar integer, filhas integer)
language plpgsql stable security definer
set search_path = public, extensions
as $$
begin
  if not public.e_admin() then
    raise exception 'Só a equipe do OLAKI pode ver isso.' using errcode = '42501';
  end if;
  return query
  select c.id, c.slug, c.nome, c.icone, c.pai_id, c.ordem, c.ativa, c.campos,
         c.preco_min_centavos, c.preco_max_centavos, c.tipo_legado::text,
         -- principal: soma os anúncios das subcategorias (é nelas que os anúncios ficam)
         (select count(*)::int from public.anuncios a join public.categorias ac on ac.id = a.categoria_id
           where ac.id in (select public.categoria_e_descendentes(c.id)) and a.status = 'ativo'),
         (select count(*)::int from public.anuncios a join public.categorias ac on ac.id = a.categoria_id
           where ac.id in (select public.categoria_e_descendentes(c.id))),
         (select count(*)::int from public.radar_pedidos r where r.categoria_id = c.id),
         (select count(*)::int from public.categorias f where f.pai_id = c.id)
    from public.categorias c
   order by c.ordem, c.nome;
end $$;


-- ---------------------------------------------------------------------
-- 3. Árvore nova. Categoria que já existe mantém id, endereço e (nas folhas) os campos de hoje.
--    As travas de categoria ficam desligadas só durante a troca e a árvore é conferida no fim.
-- ---------------------------------------------------------------------
alter table public.categorias disable trigger categorias_validar;
alter table public.categorias disable trigger categorias_validar_2;

-- Categoria que já existe: mantém se está ligada ou desligada (o admin pode ter desligado) e os campos que já tem.
-- p_campos nulo numa categoria nova = sem campos.
create function pg_temp.p1_cat(p_slug text, p_nome text, p_icone text, p_pai text, p_ordem integer,
                               p_legado public.categoria_anuncio, p_campos jsonb default null)
returns void language plpgsql as $$
declare
  pai uuid;
  existe uuid;
begin
  if p_pai is not null then
    select id into pai from public.categorias where slug = p_pai;
    if pai is null then raise exception 'P1: categoria-mãe % não existe', p_pai; end if;
  end if;
  select id into existe from public.categorias where slug = p_slug;
  if existe is null then
    insert into public.categorias (slug, nome, icone, pai_id, ordem, ativa, tipo_legado, campos)
    values (p_slug, p_nome, p_icone, pai, p_ordem, true, p_legado, coalesce(p_campos, '[]'::jsonb));
  else
    update public.categorias
       set nome = p_nome, icone = coalesce(p_icone, icone), pai_id = pai, ordem = p_ordem,
           tipo_legado = p_legado,
           -- Campos de hoje ficam. Só categoria ainda sem campos recebe os da proposta.
           -- (Quem tem filhas fica sem campos no fim da carga.)
           campos = case when jsonb_array_length(campos) > 0 then campos else coalesce(p_campos, campos) end,
           preco_min_centavos = case when pai is null then null else preco_min_centavos end,
           preco_max_centavos = case when pai is null then null else preco_max_centavos end
     where id = existe;
  end if;
end $$;

do $$
declare
  nada        jsonb := '[]'::jsonb;
  estado      jsonb := '{"chave":"estado","rotulo":"Estado","tipo":"lista","obrigatorio":false,"filtro":true,"opcoes":["Novo","Seminovo","Usado"]}';
  marca_obr   jsonb := '{"chave":"marca","rotulo":"Marca","tipo":"texto","obrigatorio":true,"filtro":true}';
  marca_opc   jsonb := '{"chave":"marca","rotulo":"Marca","tipo":"texto","obrigatorio":false,"filtro":true}';
  modelo      jsonb := '{"chave":"modelo","rotulo":"Modelo","tipo":"texto","obrigatorio":true,"filtro":false}';
  ano         jsonb := '{"chave":"ano","rotulo":"Ano","tipo":"numero","obrigatorio":true,"filtro":true,"min":1950,"max":2100}';
  km          jsonb := '{"chave":"km","rotulo":"Quilometragem","tipo":"numero","obrigatorio":false,"filtro":true,"unidade":"km","min":0}';
  lugares     jsonb := '{"chave":"lugares","rotulo":"Lugares","tipo":"numero","obrigatorio":false,"filtro":true,"min":1}';
  finalidade  jsonb := '{"chave":"finalidade","rotulo":"Venda ou aluguel","tipo":"lista","obrigatorio":true,"filtro":true,"opcoes":["Venda","Aluguel"]}';
  quartos     jsonb := '{"chave":"quartos","rotulo":"Quartos","tipo":"numero","obrigatorio":false,"filtro":true,"min":0}';
  mobiliado   jsonb := '{"chave":"mobiliado","rotulo":"Mobiliado","tipo":"sim_nao","obrigatorio":false,"filtro":true}';
  hospedes    jsonb := '{"chave":"hospedes","rotulo":"Hóspedes","tipo":"numero","obrigatorio":true,"filtro":true,"min":1}';
  para_veic   jsonb := '{"chave":"para_veiculo","rotulo":"Para qual veículo","tipo":"lista","obrigatorio":true,"filtro":true,"opcoes":["Carro","Moto","Caminhão","Outro"]}';
  marca_maq   jsonb := '{"chave":"marca_maquina","rotulo":"Marca da máquina","tipo":"texto","obrigatorio":false,"filtro":true}';
  apicultura  jsonb := '{"chave":"produto","rotulo":"Produto","tipo":"lista","obrigatorio":true,"filtro":true,"opcoes":["Mel","Colmeias","Equipamentos","Outro"]}';
  raca_pet    jsonb := '{"chave":"raca","rotulo":"Raça","tipo":"texto","obrigatorio":false,"filtro":true}';
  idade_pet   jsonb := '{"chave":"idade_meses","rotulo":"Idade","tipo":"numero","obrigatorio":false,"filtro":false,"unidade":"meses","min":0}';
  sexo_pet    jsonb := '{"chave":"sexo","rotulo":"Sexo","tipo":"lista","obrigatorio":false,"filtro":true,"opcoes":["Macho","Fêmea"]}';
  vacinado    jsonb := '{"chave":"vacinado","rotulo":"Vacinado","tipo":"sim_nao","obrigatorio":false,"filtro":true}';
  castrado    jsonb := '{"chave":"castrado","rotulo":"Castrado","tipo":"sim_nao","obrigatorio":false,"filtro":true}';
  doacao      jsonb := '{"chave":"doacao","rotulo":"Doação","tipo":"sim_nao","obrigatorio":false,"filtro":true}';
  especie     jsonb := '{"chave":"especie","rotulo":"Espécie","tipo":"lista","obrigatorio":true,"filtro":true,"opcoes":["Pássaro","Peixe","Roedor","Coelho","Réptil","Outro"]}';
  para_animal jsonb := '{"chave":"para_animal","rotulo":"Para qual animal","tipo":"lista","obrigatorio":true,"filtro":true,"opcoes":["Cachorro","Gato","Pássaro","Peixe","Roedor","Outro"]}';
  peso_emb    jsonb := '{"chave":"peso_kg","rotulo":"Peso da embalagem","tipo":"numero","obrigatorio":true,"filtro":true,"unidade":"kg","min":0}';
  fase        jsonb := '{"chave":"fase","rotulo":"Fase","tipo":"lista","obrigatorio":false,"filtro":true,"opcoes":["Filhote","Adulto","Sênior"]}';
  marca_cel   jsonb := '{"chave":"marca","rotulo":"Marca","tipo":"lista","obrigatorio":true,"filtro":true,"opcoes":["Apple","Samsung","Motorola","Xiaomi","LG","Realme","Asus","Nokia","Outra"]}';
  armazen     jsonb := '{"chave":"armazenamento","rotulo":"Armazenamento","tipo":"lista","obrigatorio":false,"filtro":true,"opcoes":["16 GB","32 GB","64 GB","128 GB","256 GB","512 GB","1 TB ou mais"]}';
  processador jsonb := '{"chave":"processador","rotulo":"Processador","tipo":"texto","obrigatorio":false,"filtro":false}';
  memoria     jsonb := '{"chave":"memoria","rotulo":"Memória","tipo":"lista","obrigatorio":false,"filtro":true,"opcoes":["4 GB","8 GB","16 GB","32 GB ou mais"]}';
  tela_opc    jsonb := '{"chave":"tamanho_pol","rotulo":"Tamanho da tela","tipo":"numero","obrigatorio":false,"filtro":true,"unidade":"pol.","min":1}';
  tela_obr    jsonb := '{"chave":"tamanho_pol","rotulo":"Tamanho da tela","tipo":"numero","obrigatorio":true,"filtro":true,"unidade":"pol.","min":1}';
  plataforma  jsonb := '{"chave":"plataforma","rotulo":"Plataforma","tipo":"lista","obrigatorio":true,"filtro":true,"opcoes":["PlayStation","Xbox","Nintendo","Computador","Outra"]}';
  voltagem    jsonb := '{"chave":"voltagem","rotulo":"Voltagem","tipo":"lista","obrigatorio":true,"filtro":true,"opcoes":["110 V","220 V","Bivolt"]}';
  btus        jsonb := '{"chave":"btus","rotulo":"Potência","tipo":"numero","obrigatorio":false,"filtro":true,"unidade":"BTUs","min":0}';
  capacidade  jsonb := '{"chave":"capacidade_kg","rotulo":"Capacidade","tipo":"numero","obrigatorio":false,"filtro":true,"unidade":"kg","min":0}';
  bocas       jsonb := '{"chave":"bocas","rotulo":"Bocas","tipo":"lista","obrigatorio":false,"filtro":true,"opcoes":["2","4","5","6"]}';
  tam_cama    jsonb := '{"chave":"tamanho","rotulo":"Tamanho","tipo":"lista","obrigatorio":true,"filtro":true,"opcoes":["Solteiro","Casal","Queen","King"]}';
  tam_roupa   jsonb := '{"chave":"tamanho","rotulo":"Tamanho","tipo":"texto","obrigatorio":false,"filtro":true}';
  numero_calc jsonb := '{"chave":"numero","rotulo":"Número","tipo":"numero","obrigatorio":false,"filtro":true,"min":10,"max":50}';
  aro         jsonb := '{"chave":"aro","rotulo":"Aro","tipo":"lista","obrigatorio":false,"filtro":true,"opcoes":["12","16","20","24","26","29"]}';
  campos_gado jsonb;
  campos_pecas jsonb;
  campos_sementes jsonb;
begin
  -- Campos de hoje das subs que viram mãe de tipos: os tipos herdam.
  select campos into campos_gado from public.categorias where slug = 'gado-e-animais';
  select campos into campos_pecas from public.categorias where slug = 'pecas-e-acessorios';
  select campos into campos_sementes from public.categorias where slug = 'sementes-e-insumos';
  campos_gado := coalesce(campos_gado, nada);
  campos_pecas := coalesce(campos_pecas, jsonb_build_array(estado));
  campos_sementes := coalesce(campos_sementes, nada);

  -- Grandes (ordem do menu)
  perform pg_temp.p1_cat('veiculos', 'Veículos', 'car', null, 1, 'veiculo', nada);
  perform pg_temp.p1_cat('imoveis', 'Imóveis', 'house', null, 2, 'imovel', nada);
  perform pg_temp.p1_cat('agro', 'Agro', 'tractor', null, 3, 'geral', nada);
  perform pg_temp.p1_cat('animais-de-estimacao', 'Pet', 'paw-print', null, 4, 'geral', nada);
  perform pg_temp.p1_cat('celulares-e-telefonia', 'Celulares e telefonia', 'smartphone', null, 5, 'geral', nada);
  perform pg_temp.p1_cat('informatica', 'Informática', 'laptop', null, 6, 'geral', nada);
  perform pg_temp.p1_cat('games', 'Games', 'gamepad-2', null, 7, 'geral', nada);
  perform pg_temp.p1_cat('tv-audio-e-foto', 'TV, áudio e foto', 'tv', null, 8, 'geral', nada);
  perform pg_temp.p1_cat('eletrodomesticos', 'Eletro', 'refrigerator', null, 9, 'geral', nada);
  perform pg_temp.p1_cat('moveis', 'Móveis', 'armchair', null, 10, 'movel', nada);
  perform pg_temp.p1_cat('casa-e-moveis', 'Casa e decoração', 'lamp', null, 11, 'movel', nada);
  perform pg_temp.p1_cat('construcao', 'Materiais de construção', 'hammer', null, 12, 'geral', nada);
  perform pg_temp.p1_cat('moda-e-beleza', 'Moda e beleza', 'shirt', null, 13, 'geral', nada);
  perform pg_temp.p1_cat('infantil', 'Infantil', 'baby', null, 14, 'geral', nada);
  perform pg_temp.p1_cat('esporte', 'Esporte e lazer', 'dumbbell', null, 15, 'geral', nada);
  perform pg_temp.p1_cat('musica-e-hobbies', 'Música e hobbies', 'sparkles', null, 16, 'geral', nada);
  perform pg_temp.p1_cat('comercio-e-escritorio', 'Comércio e escritório', 'store', null, 17, 'geral', nada);
  perform pg_temp.p1_cat('festas-e-eventos', 'Festas e eventos', 'sparkles', null, 18, 'geral', nada);
  perform pg_temp.p1_cat('servicos', 'Serviços', 'hand-helping', null, 19, 'geral', nada);
  perform pg_temp.p1_cat('empregos', 'Empregos', 'briefcase', null, 20, 'geral', nada);
  perform pg_temp.p1_cat('outros', 'Outros', 'package', null, 21, 'geral', nada);

  -- 1. Veículos
  perform pg_temp.p1_cat('carros', 'Carros', null, 'veiculos', 1, 'veiculo');
  perform pg_temp.p1_cat('motos', 'Motos', null, 'veiculos', 2, 'veiculo');
  perform pg_temp.p1_cat('caminhoes-e-utilitarios', 'Caminhões e utilitários', null, 'veiculos', 3, 'veiculo');
  perform pg_temp.p1_cat('onibus-e-vans', 'Ônibus e vans', null, 'veiculos', 4, 'veiculo', jsonb_build_array(marca_obr, ano, km, lugares));
  perform pg_temp.p1_cat('pecas-e-acessorios', 'Peças e acessórios', null, 'veiculos', 5, 'geral', nada);
  perform pg_temp.p1_cat('pecas-de-motor', 'Peças de motor e mecânica', null, 'pecas-e-acessorios', 1, 'geral', campos_pecas || jsonb_build_array(para_veic));
  perform pg_temp.p1_cat('pneus-e-rodas', 'Pneus e rodas', null, 'pecas-e-acessorios', 2, 'geral', campos_pecas || jsonb_build_array(para_veic));
  perform pg_temp.p1_cat('som-automotivo', 'Som e multimídia', null, 'pecas-e-acessorios', 3, 'geral', campos_pecas || jsonb_build_array(para_veic));
  perform pg_temp.p1_cat('acessorios-automotivos', 'Acessórios', null, 'pecas-e-acessorios', 4, 'geral', campos_pecas || jsonb_build_array(para_veic));

  -- 2. Imóveis
  perform pg_temp.p1_cat('casas', 'Casas', null, 'imoveis', 1, 'imovel');
  perform pg_temp.p1_cat('apartamentos', 'Apartamentos', null, 'imoveis', 2, 'imovel');
  perform pg_temp.p1_cat('kitnets-e-quartos', 'Kitnets e quartos', null, 'imoveis', 3, 'imovel', jsonb_build_array(finalidade, mobiliado));
  perform pg_temp.p1_cat('terrenos-e-lotes', 'Terrenos e lotes', null, 'imoveis', 4, 'imovel');
  perform pg_temp.p1_cat('fazendas-e-sitios', 'Fazendas e sítios', null, 'imoveis', 5, 'imovel');
  perform pg_temp.p1_cat('pontos-comerciais', 'Pontos comerciais', null, 'imoveis', 6, 'imovel');
  perform pg_temp.p1_cat('temporada', 'Temporada', null, 'imoveis', 7, 'imovel', jsonb_build_array(hospedes, quartos));

  -- 3. Agro
  perform pg_temp.p1_cat('tratores-e-maquinas', 'Tratores e máquinas', null, 'agro', 1, 'veiculo');
  perform pg_temp.p1_cat('implementos', 'Implementos', null, 'agro', 2, 'geral');
  perform pg_temp.p1_cat('pecas-para-tratores', 'Peças para tratores e máquinas', null, 'agro', 3, 'geral', jsonb_build_array(marca_maq, estado));
  perform pg_temp.p1_cat('gado-e-animais', 'Gado e animais', null, 'agro', 4, 'geral', nada);
  perform pg_temp.p1_cat('bovinos', 'Bovinos', null, 'gado-e-animais', 1, 'geral', campos_gado);
  perform pg_temp.p1_cat('equinos', 'Equinos', null, 'gado-e-animais', 2, 'geral', campos_gado);
  perform pg_temp.p1_cat('caprinos-e-ovinos', 'Caprinos e ovinos', null, 'gado-e-animais', 3, 'geral', campos_gado);
  perform pg_temp.p1_cat('suinos', 'Suínos', null, 'gado-e-animais', 4, 'geral', campos_gado);
  perform pg_temp.p1_cat('aves', 'Aves', null, 'gado-e-animais', 5, 'geral', campos_gado);
  perform pg_temp.p1_cat('sementes-e-insumos', 'Sementes e insumos', null, 'agro', 5, 'geral', nada);
  perform pg_temp.p1_cat('sementes', 'Sementes', null, 'sementes-e-insumos', 1, 'geral', campos_sementes);
  perform pg_temp.p1_cat('adubos-e-fertilizantes', 'Adubos e fertilizantes', null, 'sementes-e-insumos', 2, 'geral', campos_sementes);
  perform pg_temp.p1_cat('defensivos', 'Defensivos', null, 'sementes-e-insumos', 3, 'geral', campos_sementes);
  perform pg_temp.p1_cat('racoes-para-criacao', 'Rações para criação', null, 'sementes-e-insumos', 4, 'geral', campos_sementes);
  perform pg_temp.p1_cat('sal-mineral', 'Sal mineral', null, 'sementes-e-insumos', 5, 'geral', campos_sementes);
  perform pg_temp.p1_cat('graos', 'Grãos', null, 'agro', 6, 'geral');
  perform pg_temp.p1_cat('apicultura', 'Apicultura', null, 'agro', 7, 'geral', jsonb_build_array(apicultura));

  -- 4. Pet
  perform pg_temp.p1_cat('cachorros', 'Cachorros', null, 'animais-de-estimacao', 1, 'geral', jsonb_build_array(raca_pet, idade_pet, sexo_pet, vacinado, castrado, doacao));
  perform pg_temp.p1_cat('gatos', 'Gatos', null, 'animais-de-estimacao', 2, 'geral', jsonb_build_array(raca_pet, idade_pet, sexo_pet, vacinado, castrado, doacao));
  perform pg_temp.p1_cat('outros-animais', 'Outros animais', null, 'animais-de-estimacao', 3, 'geral', jsonb_build_array(especie, doacao));
  perform pg_temp.p1_cat('produtos-para-pets', 'Produtos para pets', null, 'animais-de-estimacao', 4, 'geral', nada);
  perform pg_temp.p1_cat('racao', 'Ração', null, 'produtos-para-pets', 1, 'geral', jsonb_build_array(para_animal, peso_emb, fase, marca_opc));
  perform pg_temp.p1_cat('petiscos', 'Petiscos', null, 'produtos-para-pets', 2, 'geral', jsonb_build_array(para_animal, marca_opc));
  perform pg_temp.p1_cat('coleiras-e-guias', 'Coleiras e guias', null, 'produtos-para-pets', 3, 'geral', jsonb_build_array(para_animal, estado));
  perform pg_temp.p1_cat('camas-e-casinhas', 'Camas e casinhas', null, 'produtos-para-pets', 4, 'geral', jsonb_build_array(para_animal, estado));
  perform pg_temp.p1_cat('brinquedos-para-pets', 'Brinquedos para pets', null, 'produtos-para-pets', 5, 'geral', jsonb_build_array(para_animal, estado));
  perform pg_temp.p1_cat('higiene-e-saude-pet', 'Higiene e saúde', null, 'produtos-para-pets', 6, 'geral', jsonb_build_array(para_animal));
  perform pg_temp.p1_cat('aquarios-e-gaiolas', 'Aquários e gaiolas', null, 'produtos-para-pets', 7, 'geral', jsonb_build_array(para_animal, estado));

  -- 5. Celulares e telefonia
  perform pg_temp.p1_cat('celulares', 'Celulares', null, 'celulares-e-telefonia', 1, 'geral');
  perform pg_temp.p1_cat('acessorios-de-celular', 'Acessórios de celular', null, 'celulares-e-telefonia', 2, 'geral', nada);
  perform pg_temp.p1_cat('capas-e-peliculas', 'Capas e películas', null, 'acessorios-de-celular', 1, 'geral', jsonb_build_array(estado));
  perform pg_temp.p1_cat('carregadores-e-cabos', 'Carregadores e cabos', null, 'acessorios-de-celular', 2, 'geral', jsonb_build_array(estado));
  perform pg_temp.p1_cat('suportes-de-celular', 'Suportes', null, 'acessorios-de-celular', 3, 'geral', jsonb_build_array(estado));
  perform pg_temp.p1_cat('pecas-de-celular', 'Peças de celular', null, 'celulares-e-telefonia', 3, 'geral', jsonb_build_array(marca_opc, estado));
  perform pg_temp.p1_cat('smartwatches', 'Smartwatches', null, 'celulares-e-telefonia', 4, 'geral', jsonb_build_array(marca_obr, estado));
  perform pg_temp.p1_cat('telefonia-fixa', 'Telefonia fixa', null, 'celulares-e-telefonia', 5, 'geral', jsonb_build_array(estado));

  -- 6. Informática
  perform pg_temp.p1_cat('notebooks', 'Notebooks', null, 'informatica', 1, 'geral', jsonb_build_array(marca_obr, processador, memoria, estado));
  perform pg_temp.p1_cat('computadores', 'Computadores', null, 'informatica', 2, 'geral', jsonb_build_array(processador, memoria, estado));
  perform pg_temp.p1_cat('monitores', 'Monitores', null, 'informatica', 3, 'geral', jsonb_build_array(tela_opc, estado));
  perform pg_temp.p1_cat('tablets-e-leitores', 'Tablets e leitores', null, 'informatica', 4, 'geral', jsonb_build_array(marca_obr, estado));
  perform pg_temp.p1_cat('impressoras-e-scanners', 'Impressoras e scanners', null, 'informatica', 5, 'geral', jsonb_build_array(estado));
  perform pg_temp.p1_cat('perifericos', 'Periféricos', null, 'informatica', 6, 'geral', nada);
  perform pg_temp.p1_cat('teclados-e-mouses', 'Teclados e mouses', null, 'perifericos', 1, 'geral', jsonb_build_array(estado));
  perform pg_temp.p1_cat('webcams', 'Webcams', null, 'perifericos', 2, 'geral', jsonb_build_array(estado));
  perform pg_temp.p1_cat('estabilizadores-e-nobreaks', 'Estabilizadores e nobreaks', null, 'perifericos', 3, 'geral', jsonb_build_array(estado));
  perform pg_temp.p1_cat('pecas-de-computador', 'Peças e componentes', null, 'informatica', 7, 'geral', nada);
  perform pg_temp.p1_cat('placas-de-video', 'Placas de vídeo', null, 'pecas-de-computador', 1, 'geral', jsonb_build_array(estado));
  perform pg_temp.p1_cat('memoria-ram', 'Memória RAM', null, 'pecas-de-computador', 2, 'geral', jsonb_build_array(estado));
  perform pg_temp.p1_cat('processadores', 'Processadores', null, 'pecas-de-computador', 3, 'geral', jsonb_build_array(estado));
  perform pg_temp.p1_cat('hd-e-ssd', 'HD e SSD', null, 'pecas-de-computador', 4, 'geral', jsonb_build_array(estado));
  perform pg_temp.p1_cat('redes-e-internet', 'Redes e internet', null, 'informatica', 8, 'geral', jsonb_build_array(estado));

  -- 7. Games
  perform pg_temp.p1_cat('consoles', 'Consoles', null, 'games', 1, 'geral', jsonb_build_array(plataforma, estado));
  perform pg_temp.p1_cat('jogos', 'Jogos', null, 'games', 2, 'geral', jsonb_build_array(plataforma, estado));
  perform pg_temp.p1_cat('acessorios-de-games', 'Acessórios de games', null, 'games', 3, 'geral', jsonb_build_array(estado));

  -- 8. TV, áudio e foto
  perform pg_temp.p1_cat('tv-e-som', 'TV e som', null, 'tv-audio-e-foto', 1, 'geral', nada);
  perform pg_temp.p1_cat('tvs', 'TVs', null, 'tv-e-som', 1, 'geral', jsonb_build_array(tela_obr, marca_opc, estado));
  perform pg_temp.p1_cat('som-e-caixas', 'Som e caixas', null, 'tv-e-som', 2, 'geral', jsonb_build_array(marca_opc, estado));
  perform pg_temp.p1_cat('fones-de-ouvido', 'Fones de ouvido', null, 'tv-e-som', 3, 'geral', jsonb_build_array(estado));
  perform pg_temp.p1_cat('streaming-e-tv-box', 'Streaming e TV box', null, 'tv-e-som', 4, 'geral', jsonb_build_array(estado));
  perform pg_temp.p1_cat('projetores', 'Projetores', null, 'tv-e-som', 5, 'geral', jsonb_build_array(estado));
  perform pg_temp.p1_cat('cameras-e-drones', 'Câmeras e drones', null, 'tv-audio-e-foto', 2, 'geral', jsonb_build_array(marca_opc, estado));

  -- 9. Eletro
  perform pg_temp.p1_cat('geladeiras-e-freezers', 'Geladeiras e freezers', null, 'eletrodomesticos', 1, 'geral', jsonb_build_array(voltagem, estado));
  perform pg_temp.p1_cat('fogoes-e-fornos', 'Fogões e fornos', null, 'eletrodomesticos', 2, 'geral', jsonb_build_array(bocas, estado));
  perform pg_temp.p1_cat('maquinas-de-lavar', 'Máquinas de lavar e secadoras', null, 'eletrodomesticos', 3, 'geral', jsonb_build_array(voltagem, capacidade, estado));
  perform pg_temp.p1_cat('ar-e-ventiladores', 'Ar-condicionado e ventiladores', null, 'eletrodomesticos', 4, 'geral', jsonb_build_array(voltagem, btus, estado));
  perform pg_temp.p1_cat('portateis-de-cozinha', 'Portáteis de cozinha', null, 'eletrodomesticos', 5, 'geral', jsonb_build_array(voltagem, estado));
  perform pg_temp.p1_cat('cuidados-pessoais', 'Cuidados pessoais', null, 'eletrodomesticos', 6, 'geral', jsonb_build_array(estado));

  -- 10. Móveis
  perform pg_temp.p1_cat('sofas-e-poltronas', 'Sofás e poltronas', null, 'moveis', 1, 'movel', jsonb_build_array(estado));
  perform pg_temp.p1_cat('camas-e-colchoes', 'Camas e colchões', null, 'moveis', 2, 'movel', jsonb_build_array(tam_cama, estado));
  perform pg_temp.p1_cat('guarda-roupas-e-comodas', 'Guarda-roupas e cômodas', null, 'moveis', 3, 'movel', jsonb_build_array(estado));
  perform pg_temp.p1_cat('mesas-e-cadeiras', 'Mesas e cadeiras', null, 'moveis', 4, 'movel', jsonb_build_array(estado));
  perform pg_temp.p1_cat('racks-e-estantes', 'Racks e estantes', null, 'moveis', 5, 'movel', jsonb_build_array(estado));
  perform pg_temp.p1_cat('moveis-de-escritorio', 'Móveis de escritório', null, 'moveis', 6, 'movel', jsonb_build_array(estado));

  -- 11. Casa e decoração
  perform pg_temp.p1_cat('decoracao', 'Decoração', null, 'casa-e-moveis', 1, 'movel');
  perform pg_temp.p1_cat('cozinha-e-utensilios', 'Cozinha e utensílios', null, 'casa-e-moveis', 2, 'geral', jsonb_build_array(estado));
  perform pg_temp.p1_cat('cama-mesa-e-banho', 'Cama, mesa e banho', null, 'casa-e-moveis', 3, 'geral', jsonb_build_array(estado));
  perform pg_temp.p1_cat('iluminacao', 'Iluminação', null, 'casa-e-moveis', 4, 'geral', jsonb_build_array(estado));
  perform pg_temp.p1_cat('jardim-e-area-externa', 'Jardim e área externa', null, 'casa-e-moveis', 5, 'geral', jsonb_build_array(estado));
  perform pg_temp.p1_cat('limpeza-e-organizacao', 'Limpeza e organização', null, 'casa-e-moveis', 6, 'geral', jsonb_build_array(estado));
  perform pg_temp.p1_cat('seguranca-e-casa-inteligente', 'Segurança e casa inteligente', null, 'casa-e-moveis', 7, 'geral', jsonb_build_array(estado));

  -- 12. Materiais de construção
  perform pg_temp.p1_cat('ferramentas', 'Ferramentas', null, 'construcao', 1, 'geral', jsonb_build_array(estado));
  perform pg_temp.p1_cat('eletrica-e-hidraulica', 'Elétrica e hidráulica', null, 'construcao', 2, 'geral', jsonb_build_array(estado));
  perform pg_temp.p1_cat('loucas-metais-e-pias', 'Louças, metais e pias', null, 'construcao', 3, 'geral', jsonb_build_array(estado));
  perform pg_temp.p1_cat('portas-e-janelas', 'Portas e janelas', null, 'construcao', 4, 'geral', jsonb_build_array(estado));
  perform pg_temp.p1_cat('pisos-e-revestimentos', 'Pisos e revestimentos', null, 'construcao', 5, 'geral', jsonb_build_array(estado));
  perform pg_temp.p1_cat('tintas-e-pintura', 'Tintas e pintura', null, 'construcao', 6, 'geral', jsonb_build_array(estado));
  perform pg_temp.p1_cat('alvenaria-e-estrutura', 'Alvenaria e estrutura', null, 'construcao', 7, 'geral', jsonb_build_array(estado));

  -- 13. Moda e beleza (as que já existem mantêm os campos)
  perform pg_temp.p1_cat('roupas', 'Roupas', null, 'moda-e-beleza', 1, 'geral');
  perform pg_temp.p1_cat('calcados', 'Calçados', null, 'moda-e-beleza', 2, 'geral');
  perform pg_temp.p1_cat('bolsas', 'Bolsas e acessórios', null, 'moda-e-beleza', 3, 'geral');
  perform pg_temp.p1_cat('joias-e-relogios', 'Joias e relógios', null, 'moda-e-beleza', 4, 'geral', jsonb_build_array(estado));
  perform pg_temp.p1_cat('beleza', 'Beleza e perfumaria', null, 'moda-e-beleza', 5, 'geral');

  -- 14. Infantil
  perform pg_temp.p1_cat('roupas-infantis', 'Roupas infantis', null, 'infantil', 1, 'geral', jsonb_build_array(tam_roupa, estado));
  perform pg_temp.p1_cat('calcados-infantis', 'Calçados infantis', null, 'infantil', 2, 'geral', jsonb_build_array(numero_calc, estado));
  perform pg_temp.p1_cat('brinquedos-e-jogos', 'Brinquedos e jogos', null, 'infantil', 3, 'geral', jsonb_build_array(estado));
  perform pg_temp.p1_cat('carrinhos-e-cadeirinhas', 'Carrinhos e cadeirinhas', null, 'infantil', 4, 'geral', jsonb_build_array(estado));
  perform pg_temp.p1_cat('moveis-infantis', 'Móveis infantis', null, 'infantil', 5, 'geral', jsonb_build_array(estado));
  perform pg_temp.p1_cat('maternidade', 'Maternidade', null, 'infantil', 6, 'geral', jsonb_build_array(estado));

  -- 15. Esporte e lazer
  perform pg_temp.p1_cat('bicicletas-e-ciclismo', 'Bicicletas e ciclismo', null, 'esporte', 1, 'geral', jsonb_build_array(aro, estado));
  perform pg_temp.p1_cat('academia-e-fitness', 'Academia e fitness', null, 'esporte', 2, 'geral', jsonb_build_array(estado));
  perform pg_temp.p1_cat('futebol-e-quadra', 'Futebol e esportes de quadra', null, 'esporte', 3, 'geral', jsonb_build_array(estado));
  perform pg_temp.p1_cat('pesca-e-camping', 'Pesca e camping', null, 'esporte', 4, 'geral', jsonb_build_array(estado));
  perform pg_temp.p1_cat('roupas-e-calcados-esportivos', 'Roupas e calçados esportivos', null, 'esporte', 5, 'geral', jsonb_build_array(estado));

  -- 16. Música e hobbies
  perform pg_temp.p1_cat('instrumentos-musicais', 'Instrumentos musicais', null, 'musica-e-hobbies', 1, 'geral', jsonb_build_array(marca_opc, estado));
  perform pg_temp.p1_cat('livros-e-revistas', 'Livros e revistas', null, 'musica-e-hobbies', 2, 'geral', jsonb_build_array(estado));
  perform pg_temp.p1_cat('colecionaveis-e-antiguidades', 'Colecionáveis e antiguidades', null, 'musica-e-hobbies', 3, 'geral', jsonb_build_array(estado));
  perform pg_temp.p1_cat('artesanato', 'Artesanato', null, 'musica-e-hobbies', 4, 'geral', nada);

  -- 17. Comércio e escritório
  perform pg_temp.p1_cat('equipamentos-para-comercio', 'Equipamentos para comércio', null, 'comercio-e-escritorio', 1, 'geral', jsonb_build_array(estado));
  perform pg_temp.p1_cat('gastronomia-e-food-service', 'Gastronomia e food service', null, 'comercio-e-escritorio', 2, 'geral', jsonb_build_array(estado));
  perform pg_temp.p1_cat('saude-e-estetica', 'Equipamentos de saúde e estética', null, 'comercio-e-escritorio', 3, 'geral', jsonb_build_array(estado));
  perform pg_temp.p1_cat('uniformes-e-epis', 'Uniformes e EPIs', null, 'comercio-e-escritorio', 4, 'geral', jsonb_build_array(estado));
  perform pg_temp.p1_cat('papelaria-e-escritorio', 'Papelaria e escritório', null, 'comercio-e-escritorio', 5, 'geral', jsonb_build_array(estado));

  -- 18. Festas e eventos
  perform pg_temp.p1_cat('decoracao-de-festa', 'Decoração de festa', null, 'festas-e-eventos', 1, 'geral', jsonb_build_array(estado));
  perform pg_temp.p1_cat('aluguel-para-festas', 'Aluguel para festas', null, 'festas-e-eventos', 2, 'geral', nada);
  perform pg_temp.p1_cat('lembrancinhas-e-convites', 'Lembrancinhas e convites', null, 'festas-e-eventos', 3, 'geral', nada);
  perform pg_temp.p1_cat('noivas-e-noivos', 'Noivas e noivos', null, 'festas-e-eventos', 4, 'geral', jsonb_build_array(estado));

  -- 19. Serviços (sem campos)
  perform pg_temp.p1_cat('pedreiro', 'Pedreiro', null, 'servicos', 1, 'geral');
  perform pg_temp.p1_cat('eletricista', 'Eletricista', null, 'servicos', 2, 'geral');
  perform pg_temp.p1_cat('encanador', 'Encanador', null, 'servicos', 3, 'geral', nada);
  perform pg_temp.p1_cat('pintor', 'Pintor', null, 'servicos', 4, 'geral', nada);
  perform pg_temp.p1_cat('mecanico', 'Mecânico', null, 'servicos', 5, 'geral', nada);
  perform pg_temp.p1_cat('conserto-de-celular-e-informatica', 'Conserto de celular e informática', null, 'servicos', 6, 'geral', nada);
  perform pg_temp.p1_cat('fretes', 'Fretes e mudanças', null, 'servicos', 7, 'geral');
  perform pg_temp.p1_cat('diaristas', 'Diaristas', null, 'servicos', 8, 'geral');
  perform pg_temp.p1_cat('beleza-e-estetica', 'Beleza e estética', null, 'servicos', 9, 'geral', nada);
  perform pg_temp.p1_cat('buffet-e-eventos', 'Buffet e eventos', null, 'servicos', 10, 'geral', nada);
  perform pg_temp.p1_cat('aulas', 'Aulas', null, 'servicos', 11, 'geral');
  perform pg_temp.p1_cat('outros-servicos', 'Outros serviços', null, 'servicos', 12, 'geral');

  -- 20. Empregos
  perform pg_temp.p1_cat('vagas', 'Vagas', null, 'empregos', 1, 'geral');
  perform pg_temp.p1_cat('procuro-trabalho', 'Procuro trabalho', null, 'empregos', 2, 'geral');

  -- 21. Outros
  perform pg_temp.p1_cat('diversos', 'Diversos', null, 'outros', 1, 'geral');

  -- A antiga "Eletrônicos" ficou sem filhas: sai do menu (não apaga, por causa do histórico).
  update public.categorias set ativa = false where slug = 'eletronicos';
  -- Quem tem filhas não recebe campos nem limite de preço.
  update public.categorias p set campos = '[]'::jsonb, preco_min_centavos = null, preco_max_centavos = null
   where exists (select 1 from public.categorias f where f.pai_id = p.id);
end $$;

alter table public.categorias enable trigger categorias_validar;
alter table public.categorias enable trigger categorias_validar_2;

-- Conferência da árvore: falha a migração inteira se algo ficou errado.
do $$
declare
  ruim text;
begin
  select string_agg(slug, ', ') into ruim from public.categorias where public.categoria_nivel(id) > 3;
  if ruim is not null then raise exception 'P1: categorias com mais de 3 níveis: %', ruim; end if;
  select string_agg(slug, ', ') into ruim from public.categorias
   where pai_id is null and (jsonb_array_length(campos) > 0 or preco_min_centavos is not null or preco_max_centavos is not null);
  if ruim is not null then raise exception 'P1: categoria principal com campos ou preço: %', ruim; end if;
  select string_agg(c.slug, ', ') into ruim from public.categorias c
   where c.ativa and c.pai_id is not null
     and not exists (select 1 from public.categorias p where p.id = c.pai_id and p.ativa);
  if ruim is not null then raise exception 'P1: categoria ativa dentro de uma desligada: %', ruim; end if;
  perform public.validar_campos_categoria(campos) from public.categorias;
end $$;

-- ---------------------------------------------------------------------
-- 4. Anúncios numa categoria que agora tem filhas: sugestão pendente para o dono confirmar.
--    Escolha: palavra inteira do título (aceita plural simples) > folha reserva da categoria > primeira folha.
--    O anúncio continua no ar e na mesma categoria até o dono decidir.
-- ---------------------------------------------------------------------
create temp table p1_palavras (folha text not null, palavra text not null);
insert into p1_palavras (folha, palavra) values
  ('sofas-e-poltronas','sofa'),('sofas-e-poltronas','poltrona'),('sofas-e-poltronas','puff'),
  ('camas-e-colchoes','cama'),('camas-e-colchoes','colchao'),('camas-e-colchoes','colchoes'),('camas-e-colchoes','beliche'),
  ('guarda-roupas-e-comodas','guarda'),('guarda-roupas-e-comodas','comoda'),('guarda-roupas-e-comodas','armario'),('guarda-roupas-e-comodas','roupeiro'),
  ('mesas-e-cadeiras','mesa'),('mesas-e-cadeiras','cadeira'),('mesas-e-cadeiras','banqueta'),
  ('racks-e-estantes','rack'),('racks-e-estantes','estante'),('racks-e-estantes','painel'),('racks-e-estantes','prateleira'),('racks-e-estantes','aparador'),
  ('moveis-de-escritorio','escrivaninha'),('moveis-de-escritorio','escritorio'),('moveis-de-escritorio','gaveteiro'),
  ('geladeiras-e-freezers','geladeira'),('geladeiras-e-freezers','freezer'),('geladeiras-e-freezers','frigobar'),('geladeiras-e-freezers','refrigerador'),
  ('fogoes-e-fornos','fogao'),('fogoes-e-fornos','forno'),('fogoes-e-fornos','cooktop'),
  ('maquinas-de-lavar','lavar'),('maquinas-de-lavar','lavadora'),('maquinas-de-lavar','tanquinho'),('maquinas-de-lavar','secadora'),
  ('ar-e-ventiladores','ar condicionado'),('ar-e-ventiladores','ar-condicionado'),('ar-e-ventiladores','ventilador'),('ar-e-ventiladores','climatizador'),('ar-e-ventiladores','split'),
  ('portateis-de-cozinha','liquidificador'),('portateis-de-cozinha','air fryer'),('portateis-de-cozinha','airfryer'),('portateis-de-cozinha','micro'),('portateis-de-cozinha','batedeira'),('portateis-de-cozinha','cafeteira'),('portateis-de-cozinha','sanduicheira'),
  ('cuidados-pessoais','secador'),('cuidados-pessoais','chapinha'),('cuidados-pessoais','barbeador'),
  ('ferramentas','furadeira'),('ferramentas','parafusadeira'),('ferramentas','serra'),('ferramentas','martelo'),('ferramentas','ferramenta'),
  ('eletrica-e-hidraulica','fio'),('eletrica-e-hidraulica','tomada'),('eletrica-e-hidraulica','disjuntor'),('eletrica-e-hidraulica','cano'),('eletrica-e-hidraulica','registro'),
  ('loucas-metais-e-pias','pia'),('loucas-metais-e-pias','vaso'),('loucas-metais-e-pias','torneira'),('loucas-metais-e-pias','cuba'),('loucas-metais-e-pias','chuveiro'),
  ('portas-e-janelas','porta'),('portas-e-janelas','janela'),('portas-e-janelas','portao'),
  ('pisos-e-revestimentos','piso'),('pisos-e-revestimentos','porcelanato'),('pisos-e-revestimentos','ceramica'),('pisos-e-revestimentos','revestimento'),
  ('tintas-e-pintura','tinta'),('tintas-e-pintura','pincel'),
  ('alvenaria-e-estrutura','tijolo'),('alvenaria-e-estrutura','cimento'),('alvenaria-e-estrutura','areia'),('alvenaria-e-estrutura','telha'),('alvenaria-e-estrutura','bloco'),
  ('notebooks','notebook'),('notebooks','laptop'),('notebooks','macbook'),
  ('computadores','computador'),('computadores','pc'),('computadores','desktop'),('computadores','cpu'),('computadores','gabinete'),
  ('monitores','monitor'),('tablets-e-leitores','tablet'),('tablets-e-leitores','ipad'),('tablets-e-leitores','kindle'),
  ('impressoras-e-scanners','impressora'),('impressoras-e-scanners','scanner'),('impressoras-e-scanners','multifuncional'),
  ('teclados-e-mouses','teclado'),('teclados-e-mouses','mouse'),('webcams','webcam'),
  ('estabilizadores-e-nobreaks','estabilizador'),('estabilizadores-e-nobreaks','nobreak'),
  ('placas-de-video','placa de video'),('placas-de-video','rtx'),('placas-de-video','gtx'),('placas-de-video','radeon'),
  ('memoria-ram','memoria'),('memoria-ram','ddr'),('processadores','processador'),('processadores','ryzen'),
  ('hd-e-ssd','hd'),('hd-e-ssd','ssd'),('redes-e-internet','roteador'),('redes-e-internet','modem'),('redes-e-internet','antena'),
  ('consoles','playstation'),('consoles','ps4'),('consoles','ps5'),('consoles','xbox'),('consoles','nintendo'),('consoles','console'),
  ('jogos','jogo'),('acessorios-de-games','controle'),('acessorios-de-games','joystick'),('acessorios-de-games','headset'),
  ('bicicletas-e-ciclismo','bicicleta'),('bicicletas-e-ciclismo','bike'),
  ('academia-e-fitness','halter'),('academia-e-fitness','anilha'),('academia-e-fitness','esteira'),('academia-e-fitness','academia'),('academia-e-fitness','ergometrica'),
  ('futebol-e-quadra','bola'),('futebol-e-quadra','chuteira'),('futebol-e-quadra','futebol'),('futebol-e-quadra','volei'),
  ('pesca-e-camping','pesca'),('pesca-e-camping','molinete'),('pesca-e-camping','barraca'),('pesca-e-camping','camping'),
  ('roupas-e-calcados-esportivos','tenis'),('roupas-e-calcados-esportivos','legging'),
  ('roupas-infantis','roupa'),('roupas-infantis','body'),('roupas-infantis','macacao'),('roupas-infantis','conjunto'),
  ('calcados-infantis','sapato'),('calcados-infantis','sandalia'),
  ('brinquedos-e-jogos','brinquedo'),('brinquedos-e-jogos','boneca'),('brinquedos-e-jogos','lego'),('brinquedos-e-jogos','pelucia'),
  ('carrinhos-e-cadeirinhas','carrinho'),('carrinhos-e-cadeirinhas','cadeirinha'),('carrinhos-e-cadeirinhas','bebe conforto'),('carrinhos-e-cadeirinhas','andador'),
  ('moveis-infantis','berco'),('maternidade','mamadeira'),('maternidade','fralda'),('maternidade','banheira'),
  ('cachorros','cachorro'),('cachorros','cao'),('cachorros','cadela'),('cachorros','poodle'),('cachorros','shih'),('cachorros','pinscher'),
  ('gatos','gato'),('gatos','gata'),('gatos','gatinho'),
  ('outros-animais','passaro'),('outros-animais','calopsita'),('outros-animais','papagaio'),('outros-animais','peixe'),('outros-animais','coelho'),('outros-animais','hamster'),('outros-animais','periquito'),
  ('racao','racao'),('petiscos','petisco'),('petiscos','bifinho'),
  ('coleiras-e-guias','coleira'),('coleiras-e-guias','guia'),('coleiras-e-guias','peitoral'),
  ('camas-e-casinhas','casinha'),('camas-e-casinhas','caminha'),
  ('higiene-e-saude-pet','shampoo'),('higiene-e-saude-pet','antipulga'),('higiene-e-saude-pet','vermifugo'),
  ('aquarios-e-gaiolas','aquario'),('aquarios-e-gaiolas','gaiola'),('aquarios-e-gaiolas','viveiro'),
  ('tvs','tv'),('tvs','televisao'),('tvs','smart tv'),
  ('som-e-caixas','caixa de som'),('som-e-caixas','som'),('som-e-caixas','jbl'),('som-e-caixas','receiver'),('som-e-caixas','amplificador'),
  ('fones-de-ouvido','fone'),('fones-de-ouvido','headphone'),('fones-de-ouvido','airpods'),
  ('streaming-e-tv-box','tv box'),('streaming-e-tv-box','chromecast'),('streaming-e-tv-box','fire stick'),('streaming-e-tv-box','roku'),
  ('projetores','projetor'),
  ('pecas-de-motor','motor'),('pecas-de-motor','embreagem'),('pecas-de-motor','freio'),('pecas-de-motor','amortecedor'),('pecas-de-motor','radiador'),
  ('pneus-e-rodas','pneu'),('pneus-e-rodas','roda'),
  ('som-automotivo','multimidia'),('som-automotivo','radio'),('som-automotivo','alto falante'),('som-automotivo','subwoofer'),
  ('acessorios-automotivos','tapete'),('acessorios-automotivos','farol'),('acessorios-automotivos','retrovisor'),
  ('bovinos','boi'),('bovinos','vaca'),('bovinos','novilha'),('bovinos','bezerro'),('bovinos','garrote'),('bovinos','gado'),('bovinos','nelore'),('bovinos','touro'),
  ('equinos','cavalo'),('equinos','egua'),('equinos','potro'),('equinos','mula'),('equinos','jumento'),
  ('caprinos-e-ovinos','bode'),('caprinos-e-ovinos','cabra'),('caprinos-e-ovinos','cabrito'),('caprinos-e-ovinos','carneiro'),('caprinos-e-ovinos','ovelha'),('caprinos-e-ovinos','borrego'),
  ('suinos','porco'),('suinos','leitao'),('suinos','suino'),
  ('aves','galinha'),('aves','frango'),('aves','galo'),('aves','pato'),('aves','codorna'),
  ('sementes','semente'),('adubos-e-fertilizantes','adubo'),('adubos-e-fertilizantes','fertilizante'),('adubos-e-fertilizantes','ureia'),('adubos-e-fertilizantes','calcario'),
  ('defensivos','herbicida'),('defensivos','inseticida'),('defensivos','fungicida'),('defensivos','defensivo'),
  ('racoes-para-criacao','racao'),('sal-mineral','sal mineral');

-- Quando nenhuma palavra bate: a folha mais provável de cada categoria que ganhou filhas.
create temp table p1_reserva (pai text primary key, folha text not null);
insert into p1_reserva (pai, folha) values
  ('animais-de-estimacao','outros-animais'), ('moveis','mesas-e-cadeiras'), ('eletrodomesticos','portateis-de-cozinha'),
  ('construcao','ferramentas'), ('informatica','computadores'), ('games','consoles'), ('esporte','academia-e-fitness'),
  ('infantil','brinquedos-e-jogos'), ('tv-e-som','tvs'), ('pecas-e-acessorios','acessorios-automotivos'),
  ('gado-e-animais','bovinos'), ('sementes-e-insumos','sementes');

with alvo as (
  select a.id, a.titulo, a.categoria_id
    from public.anuncios a
   where a.status <> 'excluido' and a.categoria_id is not null
     and exists (select 1 from public.categorias f where f.pai_id = a.categoria_id and f.ativa)
), folhas as (
  select al.id as anuncio_id, f.id, f.slug, f.ordem, public.categoria_nivel(f.id) as nivel
    from alvo al
    join public.categorias f on f.id in (select public.categoria_e_descendentes(al.categoria_id))
   where f.ativa and not exists (select 1 from public.categorias g where g.pai_id = f.id and g.ativa)
), escolha as (
  select al.id, coalesce(
    (select fo.id from folhas fo join p1_palavras p on p.folha = fo.slug
      where fo.anuncio_id = al.id
        and public.sem_acento(lower(coalesce(al.titulo, ''))) ~ ('\m' || p.palavra || '(s|es|is)?\M')
      order by length(p.palavra) desc, fo.nivel, fo.ordem limit 1),
    (select fo.id from folhas fo join p1_reserva r on r.folha = fo.slug
       join public.categorias c on c.id = al.categoria_id and c.slug = r.pai
      where fo.anuncio_id = al.id limit 1),
    (select fo.id from folhas fo where fo.anuncio_id = al.id order by fo.nivel, fo.ordem limit 1)
  ) as folha
    from alvo al
)
update public.anuncios a
   set categoria_sugerida_id = e.folha, categoria_sugestao_estado = 'pendente', categoria_sugerida_em = now()
  from escolha e
 where a.id = e.id and e.folha is not null;

drop table p1_palavras;
drop table p1_reserva;

-- ---------------------------------------------------------------------
-- 5. Depois da troca: categoria que ganha filha, sugestão que deixou de ser folha.
-- ---------------------------------------------------------------------
-- Quando o admin põe uma filha ligada numa categoria, os anúncios que estão nela (ou com sugestão
-- apontando para ela) passam a ter essa filha como sugestão pendente. Sugestão pendente que já
-- aponta para outra folha fica como está.
create function public.categoria_ganhou_filha()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  if new.pai_id is null or not new.ativa then
    return null;
  end if;
  if tg_op = 'UPDATE' and new.pai_id is not distinct from old.pai_id and old.ativa then
    return null;
  end if;
  update public.anuncios a
     set categoria_sugerida_id = new.id, categoria_sugestao_estado = 'pendente', categoria_sugerida_em = now()
   where a.status <> 'excluido'
     and ((a.categoria_id = new.pai_id
           and (a.categoria_sugestao_estado is distinct from 'pendente' or a.categoria_sugerida_id = new.pai_id))
          or (a.categoria_sugestao_estado = 'pendente' and a.categoria_sugerida_id = new.pai_id));
  return null;
end $$;
revoke all on function public.categoria_ganhou_filha() from public, anon, authenticated;
create trigger categorias_ganhou_filha
  after insert or update of pai_id, ativa on public.categorias
  for each row execute function public.categoria_ganhou_filha();

-- Aceitar só leva o anúncio para categoria sem filhas (a de baixo de tudo).
create or replace function public.decidir_categoria_sugerida(p_anuncio uuid, p_aceitar boolean)
returns void language plpgsql security definer
set search_path = public
as $$
declare
  a public.anuncios;
begin
  select x.* into a from public.anuncios x
    join public.vitrines_lojas v on v.id = x.vitrine_id
   where x.id = p_anuncio and v.dono_id = public.usuario_id()
   for update of x;
  if not found then
    raise exception using errcode = '42501', message = 'Anúncio não encontrado.';
  end if;
  -- Esta função roda como dono do banco e pularia a trava do Compliance: confere aqui.
  if a.status = 'congelado' then
    raise exception using errcode = '42501', message = 'Anúncio congelado pelo Compliance. Fale com o suporte.';
  end if;
  if a.categoria_sugestao_estado is distinct from 'pendente' or a.categoria_sugerida_id is null then
    raise exception using errcode = '22023', message = 'Essa sugestão já foi decidida.';
  end if;
  if coalesce(p_aceitar, false) then
    if not public.categoria_disponivel(a.categoria_sugerida_id) then
      raise exception using errcode = '22023', message = 'Essa categoria não está mais disponível.';
    end if;
    if exists (select 1 from public.categorias f where f.pai_id = a.categoria_sugerida_id and f.ativa) then
      raise exception using errcode = '22023', message = 'Essa categoria ganhou subcategorias. Escolha uma delas ao editar o anúncio.';
    end if;
    update public.anuncios set categoria_id = a.categoria_sugerida_id, categoria_sugestao_estado = 'aceita'
     where id = a.id;
  else
    update public.anuncios set categoria_sugestao_estado = 'recusada' where id = a.id;
  end if;
end $$;

-- "Aceitar todas" pula o anúncio que não dá para trocar, sem desfazer os outros.
create or replace function public.decidir_todas_categorias(p_vitrine uuid, p_aceitar boolean)
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
    exception when sqlstate '22023' or sqlstate '42501' or sqlstate '23514' then
      null; -- congelado, categoria fora do ar ou campo obrigatório faltando: fica para decidir um por um
    end;
  end loop;
  return n;
end $$;

-- Leituras que olham o caminho inteiro (uma categoria de cima desligada esconde as de baixo):
-- link antigo de categoria desligada vai para a lista de categorias (e não para "página não encontrada"),
-- e o dono continua editando o anúncio que está numa categoria desligada.
create function public.categoria_escondida(p_slug text)
returns boolean language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from public.categorias c
                  where c.slug = p_slug and not coalesce(public.categoria_disponivel(c.id), false))
$$;

create function public.categorias_do_caminho(p_id uuid)
returns table (id uuid, slug text, nome text, icone text, pai_id uuid, ordem integer, ativa boolean, campos jsonb,
               preco_min_centavos bigint, preco_max_centavos bigint, tipo_legado public.categoria_anuncio)
language sql stable security definer
set search_path = public
as $$
  select c.id, c.slug, c.nome, c.icone, c.pai_id, c.ordem, c.ativa, c.campos,
         c.preco_min_centavos, c.preco_max_centavos, c.tipo_legado
    from public.categorias c
   where c.id in (select public.categoria_caminho(p_id))
   order by public.categoria_nivel(c.id)
$$;

revoke all on function public.categoria_escondida(text), public.categorias_do_caminho(uuid) from public;
grant execute on function public.categoria_escondida(text), public.categorias_do_caminho(uuid)
  to anon, authenticated, service_role;
