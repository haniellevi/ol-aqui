-- =====================================================================
-- OLAKI · Migração 4: destaques pagos (4 tipos), créditos dos planos,
-- vagas por região, ativação pelo Asaas e resultado para o vendedor.
-- Base: PRODUTO-CONTAS-ANUNCIOS-ROBO.md (seção 6), PAINEL-ADMIN.md (tela 10)
-- e docs/etapa3/destaques.md.
-- Regra de ouro mantida: preço, dias, vagas, créditos e prazos ficam em
-- tabelas (destaque_tipos, destaque_creditos_plano, configuracoes),
-- editáveis no painel, com registro em logs_atividade.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tipos de destaque (o comportamento de cada um está nas funções abaixo;
--    o painel muda nome, texto, preço, dias, vagas, ativo e ordem)
-- ---------------------------------------------------------------------
create table public.destaque_tipos (
  slug              text primary key check (slug in ('subir', 'busca', 'home', 'loja')),
  id                uuid not null unique default gen_random_uuid(),   -- para o log (registrar_log usa "id")
  nome              text not null check (char_length(btrim(nome)) between 2 and 60),
  descricao         text check (char_length(descricao) <= 200),
  preco_centavos    integer not null check (preco_centavos between 0 and 10000000),
  dias              integer check (dias between 1 and 365),           -- "subir" não tem dias (sobe uma vez)
  vagas_por_regiao  integer check (vagas_por_regiao between 1 and 1000), -- null = sem limite
  alvo              text not null check (alvo in ('anuncio', 'loja')),
  ativo             boolean not null default true,
  ordem             integer not null default 0,
  atualizado_em     timestamptz not null default now(),
  atualizado_por    text references public.perfis(id) on delete set null,
  check ((slug = 'loja') = (alvo = 'loja')),
  check ((slug = 'subir') = (dias is null))
);

-- O painel não troca o tipo de um registro (slug/alvo/id ficam como estão)
create or replace function public.proteger_destaque_tipo()
returns trigger language plpgsql
set search_path = public, extensions
as $$
begin
  new.slug := old.slug;
  new.alvo := old.alvo;
  new.id := old.id;
  new.atualizado_em := now();
  return new;
end $$;
create trigger destaque_tipos_proteger before update on public.destaque_tipos
  for each row execute function public.proteger_destaque_tipo();
create trigger log_destaque_tipos after insert or update or delete on public.destaque_tipos
  for each row execute function public.registrar_log();

alter table public.destaque_tipos enable row level security;
create policy "destaque tipos leitura" on public.destaque_tipos for select using (ativo or public.e_admin());
create policy "destaque tipos admin"   on public.destaque_tipos for update using (public.e_admin()) with check (public.e_admin());
revoke all on public.destaque_tipos from anon, authenticated;
grant select on public.destaque_tipos to anon, authenticated;
grant update (nome, descricao, preco_centavos, dias, vagas_por_regiao, ativo, ordem, atualizado_em, atualizado_por)
  on public.destaque_tipos to authenticated;   -- a policy deixa só o admin

-- Valores de partida (todos editáveis no painel). "busca" é o destaque que já existia:
-- herda o preço e os dias das configurações destaque.preco_centavos / destaque.dias.
insert into public.destaque_tipos (slug, nome, descricao, preco_centavos, dias, vagas_por_regiao, alvo, ordem) values
  ('subir', 'Subir', 'Seu anúncio volta para o topo dos mais recentes uma vez.', 490, null, null, 'anuncio', 1),
  ('busca', 'Destaque na busca', 'Fica no topo da busca e da sua categoria, com a etiqueta Patrocinado.',
     coalesce(public.numero_ou_nulo((select valor from public.configuracoes where chave = 'destaque.preco_centavos' and microrregiao_id is null)), 1490)::int,
     coalesce(public.numero_ou_nulo((select valor from public.configuracoes where chave = 'destaque.dias' and microrregiao_id is null)), 7)::int,
     null, 'anuncio', 2),
  ('home', 'Vitrine da página inicial', 'Aparece no carrossel "Destaques perto de você" da página inicial.', 3990, 7, 8, 'anuncio', 3),
  ('loja', 'Loja em destaque', 'Sua loja aparece em "Lojas em destaque" na página inicial.', 4990, 7, 6, 'loja', 4);

-- Preço e dias diferentes por região (exceção da região; vazio = usa o do tipo). Editável na tela Destaques.
create table public.destaque_precos_regiao (
  id              uuid primary key default gen_random_uuid(),
  tipo            text not null references public.destaque_tipos(slug),
  microrregiao_id uuid not null references public.microrregioes(id) on delete cascade,
  preco_centavos  integer check (preco_centavos between 0 and 10000000),
  dias            integer check (dias between 1 and 365),
  atualizado_em   timestamptz not null default now(),
  atualizado_por  text references public.perfis(id) on delete set null,
  unique (tipo, microrregiao_id),
  check (preco_centavos is not null or dias is not null),
  check (tipo <> 'subir' or dias is null)
);
create trigger tocar_destaque_precos_regiao before update on public.destaque_precos_regiao
  for each row execute function public.tocar_atualizado_em();
create trigger log_destaque_precos_regiao after insert or update or delete on public.destaque_precos_regiao
  for each row execute function public.registrar_log();
alter table public.destaque_precos_regiao enable row level security;
create policy "precos regiao leitura" on public.destaque_precos_regiao for select using (true);
create policy "precos regiao admin"   on public.destaque_precos_regiao for all using (public.e_admin()) with check (public.e_admin());
revoke all on public.destaque_precos_regiao from anon, authenticated;
grant select on public.destaque_precos_regiao to anon, authenticated;
grant insert, update, delete on public.destaque_precos_regiao to authenticated;   -- a policy deixa só o admin

-- As exceções por região que existiam em destaque.preco_centavos / destaque.dias viram exceções do "busca"
insert into public.destaque_precos_regiao (tipo, microrregiao_id, preco_centavos, dias)
select 'busca', r.mid,
       case when public.numero_ou_nulo(p.valor) between 0 and 10000000 then public.numero_ou_nulo(p.valor)::int end,
       case when public.numero_ou_nulo(d.valor) between 1 and 365 then public.numero_ou_nulo(d.valor)::int end
  from (select distinct c.microrregiao_id as mid from public.configuracoes c
         where c.chave in ('destaque.preco_centavos', 'destaque.dias') and c.microrregiao_id is not null) r
  left join public.configuracoes p on p.chave = 'destaque.preco_centavos' and p.microrregiao_id = r.mid
  left join public.configuracoes d on d.chave = 'destaque.dias' and d.microrregiao_id = r.mid
 where (public.numero_ou_nulo(p.valor) between 0 and 10000000) or (public.numero_ou_nulo(d.valor) between 1 and 365);

-- Um lugar só para o preço: as configurações antigas saem (o painel mostra tudo na tela Destaques)
delete from public.configuracoes where chave in ('destaque.preco_centavos', 'destaque.dias');

-- O tipo como vale numa região: preço e dias da exceção da região, se tiver
create or replace function public.destaque_tipo_regiao(p_slug text, p_regiao uuid)
returns public.destaque_tipos language sql stable security definer
set search_path = public, extensions
as $$
  select t.slug, t.id, t.nome, t.descricao,
         coalesce(r.preco_centavos, t.preco_centavos),
         case when t.slug = 'subir' then null else coalesce(r.dias, t.dias) end,
         t.vagas_por_regiao, t.alvo, t.ativo, t.ordem, t.atualizado_em, t.atualizado_por
    from public.destaque_tipos t
    left join public.destaque_precos_regiao r on r.tipo = t.slug and r.microrregiao_id = p_regiao
   where t.slug = p_slug
$$;

