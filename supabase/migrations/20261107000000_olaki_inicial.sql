-- =====================================================================
-- OLAKI ("O L Aqui") · Migração inicial
-- Shopping digital + classificados regionais + Radar de Negócios
-- Postgres 15+/Supabase · Multi-tenant por microrregião (franquias)
-- =====================================================================
-- Princípios:
--  * RLS ligado em TODAS as tabelas. Nada é público por padrão.
--  * Contato do comprador no Radar NUNCA sai numa SELECT comum:
--    só via função revelar_contato_radar(), que exige plano pago e
--    registra o lead (prova de uso + base para cobrar/medir).
--  * Logs de IP, data/hora e user-agent em toda criação/alteração
--    (Marco Civil da Internet, art. 15: guarda mínima de 6 meses).
--  * Documentos de verificação ficam numa tabela sem leitura pública.
-- =====================================================================

create extension if not exists pg_trgm;
create extension if not exists unaccent;

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
create type public.tipo_pessoa      as enum ('pf', 'pj');
create type public.plano_vitrine    as enum ('teste', 'slim', 'full');
create type public.status_vitrine   as enum ('ativa', 'inadimplente', 'suspensa');
create type public.categoria_anuncio as enum ('imovel', 'veiculo', 'movel', 'geral');
create type public.status_anuncio   as enum ('rascunho', 'ativo', 'pausado', 'vendido', 'expirado', 'congelado');
create type public.status_pedido    as enum ('aberto', 'atendido', 'encerrado', 'congelado');
create type public.status_verificacao as enum ('pendente', 'aprovada', 'recusada');

-- ---------------------------------------------------------------------
-- Funções utilitárias
-- ---------------------------------------------------------------------

-- unaccent() não é IMMUTABLE; este wrapper permite usar em índices/colunas geradas.
create or replace function public.sem_acento(texto text)
returns text language sql immutable parallel safe
set search_path = public, extensions
as $$ select public.unaccent('public.unaccent'::regdictionary, coalesce(texto, '')) $$;

-- IP real do cliente vindo do PostgREST/Supabase (cabeçalhos da requisição).
create or replace function public.ip_requisicao()
returns inet language plpgsql stable
as $$
declare
  cab json := nullif(current_setting('request.headers', true), '')::json;
  ip  text;
begin
  ip := coalesce(cab->>'cf-connecting-ip', split_part(cab->>'x-forwarded-for', ',', 1), cab->>'x-real-ip');
  return nullif(trim(ip), '')::inet;
exception when others then
  return null;
end $$;

create or replace function public.user_agent_requisicao()
returns text language sql stable
as $$ select left(nullif(current_setting('request.headers', true), '')::json->>'user-agent', 500) $$;

create or replace function public.tocar_atualizado_em()
returns trigger language plpgsql
as $$ begin new.atualizado_em := now(); return new; end $$;

-- ---------------------------------------------------------------------
-- 0. Microrregiões (tenant / franquia)
-- ---------------------------------------------------------------------
create table public.microrregioes (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),  -- ex.: 'alto-paranaiba'
  nome          text not null,
  uf            char(2) not null,
  cidades       text[] not null default '{}',
  franqueado_id uuid,                                  -- dono da franquia (perfis.id), opcional
  ativa         boolean not null default true,
  criado_em     timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 1. Perfis (1:1 com auth.users)
-- ---------------------------------------------------------------------
create table public.perfis (
  id              uuid primary key references auth.users(id) on delete cascade,
  microrregiao_id uuid not null references public.microrregioes(id),
  nome            text not null check (char_length(nome) between 2 and 120),
  tipo_pessoa     public.tipo_pessoa not null default 'pf',
  whatsapp        text check (whatsapp ~ '^55[1-9][0-9]9?[0-9]{8}$'),   -- E.164 sem '+', ex.: 5534999998888
  cidade          text,
  bairro          text,
  avatar_url      text,
  -- Selos (só o sistema altera; ver trigger proteger_campos_perfil)
  selo_negociador_certificado boolean not null default false,
  e_admin         boolean not null default false,
  aceitou_termos_em  timestamptz,
  versao_termos      text,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  criado_ip       inet default public.ip_requisicao()
);
create index perfis_microrregiao_idx on public.perfis (microrregiao_id);

