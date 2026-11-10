-- Revisão de dados, links e contato comercial. A conferência dos links é humana.
alter table public.vitrines_lojas
  add column verificacao_estado text not null default 'pendente'
    check (verificacao_estado in ('pendente', 'aprovada', 'correcao', 'recusada')),
  add column verificacao_revisao integer not null default 1 check (verificacao_revisao > 0),
  add column verificacao_motivo text
    check (verificacao_motivo in ('dados_inconsistentes', 'link_invalido', 'contato_nao_confirmado', 'titularidade', 'outro'));

-- Selos anteriores não têm a confirmação dos três itens. Entram na fila de revisão.
update public.vitrines_lojas set selo_loja_verificada = false where selo_loja_verificada;

alter table public.vitrines_acoes_admin drop constraint vitrines_acoes_admin_acao_check;
alter table public.vitrines_acoes_admin add constraint vitrines_acoes_admin_acao_check
  check (acao in ('cortesia', 'trocar_plano', 'suspender', 'reativar', 'dar_selo', 'tirar_selo',
                  'verificacao_aprovada', 'verificacao_correcao', 'verificacao_recusada'));

create function public.proteger_verificacao_loja()
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
         new.microrregiao_id, new.endereco, new.whatsapp, new.instagram)
      is distinct from
     row(old.dono_id, old.tipo, old.nome, old.slug, old.cnpj, old.cidade, old.bairro,
         old.microrregiao_id, old.endereco, old.whatsapp, old.instagram) then
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
create trigger z_proteger_verificacao_loja before insert or update on public.vitrines_lojas
  for each row execute function public.proteger_verificacao_loja();

create function public.reabrir_verificacao_por_perfil()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  update public.vitrines_lojas
     set verificacao_estado = 'pendente', verificacao_motivo = null,
         verificacao_revisao = verificacao_revisao + 1, selo_loja_verificada = false
   where dono_id = new.id and tipo = 'loja';
  return null;
end $$;
create trigger z_reabrir_verificacao_por_perfil after update on public.perfis
  for each row
  when (old.nome is distinct from new.nome or old.whatsapp is distinct from new.whatsapp
        or (old.whatsapp_verificado_em is null) <> (new.whatsapp_verificado_em is null))
  execute function public.reabrir_verificacao_por_perfil();

create function public.admin_verificacoes_lojas(p_ids uuid[])
returns table (id uuid, estado text, revisao integer, motivo text, cnpj text, instagram text,
               whatsapp_comercial text, whatsapp_conta text, responsavel text,
               nome text, slug text, cidade text, bairro text, endereco text)
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
         case when equipe then v.endereco end
    from public.vitrines_lojas v
    join public.perfis p on p.id = v.dono_id
   where v.id = any(p_ids) and v.tipo = 'loja' and (equipe or v.microrregiao_id = regiao);
end $$;

create function public.admin_revisar_loja(p_loja uuid, p_revisao integer, p_decisao text, p_motivo text,
                                         p_dados boolean, p_link boolean, p_whatsapp boolean)
returns void language plpgsql security definer
set search_path = public
as $$
declare
  loja public.vitrines_lojas;
  estado text;
  acao text;
begin
  if not public.tem_papel('suporte') then
    raise exception 'Só a equipe OLAKI pode revisar lojas.' using errcode = '42501';
  end if;
  if p_decisao = 'aprovar' then
    estado := 'aprovada';
    acao := 'verificacao_aprovada';
    if p_dados is not true or p_link is not true or p_whatsapp is not true then
      raise exception 'Confirme os dados, os links e o WhatsApp antes de aprovar.' using errcode = '23514';
    end if;
  elsif p_decisao in ('correcao', 'recusar') then
    estado := case when p_decisao = 'correcao' then 'correcao' else 'recusada' end;
    acao := case when p_decisao = 'correcao' then 'verificacao_correcao' else 'verificacao_recusada' end;
    if p_motivo is null or p_motivo not in ('dados_inconsistentes', 'link_invalido', 'contato_nao_confirmado', 'titularidade', 'outro') then
      raise exception 'Escolha o motivo da decisão.' using errcode = '23514';
    end if;
  else
    raise exception 'Escolha uma decisão válida.' using errcode = '22023';
  end if;

  select * into loja from public.vitrines_lojas v where v.id = p_loja and v.tipo = 'loja' for update;
  if not found then
    raise exception 'Loja não encontrada.' using errcode = '22023';
  end if;
  if p_revisao is distinct from loja.verificacao_revisao then
    raise exception 'Os dados ou a decisão mudaram. Atualize a página e confira novamente.' using errcode = 'P0001';
  end if;
  if estado = 'aprovada' and not public.whatsapp_confirmado(loja.dono_id) then
    raise exception 'A conta da loja precisa confirmar o WhatsApp antes da aprovação.' using errcode = '23514';
  end if;

  update public.vitrines_lojas
     set verificacao_estado = estado, verificacao_revisao = loja.verificacao_revisao + 1,
         verificacao_motivo = case when estado <> 'aprovada' then p_motivo end,
         selo_loja_verificada = estado = 'aprovada'
   where id = loja.id;

  insert into public.vitrines_acoes_admin (vitrine_id, admin_id, acao, motivo, detalhes)
  values (loja.id, public.usuario_id(), acao,
          case when estado = 'aprovada' then 'Dados, links e contato conferidos' else p_motivo end,
          jsonb_build_object('revisao', loja.verificacao_revisao, 'anterior', loja.verificacao_estado, 'decisao', estado));
