-- Isolamento regional no banco, escolha consistente e limite de anúncios concorrentes.

create or replace function public.radar_feed()
returns table (
  id uuid, microrregiao_id uuid, categoria public.categoria_anuncio, titulo text,
  detalhes text, preco_max_centavos bigint, cidade text, urgencia text,
  atributos jsonb, total_propostas integer, max_propostas integer,
  modo_contato text, propostas_ate timestamptz, expira_em timestamptz, criado_em timestamptz,
  comprador_certificado boolean, comprador_primeiro_nome text, ja_propus boolean,
  categoria_id uuid, categoria_nome text, preco_min_centavos bigint, sou_comprador boolean)
language sql stable security definer
set search_path = public, extensions
as $$
  select p.id, p.microrregiao_id, p.categoria, p.titulo,
         case when acesso.ok then p.detalhes end,
         p.preco_max_centavos, p.cidade, p.urgencia::text,
         case when acesso.ok then p.atributos else '{}'::jsonb end,
         p.total_propostas, p.max_propostas,
         p.modo_contato::text, p.propostas_ate, p.expira_em, p.criado_em,
         pf.selo_negociador_certificado,
         case when acesso.ok then split_part(pf.nome, ' ', 1) end,
         exists (select 1 from public.radar_propostas rp
                   join public.vitrines_lojas v on v.id = rp.vitrine_id
                  where rp.pedido_id = p.id and v.dono_id = public.usuario_id()),
         p.categoria_id, (select c.nome from public.categorias c where c.id = p.categoria_id),
         p.preco_min_centavos, p.comprador_id = public.usuario_id()
  from public.radar_pedidos p
  join public.perfis pf on pf.id = p.comprador_id
  cross join lateral (select public.tem_plano_pago(public.usuario_id()) or p.comprador_id = public.usuario_id() as ok) acesso
  where public.usuario_id() is not null
    and (p.comprador_id = public.usuario_id() or p.microrregiao_id =
         (select me.microrregiao_id from public.perfis me where me.id = public.usuario_id()))
    and p.status = 'aberto' and p.expira_em > now()
    and (p.modo_contato = 'whatsapp_direto' or p.propostas_ate > now())
$$;

create or replace function public.radar_pedido(p_id uuid)
returns table (
  id uuid, titulo text, detalhes text, categoria public.categoria_anuncio, categoria_id uuid, categoria_nome text,
  preco_min_centavos bigint, preco_max_centavos bigint, cidade text, urgencia text, modo_contato text,
  propostas_ate timestamptz, expira_em timestamptz, criado_em timestamptz, status text, situacao text,
  total_propostas integer, max_propostas integer, comprador_primeiro_nome text, comprador_certificado boolean,
  sou_comprador boolean, ja_propus boolean, mesma_regiao boolean, tem_acesso boolean, moderado_motivo text,
  fechado_motivo text)
language sql stable security definer
set search_path = public, extensions
as $$
  with eu as (select public.usuario_id() as uid, public.e_admin() as admin)
  select p.id, p.titulo,
         case when a.acesso then p.detalhes end,
         p.categoria, p.categoria_id, c.nome,
         p.preco_min_centavos, p.preco_max_centavos, p.cidade, p.urgencia, p.modo_contato,
         p.propostas_ate, p.expira_em, p.criado_em, p.status::text,
         case when p.status = 'em_analise' then 'em_analise'
              when p.status <> 'aberto' or p.expira_em <= now() then 'fechado'
              when p.modo_contato = 'propostas_prazo' and p.propostas_ate <= now() then 'prazo_acabou'
              else 'aberto' end,
         p.total_propostas, p.max_propostas,
         case when a.acesso then split_part(btrim(pf.nome), ' ', 1) end,
         pf.selo_negociador_certificado,
         x.dono, x.propus,
         coalesce((select v.microrregiao_id = p.microrregiao_id from public.vitrines_lojas v where v.dono_id = eu.uid), false),
         a.acesso,
         case when x.dono or eu.admin then p.moderado_motivo end,
         case when x.dono or eu.admin then p.fechado_motivo end
    from public.radar_pedidos p
    join public.perfis pf on pf.id = p.comprador_id
    left join public.categorias c on c.id = p.categoria_id
    cross join eu
    cross join lateral (
      select p.comprador_id = eu.uid as dono,
             exists (select 1 from public.radar_propostas rp join public.vitrines_lojas v on v.id = rp.vitrine_id
                      where rp.pedido_id = p.id and v.dono_id = eu.uid) as propus) x
    cross join lateral (select x.dono or eu.admin or public.tem_plano_pago(eu.uid) as acesso) a
   where p.id = p_id
     and eu.uid is not null
     and (x.dono or eu.admin or x.propus or (p.status = 'aberto' and p.expira_em > now()
          and p.microrregiao_id = (select me.microrregiao_id from public.perfis me where me.id = eu.uid)))
