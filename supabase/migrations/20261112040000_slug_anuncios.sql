-- Etapa P3: link curto e fixo do anúncio: /anuncio/<titulo-normalizado>-<4 caracteres>.
-- O slug nasce na primeira vez que o anúncio sai de rascunho e não muda mais, mesmo se o título mudar.
-- Os links antigos (/anuncio/<uuid>-<titulo>) continuam funcionando pela rota (redirecionamento 308).

-- ---------------------------------------------------------------------
-- 1. Coluna e formato
-- ---------------------------------------------------------------------
alter table public.anuncios add column slug text unique;
alter table public.anuncios add constraint anuncios_slug_formato
  check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 70);

-- ---------------------------------------------------------------------
-- 2. Geração: base do título (slug_texto, até 60 letras, sem hífen no fim) + '-' + 4 letras/números.
--    Repete o sorteio até não existir outro anúncio com o mesmo endereço.
-- ---------------------------------------------------------------------
create function public.novo_slug_anuncio(p_titulo text)
returns text language plpgsql security definer set search_path = public, extensions
as $$
declare
  base text := rtrim(public.slug_texto(p_titulo), '-');
  candidato text;
  tentativas integer := 0;
begin
  if char_length(base) < 2 then base := 'anuncio'; end if;
  loop
    candidato := base || '-' || (
      select string_agg(substr('abcdefghijklmnopqrstuvwxyz0123456789', 1 + floor(random() * 36)::int, 1), '')
        from generate_series(1, 4));
    exit when not exists (select 1 from public.anuncios x where x.slug = candidato);
    tentativas := tentativas + 1;
    if tentativas >= 50 then
      raise exception 'Não foi possível criar o endereço do anúncio. Tente de novo.' using errcode = '23505';
    end if;
  end loop;
  return candidato;
end $$;
revoke all on function public.novo_slug_anuncio(text) from public, anon;
grant execute on function public.novo_slug_anuncio(text) to authenticated, service_role;

-- Antes de sair de rascunho o anúncio não tem endereço. Depois disso o slug é fixo:
-- só o sistema (olaki.sistema = 1) consegue trocá-lo.
create function public.anuncios_slug_fixo()
returns trigger language plpgsql set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.slug is distinct from old.slug
     and coalesce(current_setting('olaki.sistema', true), '') <> '1' then
    new.slug := old.slug;
  end if;
  if new.slug is null and new.status <> 'rascunho' then
    new.slug := public.novo_slug_anuncio(new.titulo);
  end if;
  return new;
end $$;
revoke all on function public.anuncios_slug_fixo() from public, anon, authenticated;
create trigger anuncios_0_slug before insert or update on public.anuncios
  for each row execute function public.anuncios_slug_fixo();

-- ---------------------------------------------------------------------
-- 3. Backfill: anúncios que já saíram de rascunho ganham o slug (uma vez; pode rodar de novo com segurança)
-- ---------------------------------------------------------------------
create function public.preencher_slugs_anuncios()
returns integer language plpgsql set search_path = public
as $$
declare
  antes text := coalesce(current_setting('olaki.sistema', true), '');
  r record;
  total integer := 0;
begin
  perform set_config('olaki.sistema', '1', true);
  for r in select a.id, a.titulo from public.anuncios a
            where a.status <> 'rascunho' and a.slug is null order by a.criado_em, a.id loop
    update public.anuncios set slug = public.novo_slug_anuncio(r.titulo) where id = r.id;
    total := total + 1;
  end loop;
  perform set_config('olaki.sistema', antes, true);
  return total;
end $$;
revoke all on function public.preencher_slugs_anuncios() from public, anon, authenticated;
select public.preencher_slugs_anuncios();

-- ---------------------------------------------------------------------
-- 4. Tipos de retorno das RPCs ganham o slug no fim (as funções abaixo são recriadas com ele)
-- ---------------------------------------------------------------------
alter type public.anuncio_card add attribute slug text;
alter type public.anuncio_detalhe add attribute slug text;
alter type public.vitrine_anuncio add attribute slug text;

-- Estas duas mudam a tabela de retorno: não dá para trocar com create or replace.
drop function public.resultados_destaques(uuid, boolean, integer);
drop function public.propostas_do_pedido(uuid);

