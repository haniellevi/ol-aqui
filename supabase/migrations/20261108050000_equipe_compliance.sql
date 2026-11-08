-- =====================================================================
-- OLAKI · Etapa 5 · Equipe e permissões (tela 14) e Compliance jurídico (tela 8)
-- Nota de projeto: docs/etapa5/equipe.md
-- ---------------------------------------------------------------------
--  * Papéis da equipe: administrador, moderador, financeiro, suporte, franqueado.
--    Administrador continua sendo perfis.e_admin (e_admin() não muda): quem já é
--    admin segue com acesso total, sem nenhum passo manual.
--  * O banco recusa o que o papel não pode (não é só o menu que some).
--  * Compliance: toda entrada na tela, busca, conta aberta e relatório fica
--    gravado com motivo, IP e data (e também em logs_atividade).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Equipe
-- ---------------------------------------------------------------------
create table public.equipe (
  id              uuid primary key default gen_random_uuid(),
  usuario_id      text not null unique references public.perfis(id) on delete cascade,
  papel           text not null check (papel in ('administrador', 'moderador', 'financeiro', 'suporte', 'franqueado')),
  microrregiao_id uuid references public.microrregioes(id) on delete restrict,
  ativo           boolean not null default true,
  observacao      text check (char_length(observacao) <= 300),
  adicionado_por  text,
  desativado_por  text,
  desativado_em   timestamptz,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  -- franqueado sempre com a região dele; os outros papéis valem para todas as regiões
  constraint equipe_regiao_do_franqueado check ((papel = 'franqueado') = (microrregiao_id is not null))
);
create index equipe_ativos_idx on public.equipe (usuario_id) where ativo;

alter table public.equipe enable row level security;
create policy "equipe leitura" on public.equipe for select
  using (usuario_id = public.usuario_id() or public.e_admin());
-- Sem policy de escrita: só as funções da tela 14 (security definer) mudam a equipe.
revoke all on public.equipe from anon, authenticated;
grant select on public.equipe to authenticated;

create trigger tocar_equipe before update on public.equipe for each row execute function public.tocar_atualizado_em();
create trigger log_equipe after insert or update or delete on public.equipe for each row execute function public.registrar_log();

-- Quem já é admin vira "administrador" na equipe (nenhum passo manual)
insert into public.equipe (usuario_id, papel, ativo, observacao)
select p.id, 'administrador', true, 'Já era administrador (perfis.e_admin)'
  from public.perfis p where p.e_admin
on conflict (usuario_id) do nothing;

-- perfis.e_admin ligado ou desligado fora da tela 14 (ex.: pelo Supabase) acompanha a equipe.
-- As funções da tela 14 ligam a flag olaki.equipe_sync para não repetir o trabalho.
create or replace function public.sincronizar_equipe_admin()
returns trigger language plpgsql security definer
set search_path = public, extensions
as $$
begin
  if coalesce(current_setting('olaki.equipe_sync', true), '') = '1' then
    return null;
  end if;
  if new.e_admin and (tg_op = 'INSERT' or not old.e_admin) then
    insert into public.equipe (usuario_id, papel, ativo, adicionado_por, observacao)
    values (new.id, 'administrador', true, public.usuario_id(), 'Ligado em perfis.e_admin')
    on conflict (usuario_id) do update
       set papel = 'administrador', microrregiao_id = null, ativo = true,
           desativado_em = null, desativado_por = null, observacao = 'Ligado em perfis.e_admin';
  elsif tg_op = 'UPDATE' and old.e_admin and not new.e_admin then
    update public.equipe
       set ativo = false, desativado_em = now(), desativado_por = public.usuario_id(), observacao = 'Desligado em perfis.e_admin'
     where usuario_id = new.id and papel = 'administrador' and ativo;
  end if;
  return null;
end $$;
create trigger perfis_9_equipe after insert or update of e_admin on public.perfis
  for each row execute function public.sincronizar_equipe_admin();

-- ---------------------------------------------------------------------
-- 2. Funções de apoio (usadas nas regras de RLS e no painel)
-- ---------------------------------------------------------------------

-- Papel de quem está logado: administrador (e_admin), o papel ativo na equipe, ou nulo.
create or replace function public.meu_papel()
returns text language sql stable security definer
set search_path = public, extensions
as $$
  select case when public.e_admin() then 'administrador'
              else (select e.papel from public.equipe e
                     where e.usuario_id = public.usuario_id() and e.ativo and e.papel <> 'administrador')
         end
$$;

-- Tem este papel? Administrador pode tudo. Uma linha "administrador" na equipe sem
-- perfis.e_admin não vale (a fonte do administrador é e_admin()).
create or replace function public.tem_papel(p_papel text)
returns boolean language sql stable security definer
set search_path = public, extensions
as $$
  select public.e_admin() or exists (
    select 1 from public.equipe e
     where e.usuario_id = public.usuario_id() and e.ativo
       and e.papel = p_papel and p_papel <> 'administrador')
$$;

-- Região do franqueado logado (nulo para os outros).
create or replace function public.minha_regiao_equipe()
returns uuid language sql stable security definer
set search_path = public, extensions
as $$
  select e.microrregiao_id from public.equipe e
   where e.usuario_id = public.usuario_id() and e.ativo and e.papel = 'franqueado'
$$;