alter table public.microrregioes
  add constraint microrregioes_franqueado_fk foreign key (franqueado_id) references public.perfis(id) on delete set null;

-- Dados sensíveis de verificação: NUNCA expostos a outros usuários.
create table public.perfis_verificacoes (
  id              uuid primary key default gen_random_uuid(),
  perfil_id       uuid not null references public.perfis(id) on delete cascade,
  tipo            text not null check (tipo in ('documento', 'selfie', 'email', 'telefone', 'cnpj')),
  arquivo_path    text,                    -- caminho no bucket privado 'verificacoes'
  valor_hash      text,                    -- hash do CPF/CNPJ/telefone, nunca o valor puro
  status          public.status_verificacao not null default 'pendente',
  analisado_por   uuid references public.perfis(id),
  analisado_em    timestamptz,
  motivo_recusa   text,
  criado_em       timestamptz not null default now(),
  criado_ip       inet default public.ip_requisicao()
);
create index perfis_verificacoes_perfil_idx on public.perfis_verificacoes (perfil_id);

-- ---------------------------------------------------------------------
-- 2. Vitrines / Lojas (cada anunciante tem a sua)
-- ---------------------------------------------------------------------
create table public.vitrines_lojas (
  id              uuid primary key default gen_random_uuid(),
  dono_id         uuid not null unique references public.perfis(id) on delete cascade,
  microrregiao_id uuid not null references public.microrregioes(id),
  slug            text not null check (slug ~ '^[a-z0-9-]{3,60}$'),     -- olaki.com.br/loja/<slug>
  nome            text not null check (char_length(nome) between 2 and 80),
  descricao       text check (char_length(descricao) <= 600),
  logo_url        text,
  capa_url        text,
  whatsapp        text check (whatsapp ~ '^55[1-9][0-9]9?[0-9]{8}$'),
  cidade          text not null,
  bairro          text,
  cnpj            text check (cnpj ~ '^[0-9]{14}$'),                       -- só PJ; visível só ao dono
  -- Plano e cobrança
  plano           public.plano_vitrine not null default 'teste',
  status          public.status_vitrine not null default 'ativa',
  teste_expira_em timestamptz not null default (now() + interval '30 days'),
  plano_expira_em timestamptz,                                             -- fim do período pago atual
  gateway_cliente_id   text,                                               -- id no Asaas/Stripe/Mercado Pago
  gateway_assinatura_id text,
  selo_loja_verificada boolean not null default false,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  criado_ip       inet default public.ip_requisicao(),
  unique (microrregiao_id, slug)
);
create index vitrines_microrregiao_idx on public.vitrines_lojas (microrregiao_id);

-- Plano pago e em dia? (base do bloqueio do Radar)
create or replace function public.tem_plano_pago(uid uuid default auth.uid())
returns boolean language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.vitrines_lojas v
    where v.dono_id = uid
      and v.plano in ('slim', 'full')
      and v.status = 'ativa'
      and coalesce(v.plano_expira_em, '-infinity') > now()
  )
$$;

-- Limite de anúncios ativos conforme o plano (null = ilimitado; 0 = bloqueado)
create or replace function public.limite_anuncios(v public.vitrines_lojas)
returns integer language sql stable
as $$
  select case
    when v.status <> 'ativa' then 0
    when v.plano = 'full' and coalesce(v.plano_expira_em, '-infinity') > now() then null
    when v.plano = 'slim' and coalesce(v.plano_expira_em, '-infinity') > now() then 10
    when v.plano = 'teste' and v.teste_expira_em > now() then 10
    else 0
  end
$$;