-- ---------------------------------------------------------------------
-- 2. Créditos que cada plano ganha por mês (ex.: Full ganha 4 "Subir")
-- ---------------------------------------------------------------------
create table public.destaque_creditos_plano (
  id              uuid primary key default gen_random_uuid(),
  plano_codigo    text not null references public.planos(codigo) on delete cascade,
  tipo            text not null references public.destaque_tipos(slug),
  quantidade_mes  integer not null check (quantidade_mes between 0 and 1000),
  atualizado_em   timestamptz not null default now(),
  atualizado_por  text references public.perfis(id) on delete set null,
  unique (plano_codigo, tipo)
);
create trigger tocar_destaque_creditos before update on public.destaque_creditos_plano
  for each row execute function public.tocar_atualizado_em();
create trigger log_destaque_creditos after insert or update or delete on public.destaque_creditos_plano
  for each row execute function public.registrar_log();
alter table public.destaque_creditos_plano enable row level security;
create policy "creditos leitura" on public.destaque_creditos_plano for select using (true);
create policy "creditos admin"   on public.destaque_creditos_plano for all using (public.e_admin()) with check (public.e_admin());
revoke all on public.destaque_creditos_plano from anon, authenticated;
grant select on public.destaque_creditos_plano to anon, authenticated;
grant insert, update, delete on public.destaque_creditos_plano to authenticated;   -- a policy deixa só o admin

insert into public.destaque_creditos_plano (plano_codigo, tipo, quantidade_mes)
select p.codigo, c.tipo, c.qtd
  from (values ('full', 'subir', 4), ('slim', 'subir', 2)) as c(plano, tipo, qtd)
  join public.planos p on p.codigo = c.plano;

-- ---------------------------------------------------------------------
-- 3. Destaques comprados, de crédito ou de cortesia
--    Só funções do sistema escrevem aqui (o vendedor nunca ativa sozinho).
-- ---------------------------------------------------------------------
create table public.destaques (
  id              uuid primary key default gen_random_uuid(),
  tipo            text not null references public.destaque_tipos(slug),
  anuncio_id      uuid references public.anuncios(id) on delete cascade,          -- null no tipo "loja"
  vitrine_id      uuid not null references public.vitrines_lojas(id) on delete cascade,
  microrregiao_id uuid not null references public.microrregioes(id),
  criado_por      text references public.perfis(id) on delete set null,
  origem          text not null check (origem in ('pago', 'credito', 'cortesia')),
  pagamento_id    uuid unique references public.pagamentos(id) on delete set null,
  status          text not null default 'aguardando_pagamento'
                    check (status in ('aguardando_pagamento', 'ativo', 'encerrado', 'cancelado')),
  preco_centavos  integer not null default 0 check (preco_centavos >= 0),         -- foto do preço na hora da compra
  dias            integer,
  reservado_ate   timestamptz,          -- até quando a vaga fica guardada esperando o pagamento
  inicio          timestamptz,
  fim             timestamptz,
  motivo          text check (char_length(motivo) <= 300),
  renovacoes      integer not null default 0,          -- quantas vezes a reserva vencida foi guardada de novo
  cancelado_pela_equipe boolean not null default false, -- cancelado pelo admin: pagamento que chegar depois não liga
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  check ((tipo = 'loja') = (anuncio_id is null)),
  check (status <> 'ativo' or (inicio is not null and fim is not null))
);
create index destaques_vagas_idx   on public.destaques (tipo, microrregiao_id, status, fim);
create index destaques_vitrine_idx on public.destaques (vitrine_id, criado_em desc);
create index destaques_anuncio_idx on public.destaques (anuncio_id) where anuncio_id is not null;
create trigger tocar_destaques before update on public.destaques
  for each row execute function public.tocar_atualizado_em();
create trigger log_destaques after insert or update or delete on public.destaques
  for each row execute function public.registrar_log();

alter table public.destaques enable row level security;
create policy "destaques leitura" on public.destaques for select using (
  public.e_admin() or exists (
    select 1 from public.vitrines_lojas v where v.id = vitrine_id and v.dono_id = public.usuario_id()));
revoke all on public.destaques from anon, authenticated;
grant select on public.destaques to authenticated;

-- Pagamentos: dinheiro que chegou sem dar para ligar o destaque (a equipe devolve no Asaas)
alter table public.pagamentos
  add column devolver_motivo text check (char_length(devolver_motivo) <= 300);

-- Última vez que o servidor perguntou ao Asaas sobre um pagamento (limite de perguntas).
-- Tabela à parte, sem log: muda a cada poucos segundos. Só o servidor mexe (função abaixo).
create table public.asaas_consultas (
  pagamento_id  uuid primary key references public.pagamentos(id) on delete cascade,
  consultado_em timestamptz not null default now()
);
alter table public.asaas_consultas enable row level security;
revoke all on public.asaas_consultas from anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. "Subir": data em que o anúncio subiu (só o sistema grava)
-- ---------------------------------------------------------------------
alter table public.anuncios add column subido_em timestamptz;

create or replace function public.proteger_subido_em()
returns trigger language plpgsql
set search_path = public, extensions
as $$
begin
  if public.acesso_sistema() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.subido_em := null;
  else
    new.subido_em := old.subido_em;
  end if;
  return new;
end $$;
create trigger anuncios_proteger_subido before insert or update on public.anuncios
  for each row execute function public.proteger_subido_em();

-- ---------------------------------------------------------------------
-- 5. Configurações novas (todas no painel)
-- ---------------------------------------------------------------------
insert into public.configuracoes (chave, valor, grupo, publico, descricao) values
  ('destaque.reserva_minutos',        '30', 'planos',   false, 'Minutos que a vaga de um destaque com vagas limitadas fica guardada esperando o pagamento'),
  ('destaque.cancelar_pendente_horas','48', 'planos',   false, 'Horas até a rotina diária cancelar um pedido de destaque que não foi pago'),
  ('destaque.subir_intervalo_horas',  '24', 'planos',   true,  'Tempo mínimo (horas) entre dois "Subir" do mesmo anúncio'),
  ('destaque.subir_resultado_dias',   '7',  'planos',   false, 'Dias em que o resultado do "Subir" é medido (visualizações e cliques)'),
  ('destaque.pendentes_max',          '10', 'planos',   false, 'Máximo de pedidos de destaque esperando pagamento por vendedor ao mesmo tempo'),
  ('destaque.reserva_renovacoes_max', '1',  'planos',   false, 'Quantas vezes a vaga de um pedido não pago pode ser guardada de novo depois que a reserva acaba'),
  ('destaque.reservas_max_por_vendedor','2','planos',   false, 'Máximo de vagas guardadas (home/loja) esperando pagamento por vendedor, por tipo, ao mesmo tempo'),
  ('cobranca.vencimento_dias',        '1',  'cobranca', false, 'Dias até a cobrança do Asaas vencer (Pix e cartão)'),
  ('cobranca.consulta_intervalo_segundos','15','cobranca',false,'Intervalo mínimo (segundos) entre duas perguntas do servidor ao Asaas sobre a mesma cobrança')
on conflict do nothing;

-- ---------------------------------------------------------------------
-- 6. Funções internas: vagas e créditos
-- ---------------------------------------------------------------------

-- Vagas ocupadas de um tipo numa região. Ocupa vaga: destaque ativo que ainda não acabou
-- ou pedido esperando pagamento com a reserva valendo. Conta por alvo (anúncio ou loja):
-- o mesmo alvo renovando não ocupa outra vaga. Só conta alvo que está no ar
-- (anúncio congelado/pausado ou loja parada não aparece, então não segura vaga).
create or replace function public.destaque_vagas_ocupadas(p_tipo text, p_regiao uuid, p_excluir_alvo uuid default null)
returns integer language sql stable security definer
set search_path = public, extensions
as $$
  select count(distinct coalesce(d.anuncio_id, d.vitrine_id))::int
    from public.destaques d
    join public.vitrines_lojas v on v.id = d.vitrine_id and v.status = 'ativa'
    left join public.anuncios a on a.id = d.anuncio_id
   where d.tipo = p_tipo and d.microrregiao_id = p_regiao
     and (d.anuncio_id is null or a.status = 'ativo')
     and ((d.status = 'ativo' and d.fim > now())
          or (d.status = 'aguardando_pagamento' and d.reservado_ate > now()))
     and coalesce(d.anuncio_id, d.vitrine_id) is distinct from p_excluir_alvo
