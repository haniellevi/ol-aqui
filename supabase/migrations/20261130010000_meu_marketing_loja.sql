-- Meu Marketing usa somente sinais agregados existentes, sem créditos ou chamadas de IA.
-- SECURITY DEFINER permite agregar buscas privadas e métricas para ajudantes autorizados.
-- A autorização da loja é conferida antes de qualquer consulta ou retorno.
create or replace function public.meu_marketing_loja(p_vitrine uuid)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  loja public.vitrines_lojas;
  hoje date := public.dia_metrica(now());
  inicio date := public.dia_metrica(now()) - 29;
  criativos jsonb;
  oportunidades jsonb;
  total_buscas bigint := 0;
  nicho_definido boolean;
begin
  if public.usuario_id() is null or not public.pode_mexer_vitrine(p_vitrine) then
    raise exception using errcode = '42501', message = 'Você não tem acesso a esta loja.';
  end if;
  select v.* into loja from public.vitrines_lojas v
    where v.id = p_vitrine and v.tipo = 'loja' and v.status = 'ativa' and v.excluida_em is null
      and not exists (select 1 from public.contas_bloqueadas b where b.usuario_id = v.dono_id)
      and not exists (select 1 from public.contas_revogadas r where r.usuario_id = v.dono_id)
      and not exists (select 1 from public.lixeira_contas l where l.usuario_id = v.dono_id);
  if loja.id is null then
    raise exception using errcode = '42501', message = 'Esta loja está indisponível.';
  end if;
  nicho_definido := loja.nicho_id is not null and public.categoria_disponivel(loja.nicho_id);

  with numeros as (
    select n.anuncio_id, sum(n.visualizacoes) as visualizacoes,
           sum(n.cliques_whatsapp) as cliques, sum(n.favoritos) as favoritos
      from public.anuncios_numeros_dia n
      join public.anuncios a on a.id = n.anuncio_id and a.vitrine_id = loja.id
     where n.dia between inicio and hoje
     group by n.anuncio_id
  ), candidatos as (
    select a.id, a.titulo, a.fotos[1] as foto, a.preco_centavos, a.preco_antes_centavos,
           coalesce(n.visualizacoes, 0) as visualizacoes, coalesce(n.cliques, 0) as cliques,
           coalesce(n.favoritos, 0) as favoritos,
           (a.preco_centavos is not null)::int + (nullif(btrim(a.descricao), '') is not null)::int as qualidade,
           a.publicado_em,
           array_remove(array[
             case when n.cliques > 0 then format('%s cliques no WhatsApp nos últimos 30 dias', n.cliques) end,
             case when n.favoritos > 0 then format('%s favoritos nos últimos 30 dias', n.favoritos) end,
             case when n.visualizacoes > 0 then format('%s visualizações nos últimos 30 dias', n.visualizacoes) end,
             case when a.preco_centavos is not null then 'Preço informado' end,
             case when nullif(btrim(a.descricao), '') is not null then 'Descrição preenchida' end,
             'Foto disponível para divulgação'
           ], null) as motivos
      from public.anuncios a
      join public.perfis p on p.id = loja.dono_id
      left join numeros n on n.anuncio_id = a.id
     where a.vitrine_id = loja.id and a.status = 'ativo'
       and nullif(btrim(a.fotos[1]), '') is not null
       and public.categoria_disponivel(a.categoria_id)
       and public.contato_publico_vitrine(loja, p) is not null
  ), melhores as (
    -- A ordem é explicável: contato, interesse salvo, visitas e qualidade do cadastro.
    select * from candidatos
     order by cliques desc, favoritos desc, visualizacoes desc, qualidade desc, publicado_em desc nulls last, id
     limit 3
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', id, 'titulo', titulo, 'foto', foto, 'preco_centavos', preco_centavos,
           'preco_antes_centavos', preco_antes_centavos, 'visualizacoes', visualizacoes,
           'cliques', cliques, 'favoritos', favoritos, 'motivos', motivos)
           order by cliques desc, favoritos desc, visualizacoes desc, qualidade desc, publicado_em desc nulls last, id), '[]'::jsonb)
    into criativos from melhores;

  if nicho_definido then
    with catalogo as materialized (
      -- Todos os nichos da região participam da desambiguação de buscas antigas.
      select a.categoria_id,
             lower(public.sem_acento(btrim(regexp_replace(a.titulo, '\s+', ' ', 'g')))) as titulo
        from public.anuncios a
        join public.vitrines_lojas v on v.id = a.vitrine_id
        join public.perfis pf on pf.id = v.dono_id
       where a.status = 'ativo' and a.microrregiao_id = loja.microrregiao_id
         and v.status = 'ativa' and v.excluida_em is null
         and public.contato_publico_vitrine(v, pf) is not null
         and public.categoria_disponivel(a.categoria_id)
         and not exists (select 1 from public.contas_bloqueadas b where b.usuario_id = v.dono_id)
         and not exists (select 1 from public.contas_revogadas r where r.usuario_id = v.dono_id)
         and not exists (select 1 from public.lixeira_contas l where l.usuario_id = v.dono_id)
    ), buscas as materialized (
      select lower(public.sem_acento(btrim(regexp_replace(b.termo_normalizado, '\s+', ' ', 'g')))) as termo,
             b.categoria_id, sum(b.vezes)::bigint as buscas, sum(b.vezes_sem_resultado)::bigint as sem_resultado
        from public.buscas_termos b
       where b.microrregiao_id = loja.microrregiao_id and b.dia between inicio and hoje
       group by 1, b.categoria_id
    ), termos_antigos as (
      select distinct termo from buscas where categoria_id is null
    ), associacoes as (
      select t.termo, c.categoria_id
        from termos_antigos t join catalogo c on strpos(c.titulo, t.termo) > 0
      union
      select t.termo, c.id
        from termos_antigos t join public.categorias c
          on t.termo = lower(public.sem_acento(c.nome)) or t.termo = replace(c.slug, '-', ' ')
       where public.categoria_disponivel(c.id)
    ), antigas_resolvidas as (
      -- Uma única categoria possível evita atribuir uma busca ambígua a outro nicho.
      select termo, (array_agg(categoria_id order by categoria_id))[1] as categoria_id
        from associacoes group by termo having count(distinct categoria_id) = 1
    ), demanda as (
      select b.termo, coalesce(b.categoria_id, r.categoria_id) as categoria_id,
             b.buscas, 0::bigint as pedidos, b.sem_resultado
        from buscas b left join antigas_resolvidas r on r.termo = b.termo and b.categoria_id is null
      union all
      select lower(public.sem_acento(btrim(regexp_replace(
               regexp_replace(p.titulo, '^(procuro|busco|preciso de|quero comprar)\s+', '', 'i'), '\s+', ' ', 'g')))),
             p.categoria_id, 0::bigint, count(*)::bigint, 0::bigint
        from public.radar_pedidos p
       where p.microrregiao_id = loja.microrregiao_id and p.status = 'aberto' and p.expira_em > now()
         and public.radar_pedido_na_area(p, loja)
         and (p.visibilidade = 'todos' or public.pode_atender_radar(loja.dono_id))
         and (p.modo_contato = 'whatsapp_direto' or p.propostas_ate > now())
         and p.criado_em >= inicio::timestamp at time zone 'America/Sao_Paulo' and p.criado_em <= now()
         -- O título é o único texto utilizado. Campos de comprador e detalhes nunca são lidos.
         and p.titulo !~* '(@|https?://|www\.|[0-9][0-9 ()+.-]{6,}[0-9])'
       group by 1, p.categoria_id
    ), agregados as materialized (
      select d.termo, c.id as categoria_id, c.slug as categoria_slug, c.nome as categoria_nome,
             sum(d.buscas)::bigint as buscas, sum(d.pedidos)::bigint as pedidos,
             sum(d.sem_resultado)::bigint as sem_resultado
        from demanda d join public.categorias c on c.id = d.categoria_id
       where public.categoria_raiz(c.id) = loja.nicho_id and public.categoria_disponivel(c.id)
         and char_length(d.termo) between 2 and 80
         and d.termo !~* '(@|https?://|www\.|[0-9][0-9 ()+.-]{6,}[0-9])'
       group by d.termo, c.id, c.slug, c.nome
    ), faltantes as (
      select d.* from agregados d
       where not exists (
         select 1 from public.anuncios a
          where a.vitrine_id = loja.id and a.status = 'ativo'
            -- strpos trata % e _ como texto literal.
            and strpos(lower(public.sem_acento(btrim(regexp_replace(a.titulo, '\s+', ' ', 'g')))), d.termo) > 0
       )
       order by d.buscas + d.pedidos desc, d.sem_resultado desc, d.termo, d.categoria_id
       limit 8
    )
    select coalesce((select sum(buscas) from agregados), 0),
           coalesce((select jsonb_agg(to_jsonb(f) order by f.buscas + f.pedidos desc, f.sem_resultado desc, f.termo, f.categoria_id)
                       from faltantes f), '[]'::jsonb)
      into total_buscas, oportunidades;
  else
    oportunidades := '[]'::jsonb;
  end if;

  return jsonb_build_object('dias', 30, 'nicho_definido', nicho_definido,
    'regiao_nome', (select m.nome from public.microrregioes m where m.id = loja.microrregiao_id),
    'total_buscas', total_buscas, 'criativos', criativos, 'oportunidades', oportunidades);
end;
$$;

revoke all on function public.meu_marketing_loja(uuid) from public, anon;
grant execute on function public.meu_marketing_loja(uuid) to authenticated;
