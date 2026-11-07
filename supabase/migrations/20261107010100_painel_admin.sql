-- =====================================================================
-- OLAKI · Migração 2: tudo gerenciável pelo Painel Administrativo
-- Decisões da entrevista de 07/11/2026:
--  1. Teste grátis tem algumas propostas no Radar (quantidade no painel)
--  2. Pessoa física: poucos itens grátis + anúncio avulso pago
--  3. Comprador escolhe no pedido: WhatsApp direto OU propostas com prazo
--  4. Comprador posta no Radar só confirmando o WhatsApp (código)
--  5. Cobrança pelo Asaas
--  6. Piloto: Corrente-PI + extremo sul do PI + Formosa do Rio Preto-BA
--  7. Repasse do franqueado: decidir depois (campo já existe)
--  8. Moderação: publica na hora + filtro automático + denúncias
-- Nenhum preço, limite ou regra fica no código: tudo vem de `planos`
-- e `configuracoes`, editáveis pelo painel.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Microrregião com cidades de mais de um estado + repasse da franquia
-- ---------------------------------------------------------------------
alter table public.microrregioes drop column uf;
alter table public.microrregioes drop column cidades;
alter table public.microrregioes
  add column cidade_sede          text,
  add column repasse_percentual   numeric(5,2) check (repasse_percentual between 0 and 100), -- null = sem franqueado
  add column observacoes          text;

create table public.cidades (
  id              uuid primary key default gen_random_uuid(),
  microrregiao_id uuid not null references public.microrregioes(id) on delete cascade,
  nome            text not null,
  uf              char(2) not null,
  codigo_ibge     integer unique,
  ativa           boolean not null default true,
  unique (microrregiao_id, nome, uf)
);
alter table public.cidades enable row level security;
create policy "cidades leitura" on public.cidades for select using (true);
create policy "cidades admin" on public.cidades for all using (public.e_admin()) with check (public.e_admin());

-- ---------------------------------------------------------------------
-- 2. Planos (preço, limites e Radar definidos no painel)
-- ---------------------------------------------------------------------
create table public.planos (
  codigo                 text primary key check (codigo ~ '^[a-z0-9_]{2,30}$'),
  nome                   text not null,
  descricao              text,
  publico                text not null default 'todos' check (publico in ('pf', 'pj', 'todos')),
  preco_centavos         integer not null default 0 check (preco_centavos >= 0),
  periodo_dias           integer not null default 30 check (periodo_dias > 0),
  limite_anuncios        integer check (limite_anuncios >= 0),          -- null = ilimitado
  acesso_radar           boolean not null default false,
  propostas_radar_mes    integer check (propostas_radar_mes >= 0),      -- null = ilimitado
  e_teste                boolean not null default false,
  ordem                  integer not null default 0,
  ativo                  boolean not null default true,
  asaas_descricao        text,
  atualizado_em          timestamptz not null default now(),
  atualizado_por         text references public.perfis(id)
);
alter table public.planos enable row level security;
create policy "planos leitura" on public.planos for select using (ativo or public.e_admin());
create policy "planos admin"   on public.planos for all using (public.e_admin()) with check (public.e_admin());

-- Valores iniciais (todos editáveis no painel)
insert into public.planos (codigo, nome, publico, preco_centavos, periodo_dias, limite_anuncios, acesso_radar, propostas_radar_mes, e_teste, ordem, descricao) values
  ('teste',     'Teste grátis',  'todos', 0,    30, 10,   true,  3,    true,  0, '30 dias grátis com até 10 anúncios e algumas propostas no Radar'),
  ('pf_gratis', 'Grátis (PF)',   'pf',    0,    30, 3,    false, 0,    false, 1, 'Pessoa física anuncia poucos itens sem pagar'),
  ('slim',      'Plano Slim',    'todos', 4990, 30, 10,   true,  null, false, 2, 'Até 10 anúncios + Radar de Negócios'),
  ('full',      'Plano Full',    'todos', 9900, 30, null, true,  null, false, 3, 'Anúncios ilimitados + Radar de Negócios');