$$;

-- Créditos que a vitrine ainda tem neste mês (fuso de Fortaleza) para o tipo, pelo plano que vale agora
create or replace function public.destaque_creditos_restantes(p_vitrine uuid, p_tipo text)
returns integer language plpgsql stable security definer
set search_path = public, extensions
as $$
declare
  v      public.vitrines_lojas;
  p      public.planos;
  qtd    integer;
  usados integer;
begin
  select * into v from public.vitrines_lojas where id = p_vitrine;
  if v.id is null or v.status <> 'ativa' then return 0; end if;
  p := public.plano_efetivo(v);
  if p.codigo is null then return 0; end if;
  select c.quantidade_mes into qtd from public.destaque_creditos_plano c where c.plano_codigo = p.codigo and c.tipo = p_tipo;
  if coalesce(qtd, 0) = 0 then return 0; end if;
  select count(*) into usados from public.destaques d
   where d.vitrine_id = p_vitrine and d.tipo = p_tipo and d.origem = 'credito' and d.status <> 'cancelado'
     and d.criado_em >= (date_trunc('month', now() at time zone 'America/Fortaleza') at time zone 'America/Fortaleza');
  return greatest(qtd - usados, 0);
end $$;

-- Liga o destaque (crédito, cortesia ou pagamento confirmado). Só age em pedido esperando
-- (chamada repetida, pedido encerrado ou cancelado: não faz nada).
create or replace function public.ativar_destaque(p_destaque_id uuid)
returns void language plpgsql security definer
set search_path = public, extensions
as $$
declare
  d       public.destaques;
  t       public.destaque_tipos;
  v_dias  integer;
  v_ini   timestamptz;
  v_fim   timestamptz;
  janela  integer;
  aviso   text;
  antes   text := coalesce(current_setting('olaki.sistema', true), '');
begin
  select * into d from public.destaques where id = p_destaque_id for update;
  if d.id is null or d.status <> 'aguardando_pagamento' then
    return;
  end if;
  select * into t from public.destaque_tipos where slug = d.tipo;
  v_dias := coalesce(d.dias, t.dias);

  perform set_config('olaki.sistema', '1', true);
  if d.tipo = 'subir' then
    janela := coalesce(public.numero_ou_nulo(public.config('destaque.subir_resultado_dias', d.microrregiao_id, '7')), 7)::int;
    v_ini := now();
    v_fim := now() + make_interval(days => greatest(janela, 1));
    begin
      update public.anuncios set subido_em = now() where id = d.anuncio_id;
    exception when others then
      aviso := left('Não deu para subir o anúncio: ' || sqlerrm, 300);
    end;
  elsif d.tipo = 'busca' then
    v_dias := coalesce(v_dias, 7);
    begin
      update public.anuncios
         set destaque_ate = greatest(coalesce(destaque_ate, now()), now()) + make_interval(days => v_dias)
       where id = d.anuncio_id
      returning destaque_ate into v_fim;
    exception when others then
      aviso := left('Não deu para marcar o destaque no anúncio: ' || sqlerrm, 300);
    end;
    v_fim := coalesce(v_fim, now() + make_interval(days => v_dias));
    v_ini := greatest(now(), v_fim - make_interval(days => v_dias));
  else
    -- home e loja: se o mesmo alvo já tem um ativo, o novo começa quando o atual acaba
    v_dias := coalesce(v_dias, 7);
    select max(x.fim) into v_ini from public.destaques x
     where x.tipo = d.tipo and x.status = 'ativo' and x.fim > now() and x.id <> d.id
       and coalesce(x.anuncio_id, x.vitrine_id) = coalesce(d.anuncio_id, d.vitrine_id);
    v_ini := greatest(coalesce(v_ini, now()), now());
    v_fim := v_ini + make_interval(days => v_dias);
  end if;

  update public.destaques
     set status = 'ativo', inicio = v_ini, fim = v_fim, dias = v_dias, reservado_ate = null,
         motivo = coalesce(aviso, motivo)
   where id = d.id;
  perform set_config('olaki.sistema', antes, true);
end $$;

-- Pagamento confirmado de um pedido pago. Liga o destaque, menos quando:
--  * a equipe cancelou o pedido (o cancelamento vale);
--  * o anúncio (ou a loja) não está mais no ar;
--  * o pedido já tinha sido cancelado (venceu/não pago a tempo) e as vagas da região estão cheias.
-- Nesses casos o destaque fica cancelado e o pagamento fica marcado para a equipe devolver o
-- dinheiro (pagamentos.devolver_motivo, lista na tela Destaques do painel).
-- Pedido ainda esperando com a reserva vencida: liga assim mesmo (a cobrança era válida).
create or replace function public.ativar_destaque_pago(p_destaque_id uuid)
returns void language plpgsql security definer
set search_path = public, extensions
as $$
declare
  d      public.destaques;
  t      public.destaque_tipos;
  a      public.anuncios;
  v      public.vitrines_lojas;
  porque text;
begin
  select * into d from public.destaques where id = p_destaque_id;
  if d.id is null or d.status in ('ativo', 'encerrado') then
    return;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('olaki:destaque:' || d.tipo || ':' || d.microrregiao_id::text, 0));
  select * into d from public.destaques where id = p_destaque_id for update;
  if d.status in ('ativo', 'encerrado') then
    return;
  end if;
  select * into t from public.destaque_tipos where slug = d.tipo;
  select * into v from public.vitrines_lojas where id = d.vitrine_id;
  if d.anuncio_id is not null then
    select * into a from public.anuncios where id = d.anuncio_id;
  end if;

  if d.status = 'cancelado' and d.cancelado_pela_equipe then
    porque := 'Pago depois que a equipe cancelou';
  elsif v.id is null or v.status <> 'ativa' or (d.tipo = 'loja' and v.tipo <> 'loja') then
    porque := 'A loja não estava ativa quando o pagamento chegou';
  elsif d.anuncio_id is not null and (a.id is null or a.status <> 'ativo') then
    porque := 'O anúncio não estava no ar quando o pagamento chegou';
  elsif d.status = 'cancelado' and t.vagas_por_regiao is not null
        and public.destaque_vagas_ocupadas(d.tipo, d.microrregiao_id, coalesce(d.anuncio_id, d.vitrine_id)) >= t.vagas_por_regiao then
    porque := 'Pago depois do prazo e as vagas da região estavam ocupadas';
  end if;

  if porque is not null then
    update public.destaques
       set status = 'cancelado', reservado_ate = null,
           motivo = left(porque || '. A equipe vai devolver o dinheiro.', 300)
     where id = d.id;
    update public.pagamentos set devolver_motivo = left(porque, 300) where id = d.pagamento_id;
    return;
  end if;

  if d.status = 'cancelado' then
    update public.destaques set status = 'aguardando_pagamento', motivo = 'Pago depois do prazo' where id = d.id;
  end if;
  perform public.ativar_destaque(d.id);
end $$;

-- ---------------------------------------------------------------------
-- 7. Tela "Destacar": opções e contratação
-- ---------------------------------------------------------------------

-- Tipos que a pessoa pode contratar agora para o anúncio (ou para a loja, sem anúncio):
-- preço, dias, vagas livres na região, créditos do plano e, se não der, o motivo.
create or replace function public.opcoes_destaque(p_anuncio_id uuid default null)
returns table (slug text, nome text, descricao text, preco_centavos integer, dias integer,
               vagas_por_regiao integer, vagas_livres integer, alvo text, creditos_restantes integer,
               disponivel boolean, motivo text, ordem integer)