-- Pode ver dados desta região? Administrador, moderador, financeiro e suporte: todas.
-- Franqueado: só a dele.
create or replace function public.pode_ver_regiao(p_regiao uuid)
returns boolean language sql stable security definer
set search_path = public, extensions
as $$
  select public.e_admin() or exists (
    select 1 from public.equipe e
     where e.usuario_id = public.usuario_id() and e.ativo
       and (e.papel in ('moderador', 'financeiro', 'suporte')
            or (e.papel = 'franqueado' and e.microrregiao_id = p_regiao)))
$$;

-- ---------------------------------------------------------------------
-- 3. Leitura por papel (só SELECT; escrita continua pelas funções)
--    "(select ...)" faz a função rodar uma vez por consulta, não por linha.
-- ---------------------------------------------------------------------
create policy "equipe moderacao anuncios" on public.anuncios for select
  using ((select public.tem_papel('moderador')) or (select public.tem_papel('financeiro')));
create policy "equipe moderacao radar" on public.radar_pedidos for select
  using ((select public.tem_papel('moderador')));
create policy "equipe moderacao propostas" on public.radar_propostas for select
  using ((select public.tem_papel('moderador')));
create policy "equipe moderacao denuncias" on public.denuncias for select
  using ((select public.tem_papel('moderador')));
create policy "equipe leitura vitrines" on public.vitrines_lojas for select
  using ((select public.tem_papel('moderador')) or (select public.tem_papel('financeiro')));
create policy "equipe financeiro pagamentos" on public.pagamentos for select
  using ((select public.tem_papel('financeiro')));
create policy "equipe leitura planos" on public.planos for select
  using ((select public.tem_papel('financeiro')) or (select public.tem_papel('suporte')));
create policy "equipe suporte verificacoes" on public.perfis_verificacoes for select
  using ((select public.tem_papel('suporte')));
-- perfis: só as colunas liberadas a authenticated (nome, cidade...); whatsapp continua de fora
create policy "equipe suporte perfis" on public.perfis for select
  using ((select public.tem_papel('suporte')));

-- ---------------------------------------------------------------------
-- 4. Moderação (tela 4) pelo moderador: funções em vez de UPDATE direto
-- ---------------------------------------------------------------------

-- Aprovar ou recusar um anúncio EM ANÁLISE. Fecha as denúncias abertas dele.
create or replace function public.moderar_anuncio(p_id uuid, p_decisao text, p_motivo text default null)
returns void language plpgsql security definer
set search_path = public, extensions
as $$
declare
  a        public.anuncios;
  aprovar  boolean := p_decisao = 'aprovar';
  v_motivo text := nullif(left(btrim(coalesce(p_motivo, '')), 300), '');
begin
  if not public.tem_papel('moderador') then
    raise exception 'Só a equipe de moderação pode fazer isso.' using errcode = '42501';
  end if;
  if p_decisao is null or p_decisao not in ('aprovar', 'recusar') then
    raise exception 'Ação inválida.' using errcode = '22023';
  end if;
  select * into a from public.anuncios x where x.id = p_id for update;
  if a.id is null then
    raise exception 'Anúncio não encontrado.' using errcode = 'P0002';
  end if;
  if a.status <> 'em_analise' then
    raise exception 'Este anúncio não está mais em análise.' using errcode = 'P0001';
  end if;
  update public.anuncios x
     set status = case when aprovar then 'ativo'::public.status_anuncio else 'pausado'::public.status_anuncio end,
         motivo_analise = case when aprovar then null else 'Recusado: ' || coalesce(v_motivo, 'fora das regras do OLAKI') end
   where x.id = a.id;
  update public.denuncias d
     set status = case when aprovar then 'improcedente' else 'procedente' end,
         resolvido_por = public.usuario_id(), resolvido_em = now()
   where d.alvo_tipo = 'anuncio' and d.alvo_id = a.id and d.status = 'aberta';
end $$;

-- Aprovar ou recusar um pedido do Radar EM ANÁLISE. Recusado = tirado pela moderação
-- (o comprador vê o motivo; dá para devolver em moderar_radar). Fecha as denúncias abertas.
create or replace function public.moderar_pedido(p_id uuid, p_decisao text, p_motivo text default null)
returns void language plpgsql security definer
set search_path = public, extensions
as $$
declare
  p        public.radar_pedidos;
  aprovar  boolean := p_decisao = 'aprovar';
  v_motivo text := nullif(left(btrim(coalesce(p_motivo, '')), 300), '');
begin
  if not public.tem_papel('moderador') then
    raise exception 'Só a equipe de moderação pode fazer isso.' using errcode = '42501';
  end if;
  if p_decisao is null or p_decisao not in ('aprovar', 'recusar') then
    raise exception 'Ação inválida.' using errcode = '22023';
  end if;
  select * into p from public.radar_pedidos x where x.id = p_id for update;
  if p.id is null then
    raise exception 'Pedido não encontrado.' using errcode = 'P0002';
  end if;
  if p.status <> 'em_analise' then
    raise exception 'Este pedido não está mais em análise.' using errcode = 'P0001';
  end if;
  if aprovar then
    update public.radar_pedidos x
       set status = case when x.expira_em > now() then 'aberto'::public.status_pedido else 'encerrado'::public.status_pedido end,
           fechado_motivo = case when x.expira_em > now() then null else 'prazo' end,
           fechado_em = case when x.expira_em > now() then null else now() end,
           motivo_analise = null
     where x.id = p.id;
  else
    update public.radar_pedidos x
       set status = 'encerrado', fechado_motivo = 'moderacao', fechado_em = now(),
           motivo_analise = 'Recusado: ' || coalesce(v_motivo, 'fora das regras'),
           moderado_motivo = coalesce(v_motivo, 'Fora das regras do OLAKI')
     where x.id = p.id;
  end if;
  update public.denuncias d
     set status = case when aprovar then 'improcedente' else 'procedente' end,
         resolvido_por = public.usuario_id(), resolvido_em = now()
   where d.alvo_tipo = 'pedido' and d.alvo_id = p.id and d.status = 'aberta';