create or replace function public.e_admin(uid uuid default auth.uid())
returns boolean language sql stable security definer
set search_path = public
as $$ select coalesce((select e_admin from public.perfis where id = uid), false) $$;

-- ---------------------------------------------------------------------
-- 3. Anúncios (campos flexíveis por categoria)
-- ---------------------------------------------------------------------
create table public.anuncios (
  id              uuid primary key default gen_random_uuid(),
  vitrine_id      uuid not null references public.vitrines_lojas(id) on delete cascade,
  microrregiao_id uuid not null references public.microrregioes(id),
  categoria       public.categoria_anuncio not null,
  subcategoria    text,                                -- ex.: 'casa', 'moto', 'sofá'
  titulo          text not null check (char_length(titulo) between 5 and 90),
  descricao       text check (char_length(descricao) <= 4000),
  preco_centavos  bigint check (preco_centavos >= 0),  -- null = "a combinar"
  aceita_troca    boolean not null default false,
  cidade          text not null,
  bairro          text,
  fotos           text[] not null default '{}' check (cardinality(fotos) <= 12),
  -- Campos específicos da categoria (validados abaixo). Exemplos:
  --  imovel : {"finalidade":"venda|aluguel","tipo":"casa","quartos":3,"banheiros":2,"vagas":1,"area_m2":120}
  --  veiculo: {"tipo":"carro|moto|caminhao|trator","marca":"Fiat","modelo":"Strada","ano":2021,"km":45000,"cambio":"manual","combustivel":"flex"}
  --  movel  : {"tipo":"sofa","estado":"novo|seminovo|usado","material":"madeira"}
  atributos       jsonb not null default '{}'::jsonb,
  status          public.status_anuncio not null default 'ativo',
  destaque_ate    timestamptz,                         -- futuro: impulsionamento pago
  visualizacoes   integer not null default 0,
  cliques_whatsapp integer not null default 0,
  total_favoritos integer not null default 0,
  busca           tsvector generated always as (
                    setweight(to_tsvector('portuguese', public.sem_acento(titulo)), 'A') ||
                    setweight(to_tsvector('portuguese', public.sem_acento(coalesce(subcategoria, ''))), 'B') ||
                    setweight(to_tsvector('portuguese', public.sem_acento(coalesce(descricao, ''))), 'C')
                  ) stored,
  congelado_motivo text,                               -- compliance jurídico
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  criado_ip       inet default public.ip_requisicao(),
  constraint anuncios_atributos_validos check (
    jsonb_typeof(atributos) = 'object' and
    case categoria
      when 'imovel'  then atributos ? 'finalidade' and atributos->>'finalidade' in ('venda', 'aluguel')
      when 'veiculo' then atributos ? 'tipo' and (not atributos ? 'ano'
                          or (atributos->>'ano') ~ '^(19[5-9][0-9]|20[0-9]{2})$')
      when 'movel'   then not atributos ? 'estado' or atributos->>'estado' in ('novo', 'seminovo', 'usado')
      else true
    end
  )
);

-- Índices pensados para a listagem mobile (região + recentes) e busca rápida
create index anuncios_feed_idx      on public.anuncios (microrregiao_id, status, criado_em desc);
create index anuncios_categoria_idx on public.anuncios (microrregiao_id, categoria, status, preco_centavos);
create index anuncios_vitrine_idx   on public.anuncios (vitrine_id, status);
create index anuncios_busca_idx     on public.anuncios using gin (busca);
create index anuncios_titulo_trgm   on public.anuncios using gin (public.sem_acento(titulo) gin_trgm_ops); -- tolera erro de digitação
create index anuncios_atributos_idx on public.anuncios using gin (atributos jsonb_path_ops);
create index anuncios_veiculo_ano   on public.anuncios (((atributos->>'ano')::int)) where categoria = 'veiculo';

