-- =====================================================================
-- RADAR v2, tarefa 4: prazo de 15 dias, lembrete 2 dias antes e "Ainda preciso"
-- (até 2 vezes). Seção "prazo". A tarefa 5 acrescenta a seção "resolução" no fim.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Colunas e configurações
-- ---------------------------------------------------------------------
alter table public.radar_pedidos
  add column extensoes smallint not null default 0 check (extensoes between 0 and 10),
  add column lembrete_em timestamptz;

insert into public.configuracoes (chave, valor, grupo, publico, descricao) values
  ('radar.extensoes_max', '2', 'radar', true,
     'Quantas vezes o comprador pode tocar em "Ainda preciso" e estender o pedido (cada vez soma os dias de "Dias que um pedido fica aberto")'),
  ('radar.lembrete_dias', '2', 'radar', true,
     'Quantos dias antes de vencer o comprador recebe o lembrete "Seu pedido vence em N dias" e vê o botão "Ainda preciso"'),
  ('radar.aviso.vai_vencer.titulo', '"Seu pedido vence em 2 dias"', 'radar', false,
     'Aviso ao comprador: título do lembrete de pedido perto de vencer'),
  ('radar.aviso.vai_vencer.texto', '"Você achou “{pedido}”? Se ainda precisa, toque em Ainda preciso e ele fica mais 15 dias."', 'radar', false,
     'Aviso ao comprador: texto do lembrete de pedido perto de vencer. Pode usar {pedido}'),
  ('radar.aviso.vai_vencer_ultimo.texto', '"Você achou “{pedido}”? Ele sai do ar em 2 dias. Se ainda precisa, toque em Pedir de novo."', 'radar', false,
     'Aviso ao comprador: texto do lembrete quando o pedido já foi estendido o máximo de vezes (não tem mais Ainda preciso). Pode usar {pedido}')
on conflict do nothing;

-- Acrescenta o aviso novo às listas sem mexer no que a equipe já editou.
update public.configuracoes
   set valor = valor || '["vai_vencer"]'::jsonb
 where chave in ('radar.avisos_ligados', 'radar.avisos_escolha')
   and jsonb_typeof(valor) = 'array' and not (valor ? 'vai_vencer');

-- ---------------------------------------------------------------------
-- 2. Quem pode tocar em "Ainda preciso" (uma conta só, usada pela tela)
-- ---------------------------------------------------------------------
create function public.radar_pode_estender(p_pedido public.radar_pedidos, uid text)
returns boolean language sql stable security definer
set search_path = public, extensions
as $$
  select uid is not null
     and p_pedido.comprador_id = uid
     and p_pedido.status = 'aberto'
     and p_pedido.expira_em > now()
     and p_pedido.extensoes < coalesce(public.numero_ou_nulo(public.config('radar.extensoes_max', p_pedido.microrregiao_id, '2'))::int, 2)
     and p_pedido.expira_em <= now() + make_interval(days => coalesce(public.numero_ou_nulo(public.config('radar.lembrete_dias', p_pedido.microrregiao_id, '2'))::int, 2))
$$;
revoke all on function public.radar_pode_estender(public.radar_pedidos, text) from public, anon;
grant execute on function public.radar_pode_estender(public.radar_pedidos, text) to authenticated;

-- O prazo das propostas não pode ser cortado quando o sistema o estende ("Ainda preciso").
-- Mesma função da migração anterior; só muda a linha de "sistema" (também vale olaki.sistema = 1).
create or replace function public.radar_validar_pedido()
returns trigger language plpgsql security definer
set search_path = public, extensions
as $$
declare
  uid      text := public.usuario_id();
  sistema  boolean := coalesce(auth.role(), '') = 'service_role' or public.e_admin() or public.usuario_id() is null
                      or coalesce(current_setting('olaki.sistema', true), '') = '1';   -- "Ainda preciso" estende o prazo das propostas
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

-- O comprador também não mexe em extensoes nem lembrete_em (mesma função da migração anterior + 2 linhas).
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
  new.extensoes       := old.extensoes;        -- só "Ainda preciso" (estender_pedido_radar) conta extensões
  new.lembrete_em     := old.lembrete_em;
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
-- 3. Ainda preciso
-- ---------------------------------------------------------------------
create function public.estender_pedido_radar(p_id uuid)
returns timestamptz language plpgsql security definer
set search_path = public, extensions
as $$
declare
  uid     text := public.usuario_id();
  p       public.radar_pedidos;
  maximo  integer;
  dias    integer;
  sistema_anterior text := coalesce(current_setting('olaki.sistema', true), '');
  nova    timestamptz;