-- A vitrine passa a apontar para a tabela de planos (sai o enum fixo)
drop policy "vitrine propria criar" on public.vitrines_lojas;
alter table public.vitrines_lojas alter column plano drop default;
alter table public.vitrines_lojas alter column plano type text using plano::text;
alter table public.vitrines_lojas alter column plano set default 'teste';
alter table public.vitrines_lojas add constraint vitrines_plano_fk foreign key (plano) references public.planos(codigo);
drop type public.plano_vitrine;
create policy "vitrine propria criar" on public.vitrines_lojas
  for insert with check (dono_id = public.usuario_id() and plano = 'teste' and selo_loja_verificada = false);

-- ---------------------------------------------------------------------
-- 3. Configurações gerais (chave → valor), com override por microrregião
-- ---------------------------------------------------------------------
create table public.configuracoes (
  id              uuid primary key default gen_random_uuid(),
  chave           text not null check (chave ~ '^[a-z0-9_.]{3,80}$'),
  microrregiao_id uuid references public.microrregioes(id) on delete cascade, -- null = vale para todas
  valor           jsonb not null,
  descricao       text,
  grupo           text not null default 'geral',      -- organiza as abas do painel
  publico         boolean not null default false,     -- true = o site pode ler sem login
  atualizado_em   timestamptz not null default now(),
  atualizado_por  text references public.perfis(id)
);
create unique index configuracoes_chave_regiao on public.configuracoes (chave, coalesce(microrregiao_id, '00000000-0000-0000-0000-000000000000'));
alter table public.configuracoes enable row level security;
create policy "config leitura publica" on public.configuracoes for select using (publico or public.e_admin());
create policy "config admin" on public.configuracoes for all using (public.e_admin()) with check (public.e_admin());

-- Lê uma configuração: primeiro a da região, depois a global, depois o padrão
create or replace function public.config(p_chave text, p_microrregiao uuid default null, p_padrao jsonb default null)
returns jsonb language sql stable security definer
set search_path = public
as $$
  select coalesce(
    (select valor from public.configuracoes where chave = p_chave and microrregiao_id = p_microrregiao),
    (select valor from public.configuracoes where chave = p_chave and microrregiao_id is null),
    p_padrao)
$$;

insert into public.configuracoes (chave, valor, grupo, publico, descricao) values
  ('teste.dias',                     '30',     'planos',    true,  'Dias de teste grátis para novas vitrines'),
  ('pf.plano_apos_teste',            '"pf_gratis"', 'planos', false, 'Plano que a pessoa física recebe quando o teste acaba sem assinar'),
  ('avulso.preco_centavos',          '990',    'planos',    true,  'Preço do anúncio avulso (pessoa física)'),
  ('avulso.dias',                    '30',     'planos',    true,  'Dias que o anúncio avulso fica no ar'),
  ('destaque.preco_centavos',        '1490',   'planos',    true,  'Preço para destacar um anúncio'),
  ('destaque.dias',                  '7',      'planos',    true,  'Dias de destaque'),
  ('radar.max_propostas_padrao',     '10',     'radar',     false, 'Máximo de lojas que podem propor em cada pedido'),
  ('radar.dias_pedido',              '15',     'radar',     true,  'Dias que um pedido fica aberto'),
  ('radar.prazos_horas',             '[24, 72, 168]', 'radar', true, 'Prazos que o comprador pode escolher no modo "propostas com prazo"'),
  ('moderacao.palavras_bloqueadas',  '["arma", "pistola", "revolver", "droga", "maconha", "cocaina", "medicamento controlado", "cnh falsa", "documento falso", "pix antecipado"]', 'moderacao', false, 'Palavras que seguram o anúncio para revisão'),
  ('moderacao.preco_max_centavos',   '{"veiculo": 500000000, "imovel": 2000000000, "movel": 10000000, "geral": 20000000}', 'moderacao', false, 'Acima disso o anúncio vai para revisão (centavos)'),
  ('moderacao.preco_min_centavos',   '{"veiculo": 100000, "imovel": 500000}', 'moderacao', false, 'Abaixo disso o anúncio vai para revisão (golpe de preço baixo)'),
  ('moderacao.denuncias_para_ocultar', '3',    'moderacao', false, 'Número de denúncias que tira o anúncio do ar até revisão'),
  ('asaas.ambiente',                 '"sandbox"', 'cobranca', false, 'sandbox ou producao (a chave da API fica em variável de ambiente, nunca aqui)'),
  ('contato.whatsapp_suporte',       'null',   'geral',     true,  'WhatsApp do suporte OLAKI'),
  ('compliance.email',               'null',   'geral',     true,  'E-mail do canal de Compliance Jurídico');

