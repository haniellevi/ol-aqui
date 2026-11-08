-- =====================================================================
-- OLAKI · Migração: cobrança de planos e do anúncio avulso pelo Asaas
-- + telas 5 (Lojistas e vitrines) e 6 (Pagamentos) do painel.
-- Base: PAINEL-ADMIN.md (telas 2, 5 e 6), regras do topo de
-- 20261107010100_painel_admin.sql e docs/etapa4/cobranca.md.
--
-- Usa a mesma integração do Asaas dos destaques: mesma tabela pagamentos,
-- mesmo registrar_cobranca_asaas, marcar_consulta_asaas, confirmar_pagamento
-- e cancelar_pagamento (o comportamento dos destaques não muda).
-- Regra de ouro mantida: preço, períodos, descontos, prazos e limites vêm de
-- planos e configuracoes (editáveis no painel, com histórico).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Configurações novas (todas editáveis no painel, com exceção por região)
-- ---------------------------------------------------------------------
insert into public.configuracoes (chave, valor, grupo, publico, descricao) values
  ('assinatura.periodos', '[{"meses": 1, "desconto_percentual": 0}]', 'planos', true,
   'Períodos que a loja pode pagar de uma vez. "meses" = quantos períodos do plano; "desconto_percentual" = desconto no total. Ex.: para trimestral com 10% acrescente {"meses": 3, "desconto_percentual": 10}'),
  ('assinatura.aviso_vencimento_dias', '7', 'planos', true,
   'Dias antes do vencimento do plano em que "Meu plano" mostra o aviso para renovar'),
  ('cobranca.pendentes_max', '5', 'cobranca', false,
   'Máximo de cobranças de plano e de anúncio avulso esperando pagamento por vendedor ao mesmo tempo'),
  ('cobranca.cancelar_pendente_horas', '72', 'cobranca', false,
   'Horas até a rotina diária cancelar uma cobrança de plano ou anúncio avulso que não foi paga (se o Pix antigo for pago depois, vale assim mesmo)'),
  ('avulso.publico', '"pf"', 'planos', true,
   'Quem pode pagar anúncio avulso: pf (só quem vende como pessoa) ou todos')
on conflict do nothing;

-- ---------------------------------------------------------------------
-- 1. Colunas novas
-- ---------------------------------------------------------------------
alter table public.pagamentos
  add column meses            integer check (meses between 1 and 36),          -- períodos do plano pagos de uma vez
  add column regra            text check (regra in ('inicio', 'renovacao', 'troca_agora', 'proximo_periodo', 'renovacao_proximo')),
  add column concedido_de     timestamptz,                                      -- janela que o pagamento deu
  add column concedido_ate    timestamptz,
  add column plano_anterior   text,                                             -- como estava antes (devolução volta)
  add column expira_anterior  timestamptz,
  add column observacao       text check (char_length(observacao) <= 300),      -- nota do sistema para a equipe
  add column criado_por       text references public.perfis(id) on delete set null;
create index pagamentos_tipo_status_idx on public.pagamentos (tipo, status, criado_em desc);

-- Plano menor já pago que começa quando o período atual acaba (troca para baixo).
-- Sem chave estrangeira de propósito: uma segunda ligação vitrines_lojas↔planos e
-- vitrines_lojas↔pagamentos deixaria ambíguos os "select" com tabela embutida da API
-- (ex.: pagamentos?select=vitrines_lojas(nome)). Só o sistema grava estas colunas
-- (gatilho vitrines_3_proteger_assinatura), sempre com plano e pagamento que existem.
alter table public.vitrines_lojas
  add column plano_proximo              text,
  add column plano_proximo_ate          timestamptz,
  add column plano_proximo_pagamento_id uuid,
  add constraint vitrines_proximo_junto check ((plano_proximo is null) = (plano_proximo_ate is null));

-- O dono não grava o plano marcado para depois (só o sistema e o admin)
create or replace function public.proteger_assinatura()
returns trigger language plpgsql
set search_path = public, extensions
as $$
begin
  if public.acesso_sistema() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.plano_proximo := null;
    new.plano_proximo_ate := null;
    new.plano_proximo_pagamento_id := null;
  else
    new.plano_proximo := old.plano_proximo;
    new.plano_proximo_ate := old.plano_proximo_ate;
    new.plano_proximo_pagamento_id := old.plano_proximo_pagamento_id;
  end if;
  return new;
end $$;
create trigger vitrines_3_proteger_assinatura before insert or update on public.vitrines_lojas
  for each row execute function public.proteger_assinatura();

-- ---------------------------------------------------------------------
-- 2. Ações do painel nas lojas (sempre com motivo). Só a função escreve.
-- ---------------------------------------------------------------------
create table public.vitrines_acoes_admin (
  id          uuid primary key default gen_random_uuid(),
  vitrine_id  uuid not null references public.vitrines_lojas(id) on delete cascade,
  admin_id    text references public.perfis(id) on delete set null,
  acao        text not null check (acao in ('cortesia', 'trocar_plano', 'suspender', 'reativar', 'dar_selo', 'tirar_selo')),
  motivo      text not null check (char_length(btrim(motivo)) between 3 and 300),
  detalhes    jsonb not null default '{}'::jsonb,
  criado_em   timestamptz not null default now()
);
create index vitrines_acoes_admin_idx on public.vitrines_acoes_admin (vitrine_id, criado_em desc);
alter table public.vitrines_acoes_admin enable row level security;
create policy "acoes admin leitura" on public.vitrines_acoes_admin for select using (public.e_admin());
revoke all on public.vitrines_acoes_admin from anon, authenticated;
grant select on public.vitrines_acoes_admin to authenticated;   -- a policy deixa só o admin
create trigger log_vitrines_acoes_admin after insert on public.vitrines_acoes_admin
  for each row execute function public.registrar_log();

-- Verificações (documento, selfie, CNPJ): a análise do painel fica no histórico
create trigger log_perfis_verificacoes after insert or update on public.perfis_verificacoes
  for each row execute function public.registrar_log();

-- Conta suspensa não põe anúncio no ar (nem com avulso pago, nem aprovado pela moderação).
-- Vale para todos, até o sistema: para voltar, a equipe reativa a conta no painel.
create or replace function public.barrar_anuncio_conta_suspensa()
returns trigger language plpgsql security definer
set search_path = public, extensions
as $$
begin
  if (new.status = 'ativo' and (tg_op = 'INSERT' or old.status <> 'ativo'))
     or (new.status = 'em_analise' and (tg_op = 'INSERT' or old.status not in ('ativo', 'em_analise'))) then
    if exists (select 1 from public.vitrines_lojas v where v.id = new.vitrine_id and v.status = 'suspensa') then
      raise exception 'Sua conta de vendedor está suspensa. Fale com o suporte.' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger anuncios_1_conta_suspensa before insert or update of status on public.anuncios
  for each row execute function public.barrar_anuncio_conta_suspensa();

-- ---------------------------------------------------------------------
-- 3. Utilitários internos
-- ---------------------------------------------------------------------

-- Plano marcado para depois que já começou: passa a valer (só na memória; quem grava é materializar_proximo).
create or replace function public.vitrine_com_proximo(v public.vitrines_lojas)
returns public.vitrines_lojas language plpgsql stable
set search_path = public, extensions
as $$
begin
  if v.plano_proximo is not null and coalesce(v.plano_expira_em, '-infinity'::timestamptz) <= now()
     and exists (select 1 from public.planos x where x.codigo = v.plano_proximo) then
    v.plano := v.plano_proximo;
    v.plano_expira_em := v.plano_proximo_ate;
    v.plano_proximo := null;
    v.plano_proximo_ate := null;
    v.plano_proximo_pagamento_id := null;
  end if;
  return v;