begin
  if uid is null then
    raise exception 'Entre na sua conta para continuar.' using errcode = '42501';
  end if;
  select * into p from public.radar_pedidos x where x.id = p_id for update;
  if p.id is null then
    raise exception 'Este pedido não está mais aberto.' using errcode = 'P0002';
  end if;
  if p.comprador_id <> uid then
    raise exception 'Este pedido não é seu.' using errcode = '42501';
  end if;
  if p.status <> 'aberto' or p.expira_em <= now() then
    raise exception 'Este pedido não está mais aberto.' using errcode = 'P0002';
  end if;
  maximo := coalesce(public.numero_ou_nulo(public.config('radar.extensoes_max', p.microrregiao_id, '2'))::int, 2);
  if p.extensoes >= maximo then
    raise exception 'Este pedido já foi estendido % vezes. Toque em Pedir de novo.', maximo using errcode = 'P0001';
  end if;
  dias := coalesce(public.numero_ou_nulo(public.config('radar.dias_pedido', p.microrregiao_id, '15'))::int, 15);

  -- passa pelo gatilho proteger_radar_v4, que trava expira_em e propostas_ate para o comprador
  perform set_config('olaki.sistema', '1', true);
  update public.radar_pedidos x
     set expira_em     = x.expira_em + make_interval(days => dias),
         propostas_ate = case when x.modo_contato = 'propostas_prazo' and x.propostas_ate is not null
                              then x.propostas_ate + make_interval(days => dias) else x.propostas_ate end,
         extensoes     = x.extensoes + 1,
         lembrete_em   = null
   where x.id = p.id
  returning x.expira_em into nova;
  perform set_config('olaki.sistema', sistema_anterior, true);
  return nova;