-- ---------------------------------------------------------------------
-- 4. Regras de plano lidas do banco (substituem as funções fixas)
-- ---------------------------------------------------------------------

-- Plano que vale AGORA para a vitrine (considera teste vencido, inadimplência e PF)
create or replace function public.plano_efetivo(v public.vitrines_lojas)
returns public.planos language plpgsql stable security definer
set search_path = public
as $$
declare
  p    public.planos;
  tipo public.tipo_pessoa;
begin
  select * into p from public.planos where codigo = v.plano;
  if v.status = 'ativa' and (
       (p.e_teste and v.teste_expira_em > now())
    or (not p.e_teste and p.preco_centavos > 0 and coalesce(v.plano_expira_em, '-infinity') > now())
    or (not p.e_teste and p.preco_centavos = 0)) then
    return p;
  end if;
  -- venceu: pessoa física cai no plano grátis; empresa fica sem plano
  select tipo_pessoa into tipo from public.perfis where id = v.dono_id;
  if tipo = 'pf' and v.status <> 'suspensa' then
    select * into p from public.planos where codigo = public.config('pf.plano_apos_teste', v.microrregiao_id, '"pf_gratis"') #>> '{}';
    return p;
  end if;
  return null;
end $$;

create or replace function public.limite_anuncios(v public.vitrines_lojas)
returns integer language plpgsql stable security definer
set search_path = public
as $$
declare p public.planos := public.plano_efetivo(v);
begin
  if p.codigo is null then return 0; end if;
  return p.limite_anuncios;   -- null = ilimitado
end $$;

-- Acesso ao Radar: plano pago em dia OU teste com propostas sobrando
create or replace function public.tem_plano_pago(uid text default public.usuario_id())
returns boolean language sql stable security definer
set search_path = public
as $$
  select coalesce((
    select (public.plano_efetivo(v)).acesso_radar
      from public.vitrines_lojas v where v.dono_id = uid), false)
$$;

-- Propostas que a vitrine ainda pode fazer no mês (null = ilimitado)
create or replace function public.propostas_restantes(uid text default public.usuario_id())
returns integer language plpgsql stable security definer
set search_path = public
as $$
declare
  v public.vitrines_lojas;
  p public.planos;
  usadas integer;
begin
  select * into v from public.vitrines_lojas where dono_id = uid;
  if v.id is null then return 0; end if;
  p := public.plano_efetivo(v);
  if p.codigo is null or not p.acesso_radar then return 0; end if;
  if p.propostas_radar_mes is null then return null; end if;
  select count(*) into usadas from public.radar_propostas
   where vitrine_id = v.id
     and criado_em >= case when p.e_teste then v.criado_em else date_trunc('month', now()) end;
  return greatest(p.propostas_radar_mes - usadas, 0);
end $$;

-- ---------------------------------------------------------------------
-- 5. Anúncio avulso (PF) e destaque pagos
-- ---------------------------------------------------------------------
alter table public.anuncios
  add column pago_ate        timestamptz,   -- anúncio avulso pago: não conta no limite do plano
  add column motivo_analise  text;

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

  select * into v from public.vitrines_lojas where id = new.vitrine_id;
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