end $$;

create function public.minha_verificacao_loja()
returns table (estado text, motivo text)
language sql stable security definer
set search_path = public
as $$
  select verificacao_estado, verificacao_motivo from public.vitrines_lojas
   where dono_id = public.usuario_id() and tipo = 'loja'
$$;

create function public.meus_contatos_vitrine()
returns table (whatsapp text, instagram text)
language sql stable security definer
set search_path = public
as $$
  select v.whatsapp, v.instagram from public.vitrines_lojas v where v.dono_id = public.usuario_id()
$$;

-- Leituras públicas usam o contato confirmado; o telefone em análise fica no admin e com o titular.
revoke select (whatsapp, instagram) on public.vitrines_lojas from public, anon, authenticated;
create function public.contato_publico_vitrine(v public.vitrines_lojas, p public.perfis)
returns text
language sql immutable
set search_path = public
as $$
  select case
           when v.tipo = 'loja' and v.verificacao_estado = 'aprovada' and v.whatsapp is not null then v.whatsapp
           when p.whatsapp_verificado_em is not null then p.whatsapp
         end
$$;

revoke all on function public.proteger_verificacao_loja(), public.reabrir_verificacao_por_perfil(),
  public.contato_publico_vitrine(public.vitrines_lojas, public.perfis),
  public.admin_verificacoes_lojas(uuid[]), public.admin_revisar_loja(uuid, integer, text, text, boolean, boolean, boolean),
  public.minha_verificacao_loja(), public.meus_contatos_vitrine() from public, anon, authenticated;
grant execute on function public.admin_verificacoes_lojas(uuid[]),
  public.admin_revisar_loja(uuid, integer, text, text, boolean, boolean, boolean),
  public.minha_verificacao_loja(), public.meus_contatos_vitrine() to authenticated;

-- Mantém as regras de leitura existentes e aplica a mesma regra de contato nas três superfícies.
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
         (v.dono_id = public.usuario_id())
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
    'sobre', v.sobre, 'formas_pagamento', to_jsonb(v.formas_pagamento),
    'faz_entrega', v.faz_entrega, 'entrega_obs', v.entrega_obs,
    'status', v.status, 'criado_em', v.criado_em, 'microrregiao_id', v.microrregiao_id,
    'e_dono', coalesce(dono, false), 'secoes', secoes, 'total_anuncios', total);
end $$;

create or replace function public.escolher_proposta(p_proposta_id uuid)
returns table (whatsapp text, mensagem text)
language plpgsql security definer
set search_path = public, extensions
as $$
#variable_conflict use_column
declare
  uid  text := public.usuario_id();
  rp   public.radar_propostas;
  v    public.vitrines_lojas;
  p    public.radar_pedidos;
  fone text;
begin
  if uid is null then
    raise exception 'Entre na sua conta para continuar.' using errcode = '28000';
  end if;
  select * into rp from public.radar_propostas x where x.id = p_proposta_id;
  select * into p  from public.radar_pedidos x where x.id = rp.pedido_id for update;
  -- A edição da oferta e o encerramento também travam o pedido. Releia após a trava.
  select * into rp from public.radar_propostas x where x.id = p_proposta_id for update;
  if p.comprador_id is distinct from uid then
    raise exception 'Esta proposta não é do seu pedido.' using errcode = '42501';
  end if;
  if rp.status <> 'ativa' or p.status in ('em_analise', 'congelado') or p.fechado_motivo in ('cancelado', 'moderacao') then
    raise exception 'Esta proposta não está mais disponível.' using errcode = 'P0002';
  end if;
  select * into v from public.vitrines_lojas x where x.id = rp.vitrine_id;
  if v.status <> 'ativa' then
    raise exception 'Esta loja não está atendendo pelo OLAKI agora.' using errcode = 'P0002';
  end if;
  select public.contato_publico_vitrine(v, pf) into fone
    from public.perfis pf where pf.id = v.dono_id;
  if fone is null then
    raise exception 'Esta loja ainda não tem WhatsApp confirmado. Tente outra proposta.' using errcode = 'P0001';
  end if;
  if not rp.escolhida then
    update public.radar_propostas x set escolhida = true, escolhida_em = now() where x.id = rp.id;
    perform public.radar_aviso(v.dono_id, 'proposta_escolhida', p.microrregiao_id,
      jsonb_build_object('pedido', p.titulo, 'loja', v.nome), '/radar/' || p.id::text, 'proposta_escolhida:' || rp.id::text);
  end if;
  return query select fone, format('Olá, %s! Vi sua proposta no Radar do OLAKI para "%s".', v.nome, p.titulo);