end $$;

-- Marcar uma denúncia aberta como procedente ou não.
create or replace function public.resolver_denuncia(p_id uuid, p_procedente boolean)
returns void language plpgsql security definer
set search_path = public, extensions
as $$
declare n integer;
begin
  if not public.tem_papel('moderador') then
    raise exception 'Só a equipe de moderação pode fazer isso.' using errcode = '42501';
  end if;
  if p_procedente is null then
    raise exception 'Diga se a denúncia procede.' using errcode = '22023';
  end if;
  update public.denuncias d
     set status = case when p_procedente then 'procedente' else 'improcedente' end,
         resolvido_por = public.usuario_id(), resolvido_em = now()
   where d.id = p_id and d.status = 'aberta';
  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'Denúncia não encontrada ou já resolvida.' using errcode = 'P0001';
  end if;
end $$;

-- Mesmo corpo de 20261107040000 · só muda quem pode (moderador)
create or replace function public.moderar_banner_vitrine(p_vitrine uuid, p_motivo text default null)
returns text language plpgsql security definer
set search_path = public, extensions
as $$
declare url text;
begin
  if not public.tem_papel('moderador') then
    raise exception 'Apenas a equipe OLAKI pode moderar.' using errcode = '42501';
  end if;
  select banner_url into url from public.vitrines_lojas where id = p_vitrine for update;
  if not found then
    raise exception 'Loja não encontrada.' using errcode = 'P0002';
  end if;
  update public.vitrines_lojas
     set banner_tipo = 'modelo', banner_url = null, banner_moderado_em = now(),
         banner_moderado_url = coalesce(url, banner_moderado_url),
         banner_moderado_motivo = left(coalesce(nullif(btrim(p_motivo), ''), 'Foto fora das regras do OLAKI'), 300)
   where id = p_vitrine;
  return url;
end $$;

-- Mesmo corpo de 20261108020000 · só muda quem pode (moderador)
create or replace function public.moderar_radar(p_tipo text, p_id uuid, p_acao text, p_motivo text default null)
returns text language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v_motivo text := nullif(left(btrim(coalesce(p_motivo, '')), 300), '');
  p        public.radar_pedidos;
  rp       public.radar_propostas;
begin
  if not public.tem_papel('moderador') then
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
-- 5. Pagamentos (tela 6) pelo financeiro · mesmo corpo de 20261108010000
-- ---------------------------------------------------------------------
create or replace function public.admin_resumo_pagamentos(
  p_status text default null, p_tipo text default null, p_regiao uuid default null,
  p_de date default null, p_ate date default null)
returns table (status text, tipo text, quantidade bigint, total_centavos bigint)
language plpgsql stable security definer
set search_path = public, extensions
as $$
begin
  if not public.tem_papel('financeiro') then
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
-- 6. Lojas (tela 5) pelo suporte e pelo franqueado · mesmo corpo de 20261108010000
--    Suporte: lista de todas as regiões. Franqueado: só a região dele (o filtro de região
--    que vier é trocado pela dele). Os outros: recusado.
-- ---------------------------------------------------------------------
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
begin
  if not public.tem_papel('suporte') then
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

-- Ações na loja: administrador faz todas; suporte só suspende e reativa (sem plano, cortesia ou selo).
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
    if not public.tem_papel('suporte') then
      raise exception 'Só a equipe OLAKI pode fazer isso.' using errcode = '42501';
    end if;
    if p_acao is null or p_acao not in ('suspender', 'reativar') then
      raise exception 'O suporte não mexe em plano, cortesia nem selo. Peça a um administrador.' using errcode = '42501';
    end if;
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

-- Verificação (documento, selfie, CNPJ): administrador ou suporte · mesmo corpo de 20261108010000
create or replace function public.admin_analisar_verificacao(p_id uuid, p_aprovar boolean, p_motivo text default null)
returns void language plpgsql security definer
set search_path = public, extensions
as $$
declare n integer;
begin
  if not public.tem_papel('suporte') then
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
-- 7. Tela 14 · Equipe (só administrador)
-- ---------------------------------------------------------------------

-- Lista da equipe (ativos primeiro), com nome, celular e região.
create or replace function public.equipe_lista()
returns table (usuario_id text, nome text, whatsapp text, cidade text, papel text, microrregiao_id uuid, regiao_nome text,
               ativo boolean, observacao text, adicionado_por_nome text, desativado_em timestamptz,
               criado_em timestamptz, atualizado_em timestamptz)
language plpgsql stable security definer
set search_path = public, extensions
as $$
begin
  if not public.e_admin() then
    raise exception 'Só um administrador vê a equipe.' using errcode = '42501';
  end if;
  return query
  select e.usuario_id, pf.nome, pf.whatsapp, pf.cidade, e.papel, e.microrregiao_id, m.nome, e.ativo, e.observacao,
         quem.nome, e.desativado_em, e.criado_em, e.atualizado_em
    from public.equipe e
    join public.perfis pf on pf.id = e.usuario_id
    left join public.microrregioes m on m.id = e.microrregiao_id
    left join public.perfis quem on quem.id = e.adicionado_por
   order by e.ativo desc, case e.papel when 'administrador' then 0 when 'moderador' then 1 when 'financeiro' then 2
                                       when 'suporte' then 3 else 4 end, pf.nome;