-- Pagamentos (Asaas). Só o webhook (service_role) escreve.
create table public.pagamentos (
  id                  uuid primary key default gen_random_uuid(),
  vitrine_id          uuid not null references public.vitrines_lojas(id) on delete restrict,
  microrregiao_id     uuid not null references public.microrregioes(id),
  tipo                text not null check (tipo in ('assinatura', 'anuncio_avulso', 'destaque')),
  plano_codigo        text references public.planos(codigo),
  anuncio_id          uuid references public.anuncios(id) on delete set null,
  valor_centavos      integer not null check (valor_centavos >= 0),
  forma               text check (forma in ('pix', 'boleto', 'cartao')),
  status              text not null default 'pendente' check (status in ('pendente', 'pago', 'vencido', 'estornado', 'cancelado')),
  vencimento          date,
  pago_em             timestamptz,
  asaas_cobranca_id   text unique,
  asaas_assinatura_id text,
  link_pagamento      text,
  repasse_percentual  numeric(5,2),             -- foto do repasse da região no momento do pagamento
  payload             jsonb,                    -- último evento recebido do Asaas
  criado_em           timestamptz not null default now()
);
create index pagamentos_vitrine_idx on public.pagamentos (vitrine_id, criado_em desc);
create index pagamentos_regiao_idx  on public.pagamentos (microrregiao_id, status, pago_em);
alter table public.pagamentos enable row level security;
create policy "pagamentos leitura" on public.pagamentos for select using (
  exists (select 1 from public.vitrines_lojas v where v.id = vitrine_id and v.dono_id = public.usuario_id()) or public.e_admin());

-- Webhook do Asaas chama isto (service_role) quando um pagamento é confirmado
create or replace function public.confirmar_pagamento(p_asaas_cobranca_id text, p_payload jsonb default null)
returns void language plpgsql security definer
set search_path = public
as $$
declare
  pg public.pagamentos;
  pl public.planos;
  dias integer;
begin
  update public.pagamentos set status = 'pago', pago_em = now(), payload = coalesce(p_payload, payload)
   where asaas_cobranca_id = p_asaas_cobranca_id and status <> 'pago'
  returning * into pg;
  if pg.id is null then return; end if;   -- já processado (webhook repetido)

  perform set_config('olaki.sistema', '1', true);
  if pg.tipo = 'assinatura' then
    select * into pl from public.planos where codigo = pg.plano_codigo;
    update public.vitrines_lojas
       set plano = pl.codigo, status = 'ativa',
           plano_expira_em = greatest(coalesce(plano_expira_em, now()), now()) + make_interval(days => pl.periodo_dias)
     where id = pg.vitrine_id;
  elsif pg.tipo = 'anuncio_avulso' then
    dias := (public.config('avulso.dias', pg.microrregiao_id, '30'))::int;
    update public.anuncios set pago_ate = greatest(coalesce(pago_ate, now()), now()) + make_interval(days => dias), status = 'ativo'
     where id = pg.anuncio_id and status in ('rascunho', 'pausado', 'expirado', 'ativo');
  elsif pg.tipo = 'destaque' then
    dias := (public.config('destaque.dias', pg.microrregiao_id, '7'))::int;
    update public.anuncios set destaque_ate = greatest(coalesce(destaque_ate, now()), now()) + make_interval(days => dias)
     where id = pg.anuncio_id;
  end if;
  perform set_config('olaki.sistema', '', true);
