-- Um convite aceito é o vínculo de gerente. Os dados ficam atrás de RPCs
-- específicas, sem ampliar as permissões das tabelas de loja ou anúncios.
create table public.convites_gerente_loja (
  id uuid primary key default gen_random_uuid(),
  vitrine_id uuid not null references public.vitrines_lojas(id) on delete cascade,
  token_hash bytea not null unique,
  telefone_hash bytea not null,
  final_telefone text not null,
  expira_em timestamptz not null default (now() + interval '7 days'),
  aceito_por text references public.perfis(id) on delete cascade,
  aceito_em timestamptz,
  revogado_em timestamptz
);
alter table public.convites_gerente_loja enable row level security;
revoke all on public.convites_gerente_loja from public, anon, authenticated;
create index convites_gerente_vitrine_idx on public.convites_gerente_loja(vitrine_id);
create index convites_gerente_perfil_idx on public.convites_gerente_loja(aceito_por);
create unique index gerente_ativo_por_loja_idx on public.convites_gerente_loja(vitrine_id, aceito_por)
  where aceito_por is not null and revogado_em is null;

create function public.convidar_gerente_loja(p_loja uuid, p_whatsapp text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare token uuid := gen_random_uuid();
begin
  -- Serializa o limite de convites mesmo com vários envios simultâneos.
  perform 1 from public.vitrines_lojas v
   where v.id = p_loja and v.dono_id = public.usuario_id() and v.tipo = 'loja' and v.status = 'ativa'
   for update;
  if not found then raise exception 'Só o dono de uma loja ativa pode convidar gerentes.' using errcode = '42501'; end if;
  if p_whatsapp is null or p_whatsapp !~ '^55[1-9][0-9]9[0-9]{8}$' then
    raise exception 'Informe um celular brasileiro com DDD.' using errcode = '22023';
  end if;
  if exists (select 1 from public.perfis p where p.id = public.usuario_id() and p.whatsapp = p_whatsapp) then
    raise exception 'Use o WhatsApp da pessoa convidada.' using errcode = '22023';
  end if;
  if (select count(*) from public.convites_gerente_loja c
       where c.vitrine_id = p_loja and c.revogado_em is null and (c.aceito_por is not null or c.expira_em > now())) >= 20 then
    raise exception 'A loja atingiu o limite de 20 gerentes e convites pendentes.' using errcode = '22023';
  end if;
  insert into public.convites_gerente_loja(vitrine_id, token_hash, telefone_hash, final_telefone)
  values (p_loja, sha256(convert_to(token::text, 'UTF8')), sha256(convert_to(token::text || ':' || p_whatsapp, 'UTF8')), right(p_whatsapp, 4));
  return token;
end $$;

create function public.equipe_minha_loja(p_loja uuid)
returns table(id uuid, final_telefone text, expira_em timestamptz, gerente text)
language sql stable security definer set search_path = '' as $$
  select c.id, c.final_telefone, c.expira_em, p.nome
    from public.convites_gerente_loja c
    join public.vitrines_lojas v on v.id = c.vitrine_id
    left join public.perfis p on p.id = c.aceito_por
   where v.id = p_loja and v.dono_id = public.usuario_id() and v.tipo = 'loja'
     and c.revogado_em is null and (c.aceito_por is not null or c.expira_em > now())
   order by c.expira_em desc
$$;

create function public.revogar_gerente_loja(p_loja uuid, p_convite uuid)
returns boolean language sql security definer set search_path = '' as $$
  with revogado as (
    update public.convites_gerente_loja c set revogado_em = now()
      from public.vitrines_lojas v
     where c.id = p_convite and c.vitrine_id = v.id and v.id = p_loja
       and v.tipo = 'loja' and v.dono_id = public.usuario_id() and c.revogado_em is null
     returning c.id
  ) select exists(select 1 from revogado)
$$;

-- A consulta e o aceite usam a mesma regra. Só um WhatsApp confirmado no
-- perfil correspondente pode usar o link, mesmo que seja encaminhado.
create function public.convite_gerente_loja(p_token uuid, p_aceitar boolean default false)
returns table(loja_id uuid, nome text)
language plpgsql security definer set search_path = '' as $$
declare
  uid text := public.usuario_id();
  convite public.convites_gerente_loja;
  loja public.vitrines_lojas;
  whatsapp_confirmado text;
begin
  select p.whatsapp into whatsapp_confirmado from public.perfis p where p.id = uid and p.whatsapp_verificado_em is not null;
  if whatsapp_confirmado is null or exists (select 1 from public.termos_pendentes()) then return; end if;

  select c.* into convite from public.convites_gerente_loja c
   where c.token_hash = sha256(convert_to(p_token::text, 'UTF8')) and c.revogado_em is null
   for update;
  if not found then return; end if;
  if convite.aceito_por is not null then
    if convite.aceito_por <> uid then return; end if;
  elsif convite.expira_em <= now() or convite.telefone_hash <> sha256(convert_to(p_token::text || ':' || whatsapp_confirmado, 'UTF8')) then
    return;
  end if;

  select v.* into loja from public.vitrines_lojas v
   where v.id = convite.vitrine_id and v.tipo = 'loja' and v.status = 'ativa' and v.dono_id <> uid;
  if not found then return; end if;
  if p_aceitar and convite.aceito_por is null then
    begin
      update public.convites_gerente_loja set aceito_por = uid, aceito_em = now() where id = convite.id;
    exception when unique_violation then
      -- Outro convite para a mesma conta foi aceito em paralelo.
      update public.convites_gerente_loja set revogado_em = now() where id = convite.id;
    end;
  end if;
  return query select loja.id, loja.nome;
end $$;

create function public.minhas_lojas()
returns table(id uuid, nome text, dono boolean)
language sql stable security definer set search_path = '' as $$
  select v.id, v.nome, true as dono
    from public.vitrines_lojas v
   where v.tipo = 'loja' and v.dono_id = public.usuario_id()
   union all
  select v.id, v.nome, false as dono
    from public.convites_gerente_loja c
    join public.vitrines_lojas v on v.id = c.vitrine_id
   where c.aceito_por = public.usuario_id() and c.revogado_em is null
     and v.tipo = 'loja' and v.status = 'ativa' and v.dono_id <> public.usuario_id()
   order by dono desc, nome
$$;

create function public.dados_loja_gerenciada(p_loja uuid)
returns table(endereco text, lat double precision, lng double precision, horarios jsonb, sobre text, faz_entrega boolean, entrega_obs text)
language sql stable security definer set search_path = '' as $$
  select v.endereco, v.lat::double precision, v.lng::double precision, v.horarios, v.sobre, v.faz_entrega, v.entrega_obs
    from public.vitrines_lojas v
    join public.convites_gerente_loja c on c.vitrine_id = v.id
    join public.perfis p on p.id = c.aceito_por
   where v.id = p_loja and v.tipo = 'loja' and v.status = 'ativa'
     and c.aceito_por = public.usuario_id() and c.revogado_em is null
     and p.whatsapp is not null and p.whatsapp_verificado_em is not null
$$;

create function public.editar_loja_gerenciada(
  p_loja uuid, p_endereco text, p_lat double precision, p_lng double precision,
  p_horarios jsonb, p_sobre text, p_faz_entrega boolean, p_entrega_obs text
) returns void language plpgsql security definer set search_path = '' as $$
declare
  loja public.vitrines_lojas;
  sobre_limpo text := nullif(btrim(p_sobre), '');
  entrega_limpa text := nullif(regexp_replace(btrim(p_entrega_obs), '\s+', ' ', 'g'), '');
begin
  -- Revogação e edição do gerente disputam o mesmo bloqueio de linha.
  perform 1 from public.convites_gerente_loja c
    join public.perfis p on p.id = c.aceito_por
   where c.vitrine_id = p_loja and c.aceito_por = public.usuario_id() and c.revogado_em is null
     and p.whatsapp is not null and p.whatsapp_verificado_em is not null
   for update of c;
  if not found then raise exception 'Seu acesso a esta loja não está disponível.' using errcode = '42501'; end if;
  if exists (select 1 from public.termos_pendentes()) then
    raise exception 'Aceite os termos atualizados para salvar.' using errcode = '42501';
  end if;
  select v.* into loja from public.vitrines_lojas v
   where v.id = p_loja and v.tipo = 'loja' and v.status = 'ativa' for update;
  if not found then raise exception 'Esta loja não está disponível para edição.' using errcode = '42501'; end if;
  -- SECURITY DEFINER usa o papel do sistema. Repete aqui os filtros de texto
  -- que o gatilho aplica ao dono e mantém a descrição curta sincronizada.
  if sobre_limpo is distinct from loja.sobre and public.texto_bloqueado(sobre_limpo, loja.microrregiao_id) is not null then
    raise exception 'O texto Sobre nós tem uma palavra não permitida.' using errcode = '23514', detail = 'campo:sobre';
  end if;
  if entrega_limpa is distinct from loja.entrega_obs and public.texto_bloqueado(entrega_limpa, loja.microrregiao_id) is not null then
    raise exception 'O recado sobre entrega tem uma palavra não permitida.' using errcode = '23514', detail = 'campo:entrega_obs';
  end if;
  update public.vitrines_lojas
     set endereco = p_endereco, lat = p_lat, lng = p_lng, horarios = p_horarios,
         sobre = sobre_limpo,
         descricao = case when sobre_limpo is distinct from loja.sobre then left(sobre_limpo, 600) else loja.descricao end,
         faz_entrega = p_faz_entrega, entrega_obs = entrega_limpa
   where id = p_loja;
end $$;

revoke all on function public.convidar_gerente_loja(uuid,text), public.equipe_minha_loja(uuid),
  public.revogar_gerente_loja(uuid,uuid), public.convite_gerente_loja(uuid,boolean), public.minhas_lojas(),
  public.dados_loja_gerenciada(uuid),
  public.editar_loja_gerenciada(uuid,text,double precision,double precision,jsonb,text,boolean,text) from public, anon;
grant execute on function public.convidar_gerente_loja(uuid,text), public.equipe_minha_loja(uuid),
  public.revogar_gerente_loja(uuid,uuid), public.convite_gerente_loja(uuid,boolean), public.minhas_lojas(),
  public.dados_loja_gerenciada(uuid),
  public.editar_loja_gerenciada(uuid,text,double precision,double precision,jsonb,text,boolean,text) to authenticated;