-- Impede passar do limite do plano ou anunciar com teste/plano vencido
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

  select * into v from public.vitrines_lojas where id = new.vitrine_id;
  lim := public.limite_anuncios(v);
  if lim is null then return new; end if;

  select count(*) into ativos from public.anuncios
   where vitrine_id = new.vitrine_id and status = 'ativo' and id <> new.id;

  if ativos >= lim then
    raise exception using
      errcode = 'P0001',
      message = case when lim = 0
                  then 'Seu período grátis ou plano terminou. Escolha o Plano Slim ou Full para continuar anunciando.'
                  else format('Seu plano permite %s anúncios ativos. Assine o Plano Full para anúncios ilimitados.', lim) end;
  end if;
  return new;
end $$;

create trigger anuncios_limite before insert or update of status on public.anuncios
  for each row execute function public.validar_limite_anuncios();

-- Anúncio herda a microrregião da vitrine (evita anúncio "fora" do tenant)
create or replace function public.herdar_microrregiao_anuncio()
returns trigger language plpgsql
as $$
begin
  select microrregiao_id into new.microrregiao_id from public.vitrines_lojas where id = new.vitrine_id;
  return new;
end $$;
create trigger anuncios_microrregiao before insert or update of vitrine_id on public.anuncios
  for each row execute function public.herdar_microrregiao_anuncio();

-- ---------------------------------------------------------------------
-- 4. Radar de Negócios (lista quente invertida)
-- ---------------------------------------------------------------------
create table public.radar_pedidos (
  id              uuid primary key default gen_random_uuid(),
  comprador_id    uuid not null references public.perfis(id) on delete cascade,
  microrregiao_id uuid not null references public.microrregioes(id),
  categoria       public.categoria_anuncio not null default 'geral',
  titulo          text not null check (char_length(titulo) between 8 and 120),  -- "Procuro trator traçado"
  detalhes        text check (char_length(detalhes) <= 1000),
  preco_max_centavos bigint check (preco_max_centavos >= 0),
  cidade          text not null,
  urgencia        text not null default 'normal' check (urgencia in ('normal', 'esta_semana', 'hoje')),
  atributos       jsonb not null default '{}'::jsonb,
  status          public.status_pedido not null default 'aberto',
  max_propostas   integer not null default 10 check (max_propostas between 1 and 50), -- protege o comprador de spam
  total_propostas integer not null default 0,
  expira_em       timestamptz not null default (now() + interval '15 days'),
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  criado_ip       inet default public.ip_requisicao()
);
create index radar_feed_idx on public.radar_pedidos (microrregiao_id, status, criado_em desc);
create index radar_comprador_idx on public.radar_pedidos (comprador_id);

-- Cada "Propor Produto" vira um registro (lead entregue ao lojista)
create table public.radar_propostas (
  id           uuid primary key default gen_random_uuid(),
  pedido_id    uuid not null references public.radar_pedidos(id) on delete cascade,
  vitrine_id   uuid not null references public.vitrines_lojas(id) on delete cascade,
  anuncio_id   uuid references public.anuncios(id) on delete set null,       -- produto oferecido (opcional)
  mensagem     text check (char_length(mensagem) <= 500),
  criado_em    timestamptz not null default now(),
  criado_ip    inet default public.ip_requisicao(),
  unique (pedido_id, vitrine_id)                                              -- 1 proposta por loja
);
create index radar_propostas_vitrine_idx on public.radar_propostas (vitrine_id, criado_em desc);

-- View pública do radar: SEM contato. Mostra só se a loja atual já propôs.
create or replace view public.radar_feed
with (security_invoker = true) as
select p.id, p.microrregiao_id, p.categoria, p.titulo, p.detalhes, p.preco_max_centavos,
       p.cidade, p.urgencia, p.atributos, p.total_propostas, p.max_propostas,
       p.expira_em, p.criado_em,
       pf.selo_negociador_certificado as comprador_certificado,
       split_part(pf.nome, ' ', 1)     as comprador_primeiro_nome,
       exists (select 1 from public.radar_propostas rp
                 join public.vitrines_lojas v on v.id = rp.vitrine_id
                where rp.pedido_id = p.id and v.dono_id = auth.uid()) as ja_propus