end $$;

-- Achar uma conta que já existe: pelo celular (só os números), pelo id, pelo nome
-- ou pelos ids que o servidor achou no Clerk pelo e-mail (p_ids).
create or replace function public.equipe_buscar_conta(p_busca text default null, p_ids text[] default null)
returns table (usuario_id text, nome text, whatsapp text, cidade text, papel text, ativo boolean)
language plpgsql stable security definer
set search_path = public, extensions
as $$
declare
  termo  text := nullif(btrim(coalesce(p_busca, '')), '');
  digito text := nullif(regexp_replace(coalesce(p_busca, ''), '[^0-9]', '', 'g'), '');
begin
  if not public.e_admin() then
    raise exception 'Só um administrador mexe na equipe.' using errcode = '42501';
  end if;
  if termo is null and coalesce(cardinality(p_ids), 0) = 0 then
    return;
  end if;
  return query
  select pf.id, pf.nome, pf.whatsapp, pf.cidade, e.papel, e.ativo
    from public.perfis pf
    left join public.equipe e on e.usuario_id = pf.id
   where (p_ids is not null and pf.id = any (p_ids[1:20]))
      or (termo is not null and pf.id = termo)
      or (digito is not null and char_length(digito) >= 8 and coalesce(pf.whatsapp, '') like '%' || digito || '%')
      or (termo is not null and char_length(termo) >= 3 and digito is null
          and public.sem_acento(lower(pf.nome)) like '%' || public.sem_acento(lower(termo)) || '%')
   order by pf.nome
   limit 10;
end $$;

-- Pôr alguém na equipe ou trocar o papel. Não mexe em si mesmo; nunca deixa sem administrador.
create or replace function public.equipe_salvar(p_usuario text, p_papel text, p_regiao uuid default null, p_observacao text default null)
returns void language plpgsql security definer
set search_path = public, extensions
as $$
declare
  atual  public.equipe;
  eu     text := public.usuario_id();
  v_obs  text := nullif(left(btrim(coalesce(p_observacao, '')), 300), '');
  regiao uuid := case when p_papel = 'franqueado' then p_regiao end;
begin
  -- uma mudança de equipe por vez (dois admins não se rebaixam ao mesmo tempo)
  perform pg_advisory_xact_lock(hashtext('olaki.equipe'));
  if not public.e_admin() then
    raise exception 'Só um administrador mexe na equipe.' using errcode = '42501';
  end if;
  if p_papel is null or p_papel not in ('administrador', 'moderador', 'financeiro', 'suporte', 'franqueado') then
    raise exception 'Escolha o papel.' using errcode = '22023';
  end if;
  if p_usuario is null or p_usuario = eu then
    raise exception 'Você não pode mudar o seu próprio papel. Peça a outro administrador.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.perfis pf where pf.id = p_usuario) then
    raise exception 'Conta não encontrada. A pessoa precisa entrar no OLAKI uma vez antes.' using errcode = 'P0002';
  end if;
  if p_papel = 'franqueado' and (regiao is null or not exists (select 1 from public.microrregioes m where m.id = regiao)) then
    raise exception 'Escolha a região do franqueado.' using errcode = '23514';
  end if;
  select * into atual from public.equipe e where e.usuario_id = p_usuario for update;
  if atual.id is not null and atual.papel = 'administrador' and atual.ativo and p_papel <> 'administrador'
     and not exists (select 1 from public.equipe e where e.papel = 'administrador' and e.ativo and e.usuario_id <> p_usuario) then
    raise exception 'O OLAKI precisa de pelo menos um administrador.' using errcode = 'P0001';
  end if;

  perform set_config('olaki.equipe_sync', '1', true);
  insert into public.equipe (usuario_id, papel, microrregiao_id, ativo, observacao, adicionado_por)
  values (p_usuario, p_papel, regiao, true, v_obs, eu)
  on conflict (usuario_id) do update
     set papel = excluded.papel, microrregiao_id = excluded.microrregiao_id, ativo = true,
         observacao = excluded.observacao, adicionado_por = excluded.adicionado_por,
         desativado_em = null, desativado_por = null;
  update public.perfis pf set e_admin = (p_papel = 'administrador')
   where pf.id = p_usuario and pf.e_admin is distinct from (p_papel = 'administrador');
  perform set_config('olaki.equipe_sync', '', true);
end $$;

-- Tirar alguém da equipe (a linha fica, desativada, para o histórico).
create or replace function public.equipe_desativar(p_usuario text, p_observacao text default null)
returns void language plpgsql security definer
set search_path = public, extensions
as $$
declare
  atual public.equipe;
  eu    text := public.usuario_id();
