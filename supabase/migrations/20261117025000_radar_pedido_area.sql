-- Radar v2, fase 1: o pedido tem área (região toda ou até 20 cidades), visibilidade
-- ("lojas" = só lojas que atendem na área; "todos" = qualquer pessoa da região) e até 5 lojas.

alter table public.radar_pedidos
  add column visibilidade text not null default 'lojas' check (visibilidade in ('lojas', 'todos')),
  add column cidades_ids uuid[] check (cidades_ids is null or cardinality(cidades_ids) <= 20);

-- Padrão de lojas por pedido: 10 → 5 (só se a equipe ainda não mudou o valor)
update public.configuracoes set valor = '5'::jsonb
 where chave = 'radar.max_propostas_padrao' and valor = '10'::jsonb;

-- ---------------------------------------------------------------------
-- 1. Validação do pedido (INSERT direto pela API também passa por aqui)
-- ---------------------------------------------------------------------
create or replace function public.radar_validar_pedido()
returns trigger language plpgsql security definer
set search_path = public, extensions
as $$
declare
  uid      text := public.usuario_id();
  sistema  boolean := coalesce(auth.role(), '') = 'service_role' or public.e_admin() or public.usuario_id() is null;
  cat      public.categorias;
  regiao   uuid;
  ids      uuid[];
  nomes    text;
  lim      integer;
  total    integer;
  max_h    integer;
  hoje     timestamptz := date_trunc('day', now() at time zone 'America/Fortaleza') at time zone 'America/Fortaleza';
begin
  -- categoria da tabela → enum antigo (feed e Aki ainda usam o enum)
  if new.categoria_id is not null and (tg_op = 'INSERT' or new.categoria_id is distinct from old.categoria_id) then
    select * into cat from public.categorias c where c.id = new.categoria_id;
    if cat.id is null or (not cat.ativa and not sistema) then
      raise exception using errcode = '23514', message = 'Escolha uma categoria da lista.', detail = 'campo:categoria';
    end if;
    new.categoria := cat.tipo_legado;
  end if;
  if sistema and new.cidades_ids is null then return new; end if;

  if not sistema and tg_op = 'INSERT' then
    -- o pedido é sempre da região do perfil do comprador
    select p.microrregiao_id into regiao from public.perfis p where p.id = new.comprador_id;
    if regiao is not null then new.microrregiao_id := regiao; end if;
    new.fechado_em := null;
    new.fechado_motivo := null;
    new.moderado_motivo := null;
  end if;

  -- área: cidades ativas da mesma região; repetidas saem; o texto da área vem dos nomes
  if new.cidades_ids is not null and (tg_op = 'INSERT' or new.cidades_ids is distinct from old.cidades_ids) then
    if cardinality(new.cidades_ids) > 20 then
      raise exception using errcode = '23514', message = 'Escolha até 20 cidades.', detail = 'campo:cidades';
    end if;
    select array_agg(u.id order by u.ord) into ids
      from (select distinct on (x.id) x.id, x.ord from unnest(new.cidades_ids) with ordinality x(id, ord)
             order by x.id, x.ord) u;
    select string_agg(c.nome, ', ' order by u.ord) into nomes
      from unnest(ids) with ordinality u(id, ord)
      join public.cidades c on c.id = u.id and c.ativa and c.microrregiao_id = new.microrregiao_id;
    if ids is null or nomes is null
       or (select count(*) from public.cidades c
            where c.id = any(ids) and c.ativa and c.microrregiao_id = new.microrregiao_id) <> cardinality(ids) then
      raise exception using errcode = '23514', message = 'Escolha cidades da sua região.', detail = 'campo:cidades';
    end if;
    new.cidades_ids := ids;
    new.cidade := case when char_length(nomes) > 120 then left(nomes, 119) || '…' else nomes end;
  end if;
  if sistema then return new; end if;

  if new.preco_min_centavos is not null and new.preco_max_centavos is not null and new.preco_min_centavos > new.preco_max_centavos then
    raise exception using errcode = '23514', message = 'O preço "de" precisa ser menor que o preço "até".', detail = 'campo:preco';
  end if;

  -- sem cidades marcadas = região toda
  if new.cidades_ids is null and tg_op = 'INSERT' then
    new.cidade := 'Toda a região';
  end if;

  -- prazo das propostas nunca passa da maior opção do painel
  if new.modo_contato = 'propostas_prazo' and new.propostas_ate is not null
     and (tg_op = 'INSERT' or new.propostas_ate is distinct from old.propostas_ate) then
    select max(x::int) into max_h
      from jsonb_array_elements_text(public.config('radar.prazos_horas', new.microrregiao_id, '[24, 72, 168]')) x
     where x ~ '^[0-9]{1,5}$';
    if max_h is not null and new.propostas_ate > now() + make_interval(hours => max_h) then
      new.propostas_ate := now() + make_interval(hours => max_h);
    end if;
  end if;

  if tg_op = 'INSERT' then
    -- um pedido novo por vez para cada comprador: pedidos mandados juntos não passam do limite
    perform pg_advisory_xact_lock(hashtext('radar_pedido:' || new.comprador_id));
    lim := public.numero_ou_nulo(public.config('radar.pedidos_por_dia', new.microrregiao_id, 'null'))::int;
    if lim is not null then
      select count(*) into total from public.radar_pedidos p where p.comprador_id = new.comprador_id and p.criado_em >= hoje;
      if total >= lim then
        raise exception using errcode = 'P0001',
          message = format('Você já fez %s pedidos hoje. Amanhã você pode pedir de novo.', total);
      end if;
    end if;
    lim := public.numero_ou_nulo(public.config('radar.pedidos_abertos_max', new.microrregiao_id, 'null'))::int;
    if lim is not null then
      select count(*) into total from public.radar_pedidos p
       where p.comprador_id = new.comprador_id and p.status in ('aberto', 'em_analise') and p.expira_em > now()
         and not (p.modo_contato = 'propostas_prazo' and p.propostas_ate <= now());   -- prazo acabou: não segura vaga
      if total >= lim then
        raise exception using errcode = 'P0001',
          message = format('Você já tem %s pedidos abertos. Toque em "Já resolvi" ou cancele um para pedir outro.', total);
      end if;
    end if;
  end if;
  return new;