end $$;

-- Grava a troca marcada que já começou (rotina diária, confirmação, devolução e painel)
create or replace function public.materializar_proximo(p_vitrine uuid)
returns void language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v     public.vitrines_lojas;
  antes text := coalesce(current_setting('olaki.sistema', true), '');
begin
  select * into v from public.vitrines_lojas where id = p_vitrine for update;
  if v.id is null or v.plano_proximo is null or coalesce(v.plano_expira_em, '-infinity'::timestamptz) > now() then
    return;
  end if;
  perform set_config('olaki.sistema', '1', true);
  if exists (select 1 from public.planos x where x.codigo = v.plano_proximo) then
    update public.vitrines_lojas
       set plano = v.plano_proximo, plano_expira_em = v.plano_proximo_ate,
           plano_proximo = null, plano_proximo_ate = null, plano_proximo_pagamento_id = null
     where id = v.id;
  else
    -- o plano marcado saiu da tabela: desmarca (sem quebrar a rotina diária)
    update public.vitrines_lojas
       set plano_proximo = null, plano_proximo_ate = null, plano_proximo_pagamento_id = null
     where id = v.id;
  end if;
  perform set_config('olaki.sistema', antes, true);
end $$;

-- Mesma regra de antes + a troca marcada que já começou vale na hora (sem esperar a rotina)
create or replace function public.plano_efetivo(v public.vitrines_lojas)
returns public.planos language plpgsql stable security definer
set search_path = public, extensions
as $$
declare
  p    public.planos;
  tipo public.tipo_pessoa;
begin
  v := public.vitrine_com_proximo(v);
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

-- Períodos que dá para pagar de uma vez (config assinatura.periodos). Aceita [{"meses":3,"desconto_percentual":10}]
-- ou só números ([1, 3]). Valor inválido é ignorado; sem nenhum válido, fica o mensal.
create or replace function public.periodos_assinatura(p_regiao uuid)
returns table (meses integer, desconto_percentual numeric)
language plpgsql stable security definer
set search_path = public, extensions
as $$
declare
  lista  jsonb := public.config('assinatura.periodos', p_regiao, '[{"meses": 1, "desconto_percentual": 0}]');
  item   jsonb;
  m      numeric;
  d      numeric;
  vistos integer[] := '{}';
begin
  if jsonb_typeof(lista) = 'array' then
    for item in select x from jsonb_array_elements(lista) x loop
      if jsonb_typeof(item) = 'object' then
        m := public.numero_ou_nulo(item->'meses');
        d := coalesce(public.numero_ou_nulo(item->'desconto_percentual'), 0);
      else
        m := public.numero_ou_nulo(item);
        d := 0;
      end if;
      if m is not null and m = trunc(m) and m between 1 and 36 and d between 0 and 90 and not (m::int = any (vistos)) then
        vistos := vistos || m::int;
        meses := m::int;
        desconto_percentual := round(d, 2);
        return next;
      end if;
    end loop;
  end if;
  if cardinality(vistos) = 0 then
    meses := 1;
    desconto_percentual := 0;
    return next;
  end if;
end $$;

-- Plano à venda para a vitrine: ativo, pago, não é teste e o público combina (loja: todos/pj; pessoa: todos/pf)
create or replace function public.plano_a_venda(p public.planos, v public.vitrines_lojas)
returns boolean language sql stable
set search_path = public, extensions
as $$
  select p.codigo is not null and p.ativo and not p.e_teste and p.preco_centavos > 0
     and (p.publico = 'todos' or p.publico = case when v.tipo = 'loja' then 'pj' else 'pf' end)
$$;

-- Como um pagamento de plano entra (calculado de novo na confirmação, com a situação daquele momento):
--  inicio            sem plano pago valendo (teste, grátis, vencido): de agora até agora + dias
--  renovacao         mesmo plano: soma a partir do vencimento atual
--  troca_agora       plano maior (preço por dia maior ou igual): começa agora; os dias que faltavam não passam
--  proximo_periodo   plano menor: começa quando o atual acaba
--  renovacao_proximo o mesmo plano já marcado para depois: soma no fim dele
-- motivo preenchido = não dá (já tem outra troca marcada).
create or replace function public.periodo_assinatura(v public.vitrines_lojas, p public.planos, p_dias integer)
returns table (regra text, inicio timestamptz, fim timestamptz, motivo text)
language plpgsql stable security definer
set search_path = public, extensions
as $$
declare
  atual   public.planos;
  prox    public.planos;
  vigente boolean;
  dias    interval := make_interval(days => greatest(coalesce(p_dias, 1), 1));
begin
  v := public.vitrine_com_proximo(v);
  if v.plano_proximo is not null then
    if p.codigo = v.plano_proximo then
      return query select 'renovacao_proximo'::text, v.plano_proximo_ate, v.plano_proximo_ate + dias, null::text;
      return;
    end if;
    select * into prox from public.planos where codigo = v.plano_proximo;
    return query select null::text, null::timestamptz, null::timestamptz,
      format('Você já pagou o %s para começar em %s. Para mudar de novo, fale com o suporte do OLAKI.',
             coalesce(prox.nome, v.plano_proximo), to_char(v.plano_expira_em at time zone 'America/Fortaleza', 'DD/MM/YYYY'));
    return;
  end if;

  select * into atual from public.planos where codigo = v.plano;
  vigente := atual.codigo is not null and not atual.e_teste and atual.preco_centavos > 0
             and coalesce(v.plano_expira_em, '-infinity'::timestamptz) > now();
  if not vigente then
    return query select 'inicio'::text, now(), now() + dias, null::text;
  elsif p.codigo = atual.codigo then
    return query select 'renovacao'::text, v.plano_expira_em, v.plano_expira_em + dias, null::text;
  elsif p.preco_centavos::numeric / p.periodo_dias >= atual.preco_centavos::numeric / atual.periodo_dias then
    return query select 'troca_agora'::text, now(), now() + dias, null::text;
  else
    return query select 'proximo_periodo'::text, v.plano_expira_em, v.plano_expira_em + dias, null::text;
  end if;
end $$;

-- Cabe no plano sem contar como avulso? (outros anúncios no ar que contam no limite < limite)
create or replace function public.anuncio_cabe_no_plano(p_anuncio uuid)
returns boolean language plpgsql stable security definer
set search_path = public, extensions
as $$
declare
  a      public.anuncios;
  v      public.vitrines_lojas;
  lim    integer;
  ativos integer;
begin
  select * into a from public.anuncios where id = p_anuncio;
  select * into v from public.vitrines_lojas where id = a.vitrine_id;
  if a.id is null or v.id is null then return false; end if;
  lim := public.limite_anuncios(v);
  if lim is null then return true; end if;
  select count(*) into ativos from public.anuncios x
   where x.vitrine_id = v.id and x.status = 'ativo' and x.id <> a.id
     and (x.pago_ate is null or x.pago_ate <= now());
  return ativos < lim;
end $$;

-- Cobranças de plano/avulso esperando pagamento (recentes) da vitrine
create or replace function public.cobrancas_pendentes(p_vitrine uuid, p_regiao uuid)
returns integer language sql stable security definer
set search_path = public, extensions
as $$
  select count(*)::int from public.pagamentos x
   where x.vitrine_id = p_vitrine and x.tipo in ('assinatura', 'anuncio_avulso') and x.status = 'pendente'
     and x.criado_em > now() - make_interval(hours =>
           greatest(coalesce(public.numero_ou_nulo(public.config('cobranca.cancelar_pendente_horas', p_regiao, '72')), 72)::int, 1))