language plpgsql stable security definer
set search_path = public, extensions
as $$
declare
  uid      text := public.usuario_id();
  v        public.vitrines_lojas;
  a        public.anuncios;
  t        public.destaque_tipos;
  regiao   uuid;
  alvo_id  uuid;
  livres   integer;
  intervalo numeric;
  ok       boolean;
  porque   text;
begin
  if uid is null then return; end if;
  select * into v from public.vitrines_lojas x where x.dono_id = uid;
  if v.id is null then return; end if;

  if p_anuncio_id is not null then
    select * into a from public.anuncios x where x.id = p_anuncio_id and x.vitrine_id = v.id;
    if a.id is null then return; end if;
    regiao := a.microrregiao_id;
    alvo_id := a.id;
  else
    regiao := v.microrregiao_id;
    alvo_id := v.id;
  end if;

  for t in select r.* from public.destaque_tipos x
            cross join lateral public.destaque_tipo_regiao(x.slug, regiao) r
            where x.ativo and x.alvo = case when p_anuncio_id is null then 'loja' else 'anuncio' end
            order by x.ordem, x.slug loop
    ok := true;
    porque := null;
    livres := null;
    if t.vagas_por_regiao is not null then
      livres := greatest(t.vagas_por_regiao - public.destaque_vagas_ocupadas(t.slug, regiao, alvo_id), 0);
    end if;
    if v.status <> 'ativa' then
      ok := false; porque := 'Sua conta de vendedor não está ativa.';
    elsif t.alvo = 'loja' and v.tipo <> 'loja' then
      ok := false; porque := 'Só para lojas.';
    elsif t.alvo = 'anuncio' and a.status <> 'ativo' then
      ok := false; porque := 'O anúncio precisa estar no ar.';
    elsif livres = 0 then
      ok := false; porque := 'As vagas da sua região estão ocupadas agora.';
    elsif t.slug = 'subir' then
      intervalo := coalesce(public.numero_ou_nulo(public.config('destaque.subir_intervalo_horas', regiao, '24')), 24);
      if a.subido_em > now() - make_interval(secs => (intervalo * 3600)::double precision) then
        ok := false;
        porque := format('Você já subiu este anúncio. Pode subir de novo depois de %s.',
                         to_char((a.subido_em + make_interval(secs => (intervalo * 3600)::double precision)) at time zone 'America/Fortaleza',
                                 'DD/MM "às" HH24:MI'));
      end if;
    end if;
    slug := t.slug; nome := t.nome; descricao := t.descricao; preco_centavos := t.preco_centavos;
    dias := t.dias; vagas_por_regiao := t.vagas_por_regiao; vagas_livres := livres; alvo := t.alvo;
    creditos_restantes := public.destaque_creditos_restantes(v.id, t.slug);
    disponivel := ok; motivo := porque; ordem := t.ordem;
    return next;
  end loop;
end $$;

-- Contrata um destaque. Crédito do plano (ou preço zero): ativa na hora.
-- Pago: cria o pagamento (tipo "destaque") e o pedido "aguardando_pagamento" com a vaga
-- guardada por alguns minutos. O servidor cria a cobrança no Asaas depois.
-- Pedido igual que ainda espera pagamento é devolvido (não cria outro).
create or replace function public.contratar_destaque(p_tipo text, p_anuncio_id uuid default null, p_usar_credito boolean default false)
returns table (destaque_id uuid, status text, origem text, preco_centavos integer, pagamento_id uuid, reservado_ate timestamptz)
language plpgsql security definer
set search_path = public, extensions
as $$
#variable_conflict use_column
declare
  uid       text := public.usuario_id();
  t         public.destaque_tipos;
  v         public.vitrines_lojas;
  a         public.anuncios;
  d         public.destaques;
  regiao    uuid;
  alvo_id   uuid;
  reserva   integer;
  intervalo numeric;
  pendentes integer;
  maximo    integer;
  venc      integer;
  pg_id     uuid;
  renov_max integer;
  reservas  integer;
  horas     integer;