-- ---------------------------------------------------------------------
-- Busca de anúncios (cartão com slug)
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
           a.fotos[1] as capa, a.atributos, coalesce(a.publicado_em, a.criado_em) as criado_em, a.slug as anuncio_slug,
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
               x.selo_loja_verificada, x.tipo, x.destaque, contagem.total, x.anuncio_slug)::public.anuncio_card
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

-- ---------------------------------------------------------------------
-- Catálogo com slug
-- ---------------------------------------------------------------------
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
             i.vendedor_slug, i.selo_loja_verificada, i.vendedor_tipo, i.patrocinado, i.total, i.slug)::public.anuncio_card)
         || jsonb_build_object('vendedor_pago', i.plano_pago, 'vendedor_pf_verificado', i.pf_verificada)
    from ordenados i
$$;

-- ---------------------------------------------------------------------
-- Destaques da página inicial com slug
-- ---------------------------------------------------------------------
create or replace function public.destaques_home(p_microrregiao uuid, p_limite integer default 12)
returns setof public.anuncio_card
language sql stable security definer
set search_path = public, extensions
as $$
  with ativos as (
    select distinct d.anuncio_id
      from public.destaques d
     where d.tipo = 'home' and d.status = 'ativo' and d.microrregiao_id = p_microrregiao
       and d.inicio <= now() and d.fim > now()
  )
  select a.id, a.titulo, a.preco_centavos, a.aceita_troca, a.cidade, a.bairro,
         a.fotos[1], a.atributos, coalesce(a.publicado_em, a.criado_em),
         c.slug, c.nome, case when v.tipo = 'pf' then split_part(btrim(v.nome), ' ', 1) else v.nome end,
         v.slug, v.selo_loja_verificada, v.tipo,
         true, count(*) over (), a.slug
    from ativos x
    join public.anuncios a on a.id = x.anuncio_id and a.status = 'ativo'
    join public.vitrines_lojas v on v.id = a.vitrine_id and v.status = 'ativa'
    left join public.categorias c on c.id = a.categoria_id
   order by md5(a.id::text || to_char(now() at time zone 'America/Fortaleza', 'YYYYMMDDHH24')), a.id
   limit least(greatest(coalesce(p_limite, 12), 1), 48)
$$;

-- ---------------------------------------------------------------------
-- Página do anúncio com slug
-- ---------------------------------------------------------------------
create or replace function public.anuncio_publico(anuncio_id uuid)
returns setof public.anuncio_detalhe
language sql stable security definer
set search_path = public
as $$
  select a.id, a.titulo, a.descricao, a.preco_centavos, a.aceita_troca, a.cidade, a.bairro,
         a.fotos, a.atributos, a.status::text, coalesce(a.publicado_em, a.criado_em), a.vendido_em,
         coalesce(a.destaque_ate > now(), false), a.visualizacoes, a.total_favoritos, a.microrregiao_id,
         c.id, c.slug, c.nome, c.icone, cp.slug, cp.nome, coalesce(c.campos, '[]'::jsonb),
         v.id, v.slug, case when v.tipo = 'pf' then split_part(btrim(v.nome), ' ', 1) else v.nome end,
         v.tipo, v.logo_url, v.selo_loja_verificada, v.criado_em,
         pf.selo_negociador_certificado,
         case when a.status = 'ativo' then public.contato_publico_vitrine(v, pf) end,
         (v.dono_id = public.usuario_id()), a.slug
    from public.anuncios a
    join public.vitrines_lojas v on v.id = a.vitrine_id
    join public.perfis pf on pf.id = v.dono_id
    left join public.categorias c on c.id = a.categoria_id
    left join public.categorias cp on cp.id = c.pai_id
   where a.id = anuncio_publico.anuncio_id
     and ((a.status in ('ativo', 'vendido') and v.status = 'ativa')
          or v.dono_id = public.usuario_id()
          or public.e_admin())
$$;

