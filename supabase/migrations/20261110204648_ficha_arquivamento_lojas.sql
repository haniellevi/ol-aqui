-- Uma loja arquivada permanece suspensa para todas as regras já existentes
-- de catálogo, pagamentos, anúncios e permissões de gerentes.
alter table public.vitrines_lojas add column arquivada_em timestamptz;
alter table public.vitrines_lojas add constraint loja_arquivada_suspensa
  check (arquivada_em is null or (tipo = 'loja' and status = 'suspensa'));

alter table public.vitrines_acoes_admin drop constraint vitrines_acoes_admin_acao_check;
alter table public.vitrines_acoes_admin add constraint vitrines_acoes_admin_acao_check
  check (acao in ('cortesia', 'trocar_plano', 'suspender', 'reativar', 'dar_selo', 'tirar_selo',
                  'verificacao_aprovada', 'verificacao_correcao', 'verificacao_recusada',
                  'arquivar', 'restaurar'));

create or replace function public.situacao_vitrine(v public.vitrines_lojas)
returns text language plpgsql stable security definer
set search_path = public, extensions
as $$
declare p public.planos;
begin
  if v.arquivada_em is not null then return 'arquivada'; end if;
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
       and case when termo ~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' then v.id = termo::uuid
            else (termo is null
            or public.sem_acento(lower(v.nome)) like '%' || public.sem_acento(lower(termo)) || '%'
            or v.slug like '%' || lower(termo) || '%'
            or public.sem_acento(lower(pf.nome)) like '%' || public.sem_acento(lower(termo)) || '%'
            or (pode_ver_contato and digito is not null and char_length(digito) >= 4
                and (coalesce(v.whatsapp, '') like '%' || digito || '%' or coalesce(pf.whatsapp, '') like '%' || digito || '%'
                     or coalesce(v.cnpj, '') like '%' || digito || '%'))) end
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

create function public.admin_ficha_loja(p_loja uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  loja public.vitrines_lojas;
  admin boolean := public.e_admin();
begin
  select * into loja from public.vitrines_lojas where id = p_loja;
  if not found or (not public.tem_papel('suporte') and
                   public.minha_regiao_equipe() is distinct from loja.microrregiao_id) then
    return null;
  end if;

  return jsonb_build_object(
    'atualizado_em', loja.atualizado_em,
    'verificacao', loja.verificacao_estado,
    'anuncios', (select count(*) from public.anuncios where vitrine_id = p_loja),
    'gerentes', case when public.tem_papel('suporte') then
      (select count(*) from public.convites_gerente_loja
        where vitrine_id = p_loja and revogado_em is null and aceito_por is not null) end,
    'convites', case when public.tem_papel('suporte') then
      (select count(*) from public.convites_gerente_loja
        where vitrine_id = p_loja and revogado_em is null and aceito_por is null and expira_em > now()) end,
    'pagamentos', case when admin then
      (select count(*) from public.pagamentos where vitrine_id = p_loja) end,
    'cobrancas_pendentes', case when admin then
      (select count(*) from public.pagamentos where vitrine_id = p_loja and status = 'pendente') end,
    'destaques_pagos', case when admin then
      (select count(*) from public.pagamentos where vitrine_id = p_loja and status = 'pago' and tipo = 'destaque') end,
    'congelados', case when admin then
      (select count(*) from public.anuncios where vitrine_id = p_loja and status = 'congelado') end,
    'historico', case when admin then (
      select coalesce(jsonb_agg(to_jsonb(h) order by h.criado_em desc, h.id desc), '[]'::jsonb)
      from (
        select a.id, a.acao, a.motivo, a.criado_em, coalesce(p.nome, a.admin_id) as operador
          from public.vitrines_acoes_admin a left join public.perfis p on p.id = a.admin_id
         where a.vitrine_id = p_loja order by a.criado_em desc, a.id desc limit 30
      ) h
    ) end
  );
end $$;

create function public.admin_arquivar_loja(
  p_loja uuid, p_arquivar boolean, p_motivo text, p_atualizado_em timestamptz
) returns void language plpgsql security definer set search_path = '' as $$
declare
  loja public.vitrines_lojas;
  pausados integer := 0;
  antes text := coalesce(current_setting('olaki.sistema', true), '');
begin
  if not public.e_admin() then
    raise exception 'Só um administrador pode arquivar ou restaurar lojas.' using errcode = '42501';
  end if;
  if p_arquivar is null or p_atualizado_em is null or char_length(btrim(coalesce(p_motivo, ''))) not between 3 and 300 then
    raise exception 'Informe um motivo de 3 a 300 caracteres e confira a ficha da loja.' using errcode = '22023';
  end if;
  select * into loja from public.vitrines_lojas where id = p_loja and tipo = 'loja' for update;
  if not found then raise exception 'Loja não encontrada.' using errcode = '22023'; end if;
  if p_arquivar = (loja.arquivada_em is not null) then return; end if;
  if loja.atualizado_em is distinct from p_atualizado_em then
    raise exception 'A loja mudou desde que você abriu a ficha. Atualize e confira antes de tentar novamente.' using errcode = 'P0001';
  end if;

  perform set_config('olaki.sistema', '1', true);
  update public.vitrines_lojas
     set status = 'suspensa', arquivada_em = case when p_arquivar then now() end
   where id = loja.id;
  if p_arquivar then
    update public.anuncios set status = 'pausado' where vitrine_id = loja.id and status = 'ativo';
    get diagnostics pausados = row_count;
  end if;
  perform set_config('olaki.sistema', antes, true);

  insert into public.vitrines_acoes_admin (vitrine_id, admin_id, acao, motivo, detalhes)
  values (loja.id, public.usuario_id(), case when p_arquivar then 'arquivar' else 'restaurar' end,
          btrim(p_motivo), jsonb_build_object('status_anterior', loja.status, 'anuncios_pausados', pausados));
end $$;

revoke all on function public.admin_ficha_loja(uuid), public.admin_arquivar_loja(uuid, boolean, text, timestamptz) from public, anon;
grant execute on function public.admin_ficha_loja(uuid), public.admin_arquivar_loja(uuid, boolean, text, timestamptz) to authenticated;
