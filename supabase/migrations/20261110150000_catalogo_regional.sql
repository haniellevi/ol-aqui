alter table public.vitrines_lojas
  add column site_url text check (char_length(site_url) <= 300 and site_url ~ '^https?://[A-Za-z0-9-]+([.][A-Za-z0-9-]+)+(:[0-9]{1,5})?([/?#][^[:space:][:cntrl:]]*)?$'),
  add column telefone_publico text check (telefone_publico ~ '^55[1-9][0-9]9?[0-9]{8}$');

-- Os dados de contato ainda em conferência só aparecem para titular e equipe.
drop function public.meus_contatos_vitrine();
create function public.meus_contatos_vitrine()
returns table (whatsapp text, instagram text, site_url text, telefone_publico text)
language sql stable security definer set search_path = public
as $$
  select v.whatsapp, v.instagram, v.site_url, v.telefone_publico
  from public.vitrines_lojas v where v.dono_id = public.usuario_id()
$$;
grant update (site_url, telefone_publico) on public.vitrines_lojas to authenticated;
revoke all on function public.meus_contatos_vitrine() from public, anon;
grant execute on function public.meus_contatos_vitrine() to authenticated;

create function public.catalogo_lojas(p_regiao uuid, p_cidade text, p_nicho text, p_limite integer, p_offset integer, p_destaques boolean default false)
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
         and public.categoria_disponivel(c.id) and p_nicho in (c.slug, pai.slug)
     ))
   order by coalesce(public.nome_comparavel(v.cidade) = public.nome_comparavel(p_cidade), false) desc,
            case when p_destaques then md5(v.id::text || to_char(now() at time zone 'America/Fortaleza', 'YYYYMMDDHH24')) end,
            v.selo_loja_verificada desc, v.nome, v.id
   limit least(greatest(coalesce(p_limite, 24), 1), 48)
   offset least(greatest(coalesce(p_offset, 0), 0), 100000)
$$;

-- O painel registra a conferência humana sem armazenar documentos ou endereço particular.
alter table public.perfis add column verificacao_pf_em timestamptz,
  add column verificacao_pf_por text references public.perfis(id) on delete set null;

create function public.proteger_verificacao_pf()
returns trigger language plpgsql set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.verificacao_pf_em := null;
    new.verificacao_pf_por := null;
    return new;
  end if;
  if current_user not in ('postgres', 'supabase_admin', 'service_role') then
    new.verificacao_pf_em := old.verificacao_pf_em;
    new.verificacao_pf_por := old.verificacao_pf_por;
    new.selo_negociador_certificado := old.selo_negociador_certificado;
  end if;
  if row(new.nome, new.whatsapp, new.cidade, new.bairro, new.microrregiao_id)
       is distinct from row(old.nome, old.whatsapp, old.cidade, old.bairro, old.microrregiao_id)
       or (old.whatsapp_verificado_em is not null and new.whatsapp_verificado_em is null) then
    new.verificacao_pf_em := null;
    new.verificacao_pf_por := null;
    new.selo_negociador_certificado := false;
  end if;
  return new;
end $$;
create trigger zz_proteger_verificacao_pf before insert or update on public.perfis
  for each row execute function public.proteger_verificacao_pf();
revoke all on function public.proteger_verificacao_pf() from public, anon, authenticated;

create function public.admin_verificar_vendedor_pf(
  p_vitrine uuid, p_nome text, p_aprovar boolean, p_dados boolean, p_documento boolean, p_endereco boolean)
returns void
language plpgsql security definer set search_path = public
as $$
declare perfil public.perfis;
begin
  if not public.tem_papel('suporte') then
    raise exception 'Só a equipe OLAKI pode verificar vendedores.' using errcode = '42501';
  end if;
  if p_aprovar is null then
    raise exception 'Escolha uma decisão.' using errcode = '22023';
  end if;
  select pf.* into perfil from public.vitrines_lojas v
  join public.perfis pf on pf.id = v.dono_id
  where v.id = p_vitrine and v.tipo = 'pf' for update of pf;
  if not found or perfil.nome is distinct from p_nome
      or exists (select 1 from public.contas_revogadas r where r.usuario_id = perfil.id) then
    raise exception 'O vendedor ou os dados mudaram. Atualize a página.' using errcode = 'P0001';
  end if;
  if p_aprovar and (p_dados is not true or p_documento is not true or p_endereco is not true
      or perfil.whatsapp is null or perfil.whatsapp_verificado_em is null) then
    raise exception 'A aprovação exige dados oficiais, documento, endereço e WhatsApp confirmado.' using errcode = '23514';
  end if;
  -- O gatilho log_perfis já registra a alteração e o responsável no histórico administrativo.
  update public.perfis set selo_negociador_certificado = p_aprovar,
      verificacao_pf_em = case when p_aprovar then now() end,
      verificacao_pf_por = case when p_aprovar then public.usuario_id() end
    where id = perfil.id;
end $$;
revoke all on function public.admin_verificar_vendedor_pf(uuid,text,boolean,boolean,boolean,boolean) from public, anon;
grant execute on function public.admin_verificar_vendedor_pf(uuid,text,boolean,boolean,boolean,boolean) to authenticated;