$$;

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
  -- loja: WhatsApp da loja; pessoa física: o celular confirmado do perfil
  -- (ou só cadastrado, quando o painel não exige o código)
  fone := coalesce(case when v.tipo = 'loja' then v.whatsapp end,
                   (select pf.whatsapp from public.perfis pf
                     where pf.id = v.dono_id and pf.whatsapp is not null
                       and (pf.whatsapp_verificado_em is not null
                            or public.config('radar.exigir_celular_confirmado', p.microrregiao_id, 'true'::jsonb) = 'false'::jsonb)));
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

create or replace function public.validar_limite_anuncios()
returns trigger language plpgsql security definer
set search_path = public
as $$
declare
  v      public.vitrines_lojas;
  lim    integer;
  ativos integer;
begin
  if new.status <> 'ativo' then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'ativo' then return new; end if;
  if new.pago_ate > now() then return new; end if;            -- avulso pago não conta

  select * into v from public.vitrines_lojas where id = new.vitrine_id for update;
  lim := public.limite_anuncios(v);
  if lim is null then return new; end if;

  select count(*) into ativos from public.anuncios
   where vitrine_id = new.vitrine_id and status = 'ativo' and id <> new.id
     and (pago_ate is null or pago_ate <= now());

  if ativos >= lim then
    raise exception using errcode = 'P0001',
      message = case when lim = 0
        then 'Seu período grátis ou plano terminou. Escolha um plano ou pague um anúncio avulso para continuar.'
        else format('Você chegou ao limite de %s anúncios. Assine um plano maior ou pague um anúncio avulso.', lim) end;
  end if;
  return new;
end $$;

-- Repetir um envio após falha de rede devolve o pedido já criado, sem consumir outro limite.
alter table public.radar_pedidos add column chave_envio uuid;
create unique index radar_pedido_envio_unico on public.radar_pedidos (comprador_id, chave_envio) where chave_envio is not null;

create function public.criar_pedido_radar_site(
  p_chave uuid, p_titulo text, p_cidade text,
  p_modo text default 'whatsapp_direto', p_prazo_horas integer default null,
  p_detalhes text default null, p_categoria_id uuid default null,
  p_preco_min_centavos bigint default null, p_preco_max_centavos bigint default null)
returns jsonb language plpgsql security definer
set search_path = public, extensions
as $$
declare
  uid text := public.usuario_id();
  resultado jsonb;
begin
  if uid is null then raise exception 'Entre na sua conta para continuar.' using errcode = '28000'; end if;
  if p_chave is null then raise exception 'Identificação do envio ausente.' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtext('radar_pedido:' || uid));
  select jsonb_build_object('id', p.id, 'status', p.status) into resultado
    from public.radar_pedidos p where p.comprador_id = uid and p.chave_envio = p_chave;
  if resultado is not null then return resultado; end if;
  resultado := public.criar_pedido_radar(p_titulo, p_cidade, p_modo, p_prazo_horas,
    p_detalhes, p_categoria_id, p_preco_min_centavos, p_preco_max_centavos);
  update public.radar_pedidos set chave_envio = p_chave where id = (resultado->>'id')::uuid;
  return resultado;
end $$;
revoke all on function public.criar_pedido_radar_site(uuid,text,text,text,integer,text,uuid,bigint,bigint) from public, anon;
grant execute on function public.criar_pedido_radar_site(uuid,text,text,text,integer,text,uuid,bigint,bigint) to authenticated;
