-- =====================================================================
-- OLAKI · Etapa 4 · Radar completo: comprador pede, lojas propõem,
-- comprador escolhe. Avisos dentro do app (tabela notificacoes).
-- Base: TELAS-E-FLUXOS.md (T26-T30, F4, F5), PRODUTO-CONTAS-ANUNCIOS-ROBO.md
-- e as decisões do Raniel: teste grátis com 3 propostas (planos), comprador
-- escolhe "WhatsApp na hora" ou "propostas com prazo", e só pede com o
-- celular confirmado por código. Nota de desenho: docs/etapa4/radar.md.
-- Regra de ouro mantida: limites, prazos e textos dos avisos ficam em
-- `configuracoes` (grupo radar), editáveis no painel e registrados no log.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Configurações novas (todas editáveis no painel, grupo "Radar")
-- ---------------------------------------------------------------------
insert into public.configuracoes (chave, valor, grupo, publico, descricao) values
  ('radar.pedidos_por_dia',              '10',  'radar', true,  'Pedidos que um comprador pode fazer no Radar por dia'),
  ('radar.pedidos_abertos_max',          '10',  'radar', true,  'Pedidos abertos (ou em análise) que um comprador pode ter ao mesmo tempo'),
  ('radar.proposta_mensagem_max',        '300', 'radar', true,  'Letras da mensagem que a loja manda junto com a proposta (no máximo 500)'),
  ('radar.fotos_max_pasta',              '5',   'radar', false, 'Fotos que uma loja pode guardar para cada pedido do Radar'),
  ('radar.avisos_ligados',               '["proposta_nova", "prazo_acabou", "pedido_novo", "proposta_escolhida"]', 'radar', false,
     'Avisos do Radar que estão ligados (proposta_nova, prazo_acabou, pedido_novo, proposta_escolhida). Para desligar um, tire o nome da lista'),
  ('radar.avisos_lojas_por_dia',         '10',  'radar', false, 'Máximo de avisos "pedido novo" que cada loja recebe por dia (só contam pedidos que ainda estão abertos)'),
  ('radar.avisos_lojas_por_comprador_dia', '2', 'radar', false, 'Máximo de avisos "pedido novo" que cada loja recebe por dia vindos do mesmo comprador'),
  ('radar.avisos_lojas_max_por_pedido',  '200', 'radar', false, 'Máximo de lojas avisadas quando entra um pedido novo'),
  ('radar.aviso.proposta_nova.titulo',   '"Chegou proposta no Radar"', 'radar', false, 'Aviso ao comprador: título quando chega uma proposta'),
  ('radar.aviso.proposta_nova.texto',    '"{loja} mandou uma proposta para “{pedido}”. Toque para ver e comparar."', 'radar', false,
     'Aviso ao comprador: texto quando chega uma proposta. Pode usar {loja}, {pedido} e {preco}'),
  ('radar.aviso.prazo_acabou.titulo',    '"O prazo do seu pedido acabou"', 'radar', false, 'Aviso ao comprador: título quando o prazo das propostas acaba'),
  ('radar.aviso.prazo_acabou.texto',     '"Você recebeu {total} propostas para “{pedido}”. A menor é {menor}. Escolha com quem falar."', 'radar', false,
     'Aviso ao comprador: texto quando o prazo acaba com propostas. Pode usar {total}, {menor} e {pedido}'),
  ('radar.aviso.prazo_sem_propostas.texto', '"O prazo de “{pedido}” acabou e nenhuma loja mandou proposta. Você pode pedir de novo."', 'radar', false,
     'Aviso ao comprador: texto quando o prazo acaba sem nenhuma proposta. Pode usar {pedido}'),
  ('radar.aviso.pedido_novo.titulo',     '"Novo pedido no Radar"', 'radar', false, 'Aviso às lojas: título quando entra um pedido que combina com elas'),
  ('radar.aviso.pedido_novo.texto',      '"Alguém em {cidade} procura “{pedido}”. {preco}"', 'radar', false,
     'Aviso às lojas: texto do pedido novo. Pode usar {cidade}, {pedido} e {preco}'),
  ('radar.aviso.proposta_escolhida.titulo', '"Escolheram sua proposta!"', 'radar', false, 'Aviso à loja: título quando o comprador escolhe a proposta dela'),
  ('radar.aviso.proposta_escolhida.texto',  '"O comprador de “{pedido}” escolheu a sua proposta e vai te chamar no WhatsApp."', 'radar', false,
     'Aviso à loja: texto quando o comprador escolhe a proposta. Pode usar {pedido} e {loja}'),
  ('radar.avisos_escolha', '["pedido_novo", "proposta_nova", "prazo_acabou", "proposta_escolhida"]', 'radar', true,
     'Avisos que cada pessoa pode ligar ou desligar em Minha conta > Notificações')
on conflict do nothing;

-- ---------------------------------------------------------------------
-- 1. Colunas novas
-- ---------------------------------------------------------------------
alter table public.radar_pedidos
  add column categoria_id       uuid references public.categorias(id) on delete set null,  -- categoria da tabela (o enum antigo vem dela)
  add column preco_min_centavos bigint check (preco_min_centavos >= 0),                    -- "de R$ ..." (opcional)
  add column prazo_horas        integer check (prazo_horas > 0),                           -- opção escolhida no modo prazo
  add column origem             text not null default 'site' check (origem in ('site', 'aki')),
  add column fechado_em         timestamptz,
  add column fechado_motivo     text check (fechado_motivo in ('resolvido', 'cancelado', 'prazo', 'moderacao')),
  add column moderado_motivo    text check (char_length(moderado_motivo) <= 300),
  add constraint radar_pedidos_faixa_preco check (
    preco_min_centavos is null or preco_max_centavos is null or preco_min_centavos <= preco_max_centavos);
create index radar_pedidos_categoria_idx on public.radar_pedidos (categoria_id);

alter table public.radar_propostas
  add column status          text not null default 'ativa' check (status in ('ativa', 'oculta')),  -- oculta = tirada pela equipe
  add column moderado_motivo text check (char_length(moderado_motivo) <= 300),
  add column atualizado_em   timestamptz not null default now(),
  add column escolhida_em    timestamptz;
create index radar_propostas_pedido_idx on public.radar_propostas (pedido_id, status);

-- O comprador não vê proposta tirada pela equipe; a loja continua vendo a sua (com o motivo).
drop policy "propostas leitura" on public.radar_propostas;
create policy "propostas leitura" on public.radar_propostas
  for select using (
    exists (select 1 from public.vitrines_lojas v where v.id = vitrine_id and v.dono_id = public.usuario_id())
    or (status = 'ativa' and exists (select 1 from public.radar_pedidos p where p.id = pedido_id and p.comprador_id = public.usuario_id()))
    or public.e_admin());
-- O IP de quem propôs (Marco Civil) não sai pela API para ninguém: só o servidor (service_role) lê.
-- Leitura por coluna: todas menos criado_ip. Coluna nova nesta tabela precisa entrar nesta lista.
revoke select on public.radar_propostas from anon, authenticated;
grant select (id, pedido_id, vitrine_id, anuncio_id, mensagem, criado_em, preco_centavos, foto_url, escolhida,
              status, moderado_motivo, atualizado_em, escolhida_em)
  on public.radar_propostas to authenticated;