begin
  if uid is null then
    raise exception 'Entre na sua conta para destacar.' using errcode = '28000';
  end if;
  select * into t from public.destaque_tipos x where x.slug = p_tipo and x.ativo;
  if t.slug is null then
    raise exception 'Este tipo de destaque não está disponível agora.' using errcode = 'P0001';
  end if;
  select * into v from public.vitrines_lojas x where x.dono_id = uid;
  if v.id is null then
    raise exception 'Você ainda não vende no OLAKI.' using errcode = '42501';
  end if;
  if v.status <> 'ativa' then
    raise exception 'Sua conta de vendedor não está ativa. Veja em Meu plano.' using errcode = '42501';
  end if;

  if t.alvo = 'anuncio' then
    if p_anuncio_id is null then
      raise exception 'Escolha o anúncio que você quer destacar.' using errcode = '22023';
    end if;
    select * into a from public.anuncios x where x.id = p_anuncio_id;
    if a.id is null or a.vitrine_id <> v.id then
      raise exception 'Anúncio não encontrado.' using errcode = '42501';
    end if;
    if a.status <> 'ativo' then
      raise exception 'Só dá para destacar um anúncio que está no ar.' using errcode = 'P0001';
    end if;
    regiao := a.microrregiao_id;
    alvo_id := a.id;
  else
    if p_anuncio_id is not null then
      raise exception 'Loja em destaque é para a loja, não para um anúncio.' using errcode = '22023';
    end if;
    if v.tipo <> 'loja' then
      raise exception 'Loja em destaque é só para lojas. Abra sua loja primeiro.' using errcode = 'P0001';
    end if;
    regiao := v.microrregiao_id;
    alvo_id := v.id;
  end if;
  t := public.destaque_tipo_regiao(t.slug, regiao);   -- preço e dias da região

  -- Fila por tipo + região (vagas) e por vitrine (créditos e pedidos): duas compras ao mesmo tempo não passam juntas
  perform pg_advisory_xact_lock(hashtextextended('olaki:destaque:' || t.slug || ':' || regiao::text, 0));
  perform pg_advisory_xact_lock(hashtextextended('olaki:destaque-vitrine:' || v.id::text, 0));

  reserva := coalesce(public.numero_ou_nulo(public.config('destaque.reserva_minutos', regiao, '30')), 30)::int;

  -- Mesmo pedido esperando pagamento (mesmo preço): devolve ele. A reserva que ainda vale não é
  -- esticada; a que venceu só é guardada de novo poucas vezes (destaque.reserva_renovacoes_max),
  -- para ninguém segurar vaga sem pagar.
  if not p_usar_credito and t.preco_centavos > 0 then
    select * into d from public.destaques x
     where x.tipo = t.slug and x.vitrine_id = v.id and coalesce(x.anuncio_id, x.vitrine_id) = alvo_id
       and x.status = 'aguardando_pagamento' and x.origem = 'pago' and x.preco_centavos = t.preco_centavos
       and exists (select 1 from public.pagamentos p where p.id = x.pagamento_id and p.status = 'pendente')
     order by x.criado_em desc limit 1;
    if d.id is not null then
      if t.vagas_por_regiao is not null and (d.reservado_ate is null or d.reservado_ate <= now()) then
        if public.destaque_vagas_ocupadas(t.slug, regiao, alvo_id) >= t.vagas_por_regiao then
          raise exception using errcode = 'P0001',
            message = format('As vagas de "%s" estão ocupadas na sua região agora. Tente de novo em alguns dias.', t.nome);
        end if;
        renov_max := greatest(coalesce(public.numero_ou_nulo(public.config('destaque.reserva_renovacoes_max', regiao, '1')), 1)::int, 0);
        if d.renovacoes < renov_max then
          update public.destaques x set reservado_ate = now() + make_interval(mins => reserva), renovacoes = x.renovacoes + 1
           where x.id = d.id
          returning * into d;
        end if;
      end if;
      return query select d.id, d.status, d.origem, d.preco_centavos, d.pagamento_id, d.reservado_ate;
      return;
    end if;
  end if;

  if t.slug = 'subir' then
    intervalo := coalesce(public.numero_ou_nulo(public.config('destaque.subir_intervalo_horas', regiao, '24')), 24);
    if a.subido_em > now() - make_interval(secs => (intervalo * 3600)::double precision) then
      raise exception 'Você já subiu este anúncio há pouco. Tente de novo mais tarde.' using errcode = 'P0001';
    end if;
  end if;

  if t.vagas_por_regiao is not null
     and public.destaque_vagas_ocupadas(t.slug, regiao, alvo_id) >= t.vagas_por_regiao then
    raise exception using errcode = 'P0001',
      message = format('As vagas de "%s" estão ocupadas na sua região agora. Tente de novo em alguns dias.', t.nome);
  end if;

  if p_usar_credito then
    if public.destaque_creditos_restantes(v.id, t.slug) <= 0 then
      raise exception 'Você não tem mais créditos deste destaque neste mês.' using errcode = 'P0001';
    end if;
    insert into public.destaques (tipo, anuncio_id, vitrine_id, microrregiao_id, criado_por, origem, status, preco_centavos, dias)
    values (t.slug, a.id, v.id, regiao, uid, 'credito', 'aguardando_pagamento', 0, t.dias)
    returning * into d;
    perform public.ativar_destaque(d.id);
  elsif t.preco_centavos = 0 then
    insert into public.destaques (tipo, anuncio_id, vitrine_id, microrregiao_id, criado_por, origem, status, preco_centavos, dias, motivo)
    values (t.slug, a.id, v.id, regiao, uid, 'cortesia', 'aguardando_pagamento', 0, t.dias, 'Grátis: preço zero no painel')
    returning * into d;
    perform public.ativar_destaque(d.id);
  else
    maximo := coalesce(public.numero_ou_nulo(public.config('destaque.pendentes_max', regiao, '10')), 10)::int;
    horas := greatest(coalesce(public.numero_ou_nulo(public.config('destaque.cancelar_pendente_horas', regiao, '48')), 48)::int, 1);
    select count(*) into pendentes from public.destaques x
     where x.vitrine_id = v.id and x.status = 'aguardando_pagamento' and x.origem = 'pago'
       and (x.criado_em > now() - make_interval(hours => horas) or x.reservado_ate > now());
    if pendentes >= maximo then
      raise exception 'Você tem muitos destaques esperando pagamento. Pague ou espere um pouco antes de pedir outro.' using errcode = 'P0001';
    end if;
    if t.vagas_por_regiao is not null then
      select count(*) into reservas from public.destaques x
       where x.vitrine_id = v.id and x.tipo = t.slug and x.microrregiao_id = regiao
         and x.status = 'aguardando_pagamento' and x.reservado_ate > now();
      if reservas >= greatest(coalesce(public.numero_ou_nulo(public.config('destaque.reservas_max_por_vendedor', regiao, '2')), 2)::int, 1) then
        raise exception using errcode = 'P0001',
          message = format('Você já tem vagas de "%s" guardadas esperando pagamento. Pague ou espere a reserva acabar.', t.nome);
      end if;
    end if;
    venc := greatest(coalesce(public.numero_ou_nulo(public.config('cobranca.vencimento_dias', regiao, '1')), 1)::int, 0);
    insert into public.pagamentos (vitrine_id, microrregiao_id, tipo, anuncio_id, valor_centavos, status, vencimento, repasse_percentual)
    values (v.id, regiao, 'destaque', a.id, t.preco_centavos, 'pendente',
            (now() at time zone 'America/Fortaleza')::date + venc,
            (select m.repasse_percentual from public.microrregioes m where m.id = regiao))
    returning id into pg_id;
    insert into public.destaques (tipo, anuncio_id, vitrine_id, microrregiao_id, criado_por, origem, status,
                                  pagamento_id, preco_centavos, dias, reservado_ate)
    values (t.slug, a.id, v.id, regiao, uid, 'pago', 'aguardando_pagamento',
            pg_id, t.preco_centavos, t.dias, now() + make_interval(mins => reserva))
    returning * into d;
  end if;

  select * into d from public.destaques x where x.id = d.id;
  return query select d.id, d.status, d.origem, d.preco_centavos, d.pagamento_id, d.reservado_ate;
end $$;

-- ---------------------------------------------------------------------
-- 8. Pagamento (Asaas): confirmação, cancelamento e ids da cobrança.
--    Só o servidor (service_role) chama.
-- ---------------------------------------------------------------------

-- Mesma assinatura de antes. Idempotente: só age quando o pagamento ainda não estava pago
-- (nem devolvido). Destaque ligado ao pagamento → ativa. Cobrança antiga de destaque sem
-- pedido ligado → comportamento antigo, com os dias do tipo "busca".
create or replace function public.confirmar_pagamento(p_asaas_cobranca_id text, p_payload jsonb default null)
returns void language plpgsql security definer
set search_path = public, extensions
as $$
declare
  pg   public.pagamentos;
  pl   public.planos;
  dias integer;
  d_id uuid;
begin
  update public.pagamentos
     set status = 'pago', pago_em = now(), payload = coalesce(p_payload, payload),
         forma = coalesce(case p_payload #>> '{payment,billingType}'
                            when 'PIX' then 'pix' when 'CREDIT_CARD' then 'cartao' when 'BOLETO' then 'boleto' end, forma)
   where asaas_cobranca_id = p_asaas_cobranca_id and status in ('pendente', 'vencido', 'cancelado')
  returning * into pg;
  if pg.id is null then return; end if;   -- já processado (aviso repetido) ou devolvido

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
    select x.id into d_id from public.destaques x where x.pagamento_id = pg.id;
    if d_id is not null then
      perform public.ativar_destaque_pago(d_id);
    else
      dias := coalesce((public.destaque_tipo_regiao('busca', pg.microrregiao_id)).dias, 7);
      update public.anuncios set destaque_ate = greatest(coalesce(destaque_ate, now()), now()) + make_interval(days => dias)
       where id = pg.anuncio_id;
    end if;
  end if;
  perform set_config('olaki.sistema', '', true);
end $$;

-- Tira o tempo de "Destaque na busca" que ainda faltava (devolução ou cancelamento pelo admin)
create or replace function public.devolver_tempo_destaque(d public.destaques)
returns void language plpgsql security definer
set search_path = public, extensions
as $$
declare antes text := coalesce(current_setting('olaki.sistema', true), '');
begin
  if d.tipo <> 'busca' or d.status <> 'ativo' or d.fim <= now() then return; end if;
  perform set_config('olaki.sistema', '1', true);
  begin
    update public.anuncios
       set destaque_ate = destaque_ate - (d.fim - greatest(d.inicio, now()))
     where id = d.anuncio_id and destaque_ate is not null;
  exception when others then
    null;   -- o anúncio pode ter mudado; o destaque é cancelado assim mesmo
  end;
  perform set_config('olaki.sistema', antes, true);
end $$;

-- Aviso do Asaas de cobrança vencida, apagada ou devolvida. Idempotente.
-- vencido/cancelado: só mexe em pagamento pendente (o pedido de destaque é cancelado).
-- estornado: pagamento devolvido → destaque cancelado na hora.
create or replace function public.cancelar_pagamento(p_asaas_cobranca_id text, p_status text, p_payload jsonb default null)
returns void language plpgsql security definer
set search_path = public, extensions
as $$
declare
  pg public.pagamentos;
  d  public.destaques;