end $$;

drop trigger radar_1_validar on public.radar_pedidos;
create trigger radar_1_validar
  before insert or update of cidade, cidades_ids, categoria_id, preco_min_centavos, preco_max_centavos, propostas_ate
  on public.radar_pedidos for each row execute function public.radar_validar_pedido();

-- Comprador não muda visibilidade, área nem o texto da área depois de criado
create or replace function public.proteger_radar_v4()
returns trigger language plpgsql
set search_path = public, extensions
as $$
begin
  if public.acesso_sistema() then
    return new;
  end if;
  new.comprador_id    := old.comprador_id;
  new.expira_em       := old.expira_em;
  new.propostas_ate   := old.propostas_ate;
  new.prazo_horas     := old.prazo_horas;
  new.max_propostas   := old.max_propostas;
  new.modo_contato    := old.modo_contato;     -- trocar para WhatsApp revelaria o número sem o comprador querer
  new.origem          := old.origem;
  new.criado_em       := old.criado_em;
  new.fechado_em      := old.fechado_em;
  new.fechado_motivo  := old.fechado_motivo;
  new.moderado_motivo := old.moderado_motivo;
  new.resumo_enviado_em := old.resumo_enviado_em;
  new.visibilidade    := old.visibilidade;
  new.cidades_ids     := old.cidades_ids;
  new.cidade          := old.cidade;
  if new.status is distinct from old.status then
    if old.status <> 'aberto' or new.status not in ('atendido', 'encerrado') then
      raise exception 'Este pedido não pode mudar assim. Use os botões da tela do pedido.' using errcode = '42501';
    end if;
    new.fechado_em := now();
    new.fechado_motivo := case when new.status = 'atendido' then 'resolvido' else 'cancelado' end;
  elsif old.status <> 'aberto'
        and (new.titulo is distinct from old.titulo or new.detalhes is distinct from old.detalhes
             or new.categoria_id is distinct from old.categoria_id
             or new.preco_min_centavos is distinct from old.preco_min_centavos
             or new.preco_max_centavos is distinct from old.preco_max_centavos) then
    raise exception 'Pedido fechado não pode ser alterado.' using errcode = '42501';
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 2. Quem vê o pedido
-- ---------------------------------------------------------------------
-- A cidade da loja casa com as cidades do pedido ignorando acento, maiúscula e espaço.
-- Sem cidades marcadas, vale a região toda. Loja de cidade que não casa com nenhuma fica fora.
create function public.radar_pedido_na_area(p_pedido public.radar_pedidos, p_vitrine public.vitrines_lojas)
returns boolean language sql stable security definer
set search_path = public, extensions
as $$
  select p_vitrine.id is not null
     and p_pedido.microrregiao_id = p_vitrine.microrregiao_id
     and (p_pedido.cidades_ids is null
          or exists (select 1 from public.cidades c
                      where c.id = any(p_pedido.cidades_ids)
                        and public.sem_acento(lower(btrim(c.nome))) = public.sem_acento(lower(btrim(coalesce(p_vitrine.cidade, ''))))))