$$;

-- ---------------------------------------------------------------------
-- 4. Meu plano: situação, opções e pedido de cobrança (pessoa logada)
-- ---------------------------------------------------------------------
create or replace function public.minha_assinatura()
returns table (vitrine_id uuid, tipo text, status text, situacao text, plano text, plano_nome text, e_teste boolean,
               preco_centavos integer, vence_em timestamptz, plano_proximo text, plano_proximo_nome text,
               plano_proximo_inicio timestamptz, plano_proximo_ate timestamptz, aviso_dias integer, renovar_agora boolean)
language plpgsql stable security definer
set search_path = public, extensions
as $$
declare
  v   public.vitrines_lojas;
  p   public.planos;
  px  public.planos;
  sit text;
  ven timestamptz;
  av  integer;
begin
  if public.usuario_id() is null then return; end if;
  select * into v from public.vitrines_lojas x where x.dono_id = public.usuario_id();
  if v.id is null then return; end if;
  v := public.vitrine_com_proximo(v);
  select * into p from public.planos x where x.codigo = v.plano;
  select * into px from public.planos x where x.codigo = v.plano_proximo;
  if v.status = 'suspensa' then sit := 'suspensa';
  elsif v.status = 'inadimplente' then sit := 'inadimplente';
  elsif p.e_teste then sit := case when v.teste_expira_em > now() then 'teste' else 'teste_vencido' end; ven := v.teste_expira_em;
  elsif p.preco_centavos > 0 then sit := case when v.plano_expira_em > now() then 'ativa' else 'vencida' end; ven := v.plano_expira_em;
  else sit := 'gratis';
  end if;
  av := greatest(coalesce(public.numero_ou_nulo(public.config('assinatura.aviso_vencimento_dias', v.microrregiao_id, '7')), 7)::int, 0);
  return query select v.id, v.tipo, v.status::text, sit, v.plano, p.nome, coalesce(p.e_teste, false), coalesce(p.preco_centavos, 0), ven,
    v.plano_proximo, px.nome, case when v.plano_proximo is not null then v.plano_expira_em end, v.plano_proximo_ate, av,
    (sit in ('ativa', 'teste') and ven is not null and ven <= now() + make_interval(days => av)) or sit in ('vencida', 'teste_vencido');
end $$;

-- Planos à venda × períodos, com valor e como o pagamento vai entrar (mostrado ANTES de pagar)
create or replace function public.opcoes_assinatura()
returns table (codigo text, nome text, descricao text, preco_centavos integer, periodo_dias integer, limite_anuncios integer,
               acesso_radar boolean, propostas_radar_mes integer, recomendado boolean, ordem integer,
               meses integer, desconto_percentual numeric, valor_centavos integer, dias integer,
               regra text, inicio timestamptz, fim timestamptz, atual boolean, disponivel boolean, motivo text)
language plpgsql stable security definer
set search_path = public, extensions
as $$
declare
  v     public.vitrines_lojas;
  p     public.planos;
  per   record;
  r     record;
  ef    public.planos;
begin
  if public.usuario_id() is null then return; end if;
  select * into v from public.vitrines_lojas x where x.dono_id = public.usuario_id();
  if v.id is null then return; end if;
  ef := public.plano_efetivo(v);
  for p in select * from public.planos x order by x.ordem, x.codigo loop
    continue when not public.plano_a_venda(p, v);
    for per in select * from public.periodos_assinatura(v.microrregiao_id) pa order by pa.meses loop
      select * into r from public.periodo_assinatura(v, p, p.periodo_dias * per.meses);
      codigo := p.codigo; nome := p.nome; descricao := p.descricao; preco_centavos := p.preco_centavos;
      periodo_dias := p.periodo_dias; limite_anuncios := p.limite_anuncios; acesso_radar := p.acesso_radar;
      propostas_radar_mes := p.propostas_radar_mes; recomendado := p.recomendado; ordem := p.ordem;
      meses := per.meses; desconto_percentual := per.desconto_percentual;
      valor_centavos := round(p.preco_centavos::numeric * per.meses * (100 - per.desconto_percentual) / 100)::int;
      dias := p.periodo_dias * per.meses;
      regra := r.regra; inicio := r.inicio; fim := r.fim;
      atual := ef.codigo is not distinct from p.codigo and not coalesce(ef.e_teste, false) and ef.preco_centavos > 0;
      if v.status = 'suspensa' then
        disponivel := false; motivo := 'Sua conta de vendedor está suspensa. Fale com o suporte.';
      else
        disponivel := r.motivo is null; motivo := r.motivo;
      end if;
      return next;
    end loop;
  end loop;
end $$;

-- Pede a cobrança de um plano. O servidor cria a cobrança no Asaas depois (registrar_cobranca_asaas).
-- Pedido igual que ainda espera pagamento é devolvido; outras cobranças de plano pendentes da mesma
-- vitrine são canceladas (os ids do Asaas voltam em "cancelados" para o servidor apagar lá).
create or replace function public.pedir_assinatura(p_plano text, p_meses integer default 1)
returns table (pagamento_id uuid, valor_centavos integer, regra text, inicio timestamptz, fim timestamptz, cancelados text[])
language plpgsql security definer
set search_path = public, extensions
as $$
#variable_conflict use_column
declare
  uid    text := public.usuario_id();
  v      public.vitrines_lojas;
  p      public.planos;
  desc_p numeric;
  r      record;
  valor  integer;
  venc   integer;
  maximo integer;
  pg     public.pagamentos;
  canc   text[];
begin
  if uid is null then
    raise exception 'Entre na sua conta para assinar.' using errcode = '28000';
  end if;
  select * into v from public.vitrines_lojas x where x.dono_id = uid for update;
  if v.id is null then
    raise exception 'Você ainda não vende no OLAKI.' using errcode = '42501';
  end if;
  if v.status = 'suspensa' then
    raise exception 'Sua conta de vendedor está suspensa. Fale com o suporte.' using errcode = '42501';
  end if;
  select * into p from public.planos x where x.codigo = p_plano;
  if not coalesce(public.plano_a_venda(p, v), false) then
    raise exception 'Este plano não está à venda agora.' using errcode = 'P0001';
  end if;
  select pa.desconto_percentual into desc_p from public.periodos_assinatura(v.microrregiao_id) pa where pa.meses = p_meses;
  if desc_p is null then
    raise exception 'Escolha um dos períodos da lista.' using errcode = '22023';
  end if;
  select * into r from public.periodo_assinatura(v, p, p.periodo_dias * p_meses);
  if r.motivo is not null then
    raise exception using errcode = 'P0001', message = r.motivo;
  end if;
  valor := round(p.preco_centavos::numeric * p_meses * (100 - desc_p) / 100)::int;
  if valor <= 0 then
    raise exception 'Este plano não está à venda agora.' using errcode = 'P0001';
  end if;

  select * into pg from public.pagamentos x
   where x.vitrine_id = v.id and x.tipo = 'assinatura' and x.status = 'pendente'
     and x.plano_codigo = p.codigo and x.meses = p_meses and x.valor_centavos = valor
   order by x.criado_em desc limit 1;

  with c as (
    update public.pagamentos x set status = 'cancelado', observacao = coalesce(x.observacao, 'Trocou por outra escolha de plano')
     where x.vitrine_id = v.id and x.tipo = 'assinatura' and x.status = 'pendente' and x.id is distinct from pg.id
    returning x.asaas_cobranca_id
  )
  select coalesce(array_agg(c.asaas_cobranca_id) filter (where c.asaas_cobranca_id is not null), '{}') into canc from c;

  if pg.id is null then
    maximo := greatest(coalesce(public.numero_ou_nulo(public.config('cobranca.pendentes_max', v.microrregiao_id, '5')), 5)::int, 1);
    if public.cobrancas_pendentes(v.id, v.microrregiao_id) >= maximo then
      raise exception 'Você tem muitas cobranças esperando pagamento. Pague uma delas ou espere um pouco.' using errcode = 'P0001';
    end if;
    venc := greatest(coalesce(public.numero_ou_nulo(public.config('cobranca.vencimento_dias', v.microrregiao_id, '1')), 1)::int, 0);
    insert into public.pagamentos (vitrine_id, microrregiao_id, tipo, plano_codigo, meses, valor_centavos, status, vencimento,
                                   repasse_percentual, criado_por)
    values (v.id, v.microrregiao_id, 'assinatura', p.codigo, p_meses, valor, 'pendente',
            (now() at time zone 'America/Fortaleza')::date + venc,
            (select m.repasse_percentual from public.microrregioes m where m.id = v.microrregiao_id), uid)
    returning * into pg;
  end if;
  return query select pg.id, pg.valor_centavos, r.regra, r.inicio, r.fim, canc;