begin
  if p_status not in ('vencido', 'cancelado', 'estornado') then
    raise exception 'Situação de pagamento inválida.' using errcode = '22023';
  end if;
  select * into pg from public.pagamentos where asaas_cobranca_id = p_asaas_cobranca_id for update;
  if pg.id is null then return; end if;

  if p_status = 'estornado' then
    if pg.status = 'estornado' then return; end if;
    update public.pagamentos set status = 'estornado', payload = coalesce(p_payload, payload) where id = pg.id;
    select * into d from public.destaques where pagamento_id = pg.id for update;
    if d.id is not null and d.status in ('ativo', 'aguardando_pagamento') then
      perform public.devolver_tempo_destaque(d);
      update public.destaques
         set status = 'cancelado', fim = case when fim is not null then least(fim, now()) end, motivo = 'Pagamento devolvido'
       where id = d.id;
    end if;
  else
    if pg.status <> 'pendente' then return; end if;   -- já pago (ou já cancelado): ignora
    update public.pagamentos set status = p_status, payload = coalesce(p_payload, payload) where id = pg.id;
    update public.destaques
       set status = 'cancelado', motivo = case p_status when 'vencido' then 'O pagamento venceu' else 'A cobrança foi cancelada' end
     where pagamento_id = pg.id and status = 'aguardando_pagamento';
  end if;
end $$;

-- O servidor grava os ids da cobrança criada no Asaas (só em pagamento ainda pendente).
-- Nunca troca uma cobrança já gravada por outra: se dois cliques criarem duas cobranças,
-- só a primeira fica (devolve false e o servidor apaga a segunda no Asaas). Assim nenhum
-- Pix pago fica sem dono.
create or replace function public.registrar_cobranca_asaas(p_pagamento_id uuid, p_cobranca_id text, p_link text default null, p_forma text default null)
returns boolean language plpgsql security definer
set search_path = public, extensions
as $$
declare n integer;
begin
  if nullif(btrim(coalesce(p_cobranca_id, '')), '') is null then
    raise exception 'Id da cobrança vazio.' using errcode = '22023';
  end if;
  if p_forma is not null and p_forma not in ('pix', 'boleto', 'cartao') then
    raise exception 'Forma de pagamento inválida.' using errcode = '22023';
  end if;
  update public.pagamentos
     set asaas_cobranca_id = btrim(p_cobranca_id), link_pagamento = left(p_link, 500), forma = coalesce(p_forma, forma)
   where id = p_pagamento_id and status = 'pendente'
     and (asaas_cobranca_id is null or asaas_cobranca_id = btrim(p_cobranca_id));
  get diagnostics n = row_count;
  return n > 0;
end $$;

-- O servidor só pergunta ao Asaas sobre uma cobrança de tempos em tempos
-- (cobranca.consulta_intervalo_segundos), seja qual for o pedido da tela. true = pode perguntar agora.
create or replace function public.marcar_consulta_asaas(p_pagamento_id uuid)
returns boolean language plpgsql security definer
set search_path = public, extensions
as $$
declare
  regiao    uuid;
  intervalo double precision;
  n         integer;
begin
  select p.microrregiao_id into regiao from public.pagamentos p where p.id = p_pagamento_id;
  if regiao is null then return false; end if;
  intervalo := greatest(coalesce(public.numero_ou_nulo(public.config('cobranca.consulta_intervalo_segundos', regiao, '15')), 15), 1);
  insert into public.asaas_consultas as c (pagamento_id, consultado_em) values (p_pagamento_id, now())
  on conflict (pagamento_id) do update set consultado_em = now()
   where c.consultado_em <= now() - make_interval(secs => intervalo);
  get diagnostics n = row_count;
  return n > 0;
end $$;

-- ---------------------------------------------------------------------
-- 9. Painel: cortesia e cancelamento (só admin; tudo fica no log)
-- ---------------------------------------------------------------------
create or replace function public.conceder_destaque_cortesia(
  p_tipo text, p_anuncio_id uuid default null, p_vitrine_id uuid default null,
  p_dias integer default null, p_motivo text default null, p_ignorar_vagas boolean default false)
returns uuid language plpgsql security definer
set search_path = public, extensions
as $$
declare
  t       public.destaque_tipos;
  v       public.vitrines_lojas;
  a       public.anuncios;
  d_id    uuid;
  regiao  uuid;
  alvo_id uuid;
begin
  if not public.e_admin() then
    raise exception 'Só a equipe OLAKI pode dar destaque de cortesia.' using errcode = '42501';
  end if;
  select * into t from public.destaque_tipos x where x.slug = p_tipo;
  if t.slug is null then
    raise exception 'Tipo de destaque não encontrado.' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_motivo, ''))) < 3 then
    raise exception 'Escreva o motivo da cortesia.' using errcode = '23514';
  end if;
  if p_dias is not null and (p_dias < 1 or p_dias > 365) then
    raise exception 'Os dias devem ficar entre 1 e 365.' using errcode = '23514';
  end if;

  if t.alvo = 'anuncio' then
    select * into a from public.anuncios x where x.id = p_anuncio_id;
    if a.id is null then
      raise exception 'Anúncio não encontrado.' using errcode = '22023';
    end if;
    if a.status <> 'ativo' then
      raise exception 'O anúncio precisa estar no ar.' using errcode = 'P0001';
    end if;
    select * into v from public.vitrines_lojas x where x.id = a.vitrine_id;
    regiao := a.microrregiao_id;
    alvo_id := a.id;
  else
    select * into v from public.vitrines_lojas x where x.id = p_vitrine_id;
    if v.id is null or v.tipo <> 'loja' then
      raise exception 'Loja não encontrada.' using errcode = '22023';
    end if;
    regiao := v.microrregiao_id;
    alvo_id := v.id;
  end if;
  if v.status <> 'ativa' then
    raise exception 'Esta loja não está ativa.' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('olaki:destaque:' || t.slug || ':' || regiao::text, 0));
  if t.vagas_por_regiao is not null and not coalesce(p_ignorar_vagas, false)
     and public.destaque_vagas_ocupadas(t.slug, regiao, alvo_id) >= t.vagas_por_regiao then
    raise exception 'As vagas deste destaque estão ocupadas na região. Marque "passar das vagas" se quiser dar assim mesmo.' using errcode = 'P0001';
  end if;

  t := public.destaque_tipo_regiao(t.slug, regiao);
  insert into public.destaques (tipo, anuncio_id, vitrine_id, microrregiao_id, criado_por, origem, status, preco_centavos, dias, motivo)
  values (t.slug, a.id, v.id, regiao, public.usuario_id(), 'cortesia', 'aguardando_pagamento', 0,
          case when t.slug = 'subir' then null else coalesce(p_dias, t.dias) end, left(btrim(p_motivo), 300))
  returning id into d_id;
  perform public.ativar_destaque(d_id);
  return d_id;
end $$;

create or replace function public.cancelar_destaque(p_destaque_id uuid, p_motivo text default null)
returns void language plpgsql security definer
set search_path = public, extensions
as $$
declare d public.destaques;
begin
  if not public.e_admin() then
    raise exception 'Só a equipe OLAKI pode cancelar um destaque.' using errcode = '42501';
  end if;
  select * into d from public.destaques where id = p_destaque_id for update;
  if d.id is null then
    raise exception 'Destaque não encontrado.' using errcode = '22023';
  end if;
  if d.status not in ('ativo', 'aguardando_pagamento') then
    return;   -- já encerrado ou cancelado
  end if;
  perform public.devolver_tempo_destaque(d);
  update public.destaques
     set status = 'cancelado', fim = case when fim is not null then least(fim, now()) end, reservado_ate = null,
         cancelado_pela_equipe = true,
         motivo = coalesce(nullif(left(btrim(coalesce(p_motivo, '')), 300), ''), 'Cancelado pela equipe')
   where id = d.id;
  update public.pagamentos set status = 'cancelado' where id = d.pagamento_id and status = 'pendente';