-- ---------------------------------------------------------------------
-- Produtos da loja com slug
-- ---------------------------------------------------------------------
create or replace function public.anuncios_vitrine(p_vitrine_id uuid, p_ordem text default 'recentes', p_pagina integer default 1)
returns setof public.vitrine_anuncio
language sql stable security definer
set search_path = public, extensions
as $$
  with v as (
    select x.id, x.microrregiao_id, r.fixados_max, r.secoes_max,
           greatest(coalesce(public.numero_ou_nulo(public.config('vitrine.anuncios_por_pagina', x.microrregiao_id, '120'))::int, 120), 1) as por_pagina
      from public.vitrines_lojas x
      cross join lateral public.recursos_vitrine(x) r
     where x.id = p_vitrine_id and x.tipo = 'loja'
       and (x.status = 'ativa' or x.dono_id = public.usuario_id() or public.e_admin())
  ),
  secoes_visiveis as (                                  -- mesma regra de vitrine_publica
    select s.id from public.loja_secoes s join v on v.id = s.vitrine_id
     where s.ativa
     order by s.ordem, s.criado_em
     limit (select v.secoes_max from v)                 -- limit null = sem limite
  ),
  da_secao as (
    select distinct sa.anuncio_id from public.loja_secao_anuncios sa join secoes_visiveis sv on sv.id = sa.secao_id
  ),
  base as (
    select a.*, v.fixados_max, v.por_pagina,
           case when a.fixado_na_loja is not null
                then row_number() over (partition by a.fixado_na_loja is not null
                                        order by a.fixado_na_loja, coalesce(a.publicado_em, a.criado_em) desc, a.id) end as pos_fixado
      from public.anuncios a join v on v.id = a.vitrine_id
     where a.status = 'ativo'
  ),
  efetivo as (
    select b.*, case when b.pos_fixado <= coalesce(b.fixados_max, 2147483647) then b.pos_fixado end as fixado_ok
      from base b
  ),
  ordenado as (
    select e.*, row_number() over (
             order by case when p_ordem = 'menor_preco' then e.preco_centavos end asc nulls last,
                      case when coalesce(p_ordem, 'recentes') <> 'menor_preco' then e.fixado_ok end asc nulls last,
                      coalesce(e.publicado_em, e.criado_em) desc,
                      e.id) as pos
      from efetivo e
  ),
  pagina as (
    select o.*, o.pos >  (greatest(coalesce(p_pagina, 1), 1) - 1)::bigint * o.por_pagina
            and o.pos <= greatest(coalesce(p_pagina, 1), 1)::bigint * o.por_pagina as dentro
      from ordenado o
  )
  select e.id, e.titulo, e.preco_centavos, e.aceita_troca, e.cidade, e.bairro, e.fotos[1],
         coalesce(e.publicado_em, e.criado_em), coalesce(e.destaque_ate > now(), false), e.fixado_ok::int,
         c.id, c.slug, c.nome, cp.nome,
         (coalesce(cp.ordem, c.ordem, 999) * 1000 + case when cp.id is null then 0 else coalesce(c.ordem, 999) end)::int,
         e.dentro, e.slug
    from pagina e
    left join public.categorias c on c.id = e.categoria_id
    left join public.categorias cp on cp.id = c.pai_id
   where e.dentro or e.id in (select d.anuncio_id from da_secao d)
   order by e.pos
$$;

-- ---------------------------------------------------------------------
-- Destaques do admin com slug (recriada)
-- ---------------------------------------------------------------------
create function public.resultados_destaques(p_anuncio_id uuid default null, p_todos boolean default false, p_limite integer default 50)
returns table (id uuid, tipo text, tipo_nome text, anuncio_id uuid, anuncio_titulo text, vitrine_id uuid, vitrine_nome text,
               microrregiao_id uuid, origem text, status text, preco_centavos integer, inicio timestamptz, fim timestamptz,
               reservado_ate timestamptz, pagamento_id uuid, pagamento_status text, motivo text, criado_em timestamptz,
               visualizacoes bigint, cliques_whatsapp bigint, anuncio_slug text)
language sql stable security definer
set search_path = public, extensions
as $$
  select d.id, d.tipo, t.nome, d.anuncio_id, a.titulo, d.vitrine_id, v.nome, d.microrregiao_id, d.origem, d.status,
         d.preco_centavos, d.inicio, d.fim, d.reservado_ate, d.pagamento_id, p.status, d.motivo, d.criado_em,
         coalesce(ev.vis, 0), coalesce(ev.cli, 0), a.slug
    from public.destaques d
    join public.destaque_tipos t on t.slug = d.tipo
    join public.vitrines_lojas v on v.id = d.vitrine_id
    left join public.anuncios a on a.id = d.anuncio_id
    left join public.pagamentos p on p.id = d.pagamento_id
    left join lateral (
      select count(*) filter (where e.tipo = 'visualizacao')    as vis,
             count(*) filter (where e.tipo = 'clique_whatsapp') as cli
        from public.eventos_anuncio e
       where d.inicio is not null
         and e.criado_em >= d.inicio and e.criado_em < least(d.fim, now())
         and (e.anuncio_id = d.anuncio_id
              or (d.anuncio_id is null and e.anuncio_id in (select x.id from public.anuncios x where x.vitrine_id = d.vitrine_id)))
    ) ev on true
   where public.usuario_id() is not null
     and case when coalesce(p_todos, false) then public.e_admin() else v.dono_id = public.usuario_id() end
     and (p_anuncio_id is null or d.anuncio_id = p_anuncio_id)
   order by (d.status = 'ativo') desc, d.criado_em desc
   limit least(greatest(coalesce(p_limite, 50), 1), 200)