end $$;
revoke all on function public.confirmar_pagamento(text, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 6. Radar: comprador escolhe o modo + confirmação do WhatsApp
-- ---------------------------------------------------------------------
alter table public.radar_pedidos
  add column modo_contato text not null default 'whatsapp_direto'
    check (modo_contato in ('whatsapp_direto', 'propostas_prazo')),
  add column propostas_ate timestamptz,          -- fim do prazo no modo propostas_prazo
  add column resumo_enviado_em timestamptz,      -- quando o resumo das ofertas foi mandado ao comprador
  add column motivo_analise text;

alter table public.radar_propostas
  add column preco_centavos bigint check (preco_centavos >= 0),
  add column foto_url       text,
  add column escolhida      boolean not null default false;   -- comprador marcou "quero falar com esta loja"

-- Comprador confirmou o celular? (o Clerk confirma por código; o servidor grava
-- perfis.whatsapp_verificado_em a partir dos dados do Clerk, nunca o navegador)
create or replace function public.whatsapp_confirmado(uid text default public.usuario_id())
returns boolean language sql stable security definer
set search_path = public
as $$ select exists (select 1 from public.perfis p where p.id = uid and p.whatsapp is not null and p.whatsapp_verificado_em is not null) $$;

drop policy "radar criar" on public.radar_pedidos;
create policy "radar criar" on public.radar_pedidos
  for insert with check (
    comprador_id = public.usuario_id() and status in ('aberto', 'em_analise')   -- em_analise: o filtro automático segurou
    and total_propostas = 0
    and public.whatsapp_confirmado()
    and (modo_contato = 'whatsapp_direto' or propostas_ate > now()));

-- Padrões do pedido vindos do painel
create or replace function public.padroes_pedido()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  new.max_propostas := coalesce((public.config('radar.max_propostas_padrao', new.microrregiao_id, '10'))::int, new.max_propostas);
  new.expira_em := now() + make_interval(days => (public.config('radar.dias_pedido', new.microrregiao_id, '15'))::int);
  if new.modo_contato = 'propostas_prazo' and new.propostas_ate > new.expira_em then
    new.propostas_ate := new.expira_em;
  end if;
  return new;
end $$;
create trigger radar_padroes before insert on public.radar_pedidos
  for each row execute function public.padroes_pedido();

-- Nova versão: respeita o modo escolhido pelo comprador e o limite do teste
drop function public.revelar_contato_radar(uuid, uuid, text);
create or replace function public.revelar_contato_radar(
  p_pedido_id uuid, p_anuncio_id uuid default null, p_mensagem text default null,
  p_preco_centavos bigint default null, p_foto_url text default null)
returns table (modo text, whatsapp text, mensagem text)
language plpgsql security definer
set search_path = public
as $$
declare
  v_vitrine public.vitrines_lojas;
  v_pedido  public.radar_pedidos;
  v_fone    text;
  v_rest    integer;
begin
  if public.usuario_id() is null then
    raise exception 'Faça login para propor um produto.' using errcode = '28000';
  end if;
  if not public.tem_plano_pago(public.usuario_id()) then
    raise exception 'O Radar de Negócios é exclusivo dos planos com Radar.' using errcode = '42501';
  end if;

  select * into v_vitrine from public.vitrines_lojas where dono_id = public.usuario_id();
  select * into v_pedido  from public.radar_pedidos where id = p_pedido_id for update;

  if v_pedido.id is null or v_pedido.status <> 'aberto' or v_pedido.expira_em <= now() then
    raise exception 'Este pedido não está mais aberto.' using errcode = 'P0002';
  end if;
  if v_pedido.modo_contato = 'propostas_prazo' and v_pedido.propostas_ate <= now() then
    raise exception 'O prazo para propostas deste pedido já acabou.' using errcode = 'P0002';
  end if;
  if v_pedido.microrregiao_id <> v_vitrine.microrregiao_id then
    raise exception 'Este pedido é de outra região.' using errcode = '42501';
  end if;
  if v_pedido.comprador_id = public.usuario_id() then
    raise exception 'Você não pode propor no seu próprio pedido.' using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.radar_propostas where pedido_id = p_pedido_id and vitrine_id = v_vitrine.id) then
    v_rest := public.propostas_restantes(public.usuario_id());
    if v_rest is not null and v_rest <= 0 then
      raise exception 'Você usou todas as propostas do seu plano. Assine um plano maior para continuar.' using errcode = '42501';
    end if;
    if v_pedido.total_propostas >= v_pedido.max_propostas then
      raise exception 'Este pedido já recebeu o máximo de propostas.' using errcode = 'P0001';
    end if;
    insert into public.radar_propostas (pedido_id, vitrine_id, anuncio_id, mensagem, preco_centavos, foto_url)
    values (p_pedido_id, v_vitrine.id, p_anuncio_id, left(p_mensagem, 500), p_preco_centavos, p_foto_url);
    perform set_config('olaki.sistema', '1', true);
    update public.radar_pedidos set total_propostas = total_propostas + 1 where id = p_pedido_id;
    perform set_config('olaki.sistema', '', true);
  elsif v_pedido.modo_contato = 'propostas_prazo' then
    -- no modo prazo, a loja pode atualizar a própria oferta
    update public.radar_propostas
       set mensagem = coalesce(left(p_mensagem, 500), mensagem),
           preco_centavos = coalesce(p_preco_centavos, preco_centavos),
           foto_url = coalesce(p_foto_url, foto_url), anuncio_id = coalesce(p_anuncio_id, anuncio_id)
     where pedido_id = p_pedido_id and vitrine_id = v_vitrine.id;
  end if;

  if v_pedido.modo_contato = 'propostas_prazo' then
    -- comprador não quer ser chamado: a oferta fica guardada e ele recebe o resumo no fim do prazo
    return query select 'propostas_prazo'::text, null::text,
      format('Proposta enviada! O comprador recebe todas as ofertas em %s e escolhe com quem falar.',
             to_char(v_pedido.propostas_ate at time zone 'America/Fortaleza', 'DD/MM "às" HH24:MI'));
    return;
  end if;

  select pf.whatsapp into v_fone from public.perfis pf where pf.id = v_pedido.comprador_id;
  return query select 'whatsapp_direto'::text, v_fone,
    format('Olá! Vi seu pedido no Radar do OLAKI: "%s". Tenho uma proposta da loja %s.', v_pedido.titulo, v_vitrine.nome);