end $$;

-- Pede a cobrança do anúncio avulso de um rascunho (ou anúncio pausado/expirado) completo.
-- Preço e dias: avulso.preco_centavos / avulso.dias (por região). Preço 0 ou vazio = desligado.
create or replace function public.pedir_anuncio_avulso(p_anuncio_id uuid)
returns table (pagamento_id uuid, valor_centavos integer, dias integer)
language plpgsql security definer
set search_path = public, extensions
as $$
#variable_conflict use_column
declare
  uid     text := public.usuario_id();
  v       public.vitrines_lojas;
  a       public.anuncios;
  cat     public.categorias;
  quem    text;
  preco   integer;
  ndias   integer;
  minimo  integer;
  maximo  integer;
  venc    integer;
  pg      public.pagamentos;
begin
  if uid is null then
    raise exception 'Entre na sua conta para continuar.' using errcode = '28000';
  end if;
  select * into v from public.vitrines_lojas x where x.dono_id = uid for update;
  if v.id is not null then
    select * into a from public.anuncios x where x.id = p_anuncio_id and x.vitrine_id = v.id for update;
  end if;
  if a.id is null then
    raise exception 'Anúncio não encontrado.' using errcode = '42501';
  end if;
  if v.status = 'suspensa' then
    raise exception 'Sua conta de vendedor está suspensa. Fale com o suporte.' using errcode = '42501';
  end if;
  quem := coalesce(public.config('avulso.publico', v.microrregiao_id, '"pf"') #>> '{}', 'pf');
  if quem <> 'todos' and v.tipo <> 'pf' then
    raise exception 'O anúncio avulso é para quem vende como pessoa. Lojas escolhem um plano em Meu plano.' using errcode = 'P0001';
  end if;
  preco := public.numero_ou_nulo(public.config('avulso.preco_centavos', v.microrregiao_id, 'null'))::int;
  ndias := public.numero_ou_nulo(public.config('avulso.dias', v.microrregiao_id, '30'))::int;
  if preco is null or preco <= 0 or ndias is null or ndias < 1 then
    raise exception 'O anúncio avulso não está disponível agora.' using errcode = 'P0001';
  end if;
  if a.status = 'ativo' then
    raise exception 'Este anúncio já está no ar.' using errcode = 'P0001';
  end if;
  if a.status not in ('rascunho', 'pausado', 'expirado') then
    raise exception 'Este anúncio não pode ser publicado agora.' using errcode = 'P0001';
  end if;
  if a.pago_ate > now() then
    raise exception 'Este anúncio já está pago. Toque em Publicar.' using errcode = 'P0001';
  end if;

  -- Só cobra anúncio completo (o mesmo que o banco pede para publicar)
  if a.categoria_id is null then
    raise exception using errcode = '23514', message = 'Escolha a categoria do anúncio.', detail = 'campo:categoria';
  end if;
  if coalesce(char_length(btrim(a.titulo)), 0) < 5 then
    raise exception using errcode = '23514', message = 'Escreva um título com pelo menos 5 letras.', detail = 'campo:titulo';
  end if;
  if nullif(btrim(a.cidade), '') is null then
    raise exception using errcode = '23514', message = 'Informe a cidade onde está o produto.', detail = 'campo:cidade';
  end if;
  minimo := coalesce(public.numero_ou_nulo(public.config('anuncio.fotos_minimo', v.microrregiao_id, '1')), 0)::int;
  if coalesce(cardinality(a.fotos), 0) < minimo then
    raise exception using errcode = '23514', detail = 'campo:fotos',
      message = case when minimo = 1 then 'Coloque pelo menos 1 foto no anúncio.' else format('Coloque pelo menos %s fotos no anúncio.', minimo) end;
  end if;
  select * into cat from public.categorias c where c.id = a.categoria_id;
  perform public.normalizar_atributos(cat.campos, a.atributos, true);

  if public.anuncio_cabe_no_plano(a.id) then
    raise exception 'Você ainda tem vaga no seu plano. Volte e toque em Publicar.' using errcode = 'P0001';
  end if;

  select * into pg from public.pagamentos x
   where x.vitrine_id = v.id and x.tipo = 'anuncio_avulso' and x.anuncio_id = a.id and x.status = 'pendente' and x.valor_centavos = preco
   order by x.criado_em desc limit 1;
  update public.pagamentos x set status = 'cancelado', observacao = coalesce(x.observacao, 'O preço do avulso mudou')
   where x.vitrine_id = v.id and x.tipo = 'anuncio_avulso' and x.anuncio_id = a.id and x.status = 'pendente' and x.id is distinct from pg.id;

  if pg.id is null then
    maximo := greatest(coalesce(public.numero_ou_nulo(public.config('cobranca.pendentes_max', v.microrregiao_id, '5')), 5)::int, 1);
    if public.cobrancas_pendentes(v.id, v.microrregiao_id) >= maximo then
      raise exception 'Você tem muitas cobranças esperando pagamento. Pague uma delas ou espere um pouco.' using errcode = 'P0001';
    end if;
    venc := greatest(coalesce(public.numero_ou_nulo(public.config('cobranca.vencimento_dias', v.microrregiao_id, '1')), 1)::int, 0);
    insert into public.pagamentos (vitrine_id, microrregiao_id, tipo, anuncio_id, valor_centavos, status, vencimento, repasse_percentual, criado_por)
    values (v.id, v.microrregiao_id, 'anuncio_avulso', a.id, preco, 'pendente',
            (now() at time zone 'America/Fortaleza')::date + venc,
            (select m.repasse_percentual from public.microrregioes m where m.id = v.microrregiao_id), uid)
    returning * into pg;
  end if;
  return query select pg.id, pg.valor_centavos, ndias;
end $$;

-- Antes de criar a cobrança no Asaas de um pagamento que já existia (a pessoa voltou com ?p=):
-- confere de novo o que pedir_* conferiu. Devolve null quando pode cobrar, ou o motivo em
-- palavras simples. Só o dono do pagamento pergunta (outro usuário: "não encontrado").
create or replace function public.cobranca_pode_seguir(p_pagamento_id uuid)
returns text language plpgsql stable security definer
set search_path = public, extensions
as $$
declare
  uid text := public.usuario_id();
  pg  public.pagamentos;
  v   public.vitrines_lojas;
  a   public.anuncios;
  p   public.planos;
begin
  if uid is null then
    raise exception 'Entre na sua conta para continuar.' using errcode = '28000';
  end if;
  select * into pg from public.pagamentos x where x.id = p_pagamento_id;
  select * into v from public.vitrines_lojas x where x.id = pg.vitrine_id;
  if pg.id is null or v.dono_id is distinct from uid or pg.tipo not in ('assinatura', 'anuncio_avulso') then
    return 'Pagamento não encontrado.';
  end if;
  if pg.status <> 'pendente' then
    return 'Esta cobrança não está mais esperando pagamento. Comece de novo.';
  end if;
  if v.status = 'suspensa' then
    return 'Sua conta de vendedor está suspensa. Fale com o suporte.';
  end if;
  if pg.tipo = 'anuncio_avulso' then
    select * into a from public.anuncios x where x.id = pg.anuncio_id;
    if a.id is null or a.status not in ('rascunho', 'pausado', 'expirado') then
      return 'Este anúncio não precisa mais do avulso.';
    end if;
    if a.pago_ate > now() then
      return 'Este anúncio já está pago. Toque em Publicar.';
    end if;
  else
    select * into p from public.planos x where x.codigo = pg.plano_codigo;
    if not coalesce(public.plano_a_venda(p, v), false) then
      return 'Este plano não está mais à venda. Escolha outro em Meu plano.';
    end if;
  end if;
  return null;
end $$;

-- ---------------------------------------------------------------------
-- 5. Aplicar e desfazer (internas: só confirmar_pagamento / cancelar_pagamento chamam)
-- ---------------------------------------------------------------------
create or replace function public.aplicar_assinatura(p_pagamento_id uuid)
returns void language plpgsql security definer
set search_path = public, extensions
as $$
declare
  pg    public.pagamentos;
  v     public.vitrines_lojas;
  p     public.planos;
  r     record;
  antes text := coalesce(current_setting('olaki.sistema', true), '');
begin
  select * into pg from public.pagamentos where id = p_pagamento_id;
  perform public.materializar_proximo(pg.vitrine_id);
  select * into v from public.vitrines_lojas where id = pg.vitrine_id for update;
  select * into p from public.planos where codigo = pg.plano_codigo;
  if v.id is null or p.codigo is null then
    update public.pagamentos set devolver_motivo = 'Pago sem loja ou plano para ligar' where id = pg.id;
    return;
  end if;
  select * into r from public.periodo_assinatura(v, p, p.periodo_dias * coalesce(pg.meses, 1));
  if r.motivo is not null then
    update public.pagamentos
       set devolver_motivo = 'A loja já tinha outra troca de plano paga. Ver com o lojista: devolver ou trocar no painel.'
     where id = pg.id;
    return;
  end if;

  perform set_config('olaki.sistema', '1', true);
  if r.regra in ('inicio', 'troca_agora') then
    update public.vitrines_lojas
       set plano = p.codigo, plano_expira_em = r.fim,
           status = case when status = 'suspensa' then status else 'ativa'::public.status_vitrine end
     where id = v.id;
  elsif r.regra = 'renovacao' then
    update public.vitrines_lojas
       set plano_expira_em = r.fim,
           status = case when status = 'suspensa' then status else 'ativa'::public.status_vitrine end
     where id = v.id;
  elsif r.regra = 'proximo_periodo' then
    update public.vitrines_lojas
       set plano_proximo = p.codigo, plano_proximo_ate = r.fim, plano_proximo_pagamento_id = pg.id
     where id = v.id;
  else -- renovacao_proximo
    update public.vitrines_lojas set plano_proximo_ate = r.fim, plano_proximo_pagamento_id = pg.id where id = v.id;
  end if;
  update public.pagamentos
     set regra = r.regra, concedido_de = r.inicio, concedido_ate = r.fim,
         plano_anterior = v.plano, expira_anterior = v.plano_expira_em,
         observacao = case when v.status = 'suspensa'
                           then 'Pago com a loja suspensa: o tempo foi somado, mas a loja continua suspensa.' else observacao end
   where id = pg.id;
  perform set_config('olaki.sistema', antes, true);
end $$;

-- Pagamento devolvido (estorno ou contestação): desfaz só o que aquele pagamento deu.
-- Foi o único (início ou troca, e nada veio depois): volta ao plano de antes, que termina na data paga anterior.
-- Senão: tira do vencimento o tempo que ainda faltava daquele pagamento.
create or replace function public.reverter_assinatura(p_pagamento_id uuid)
returns void language plpgsql security definer
set search_path = public, extensions
as $$
declare
  pg     public.pagamentos;
  v      public.vitrines_lojas;
  falta  interval;
  recuo  interval;
  novo   timestamptz;
  antes  text := coalesce(current_setting('olaki.sistema', true), '');
begin
  select * into pg from public.pagamentos where id = p_pagamento_id;
  if pg.concedido_ate is null then return; end if;
  perform public.materializar_proximo(pg.vitrine_id);
  select * into v from public.vitrines_lojas where id = pg.vitrine_id for update;
  if v.id is null then return; end if;
  falta := pg.concedido_ate - greatest(pg.concedido_de, now());
  if falta <= interval '0' then return; end if;   -- o período já tinha sido usado inteiro

  perform set_config('olaki.sistema', '1', true);
  if pg.regra in ('proximo_periodo', 'renovacao_proximo') and v.plano_proximo is not distinct from pg.plano_codigo then
    novo := v.plano_proximo_ate - falta;
    if novo <= coalesce(v.plano_expira_em, now()) then
      update public.vitrines_lojas set plano_proximo = null, plano_proximo_ate = null, plano_proximo_pagamento_id = null where id = v.id;
    else
      update public.vitrines_lojas
         set plano_proximo_ate = novo,
             plano_proximo_pagamento_id = case when plano_proximo_pagamento_id = pg.id then null else plano_proximo_pagamento_id end
       where id = v.id;
    end if;
  elsif v.plano = pg.plano_codigo and v.plano_expira_em is not null then
    -- O plano marcado para depois começa quando o atual acaba: se o atual encurta, ele anda
    -- para trás o mesmo tanto (senão o tempo tirado viraria tempo grátis do plano marcado).
    if pg.regra in ('inicio', 'troca_agora') and v.plano_expira_em = pg.concedido_ate then
      recuo := v.plano_expira_em - greatest(coalesce(pg.expira_anterior, now()), now());
      update public.vitrines_lojas
         set plano = coalesce(pg.plano_anterior, plano), plano_expira_em = pg.expira_anterior
       where id = v.id;
    else
      recuo := falta;
      update public.vitrines_lojas set plano_expira_em = plano_expira_em - falta where id = v.id;
    end if;
    if v.plano_proximo is not null and recuo > interval '0' then
      if v.plano_proximo_ate - recuo <= now() then
        update public.vitrines_lojas set plano_proximo = null, plano_proximo_ate = null, plano_proximo_pagamento_id = null where id = v.id;
      else
        update public.vitrines_lojas set plano_proximo_ate = plano_proximo_ate - recuo where id = v.id;
      end if;
    end if;
  end if;
  perform set_config('olaki.sistema', antes, true);
end $$;

-- Avulso confirmado: estende pago_ate e publica sozinho quando o anúncio está pronto.
-- Se algo impedir (campo que mudou, moderação), fica com pago_ate e o dono toca em Publicar.
create or replace function public.aplicar_anuncio_avulso(p_pagamento_id uuid)
returns void language plpgsql security definer
set search_path = public, extensions
as $$
declare
  pg     public.pagamentos;
  a      public.anuncios;
  v      public.vitrines_lojas;
  ndias  integer;
  minimo integer;
  pronto boolean;
  ini    timestamptz;
  fimp   timestamptz;
  novo   public.status_anuncio;
  antes  text := coalesce(current_setting('olaki.sistema', true), '');
begin
  select * into pg from public.pagamentos where id = p_pagamento_id;
  select * into a from public.anuncios where id = pg.anuncio_id for update;
  select * into v from public.vitrines_lojas where id = a.vitrine_id;
  if a.id is null then
    update public.pagamentos set devolver_motivo = 'O anúncio foi apagado antes do pagamento chegar' where id = pg.id;
    return;
  end if;
  if a.status in ('vendido', 'congelado') then
    update public.pagamentos
       set devolver_motivo = case a.status when 'vendido' then 'O anúncio já estava vendido quando o pagamento chegou'
                                           else 'O anúncio estava congelado quando o pagamento chegou' end
     where id = pg.id;
    return;
  end if;
  ndias := greatest(coalesce(public.numero_ou_nulo(public.config('avulso.dias', pg.microrregiao_id, '30')), 30)::int, 1);
  ini := greatest(coalesce(a.pago_ate, now()), now());
  fimp := ini + make_interval(days => ndias);

  -- Com a flag do sistema os gatilhos de fotos não conferem nada: confere aqui o mínimo para publicar.
  -- Loja suspensa: só soma o tempo (o anúncio fica fora do ar, como em aplicar_assinatura).
  minimo := coalesce(public.numero_ou_nulo(public.config('anuncio.fotos_minimo', a.microrregiao_id, '1')), 0)::int;
  pronto := v.id is not null and v.status <> 'suspensa' and a.categoria_id is not null
            and coalesce(cardinality(a.fotos), 0) >= minimo;

  perform set_config('olaki.sistema', '1', true);
  begin
    update public.anuncios
       set pago_ate = fimp,
           status = case when pronto and status in ('rascunho', 'pausado', 'expirado') then 'ativo'::public.status_anuncio else status end
     where id = a.id
    returning status into novo;
  exception when others then
    update public.anuncios set pago_ate = fimp where id = a.id returning status into novo;
  end;
  update public.pagamentos
     set concedido_de = ini, concedido_ate = fimp,
         observacao = case
           when v.status = 'suspensa' then 'Pago com a conta suspensa: o tempo foi somado, mas o anúncio fica fora do ar.'
           when novo in ('rascunho', 'pausado', 'expirado') then 'Pago. O anúncio não entrou no ar sozinho: falta o dono tocar em Publicar.'
           when novo = 'em_analise' then 'Pago. O anúncio está em análise pela moderação.'
           else observacao end
   where id = pg.id;
  perform set_config('olaki.sistema', antes, true);
end $$;

-- Avulso devolvido: tira o tempo que faltava. Se o pago_ate era o único motivo de estar no ar,
-- o anúncio vai para "pausado" (nunca é apagado).
create or replace function public.reverter_anuncio_avulso(p_pagamento_id uuid)
returns void language plpgsql security definer
set search_path = public, extensions
as $$
declare
  pg    public.pagamentos;
  a     public.anuncios;
  falta interval;
  antes text := coalesce(current_setting('olaki.sistema', true), '');
begin
  select * into pg from public.pagamentos where id = p_pagamento_id;
  if pg.concedido_ate is null then return; end if;
  select * into a from public.anuncios where id = pg.anuncio_id for update;
  if a.id is null then return; end if;
  falta := pg.concedido_ate - greatest(pg.concedido_de, now());
  perform set_config('olaki.sistema', '1', true);
  if falta > interval '0' and a.pago_ate is not null then
    update public.anuncios set pago_ate = pago_ate - falta where id = a.id returning * into a;
  end if;
  if a.status = 'ativo' and coalesce(a.pago_ate, '-infinity'::timestamptz) <= now() and not public.anuncio_cabe_no_plano(a.id) then
    update public.anuncios set status = 'pausado' where id = a.id;
  end if;
  perform set_config('olaki.sistema', antes, true);
end $$;

-- ---------------------------------------------------------------------
-- 6. Confirmação e cancelamento (mesmas assinaturas; destaque igual a antes)
-- ---------------------------------------------------------------------
create or replace function public.confirmar_pagamento(p_asaas_cobranca_id text, p_payload jsonb default null)
returns void language plpgsql security definer
set search_path = public, extensions
as $$
declare
  pg   public.pagamentos;
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
    perform public.aplicar_assinatura(pg.id);
  elsif pg.tipo = 'anuncio_avulso' then
    perform public.aplicar_anuncio_avulso(pg.id);
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
    if pg.tipo = 'destaque' then
      select * into d from public.destaques where pagamento_id = pg.id for update;
      if d.id is not null and d.status in ('ativo', 'aguardando_pagamento') then
        perform public.devolver_tempo_destaque(d);
        update public.destaques
           set status = 'cancelado', fim = case when fim is not null then least(fim, now()) end, motivo = 'Pagamento devolvido'
         where id = d.id;
      end if;
    elsif pg.status = 'pago' and pg.tipo = 'assinatura' then
      perform public.reverter_assinatura(pg.id);
    elsif pg.status = 'pago' and pg.tipo = 'anuncio_avulso' then
      perform public.reverter_anuncio_avulso(pg.id);
    end if;
  else
    if pg.status <> 'pendente' then return; end if;   -- já pago (ou já cancelado): ignora
    update public.pagamentos set status = p_status, payload = coalesce(p_payload, payload) where id = pg.id;
    update public.destaques
       set status = 'cancelado', motivo = case p_status when 'vencido' then 'O pagamento venceu' else 'A cobrança foi cancelada' end
     where pagamento_id = pg.id and status = 'aguardando_pagamento';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 7. Rotina diária: a mesma de antes + troca marcada, avulso vencido e cobrança velha
-- ---------------------------------------------------------------------
create or replace function public.expirar_rotina()
returns void language plpgsql security definer
set search_path = public, extensions
as $$
declare
  vid uuid;
  aid uuid;
begin
  -- plano menor pago que já começou
  for vid in select id from public.vitrines_lojas
              where plano_proximo is not null and coalesce(plano_expira_em, '-infinity'::timestamptz) <= now() loop
    perform public.materializar_proximo(vid);
  end loop;

  update public.radar_pedidos set status = 'encerrado' where status = 'aberto' and expira_em <= now();

  -- avulso vencido: sai do ar só se não couber no plano (o mais antigo primeiro)
  for aid in select id from public.anuncios
              where status = 'ativo' and pago_ate is not null and pago_ate <= now()
              order by pago_ate, id loop
    if not public.anuncio_cabe_no_plano(aid) then
      update public.anuncios set status = 'expirado' where id = aid;
    end if;
  end loop;

  -- Conta suspensa: nada fica no ar (nem avulso pago; o tempo pago continua guardado em pago_ate)
  update public.anuncios a set status = 'pausado'
    from public.vitrines_lojas v
   where a.vitrine_id = v.id and a.status = 'ativo' and v.status = 'suspensa';

  -- Acima do limite do plano (teste/plano vencido = limite 0, ou plano menor que começou):
  -- pausa o excedente e mantém no ar os mais recentes. Avulso pago não conta e não sai.
  update public.anuncios a set status = 'pausado'
    from (select x.id, x.lim, row_number() over (partition by x.vitrine_id
                                                  order by x.publicado_em desc nulls last, x.criado_em desc, x.id) as pos
            from (select an.id, an.vitrine_id, an.publicado_em, an.criado_em, public.limite_anuncios(v) as lim
                    from public.anuncios an
                    join public.vitrines_lojas v on v.id = an.vitrine_id
                   where an.status = 'ativo' and (an.pago_ate is null or an.pago_ate <= now())) x) e
   where a.id = e.id and e.lim is not null and e.pos > e.lim;
  perform public.expirar_destaques();

  -- cobrança de plano/avulso que ninguém pagou (se o Pix antigo for pago depois, confirmar_pagamento aceita)
  update public.pagamentos p
     set status = 'cancelado', observacao = coalesce(p.observacao, 'Não foi paga a tempo')
   where p.tipo in ('assinatura', 'anuncio_avulso') and p.status = 'pendente'
     and p.criado_em < now() - make_interval(hours =>
           greatest(coalesce(public.numero_ou_nulo(public.config('cobranca.cancelar_pendente_horas', p.microrregiao_id, '72')), 72)::int, 1));
end $$;

-- ---------------------------------------------------------------------
-- 8. Painel · tela 5 (Lojistas e vitrines)
-- ---------------------------------------------------------------------
create or replace function public.situacao_vitrine(v public.vitrines_lojas)
returns text language plpgsql stable security definer
set search_path = public, extensions
as $$
declare p public.planos;
begin
  v := public.vitrine_com_proximo(v);
  if v.status = 'suspensa' then return 'suspensa'; end if;
  if v.status = 'inadimplente' then return 'inadimplente'; end if;
  select * into p from public.planos where codigo = v.plano;
  if p.e_teste then return case when v.teste_expira_em > now() then 'teste' else 'teste_vencido' end; end if;
  if p.preco_centavos > 0 then return case when v.plano_expira_em > now() then 'ativa' else 'vencida' end; end if;
  return 'gratis';
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
  termo  text := nullif(btrim(coalesce(p_busca, '')), '');
  digito text := nullif(regexp_replace(coalesce(p_busca, ''), '[^0-9]', '', 'g'), '');
begin
  if not public.e_admin() then
    raise exception 'Só a equipe OLAKI vê esta lista.' using errcode = '42501';
  end if;
  return query
  with base as (
    select v.*, public.situacao_vitrine(v) as sit, public.plano_efetivo(v) as ef, pf.nome as pnome, pf.whatsapp as pfone
      from public.vitrines_lojas v
      join public.perfis pf on pf.id = v.dono_id
     where (p_regiao is null or v.microrregiao_id = p_regiao)
       and (p_tipo is null or v.tipo = p_tipo)
       and (termo is null
            or public.sem_acento(lower(v.nome)) like '%' || public.sem_acento(lower(termo)) || '%'
            or v.slug like '%' || lower(termo) || '%'
            or public.sem_acento(lower(pf.nome)) like '%' || public.sem_acento(lower(termo)) || '%'
            or (digito is not null and char_length(digito) >= 4
                and (coalesce(v.whatsapp, '') like '%' || digito || '%' or coalesce(pf.whatsapp, '') like '%' || digito || '%'
                     or coalesce(v.cnpj, '') like '%' || digito || '%')))
  ),
  filtrada as (
    select b.* from base b where p_situacao is null or b.sit = p_situacao
  )
  select f.id, f.slug, f.nome, f.tipo, f.dono_id, f.pnome, coalesce(f.whatsapp, f.pfone), f.cidade, f.microrregiao_id,
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

-- Ações do painel numa loja. Motivo obrigatório; tudo vai para vitrines_acoes_admin e logs_atividade.
--  cortesia      soma dias ao teste ou ao plano pago que vale (a troca marcada anda junto)
--  trocar_plano  passa para o plano escolhido por N dias (grátis: sem vencimento); desfaz troca marcada
--  suspender / reativar, dar_selo / tirar_selo (Selo Loja Verificada, só lojas)
create or replace function public.admin_acao_loja(
  p_vitrine uuid, p_acao text, p_motivo text, p_dias integer default null, p_plano text default null)
returns void language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v     public.vitrines_lojas;
  depois public.vitrines_lojas;
  p     public.planos;
  extra interval;
  antes text := coalesce(current_setting('olaki.sistema', true), '');
begin
  if not public.e_admin() then
    raise exception 'Só a equipe OLAKI pode fazer isso.' using errcode = '42501';
  end if;
  if p_acao is null or p_acao not in ('cortesia', 'trocar_plano', 'suspender', 'reativar', 'dar_selo', 'tirar_selo') then
    raise exception 'Ação inválida.' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_motivo, ''))) < 3 then
    raise exception 'Escreva o motivo (fica no histórico).' using errcode = '23514';
  end if;
  if p_dias is not null and (p_dias < 1 or p_dias > 365) then
    raise exception 'Os dias devem ficar entre 1 e 365.' using errcode = '23514';
  end if;
  perform public.materializar_proximo(p_vitrine);
  select * into v from public.vitrines_lojas where id = p_vitrine for update;
  if v.id is null then
    raise exception 'Loja não encontrada.' using errcode = '22023';
  end if;

  perform set_config('olaki.sistema', '1', true);
  if p_acao = 'cortesia' then
    if p_dias is null then
      raise exception 'Diga quantos dias de cortesia.' using errcode = '23514';
    end if;
    extra := make_interval(days => p_dias);
    select * into p from public.planos where codigo = v.plano;
    if p.e_teste then
      update public.vitrines_lojas set teste_expira_em = greatest(teste_expira_em, now()) + extra where id = v.id;
    elsif p.preco_centavos > 0 then
      update public.vitrines_lojas
         set plano_expira_em = greatest(coalesce(plano_expira_em, now()), now()) + extra,
             plano_proximo_ate = plano_proximo_ate + case when plano_proximo is not null then extra end
       where id = v.id;
    else
      raise exception 'Esta conta está num plano grátis, sem vencimento. Use "Trocar plano" para dar dias de um plano pago.' using errcode = 'P0001';
    end if;
  elsif p_acao = 'trocar_plano' then
    select * into p from public.planos where codigo = p_plano;
    if p.codigo is null then
      raise exception 'Escolha o plano.' using errcode = '22023';
    end if;
    if (p.e_teste or p.preco_centavos > 0) and p_dias is null then
      raise exception 'Diga por quantos dias vale o plano.' using errcode = '23514';
    end if;
    update public.vitrines_lojas
       set plano = p.codigo,
           teste_expira_em = case when p.e_teste then now() + make_interval(days => p_dias) else teste_expira_em end,
           plano_expira_em = case when p.e_teste then plano_expira_em
                                  when p.preco_centavos > 0 then now() + make_interval(days => p_dias) else null end,
           plano_proximo = null, plano_proximo_ate = null, plano_proximo_pagamento_id = null
     where id = v.id;
  elsif p_acao = 'suspender' then
    if v.status = 'suspensa' then
      raise exception 'Esta loja já está suspensa.' using errcode = 'P0001';
    end if;
    update public.vitrines_lojas set status = 'suspensa' where id = v.id;
    -- sai tudo do ar na hora (ao reativar, o dono publica de novo; avulso pago continua valendo)
    update public.anuncios set status = 'pausado' where vitrine_id = v.id and status = 'ativo';
  elsif p_acao = 'reativar' then
    if v.status = 'ativa' then
      raise exception 'Esta loja já está ativa.' using errcode = 'P0001';
    end if;
    update public.vitrines_lojas set status = 'ativa' where id = v.id;
  elsif p_acao = 'dar_selo' then
    if v.tipo <> 'loja' then
      raise exception 'O Selo Loja Verificada é só para lojas.' using errcode = 'P0001';
    end if;
    update public.vitrines_lojas set selo_loja_verificada = true where id = v.id;
  else
    update public.vitrines_lojas set selo_loja_verificada = false where id = v.id;
  end if;
  perform set_config('olaki.sistema', antes, true);

  select * into depois from public.vitrines_lojas where id = v.id;
  insert into public.vitrines_acoes_admin (vitrine_id, admin_id, acao, motivo, detalhes)
  values (v.id, public.usuario_id(), p_acao, left(btrim(p_motivo), 300),
          jsonb_build_object(
            'dias', p_dias, 'plano_escolhido', p_plano,
            'antes', jsonb_build_object('plano', v.plano, 'plano_expira_em', v.plano_expira_em, 'teste_expira_em', v.teste_expira_em,
                                        'status', v.status, 'selo', v.selo_loja_verificada, 'plano_proximo', v.plano_proximo),
            'depois', jsonb_build_object('plano', depois.plano, 'plano_expira_em', depois.plano_expira_em, 'teste_expira_em', depois.teste_expira_em,
                                         'status', depois.status, 'selo', depois.selo_loja_verificada, 'plano_proximo', depois.plano_proximo)));