from public.radar_pedidos p
join public.perfis pf on pf.id = p.comprador_id
where p.status = 'aberto' and p.expira_em > now();

-- Única porta para o contato do comprador. Exige plano pago, respeita o
-- limite de propostas e registra o lead. Retorna o link do WhatsApp.
create or replace function public.revelar_contato_radar(
  p_pedido_id uuid, p_anuncio_id uuid default null, p_mensagem text default null)
returns table (whatsapp text, mensagem text)
language plpgsql security definer
set search_path = public
as $$
declare
  v_vitrine public.vitrines_lojas;
  v_pedido  public.radar_pedidos;
  v_fone    text;
  v_texto   text;
begin
  if auth.uid() is null then
    raise exception 'Faça login para propor um produto.' using errcode = '28000';
  end if;
  if not public.tem_plano_pago(auth.uid()) then
    raise exception 'O Radar de Negócios é exclusivo dos Planos Slim e Full.' using errcode = '42501';
  end if;

  select * into v_vitrine from public.vitrines_lojas where dono_id = auth.uid();
  select * into v_pedido  from public.radar_pedidos where id = p_pedido_id for update;

  if v_pedido.id is null or v_pedido.status <> 'aberto' or v_pedido.expira_em <= now() then
    raise exception 'Este pedido não está mais aberto.' using errcode = 'P0002';
  end if;
  if v_pedido.microrregiao_id <> v_vitrine.microrregiao_id then
    raise exception 'Este pedido é de outra região.' using errcode = '42501';
  end if;
  if v_pedido.comprador_id = auth.uid() then
    raise exception 'Você não pode propor no seu próprio pedido.' using errcode = 'P0001';
  end if;

  insert into public.radar_propostas (pedido_id, vitrine_id, anuncio_id, mensagem)
  values (p_pedido_id, v_vitrine.id, p_anuncio_id, left(p_mensagem, 500))
  on conflict (pedido_id, vitrine_id) do nothing;

  if found then
    if v_pedido.total_propostas >= v_pedido.max_propostas then
      raise exception 'Este pedido já recebeu o máximo de propostas.' using errcode = 'P0001';
    end if;
    perform set_config('olaki.sistema', '1', true);   -- libera contador protegido
    update public.radar_pedidos set total_propostas = total_propostas + 1 where id = p_pedido_id;
    perform set_config('olaki.sistema', '', true);
  end if;

  select pf.whatsapp into v_fone from public.perfis pf where pf.id = v_pedido.comprador_id;
  v_texto := format('Olá! Vi seu pedido no Radar do OLAKI: "%s". Tenho uma proposta da loja %s.',
                    v_pedido.titulo, v_vitrine.nome);

  return query select v_fone, v_texto;
end $$;

-- ---------------------------------------------------------------------
-- 5. Favoritos
-- ---------------------------------------------------------------------
create table public.favoritos (
  usuario_id  uuid not null references public.perfis(id) on delete cascade,
  anuncio_id  uuid not null references public.anuncios(id) on delete cascade,
  criado_em   timestamptz not null default now(),
  primary key (usuario_id, anuncio_id)
);
create index favoritos_anuncio_idx on public.favoritos (anuncio_id);

create or replace function public.contar_favoritos()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  perform set_config('olaki.sistema', '1', true);
  if tg_op = 'INSERT' then
    update public.anuncios set total_favoritos = total_favoritos + 1 where id = new.anuncio_id;
  else
    update public.anuncios set total_favoritos = greatest(total_favoritos - 1, 0) where id = old.anuncio_id;
  end if;
  perform set_config('olaki.sistema', '', true);
  return null;
end $$;
create trigger favoritos_contador after insert or delete on public.favoritos
  for each row execute function public.contar_favoritos();