end $$;
revoke all on function public.revelar_contato_radar(uuid, uuid, text, bigint, text) from public, anon;
grant execute on function public.revelar_contato_radar(uuid, uuid, text, bigint, text) to authenticated;

-- Comprador escolhe a loja (modo prazo) e recebe o WhatsApp dela
create or replace function public.escolher_proposta(p_proposta_id uuid)
returns table (whatsapp text, mensagem text)
language plpgsql security definer
set search_path = public
as $$
declare
  rp public.radar_propostas;
  v  public.vitrines_lojas;
  p  public.radar_pedidos;
begin
  select * into rp from public.radar_propostas where id = p_proposta_id;
  select * into p  from public.radar_pedidos where id = rp.pedido_id;
  if p.comprador_id is distinct from public.usuario_id() then
    raise exception 'Esta proposta não é do seu pedido.' using errcode = '42501';
  end if;
  select * into v from public.vitrines_lojas where id = rp.vitrine_id;
  update public.radar_propostas set escolhida = true where id = p_proposta_id;
  return query select v.whatsapp, format('Olá, %s! Vi sua proposta no Radar do OLAKI para "%s".', v.nome, p.titulo);
end $$;
revoke all on function public.escolher_proposta(uuid) from public, anon;
grant execute on function public.escolher_proposta(uuid) to authenticated;

-- A view do Radar ganha o modo e o prazo
drop view public.radar_feed;
create view public.radar_feed
with (security_invoker = true) as
select p.id, p.microrregiao_id, p.categoria, p.titulo, p.detalhes, p.preco_max_centavos,
       p.cidade, p.urgencia, p.atributos, p.total_propostas, p.max_propostas,
       p.modo_contato, p.propostas_ate, p.expira_em, p.criado_em,
       pf.selo_negociador_certificado as comprador_certificado,
       split_part(pf.nome, ' ', 1)     as comprador_primeiro_nome,
       exists (select 1 from public.radar_propostas rp
                 join public.vitrines_lojas v on v.id = rp.vitrine_id
                where rp.pedido_id = p.id and v.dono_id = public.usuario_id()) as ja_propus
from public.radar_pedidos p
join public.perfis pf on pf.id = p.comprador_id
where p.status = 'aberto' and p.expira_em > now()
  and (p.modo_contato = 'whatsapp_direto' or p.propostas_ate > now());
grant select on public.radar_feed to authenticated;

-- ---------------------------------------------------------------------
-- 7. Moderação: filtro automático + denúncias
-- ---------------------------------------------------------------------
create or replace function public.filtro_moderacao()
returns trigger language plpgsql security definer
set search_path = public
as $$
declare
  texto   text;
  palavra text;
  preco   bigint;
  maxp    bigint;
  minp    bigint;
  cat     text := new.categoria::text;