$$;

create function public.radar_pode_ver_pedido(p_pedido public.radar_pedidos, uid text)
returns boolean language sql stable security definer
set search_path = public, extensions
as $$
  select uid is not null and (
    p_pedido.comprador_id = uid
    or public.e_admin()
    or (p_pedido.microrregiao_id = (select me.microrregiao_id from public.perfis me where me.id = uid)
        and (p_pedido.visibilidade = 'todos'
             or (public.pode_atender_radar(uid)
                 and public.radar_pedido_na_area(p_pedido, (select v from public.vitrines_lojas v where v.dono_id = uid))))))
$$;

-- Loja de fora da área não propõe (mesmo chamando a função direto). Rotina e equipe passam.
create function public.radar_proposta_na_area()
returns trigger language plpgsql security definer
set search_path = public, extensions
as $$
declare
  p    public.radar_pedidos;
  v    public.vitrines_lojas;
begin
  if public.usuario_id() is null or public.e_admin() then return new; end if;
  select * into p from public.radar_pedidos x where x.id = new.pedido_id;
  select * into v from public.vitrines_lojas x where x.id = new.vitrine_id;
  -- a área limita quem ATENDE, qualquer que seja a visibilidade (visibilidade só limita quem VÊ)
  if p.id is not null and not (public.pode_atender_radar(v.dono_id) and public.radar_pedido_na_area(p, v)) then
    raise exception 'Este pedido não é da sua área.' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger radar_proposta_na_area before insert on public.radar_propostas
  for each row execute function public.radar_proposta_na_area();

-- ---------------------------------------------------------------------
-- 3. Leituras: feed, feed regional e a tela do pedido
--    (a conta de "quem sou eu" e "posso atender" é feita uma vez por chamada)
-- ---------------------------------------------------------------------
drop function public.radar_feed();
create function public.radar_feed()
returns table (
  id uuid, microrregiao_id uuid, categoria public.categoria_anuncio, titulo text,
  detalhes text, preco_max_centavos bigint, cidade text, urgencia text,
  atributos jsonb, total_propostas integer, max_propostas integer,
  modo_contato text, propostas_ate timestamptz, expira_em timestamptz, criado_em timestamptz,
  comprador_certificado boolean, comprador_primeiro_nome text, ja_propus boolean,
  categoria_id uuid, categoria_nome text, preco_min_centavos bigint, sou_comprador boolean,
  visibilidade text, area_texto text)
language sql stable security definer
set search_path = public, extensions
as $$
  with eu as materialized (
    select public.usuario_id() as uid,
           public.e_admin() as admin,
           public.pode_atender_radar(public.usuario_id()) as atende,
           (select me.microrregiao_id from public.perfis me where me.id = public.usuario_id()) as regiao,
           (select v from public.vitrines_lojas v where v.dono_id = public.usuario_id()) as vitrine
  )
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
                  where rp.pedido_id = p.id and v.dono_id = eu.uid),
         p.categoria_id, (select c.nome from public.categorias c where c.id = p.categoria_id),
         p.preco_min_centavos, p.comprador_id = eu.uid,
         p.visibilidade, case when p.cidades_ids is null then 'Toda a região' else p.cidade end
  from eu
  cross join public.radar_pedidos p
  join public.perfis pf on pf.id = p.comprador_id
  cross join lateral (select eu.atende or p.comprador_id = eu.uid as ok) acesso
  where eu.uid is not null
    and (p.comprador_id = eu.uid
         or (p.microrregiao_id = eu.regiao
             and (p.visibilidade = 'todos' or eu.admin
                  or (eu.atende and public.radar_pedido_na_area(p, eu.vitrine)))))
    and p.status = 'aberto' and p.expira_em > now()
    and (p.modo_contato = 'whatsapp_direto' or p.propostas_ate > now())
