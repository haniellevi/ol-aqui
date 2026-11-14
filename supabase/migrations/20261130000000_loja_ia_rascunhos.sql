-- Convites são operados pelo banco, sem acesso direto pela API.
create table public.loja_ia_convites (
  usuario_id text primary key references public.perfis(id) on update cascade on delete cascade,
  criado_em timestamptz not null default now()
);
create table public.loja_ia_rascunhos (
  id uuid primary key default gen_random_uuid(),
  dono_id text not null references public.perfis(id) on update cascade on delete cascade,
  revisao integer not null default 0 check (revisao >= 0),
  estado text not null default 'coleta' check (estado in ('coleta','processando','pronto','publicado')),
  entrada jsonb not null default '{"nome":"","cidade":"","materiais":[],"consultarWhatsapp":false,"avisarWhatsapp":false}',
  fontes jsonb not null default '{}',
  campos jsonb not null default '{}',
  vitrine_id uuid references public.vitrines_lojas(id),
  whatsapp_autorizado text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create unique index loja_ia_um_ativo on public.loja_ia_rascunhos(dono_id) where estado <> 'publicado';
alter table public.loja_ia_convites enable row level security;
alter table public.loja_ia_rascunhos enable row level security;
revoke all on public.loja_ia_convites, public.loja_ia_rascunhos from public, anon, authenticated;
grant select on public.loja_ia_convites to service_role;
grant select, update on public.loja_ia_rascunhos to service_role;

create function public.loja_ia_exigir_elegibilidade() returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare uid text := public.usuario_id(); v public.vitrines_lojas;
begin
  if uid is null then raise exception 'Faça login para continuar.' using errcode='28000'; end if;
  if not exists(select 1 from public.perfis where id=uid) or not exists(select 1 from public.loja_ia_convites where usuario_id=uid) then
    raise exception 'Conta não autorizada para o piloto.' using errcode='42501';
  end if;
  select * into v from public.vitrines_lojas where dono_id=uid;
  if v.status = 'suspensa' then raise exception 'Conta de vendedor suspensa.' using errcode='42501'; end if;
  if v.tipo = 'loja' then raise exception 'Esta conta já tem loja.' using errcode='42501', detail=v.id::text; end if;
  return uid;
end $$;
revoke all on function public.loja_ia_exigir_elegibilidade() from public, anon, authenticated;

create function public.loja_ia_piloto_autorizado() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists(select 1 from public.loja_ia_convites where usuario_id=public.usuario_id())
$$;
create function public.loja_ia_json(r public.loja_ia_rascunhos) returns jsonb
language sql immutable set search_path=public, pg_temp as $$
  select jsonb_build_object('id',r.id,'revisao',r.revisao,'estado',r.estado,'entrada',r.entrada,'fontes',r.fontes,'campos',r.campos,'vitrineId',r.vitrine_id)
$$;
revoke all on function public.loja_ia_json(public.loja_ia_rascunhos) from public, anon, authenticated;
create function public.loja_ia_obter() returns jsonb
language sql stable security definer set search_path=public, pg_temp as $$
  select public.loja_ia_json(r) from public.loja_ia_rascunhos r where r.dono_id=public.usuario_id() and r.estado <> 'publicado' limit 1
$$;
create function public.loja_ia_abrir_coleta() returns jsonb
language plpgsql security definer set search_path=public, pg_temp as $$
declare uid text := public.loja_ia_exigir_elegibilidade(); r public.loja_ia_rascunhos;
begin
  insert into public.loja_ia_rascunhos(dono_id, campos)
  select uid, jsonb_object_agg(c, '{"valor":null,"editado":false,"origem":null,"sugestao":null}'::jsonb)
  from unnest(array['nome','cidade','slug','categoria','sobre','whatsapp','endereco','site','instagram','logo','capa']) c
  on conflict (dono_id) where estado <> 'publicado' do nothing;
  select * into r from public.loja_ia_rascunhos where dono_id=uid and estado <> 'publicado';
  return public.loja_ia_json(r);
end $$;
create function public.loja_ia_salvar_coleta(p_id uuid, p_revisao integer, p_entrada jsonb) returns jsonb
language plpgsql security definer set search_path=public, pg_temp as $$
declare uid text := public.loja_ia_exigir_elegibilidade(); r public.loja_ia_rascunhos; numero text; k text;
begin
  select * into r from public.loja_ia_rascunhos where id=p_id and dono_id=uid for update;
  if not found then raise exception 'Rascunho não encontrado.' using errcode='42501'; end if;
  if r.revisao is distinct from p_revisao then raise exception 'Rascunho atualizado em outra aba.' using errcode='40001'; end if;
  if r.estado <> 'coleta' then raise exception 'Coleta já encerrada.' using errcode='42501'; end if;
  if jsonb_typeof(p_entrada) is distinct from 'object' or not (p_entrada ?& array['nome','cidade','materiais','consultarWhatsapp','avisarWhatsapp'])
    or exists(select 1 from jsonb_object_keys(p_entrada) key where key <> all(array['nome','cidade','site','instagram','facebook','cnpj','descricao','materiais','consultarWhatsapp','avisarWhatsapp']))
    or jsonb_typeof(p_entrada->'nome') <> 'string' or jsonb_typeof(p_entrada->'cidade') <> 'string'
    or jsonb_typeof(p_entrada->'materiais') <> 'array' or jsonb_typeof(p_entrada->'consultarWhatsapp') <> 'boolean' or jsonb_typeof(p_entrada->'avisarWhatsapp') <> 'boolean'
    or exists(select 1 from jsonb_array_elements(p_entrada->'materiais') x where jsonb_typeof(x) <> 'string')
    or pg_column_size(p_entrada) > 32768 then
    raise exception 'Dados da coleta inválidos.' using errcode='22023';
  end if;
  foreach k in array array['site','instagram','facebook','cnpj','descricao'] loop
    if p_entrada ? k and jsonb_typeof(p_entrada->k) <> 'string' then raise exception 'Dados da coleta inválidos.' using errcode='22023'; end if;
  end loop;
  if (p_entrada->>'consultarWhatsapp')::boolean or (p_entrada->>'avisarWhatsapp')::boolean then
    select whatsapp into numero from public.perfis where id=uid and whatsapp_verificado_em is not null and public.whatsapp_confirmado(uid);
    if numero is null then raise exception 'Confirme seu WhatsApp antes de autorizar.' using errcode='42501'; end if;
  end if;
  update public.loja_ia_rascunhos set entrada=p_entrada, whatsapp_autorizado=numero, revisao=revisao+1, atualizado_em=now() where id=r.id returning * into r;
  return public.loja_ia_json(r);
end $$;
revoke all on function public.loja_ia_piloto_autorizado(), public.loja_ia_obter(), public.loja_ia_abrir_coleta(), public.loja_ia_salvar_coleta(uuid,integer,jsonb) from public, anon;
grant execute on function public.loja_ia_piloto_autorizado(), public.loja_ia_obter(), public.loja_ia_abrir_coleta(), public.loja_ia_salvar_coleta(uuid,integer,jsonb) to authenticated;