begin
  if current_setting('olaki.sistema', true) = '1' or public.e_admin() then return new; end if;

  if tg_table_name = 'anuncios' then
    texto := public.sem_acento(lower(new.titulo || ' ' || coalesce(new.descricao, '')));
    preco := new.preco_centavos;
  else
    texto := public.sem_acento(lower(new.titulo || ' ' || coalesce(new.detalhes, '')));
    preco := null;   -- no Radar o preço é o teto do comprador, não filtramos
  end if;

  for palavra in select jsonb_array_elements_text(public.config('moderacao.palavras_bloqueadas', new.microrregiao_id, '[]')) loop
    if texto ~ ('\m' || public.sem_acento(lower(palavra)) || '\M') then
      new.status := 'em_analise';
      new.motivo_analise := format('Palavra bloqueada: "%s"', palavra);
      return new;
    end if;
  end loop;

  if preco is not null then
    maxp := (public.config('moderacao.preco_max_centavos', new.microrregiao_id, '{}') ->> cat)::bigint;
    minp := (public.config('moderacao.preco_min_centavos', new.microrregiao_id, '{}') ->> cat)::bigint;
    if (maxp is not null and preco > maxp) or (minp is not null and preco > 0 and preco < minp) then
      new.status := 'em_analise';
      new.motivo_analise := 'Preço fora do normal para a categoria';
    end if;
  end if;
  return new;
end $$;

create trigger anuncios_moderacao before insert or update of titulo, descricao, preco_centavos on public.anuncios
  for each row when (new.status = 'ativo') execute function public.filtro_moderacao();
create trigger radar_moderacao before insert or update of titulo, detalhes on public.radar_pedidos
  for each row when (new.status = 'aberto') execute function public.filtro_moderacao();

-- O dono não pode tirar o próprio anúncio/pedido da análise, nem mexer no pago_ate
create or replace function public.proteger_campos_v2()
returns trigger language plpgsql
as $$
begin
  if coalesce(auth.role(), 'service_role') = 'service_role' or public.e_admin()
     or current_setting('olaki.sistema', true) = '1' then
    return new;
  end if;
  if old.status = 'em_analise' and new.status is distinct from old.status then
    raise exception 'Este conteúdo está em análise pela equipe OLAKI.' using errcode = '42501';
  end if;
  if tg_table_name = 'anuncios' then
    new.pago_ate := old.pago_ate;
  else
    new.resumo_enviado_em := old.resumo_enviado_em;
  end if;
  new.motivo_analise := case when new.status = 'em_analise' then new.motivo_analise else old.motivo_analise end;
  return new;
end $$;
create trigger proteger_anuncios_v2 before update on public.anuncios      for each row execute function public.proteger_campos_v2();
create trigger proteger_radar_v2    before update on public.radar_pedidos for each row execute function public.proteger_campos_v2();

create table public.denuncias (
  id             uuid primary key default gen_random_uuid(),
  alvo_tipo      text not null check (alvo_tipo in ('anuncio', 'pedido', 'vitrine')),
  alvo_id        uuid not null,
  denunciante_id text references public.perfis(id) on delete set null,
  motivo         text not null check (motivo in ('golpe', 'proibido', 'falso', 'ofensivo', 'duplicado', 'outro')),
  detalhes       text check (char_length(detalhes) <= 1000),
  status         text not null default 'aberta' check (status in ('aberta', 'procedente', 'improcedente')),
  resolvido_por  text references public.perfis(id),
  resolvido_em   timestamptz,
  criado_em      timestamptz not null default now(),
  criado_ip      inet default public.ip_requisicao(),
  unique (alvo_tipo, alvo_id, denunciante_id)
);
create index denuncias_fila_idx on public.denuncias (status, criado_em);
alter table public.denuncias enable row level security;
create policy "denunciar" on public.denuncias for insert
  with check (denunciante_id = public.usuario_id() and status = 'aberta');
create policy "denuncias leitura" on public.denuncias for select
  using (denunciante_id = public.usuario_id() or public.e_admin());
create policy "denuncias admin" on public.denuncias for update
  using (public.e_admin()) with check (public.e_admin());

-- Muitas denúncias → sai do ar até alguém revisar
create or replace function public.ocultar_por_denuncias()
returns trigger language plpgsql security definer
set search_path = public
as $$
declare
  total integer;
  lim   integer;
  regiao uuid;