end $$;

-- ---------------------------------------------------------------------
-- 10. Resultado para o vendedor (e para o painel)
-- ---------------------------------------------------------------------
-- Visualizações e cliques no WhatsApp dentro da janela do destaque (eventos_anuncio).
-- Vendedor: só os destaques da própria vitrine. Admin: todos, pedindo p_todos = true.
-- Loja em destaque: soma os anúncios da loja.
create or replace function public.resultados_destaques(p_anuncio_id uuid default null, p_todos boolean default false, p_limite integer default 50)
returns table (id uuid, tipo text, tipo_nome text, anuncio_id uuid, anuncio_titulo text, vitrine_id uuid, vitrine_nome text,
               microrregiao_id uuid, origem text, status text, preco_centavos integer, inicio timestamptz, fim timestamptz,
               reservado_ate timestamptz, pagamento_id uuid, pagamento_status text, motivo text, criado_em timestamptz,
               visualizacoes bigint, cliques_whatsapp bigint)
language sql stable security definer
set search_path = public, extensions
as $$
  select d.id, d.tipo, t.nome, d.anuncio_id, a.titulo, d.vitrine_id, v.nome, d.microrregiao_id, d.origem, d.status,
         d.preco_centavos, d.inicio, d.fim, d.reservado_ate, d.pagamento_id, p.status, d.motivo, d.criado_em,
         coalesce(ev.vis, 0), coalesce(ev.cli, 0)
    from public.destaques d
    join public.destaque_tipos t on t.slug = d.tipo
    join public.vitrines_lojas v on v.id = d.vitrine_id
    left join public.anuncios a on a.id = d.anuncio_id
    left join public.pagamentos p on p.id = d.pagamento_id
    left join lateral (
      select count(*) filter (where e.tipo = 'visualizacao')    as vis,
             count(*) filter (where e.tipo = 'clique_whatsapp') as cli
        from public.eventos_anuncio e
       where d.inicio is not null
         and e.criado_em >= d.inicio and e.criado_em < least(d.fim, now())
         and (e.anuncio_id = d.anuncio_id
              or (d.anuncio_id is null and e.anuncio_id in (select x.id from public.anuncios x where x.vitrine_id = d.vitrine_id)))
    ) ev on true
   where public.usuario_id() is not null
     and case when coalesce(p_todos, false) then public.e_admin() else v.dono_id = public.usuario_id() end
     and (p_anuncio_id is null or d.anuncio_id = p_anuncio_id)
   order by (d.status = 'ativo') desc, d.criado_em desc
   limit least(greatest(coalesce(p_limite, 50), 1), 200)
$$;

-- ---------------------------------------------------------------------
-- 11. Página inicial: carrossel "Destaques perto de você" e "Lojas em destaque"
--     Rodízio justo entre quem pagou (muda a cada hora). Sempre "Patrocinado" na tela.
-- ---------------------------------------------------------------------
create or replace function public.destaques_home(p_microrregiao uuid, p_limite integer default 12)
returns setof public.anuncio_card
language sql stable security definer
set search_path = public, extensions
as $$
  with ativos as (
    select distinct d.anuncio_id
      from public.destaques d
     where d.tipo = 'home' and d.status = 'ativo' and d.microrregiao_id = p_microrregiao
       and d.inicio <= now() and d.fim > now()
  )
  select a.id, a.titulo, a.preco_centavos, a.aceita_troca, a.cidade, a.bairro,
         a.fotos[1], a.atributos, coalesce(a.publicado_em, a.criado_em),
         c.slug, c.nome, case when v.tipo = 'pf' then split_part(btrim(v.nome), ' ', 1) else v.nome end,
         v.slug, v.selo_loja_verificada, v.tipo,
         true, count(*) over ()
    from ativos x
    join public.anuncios a on a.id = x.anuncio_id and a.status = 'ativo'
    join public.vitrines_lojas v on v.id = a.vitrine_id and v.status = 'ativa'
    left join public.categorias c on c.id = a.categoria_id
   order by md5(a.id::text || to_char(now() at time zone 'America/Fortaleza', 'YYYYMMDDHH24')), a.id
   limit least(greatest(coalesce(p_limite, 12), 1), 48)
$$;

create or replace function public.lojas_em_destaque(p_microrregiao uuid, p_limite integer default 12)
returns table (id uuid, slug text, nome text, logo_url text, cidade text, selo_loja_verificada boolean)
language sql stable security definer
set search_path = public, extensions
as $$
  with ativas as (
    select distinct d.vitrine_id
      from public.destaques d
     where d.tipo = 'loja' and d.status = 'ativo' and d.microrregiao_id = p_microrregiao
       and d.inicio <= now() and d.fim > now()
  )
  select v.id, v.slug, v.nome, v.logo_url, v.cidade, v.selo_loja_verificada
    from ativas x
    join public.vitrines_lojas v on v.id = x.vitrine_id and v.status = 'ativa' and v.tipo = 'loja'
   order by md5(v.id::text || to_char(now() at time zone 'America/Fortaleza', 'YYYYMMDDHH24')), v.id
   limit least(greatest(coalesce(p_limite, 12), 1), 48)
$$;

-- ---------------------------------------------------------------------
-- 12. Rotina diária: encerra destaques vencidos e cancela pedidos não pagos
-- ---------------------------------------------------------------------
create or replace function public.expirar_destaques()
returns integer language plpgsql security definer
set search_path = public, extensions
as $$
declare
  encerrados integer;
  cancelados integer;
begin
  update public.destaques set status = 'encerrado' where status = 'ativo' and fim <= now();
  get diagnostics encerrados = row_count;

  with c as (
    update public.destaques d
       set status = 'cancelado', motivo = coalesce(d.motivo, 'Não foi pago a tempo')
     where d.status = 'aguardando_pagamento'
       and d.criado_em < now() - make_interval(hours =>
             coalesce(public.numero_ou_nulo(public.config('destaque.cancelar_pendente_horas', d.microrregiao_id, '48')), 48)::int)
    returning d.pagamento_id
  )
  update public.pagamentos p set status = 'cancelado'
    from c where p.id = c.pagamento_id and p.status = 'pendente';
  get diagnostics cancelados = row_count;
  return encerrados;
end $$;

-- Mesma rotina de antes + destaques
create or replace function public.expirar_rotina()
returns void language plpgsql security definer
set search_path = public, extensions
as $$
begin
  update public.radar_pedidos set status = 'encerrado' where status = 'aberto' and expira_em <= now();
  -- Teste/plano vencido: pausa o excedente (mantém os 0 mais recentes = pausa tudo até assinar)
  update public.anuncios a set status = 'pausado'
    from public.vitrines_lojas v
   where a.vitrine_id = v.id and a.status = 'ativo' and public.limite_anuncios(v) = 0;
  perform public.expirar_destaques();
end $$;

-- ---------------------------------------------------------------------
-- 13. Busca: "Subir" leva o anúncio para o topo dos recentes.
--     Mesma assinatura e mesmas colunas; muda só a ordem por data:
--     greatest(publicado_em, subido_em). Destaque na busca continua igual.
-- ---------------------------------------------------------------------
create or replace function public.buscar_anuncios(
  q                 text    default null,
  categoria_slug    text    default null,
  cidade            text    default null,
  preco_min         bigint  default null,
  preco_max         bigint  default null,
  filtros           jsonb   default null,
  ordem             text    default 'relevancia',
  microrregiao_slug text    default null,
  limite            integer default 24,
  deslocamento      integer default 0)