end $$;
revoke all on function public.estender_pedido_radar(uuid) from public, anon;
grant execute on function public.estender_pedido_radar(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 4. Lembrete (roda de hora em hora)
-- ---------------------------------------------------------------------
create function public.radar_lembrar_vencimento()
returns integer language plpgsql security definer
set search_path = public, extensions
as $$
declare
  r        record;
  avisados integer := 0;
  sistema_anterior text := coalesce(current_setting('olaki.sistema', true), '');
begin
  for r in
    select p.id, p.comprador_id, p.microrregiao_id, p.titulo, p.extensoes
      from public.radar_pedidos p
     where p.status = 'aberto' and p.lembrete_em is null
       and p.expira_em > now()
       and p.expira_em <= now() + make_interval(days => coalesce(
             public.numero_ou_nulo(public.config('radar.lembrete_dias', p.microrregiao_id, '2'))::int, 2))
     order by p.expira_em
     limit 500
     for update of p skip locked
  loop
    -- no limite de extensões não existe mais "Ainda preciso": o texto manda pedir de novo
    perform public.radar_aviso(r.comprador_id, 'vai_vencer', r.microrregiao_id,
      jsonb_build_object('pedido', r.titulo), '/radar/pedido/' || r.id, 'vai_vencer:' || r.id || ':' || r.extensoes,
      case when r.extensoes >= coalesce(public.numero_ou_nulo(public.config('radar.extensoes_max', r.microrregiao_id, '2'))::int, 2)
           then 'radar.aviso.vai_vencer_ultimo.texto' end);
    perform set_config('olaki.sistema', '1', true);
    update public.radar_pedidos set lembrete_em = now() where id = r.id;
    perform set_config('olaki.sistema', sistema_anterior, true);
    avisados := avisados + 1;
  end loop;
  return avisados;
end $$;
revoke all on function public.radar_lembrar_vencimento() from public, anon, authenticated;
grant execute on function public.radar_lembrar_vencimento() to service_role;

-- De hora em hora, no minuto 5 (só se o pg_cron existir).
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('olaki-radar-lembretes', '5 * * * *', 'select public.radar_lembrar_vencimento()');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 5. Leituras: "meus pedidos" e a tela do pedido mostram extensoes e pode_estender
-- ---------------------------------------------------------------------
drop function public.meus_pedidos_radar(boolean);
create function public.meus_pedidos_radar(p_arquivados boolean)
returns table (
  id uuid, titulo text, cidade text, categoria_nome text, status text, situacao text, modo_contato text,
  propostas_ate timestamptz, expira_em timestamptz, criado_em timestamptz,
  total_propostas integer, menor_preco_centavos bigint, fechado_motivo text, moderado_motivo text,
  extensoes smallint, pode_estender boolean)
language sql stable security definer
set search_path = public, extensions
as $$
  select p.id, p.titulo, p.cidade, c.nome, p.status::text,
         case when p.status = 'em_analise' then 'em_analise'
              when p.status <> 'aberto' or p.expira_em <= now() then 'fechado'
              when p.modo_contato = 'propostas_prazo' and p.propostas_ate <= now() then 'prazo_acabou'
              else 'aberto' end,
         p.modo_contato, p.propostas_ate, p.expira_em, p.criado_em,
         ofertas.total, ofertas.menor, p.fechado_motivo, p.moderado_motivo,
         p.extensoes, public.radar_pode_estender(p, public.usuario_id())
    from public.radar_pedidos p
    left join public.categorias c on c.id = p.categoria_id
    cross join lateral (
      select count(*)::int as total, min(rp.preco_centavos) as menor
        from public.radar_propostas rp where rp.pedido_id = p.id and rp.status = 'ativa'
    ) ofertas
   where p.comprador_id = public.usuario_id()
     and (p.arquivado_em is not null) = p_arquivados
   order by p.arquivado_em desc nulls last, p.criado_em desc, p.id desc
   limit 50
$$;
revoke all on function public.meus_pedidos_radar(boolean) from public, anon, authenticated;
grant execute on function public.meus_pedidos_radar(boolean) to authenticated;

drop function public.radar_pedido(uuid);
create function public.radar_pedido(p_id uuid)
returns table (
  id uuid, titulo text, detalhes text, categoria public.categoria_anuncio, categoria_id uuid, categoria_nome text,
  preco_min_centavos bigint, preco_max_centavos bigint, cidade text, urgencia text, modo_contato text,
  propostas_ate timestamptz, expira_em timestamptz, criado_em timestamptz, status text, situacao text,
  total_propostas integer, max_propostas integer, comprador_primeiro_nome text, comprador_certificado boolean,
  sou_comprador boolean, ja_propus boolean, mesma_regiao boolean, tem_acesso boolean, moderado_motivo text,
  fechado_motivo text, visibilidade text, area_texto text, bloqueado boolean,
  extensoes smallint, pode_estender boolean)
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
         false,
         (t.ped).extensoes, public.radar_pode_estender(t.ped, t.uid)
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
         null::text, 'lojas', null::text, true,
         null::smallint, false
    from alvo t
   where not (t.dono or t.admin or t.propus) and t.bloqueia
$$;
revoke all on function public.radar_pedido(uuid) from public, anon;
grant execute on function public.radar_pedido(uuid) to authenticated;

-- =====================================================================
-- RADAR v2, tarefa 5: "Com quem você resolveu?", nota 👍/👎 e "Eu sei onde tem".
-- Seção "resolução".
-- =====================================================================

-- ---------------------------------------------------------------------
-- 6. Colunas, configurações e avisos
-- ---------------------------------------------------------------------
alter table public.radar_pedidos
  add column resolvido_proposta_id uuid references public.radar_propostas(id) on delete set null,
  add column resolvido_fora boolean not null default false,
  add column avaliacao smallint check (avaliacao in (-1, 1));

insert into public.configuracoes (chave, valor, grupo, publico, descricao) values
  ('radar.indicacoes_por_dia', '10', 'radar', true,
     'Quantos anúncios uma pessoa pode indicar por dia em pedidos abertos a todos ("Eu sei onde tem")'),
  ('radar.aviso.indicacao.titulo', '"Alguém sabe onde tem"', 'radar', false,
     'Aviso ao comprador: título de quando alguém indica um anúncio para o pedido'),
  ('radar.aviso.indicacao.texto', '"Indicaram um anúncio para “{pedido}”. Toque para ver."', 'radar', false,
     'Aviso ao comprador: texto de quando alguém indica um anúncio para o pedido. Pode usar {pedido}')
on conflict do nothing;

update public.configuracoes
   set valor = valor || '["indicacao"]'::jsonb
 where chave in ('radar.avisos_ligados', 'radar.avisos_escolha')
   and jsonb_typeof(valor) = 'array' and not (valor ? 'indicacao');

-- O comprador não grava as colunas novas direto (mesma função de antes + 3 linhas).
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
  new.extensoes       := old.extensoes;        -- só "Ainda preciso" (estender_pedido_radar) conta extensões
  new.lembrete_em     := old.lembrete_em;
  new.resolvido_proposta_id := old.resolvido_proposta_id;   -- só resolver_pedido_radar / avaliar_pedido_radar gravam
  new.resolvido_fora  := old.resolvido_fora;
  new.avaliacao       := old.avaliacao;
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
-- 7. "Já resolvi" dizendo com quem (ou fora do Olaki)
-- ---------------------------------------------------------------------
create function public.resolver_pedido_radar(p_id uuid, p_proposta_id uuid default null, p_fora boolean default false)
returns void language plpgsql security definer
set search_path = public, extensions
as $$
declare
  uid text := public.usuario_id();
  p   public.radar_pedidos;
  sistema_anterior text := coalesce(current_setting('olaki.sistema', true), '');
begin
  if uid is null then
    raise exception 'Entre na sua conta para continuar.' using errcode = '42501';
  end if;
  select * into p from public.radar_pedidos x where x.id = p_id for update;
  if p.id is null or p.comprador_id is distinct from uid then
    raise exception 'Pedido não encontrado.' using errcode = '42501';
  end if;
  if p_proposta_id is not null and coalesce(p_fora, false) then
    raise exception 'Escolha uma loja ou "Resolvi fora do Olaki", não as duas.' using errcode = '23514', detail = 'campo:proposta';
  end if;
  if p.status <> 'aberto' then
    raise exception 'Este pedido já está fechado.' using errcode = 'P0001';
  end if;
  if p_proposta_id is not null and not exists (
       select 1 from public.radar_propostas rp
        where rp.id = p_proposta_id and rp.pedido_id = p.id and rp.status = 'ativa') then
    raise exception 'Escolha uma loja que mandou oferta para este pedido.' using errcode = '23514', detail = 'campo:proposta';
  end if;

  perform set_config('olaki.sistema', '1', true);   -- as colunas novas só mudam por aqui
  update public.radar_pedidos x
     set status = 'atendido', fechado_em = now(), fechado_motivo = 'resolvido',
         resolvido_proposta_id = p_proposta_id, resolvido_fora = coalesce(p_fora, false)
   where x.id = p.id;
  perform set_config('olaki.sistema', sistema_anterior, true);
end $$;
revoke all on function public.resolver_pedido_radar(uuid, uuid, boolean) from public, anon;
grant execute on function public.resolver_pedido_radar(uuid, uuid, boolean) to authenticated;

create function public.avaliar_pedido_radar(p_id uuid, p_avaliacao smallint)
returns void language plpgsql security definer
set search_path = public, extensions
as $$
declare
  uid text := public.usuario_id();
  p   public.radar_pedidos;
  sistema_anterior text := coalesce(current_setting('olaki.sistema', true), '');
begin
  if uid is null then
    raise exception 'Entre na sua conta para continuar.' using errcode = '42501';
  end if;
  select * into p from public.radar_pedidos x where x.id = p_id for update;
  if p.id is null or p.comprador_id is distinct from uid then
    raise exception 'Pedido não encontrado.' using errcode = '42501';
  end if;
  if p_avaliacao is null or p_avaliacao not in (-1, 1) then
    raise exception 'Escolha 👍 ou 👎.' using errcode = '23514', detail = 'campo:avaliacao';
  end if;
  if p.status <> 'atendido' or p.resolvido_proposta_id is null then
    raise exception 'Só dá para avaliar um pedido resolvido com uma loja do Olaki.' using errcode = 'P0001';
  end if;
  perform set_config('olaki.sistema', '1', true);
  update public.radar_pedidos x set avaliacao = p_avaliacao where x.id = p.id;
  perform set_config('olaki.sistema', sistema_anterior, true);
end $$;
revoke all on function public.avaliar_pedido_radar(uuid, smallint) from public, anon;
grant execute on function public.avaliar_pedido_radar(uuid, smallint) to authenticated;

-- ---------------------------------------------------------------------
-- 8. "Eu sei onde tem": qualquer pessoa da região indica um anúncio
-- ---------------------------------------------------------------------
create table public.radar_indicacoes (
  id         uuid primary key default gen_random_uuid(),
  pedido_id  uuid not null references public.radar_pedidos(id) on delete cascade,
  autor_id   text not null,
  anuncio_id uuid not null references public.anuncios(id) on delete cascade,
  criado_em  timestamptz not null default now(),
  unique (pedido_id, anuncio_id)
);
create index radar_indicacoes_autor_idx on public.radar_indicacoes (autor_id, criado_em desc);

alter table public.radar_indicacoes enable row level security;
create policy "indicacoes leitura" on public.radar_indicacoes
  for select using (
    autor_id = public.usuario_id()
    or public.e_admin());   -- o comprador NÃO lê a tabela: só indicacoes_do_pedido, que esconde o autor
revoke all on public.radar_indicacoes from anon, authenticated;
grant select on public.radar_indicacoes to authenticated;   -- ninguém grava pela API: só indicar_anuncio_radar

create function public.indicar_anuncio_radar(p_pedido uuid, p_anuncio uuid)
returns uuid language plpgsql security definer
set search_path = public, extensions
as $$
declare
  uid     text := public.usuario_id();
  regiao  uuid;
  p       public.radar_pedidos;
  a       public.anuncios;
  existente uuid;
  lim     integer;
  total   integer;
  novo    uuid;
  hoje    timestamptz := date_trunc('day', now() at time zone 'America/Fortaleza') at time zone 'America/Fortaleza';
begin
  if uid is null then
    raise exception 'Entre na sua conta para continuar.' using errcode = '42501';
  end if;
  select pf.microrregiao_id into regiao from public.perfis pf where pf.id = uid;
  if regiao is null then
    raise exception 'Complete o seu cadastro para indicar.' using errcode = '42501';
  end if;
  select * into p from public.radar_pedidos x where x.id = p_pedido;
  if p.id is null or p.microrregiao_id <> regiao or p.status <> 'aberto' or p.expira_em <= now() then
    raise exception 'Este pedido não está mais aberto.' using errcode = 'P0002';
  end if;
  if p.comprador_id = uid then
    raise exception 'Este pedido é seu.' using errcode = '42501';
  end if;
  if p.visibilidade <> 'todos' then
    raise exception 'Este pedido é só para lojas.' using errcode = '42501';
  end if;
  select * into a from public.anuncios x where x.id = p_anuncio;
  if a.id is null or a.status <> 'ativo' or a.microrregiao_id <> p.microrregiao_id then
    raise exception 'Este anúncio não está disponível.' using errcode = 'P0002';
  end if;
  if public.pode_mexer_vitrine(a.vitrine_id) then   -- dono ou ajudante da loja
    if public.pode_atender_radar(uid) then
      raise exception 'Use "Mandar oferta" para os seus anúncios.' using errcode = 'P0001';
    end if;
    raise exception 'Indique um anúncio de outra pessoa.' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtext('radar_indicacao:' || uid));
  select i.id into existente from public.radar_indicacoes i where i.pedido_id = p.id and i.anuncio_id = a.id;
  if existente is not null then return existente; end if;

  lim := coalesce(public.numero_ou_nulo(public.config('radar.indicacoes_por_dia', p.microrregiao_id, '10'))::int, 10);
  select count(*) into total from public.radar_indicacoes i where i.autor_id = uid and i.criado_em >= hoje;
  if total >= lim then
    raise exception 'Você já indicou % anúncios hoje. Amanhã você pode indicar mais.', total using errcode = 'P0001';
  end if;

  insert into public.radar_indicacoes (pedido_id, autor_id, anuncio_id)
  values (p.id, uid, a.id) returning id into novo;

  perform public.radar_aviso(p.comprador_id, 'indicacao', p.microrregiao_id,
    jsonb_build_object('pedido', p.titulo), '/radar/pedido/' || p.id, 'indicacao:' || p.id || ':' || a.id);
  return novo;