begin
  select count(*) into total from public.denuncias
   where alvo_tipo = new.alvo_tipo and alvo_id = new.alvo_id and status = 'aberta';
  perform set_config('olaki.sistema', '1', true);
  if new.alvo_tipo = 'anuncio' then
    select microrregiao_id into regiao from public.anuncios where id = new.alvo_id;
    lim := (public.config('moderacao.denuncias_para_ocultar', regiao, '3'))::int;
    if total >= lim then
      update public.anuncios set status = 'em_analise', motivo_analise = format('%s denúncias', total)
       where id = new.alvo_id and status = 'ativo';
    end if;
  elsif new.alvo_tipo = 'pedido' then
    select microrregiao_id into regiao from public.radar_pedidos where id = new.alvo_id;
    lim := (public.config('moderacao.denuncias_para_ocultar', regiao, '3'))::int;
    if total >= lim then
      update public.radar_pedidos set status = 'em_analise', motivo_analise = format('%s denúncias', total)
       where id = new.alvo_id and status = 'aberto';
    end if;
  end if;
  perform set_config('olaki.sistema', '', true);
  return null;
end $$;
create trigger denuncias_ocultar after insert on public.denuncias
  for each row execute function public.ocultar_por_denuncias();

-- ---------------------------------------------------------------------
-- 8. Auditoria do painel: toda mudança de plano/config fica no log
-- ---------------------------------------------------------------------
create or replace function public.registrar_log_chave()
returns trigger language plpgsql security definer
set search_path = public
as $$
declare reg jsonb := to_jsonb(coalesce(new, old));
begin
  insert into public.logs_atividade (tabela, registro_id, acao, usuario_id, ip, user_agent, dados_antes, dados_depois)
  values (tg_table_name, coalesce(reg->>'id', reg->>'codigo'), tg_op, public.usuario_id(), public.ip_requisicao(), public.user_agent_requisicao(),
          case when tg_op <> 'INSERT' then to_jsonb(old) end,
          case when tg_op <> 'DELETE' then to_jsonb(new) end);
  return null;
end $$;
create trigger log_planos        after insert or update or delete on public.planos        for each row execute function public.registrar_log_chave();
create trigger log_configuracoes after insert or update or delete on public.configuracoes for each row execute function public.registrar_log_chave();
create trigger log_denuncias     after insert or update on public.denuncias               for each row execute function public.registrar_log();
create trigger log_pagamentos    after insert or update on public.pagamentos              for each row execute function public.registrar_log();
create trigger log_microrregioes after insert or update or delete on public.microrregioes for each row execute function public.registrar_log();

create policy "microrregioes admin" on public.microrregioes for all using (public.e_admin()) with check (public.e_admin());

-- Painel: o admin precisa ver e editar tudo
create policy "admin edita anuncios"  on public.anuncios       for update using (public.e_admin()) with check (public.e_admin());
create policy "admin edita radar"     on public.radar_pedidos  for update using (public.e_admin()) with check (public.e_admin());
create policy "admin edita vitrines"  on public.vitrines_lojas for update using (public.e_admin()) with check (public.e_admin());
create policy "admin edita perfis"    on public.perfis         for update using (public.e_admin()) with check (public.e_admin());
create policy "admin verificacoes"    on public.perfis_verificacoes for update using (public.e_admin()) with check (public.e_admin());

-- ---------------------------------------------------------------------
-- 9. Região-piloto: Corrente-PI (sede), extremo sul do Piauí e
--    Formosa do Rio Preto-BA. Lista inicial; confira e ajuste no painel.
-- ---------------------------------------------------------------------
with r as (
  insert into public.microrregioes (slug, nome, cidade_sede)
  values ('corrente-pi', 'Corrente e Extremo Sul do Piauí', 'Corrente')
  returning id
)
insert into public.cidades (microrregiao_id, nome, uf)
select r.id, c.nome, c.uf from r, (values
  ('Corrente', 'PI'), ('Cristalândia do Piauí', 'PI'), ('Sebastião Barros', 'PI'), ('Riacho Frio', 'PI'),
  ('Parnaguá', 'PI'), ('Curimatá', 'PI'), ('Avelino Lopes', 'PI'), ('Júlio Borges', 'PI'),
  ('Morro Cabeça no Tempo', 'PI'), ('Monte Alegre do Piauí', 'PI'), ('Gilbués', 'PI'), ('Barreiras do Piauí', 'PI'),
  ('São Gonçalo do Gurguéia', 'PI'), ('Redenção do Gurguéia', 'PI'), ('Bom Jesus', 'PI'), ('Santa Filomena', 'PI'),
  ('Formosa do Rio Preto', 'BA')
) as c(nome, uf);
