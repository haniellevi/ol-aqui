-- Verificação automática de lojas, núcleo no banco: pedido, envio com limite, arquivos privados,
-- situação para a loja e UMA função de decisão que muda estado, revisão, motivo e selo juntos
-- (selo_loja_verificada = true <=> verificacao_estado = 'aprovada').

-- Motivos e ações novos.
alter table public.vitrines_lojas drop constraint vitrines_lojas_verificacao_motivo_check;
alter table public.vitrines_lojas add constraint vitrines_lojas_verificacao_motivo_check
  check (verificacao_motivo in ('dados_inconsistentes', 'link_invalido', 'contato_nao_confirmado', 'titularidade', 'outro',
                                'arquivo_ilegivel', 'comprovante_invalido', 'cnpj_inativo', 'cnpj_nao_encontrado', 'dados_mudaram'));

alter table public.vitrines_acoes_admin drop constraint vitrines_acoes_admin_acao_check;
alter table public.vitrines_acoes_admin add constraint vitrines_acoes_admin_acao_check
  check (acao in ('cortesia', 'trocar_plano', 'suspender', 'reativar', 'dar_selo', 'tirar_selo',
                  'verificacao_aprovada', 'verificacao_correcao', 'verificacao_recusada',
                  'arquivar', 'restaurar',
                  'verificacao_enviada', 'verificacao_ia_aprovada', 'verificacao_ia_correcao',
                  'verificacao_ia_recusada', 'verificacao_revisada', 'verificacao_selo_removido'));

-- Pedido de verificação. Os arquivos ficam só enquanto o pedido está aberto e nunca saem pela API.
create table public.verificacoes_loja (
  id uuid primary key default gen_random_uuid(),
  vitrine_id uuid not null references public.vitrines_lojas(id) on delete cascade,
  perfil_id text not null references public.perfis(id) on delete cascade,
  cnpj text not null check (cnpj ~ '^[0-9]{14}$'),
  identidade text not null,
  revisao_loja integer not null,
  status text not null default 'enviada'
    check (status in ('enviada', 'analisando', 'equipe', 'revisao_amostra', 'aprovada', 'correcao', 'recusada', 'obsoleta')),
  comprovante bytea,
  tipo_comprovante text check (tipo_comprovante in ('application/pdf', 'image/jpeg', 'image/png')),
  fachada bytea,
  tipo_fachada text check (tipo_fachada in ('application/pdf', 'image/jpeg', 'image/png')),
  parecer jsonb not null default '[]'::jsonb,
  motivo text,
  motivos_equipe text[] not null default '{}',
  reserva uuid,
  uso_id uuid,
  amostra boolean not null default false,
  tentativas_receita smallint not null default 0,
  proxima_em timestamptz not null default now(),
  criado_em timestamptz not null default now(),
  iniciado_em timestamptz,
  encaminhada_em timestamptz,
  prazo_em timestamptz,
  lembrete_em timestamptz,
  decidido_em timestamptz,
  decidido_por text references public.perfis(id) on delete set null,
  check (
    (status in ('enviada', 'analisando', 'equipe', 'revisao_amostra')
      and comprovante is not null and tipo_comprovante is not null
      and (fachada is null) = (tipo_fachada is null))
    or (status not in ('enviada', 'analisando', 'equipe', 'revisao_amostra')
      and comprovante is null and tipo_comprovante is null and fachada is null and tipo_fachada is null)
  ),
  check (octet_length(comprovante) between 1 and 2097152),
  check (octet_length(fachada) between 1 and 2097152)
);
create unique index verificacoes_loja_um_aberto on public.verificacoes_loja(vitrine_id)
  where status in ('enviada', 'analisando', 'equipe');
create index verificacoes_loja_por_loja on public.verificacoes_loja(vitrine_id, criado_em desc);
alter table public.verificacoes_loja enable row level security;
revoke all on public.verificacoes_loja from public, anon, authenticated, service_role;

-- Decisão única. Interna: só outras funções security definer chamam.
create function public.verificacao_loja_definir(
  p_loja uuid, p_estado text, p_motivo text, p_acao text, p_ator text, p_detalhes jsonb
)
returns void language plpgsql security definer
set search_path = public, extensions
as $$
declare
  loja public.vitrines_lojas;
  texto text;
