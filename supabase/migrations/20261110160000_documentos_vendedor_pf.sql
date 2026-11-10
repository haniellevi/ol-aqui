-- Arquivos privados, apagados da solicitação na mesma transação da decisão.
create table public.verificacoes_vendedor_pf (
  id uuid primary key default gen_random_uuid(),
  perfil_id text not null references public.perfis(id) on delete cascade,
  identidade text not null,
  status public.status_verificacao not null default 'pendente',
  documento bytea,
  comprovante bytea,
  tipo_documento text check (tipo_documento in ('application/pdf', 'image/jpeg', 'image/png')),
  tipo_comprovante text check (tipo_comprovante in ('application/pdf', 'image/jpeg', 'image/png')),
  motivo text check (motivo in ('arquivo_ilegivel', 'documento_invalido', 'endereco_nao_comprovado', 'dados_divergentes', 'reenviar')),
  criado_em timestamptz not null default now(),
  analisado_em timestamptz,
  analisado_por text references public.perfis(id) on delete set null,
  check (
    (status = 'pendente' and documento is not null and comprovante is not null and tipo_documento is not null and tipo_comprovante is not null)
    or (status <> 'pendente' and documento is null and comprovante is null and tipo_documento is null and tipo_comprovante is null)
  ),
  check (octet_length(documento) between 1 and 2097152),
  check (octet_length(comprovante) between 1 and 2097152)
);
create unique index verificacao_pf_uma_pendente on public.verificacoes_vendedor_pf(perfil_id) where status = 'pendente';
create index verificacao_pf_por_conta on public.verificacoes_vendedor_pf(perfil_id, criado_em desc);
alter table public.verificacoes_vendedor_pf enable row level security;
revoke all on public.verificacoes_vendedor_pf from public, anon, authenticated, service_role;
grant delete on public.verificacoes_vendedor_pf to service_role;
grant select (perfil_id) on public.verificacoes_vendedor_pf to service_role;

create function public.identidade_verificacao_pf(p public.perfis)
returns text language sql stable set search_path = public
as $$
  select md5(jsonb_build_array(p.nome, p.whatsapp, p.whatsapp_verificado_em is not null,
                             p.cidade, p.bairro, p.microrregiao_id)::text)
$$;

create function public.mime_documento_pf(p_bytes bytea)
returns text language sql immutable strict set search_path = public
as $$
  select case
    when substring(p_bytes for 5) = decode('255044462d', 'hex') then 'application/pdf'
    when substring(p_bytes for 3) = decode('ffd8ff', 'hex') then 'image/jpeg'
    when substring(p_bytes for 8) = decode('89504e470d0a1a0a', 'hex') then 'image/png'
  end
$$;

create function public.enviar_verificacao_vendedor_pf(p_usuario text, p_documento text, p_comprovante text)
returns text language plpgsql security definer set search_path = public
as $$
declare
  perfil public.perfis;
  doc bytea;
  comp bytea;
  tipo_doc text;
  tipo_comp text;
begin
  select p.* into perfil from public.perfis p where p.id = p_usuario for update;
  if not found or not exists (select 1 from public.vitrines_lojas v where v.dono_id = p_usuario and v.tipo = 'pf')
    or exists (select 1 from public.contas_revogadas r where r.usuario_id = p_usuario) then
    return 'conta';
  end if;
  if perfil.whatsapp is null or perfil.whatsapp_verificado_em is null then return 'whatsapp'; end if;
  if perfil.selo_negociador_certificado and perfil.verificacao_pf_em is not null then return 'verificada'; end if;
  if exists (select 1 from public.verificacoes_vendedor_pf v where v.perfil_id = p_usuario and v.status = 'pendente') then
    return 'pendente';
  end if;
  if (select count(*) from public.verificacoes_vendedor_pf v where v.perfil_id = p_usuario
       and v.criado_em >= now() - interval '24 hours') >= 3 then return 'limite'; end if;

  if p_documento is null or p_comprovante is null
    or length(p_documento) > 2796204 or length(p_comprovante) > 2796204 then return 'invalido'; end if;
  begin
    doc := decode(p_documento, 'base64');
    comp := decode(p_comprovante, 'base64');
  exception when invalid_parameter_value or invalid_text_representation then
    return 'invalido';
  end;
  tipo_doc := public.mime_documento_pf(doc);
  tipo_comp := public.mime_documento_pf(comp);
  if tipo_doc is null or tipo_comp is null or octet_length(doc) > 2097152 or octet_length(comp) > 2097152
     or doc = comp then return 'invalido'; end if;

  insert into public.verificacoes_vendedor_pf(perfil_id, identidade, documento, comprovante, tipo_documento, tipo_comprovante)
  values (p_usuario, public.identidade_verificacao_pf(perfil), doc, comp, tipo_doc, tipo_comp);
  return 'enviada';
end $$;

create function public.minha_verificacao_vendedor_pf()
returns table (status text, motivo text, criado_em timestamptz, analisado_em timestamptz)
language sql stable security definer set search_path = public
as $$
  select case
           when p.selo_negociador_certificado and p.verificacao_pf_em is not null then 'aprovada'
           when v.status = 'aprovada' then 'desatualizada'
           else coalesce(v.status::text, 'nao_enviada')
         end, v.motivo, v.criado_em, v.analisado_em
    from public.perfis p
    left join lateral (
      select r.status, r.motivo, r.criado_em, r.analisado_em from public.verificacoes_vendedor_pf r
      where r.perfil_id = p.id order by r.criado_em desc, r.id desc limit 1
    ) v on true
   where p.id = public.usuario_id()
     and exists (select 1 from public.vitrines_lojas l where l.dono_id = p.id and l.tipo = 'pf')