-- A mesma campanha de produto na página inicial pode aparecer no catálogo de lojas.
create function public.catalogo_anuncios(p_regiao uuid, p_cidade text, p_nicho text,
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
       and (p_nicho is null or (public.categoria_disponivel(c.id) and p_nicho in (c.slug, pai.slug)))
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
revoke all on function public.catalogo_lojas(uuid,text,text,integer,integer,boolean),
  public.catalogo_anuncios(uuid,text,text,text,integer,integer) from public;
grant execute on function public.catalogo_lojas(uuid,text,text,integer,integer,boolean),
  public.catalogo_anuncios(uuid,text,text,text,integer,integer) to anon, authenticated;

create or replace function public.proteger_verificacao_loja()
returns trigger language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.verificacao_estado := 'pendente';
    new.verificacao_revisao := 1;
    new.verificacao_motivo := null;
    new.selo_loja_verificada := false;
    return new;
  end if;

  if current_user not in ('postgres', 'supabase_admin', 'service_role') then
    new.verificacao_estado := old.verificacao_estado;
    new.verificacao_revisao := old.verificacao_revisao;
    new.verificacao_motivo := old.verificacao_motivo;
    new.selo_loja_verificada := old.selo_loja_verificada;
  end if;

  if row(new.dono_id, new.tipo, new.nome, new.slug, new.cnpj, new.cidade, new.bairro,
         new.microrregiao_id, new.endereco, new.lat, new.lng, new.whatsapp, new.instagram, new.site_url, new.telefone_publico)
      is distinct from
     row(old.dono_id, old.tipo, old.nome, old.slug, old.cnpj, old.cidade, old.bairro,
         old.microrregiao_id, old.endereco, old.lat, old.lng, old.whatsapp, old.instagram, old.site_url, old.telefone_publico) then
    new.verificacao_estado := 'pendente';
    new.verificacao_revisao := old.verificacao_revisao + 1;
    new.verificacao_motivo := null;
    new.selo_loja_verificada := false;
  elsif new.selo_loja_verificada and new.verificacao_estado <> 'aprovada' then
    raise exception 'Use a revisão da loja para conceder o selo.' using errcode = '23514';
  elsif old.selo_loja_verificada and not new.selo_loja_verificada and new.verificacao_estado = 'aprovada' then
    -- A ação legada de retirar o selo também cancela a aprovação.
    new.verificacao_estado := 'pendente';
    new.verificacao_revisao := old.verificacao_revisao + 1;
    new.verificacao_motivo := null;
  end if;
  return new;
end $$;

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
  foto := v.banner_tipo = 'foto' and v.banner_url is not null and coalesce(rec.foto_fachada, false);

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
    'banner_tipo', case when foto then 'foto' else 'modelo' end,
    'banner_url', case when foto then v.banner_url end,
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

drop function public.admin_verificacoes_lojas(uuid[]);
create function public.admin_verificacoes_lojas(p_ids uuid[])
returns table (id uuid, estado text, revisao integer, motivo text, cnpj text, instagram text,
               whatsapp_comercial text, whatsapp_conta text, responsavel text,
               nome text, slug text, cidade text, bairro text, endereco text, site_url text, telefone_publico text)
language plpgsql stable security definer
set search_path = public
as $$
declare
  equipe boolean := public.tem_papel('suporte');
  regiao uuid := public.minha_regiao_equipe();
begin
  if not equipe and regiao is null then
    raise exception 'Só a equipe OLAKI vê as verificações.' using errcode = '42501';
  end if;
  if cardinality(p_ids) > 200 then
    raise exception 'Selecione até 200 lojas.' using errcode = '22023';
  end if;

  return query
  select v.id, v.verificacao_estado,
         case when equipe then v.verificacao_revisao end,
         case when equipe then v.verificacao_motivo end,
         case when equipe then v.cnpj end,
         case when equipe then v.instagram end,
         case when equipe then v.whatsapp end,
         case when equipe and p.whatsapp_verificado_em is not null then p.whatsapp end,
         case when equipe then p.nome end,
         case when equipe then v.nome end,
         case when equipe then v.slug end,
         case when equipe then v.cidade end,
         case when equipe then v.bairro end,
         case when equipe then v.endereco end,
         case when equipe then v.site_url end,
         case when equipe then v.telefone_publico end
    from public.vitrines_lojas v
    join public.perfis p on p.id = v.dono_id
   where v.id = any(p_ids) and v.tipo = 'loja' and (equipe or v.microrregiao_id = regiao);
end $$;
revoke all on function public.admin_verificacoes_lojas(uuid[]) from public, anon;
grant execute on function public.admin_verificacoes_lojas(uuid[]) to authenticated;

update public.destaque_tipos
   set descricao = 'Aparece no carrossel da página inicial. Produtos de lojas também ganham destaque no catálogo de lojas.'
 where slug = 'home' and descricao = 'Aparece no carrossel "Destaques perto de você" da página inicial.';