$$;

-- ---------------------------------------------------------------------
-- Propostas do Radar com slug (recriada)
-- ---------------------------------------------------------------------
create function public.propostas_do_pedido(p_pedido uuid)
returns table (
  id uuid, vitrine_id uuid, loja_nome text, loja_slug text, loja_tipo text, loja_selo boolean, loja_logo text,
  preco_centavos bigint, mensagem text, foto_url text, anuncio_id uuid, anuncio_titulo text,
  anuncio_preco_centavos bigint, anuncio_capa text, escolhida boolean, status text, criado_em timestamptz, atualizado_em timestamptz,
  anuncio_slug text)
language sql stable security definer
set search_path = public, extensions
as $$
  select rp.id, v.id,
         case when v.tipo = 'pf' then split_part(btrim(v.nome), ' ', 1) else v.nome end,
         case when v.tipo = 'loja' then v.slug end, v.tipo, v.selo_loja_verificada,
         case when v.tipo = 'loja' then v.logo_url end,
         rp.preco_centavos, rp.mensagem,
         coalesce(rp.foto_url, case when a.status in ('ativo', 'vendido') then a.fotos[1] end),
         case when a.status in ('ativo', 'vendido') then a.id end,
         case when a.status in ('ativo', 'vendido') then a.titulo end,
         case when a.status in ('ativo', 'vendido') then a.preco_centavos end,
         case when a.status in ('ativo', 'vendido') then a.fotos[1] end,
         rp.escolhida, rp.status, rp.criado_em, rp.atualizado_em,
         case when a.status in ('ativo', 'vendido') then a.slug end
    from public.radar_propostas rp
    join public.radar_pedidos p on p.id = rp.pedido_id
    join public.vitrines_lojas v on v.id = rp.vitrine_id
    left join public.anuncios a on a.id = rp.anuncio_id
   where rp.pedido_id = p_pedido
     and public.usuario_id() is not null
     and ((p.comprador_id = public.usuario_id() and rp.status = 'ativa') or public.e_admin())
   order by rp.preco_centavos asc nulls last, rp.criado_em
$$;


-- ---------------------------------------------------------------------
-- 5. Permissões das funções recriadas (mesmas da versão anterior)
-- ---------------------------------------------------------------------
revoke all on function public.resultados_destaques(uuid, boolean, integer) from public, anon;
grant execute on function public.resultados_destaques(uuid, boolean, integer) to authenticated;
revoke all on function public.propostas_do_pedido(uuid) from public, anon;
grant execute on function public.propostas_do_pedido(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 6. Resolver do link curto: slug → id, com a mesma regra de visibilidade de anuncio_publico.
--    Também devolve anúncios pausados/expirados ou de loja fora do ar (anuncio_fora_do_ar),
--    para a página mostrar "anúncio fora do ar" em vez de 404. Não expõe rascunho, em análise nem excluído.
-- ---------------------------------------------------------------------
create function public.anuncio_id_por_slug(p_slug text)
returns uuid language sql stable security definer set search_path = public
as $$
  select a.id
    from public.anuncios a
    join public.vitrines_lojas v on v.id = a.vitrine_id
   where a.slug = btrim(coalesce(p_slug, ''))
     and ((a.status in ('ativo', 'vendido') and v.status = 'ativa')
          or v.dono_id = public.usuario_id()
          or public.e_admin()
          or a.status in ('pausado', 'expirado')
          or (a.status in ('ativo', 'vendido') and v.status <> 'ativa'))
   limit 1
$$;
revoke all on function public.anuncio_id_por_slug(text) from public;
grant execute on function public.anuncio_id_por_slug(text) to anon, authenticated;