$$;

create function public.admin_fila_verificacao_pf()
returns table (id uuid, nome text, cidade text, criado_em timestamptz, dados_atuais boolean)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.tem_papel('suporte') then
    raise exception 'Só a equipe autorizada pode consultar a fila.' using errcode = '42501';
  end if;
  return query
  select v.id, p.nome, p.cidade, v.criado_em,
         v.identidade = public.identidade_verificacao_pf(p)
    from public.verificacoes_vendedor_pf v
    join public.perfis p on p.id = v.perfil_id
   where v.status = 'pendente'
     and not exists (select 1 from public.contas_revogadas r where r.usuario_id = p.id)
   order by v.criado_em, v.id limit 50;
end $$;

create function public.admin_arquivo_verificacao_pf(p_id uuid, p_tipo text)
returns table (arquivo_base64 text, mime text)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.tem_papel('suporte') then
    raise exception 'Só a equipe autorizada pode consultar os arquivos.' using errcode = '42501';
  end if;
  return query
  select encode(case when p_tipo = 'documento' then v.documento else v.comprovante end, 'base64'),
         case when p_tipo = 'documento' then v.tipo_documento else v.tipo_comprovante end
    from public.verificacoes_vendedor_pf v
   where v.id = p_id and v.status = 'pendente' and p_tipo in ('documento', 'comprovante')
     and not exists (select 1 from public.contas_revogadas r where r.usuario_id = v.perfil_id);
end $$;

create function public.admin_decidir_verificacao_pf(
  p_id uuid, p_aprovar boolean, p_dados boolean, p_documento boolean, p_endereco boolean, p_motivo text
)
returns void language plpgsql security definer set search_path = public
as $$
declare
  dono text;
  perfil public.perfis;
  revisao public.verificacoes_vendedor_pf;
  vitrine uuid;
begin
  if not public.tem_papel('suporte') then
    raise exception 'Só a equipe autorizada pode analisar o envio.' using errcode = '42501';
  end if;
  if p_aprovar is null then raise exception 'Escolha uma decisão.' using errcode = '22023'; end if;
  select v.perfil_id into dono from public.verificacoes_vendedor_pf v where v.id = p_id;
  select p.* into perfil from public.perfis p where p.id = dono for update;
  if not found or exists (select 1 from public.contas_revogadas r where r.usuario_id = dono) then
    raise exception 'Solicitação indisponível.' using errcode = 'P0002';
  end if;
  select v.* into revisao from public.verificacoes_vendedor_pf v where v.id = p_id for update;
  if not found or revisao.status <> 'pendente' then
    raise exception 'Esta solicitação já foi analisada. Atualize a página.' using errcode = 'P0002';
  end if;
  if p_aprovar then
    if revisao.identidade is distinct from public.identidade_verificacao_pf(perfil) then
      raise exception 'Os dados do vendedor mudaram. Peça um novo envio.' using errcode = '23514';
    end if;
    if revisao.documento is null or revisao.comprovante is null then
      raise exception 'Os dois arquivos são necessários.' using errcode = '23514';
    end if;
    select v.id into vitrine from public.vitrines_lojas v where v.dono_id = dono and v.tipo = 'pf';
    if vitrine is null then raise exception 'Este perfil não é mais de vendedor individual.' using errcode = '23514'; end if;
    perform public.admin_verificar_vendedor_pf(vitrine, perfil.nome, true, p_dados, p_documento, p_endereco);
  elsif p_motivo is null or p_motivo not in ('arquivo_ilegivel', 'documento_invalido', 'endereco_nao_comprovado', 'dados_divergentes', 'reenviar') then
    raise exception 'Escolha o motivo da correção.' using errcode = '23514';
  end if;

  update public.verificacoes_vendedor_pf
     set status = case when p_aprovar then 'aprovada'::public.status_verificacao else 'recusada'::public.status_verificacao end,
         motivo = case when not p_aprovar then p_motivo end,
         analisado_por = public.usuario_id(), analisado_em = now(),
         documento = null, comprovante = null, tipo_documento = null, tipo_comprovante = null
   where id = p_id;
end $$;

-- A aprovação anterior só pode ser chamada internamente pela revisão do envio.
revoke all on function public.admin_verificar_vendedor_pf(uuid,text,boolean,boolean,boolean,boolean)
  from public, anon, authenticated, service_role;

create function public.admin_revogar_verificacao_pf(p_vitrine uuid, p_nome text)
returns void language sql security definer set search_path = public
as $$
  select public.admin_verificar_vendedor_pf(p_vitrine, p_nome, false, false, false, false)
$$;

revoke all on function public.identidade_verificacao_pf(public.perfis), public.mime_documento_pf(bytea),
  public.enviar_verificacao_vendedor_pf(text,text,text), public.minha_verificacao_vendedor_pf(),
  public.admin_fila_verificacao_pf(), public.admin_arquivo_verificacao_pf(uuid,text),
  public.admin_decidir_verificacao_pf(uuid,boolean,boolean,boolean,boolean,text),
  public.admin_revogar_verificacao_pf(uuid,text) from public, anon, authenticated, service_role;
grant execute on function public.enviar_verificacao_vendedor_pf(text,text,text) to service_role;
grant execute on function public.minha_verificacao_vendedor_pf(), public.admin_fila_verificacao_pf(),
  public.admin_arquivo_verificacao_pf(uuid,text), public.admin_decidir_verificacao_pf(uuid,boolean,boolean,boolean,boolean,text),
  public.admin_revogar_verificacao_pf(uuid,text) to authenticated;