end $$;

-- Verificação (documento, selfie, CNPJ): aprovar ou recusar com motivo
create or replace function public.admin_analisar_verificacao(p_id uuid, p_aprovar boolean, p_motivo text default null)
returns void language plpgsql security definer
set search_path = public, extensions
as $$
declare n integer;
begin
  if not public.e_admin() then
    raise exception 'Só a equipe OLAKI pode analisar verificações.' using errcode = '42501';
  end if;
  if not coalesce(p_aprovar, false) and char_length(btrim(coalesce(p_motivo, ''))) < 3 then
    raise exception 'Escreva o motivo da recusa.' using errcode = '23514';
  end if;
  -- documento e selfie só se aprovam vendo o arquivo (link temporário do bucket privado)
  if coalesce(p_aprovar, false) and exists (
       select 1 from public.perfis_verificacoes x
        where x.id = p_id and x.tipo in ('documento', 'selfie') and nullif(btrim(coalesce(x.arquivo_path, '')), '') is null) then
    raise exception 'Esta verificação não tem arquivo para conferir. Só dá para recusar.' using errcode = 'P0001';
  end if;
  update public.perfis_verificacoes
     set status = case when p_aprovar then 'aprovada'::public.status_verificacao else 'recusada'::public.status_verificacao end,
         analisado_por = public.usuario_id(), analisado_em = now(),
         motivo_recusa = case when p_aprovar then null else left(btrim(p_motivo), 300) end
   where id = p_id and status = 'pendente';
  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'Verificação não encontrada ou já analisada.' using errcode = 'P0001';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 9. Painel · tela 6 (Pagamentos): totais com os mesmos filtros da lista.
