-- Radar v2, fase 1: quem atende o Radar e quem recebe aviso na hora.
--  * atende = loja ativa, VERIFICADA e com plano PAGO (ou cortesia da equipe com prazo);
--  * aviso na hora = só plano Full (ou cortesia).
-- Redefine tem_plano_pago para seguir a mesma regra (feed, propor_radar e fotos já chamam ela).

alter table public.planos add column aviso_radar_na_hora boolean not null default false;
update public.planos set aviso_radar_na_hora = true where codigo = 'full';

-- Cortesia: a equipe libera o Radar para uma loja por tempo limitado. Só funções mexem.
create table public.radar_cortesias (
  vitrine_id uuid primary key references public.vitrines_lojas(id) on delete cascade,
  ate        timestamptz not null,
  motivo     text check (char_length(motivo) between 3 and 300),
  criado_por text not null,
  criado_em  timestamptz not null default now()
);
alter table public.radar_cortesias enable row level security;
revoke all on public.radar_cortesias from public, anon, authenticated;

-- Vale até o instante gravado; vencida deixa de valer na hora (sem rotina).
create function public.radar_cortesia_ativa(p_vitrine uuid)
returns boolean language sql stable security definer
set search_path = public, extensions
as $$
  select exists (select 1 from public.radar_cortesias c where c.vitrine_id = p_vitrine and c.ate > now())
$$;

create function public.pode_atender_radar(uid text default public.usuario_id())
returns boolean language plpgsql stable security definer
set search_path = public, extensions
as $$
declare
  v         public.vitrines_lojas;
  p         public.planos;
  verificada boolean;
begin
  select * into v from public.vitrines_lojas where dono_id = uid;
  if v.id is null or v.status <> 'ativa' then return false; end if;
  if public.radar_cortesia_ativa(v.id) then return true; end if;

  if v.tipo = 'loja' then
    verificada := v.selo_loja_verificada;
  else
    select coalesce(pf.selo_negociador_certificado and pf.verificacao_pf_em is not null, false)
      into verificada from public.perfis pf where pf.id = uid;
  end if;
  if not coalesce(verificada, false) then return false; end if;

  p := public.plano_efetivo(v);
  return p.codigo is not null and p.acesso_radar and not p.e_teste and p.preco_centavos > 0;
end $$;

create function public.recebe_aviso_radar_na_hora(uid text)
returns boolean language plpgsql stable security definer
set search_path = public, extensions
as $$
declare
  v public.vitrines_lojas;
  p public.planos;
begin
  select * into v from public.vitrines_lojas where dono_id = uid;
  if v.id is null then return false; end if;
  if v.status = 'ativa' and public.radar_cortesia_ativa(v.id) then return true; end if;
  if not public.pode_atender_radar(uid) then return false; end if;
  p := public.plano_efetivo(v);
  return coalesce(p.aviso_radar_na_hora, false);
end $$;

-- O nome é histórico: hoje significa "pode atender o Radar" (verificada e paga, ou cortesia).
create or replace function public.tem_plano_pago(uid text default public.usuario_id())
returns boolean language sql stable security definer
set search_path = public, extensions
as $$ select public.pode_atender_radar(uid) $$;

-- Mesma conta de antes, mas cortesia ativa = ilimitado.
create or replace function public.propostas_restantes(uid text default public.usuario_id())
returns integer language plpgsql stable security definer
set search_path = public, extensions
as $$
declare
  v public.vitrines_lojas;
  p public.planos;
  usadas integer;
begin
  select * into v from public.vitrines_lojas where dono_id = uid;
  if v.id is null then return 0; end if;
  if public.pode_atender_radar(uid) and public.radar_cortesia_ativa(v.id) then return null; end if;
  p := public.plano_efetivo(v);
  if p.codigo is null or not p.acesso_radar then return 0; end if;
  if p.propostas_radar_mes is null then return null; end if;
  select count(*) into usadas from public.radar_propostas
   where vitrine_id = v.id
     and criado_em >= case when p.e_teste then v.criado_em else date_trunc('month', now()) end;
  return greatest(p.propostas_radar_mes - usadas, 0);
end $$;

-- Ações da equipe. O registro vai direto para logs_atividade (a tabela não tem coluna id).
create function public.dar_cortesia_radar(p_vitrine uuid, p_ate date, p_motivo text)
returns void language plpgsql security definer
set search_path = public, extensions
as $$
declare
  hoje   date := (now() at time zone 'America/Fortaleza')::date;
  v_motivo text := nullif(btrim(p_motivo), '');
  antes  public.radar_cortesias;
  depois public.radar_cortesias;
begin
  if not public.e_admin() then
    raise exception 'Só a equipe pode dar cortesia do Radar.' using errcode = '42501';
  end if;
  if p_ate is null or p_ate <= hoje or p_ate > hoje + 365 then
    raise exception using errcode = '23514', message = 'Escolha uma data futura, de no máximo 365 dias.', detail = 'campo:ate';
  end if;
  if v_motivo is null or char_length(v_motivo) not between 3 and 300 then
    raise exception using errcode = '23514', message = 'Diga o motivo (de 3 a 300 letras).', detail = 'campo:motivo';
  end if;
  if not exists (select 1 from public.vitrines_lojas where id = p_vitrine) then
    raise exception using errcode = '23514', message = 'Loja não encontrada.', detail = 'campo:vitrine';
  end if;

  select * into antes from public.radar_cortesias where vitrine_id = p_vitrine;
  insert into public.radar_cortesias (vitrine_id, ate, motivo, criado_por)
  values (p_vitrine, ((p_ate + 1)::timestamp at time zone 'America/Fortaleza') - interval '1 microsecond',
          v_motivo, public.usuario_id())
  on conflict (vitrine_id) do update
    set ate = excluded.ate, motivo = excluded.motivo, criado_por = excluded.criado_por, criado_em = now()
  returning * into depois;

  insert into public.logs_atividade (tabela, registro_id, acao, usuario_id, ip, user_agent, dados_antes, dados_depois)
  values ('radar_cortesias', p_vitrine::text, case when antes.vitrine_id is null then 'INSERT' else 'UPDATE' end,
          public.usuario_id(), public.ip_requisicao(), public.user_agent_requisicao(),
          case when antes.vitrine_id is not null then to_jsonb(antes) end, to_jsonb(depois));
end $$;

create function public.tirar_cortesia_radar(p_vitrine uuid)
returns void language plpgsql security definer
set search_path = public, extensions
as $$
declare antes public.radar_cortesias;
begin
  if not public.e_admin() then
    raise exception 'Só a equipe pode tirar cortesia do Radar.' using errcode = '42501';
  end if;
  delete from public.radar_cortesias where vitrine_id = p_vitrine returning * into antes;
  if antes.vitrine_id is not null then
    insert into public.logs_atividade (tabela, registro_id, acao, usuario_id, ip, user_agent, dados_antes)
    values ('radar_cortesias', p_vitrine::text, 'DELETE', public.usuario_id(),
            public.ip_requisicao(), public.user_agent_requisicao(), to_jsonb(antes));
  end if;
end $$;

revoke execute on function public.radar_cortesia_ativa(uuid), public.pode_atender_radar(text),
  public.recebe_aviso_radar_na_hora(text), public.dar_cortesia_radar(uuid, date, text),
  public.tirar_cortesia_radar(uuid) from public, anon;
grant execute on function public.radar_cortesia_ativa(uuid), public.pode_atender_radar(text),
  public.recebe_aviso_radar_na_hora(text), public.dar_cortesia_radar(uuid, date, text),
  public.tirar_cortesia_radar(uuid) to authenticated;
