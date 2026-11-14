-- Capa privada aprovada: preserva banner existente e regras do plano.
create or replace function public.vitrine_publica(p_slug text)
returns jsonb language plpgsql stable security definer
set search_path = public, extensions
as $$
declare
  v       public.vitrines_lojas;
  pf      public.perfis;
  rec     record;
  dono    boolean;
  foto    boolean;
  capa_ia boolean;
  secoes  jsonb;
  total   integer;
begin
  select * into v from public.vitrines_lojas x where x.slug = lower(btrim(coalesce(p_slug, ''))) and x.tipo = 'loja';
  if v.id is null then return null; end if;
  dono := v.dono_id = public.usuario_id();
  if v.status <> 'ativa' and not coalesce(dono, false) and not public.e_admin() then
    return null;
  end if;
  select * into rec from public.recursos_vitrine(v);
  select * into pf from public.perfis p where p.id = v.dono_id;
  foto := v.banner_tipo = 'foto' and v.banner_url is not null and (v.banner_aki_posicao is not null or coalesce(rec.foto_fachada, false));
  -- Mantém um banner existente; a capa do rascunho só vale com vínculo público vigente.
  select v.banner_url is null and exists (
    select 1 from public.loja_ia_imagens i
    join public.loja_ia_rascunhos r on r.id=i.rascunho_id
    join public.loja_ia_imagens_vinculos vinculo on vinculo.imagem_id=i.id and vinculo.vitrine_id=v.id and vinculo.uso='capa'
    where r.vitrine_id=v.id and r.dono_id=v.dono_id and r.estado='publicado' and v.status='ativa'
      and i.estado='pronta' and v.capa_url='/api/loja/imagem/' || i.id::text
      and (coalesce(rec.foto_fachada, false) or (i.origem='merc' and i.tipo='capa'))
  ) into capa_ia;

  select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'nome', s.nome, 'anuncios', s.ids) order by s.ordem, s.criado_em), '[]'::jsonb)
    into secoes
    from (select s.id, s.nome, s.ordem, s.criado_em,
                 (select coalesce(jsonb_agg(sa.anuncio_id order by sa.ordem, sa.criado_em), '[]'::jsonb)
                    from public.loja_secao_anuncios sa
                    join public.anuncios a on a.id = sa.anuncio_id and a.status = 'ativo' and a.vitrine_id = v.id
                   where sa.secao_id = s.id) as ids
            from public.loja_secoes s
           where s.vitrine_id = v.id and s.ativa
           order by s.ordem, s.criado_em
           limit rec.secoes_max) s;                                   -- limit null = sem limite

  select count(*)::int into total from public.anuncios a where a.vitrine_id = v.id and a.status = 'ativo';

  return jsonb_build_object(
    'id', v.id, 'slug', v.slug, 'nome', v.nome, 'logo_url', v.logo_url,
    'banner_tipo', case when foto or capa_ia then 'foto' else 'modelo' end,
    'banner_url', case when foto then v.banner_url when capa_ia then v.capa_url end,
    'banner_aki_posicao', case when foto then v.banner_aki_posicao end,
    'categoria_loja', v.categoria_loja,
    'banner_modelo', v.banner_modelo, 'banner_cor', v.banner_cor,
    'selo', v.selo_loja_verificada, 'cidade', v.cidade, 'bairro', v.bairro,
    'whatsapp', case when v.status = 'ativa'
                     then public.contato_publico_vitrine(v, pf) end,
    'endereco', v.endereco, 'lat', v.lat, 'lng', v.lng, 'horarios', v.horarios, 'instagram', case when v.verificacao_estado = 'aprovada' or dono then v.instagram end,
    'site_url', case when v.status = 'ativa' and v.verificacao_estado = 'aprovada' then v.site_url end,
    'telefone_publico', case when v.status = 'ativa' and v.verificacao_estado = 'aprovada' then v.telefone_publico end,
    'sobre', v.sobre, 'formas_pagamento', to_jsonb(v.formas_pagamento),
    'faz_entrega', v.faz_entrega, 'entrega_obs', v.entrega_obs,
    'status', v.status, 'criado_em', v.criado_em, 'microrregiao_id', v.microrregiao_id,
    'e_dono', coalesce(dono, false), 'secoes', secoes, 'total_anuncios', total);
end $$;