-- Toda mudança em proposta (edição da loja, moderação, remoção) fica no log
create trigger log_propostas_alteracao after update or delete on public.radar_propostas
  for each row execute function public.registrar_log();

-- ---------------------------------------------------------------------
-- 2. Utilitários dos textos
-- ---------------------------------------------------------------------
-- 185000 → "R$ 1.850"; 185050 → "R$ 1.850,50"
create or replace function public.radar_reais(p_centavos bigint)
returns text language sql immutable
set search_path = public, extensions
as $$
  select case when p_centavos is null then null else
    'R$ ' || regexp_replace((p_centavos / 100)::text, '(\d)(?=(\d{3})+$)', '\1.', 'g')
          || case when p_centavos % 100 <> 0 then ',' || lpad((p_centavos % 100)::text, 2, '0') else '' end
  end
$$;

-- Texto do painel com {variáveis} trocadas (ex.: {pedido}, {loja})
create or replace function public.radar_texto(p_chave text, p_regiao uuid, p_vars jsonb, p_padrao text)
returns text language plpgsql stable security definer
set search_path = public, extensions
as $$
declare
  t text;
  k text;
  v text;
begin
  t := coalesce(nullif(btrim(public.config(p_chave, p_regiao, null) #>> '{}'), ''), p_padrao, '');
  for k, v in select e.key, e.value from jsonb_each_text(coalesce(p_vars, '{}'::jsonb)) e loop
    t := replace(t, '{' || k || '}', coalesce(v, ''));
  end loop;
  return left(btrim(regexp_replace(t, '\s+', ' ', 'g')), 500);
end $$;

-- ---------------------------------------------------------------------
-- 3. Avisos dentro do app (fase 2: WhatsApp/push usam a coluna canal)
-- ---------------------------------------------------------------------
create table public.notificacoes (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  text not null references public.perfis(id) on delete cascade,
  tipo        text not null check (tipo ~ '^[a-z0-9_]{3,40}$'),
  titulo      text not null check (char_length(titulo) between 1 and 120),
  texto       text not null check (char_length(texto) between 1 and 500),
  link        text check (link ~ '^/([A-Za-z0-9_-][A-Za-z0-9/_?=&%.,-]*)?$' and char_length(link) <= 300),  -- só caminho interno
  canal       text not null default 'app' check (canal in ('app', 'whatsapp', 'push', 'email')),
  chave       text check (char_length(chave) <= 200),        -- evita o mesmo aviso duas vezes
  dados       jsonb not null default '{}'::jsonb check (jsonb_typeof(dados) = 'object'),
  lida_em     timestamptz,
  enviada_em  timestamptz,                                   -- fase 2: quando saiu pelo WhatsApp/push
  criado_em   timestamptz not null default now()
);
create unique index notificacoes_chave_idx on public.notificacoes (usuario_id, chave) where chave is not null;
create index notificacoes_usuario_idx on public.notificacoes (usuario_id, criado_em desc);
create index notificacoes_nao_lidas_idx on public.notificacoes (usuario_id) where lida_em is null;
create index notificacoes_tipo_dia_idx on public.notificacoes (usuario_id, tipo, criado_em);
alter table public.notificacoes enable row level security;
create policy "notificacoes proprias leitura" on public.notificacoes
  for select using (usuario_id = public.usuario_id());
create policy "notificacoes proprias apagar" on public.notificacoes
  for delete using (usuario_id = public.usuario_id());
-- Ninguém insere nem altera pela API: só as funções do sistema (abaixo)
revoke all on public.notificacoes from anon, authenticated;
grant select, delete on public.notificacoes to authenticated;

-- O que cada pessoa quer receber (Minha conta > Notificações). Sem linha = ligado.
-- Fase 2: a coluna canal separa WhatsApp, e-mail e celular; hoje só existe o aviso no app.
create table public.preferencias_avisos (
  usuario_id    text not null references public.perfis(id) on delete cascade,
  tipo          text not null check (tipo ~ '^[a-z0-9_]{3,40}$'),
  canal         text not null default 'app' check (canal in ('app', 'whatsapp', 'push', 'email')),
  ligado        boolean not null default true,
  atualizado_em timestamptz not null default now(),
  primary key (usuario_id, tipo, canal)
);
alter table public.preferencias_avisos enable row level security;
create policy "preferencias proprias leitura" on public.preferencias_avisos
  for select using (usuario_id = public.usuario_id());
-- Ninguém grava direto pela API: só pela função salvar_preferencia_aviso (abaixo)
revoke all on public.preferencias_avisos from anon, authenticated;
grant select on public.preferencias_avisos to authenticated;

-- Grava um aviso (uso interno). Aviso nunca derruba a ação principal: erro de formato = não avisa.
create or replace function public.notificar(
  p_usuario text, p_tipo text, p_titulo text, p_texto text,
  p_link text default null, p_chave text default null, p_dados jsonb default '{}'::jsonb, p_canal text default 'app')
returns boolean language plpgsql security definer
set search_path = public, extensions
as $$
declare n integer;
begin
  if p_usuario is null or nullif(btrim(coalesce(p_titulo, '')), '') is null or nullif(btrim(coalesce(p_texto, '')), '') is null then
    return false;
  end if;
  -- a pessoa desligou este aviso em Minha conta > Notificações
  if exists (select 1 from public.preferencias_avisos pa
              where pa.usuario_id = p_usuario and pa.tipo = p_tipo and pa.canal = coalesce(p_canal, 'app') and not pa.ligado) then
    return false;
  end if;
  insert into public.notificacoes (usuario_id, tipo, titulo, texto, link, chave, dados, canal)
  values (p_usuario, p_tipo, left(btrim(p_titulo), 120), left(btrim(p_texto), 500), p_link, left(p_chave, 200),
          coalesce(p_dados, '{}'::jsonb), coalesce(p_canal, 'app'))
  on conflict (usuario_id, chave) where chave is not null do nothing;
  get diagnostics n = row_count;
  return n > 0;
exception when check_violation or foreign_key_violation or not_null_violation then
  return false;
end $$;

-- Aviso do Radar: confere se o tipo está ligado e monta título/texto com os textos do painel
create or replace function public.radar_aviso(
  p_usuario text, p_tipo text, p_regiao uuid, p_vars jsonb, p_link text, p_chave text, p_chave_texto text default null)
returns boolean language plpgsql security definer
set search_path = public, extensions
as $$
declare
  ligados jsonb := public.config('radar.avisos_ligados', p_regiao, null);
begin
  if p_usuario is null then return false; end if;
  if jsonb_typeof(ligados) = 'array' and not (ligados ? p_tipo) then return false; end if;
  return public.notificar(
    p_usuario, p_tipo,
    public.radar_texto('radar.aviso.' || p_tipo || '.titulo', p_regiao, p_vars, 'Aviso do Radar'),
    public.radar_texto(coalesce(p_chave_texto, 'radar.aviso.' || p_tipo || '.texto'), p_regiao, p_vars, p_vars->>'pedido'),
    p_link, p_chave, coalesce(p_vars, '{}'::jsonb));
end $$;

-- A pessoa marca os próprios avisos como lidos (todos quando p_ids é nulo)
create or replace function public.marcar_notificacoes_lidas(p_ids uuid[] default null)
returns integer language plpgsql security definer
set search_path = public, extensions
as $$
declare
  uid text := public.usuario_id();
  n   integer;
begin
  if uid is null then
    raise exception 'Entre na sua conta para continuar.' using errcode = '28000';
  end if;
  update public.notificacoes set lida_em = now()
   where usuario_id = uid and lida_em is null and (p_ids is null or id = any(p_ids));
  get diagnostics n = row_count;
  return n;
end $$;

-- A pessoa liga ou desliga um aviso do Radar para ela mesma (só os tipos que a equipe deixa escolher)
create or replace function public.salvar_preferencia_aviso(p_tipo text, p_ligado boolean)
returns boolean language plpgsql security definer
set search_path = public, extensions
as $$
declare
  uid text := public.usuario_id();
begin
  if uid is null then
    raise exception 'Entre na sua conta para continuar.' using errcode = '28000';
  end if;
  if p_ligado is null or p_tipo is null
     or jsonb_typeof(public.config('radar.avisos_escolha', null, '[]')) is distinct from 'array'
     or not (public.config('radar.avisos_escolha', null, '[]') ? p_tipo) then
    raise exception 'Este aviso não pode ser escolhido.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.perfis pf where pf.id = uid) then
    raise exception 'Termine seu cadastro antes de escolher seus avisos.' using errcode = 'P0001';
  end if;
  insert into public.preferencias_avisos (usuario_id, tipo, canal, ligado, atualizado_em)
  values (uid, p_tipo, 'app', p_ligado, now())
  on conflict (usuario_id, tipo, canal) do update set ligado = excluded.ligado, atualizado_em = now();
  return p_ligado;
end $$;

-- ---------------------------------------------------------------------
-- 4. Pedido: validação (vale para a função e para INSERT direto pela API)
-- ---------------------------------------------------------------------
-- "1" no nome: roda depois de radar_0_proteger e antes da moderação e dos padrões.
-- Não confere o celular: isso é da policy de INSERT e de criar_pedido_radar.
create or replace function public.radar_validar_pedido()
returns trigger language plpgsql security definer
set search_path = public, extensions
as $$
declare
  uid      text := public.usuario_id();
  sistema  boolean := coalesce(auth.role(), '') = 'service_role' or public.e_admin() or public.usuario_id() is null;
  cat      public.categorias;
  regiao   uuid;
  v_cidade text;
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
  if sistema then return new; end if;

  if tg_op = 'INSERT' then
    -- o pedido é sempre da região do perfil do comprador
    select p.microrregiao_id into regiao from public.perfis p where p.id = new.comprador_id;
    if regiao is not null then new.microrregiao_id := regiao; end if;
    new.fechado_em := null;
    new.fechado_motivo := null;
    new.moderado_motivo := null;
  end if;

  if new.preco_min_centavos is not null and new.preco_max_centavos is not null and new.preco_min_centavos > new.preco_max_centavos then
    raise exception using errcode = '23514', message = 'O preço "de" precisa ser menor que o preço "até".', detail = 'campo:preco';
  end if;

  -- cidade: só as cidades ativas da região (grava o nome do jeito certo)
  if tg_op = 'INSERT' or new.cidade is distinct from old.cidade then
    select c.nome into v_cidade from public.cidades c
     where c.microrregiao_id = new.microrregiao_id and c.ativa
       and public.sem_acento(lower(c.nome)) = public.sem_acento(lower(btrim(coalesce(new.cidade, ''))))
     limit 1;
    if v_cidade is null then
      raise exception using errcode = '23514', message = 'Escolha uma cidade da sua região.', detail = 'campo:cidade';
    end if;
    new.cidade := v_cidade;
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
create trigger radar_1_validar before insert or update of cidade, categoria_id, preco_min_centavos, preco_max_centavos, propostas_ate
  on public.radar_pedidos for each row execute function public.radar_validar_pedido();

-- O comprador edita o texto do pedido, mas não mexe em prazo, validade, modo, nem reabre pedido fechado.
-- Nome "v4": roda depois de proteger_radar e proteger_radar_v2 (ordem alfabética).
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
  if new.status is distinct from old.status then
    if old.status <> 'aberto' or new.status not in ('atendido', 'encerrado') then
      raise exception 'Este pedido não pode mudar assim. Use os botões da tela do pedido.' using errcode = '42501';
    end if;
    new.fechado_em := now();
    new.fechado_motivo := case when new.status = 'atendido' then 'resolvido' else 'cancelado' end;
  elsif old.status <> 'aberto'
        and (new.titulo is distinct from old.titulo or new.detalhes is distinct from old.detalhes
             or new.cidade is distinct from old.cidade or new.categoria_id is distinct from old.categoria_id
             or new.preco_min_centavos is distinct from old.preco_min_centavos
             or new.preco_max_centavos is distinct from old.preco_max_centavos) then
    raise exception 'Pedido fechado não pode ser alterado.' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger proteger_radar_v4 before update on public.radar_pedidos
  for each row execute function public.proteger_radar_v4();

-- ---------------------------------------------------------------------
-- 5. Comprador: criar, resolver, cancelar
-- ---------------------------------------------------------------------
create or replace function public.criar_pedido_radar(
  p_titulo             text,
  p_cidade             text,
  p_modo               text    default 'whatsapp_direto',
  p_prazo_horas        integer default null,
  p_detalhes           text    default null,
  p_categoria_id       uuid    default null,
  p_preco_min_centavos bigint  default null,
  p_preco_max_centavos bigint  default null,
  p_urgencia           text    default 'normal',
  p_categoria          text    default null,     -- enum antigo (o Aki manda assim); vale só sem p_categoria_id
  p_origem             text    default 'site')
returns jsonb language plpgsql security definer
set search_path = public, extensions
as $$
declare
  uid      text := public.usuario_id();
  pf       public.perfis;
  v_titulo text := btrim(regexp_replace(coalesce(p_titulo, ''), '\s+', ' ', 'g'));
  v_det    text := nullif(btrim(regexp_replace(replace(coalesce(p_detalhes, ''), E'\r\n', E'\n'), '[ \t]+', ' ', 'g')), '');
  v_modo   text := coalesce(p_modo, 'whatsapp_direto');
  v_min    bigint := nullif(p_preco_min_centavos, 0);
  v_max    bigint := nullif(p_preco_max_centavos, 0);
  v_ate    timestamptz;
  v_cat    public.categoria_anuncio := 'geral';
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

  -- os gatilhos conferem cidade, categoria, limites e moderação (palavras proibidas → em análise)
  insert into public.radar_pedidos (comprador_id, microrregiao_id, categoria, categoria_id, titulo, detalhes,
                                    preco_min_centavos, preco_max_centavos, cidade, urgencia, modo_contato,
                                    propostas_ate, prazo_horas, origem, status, total_propostas)
  values (uid, pf.microrregiao_id, v_cat, p_categoria_id, v_titulo, v_det, v_min, v_max, coalesce(p_cidade, ''),
          case when p_urgencia in ('normal', 'esta_semana', 'hoje') then p_urgencia else 'normal' end,
          v_modo, v_ate, case when v_modo = 'propostas_prazo' then p_prazo_horas end,
          case when p_origem = 'aki' then 'aki' else 'site' end, 'aberto', 0)
  returning * into r;

  return jsonb_build_object('id', r.id, 'status', r.status, 'propostas_ate', r.propostas_ate, 'expira_em', r.expira_em,
                            'modo_contato', r.modo_contato);
end $$;

-- "Já resolvi" (atendido) ou "Cancelar pedido" (encerrado)
create or replace function public.fechar_pedido_radar(p_pedido uuid, p_motivo text)
returns text language plpgsql security definer
set search_path = public, extensions
as $$
declare
  uid text := public.usuario_id();
  p   public.radar_pedidos;
begin
  if uid is null then
    raise exception 'Entre na sua conta para continuar.' using errcode = '28000';
  end if;
  if p_motivo not in ('resolvido', 'cancelado') then
    raise exception 'Escolha "Já resolvi" ou "Cancelar".' using errcode = '22023';
  end if;
  select * into p from public.radar_pedidos x where x.id = p_pedido for update;
  if p.id is null or p.comprador_id is distinct from uid then
    raise exception 'Pedido não encontrado.' using errcode = '42501';
  end if;
  if p.fechado_motivo = p_motivo then
    return p.status::text;                         -- toque repetido
  end if;
  if p.status = 'aberto' or (p_motivo = 'cancelado' and p.status = 'em_analise') then
    update public.radar_pedidos x
       set status = case when p_motivo = 'resolvido' then 'atendido'::public.status_pedido else 'encerrado'::public.status_pedido end,
           fechado_em = now(), fechado_motivo = p_motivo
     where x.id = p.id
    returning * into p;
    return p.status::text;
  end if;
  raise exception 'Este pedido já está fechado.' using errcode = 'P0001';
end $$;

-- ---------------------------------------------------------------------
-- 6. Loja: propor (núcleo único para a tela nova e para a função antiga)
-- ---------------------------------------------------------------------
-- p_completo = true (tela nova): no modo prazo pede preço e anúncio ou foto, porque o comprador compara.
create or replace function public.radar_propor(
  p_pedido_id uuid, p_anuncio_id uuid, p_foto_url text, p_preco_centavos bigint, p_mensagem text, p_completo boolean)
returns table (modo text, whatsapp text, mensagem text, proposta_id uuid, editada boolean)
language plpgsql security definer
set search_path = public, extensions
as $$
#variable_conflict use_column
declare
  uid       text := public.usuario_id();
  v_vitrine public.vitrines_lojas;
  v_pedido  public.radar_pedidos;
  v_prop    public.radar_propostas;
  v_fone    text;
  v_rest    integer;
  v_max     integer;
  v_msg     text;
  v_texto   text;
  palavra   text;
  v_id      uuid;
  v_editada boolean := false;
begin
  if uid is null then
    raise exception 'Faça login para propor um produto.' using errcode = '28000';
  end if;
  if not public.tem_plano_pago(uid) then
    raise exception 'O Radar de Negócios é exclusivo dos planos com Radar.' using errcode = '42501';
  end if;

  -- trava a loja antes de contar as propostas: duas propostas ao mesmo tempo não passam do plano
  select * into v_vitrine from public.vitrines_lojas x where x.dono_id = uid for update;
  select * into v_pedido  from public.radar_pedidos x where x.id = p_pedido_id for update;

  if v_pedido.id is null or v_pedido.status <> 'aberto' or v_pedido.expira_em <= now() then
    raise exception 'Este pedido não está mais aberto.' using errcode = 'P0002';
  end if;
  if v_pedido.modo_contato = 'propostas_prazo' and v_pedido.propostas_ate <= now() then
    raise exception 'O prazo para propostas deste pedido já acabou.' using errcode = 'P0002';
  end if;
  if v_pedido.microrregiao_id <> v_vitrine.microrregiao_id then
    raise exception 'Este pedido é de outra região.' using errcode = '42501';
  end if;
  if v_pedido.comprador_id = uid then
    raise exception 'Você não pode propor no seu próprio pedido.' using errcode = 'P0001';
  end if;

  -- o que vai na proposta
  v_max := least(coalesce(public.numero_ou_nulo(public.config('radar.proposta_mensagem_max', v_pedido.microrregiao_id, '300'))::int, 500), 500);
  v_msg := nullif(left(btrim(regexp_replace(replace(coalesce(p_mensagem, ''), E'\r\n', E'\n'), '[ \t]+', ' ', 'g')), greatest(v_max, 1)), '');
  if p_preco_centavos is not null and (p_preco_centavos < 0 or p_preco_centavos > 100000000000) then
    raise exception using errcode = '23514', message = 'Confira o preço da proposta.', detail = 'campo:preco';
  end if;
  if p_anuncio_id is not null and not exists (
       select 1 from public.anuncios a where a.id = p_anuncio_id and a.vitrine_id = v_vitrine.id and a.status = 'ativo') then
    raise exception using errcode = '23514', message = 'Escolha um anúncio seu que está no ar.', detail = 'campo:anuncio';
  end if;
  if p_foto_url is not null and not coalesce(public.foto_do_olaki(p_foto_url, uid, 'radar-' || p_pedido_id::text), false) then
    raise exception using errcode = '22023', message = 'Use uma foto enviada pelo OLAKI.', detail = 'campo:foto';
  end if;
  if p_completo and v_pedido.modo_contato = 'propostas_prazo' then
    if coalesce(p_preco_centavos, 0) <= 0 then
      raise exception using errcode = '23514', message = 'Diga o preço da sua proposta.', detail = 'campo:preco';
    end if;
    if p_anuncio_id is null and p_foto_url is null
       and not exists (select 1 from public.radar_propostas rp
                        where rp.pedido_id = p_pedido_id and rp.vitrine_id = v_vitrine.id
                          and (rp.anuncio_id is not null or rp.foto_url is not null)) then
      raise exception using errcode = '23514', message = 'Escolha um anúncio seu ou mande uma foto.', detail = 'campo:foto';
    end if;
  end if;
  -- mesmo filtro de palavras dos anúncios: a mensagem com palavra proibida não vai
  if v_msg is not null then
    for palavra in select jsonb_array_elements_text(public.config('moderacao.palavras_bloqueadas', v_pedido.microrregiao_id, '[]')) loop
      if public.sem_acento(lower(v_msg)) ~ ('\m' || public.sem_acento(lower(palavra)) || '\M') then
        raise exception using errcode = 'P0001', detail = 'campo:mensagem',
          message = format('Sua mensagem tem uma palavra que não pode no OLAKI ("%s"). Mude o texto e envie de novo.', palavra);
      end if;
    end loop;
  end if;

  select * into v_prop from public.radar_propostas rp where rp.pedido_id = p_pedido_id and rp.vitrine_id = v_vitrine.id;
  if v_prop.id is null then
    v_rest := public.propostas_restantes(uid);
    if v_rest is not null and v_rest <= 0 then
      raise exception 'Você usou todas as propostas do seu plano. Assine um plano maior para continuar.' using errcode = '42501';
    end if;
    if v_pedido.total_propostas >= v_pedido.max_propostas then
      raise exception 'Este pedido já recebeu o máximo de propostas.' using errcode = 'P0001';
    end if;
    insert into public.radar_propostas (pedido_id, vitrine_id, anuncio_id, mensagem, preco_centavos, foto_url)
    values (p_pedido_id, v_vitrine.id, p_anuncio_id, v_msg, p_preco_centavos, p_foto_url)
    returning id into v_id;
    perform set_config('olaki.sistema', '1', true);   -- libera o contador protegido
    update public.radar_pedidos x set total_propostas = total_propostas + 1 where x.id = p_pedido_id;
    perform set_config('olaki.sistema', '', true);
  else
    if v_prop.status <> 'ativa' then
      raise exception 'Sua proposta foi tirada pela equipe do OLAKI. Fale com o suporte.' using errcode = '42501';
    end if;
    -- editar é permitido até o prazo (modo prazo) ou enquanto o pedido está aberto (modo WhatsApp),
    -- mas nunca depois que o comprador escolheu: ele escolheu aquele preço
    if v_msg is not null or p_preco_centavos is not null or p_foto_url is not null or p_anuncio_id is not null then
      if v_prop.escolhida then
        raise exception using errcode = 'P0001', detail = 'campo:escolhida',
          message = 'O comprador já escolheu sua proposta. Agora combine pelo WhatsApp.';
      end if;
      update public.radar_propostas rp
         set mensagem = coalesce(v_msg, rp.mensagem),
             preco_centavos = coalesce(p_preco_centavos, rp.preco_centavos),
             foto_url = case when p_foto_url is not null then p_foto_url
                             when p_anuncio_id is not null then null else rp.foto_url end,
             anuncio_id = case when p_anuncio_id is not null then p_anuncio_id
                               when p_foto_url is not null then null else rp.anuncio_id end,
             atualizado_em = now()
       where rp.id = v_prop.id;
      v_editada := true;
    end if;
    v_id := v_prop.id;
  end if;

  if v_pedido.modo_contato = 'propostas_prazo' then
    -- o comprador não quer ser chamado: a oferta fica guardada e ele escolhe com quem falar
    return query select 'propostas_prazo'::text, null::text,
      format('Proposta enviada! O comprador recebe todas as ofertas em %s e escolhe com quem falar.',
             to_char(v_pedido.propostas_ate at time zone 'America/Fortaleza', 'DD/MM "às" HH24:MI')),
      v_id, v_editada;
    return;
  end if;

  -- só entrega número confirmado no Clerk (quem troca o número perde a confirmação)
  select pf.whatsapp into v_fone from public.perfis pf
   where pf.id = v_pedido.comprador_id and pf.whatsapp_verificado_em is not null;
  if v_fone is null then
    raise exception 'O comprador ainda não confirmou o celular. Tente mais tarde.' using errcode = 'P0001';
  end if;
  v_texto := format('Olá! Vi seu pedido no Radar do OLAKI: "%s". Tenho uma proposta da loja %s.', v_pedido.titulo, v_vitrine.nome);
  return query select 'whatsapp_direto'::text, v_fone, v_texto, v_id, v_editada;
end $$;

-- Tela nova (folha "Propor")
create or replace function public.propor_radar(
  p_pedido_id uuid, p_anuncio_id uuid default null, p_foto_url text default null,
  p_preco_centavos bigint default null, p_mensagem text default null)
returns table (modo text, whatsapp text, mensagem text, proposta_id uuid, editada boolean)
language sql security definer
set search_path = public, extensions
as $$
  select r.modo, r.whatsapp, r.mensagem, r.proposta_id, r.editada
    from public.radar_propor(p_pedido_id, p_anuncio_id, p_foto_url, p_preco_centavos, p_mensagem, true) r
$$;

-- Função antiga: mesma assinatura e mesmo retorno; por dentro, a regra única acima
create or replace function public.revelar_contato_radar(
  p_pedido_id uuid, p_anuncio_id uuid default null, p_mensagem text default null,
  p_preco_centavos bigint default null, p_foto_url text default null)
returns table (modo text, whatsapp text, mensagem text)
language sql security definer
set search_path = public, extensions
as $$
  select r.modo, r.whatsapp, r.mensagem
    from public.radar_propor(p_pedido_id, p_anuncio_id, p_foto_url, p_preco_centavos, p_mensagem, false) r
$$;

-- ---------------------------------------------------------------------
-- 7. Comprador escolhe a proposta e recebe o WhatsApp da loja
-- ---------------------------------------------------------------------
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
  select * into p  from public.radar_pedidos x where x.id = rp.pedido_id;
  if p.comprador_id is distinct from uid then
    raise exception 'Esta proposta não é do seu pedido.' using errcode = '42501';
  end if;
  if rp.status <> 'ativa' or p.status in ('em_analise', 'congelado') or p.fechado_motivo = 'moderacao' then
    raise exception 'Esta proposta não está mais disponível.' using errcode = 'P0002';
  end if;
  select * into v from public.vitrines_lojas x where x.id = rp.vitrine_id;
  if v.status <> 'ativa' then
    raise exception 'Esta loja não está atendendo pelo OLAKI agora.' using errcode = 'P0002';
  end if;
  -- loja: WhatsApp da loja; pessoa física: só o celular confirmado do perfil
  fone := coalesce(case when v.tipo = 'loja' then v.whatsapp end,
                   (select pf.whatsapp from public.perfis pf where pf.id = v.dono_id and pf.whatsapp_verificado_em is not null));
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

-- ---------------------------------------------------------------------
-- 8. Leituras das telas (mesmo bloqueio do feed: detalhes e nome só com
--    plano com Radar ou para o próprio comprador; contato nunca)
-- ---------------------------------------------------------------------
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
     and (x.dono or eu.admin or x.propus or (p.status = 'aberto' and p.expira_em > now()))
$$;

-- Propostas para o comprador comparar (sem contato: o WhatsApp só sai em escolher_proposta)
create or replace function public.propostas_do_pedido(p_pedido uuid)
returns table (
  id uuid, vitrine_id uuid, loja_nome text, loja_slug text, loja_tipo text, loja_selo boolean, loja_logo text,
  preco_centavos bigint, mensagem text, foto_url text, anuncio_id uuid, anuncio_titulo text,
  anuncio_preco_centavos bigint, anuncio_capa text, escolhida boolean, status text, criado_em timestamptz, atualizado_em timestamptz)
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
         rp.escolhida, rp.status, rp.criado_em, rp.atualizado_em
    from public.radar_propostas rp
    join public.radar_pedidos p on p.id = rp.pedido_id
    join public.vitrines_lojas v on v.id = rp.vitrine_id
    left join public.anuncios a on a.id = rp.anuncio_id
   where rp.pedido_id = p_pedido
     and public.usuario_id() is not null
     and ((p.comprador_id = public.usuario_id() and rp.status = 'ativa') or public.e_admin())
   order by rp.preco_centavos asc nulls last, rp.criado_em
$$;

-- Aba "Meus pedidos"
create or replace function public.meus_pedidos_radar()
returns table (
  id uuid, titulo text, cidade text, categoria_nome text, status text, situacao text, modo_contato text,
  propostas_ate timestamptz, expira_em timestamptz, criado_em timestamptz,
  total_propostas integer, menor_preco_centavos bigint, fechado_motivo text, moderado_motivo text)
language sql stable security definer
set search_path = public, extensions
as $$
  select p.id, p.titulo, p.cidade, c.nome, p.status::text,
         case when p.status = 'em_analise' then 'em_analise'
              when p.status <> 'aberto' or p.expira_em <= now() then 'fechado'
              when p.modo_contato = 'propostas_prazo' and p.propostas_ate <= now() then 'prazo_acabou'
              else 'aberto' end,
         p.modo_contato, p.propostas_ate, p.expira_em, p.criado_em,
         (select count(*)::int from public.radar_propostas rp where rp.pedido_id = p.id and rp.status = 'ativa'),
         (select min(rp.preco_centavos) from public.radar_propostas rp where rp.pedido_id = p.id and rp.status = 'ativa'),
         p.fechado_motivo, p.moderado_motivo
    from public.radar_pedidos p
    left join public.categorias c on c.id = p.categoria_id
   where p.comprador_id = public.usuario_id()
   order by p.criado_em desc
   limit 50
$$;

-- Aba "Minhas propostas" (loja)
create or replace function public.minhas_propostas_radar()
returns table (
  id uuid, pedido_id uuid, pedido_titulo text, pedido_cidade text, situacao text, modo_contato text,
  propostas_ate timestamptz, preco_centavos bigint, mensagem text, foto_url text, anuncio_id uuid,
  status text, moderado_motivo text, escolhida boolean, criado_em timestamptz, atualizado_em timestamptz)
language sql stable security definer
set search_path = public, extensions
as $$
  select rp.id, p.id, p.titulo, p.cidade,
         case when p.status = 'em_analise' then 'em_analise'
              when p.status <> 'aberto' or p.expira_em <= now() then 'fechado'
              when p.modo_contato = 'propostas_prazo' and p.propostas_ate <= now() then 'prazo_acabou'
              else 'aberto' end,
         p.modo_contato, p.propostas_ate, rp.preco_centavos, rp.mensagem, rp.foto_url, rp.anuncio_id,
         rp.status, rp.moderado_motivo, rp.escolhida, rp.criado_em, rp.atualizado_em
    from public.radar_propostas rp
    join public.vitrines_lojas v on v.id = rp.vitrine_id
    join public.radar_pedidos p on p.id = rp.pedido_id
   where v.dono_id = public.usuario_id()
   order by rp.criado_em desc
   limit 50
$$;

-- Feed: as mesmas colunas de antes + categoria da tabela, "de R$" e se o pedido é meu
drop function public.radar_feed();
create function public.radar_feed()
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
    and p.status = 'aberto' and p.expira_em > now()
    and (p.modo_contato = 'whatsapp_direto' or p.propostas_ate > now())
$$;

-- ---------------------------------------------------------------------
-- 9. Avisos automáticos
-- ---------------------------------------------------------------------
-- Faixa de preço do pedido para o texto do aviso ("Até R$ 2.000", "De R$ 1.000 a R$ 2.000")
create or replace function public.radar_faixa_texto(p_min bigint, p_max bigint)
returns text language sql immutable
set search_path = public, extensions
as $$
  select case
    when p_min is not null and p_max is not null then 'De ' || public.radar_reais(p_min) || ' a ' || public.radar_reais(p_max) || '.'
    when p_max is not null then 'Até ' || public.radar_reais(p_max) || '.'
    when p_min is not null then 'A partir de ' || public.radar_reais(p_min) || '.'
    else 'Valor a combinar.' end
$$;

-- Proposta nova → comprador
create or replace function public.radar_avisar_proposta()
returns trigger language plpgsql security definer
set search_path = public, extensions
as $$
declare
  p public.radar_pedidos;
  v public.vitrines_lojas;
begin
  select * into p from public.radar_pedidos x where x.id = new.pedido_id;
  select * into v from public.vitrines_lojas x where x.id = new.vitrine_id;
  perform public.radar_aviso(p.comprador_id, 'proposta_nova', p.microrregiao_id,
    jsonb_build_object('pedido', p.titulo,
                       'loja', case when v.tipo = 'pf' then split_part(btrim(v.nome), ' ', 1) else v.nome end,
                       'preco', coalesce(public.radar_reais(new.preco_centavos), '')),
    '/radar/pedido/' || p.id::text, 'proposta_nova:' || new.id::text);
  return null;
end $$;
create trigger radar_avisar_proposta after insert on public.radar_propostas
  for each row execute function public.radar_avisar_proposta();

-- Pedido novo (ou liberado pela moderação) → lojas da região que vendem na mesma categoria-mãe.
-- Sem categoria: todas as lojas da região. Tetos do painel: por loja por dia (só contam pedidos
-- ainda abertos, então pedido cancelado não gasta o teto), por loja por comprador por dia (uma
-- conta sozinha não lota o aviso de todas as lojas) e de lojas por pedido.
create or replace function public.radar_avisar_pedido_novo()
returns trigger language plpgsql security definer
set search_path = public, extensions
as $$
declare
  mae      uuid;
  por_dia  integer;
  por_comp integer;
  max_lojas integer;
  hoje     timestamptz := date_trunc('day', now() at time zone 'America/Fortaleza') at time zone 'America/Fortaleza';
  ligados  jsonb := public.config('radar.avisos_ligados', new.microrregiao_id, null);
  vars     jsonb;
  dono     text;
begin
  if new.status <> 'aberto' or new.expira_em <= now() then return null; end if;
  if tg_op = 'UPDATE' and old.status = 'aberto' then return null; end if;
  if jsonb_typeof(ligados) = 'array' and not (ligados ? 'pedido_novo') then return null; end if;

  if new.categoria_id is not null then
    select coalesce(c.pai_id, c.id) into mae from public.categorias c where c.id = new.categoria_id;
  end if;
  por_dia   := public.numero_ou_nulo(public.config('radar.avisos_lojas_por_dia', new.microrregiao_id, 'null'))::int;
  por_comp  := public.numero_ou_nulo(public.config('radar.avisos_lojas_por_comprador_dia', new.microrregiao_id, 'null'))::int;
  max_lojas := coalesce(public.numero_ou_nulo(public.config('radar.avisos_lojas_max_por_pedido', new.microrregiao_id, '200'))::int, 200);
  vars := jsonb_build_object('pedido', new.titulo, 'cidade', new.cidade,
                             'preco', public.radar_faixa_texto(new.preco_min_centavos, new.preco_max_centavos));

  for dono in
    select v.dono_id
      from public.vitrines_lojas v
     where v.microrregiao_id = new.microrregiao_id and v.tipo = 'loja' and v.status = 'ativa'
       and v.dono_id <> new.comprador_id
       and (mae is null or exists (
             select 1 from public.anuncios a join public.categorias c on c.id = a.categoria_id
              where a.vitrine_id = v.id and a.status = 'ativo' and coalesce(c.pai_id, c.id) = mae))
       and (por_dia is null or (select count(*) from public.notificacoes n
                                  join public.radar_pedidos rp on rp.id::text = substr(n.chave, 13)
                                 where n.usuario_id = v.dono_id and n.tipo = 'pedido_novo' and n.criado_em >= hoje
                                   and n.chave like 'pedido_novo:%' and rp.status = 'aberto') < por_dia)
       and (por_comp is null or (select count(*) from public.notificacoes n
                                   join public.radar_pedidos rp on rp.id::text = substr(n.chave, 13)
                                  where n.usuario_id = v.dono_id and n.tipo = 'pedido_novo' and n.criado_em >= hoje
                                    and n.chave like 'pedido_novo:%' and rp.comprador_id = new.comprador_id) < por_comp)
     order by public.tem_plano_pago(v.dono_id) desc, v.criado_em
     limit greatest(max_lojas, 0)
  loop
    perform public.radar_aviso(dono, 'pedido_novo', new.microrregiao_id, vars, '/radar/' || new.id::text,
                               'pedido_novo:' || new.id::text);
  end loop;
  return null;
end $$;
create trigger radar_avisar_pedido_novo after insert or update of status on public.radar_pedidos
  for each row execute function public.radar_avisar_pedido_novo();

-- Proposta removida (moderação): libera a vaga no pedido
create or replace function public.radar_proposta_removida()
returns trigger language plpgsql security definer
set search_path = public, extensions
as $$
begin
  perform set_config('olaki.sistema', '1', true);
  update public.radar_pedidos x set total_propostas = greatest(total_propostas - 1, 0) where x.id = old.pedido_id;
  perform set_config('olaki.sistema', '', true);
  return null;
end $$;
create trigger radar_proposta_removida after delete on public.radar_propostas
  for each row execute function public.radar_proposta_removida();

-- Rotina: prazo das propostas acabou → resumo ao comprador ("6 propostas, a menor R$ 1.850");
-- pedido vencido → encerrado com motivo "prazo". Devolve quantos resumos foram mandados.
create or replace function public.radar_avisar_prazos()
returns integer language plpgsql security definer
set search_path = public, extensions
as $$
declare
  p      public.radar_pedidos;
  total  integer;
  menor  bigint;
  feitos integer := 0;
begin
  for p in
    select * from public.radar_pedidos x
     where x.status = 'aberto' and x.modo_contato = 'propostas_prazo'
       and x.propostas_ate <= now() and x.resumo_enviado_em is null
     for update skip locked
  loop
    select count(*), min(rp.preco_centavos) into total, menor
      from public.radar_propostas rp where rp.pedido_id = p.id and rp.status = 'ativa';
    perform public.radar_aviso(p.comprador_id, 'prazo_acabou', p.microrregiao_id,
      jsonb_build_object('pedido', p.titulo, 'total', total::text,
                         'menor', coalesce(public.radar_reais(menor), 'sem preço')),
      '/radar/pedido/' || p.id::text, 'prazo_acabou:' || p.id::text,
      case when total = 0 then 'radar.aviso.prazo_sem_propostas.texto' end);
    update public.radar_pedidos x set resumo_enviado_em = now() where x.id = p.id;
    feitos := feitos + 1;
  end loop;

  update public.radar_pedidos x set status = 'encerrado', fechado_motivo = 'prazo', fechado_em = now()
   where x.status = 'aberto' and x.expira_em <= now();
  return feitos;
end $$;

-- O aviso "prazo acabou" não pode esperar a rotina diária (prazo de 24 h viraria quase 48 h):
-- radar_avisar_prazos() roda sozinha a cada 10 minutos. Onde o pg_cron está ligado (Supabase),
-- a migração já agenda; sem ele, agendar na mão (docs/etapa4/radar.md).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    execute $c$select cron.schedule('olaki-radar-prazos', '*/10 * * * *', 'select public.radar_avisar_prazos()')$c$;
  end if;
end $$;

-- A rotina diária também ganha o Radar sem apagar o que as outras etapas puseram nela:
-- a versão atual vira expirar_rotina_base() e a nova chama as duas.
alter function public.expirar_rotina() rename to expirar_rotina_base;
create function public.expirar_rotina()
returns void language plpgsql security definer
set search_path = public, extensions
as $$
begin
  perform public.radar_avisar_prazos();
  perform public.expirar_rotina_base();
end $$;

-- ---------------------------------------------------------------------
-- 10. Painel: moderar pedidos e propostas (ocultar, devolver, remover)
--     Toda mudança cai em logs_atividade (gatilhos log_radar e log_propostas_*).
-- ---------------------------------------------------------------------
create or replace function public.moderar_radar(p_tipo text, p_id uuid, p_acao text, p_motivo text default null)
returns text language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v_motivo text := nullif(left(btrim(coalesce(p_motivo, '')), 300), '');
  p        public.radar_pedidos;
  rp       public.radar_propostas;
begin
  if not public.e_admin() then
    raise exception 'Só a equipe do OLAKI modera o Radar.' using errcode = '42501';
  end if;
  if p_tipo not in ('pedido', 'proposta') or p_acao not in ('ocultar', 'devolver', 'remover') then
    raise exception 'Ação inválida.' using errcode = '22023';
  end if;
  if p_acao in ('ocultar', 'remover') and char_length(coalesce(v_motivo, '')) < 3 then
    raise exception using errcode = '23514', message = 'Escreva o motivo (o dono vê e fica no histórico).', detail = 'campo:motivo';
  end if;

  if p_tipo = 'pedido' then
    select * into p from public.radar_pedidos x where x.id = p_id for update;
    if p.id is null then raise exception 'Pedido não encontrado.' using errcode = 'P0002'; end if;
    if p_acao = 'ocultar' then
      update public.radar_pedidos x
         set status = 'encerrado', fechado_motivo = 'moderacao', fechado_em = now(), moderado_motivo = v_motivo
       where x.id = p.id;
      return 'oculto';
    elsif p_acao = 'devolver' then
      if p.fechado_motivo is distinct from 'moderacao' then
        raise exception 'Este pedido não foi tirado pela equipe.' using errcode = 'P0001';
      end if;
      update public.radar_pedidos x
         set status = case when x.expira_em > now() then 'aberto'::public.status_pedido else 'encerrado'::public.status_pedido end,
             fechado_motivo = case when x.expira_em > now() then null else 'prazo' end,
             fechado_em = case when x.expira_em > now() then null else now() end,
             moderado_motivo = null
       where x.id = p.id;
      return 'devolvido';
    else
      update public.radar_pedidos x set moderado_motivo = v_motivo where x.id = p.id;   -- o motivo fica no log
      delete from public.radar_pedidos x where x.id = p.id;
      return 'removido';
    end if;
  end if;

  select * into rp from public.radar_propostas x where x.id = p_id for update;
  if rp.id is null then raise exception 'Proposta não encontrada.' using errcode = 'P0002'; end if;
  if p_acao = 'ocultar' then
    update public.radar_propostas x set status = 'oculta', moderado_motivo = v_motivo, atualizado_em = now() where x.id = rp.id;
    return 'oculta';
  elsif p_acao = 'devolver' then
    update public.radar_propostas x set status = 'ativa', moderado_motivo = null, atualizado_em = now() where x.id = rp.id;
    return 'devolvida';
  end if;
  update public.radar_propostas x set moderado_motivo = v_motivo where x.id = rp.id;      -- o motivo fica no log
  delete from public.radar_propostas x where x.id = rp.id;
  return 'removida';
end $$;

-- ---------------------------------------------------------------------
-- 11. Fotos da proposta: pasta <usuario>/radar-<pedido>/<arquivo> no bucket 'anuncios'
--     (loja com Radar, pedido aberto de outra pessoa e da mesma região).
--     Mesmo corpo da versão anterior (20261107040000) + o ramo do Radar.
-- ---------------------------------------------------------------------
create or replace function public.pode_enviar_foto(nome text)
returns boolean language plpgsql stable security definer
set search_path = public, extensions
as $$
declare
  uid    text := public.usuario_id();
  partes text[] := string_to_array(coalesce(pode_enviar_foto.nome, ''), '/');
  regiao uuid;
  vit    public.vitrines_lojas;
  chave_max text := 'fotos.max_por_pasta';
  maximo integer;
  total  integer := 0;
begin
  if uid is null or cardinality(partes) <> 3 or partes[1] <> uid
     or partes[3] !~ '^[A-Za-z0-9_-][A-Za-z0-9._-]*$' then
    return false;
  end if;
  if partes[2] = 'loja' then
    select v.microrregiao_id into regiao from public.vitrines_lojas v
     where v.dono_id = uid and v.tipo = 'loja' and v.status <> 'suspensa';
    if not found then return false; end if;
  elsif partes[2] = 'vitrine' then
    select * into vit from public.vitrines_lojas v
     where v.dono_id = uid and v.tipo = 'loja' and v.status <> 'suspensa';
    if vit.id is null then return false; end if;
    if not coalesce((select r.foto_fachada from public.recursos_vitrine(vit) r), false) then return false; end if;
    regiao := vit.microrregiao_id;
  elsif partes[2] ~ '^radar-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    if not public.tem_plano_pago(uid) then return false; end if;
    select p.microrregiao_id into regiao
      from public.radar_pedidos p
      join public.vitrines_lojas v on v.dono_id = uid and v.microrregiao_id = p.microrregiao_id and v.status = 'ativa'
     where p.id = substr(partes[2], 7)::uuid and p.status = 'aberto' and p.expira_em > now()
       and p.comprador_id <> uid
       and (p.modo_contato = 'whatsapp_direto' or p.propostas_ate > now());
    if not found then return false; end if;
    chave_max := 'radar.fotos_max_pasta';
  elsif partes[2] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select a.microrregiao_id into regiao from public.anuncios a join public.vitrines_lojas v on v.id = a.vitrine_id
     where a.id = partes[2]::uuid and v.dono_id = uid and a.status not in ('congelado', 'em_analise');
    if not found then return false; end if;
  else
    return false;
  end if;
  maximo := public.numero_ou_nulo(public.config(chave_max, regiao, 'null'))::int;
  if maximo is not null and to_regclass('storage.objects') is not null then
    execute 'select count(*) from storage.objects where bucket_id = $1 and name like $2'
       into total using 'anuncios', partes[1] || '/' || partes[2] || '/%';
    if total >= maximo then return false; end if;
  end if;
  return true;
end $$;

-- ---------------------------------------------------------------------
-- 12. Endurecimento (mesmo estilo das migrações anteriores). Pode rodar de novo.
-- ---------------------------------------------------------------------
do $$
declare f regprocedure;
begin
  for f in
    select p.oid::regprocedure
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prokind = 'f'
       and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
       and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')
  loop
    execute format('alter function %s set search_path = public, extensions', f);
  end loop;
  for f in
    select p.oid::regprocedure
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prorettype = 'trigger'::regtype
       and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
end $$;

-- Internas: ninguém chama pela API
revoke all on function public.radar_propor(uuid, uuid, text, bigint, text, boolean) from public, anon, authenticated;
revoke all on function public.notificar(text, text, text, text, text, text, jsonb, text) from public, anon, authenticated;
revoke all on function public.radar_aviso(text, text, uuid, jsonb, text, text, text) from public, anon, authenticated;
revoke all on function public.radar_texto(text, uuid, jsonb, text) from public, anon, authenticated;
revoke all on function public.radar_reais(bigint) from public, anon, authenticated;
revoke all on function public.radar_faixa_texto(bigint, bigint) from public, anon, authenticated;

-- Só o servidor (rotina diária / pg_cron)
revoke all on function public.radar_avisar_prazos() from public, anon, authenticated;
revoke all on function public.expirar_rotina_base() from public, anon, authenticated;
revoke all on function public.expirar_rotina() from public, anon, authenticated;
grant execute on function public.radar_avisar_prazos(), public.expirar_rotina_base(), public.expirar_rotina() to service_role;

-- Pessoa logada (cada função confere dono, loja ou admin por dentro)
revoke all on function public.criar_pedido_radar(text, text, text, integer, text, uuid, bigint, bigint, text, text, text) from public, anon;
revoke all on function public.fechar_pedido_radar(uuid, text) from public, anon;
revoke all on function public.propor_radar(uuid, uuid, text, bigint, text) from public, anon;
revoke all on function public.revelar_contato_radar(uuid, uuid, text, bigint, text) from public, anon;
revoke all on function public.escolher_proposta(uuid) from public, anon;
revoke all on function public.radar_pedido(uuid) from public, anon;
revoke all on function public.propostas_do_pedido(uuid) from public, anon;
revoke all on function public.meus_pedidos_radar() from public, anon;
revoke all on function public.minhas_propostas_radar() from public, anon;
revoke all on function public.radar_feed() from public, anon;
revoke all on function public.marcar_notificacoes_lidas(uuid[]) from public, anon;
revoke all on function public.salvar_preferencia_aviso(text, boolean) from public, anon;
revoke all on function public.moderar_radar(text, uuid, text, text) from public, anon;
grant execute on function
  public.criar_pedido_radar(text, text, text, integer, text, uuid, bigint, bigint, text, text, text),
  public.fechar_pedido_radar(uuid, text), public.propor_radar(uuid, uuid, text, bigint, text),
  public.revelar_contato_radar(uuid, uuid, text, bigint, text), public.escolher_proposta(uuid),
  public.radar_pedido(uuid), public.propostas_do_pedido(uuid), public.meus_pedidos_radar(),
  public.minhas_propostas_radar(), public.radar_feed(), public.marcar_notificacoes_lidas(uuid[]),
  public.moderar_radar(text, uuid, text, text), public.salvar_preferencia_aviso(text, boolean)
  to authenticated;

-- pode_enviar_foto foi recriada: mantém as permissões da versão anterior
revoke all on function public.pode_enviar_foto(text) from public, anon;
grant execute on function public.pode_enviar_foto(text) to authenticated, service_role;