end $$;

create or replace function public.admin_lojas(
  p_busca text default null, p_situacao text default null, p_regiao uuid default null, p_tipo text default null,
  p_limite integer default 50, p_deslocamento integer default 0)
returns table (id uuid, slug text, nome text, tipo text, dono_id text, dono_nome text, whatsapp text, cidade text,
               microrregiao_id uuid, plano text, plano_nome text, plano_efetivo_nome text, teste_expira_em timestamptz,
               plano_expira_em timestamptz, plano_proximo text, plano_proximo_nome text, plano_proximo_ate timestamptz,
               status text, situacao text, selo_loja_verificada boolean, anuncios_ativos integer, limite_anuncios integer,
               propostas_mes integer, propostas_limite integer, criado_em timestamptz, total bigint)
language plpgsql stable security definer
set search_path = public, extensions
as $$
declare
  termo    text := nullif(btrim(coalesce(p_busca, '')), '');
  digito   text := nullif(regexp_replace(coalesce(p_busca, ''), '[^0-9]', '', 'g'), '');
  v_regiao uuid := p_regiao;
  pode_ver_contato boolean := public.tem_papel('suporte');
begin
  if not pode_ver_contato then
    v_regiao := public.minha_regiao_equipe();
    if v_regiao is null then
      raise exception 'Só a equipe OLAKI vê esta lista.' using errcode = '42501';
    end if;
  end if;
  return query
  with base as (
    select v.*, public.situacao_vitrine(v) as sit, public.plano_efetivo(v) as ef, pf.nome as pnome, pf.whatsapp as pfone
      from public.vitrines_lojas v
      join public.perfis pf on pf.id = v.dono_id
     where (v_regiao is null or v.microrregiao_id = v_regiao)
       and (p_tipo is null or v.tipo = p_tipo)
       and (termo is null
            or public.sem_acento(lower(v.nome)) like '%' || public.sem_acento(lower(termo)) || '%'
            or v.slug like '%' || lower(termo) || '%'
            or public.sem_acento(lower(pf.nome)) like '%' || public.sem_acento(lower(termo)) || '%'
            or (pode_ver_contato and digito is not null and char_length(digito) >= 4
                and (coalesce(v.whatsapp, '') like '%' || digito || '%' or coalesce(pf.whatsapp, '') like '%' || digito || '%'
                     or coalesce(v.cnpj, '') like '%' || digito || '%')))
  ),
  filtrada as (
    select b.* from base b where p_situacao is null or b.sit = p_situacao
  )
  select f.id, f.slug, f.nome, f.tipo, f.dono_id, f.pnome, case when pode_ver_contato then coalesce(f.whatsapp, f.pfone) end, f.cidade, f.microrregiao_id,
         f.plano, pl.nome, (f.ef).nome, f.teste_expira_em, f.plano_expira_em, f.plano_proximo, px.nome, f.plano_proximo_ate,
         f.status::text, f.sit, f.selo_loja_verificada,
         (select count(*)::int from public.anuncios a where a.vitrine_id = f.id and a.status = 'ativo'),
         (f.ef).limite_anuncios,
         (select count(*)::int from public.radar_propostas rp
           where rp.vitrine_id = f.id
             and rp.criado_em >= (date_trunc('month', now() at time zone 'America/Fortaleza') at time zone 'America/Fortaleza')),
         (f.ef).propostas_radar_mes,
         f.criado_em, count(*) over ()
    from filtrada f
    left join public.planos pl on pl.codigo = f.plano
    left join public.planos px on px.codigo = f.plano_proximo
   order by f.criado_em desc, f.id
   limit least(greatest(coalesce(p_limite, 50), 1), 200)
  offset greatest(coalesce(p_deslocamento, 0), 0);
end $$;