begin
  perform pg_advisory_xact_lock(hashtext('olaki.equipe'));
  if not public.e_admin() then
    raise exception 'Só um administrador mexe na equipe.' using errcode = '42501';
  end if;
  if p_usuario is null or p_usuario = eu then
    raise exception 'Você não pode tirar a si mesmo da equipe. Peça a outro administrador.' using errcode = 'P0001';
  end if;
  select * into atual from public.equipe e where e.usuario_id = p_usuario for update;
  if atual.id is null or not atual.ativo then
    raise exception 'Esta pessoa não está na equipe.' using errcode = 'P0002';
  end if;
  if atual.papel = 'administrador'
     and not exists (select 1 from public.equipe e where e.papel = 'administrador' and e.ativo and e.usuario_id <> p_usuario) then
    raise exception 'O OLAKI precisa de pelo menos um administrador.' using errcode = 'P0001';
  end if;

  perform set_config('olaki.equipe_sync', '1', true);
  update public.equipe e
     set ativo = false, desativado_em = now(), desativado_por = eu,
         observacao = coalesce(nullif(left(btrim(coalesce(p_observacao, '')), 300), ''), e.observacao)
   where e.id = atual.id;
  update public.perfis pf set e_admin = false where pf.id = p_usuario and pf.e_admin;
  perform set_config('olaki.equipe_sync', '', true);
end $$;

-- ---------------------------------------------------------------------
-- 8. Tela 8 · Compliance jurídico (só administrador)
-- ---------------------------------------------------------------------
insert into public.configuracoes (chave, valor, grupo, publico, descricao) values
  ('compliance.consulta_minutos', '60', 'geral', false,
     'Compliance: minutos que uma consulta (e o relatório dela) fica aberta depois de escrever o motivo'),
  ('compliance.meses_historico', '6', 'geral', false,
     'Compliance: meses de histórico (IPs, datas e alterações) que aparecem na consulta e no relatório. Marco Civil: mínimo 6'),
  ('compliance.max_linhas_historico', '2000', 'geral', false,
     'Compliance: máximo de linhas de histórico por conta na consulta e no relatório')
on conflict do nothing;

-- Registro de cada acesso. Nunca muda nem some (ver gatilho abaixo).
create table public.compliance_acessos (
  id            uuid primary key default gen_random_uuid(),
  consulta_id   uuid references public.compliance_acessos(id),
  admin_id      text,               -- sem chave estrangeira: o registro fica mesmo se a conta sair
  tipo          text not null check (tipo in ('entrar', 'abrir', 'buscar', 'ver_conta', 'relatorio', 'ver_relatorio')),
  motivo        text check (motivo is null or char_length(motivo) between 3 and 500),
  busca         text check (char_length(busca) <= 120),
  alvo_usuario  text,
  ip            inet default public.ip_requisicao(),
  ip_navegador  inet,               -- IP de quem usa o painel, mandado pelo servidor do site
  user_agent    text default public.user_agent_requisicao(),
  criado_em     timestamptz not null default now(),
  constraint compliance_motivo_obrigatorio check (tipo not in ('abrir', 'relatorio') or motivo is not null),
  constraint compliance_consulta_obrigatoria check (tipo in ('entrar', 'abrir') or consulta_id is not null)
);
create index compliance_acessos_admin_idx on public.compliance_acessos (admin_id, criado_em desc);
create index compliance_acessos_consulta_idx on public.compliance_acessos (consulta_id, criado_em);
alter table public.compliance_acessos enable row level security;
create policy "compliance leitura admin" on public.compliance_acessos for select using (public.e_admin());
revoke all on public.compliance_acessos from anon, authenticated;
grant select on public.compliance_acessos to authenticated;
create trigger log_compliance_acessos after insert on public.compliance_acessos
  for each row execute function public.registrar_log();

create or replace function public.compliance_imutavel()
returns trigger language plpgsql
set search_path = public, extensions
as $$
begin
  raise exception 'O registro do Compliance não pode ser mudado nem apagado.' using errcode = '42501';
end $$;
create trigger compliance_acessos_imutavel before update or delete on public.compliance_acessos
  for each row execute function public.compliance_imutavel();

-- Texto → IP (nulo se não for um IP válido)
create or replace function public.ip_ou_nulo(p text)
returns inet language plpgsql immutable
set search_path = public, extensions
as $$
begin
  return nullif(btrim(coalesce(p, '')), '')::inet;
exception when others then
  return null;
end $$;