$$;
revoke all on function public.radar_feed() from public, anon;
grant execute on function public.radar_feed() to authenticated;

-- A visibilidade e a área vêm de radar_feed(), que já filtra quem pode ver.
drop function public.radar_feed_regional(text, uuid, integer, integer);
create function public.radar_feed_regional(
  p_filtro text default 'todas', p_categoria_id uuid default null,
  p_limite integer default 41, p_deslocamento integer default 0)
returns table (
  id uuid, categoria_id uuid, titulo text, detalhes text, preco_min_centavos bigint,
  preco_max_centavos bigint, categoria_nome text, cidade text, urgencia text, total_propostas integer,
  max_propostas integer, modo_contato text, propostas_ate timestamptz, criado_em timestamptz,
  comprador_certificado boolean, comprador_primeiro_nome text, ja_propus boolean, sou_comprador boolean,
  visibilidade text, area_texto text
)
language sql stable security definer
set search_path = public
as $$
  with eu as (
    select p.id, p.microrregiao_id from public.perfis p where p.id = public.usuario_id()
  ), meus_nichos as (
    select distinct a.categoria_id
      from eu
      join public.vitrines_lojas v on v.dono_id = eu.id and v.microrregiao_id = eu.microrregiao_id
      join public.anuncios a on a.vitrine_id = v.id and a.microrregiao_id = v.microrregiao_id
     where p_filtro = 'meu_nicho' and v.status = 'ativa' and a.status = 'ativo'
  )
  select f.id, c.id, f.titulo, f.detalhes, f.preco_min_centavos, f.preco_max_centavos, c.nome,
         f.cidade, f.urgencia, f.total_propostas, f.max_propostas, f.modo_contato, f.propostas_ate,
         f.criado_em, f.comprador_certificado, f.comprador_primeiro_nome, f.ja_propus, f.sou_comprador,
         f.visibilidade, f.area_texto
    from public.radar_feed() f
    join eu on eu.microrregiao_id = f.microrregiao_id
    left join public.categorias c on c.id = public.radar_categoria_pedido(f.categoria_id, f.categoria)
   where case p_filtro
           when 'todas' then true
           when 'sem_categoria' then c.id is null
           when 'categoria' then public.radar_nicho_corresponde(p_categoria_id, c.id)
           when 'meu_nicho' then not f.sou_comprador and exists (
             select 1 from meus_nichos n where public.radar_nicho_corresponde(c.id, n.categoria_id)
           )
           else false
         end
   order by f.criado_em desc, f.id desc
   limit least(greatest(coalesce(p_limite, 41), 1), 41)
  offset least(greatest(coalesce(p_deslocamento, 0), 0), 1000000)