end $$;
revoke all on function public.indicar_anuncio_radar(uuid, uuid) from public, anon;
grant execute on function public.indicar_anuncio_radar(uuid, uuid) to authenticated;

-- O comprador (e a equipe) vê o que indicaram, sem saber quem indicou.
create function public.indicacoes_do_pedido(p_pedido uuid)
returns table (anuncio_id uuid, titulo text, preco_centavos bigint, foto text, vitrine_nome text, criado_em timestamptz)
language plpgsql stable security definer
set search_path = public, extensions
as $$
begin
  if not (public.e_admin() or exists (
        select 1 from public.radar_pedidos p where p.id = p_pedido and p.comprador_id = public.usuario_id())) then
    raise exception 'Pedido não encontrado.' using errcode = '42501';
  end if;
  return query
    select a.id, a.titulo, a.preco_centavos, a.fotos[1], v.nome, i.criado_em
      from public.radar_indicacoes i
      join public.anuncios a on a.id = i.anuncio_id and a.status = 'ativo'
      join public.vitrines_lojas v on v.id = a.vitrine_id
     where i.pedido_id = p_pedido
     order by i.criado_em desc, i.id;
end $$;
revoke all on function public.indicacoes_do_pedido(uuid) from public, anon;
grant execute on function public.indicacoes_do_pedido(uuid) to authenticated;