-- ---------------------------------------------------------------------
-- 6. Logs de atividade (Marco Civil · compliance jurídico)
-- ---------------------------------------------------------------------
create table public.logs_atividade (
  id           bigint generated always as identity primary key,
  tabela       text not null,
  registro_id  text not null,
  acao         text not null check (acao in ('INSERT', 'UPDATE', 'DELETE')),
  usuario_id   uuid,
  ip           inet,
  user_agent   text,
  dados_antes  jsonb,
  dados_depois jsonb,
  criado_em    timestamptz not null default now()
);
create index logs_registro_idx on public.logs_atividade (tabela, registro_id, criado_em desc);
create index logs_usuario_idx  on public.logs_atividade (usuario_id, criado_em desc);

create or replace function public.registrar_log()
returns trigger language plpgsql security definer
set search_path = public
as $$
declare
  reg jsonb := to_jsonb(coalesce(new, old));
begin
  insert into public.logs_atividade (tabela, registro_id, acao, usuario_id, ip, user_agent, dados_antes, dados_depois)
  values (tg_table_name, reg->>'id', tg_op, auth.uid(), public.ip_requisicao(), public.user_agent_requisicao(),
          case when tg_op <> 'INSERT' then to_jsonb(old) end,
          case when tg_op <> 'DELETE' then to_jsonb(new) end);
  return null;
end $$;

create trigger log_perfis     after insert or update or delete on public.perfis         for each row execute function public.registrar_log();
create trigger log_vitrines   after insert or update or delete on public.vitrines_lojas for each row execute function public.registrar_log();
create trigger log_anuncios   after insert or update or delete on public.anuncios       for each row execute function public.registrar_log();
create trigger log_radar      after insert or update or delete on public.radar_pedidos  for each row execute function public.registrar_log();
create trigger log_propostas  after insert on public.radar_propostas                    for each row execute function public.registrar_log();

-- Atualizado_em automático
create trigger tocar_perfis   before update on public.perfis         for each row execute function public.tocar_atualizado_em();
create trigger tocar_vitrines before update on public.vitrines_lojas for each row execute function public.tocar_atualizado_em();
create trigger tocar_anuncios before update on public.anuncios       for each row execute function public.tocar_atualizado_em();
create trigger tocar_radar    before update on public.radar_pedidos  for each row execute function public.tocar_atualizado_em();

-- ---------------------------------------------------------------------
-- 7. Campos que o usuário NÃO pode alterar sozinho
--    (selos, plano, status de compliance, contadores)
-- ---------------------------------------------------------------------
create or replace function public.proteger_campos_sistema()
returns trigger language plpgsql
as $$
begin
  -- service_role (webhooks de pagamento, painel admin) e admins passam direto
  if coalesce(auth.role(), 'service_role') = 'service_role' or public.e_admin()
     or current_setting('olaki.sistema', true) = '1' then
    return new;
  end if;

  if tg_table_name = 'perfis' then
    new.selo_negociador_certificado := old.selo_negociador_certificado;
    new.e_admin := old.e_admin;
    new.microrregiao_id := old.microrregiao_id;
  elsif tg_table_name = 'vitrines_lojas' then
    new.plano := old.plano;  new.status := old.status;
    new.teste_expira_em := old.teste_expira_em;  new.plano_expira_em := old.plano_expira_em;
    new.selo_loja_verificada := old.selo_loja_verificada;
    new.gateway_cliente_id := old.gateway_cliente_id;  new.gateway_assinatura_id := old.gateway_assinatura_id;
    new.microrregiao_id := old.microrregiao_id;
  elsif tg_table_name = 'anuncios' then
    if old.status = 'congelado' then
      raise exception 'Anúncio congelado pelo Compliance. Fale com o suporte.' using errcode = '42501';
    end if;
    if new.status = 'congelado' then new.status := old.status; end if;
    new.visualizacoes := old.visualizacoes;  new.cliques_whatsapp := old.cliques_whatsapp;
    new.total_favoritos := old.total_favoritos;  new.destaque_ate := old.destaque_ate;
    new.congelado_motivo := old.congelado_motivo;
  elsif tg_table_name = 'radar_pedidos' then
    if old.status = 'congelado' then
      raise exception 'Pedido congelado pelo Compliance.' using errcode = '42501';
    end if;
    if new.status = 'congelado' then new.status := old.status; end if;
    new.total_propostas := old.total_propostas;
    new.microrregiao_id := old.microrregiao_id;
  end if;
  return new;