--    Período: data do pagamento (pago_em) ou, se não foi pago, da criação (fuso de Fortaleza).
-- ---------------------------------------------------------------------
create or replace function public.admin_resumo_pagamentos(
  p_status text default null, p_tipo text default null, p_regiao uuid default null,
  p_de date default null, p_ate date default null)
returns table (status text, tipo text, quantidade bigint, total_centavos bigint)
language plpgsql stable security definer
set search_path = public, extensions
as $$
begin
  if not public.e_admin() then
    raise exception 'Só a equipe OLAKI vê os pagamentos.' using errcode = '42501';
  end if;
  return query
  select p.status, p.tipo, count(*), coalesce(sum(p.valor_centavos), 0)::bigint
    from public.pagamentos p
   where (p_status is null or p.status = p_status)
     and (p_tipo is null or p.tipo = p_tipo)
     and (p_regiao is null or p.microrregiao_id = p_regiao)
     and (p_de is null or (coalesce(p.pago_em, p.criado_em) at time zone 'America/Fortaleza')::date >= p_de)
     and (p_ate is null or (coalesce(p.pago_em, p.criado_em) at time zone 'America/Fortaleza')::date <= p_ate)
   group by p.status, p.tipo
   order by p.status, p.tipo;
end $$;

-- ---------------------------------------------------------------------
-- 10. Endurecimento (mesmo estilo das migrações anteriores)
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
revoke all on function public.vitrine_com_proximo(public.vitrines_lojas) from public, anon, authenticated;
revoke all on function public.materializar_proximo(uuid) from public, anon, authenticated;
revoke all on function public.periodos_assinatura(uuid) from public, anon, authenticated;
revoke all on function public.plano_a_venda(public.planos, public.vitrines_lojas) from public, anon, authenticated;
revoke all on function public.periodo_assinatura(public.vitrines_lojas, public.planos, integer) from public, anon, authenticated;
revoke all on function public.anuncio_cabe_no_plano(uuid) from public, anon, authenticated;
revoke all on function public.cobrancas_pendentes(uuid, uuid) from public, anon, authenticated;
revoke all on function public.aplicar_assinatura(uuid) from public, anon, authenticated;
revoke all on function public.reverter_assinatura(uuid) from public, anon, authenticated;
revoke all on function public.aplicar_anuncio_avulso(uuid) from public, anon, authenticated;
revoke all on function public.reverter_anuncio_avulso(uuid) from public, anon, authenticated;
revoke all on function public.situacao_vitrine(public.vitrines_lojas) from public, anon, authenticated;