$$;
revoke all on function public.radar_feed_regional(text, uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.radar_feed_regional(text, uuid, integer, integer) to authenticated;

-- Tela do pedido. Quem não pode ver (pedido "só lojas" de fora da área) recebe UMA linha
-- bloqueada, sem título nem detalhes, para a tela explicar em vez de dizer "não existe".
drop function public.radar_pedido(uuid);
create function public.radar_pedido(p_id uuid)
returns table (
  id uuid, titulo text, detalhes text, categoria public.categoria_anuncio, categoria_id uuid, categoria_nome text,
  preco_min_centavos bigint, preco_max_centavos bigint, cidade text, urgencia text, modo_contato text,
  propostas_ate timestamptz, expira_em timestamptz, criado_em timestamptz, status text, situacao text,
  total_propostas integer, max_propostas integer, comprador_primeiro_nome text, comprador_certificado boolean,
  sou_comprador boolean, ja_propus boolean, mesma_regiao boolean, tem_acesso boolean, moderado_motivo text,
  fechado_motivo text, visibilidade text, area_texto text, bloqueado boolean)
language sql stable security definer
set search_path = public, extensions
as $$

  with eu as materialized (
    select public.usuario_id() as uid,
           public.e_admin() as admin,
           public.pode_atender_radar(public.usuario_id()) as atende,
           (select me.microrregiao_id from public.perfis me where me.id = public.usuario_id()) as regiao,
           (select v from public.vitrines_lojas v where v.dono_id = public.usuario_id()) as vitrine
  ), alvo as (
    select p as ped, eu.uid, eu.admin, eu.atende, eu.vitrine, x.dono, x.propus,
           (x.aberto_na_regiao and x.pode) as ve_aberto,
           (x.aberto_na_regiao and not x.pode) as bloqueia
      from eu
      cross join public.radar_pedidos p
      cross join lateral (
        select p.comprador_id = eu.uid as dono,
               exists (select 1 from public.radar_propostas rp join public.vitrines_lojas v on v.id = rp.vitrine_id
                        where rp.pedido_id = p.id and v.dono_id = eu.uid) as propus,
               (p.status = 'aberto' and p.expira_em > now() and p.microrregiao_id = eu.regiao) as aberto_na_regiao,
               (p.visibilidade = 'todos' or eu.admin
                or (eu.atende and public.radar_pedido_na_area(p, eu.vitrine))) as pode) x
     where p.id = p_id and eu.uid is not null
  )
  select (t.ped).id, (t.ped).titulo,
         case when a.acesso then (t.ped).detalhes end,
         (t.ped).categoria, (t.ped).categoria_id, c.nome,
         (t.ped).preco_min_centavos, (t.ped).preco_max_centavos, (t.ped).cidade, (t.ped).urgencia, (t.ped).modo_contato,
         (t.ped).propostas_ate, (t.ped).expira_em, (t.ped).criado_em, (t.ped).status::text,
         case when (t.ped).status = 'em_analise' then 'em_analise'
              when (t.ped).status <> 'aberto' or (t.ped).expira_em <= now() then 'fechado'
              when (t.ped).modo_contato = 'propostas_prazo' and (t.ped).propostas_ate <= now() then 'prazo_acabou'
              else 'aberto' end,
         (t.ped).total_propostas, (t.ped).max_propostas,
         case when a.acesso then split_part(btrim(pf.nome), ' ', 1) end,
         pf.selo_negociador_certificado,
         t.dono, t.propus,
         coalesce((t.vitrine).microrregiao_id = (t.ped).microrregiao_id, false),
         a.acesso,
         case when t.dono or t.admin then (t.ped).moderado_motivo end,
         case when t.dono or t.admin then (t.ped).fechado_motivo end,
         (t.ped).visibilidade,
         case when (t.ped).cidades_ids is null then 'Toda a região' else (t.ped).cidade end,
         false
    from alvo t
    join public.perfis pf on pf.id = (t.ped).comprador_id
    left join public.categorias c on c.id = (t.ped).categoria_id
    cross join lateral (select t.dono or t.admin or t.atende as acesso) a
   where t.dono or t.admin or t.propus or t.ve_aberto
  union all
  select (t.ped).id, null::text, null::text, null::public.categoria_anuncio, null::uuid, null::text,
         null::bigint, null::bigint, null::text, null::text, null::text,
         null::timestamptz, null::timestamptz, null::timestamptz, null::text, null::text,
         null::integer, null::integer, null::text, null::boolean,
         false, false, true, false, null::text,
         null::text, 'lojas', null::text, true
    from alvo t
   where not (t.dono or t.admin or t.propus) and t.bloqueia
$$;
revoke all on function public.radar_pedido(uuid) from public, anon;
grant execute on function public.radar_pedido(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 4. Criar pedido: área e visibilidade (parâmetros novos no fim, com padrão)
-- ---------------------------------------------------------------------
drop function public.criar_pedido_radar(text, text, text, integer, text, uuid, bigint, bigint, text, text, text);
create function public.criar_pedido_radar(
  p_titulo             text,
  p_cidade             text    default null,     -- uma cidade só (Aki e telas antigas); ignorada quando vem p_cidades_ids
  p_modo               text    default 'whatsapp_direto',
  p_prazo_horas        integer default null,
  p_detalhes           text    default null,
  p_categoria_id       uuid    default null,
  p_preco_min_centavos bigint  default null,
  p_preco_max_centavos bigint  default null,
  p_urgencia           text    default 'normal',
  p_categoria          text    default null,     -- enum antigo (o Aki manda assim); vale só sem p_categoria_id
  p_origem             text    default 'site',
  p_cidades_ids        uuid[]  default null,     -- null ou vazio = região toda
  p_visibilidade       text    default 'lojas')
returns jsonb language plpgsql security definer
set search_path = public, extensions
as $$
declare
  uid      text := public.usuario_id();
  pf       public.perfis;
  v_titulo text := btrim(regexp_replace(coalesce(p_titulo, ''), '\s+', ' ', 'g'));
  v_det    text := nullif(btrim(regexp_replace(replace(coalesce(p_detalhes, ''), E'\r\n', E'\n'), '[ \t]+', ' ', 'g')), '');
  v_modo   text := coalesce(p_modo, 'whatsapp_direto');
  v_vis    text := coalesce(p_visibilidade, 'lojas');
  v_min    bigint := nullif(p_preco_min_centavos, 0);
  v_max    bigint := nullif(p_preco_max_centavos, 0);
  v_ate    timestamptz;
  v_cat    public.categoria_anuncio := 'geral';
  v_ids    uuid[] := case when cardinality(p_cidades_ids) > 0 then p_cidades_ids end;
  v_cidade text := nullif(btrim(coalesce(p_cidade, '')), '');
  r        public.radar_pedidos;
begin
  if uid is null then
    raise exception 'Entre na sua conta para pedir no Radar.' using errcode = '28000';
  end if;
  select * into pf from public.perfis where id = uid;
  if pf.id is null then
    raise exception 'Termine seu cadastro antes de pedir no Radar.' using errcode = 'P0001';
  end if;
  if not public.whatsapp_confirmado(uid) then
    raise exception using errcode = '42501', message = 'Confirme seu celular para pedir no Radar.', detail = 'campo:celular';
  end if;
  if char_length(v_titulo) not between 8 and 120 then
    raise exception using errcode = '23514', message = 'Escreva o que você procura (de 8 a 120 letras).', detail = 'campo:titulo';
  end if;
  if char_length(coalesce(v_det, '')) > 1000 then
    raise exception using errcode = '23514', message = 'Os detalhes podem ter até 1000 letras.', detail = 'campo:detalhes';
  end if;
  if v_modo not in ('whatsapp_direto', 'propostas_prazo') then
    raise exception using errcode = '22023', message = 'Escolha como as lojas falam com você.', detail = 'campo:modo';
  end if;
  if v_vis not in ('lojas', 'todos') then
    raise exception using errcode = '23514', message = 'Escolha quem pode ver seu pedido.', detail = 'campo:visibilidade';
  end if;
  if v_modo = 'propostas_prazo' then
    if p_prazo_horas is null or not exists (
         select 1 from jsonb_array_elements_text(public.config('radar.prazos_horas', pf.microrregiao_id, '[24, 72, 168]')) x
          where x ~ '^[0-9]{1,5}$' and x::int = p_prazo_horas) then
      raise exception using errcode = '23514', message = 'Escolha um dos prazos da lista.', detail = 'campo:prazo';
    end if;
    v_ate := now() + make_interval(hours => p_prazo_horas);
  end if;
  if (v_min is not null and (v_min < 0 or v_min > 100000000000)) or (v_max is not null and (v_max < 0 or v_max > 100000000000)) then
    raise exception using errcode = '23514', message = 'Confira os valores da faixa de preço.', detail = 'campo:preco';
  end if;
  if v_min is not null and v_max is not null and v_min > v_max then
    raise exception using errcode = '23514', message = 'O preço "de" precisa ser menor que o preço "até".', detail = 'campo:preco';
  end if;
  if p_categoria_id is null and p_categoria in ('imovel', 'veiculo', 'movel', 'geral') then
    v_cat := p_categoria::public.categoria_anuncio;
  end if;

  -- uma cidade só (jeito antigo) vira uma lista de uma cidade; sem nada = região toda
  if v_ids is null and v_cidade is not null and public.sem_acento(lower(v_cidade)) <> 'toda a regiao' then
    select array[c.id] into v_ids from public.cidades c
     where c.microrregiao_id = pf.microrregiao_id and c.ativa
       and public.sem_acento(lower(c.nome)) = public.sem_acento(lower(v_cidade))
     limit 1;
    if v_ids is null then
      raise exception using errcode = '23514', message = 'Escolha uma cidade da sua região.', detail = 'campo:cidade';
    end if;
  end if;

  -- os gatilhos conferem cidades, categoria, limites e moderação (palavras proibidas → em análise)
  insert into public.radar_pedidos (comprador_id, microrregiao_id, categoria, categoria_id, titulo, detalhes,
                                    preco_min_centavos, preco_max_centavos, cidade, cidades_ids, visibilidade,
                                    urgencia, modo_contato, propostas_ate, prazo_horas, origem, status, total_propostas)
  values (uid, pf.microrregiao_id, v_cat, p_categoria_id, v_titulo, v_det, v_min, v_max, 'Toda a região', v_ids, v_vis,
          case when p_urgencia in ('normal', 'esta_semana', 'hoje') then p_urgencia else 'normal' end,
          v_modo, v_ate, case when v_modo = 'propostas_prazo' then p_prazo_horas end,
          case when p_origem = 'aki' then 'aki' else 'site' end, 'aberto', 0)
  returning * into r;

  return jsonb_build_object('id', r.id, 'status', r.status, 'propostas_ate', r.propostas_ate, 'expira_em', r.expira_em,
                            'modo_contato', r.modo_contato);
end $$;
revoke all on function public.criar_pedido_radar(text, text, text, integer, text, uuid, bigint, bigint, text, text, text, uuid[], text) from public, anon;
grant execute on function public.criar_pedido_radar(text, text, text, integer, text, uuid, bigint, bigint, text, text, text, uuid[], text) to authenticated;

drop function public.criar_pedido_radar_site(uuid, text, text, text, integer, text, uuid, bigint, bigint);
create function public.criar_pedido_radar_site(
  p_chave uuid, p_titulo text, p_cidade text default null,
  p_modo text default 'whatsapp_direto', p_prazo_horas integer default null,
  p_detalhes text default null, p_categoria_id uuid default null,
  p_preco_min_centavos bigint default null, p_preco_max_centavos bigint default null,
  p_cidades_ids uuid[] default null, p_visibilidade text default 'lojas')
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
    p_detalhes, p_categoria_id, p_preco_min_centavos, p_preco_max_centavos,
    'normal', null, 'site', p_cidades_ids, p_visibilidade);
  update public.radar_pedidos set chave_envio = p_chave where id = (resultado->>'id')::uuid;
  return resultado;
end $$;
revoke all on function public.criar_pedido_radar_site(uuid, text, text, text, integer, text, uuid, bigint, bigint, uuid[], text) from public, anon;
grant execute on function public.criar_pedido_radar_site(uuid, text, text, text, integer, text, uuid, bigint, bigint, uuid[], text) to authenticated;

revoke all on function public.radar_pedido_na_area(public.radar_pedidos, public.vitrines_lojas) from public, anon;
revoke all on function public.radar_pode_ver_pedido(public.radar_pedidos, text) from public, anon;
grant execute on function public.radar_pedido_na_area(public.radar_pedidos, public.vitrines_lojas) to authenticated;
grant execute on function public.radar_pode_ver_pedido(public.radar_pedidos, text) to authenticated;
revoke all on function public.radar_proposta_na_area() from public, anon, authenticated;

-- Radar v2: aviso de pedido novo na hora só para quem recebe (Full verificada ou cortesia)
-- e só para lojas dentro da área do pedido. Nicho, preferências, tetos e anti-duplicata seguem iguais.
create or replace function public.radar_avisar_pedido_novo()
returns trigger language plpgsql security definer
set search_path = public, extensions
as $$
declare
  categoria_pedido uuid;
  por_dia integer;
  por_comprador integer;
  max_vendedores integer;
  hoje timestamptz := date_trunc('day', now() at time zone 'America/Fortaleza') at time zone 'America/Fortaleza';
  ligados jsonb;
  chave_aviso text := 'pedido_novo:' || new.id::text;
  vars jsonb;
  dono text;
begin
  if new.status <> 'aberto' or new.expira_em <= now() or new.total_propostas >= new.max_propostas
     or (new.modo_contato = 'propostas_prazo' and (new.propostas_ate is null or new.propostas_ate <= now())) then
    return null;
  end if;
  if tg_op = 'UPDATE' and old.status <> 'em_analise' then
    return null; -- publicação após análise; reabrir um pedido já publicado não é um novo pedido
  end if;

  categoria_pedido := public.radar_categoria_pedido(new.categoria_id, new.categoria);
  if categoria_pedido is null then return null; end if;

  ligados := public.config('radar.avisos_ligados', new.microrregiao_id, null);
  if jsonb_typeof(ligados) = 'array' and not (ligados ? 'pedido_novo') then return null; end if;

  por_dia := public.numero_ou_nulo(public.config('radar.avisos_lojas_por_dia', new.microrregiao_id, 'null'))::int;
  por_comprador := public.numero_ou_nulo(public.config('radar.avisos_lojas_por_comprador_dia', new.microrregiao_id, 'null'))::int;
  max_vendedores := coalesce(public.numero_ou_nulo(
    public.config('radar.avisos_lojas_max_por_pedido', new.microrregiao_id, '200')
  )::int, 200);
  if tg_op = 'UPDATE' then
    max_vendedores := max_vendedores - (select count(*)::int from public.notificacoes n where n.chave = chave_aviso);
  end if;
  if max_vendedores <= 0 then return null; end if;

  vars := jsonb_build_object('pedido', new.titulo, 'cidade', new.cidade,
    'preco', public.radar_faixa_texto(new.preco_min_centavos, new.preco_max_centavos));

  for dono in
    select v.dono_id
      from public.vitrines_lojas v
      join public.perfis pf on pf.id = v.dono_id and pf.microrregiao_id = v.microrregiao_id
     where v.microrregiao_id = new.microrregiao_id and v.status = 'ativa'
       and v.dono_id <> new.comprador_id
       and pf.whatsapp is not null and pf.whatsapp_verificado_em is not null
       and not exists (select 1 from public.contas_revogadas r where r.usuario_id = v.dono_id)
       and public.recebe_aviso_radar_na_hora(v.dono_id)
       and public.radar_pedido_na_area(new, v)
       and exists (
         select 1 from public.anuncios a
          where a.vitrine_id = v.id and a.microrregiao_id = v.microrregiao_id and a.status = 'ativo'
            and public.radar_nicho_corresponde(categoria_pedido, a.categoria_id)
       )
       and not exists (
         select 1 from public.preferencias_avisos pa
          where pa.usuario_id = v.dono_id and pa.tipo = 'pedido_novo' and pa.canal = 'app' and not pa.ligado
       )
       and not exists (
         select 1 from public.notificacoes n where n.usuario_id = v.dono_id and n.chave = chave_aviso
       )
       and (por_dia is null or (
         select count(*) from public.notificacoes n
           join public.radar_pedidos rp on rp.id::text = substr(n.chave, 13)
          where n.usuario_id = v.dono_id and n.tipo = 'pedido_novo' and n.criado_em >= hoje
            and n.chave like 'pedido_novo:%' and rp.status = 'aberto'
       ) < por_dia)
       and (por_comprador is null or (
         select count(*) from public.notificacoes n
           join public.radar_pedidos rp on rp.id::text = substr(n.chave, 13)
          where n.usuario_id = v.dono_id and n.tipo = 'pedido_novo' and n.criado_em >= hoje
            and n.chave like 'pedido_novo:%' and rp.comprador_id = new.comprador_id
       ) < por_comprador)
     order by v.criado_em, v.id
     limit max_vendedores
  loop
    perform public.radar_aviso(
      dono, 'pedido_novo', new.microrregiao_id, vars, '/radar/' || new.id::text, chave_aviso
    );
  end loop;
  return null;
end $$;