end $$;

create trigger proteger_perfis   before update on public.perfis         for each row execute function public.proteger_campos_sistema();
create trigger proteger_vitrines before update on public.vitrines_lojas for each row execute function public.proteger_campos_sistema();
create trigger proteger_anuncios before update on public.anuncios       for each row execute function public.proteger_campos_sistema();
create trigger proteger_radar    before update on public.radar_pedidos  for each row execute function public.proteger_campos_sistema();

-- ---------------------------------------------------------------------
-- 8. Row Level Security
-- ---------------------------------------------------------------------
alter table public.microrregioes       enable row level security;
alter table public.perfis              enable row level security;
alter table public.perfis_verificacoes enable row level security;
alter table public.vitrines_lojas      enable row level security;
alter table public.anuncios            enable row level security;
alter table public.radar_pedidos       enable row level security;
alter table public.radar_propostas     enable row level security;
alter table public.favoritos           enable row level security;
alter table public.logs_atividade      enable row level security;  -- sem policies: só service_role lê

-- Microrregiões: leitura pública das ativas
create policy "microrregioes leitura" on public.microrregioes
  for select using (ativa or public.e_admin());

-- Perfis: cada um vê e edita o seu. Dados públicos do vendedor saem pela vitrine.
create policy "perfil proprio leitura" on public.perfis
  for select using (id = auth.uid() or public.e_admin());
create policy "perfil proprio criar" on public.perfis
  for insert with check (id = auth.uid() and selo_negociador_certificado = false and e_admin = false);
create policy "perfil proprio editar" on public.perfis
  for update using (id = auth.uid()) with check (id = auth.uid());

-- Verificações: só o dono envia e acompanha; análise via service_role/admin
create policy "verificacao propria leitura" on public.perfis_verificacoes
  for select using (perfil_id = auth.uid() or public.e_admin());
create policy "verificacao propria envio" on public.perfis_verificacoes
  for insert with check (perfil_id = auth.uid() and status = 'pendente');

-- Vitrines: públicas quando ativas (cnpj e gateway ficam fora via view abaixo)
create policy "vitrines leitura publica" on public.vitrines_lojas
  for select using (status = 'ativa' or dono_id = auth.uid() or public.e_admin());
create policy "vitrine propria criar" on public.vitrines_lojas
  for insert with check (dono_id = auth.uid() and plano = 'teste' and selo_loja_verificada = false);
create policy "vitrine propria editar" on public.vitrines_lojas
  for update using (dono_id = auth.uid()) with check (dono_id = auth.uid());

-- Anúncios: públicos quando ativos/vendidos; dono vê todos os seus
create policy "anuncios leitura publica" on public.anuncios
  for select using (
    status in ('ativo', 'vendido')
    or exists (select 1 from public.vitrines_lojas v where v.id = vitrine_id and v.dono_id = auth.uid())
    or public.e_admin());
create policy "anuncio proprio criar" on public.anuncios
  for insert with check (
    exists (select 1 from public.vitrines_lojas v where v.id = vitrine_id and v.dono_id = auth.uid())
    and status <> 'congelado');
create policy "anuncio proprio editar" on public.anuncios
  for update using (exists (select 1 from public.vitrines_lojas v where v.id = vitrine_id and v.dono_id = auth.uid()))
  with check (exists (select 1 from public.vitrines_lojas v where v.id = vitrine_id and v.dono_id = auth.uid()));
create policy "anuncio proprio excluir" on public.anuncios
  for delete using (exists (select 1 from public.vitrines_lojas v where v.id = vitrine_id and v.dono_id = auth.uid()));