-- Só o servidor (webhook do Asaas, rotina diária)
revoke all on function public.confirmar_pagamento(text, jsonb) from public, anon, authenticated;
revoke all on function public.cancelar_pagamento(text, text, jsonb) from public, anon, authenticated;
revoke all on function public.expirar_rotina() from public, anon, authenticated;
grant execute on function public.confirmar_pagamento(text, jsonb), public.cancelar_pagamento(text, text, jsonb),
  public.expirar_rotina() to service_role;

-- Pessoa logada (a função confere dono ou admin por dentro)
revoke all on function public.minha_assinatura() from public, anon;
revoke all on function public.opcoes_assinatura() from public, anon;
revoke all on function public.pedir_assinatura(text, integer) from public, anon;
revoke all on function public.pedir_anuncio_avulso(uuid) from public, anon;
revoke all on function public.admin_lojas(text, text, uuid, text, integer, integer) from public, anon;
revoke all on function public.admin_acao_loja(uuid, text, text, integer, text) from public, anon;
revoke all on function public.admin_analisar_verificacao(uuid, boolean, text) from public, anon;
revoke all on function public.admin_resumo_pagamentos(text, text, uuid, date, date) from public, anon;
revoke all on function public.cobranca_pode_seguir(uuid) from public, anon;
grant execute on function public.cobranca_pode_seguir(uuid) to authenticated;
grant execute on function public.minha_assinatura(), public.opcoes_assinatura(), public.pedir_assinatura(text, integer),
  public.pedir_anuncio_avulso(uuid), public.admin_lojas(text, text, uuid, text, integer, integer),
  public.admin_acao_loja(uuid, text, text, integer, text), public.admin_analisar_verificacao(uuid, boolean, text),
  public.admin_resumo_pagamentos(text, text, uuid, date, date) to authenticated;