begin
  if p_estado is null or p_estado not in ('pendente', 'aprovada', 'correcao', 'recusada') then
    raise exception 'Estado de verificação inválido.' using errcode = '22023';
  end if;
  select * into loja from public.vitrines_lojas v where v.id = p_loja and v.tipo = 'loja' for update;
  if not found then
    raise exception 'Loja não encontrada.' using errcode = '22023';
  end if;

  texto := coalesce(nullif(btrim(p_motivo), ''), case p_acao
    when 'verificacao_enviada' then 'Pedido de verificação enviado pela loja'
    when 'verificacao_aprovada' then 'Dados, links e contato conferidos'
    when 'verificacao_ia_aprovada' then 'Aprovada pela conferência automática'
    when 'verificacao_ia_correcao' then 'Correção pedida pela conferência automática'
    when 'verificacao_ia_recusada' then 'Recusada pela conferência automática'
    when 'verificacao_revisada' then 'Decisão da equipe sobre o pedido de verificação'
    when 'verificacao_selo_removido' then 'Selo de loja verificada removido'
    else 'Mudança na verificação da loja'
  end);

  update public.vitrines_lojas
     set verificacao_estado = p_estado,
         verificacao_revisao = loja.verificacao_revisao + 1,
         verificacao_motivo = case when p_estado <> 'aprovada' then nullif(btrim(p_motivo), '') end,
         selo_loja_verificada = (p_estado = 'aprovada')
   where id = loja.id;

  insert into public.vitrines_acoes_admin (vitrine_id, admin_id, acao, motivo, detalhes)
  values (loja.id, p_ator, p_acao, texto,
          jsonb_build_object('revisao', loja.verificacao_revisao, 'anterior', loja.verificacao_estado, 'decisao', p_estado)
          || coalesce(p_detalhes, '{}'::jsonb));
end $$;

-- A revisão manual mantém assinatura, guarda e erros; só o miolo passa a ser a decisão única.
create or replace function public.admin_revisar_loja(p_loja uuid, p_revisao integer, p_decisao text, p_motivo text,
                                                     p_dados boolean, p_link boolean, p_whatsapp boolean)
returns void language plpgsql security definer
set search_path = public
as $$
declare
  loja public.vitrines_lojas;
  estado text;
  acao text;
begin
  if not public.tem_papel('suporte') then
    raise exception 'Só a equipe OLAKI pode revisar lojas.' using errcode = '42501';
  end if;
  if p_decisao = 'aprovar' then
    estado := 'aprovada';
    acao := 'verificacao_aprovada';
    if p_dados is not true or p_link is not true or p_whatsapp is not true then
      raise exception 'Confirme os dados, os links e o WhatsApp antes de aprovar.' using errcode = '23514';
    end if;
  elsif p_decisao in ('correcao', 'recusar') then
    estado := case when p_decisao = 'correcao' then 'correcao' else 'recusada' end;
    acao := case when p_decisao = 'correcao' then 'verificacao_correcao' else 'verificacao_recusada' end;
    if p_motivo is null or p_motivo not in ('dados_inconsistentes', 'link_invalido', 'contato_nao_confirmado', 'titularidade', 'outro') then
      raise exception 'Escolha o motivo da decisão.' using errcode = '23514';
    end if;
  else
    raise exception 'Escolha uma decisão válida.' using errcode = '22023';
  end if;

  select * into loja from public.vitrines_lojas v where v.id = p_loja and v.tipo = 'loja' for update;
  if not found then
    raise exception 'Loja não encontrada.' using errcode = '22023';
  end if;
  if p_revisao is distinct from loja.verificacao_revisao then
    raise exception 'Os dados ou a decisão mudaram. Atualize a página e confira novamente.' using errcode = 'P0001';
  end if;
  if estado = 'aprovada' and not public.whatsapp_confirmado(loja.dono_id) then
    raise exception 'A conta da loja precisa confirmar o WhatsApp antes da aprovação.' using errcode = '23514';
  end if;

  perform public.verificacao_loja_definir(loja.id, estado, case when estado <> 'aprovada' then p_motivo end,
                                          acao, public.usuario_id(), null);
end $$;

-- Envio feito pelo servidor (service_role). Sem fachada, passe null: texto vazio devolve 'invalido'. Arquivos chegam em base64 e ficam em bytea.
create function public.enviar_verificacao_loja(p_usuario text, p_cnpj text, p_comprovante text, p_fachada text)
returns text language plpgsql security definer
set search_path = public, extensions
as $$
declare
  perfil public.perfis;
  loja public.vitrines_lojas;
  comp bytea;
  fach bytea;
  tipo_comp text;
  tipo_fach text;