-- Confere a consulta: é do administrador logado, foi aberta com motivo e não venceu.
create or replace function public.compliance_consulta_valida(p_consulta uuid)
returns public.compliance_acessos language plpgsql stable security definer
set search_path = public, extensions
as $$
declare
  c   public.compliance_acessos;
  min integer := greatest(coalesce((public.config('compliance.consulta_minutos', null, '60') #>> '{}')::int, 60), 1);
begin
  select * into c from public.compliance_acessos x
   where x.id = p_consulta and x.tipo = 'abrir' and x.admin_id = public.usuario_id();
  if c.id is null or c.criado_em < now() - make_interval(mins => min) then
    raise exception 'Esta consulta acabou. Escreva o motivo de novo para continuar.' using errcode = 'P0001';
  end if;
  return c;
end $$;

-- Tudo o que o OLAKI guarda de uma conta: cadastro, aceites, lojas, anúncios e histórico.
create or replace function public.compliance_dados(p_usuario text)
returns jsonb language plpgsql stable security definer
set search_path = public, extensions
as $$
declare
  meses  integer := greatest(coalesce((public.config('compliance.meses_historico', null, '6') #>> '{}')::int, 6), 1);
  maximo integer := least(greatest(coalesce((public.config('compliance.max_linhas_historico', null, '2000') #>> '{}')::int, 2000), 1), 20000);
  desde  timestamptz := now() - make_interval(months => meses);
  lojas  uuid[];
  ads    text[];
  r      jsonb;
begin
  select coalesce(array_agg(v.id), '{}') into lojas from public.vitrines_lojas v where v.dono_id = p_usuario;
  -- anúncios de hoje e os já apagados (achados no histórico)
  select coalesce(array_agg(distinct x), '{}') into ads from (
    select a.id::text as x from public.anuncios a where a.vitrine_id = any (lojas)
    union
    select l.registro_id from public.logs_atividade l
     where l.tabela = 'anuncios' and l.acao = 'DELETE' and (l.dados_antes->>'vitrine_id')::uuid = any (lojas)
  ) t;

  select jsonb_build_object(
    'usuario_id', p_usuario,
    'meses_historico', meses,
    'desde', desde,
    'perfil', (select to_jsonb(pf) - 'busca' from public.perfis pf where pf.id = p_usuario),
    'equipe', (select jsonb_build_object('papel', e.papel, 'ativo', e.ativo) from public.equipe e where e.usuario_id = p_usuario),
    'aceites', coalesce((select jsonb_agg(jsonb_build_object('tipo', ac.tipo, 'versao', ac.versao, 'aceito_em', ac.aceito_em) order by ac.aceito_em)
                           from public.aceites ac where ac.usuario_id = p_usuario), '[]'::jsonb),
    'lojas', coalesce((select jsonb_agg(jsonb_build_object(
                         'id', v.id, 'nome', v.nome, 'slug', v.slug, 'tipo', v.tipo, 'cnpj', v.cnpj, 'whatsapp', v.whatsapp,
                         'cidade', v.cidade, 'status', v.status, 'plano', v.plano, 'criado_em', v.criado_em, 'criado_ip', v.criado_ip)
                         order by v.criado_em)
                         from public.vitrines_lojas v where v.dono_id = p_usuario), '[]'::jsonb),
    'anuncios', coalesce((select jsonb_agg(jsonb_build_object(
                            'id', a.id, 'titulo', a.titulo, 'status', a.status, 'preco_centavos', a.preco_centavos,
                            'cidade', a.cidade, 'criado_em', a.criado_em, 'criado_ip', a.criado_ip,
                            'atualizado_em', a.atualizado_em, 'congelado_motivo', a.congelado_motivo)
                            order by a.criado_em desc)
                            from public.anuncios a where a.vitrine_id = any (lojas)), '[]'::jsonb),
    'anuncios_apagados', coalesce((select jsonb_agg(jsonb_build_object(
                            'id', l.registro_id, 'titulo', l.dados_antes->>'titulo', 'apagado_em', l.criado_em,
                            'apagado_por', l.usuario_id, 'ip', l.ip) order by l.criado_em desc)
                            from public.logs_atividade l
                           where l.tabela = 'anuncios' and l.acao = 'DELETE' and l.registro_id = any (ads)), '[]'::jsonb)
  ) into r;

  r := r || jsonb_build_object('historico', coalesce((
    select jsonb_agg(h order by h->>'criado_em' desc)
      from (
        select jsonb_build_object(
                 'criado_em', l.criado_em, 'tabela', l.tabela, 'acao', l.acao, 'registro_id', l.registro_id,
                 'quem', l.usuario_id, 'ip', l.ip, 'user_agent', l.user_agent,
                 'campos', (select jsonb_object_agg(k, jsonb_build_array(left(l.dados_antes->>k, 200), left(l.dados_depois->>k, 200)))
                              from jsonb_object_keys(coalesce(l.dados_depois, l.dados_antes, '{}'::jsonb)) k
                             where k not in ('atualizado_em', 'busca')
                               and (l.dados_antes->k) is distinct from (l.dados_depois->k)
                               and not (coalesce(l.dados_antes->k, 'null'::jsonb) = 'null'::jsonb
                                        and coalesce(l.dados_depois->k, 'null'::jsonb) = 'null'::jsonb))) as h
          from public.logs_atividade l
         where l.criado_em >= desde
           and (l.usuario_id = p_usuario
                or (l.tabela = 'perfis' and l.registro_id = p_usuario)
                or (l.tabela = 'vitrines_lojas' and l.registro_id = any (lojas::text[]))
                or (l.tabela = 'anuncios' and l.registro_id = any (ads)))
         order by l.criado_em desc, l.id desc
         limit maximo
      ) t), '[]'::jsonb),
    'historico_limite', maximo);
  return r;
end $$;

-- Grava que a tela foi aberta (antes de ver qualquer dado).
create or replace function public.compliance_entrar(p_ip text default null)
returns void language plpgsql security definer
set search_path = public, extensions
as $$
begin
  if not public.e_admin() then
    raise exception 'Só um administrador usa o Compliance.' using errcode = '42501';
  end if;
  insert into public.compliance_acessos (admin_id, tipo, ip_navegador) values (public.usuario_id(), 'entrar', public.ip_ou_nulo(p_ip));
end $$;

-- Começa uma consulta com o motivo (ex.: número do ofício). Devolve o id da consulta.
create or replace function public.compliance_abrir(p_motivo text, p_ip text default null)
returns uuid language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v_motivo text := left(btrim(coalesce(p_motivo, '')), 500);
  id_novo  uuid;
begin
  if not public.e_admin() then
    raise exception 'Só um administrador usa o Compliance.' using errcode = '42501';
  end if;
  if char_length(v_motivo) < 3 then
    raise exception using errcode = '23514', message = 'Escreva o motivo (ex.: número do ofício).', detail = 'campo:motivo';
  end if;
  insert into public.compliance_acessos (admin_id, tipo, motivo, ip_navegador)
  values (public.usuario_id(), 'abrir', v_motivo, public.ip_ou_nulo(p_ip))
  returning id into id_novo;
  return id_novo;
end $$;

-- Busca por conta (id, nome, celular, CNPJ ou nome da loja) e por anúncio (id ou título).
-- Anúncio apagado aparece pelo id (achado no histórico).
create or replace function public.compliance_buscar(p_consulta uuid, p_busca text, p_ip text default null)
returns table (tipo text, id text, titulo text, detalhe text, usuario_id text, criado_em timestamptz)
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  c      public.compliance_acessos;
  termo  text := left(btrim(coalesce(p_busca, '')), 120);
  digito text := nullif(regexp_replace(coalesce(p_busca, ''), '[^0-9]', '', 'g'), '');
  e_uuid boolean := btrim(coalesce(p_busca, '')) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  v_uuid uuid := case when btrim(coalesce(p_busca, '')) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                      then btrim(p_busca)::uuid end;
  texto  text;
begin
  if not public.e_admin() then
    raise exception 'Só um administrador usa o Compliance.' using errcode = '42501';
  end if;
  c := public.compliance_consulta_valida(p_consulta);
  if char_length(termo) < 3 then
    raise exception using errcode = '23514', message = 'Digite pelo menos 3 letras ou números.', detail = 'campo:busca';
  end if;
  insert into public.compliance_acessos (consulta_id, admin_id, tipo, busca, ip_navegador)
  values (c.id, public.usuario_id(), 'buscar', termo, public.ip_ou_nulo(p_ip));
  texto := '%' || public.sem_acento(lower(termo)) || '%';

  return query
  (select 'conta'::text, pf.id, pf.nome, concat_ws(' · ', pf.whatsapp, pf.cidade), pf.id, pf.criado_em
     from public.perfis pf
    where pf.id = termo
       or (digito is not null and char_length(digito) >= 8 and coalesce(pf.whatsapp, '') like '%' || digito || '%')
       or (not e_uuid and char_length(termo) >= 3 and public.sem_acento(lower(pf.nome)) like texto)
       or exists (select 1 from public.vitrines_lojas v
                   where v.dono_id = pf.id
                     and ((digito is not null and char_length(digito) >= 8
                           and (coalesce(v.whatsapp, '') like '%' || digito || '%' or coalesce(v.cnpj, '') like '%' || digito || '%'))
                          or (not e_uuid and public.sem_acento(lower(v.nome)) like texto)))
    order by pf.nome
    limit 30)
  union all
  (select 'anuncio'::text, a.id::text, a.titulo, concat_ws(' · ', a.status::text, a.cidade, v.nome), v.dono_id, a.criado_em
     from public.anuncios a
     join public.vitrines_lojas v on v.id = a.vitrine_id
    where (e_uuid and a.id = v_uuid)
       or (not e_uuid and public.sem_acento(lower(a.titulo)) like texto)
    order by a.criado_em desc
    limit 30)
  union all
  (select 'anuncio_apagado'::text, l.registro_id, l.dados_antes->>'titulo', 'Apagado', v.dono_id, l.criado_em
     from public.logs_atividade l
     left join public.vitrines_lojas v on v.id = (l.dados_antes->>'vitrine_id')::uuid
    where e_uuid and l.tabela = 'anuncios' and l.acao = 'DELETE' and l.registro_id = v_uuid::text
    limit 5);
end $$;

-- Abre os dados de uma conta (grava o acesso).
create or replace function public.compliance_conta(p_consulta uuid, p_usuario text, p_ip text default null)
returns jsonb language plpgsql security definer
set search_path = public, extensions
as $$
declare c public.compliance_acessos;
begin
  if not public.e_admin() then
    raise exception 'Só um administrador usa o Compliance.' using errcode = '42501';
  end if;
  c := public.compliance_consulta_valida(p_consulta);
  if nullif(btrim(coalesce(p_usuario, '')), '') is null then
    raise exception 'Escolha a conta.' using errcode = '22023';
  end if;
  insert into public.compliance_acessos (consulta_id, admin_id, tipo, alvo_usuario, ip_navegador)
  values (c.id, public.usuario_id(), 'ver_conta', btrim(p_usuario), public.ip_ou_nulo(p_ip));
  return public.compliance_dados(btrim(p_usuario));
end $$;

-- Pede o relatório de uma conta, com o motivo que vai no cabeçalho. Devolve o id do relatório.
create or replace function public.compliance_pedir_relatorio(p_consulta uuid, p_usuario text, p_motivo text, p_ip text default null)
returns uuid language plpgsql security definer
set search_path = public, extensions
as $$
declare
  c        public.compliance_acessos;
  v_motivo text := left(btrim(coalesce(p_motivo, '')), 500);
  id_novo  uuid;
begin
  if not public.e_admin() then
    raise exception 'Só um administrador usa o Compliance.' using errcode = '42501';
  end if;
  c := public.compliance_consulta_valida(p_consulta);
  if nullif(btrim(coalesce(p_usuario, '')), '') is null then
    raise exception 'Escolha a conta.' using errcode = '22023';
  end if;
  if char_length(v_motivo) < 3 then
    raise exception using errcode = '23514', message = 'Escreva o motivo do relatório (ex.: número do ofício).', detail = 'campo:motivo';
  end if;
  insert into public.compliance_acessos (consulta_id, admin_id, tipo, motivo, alvo_usuario, ip_navegador)
  values (c.id, public.usuario_id(), 'relatorio', v_motivo, btrim(p_usuario), public.ip_ou_nulo(p_ip))
  returning id into id_novo;
  return id_novo;
end $$;

-- Dados do relatório com o cabeçalho. Só quem pediu, dentro da validade. Cada abertura fica gravada.
create or replace function public.compliance_relatorio(p_relatorio uuid, p_ip text default null)
returns jsonb language plpgsql security definer
set search_path = public, extensions
as $$
declare
  rel public.compliance_acessos;
  con public.compliance_acessos;
  min integer := greatest(coalesce((public.config('compliance.consulta_minutos', null, '60') #>> '{}')::int, 60), 1);
begin
  if not public.e_admin() then
    raise exception 'Só um administrador usa o Compliance.' using errcode = '42501';
  end if;
  select * into rel from public.compliance_acessos x
   where x.id = p_relatorio and x.tipo = 'relatorio' and x.admin_id = public.usuario_id();
  if rel.id is null or rel.criado_em < now() - make_interval(mins => min) then
    raise exception 'Este relatório acabou ou não é seu. Gere de novo na tela do Compliance.' using errcode = 'P0001';
  end if;
  select * into con from public.compliance_acessos x where x.id = rel.consulta_id;
  insert into public.compliance_acessos (consulta_id, admin_id, tipo, alvo_usuario, ip_navegador)
  values (rel.consulta_id, public.usuario_id(), 'ver_relatorio', rel.alvo_usuario, public.ip_ou_nulo(p_ip));
  return jsonb_build_object(
    'cabecalho', jsonb_build_object(
      'relatorio_id', rel.id, 'gerado_em', rel.criado_em, 'impresso_em', now(),
      'gerado_por_id', rel.admin_id,
      'gerado_por_nome', (select pf.nome from public.perfis pf where pf.id = rel.admin_id),
      'motivo', rel.motivo, 'motivo_consulta', con.motivo,
      'ip_banco', rel.ip, 'ip_navegador', rel.ip_navegador),
    'dados', public.compliance_dados(rel.alvo_usuario));
end $$;

-- ---------------------------------------------------------------------
-- 9. Endurecimento (mesmo estilo das migrações anteriores)
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

-- Usadas nas regras de RLS (como e_admin()): todos executam; para visitante dão false.
grant execute on function public.tem_papel(text), public.pode_ver_regiao(uuid) to anon, authenticated, service_role;

-- Pessoa logada (a função confere o papel por dentro)
revoke all on function public.meu_papel() from public, anon;
revoke all on function public.minha_regiao_equipe() from public, anon;
revoke all on function public.moderar_anuncio(uuid, text, text) from public, anon;
revoke all on function public.moderar_pedido(uuid, text, text) from public, anon;
revoke all on function public.resolver_denuncia(uuid, boolean) from public, anon;
revoke all on function public.moderar_banner_vitrine(uuid, text) from public, anon;
revoke all on function public.moderar_radar(text, uuid, text, text) from public, anon;
revoke all on function public.admin_resumo_pagamentos(text, text, uuid, date, date) from public, anon;
revoke all on function public.admin_lojas(text, text, uuid, text, integer, integer) from public, anon;
revoke all on function public.admin_acao_loja(uuid, text, text, integer, text) from public, anon;
revoke all on function public.admin_analisar_verificacao(uuid, boolean, text) from public, anon;
revoke all on function public.equipe_lista() from public, anon;
revoke all on function public.equipe_buscar_conta(text, text[]) from public, anon;
revoke all on function public.equipe_salvar(text, text, uuid, text) from public, anon;
revoke all on function public.equipe_desativar(text, text) from public, anon;
revoke all on function public.compliance_entrar(text) from public, anon;
revoke all on function public.compliance_abrir(text, text) from public, anon;
revoke all on function public.compliance_buscar(uuid, text, text) from public, anon;
revoke all on function public.compliance_conta(uuid, text, text) from public, anon;
revoke all on function public.compliance_pedir_relatorio(uuid, text, text, text) from public, anon;
revoke all on function public.compliance_relatorio(uuid, text) from public, anon;
grant execute on function public.meu_papel(), public.minha_regiao_equipe(),
  public.moderar_anuncio(uuid, text, text), public.moderar_pedido(uuid, text, text), public.resolver_denuncia(uuid, boolean),
  public.moderar_banner_vitrine(uuid, text), public.moderar_radar(text, uuid, text, text),
  public.admin_resumo_pagamentos(text, text, uuid, date, date), public.admin_lojas(text, text, uuid, text, integer, integer),
  public.admin_acao_loja(uuid, text, text, integer, text), public.admin_analisar_verificacao(uuid, boolean, text),
  public.equipe_lista(), public.equipe_buscar_conta(text, text[]), public.equipe_salvar(text, text, uuid, text),
  public.equipe_desativar(text, text),
  public.compliance_entrar(text), public.compliance_abrir(text, text), public.compliance_buscar(uuid, text, text),
  public.compliance_conta(uuid, text, text), public.compliance_pedir_relatorio(uuid, text, text, text),
  public.compliance_relatorio(uuid, text)
  to authenticated, service_role;

-- Internas: ninguém chama pela API
revoke all on function public.compliance_dados(text) from public, anon, authenticated;
revoke all on function public.compliance_consulta_valida(uuid) from public, anon, authenticated;
revoke all on function public.ip_ou_nulo(text) from public, anon, authenticated;