returns setof public.anuncio_card
language sql stable security definer
set search_path = public, extensions
as $$
  with par as (
    select nullif(btrim(buscar_anuncios.q), '')                                  as termo,
           nullif(btrim(buscar_anuncios.categoria_slug), '')                     as cat_slug,
           nullif(public.sem_acento(lower(btrim(buscar_anuncios.cidade))), '')   as cidade_n,
           nullif(btrim(buscar_anuncios.microrregiao_slug), '')                  as reg_slug,
           case when buscar_anuncios.ordem in ('relevancia', 'recentes', 'menor_preco', 'maior_preco')
                then buscar_anuncios.ordem else 'relevancia' end                 as ord,
           coalesce(public.numero_ou_nulo(public.config('busca.similaridade_minima', null, '0.45')), 0.45)::real as sim_min,
           case when jsonb_typeof(buscar_anuncios.filtros) = 'object' then buscar_anuncios.filtros else '{}'::jsonb end as filt,
           to_char(now() at time zone 'America/Fortaleza', 'YYYYMMDD')           as dia
  ),
  consulta as (
    select par.*,
           case when par.termo is not null then websearch_to_tsquery('portuguese', public.sem_acento(par.termo)) end as tsq,
           public.sem_acento(lower(par.termo)) as termo_n,
           (select m.id from public.microrregioes m where m.slug = par.reg_slug) as reg_id
      from par
  ),
  cats as (
    select c.id from public.categorias c, consulta
     where consulta.cat_slug is not null
       and (c.slug = consulta.cat_slug
            or c.pai_id in (select c2.id from public.categorias c2 where c2.slug = consulta.cat_slug))
  ),
  achados as (
    select a.*, consulta.ord, consulta.dia,
           case when consulta.termo is null then 0
                else ts_rank(a.busca, consulta.tsq)
                     + extensions.word_similarity(consulta.termo_n, public.sem_acento(lower(coalesce(a.titulo, ''))))
           end as rel,
           coalesce(a.destaque_ate > now(), false) as em_destaque
      from public.anuncios a
      cross join consulta
     where a.status = 'ativo'
       and (consulta.reg_slug is null or a.microrregiao_id = consulta.reg_id)
       and (consulta.cat_slug is null or a.categoria_id in (select cats.id from cats))
       and (consulta.cidade_n is null or public.sem_acento(lower(a.cidade)) = consulta.cidade_n)
       and (buscar_anuncios.preco_min is null or a.preco_centavos >= buscar_anuncios.preco_min)
       and (buscar_anuncios.preco_max is null or a.preco_centavos <= buscar_anuncios.preco_max)
       and (consulta.termo is null
            or a.busca @@ consulta.tsq
            or extensions.word_similarity(consulta.termo_n, public.sem_acento(lower(coalesce(a.titulo, '')))) >= consulta.sim_min)
       and not exists (
         select 1 from jsonb_each(consulta.filt) f
          where jsonb_typeof(f.value) <> 'null'
            and not (
              case
                when jsonb_typeof(f.value) = 'object' then
                  public.numero_ou_nulo(a.atributos->f.key) is not null
                  and (public.numero_ou_nulo(f.value->'min') is null
                       or public.numero_ou_nulo(a.atributos->f.key) >= public.numero_ou_nulo(f.value->'min'))
                  and (public.numero_ou_nulo(f.value->'max') is null
                       or public.numero_ou_nulo(a.atributos->f.key) <= public.numero_ou_nulo(f.value->'max'))
                when jsonb_typeof(f.value) = 'array' then
                  exists (select 1 from jsonb_array_elements(f.value) e
                           where public.sem_acento(lower(e #>> '{}')) = public.sem_acento(lower(a.atributos->>f.key)))
                else
                  coalesce(public.sem_acento(lower(a.atributos->>f.key)) = public.sem_acento(lower(f.value #>> '{}')), false)
              end))
  )
  select x.id, x.titulo, x.preco_centavos, x.aceita_troca, x.cidade, x.bairro,
         x.fotos[1], x.atributos, coalesce(x.publicado_em, x.criado_em),
         c.slug, c.nome, case when v.tipo = 'pf' then split_part(btrim(v.nome), ' ', 1) else v.nome end,
         v.slug, v.selo_loja_verificada, v.tipo,
         x.em_destaque, count(*) over ()
    from achados x
    join public.vitrines_lojas v on v.id = x.vitrine_id and v.status = 'ativa'
    left join public.categorias c on c.id = x.categoria_id
   order by x.em_destaque desc,
            case when x.em_destaque then md5(x.id::text || x.dia) end,     -- rodízio justo entre quem pagou (muda a cada dia)
            case when x.ord = 'menor_preco' then x.preco_centavos end asc nulls last,
            case when x.ord = 'maior_preco' then x.preco_centavos end desc nulls last,
            case when x.ord = 'relevancia' then x.rel end desc,
            greatest(coalesce(x.publicado_em, x.criado_em), coalesce(x.subido_em, '-infinity'::timestamptz)) desc,  -- "Subir"
            x.id
   limit least(greatest(coalesce(buscar_anuncios.limite, 24), 1), 48)
  offset greatest(coalesce(buscar_anuncios.deslocamento, 0), 0)
$$;

-- ---------------------------------------------------------------------
-- 14. Endurecimento (mesmo estilo da migração anterior)
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
revoke all on function public.destaque_vagas_ocupadas(text, uuid, uuid) from public, anon, authenticated;
revoke all on function public.destaque_creditos_restantes(uuid, text) from public, anon, authenticated;
revoke all on function public.ativar_destaque(uuid) from public, anon, authenticated;
revoke all on function public.ativar_destaque_pago(uuid) from public, anon, authenticated;
revoke all on function public.destaque_tipo_regiao(text, uuid) from public, anon, authenticated;
revoke all on function public.devolver_tempo_destaque(public.destaques) from public, anon, authenticated;

-- Só o servidor (webhook do Asaas, rotina diária)
revoke all on function public.confirmar_pagamento(text, jsonb) from public, anon, authenticated;
revoke all on function public.cancelar_pagamento(text, text, jsonb) from public, anon, authenticated;
revoke all on function public.registrar_cobranca_asaas(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.marcar_consulta_asaas(uuid) from public, anon, authenticated;
revoke all on function public.expirar_destaques() from public, anon, authenticated;
revoke all on function public.expirar_rotina() from public, anon, authenticated;
grant execute on function public.confirmar_pagamento(text, jsonb), public.cancelar_pagamento(text, text, jsonb),
  public.registrar_cobranca_asaas(uuid, text, text, text), public.marcar_consulta_asaas(uuid),
  public.expirar_destaques(), public.expirar_rotina() to service_role;

-- Pessoa logada (a função confere dono ou admin por dentro)
revoke all on function public.opcoes_destaque(uuid) from public, anon;
revoke all on function public.contratar_destaque(text, uuid, boolean) from public, anon;
revoke all on function public.resultados_destaques(uuid, boolean, integer) from public, anon;
revoke all on function public.conceder_destaque_cortesia(text, uuid, uuid, integer, text, boolean) from public, anon;
revoke all on function public.cancelar_destaque(uuid, text) from public, anon;
grant execute on function public.opcoes_destaque(uuid), public.contratar_destaque(text, uuid, boolean),
  public.resultados_destaques(uuid, boolean, integer), public.conceder_destaque_cortesia(text, uuid, uuid, integer, text, boolean),
  public.cancelar_destaque(uuid, text) to authenticated;

-- Público por desenho (página inicial)
revoke all on function public.destaques_home(uuid, integer) from public;
revoke all on function public.lojas_em_destaque(uuid, integer) from public;
grant execute on function public.destaques_home(uuid, integer), public.lojas_em_destaque(uuid, integer) to anon, authenticated;
revoke all on function public.buscar_anuncios(text, text, text, bigint, bigint, jsonb, text, text, integer, integer) from public;
grant execute on function public.buscar_anuncios(text, text, text, bigint, bigint, jsonb, text, text, integer, integer) to anon, authenticated;