begin
  select p.* into perfil from public.perfis p where p.id = p_usuario for update;
  if not found then return 'conta'; end if;
  select v.* into loja from public.vitrines_lojas v where v.dono_id = p_usuario and v.tipo = 'loja' limit 1 for update;  -- trava a loja (perfil -> loja, como o definir): uma aprovação da equipe no meio não é desfeita
  if not found or loja.status <> 'ativa'
     or exists (select 1 from public.contas_revogadas r where r.usuario_id = p_usuario) then
    return 'conta';
  end if;
  if perfil.whatsapp is null or perfil.whatsapp_verificado_em is null then return 'whatsapp'; end if;
  if loja.selo_loja_verificada then return 'verificada'; end if;
  if exists (select 1 from public.verificacoes_loja v
              where v.vitrine_id = loja.id and v.status in ('enviada', 'analisando', 'equipe')) then
    return 'pendente';
  end if;
  if (select count(*) from public.verificacoes_loja v
       where v.vitrine_id = loja.id and v.criado_em >= now() - interval '24 hours') >= 3 then
    return 'limite';
  end if;
  if p_cnpj is null or p_cnpj !~ '^[0-9]{14}$' then return 'cnpj'; end if;

  if p_comprovante is null or length(p_comprovante) > 2796204
     or (p_fachada is not null and length(p_fachada) > 2796204) then
    return 'invalido';
  end if;
  begin
    comp := decode(p_comprovante, 'base64');
    if p_fachada is not null then fach := decode(p_fachada, 'base64'); end if;
  exception when invalid_parameter_value or invalid_text_representation then
    return 'invalido';
  end;
  tipo_comp := public.mime_documento_pf(comp);
  tipo_fach := case when fach is not null then public.mime_documento_pf(fach) end;
  if tipo_comp is null or octet_length(comp) > 2097152 or octet_length(comp) < 1
     or (fach is not null and (tipo_fach is null or octet_length(fach) > 2097152 or fach = comp)) then
    return 'invalido';
  end if;

  perform public.verificacao_loja_definir(loja.id, 'pendente', null, 'verificacao_enviada', p_usuario, null);
  select v.* into loja from public.vitrines_lojas v where v.id = loja.id;

  insert into public.verificacoes_loja(vitrine_id, perfil_id, cnpj, identidade, revisao_loja,
                                       comprovante, tipo_comprovante, fachada, tipo_fachada)
  values (loja.id, p_usuario, p_cnpj,
          md5(concat_ws('|', coalesce(loja.cidade, ''), coalesce(loja.bairro, ''), coalesce(loja.endereco, ''),
                         coalesce(loja.whatsapp, ''), coalesce(loja.microrregiao_id::text, ''), p_cnpj)),
          loja.verificacao_revisao, comp, tipo_comp, fach, tipo_fach);
  return 'enviada';
end $$;

-- Situação mostrada à loja. O selo da própria loja manda; o último pedido só completa os detalhes.
create function public.minha_verificacao_loja_envio()
returns table (status text, motivo text, criado_em timestamptz, decidido_em timestamptz, prazo_em timestamptz,
               envios_hoje integer, verificada boolean, whatsapp_ok boolean)
language sql stable security definer
set search_path = public, extensions
as $$
  select case
           when v.selo_loja_verificada then 'aprovada'
           when u.status in ('enviada', 'analisando') then 'conferindo'
           when u.status = 'equipe' then 'equipe'
           when v.verificacao_estado in ('correcao', 'recusada') then v.verificacao_estado
           when u.status = 'obsoleta' then 'obsoleta'
           else 'nao_enviada'
         end,
         case when not v.selo_loja_verificada and coalesce(u.status, '-') not in ('enviada', 'analisando', 'equipe')
                   and v.verificacao_estado in ('correcao', 'recusada') then v.verificacao_motivo end,
         u.criado_em, u.decidido_em, u.prazo_em,
         (select count(*)::integer from public.verificacoes_loja h
           where h.vitrine_id = v.id and h.criado_em >= now() - interval '24 hours'),
         v.selo_loja_verificada,
         public.whatsapp_confirmado(v.dono_id)
    from public.vitrines_lojas v
    left join lateral (
      select r.status, r.criado_em, r.decidido_em, r.prazo_em from public.verificacoes_loja r
       where r.vitrine_id = v.id order by r.criado_em desc, r.id desc limit 1
    ) u on true
   where v.dono_id = public.usuario_id() and v.tipo = 'loja'
$$;

revoke all on function public.verificacao_loja_definir(uuid, text, text, text, text, jsonb),
  public.enviar_verificacao_loja(text, text, text, text), public.minha_verificacao_loja_envio()
  from public, anon, authenticated, service_role;
grant execute on function public.enviar_verificacao_loja(text, text, text, text) to service_role;
grant execute on function public.minha_verificacao_loja_envio() to authenticated;