-- Radar: qualquer logado lê os abertos (pela view, sem contato). Comprador gerencia os seus.
create policy "radar leitura" on public.radar_pedidos
  for select using (
    (auth.uid() is not null and status = 'aberto' and expira_em > now())
    or comprador_id = auth.uid() or public.e_admin());
create policy "radar criar" on public.radar_pedidos
  for insert with check (comprador_id = auth.uid() and status = 'aberto' and total_propostas = 0);
create policy "radar editar proprio" on public.radar_pedidos
  for update using (comprador_id = auth.uid()) with check (comprador_id = auth.uid());

-- Propostas: lojista vê as suas; comprador vê as recebidas. Inserção só pela função.
create policy "propostas leitura" on public.radar_propostas
  for select using (
    exists (select 1 from public.vitrines_lojas v where v.id = vitrine_id and v.dono_id = auth.uid())
    or exists (select 1 from public.radar_pedidos p where p.id = pedido_id and p.comprador_id = auth.uid())
    or public.e_admin());

-- Favoritos: só os próprios
create policy "favoritos proprios" on public.favoritos
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- O perfil do comprador é privado, mas a view radar_feed precisa do primeiro nome
-- e do selo. Liberamos só essas colunas via grant de coluna + policy específica.
create policy "perfil comprador no radar" on public.perfis
  for select using (
    auth.uid() is not null and exists (
      select 1 from public.radar_pedidos p
      where p.comprador_id = perfis.id and p.status = 'aberto' and p.expira_em > now()));

-- Colunas sensíveis: revoga e devolve só o necessário (defesa em profundidade)
revoke select on public.perfis from anon, authenticated;
grant select (id, microrregiao_id, nome, tipo_pessoa, cidade, bairro, avatar_url,
              selo_negociador_certificado, criado_em) on public.perfis to authenticated;
-- O próprio usuário lê o seu whatsapp pela função abaixo
create or replace function public.meu_perfil()
returns setof public.perfis language sql stable security definer
set search_path = public
as $$ select * from public.perfis where id = auth.uid() $$;

revoke select on public.vitrines_lojas from anon, authenticated;
grant select (id, dono_id, microrregiao_id, slug, nome, descricao, logo_url, capa_url, whatsapp,
              cidade, bairro, plano, status, teste_expira_em, plano_expira_em,
              selo_loja_verificada, criado_em) on public.vitrines_lojas to anon, authenticated;

revoke all on public.radar_propostas from anon, authenticated;
grant select on public.radar_propostas to authenticated;
revoke all on public.logs_atividade from anon, authenticated;
revoke all on function public.revelar_contato_radar(uuid, uuid, text) from public, anon;
grant execute on function public.revelar_contato_radar(uuid, uuid, text) to authenticated;
grant select on public.radar_feed to authenticated;

-- ---------------------------------------------------------------------
-- 9. Compliance: congelar conteúdo (uso do painel admin / service_role)
-- ---------------------------------------------------------------------
create or replace function public.congelar_anuncio(p_anuncio_id uuid, p_motivo text)
returns void language plpgsql security definer
set search_path = public
as $$
begin
  if not public.e_admin() then raise exception 'Apenas o Compliance pode congelar.' using errcode = '42501'; end if;
  update public.anuncios set status = 'congelado', congelado_motivo = p_motivo where id = p_anuncio_id;
end $$;

-- Expira testes, pedidos e anúncios (agendar com pg_cron: select cron.schedule('olaki-expirar','15 3 * * *','select public.expirar_rotina()');)
create or replace function public.expirar_rotina()
returns void language plpgsql security definer
set search_path = public
as $$
begin
  update public.radar_pedidos set status = 'encerrado' where status = 'aberto' and expira_em <= now();
  -- Teste/plano vencido: pausa o excedente (mantém os 0 mais recentes = pausa tudo até assinar)
  update public.anuncios a set status = 'pausado'
    from public.vitrines_lojas v
   where a.vitrine_id = v.id and a.status = 'ativo' and public.limite_anuncios(v) = 0;
end $$;
