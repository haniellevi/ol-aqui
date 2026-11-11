-- Gestão administrativa: alterações atômicas, versão do formulário e auditoria persistente.
create table public.admin_gestao_eventos (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('usuario', 'loja')),
  alvo text not null,
  autor text not null,
  acao text not null,
  motivo text not null check (char_length(btrim(motivo)) between 3 and 300),
  detalhes jsonb not null default '{}',
  criado_em timestamptz not null default now()
);
create index admin_gestao_alvo on public.admin_gestao_eventos(tipo, alvo, criado_em desc);
alter table public.admin_gestao_eventos enable row level security;
revoke all on public.admin_gestao_eventos from public, anon, authenticated;
grant select on public.admin_gestao_eventos to authenticated;
create policy "administrador consulta gestao" on public.admin_gestao_eventos for select to authenticated using (public.e_admin());

alter table public.perfis add column avatar_personalizado boolean not null default false;
grant select (avatar_personalizado) on public.perfis to service_role;

create table public.contas_bloqueadas (
  usuario_id text primary key references public.perfis(id) on delete cascade,
  bloqueada_em timestamptz not null default now()
);
alter table public.contas_bloqueadas enable row level security;
revoke all on public.contas_bloqueadas from public, anon, authenticated;

create function public.revogar_conta_definitivamente(p_id text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  perform 1 from public.perfis where id=p_id for update;
  delete from public.contas_bloqueadas where usuario_id=p_id;
  insert into public.contas_revogadas(usuario_id) values(p_id) on conflict do nothing;
end $$;
revoke all on function public.revogar_conta_definitivamente(text) from public,anon,authenticated,service_role;
grant execute on function public.revogar_conta_definitivamente(text) to service_role;

create or replace function public.usuario_id()
returns text language sql stable security definer set search_path=public,pg_temp as $$
  select identidade.uid from (select nullif(auth.jwt()->>'sub','') as uid) identidade
  where identidade.uid is not null
    and not exists(select 1 from public.contas_revogadas r where r.usuario_id=identidade.uid)
    and not exists(select 1 from public.contas_bloqueadas b where b.usuario_id=identidade.uid)
$$;

create function public.admin_usuarios(p_busca text default '', p_pagina integer default 1, p_ids text[] default null)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare resultado jsonb;
begin
  if not public.e_admin() then raise exception 'Acesso restrito ao administrador.' using errcode='42501'; end if;
  with filtrados as (
    select p.id,p.nome,p.whatsapp,p.cidade,p.tipo_pessoa,p.criado_em,
      exists(select 1 from public.contas_bloqueadas b where b.usuario_id=p.id) as bloqueado,
      (select v.id from public.vitrines_lojas v where v.dono_id=p.id) as loja_id
    from public.perfis p
    where (not exists(select 1 from public.contas_revogadas r where r.usuario_id=p.id)
      or exists(select 1 from public.contas_bloqueadas b where b.usuario_id=p.id))
      and (p_ids is null or p.id=any(p_ids))
      and (coalesce(p_busca,'')='' or p.id=p_busca or p.nome ilike '%'||left(p_busca,120)||'%'
           or p.whatsapp like '%'||nullif(regexp_replace(p_busca,'\D','','g'),'')||'%')
  )
  select jsonb_build_object('total',(select count(*) from filtrados),'itens',coalesce((
    select jsonb_agg(to_jsonb(f)) from (select * from filtrados order by criado_em desc,id
      limit 30 offset (greatest(1,least(coalesce(p_pagina,1),100000))-1)*30) f),'[]')) into resultado;
  return resultado;
end $$;

create function public.admin_usuario(p_id text)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
  if not public.e_admin() then raise exception 'Acesso restrito ao administrador.' using errcode='42501'; end if;
  return (select to_jsonb(p)-'criado_ip' || jsonb_build_object(
    'bloqueado',exists(select 1 from public.contas_bloqueadas b where b.usuario_id=p.id),
    'revogado',exists(select 1 from public.contas_revogadas r where r.usuario_id=p.id)
      and not exists(select 1 from public.contas_bloqueadas b where b.usuario_id=p.id),
    'loja_id',(select v.id from public.vitrines_lojas v where v.dono_id=p.id),
    'loja_nome',(select v.nome from public.vitrines_lojas v where v.dono_id=p.id)) from public.perfis p where p.id=p_id);
end $$;

create function public.admin_salvar_usuario(p_id text, p_versao timestamptz, p_dados jsonb, p_motivo text)
returns timestamptz language plpgsql security definer set search_path=public,pg_temp as $$
declare antigo public.perfis; novo public.perfis; versao timestamptz;
begin
  if not public.e_admin() then raise exception 'Acesso restrito ao administrador.' using errcode='42501'; end if;
  if jsonb_typeof(p_dados) is distinct from 'object' or exists(select 1 from jsonb_object_keys(p_dados) k
    where k not in ('nome','tipo_pessoa','microrregiao_id','cidade','bairro','whatsapp','avatar_url')) then
    raise exception 'Campos de cadastro inválidos.' using errcode='22023';
  end if;
  select * into antigo from public.perfis where id=p_id for update;
  if not found or (exists(select 1 from public.contas_revogadas where usuario_id=p_id)
    and not exists(select 1 from public.contas_bloqueadas where usuario_id=p_id)) then
    raise exception 'Conta não encontrada ou excluída.' using errcode='22023'; end if;
  if p_versao is distinct from antigo.atualizado_em then raise exception 'O cadastro mudou. Recarregue antes de salvar.' using errcode='P0001'; end if;
  novo := jsonb_populate_record(antigo,p_dados);
  novo.nome := btrim(novo.nome); novo.cidade := nullif(btrim(novo.cidade),''); novo.bairro := nullif(btrim(novo.bairro),'');
  if length(coalesce(novo.bairro,''))>80 or (novo.cidade is not null and not exists(
    select 1 from public.cidades where microrregiao_id=novo.microrregiao_id and nome=novo.cidade and ativa)) then
    raise exception 'Confira a cidade da região e o bairro (até 80 caracteres).' using errcode='23514'; end if;
  if novo.avatar_url is not null and (length(novo.avatar_url)>500 or novo.avatar_url !~ '^https://[^[:space:]]+$') then
    raise exception 'Use uma URL HTTPS para a foto.' using errcode='23514'; end if;
  update public.perfis set nome=novo.nome,tipo_pessoa=novo.tipo_pessoa,microrregiao_id=novo.microrregiao_id,
    cidade=novo.cidade,bairro=novo.bairro,whatsapp=novo.whatsapp,avatar_url=novo.avatar_url,
    avatar_personalizado=antigo.avatar_personalizado or novo.avatar_url is distinct from antigo.avatar_url,
    whatsapp_verificado_em=case when novo.whatsapp is distinct from antigo.whatsapp then null else antigo.whatsapp_verificado_em end,
    whatsapp_origem=case when novo.whatsapp is distinct from antigo.whatsapp then 'evolution' else antigo.whatsapp_origem end
    where id=p_id returning atualizado_em into versao;
  if novo.whatsapp is distinct from antigo.whatsapp then
    update public.whatsapp_desafios set cancelado=true where usuario_id=p_id and not cancelado;
  end if;
  insert into public.admin_gestao_eventos(tipo,alvo,autor,acao,motivo,detalhes)
    values('usuario',p_id,public.usuario_id(),'editar',p_motivo,jsonb_build_object('campos',p_dados));
  return versao;
end $$;

create function public.admin_bloquear_usuario(p_id text, p_bloquear boolean, p_motivo text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if not public.e_admin() then raise exception 'Acesso restrito ao administrador.' using errcode='42501'; end if;
  perform 1 from public.perfis where id=p_id for update;
  if not found then raise exception 'Conta não encontrada.' using errcode='22023'; end if;
  if p_id=public.usuario_id() or public.e_admin(p_id) then
    raise exception 'Não é possível bloquear a própria conta ou um administrador. Ajuste as permissões na Equipe primeiro.' using errcode='23514'; end if;
  if p_bloquear is null then raise exception 'Escolha bloquear ou desbloquear.' using errcode='22023'; end if;
  if p_bloquear then
    if exists(select 1 from public.contas_revogadas where usuario_id=p_id)
      and not exists(select 1 from public.contas_bloqueadas where usuario_id=p_id) then
      raise exception 'Esta conta já foi excluída.' using errcode='23514'; end if;
    insert into public.contas_bloqueadas(usuario_id) values(p_id) on conflict do nothing;
    -- Os endpoints internos já verificam a revogação. O marcador temporário bloqueia
    -- também as operações com service_role enquanto a conta está suspensa.
    insert into public.contas_revogadas(usuario_id,revogada_em)
      select usuario_id,bloqueada_em from public.contas_bloqueadas where usuario_id=p_id on conflict do nothing;
  else
    if exists(select 1 from public.contas_revogadas where usuario_id=p_id)
      and not exists(select 1 from public.contas_bloqueadas where usuario_id=p_id) then
      raise exception 'Esta conta foi excluída e não pode ser desbloqueada.' using errcode='23514'; end if;
    delete from public.contas_revogadas r using public.contas_bloqueadas b
      where r.usuario_id=p_id and b.usuario_id=r.usuario_id and r.revogada_em=b.bloqueada_em;
    delete from public.contas_bloqueadas where usuario_id=p_id;
  end if;
  insert into public.admin_gestao_eventos(tipo,alvo,autor,acao,motivo)
    values('usuario',p_id,public.usuario_id(),case when p_bloquear then 'bloquear' else 'desbloquear' end,p_motivo);
end $$;

-- Registra a solicitação antes de alterar credenciais externas. Nunca recebe senha ou token.
create function public.admin_registrar_acesso(p_id text, p_acao text, p_motivo text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if not public.e_admin() then raise exception 'Acesso restrito ao administrador.' using errcode='42501'; end if;
  if not exists(select 1 from public.perfis where id=p_id) then raise exception 'Conta não encontrada.' using errcode='22023'; end if;
  if p_acao is null or p_acao not in ('email_solicitado','email_concluido','senha_solicitada','senha_concluida','acesso_falhou') then
    raise exception 'Ação inválida.' using errcode='22023'; end if;
  insert into public.admin_gestao_eventos(tipo,alvo,autor,acao,motivo) values('usuario',p_id,public.usuario_id(),p_acao,p_motivo);
end $$;

create function public.admin_loja_detalhe(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
  if not public.e_admin() then raise exception 'Acesso restrito ao administrador.' using errcode='42501'; end if;
  return (select (to_jsonb(v)-'gateway_cliente_id'-'gateway_assinatura_id'-'criado_ip') || jsonb_build_object(
    'dono_nome',(select nome from public.perfis where id=v.dono_id),
    'anuncios_total',(select count(*) from public.anuncios where vitrine_id=v.id),
    'pagamentos_total',(select count(*) from public.pagamentos where vitrine_id=v.id),
    'propostas_total',(select count(*) from public.radar_propostas where vitrine_id=v.id),
    'retencoes_total',(select count(*) from public.anuncios where vitrine_id=v.id and
      (status='congelado' or status_antes_exclusao='congelado' or congelado_motivo is not null)) +
      (select count(*) from public.radar_propostas rp join public.radar_pedidos p on p.id=rp.pedido_id
       where rp.vitrine_id=v.id and p.status='congelado'))
    from public.vitrines_lojas v where v.id=p_id);
end $$;

create function public.admin_salvar_loja(p_id uuid, p_versao timestamptz, p_dados jsonb, p_motivo text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare antigo public.vitrines_lojas; novo public.vitrines_lojas; identificador uuid;
begin
  if not public.e_admin() then raise exception 'Acesso restrito ao administrador.' using errcode='42501'; end if;
  if jsonb_typeof(p_dados) is distinct from 'object' or exists(select 1 from jsonb_object_keys(p_dados) k
    where k not in ('dono_id','tipo','nome','slug','microrregiao_id','cidade','bairro','cnpj','whatsapp','telefone_publico',
      'site_url','instagram','descricao','sobre','endereco','lat','lng','horarios','formas_pagamento','faz_entrega','entrega_obs',
      'logo_url','capa_url','banner_tipo','banner_url','banner_modelo','banner_cor','categoria_loja','banner_aki_posicao')) then
    raise exception 'Campos da loja inválidos.' using errcode='22023'; end if;
  if p_id is not null then
    select * into antigo from public.vitrines_lojas where id=p_id for update;
    if not found then raise exception 'Loja não encontrada.' using errcode='22023'; end if;
    if p_versao is distinct from antigo.atualizado_em then raise exception 'A loja mudou. Recarregue antes de salvar.' using errcode='P0001'; end if;
    novo := jsonb_populate_record(antigo,p_dados);
  else
    novo := jsonb_populate_record(null::public.vitrines_lojas,p_dados);
  end if;
  perform 1 from public.perfis where id=novo.dono_id for update;
  if not found or exists(select 1 from public.contas_revogadas where usuario_id=novo.dono_id) then
    raise exception 'Escolha um titular com conta ativa no site.' using errcode='23514'; end if;
  if exists(select 1 from public.vitrines_lojas where dono_id=novo.dono_id and id is distinct from p_id) then
    raise exception 'Este titular já possui uma loja ou cadastro de vendedor.' using errcode='23514'; end if;
  if p_id is not null and novo.dono_id is distinct from antigo.dono_id and exists(select 1 from public.pagamentos where vitrine_id=p_id) then
    raise exception 'A loja tem pagamentos vinculados. A transferência de titularidade exige conciliação financeira.' using errcode='23514'; end if;
  if p_id is not null and novo.dono_id is distinct from antigo.dono_id and (
    exists(select 1 from public.anuncios where vitrine_id=p_id) or antigo.logo_url is not null
    or antigo.capa_url is not null or antigo.banner_url is not null) then
    raise exception 'A loja tem anúncios ou imagens vinculados ao titular. Transfira esses arquivos e anúncios antes de trocar a titularidade.' using errcode='23514'; end if;
  if not exists(select 1 from public.cidades where microrregiao_id=novo.microrregiao_id and nome=novo.cidade and ativa) then
    raise exception 'Escolha uma cidade ativa da região.' using errcode='23514'; end if;
  if length(coalesce(novo.bairro,''))>80 then raise exception 'Bairro: use até 80 caracteres.' using errcode='23514'; end if;
  if exists(select 1 from unnest(array[novo.logo_url,novo.capa_url,novo.banner_url]) u
    where u is not null and (length(u)>500 or u !~ '^https://[^[:space:]]+$')) then
    raise exception 'Use URLs HTTPS para as imagens.' using errcode='23514'; end if;
  if p_id is null then
    insert into public.vitrines_lojas(dono_id,microrregiao_id,nome,slug,cidade,tipo)
      values(novo.dono_id,novo.microrregiao_id,novo.nome,novo.slug,novo.cidade,coalesce(novo.tipo,'loja')) returning id into identificador;
  else identificador:=p_id; end if;
  update public.vitrines_lojas set dono_id=novo.dono_id,tipo=coalesce(novo.tipo,'loja'),nome=btrim(novo.nome),slug=novo.slug,
    microrregiao_id=novo.microrregiao_id,cidade=novo.cidade,bairro=novo.bairro,cnpj=novo.cnpj,whatsapp=novo.whatsapp,
    telefone_publico=novo.telefone_publico,site_url=novo.site_url,instagram=novo.instagram,descricao=novo.descricao,
    sobre=novo.sobre,endereco=novo.endereco,lat=novo.lat,lng=novo.lng,horarios=novo.horarios,
    formas_pagamento=coalesce(novo.formas_pagamento,'{}'),faz_entrega=novo.faz_entrega,entrega_obs=novo.entrega_obs,
    logo_url=novo.logo_url,capa_url=novo.capa_url,banner_tipo=coalesce(novo.banner_tipo,'modelo'),banner_url=novo.banner_url,
    banner_modelo=coalesce(novo.banner_modelo,'liso'),banner_cor=coalesce(novo.banner_cor,'#4B1248'),
    categoria_loja=novo.categoria_loja,banner_aki_posicao=novo.banner_aki_posicao where id=identificador;
  if p_id is not null and novo.microrregiao_id is distinct from antigo.microrregiao_id then
    if exists(select 1 from public.anuncios where vitrine_id=p_id and
      (status='congelado' or status_antes_exclusao='congelado' or congelado_motivo is not null)) then
      raise exception 'Resolva a retenção dos anúncios antes de mudar a região.' using errcode='23514'; end if;
    update public.anuncios set microrregiao_id=novo.microrregiao_id,cidade=novo.cidade where vitrine_id=p_id;
  end if;
  insert into public.admin_gestao_eventos(tipo,alvo,autor,acao,motivo,detalhes)
    values('loja',identificador::text,public.usuario_id(),case when p_id is null then 'criar' else 'editar' end,p_motivo,
      jsonb_build_object('campos',p_dados));
  return identificador;
end $$;

create function public.admin_excluir_loja(p_id uuid, p_versao timestamptz, p_confirmacao text, p_motivo text, p_impacto jsonb default null)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare loja public.vitrines_lojas;
begin
  if not public.e_admin() then raise exception 'Acesso restrito ao administrador.' using errcode='42501'; end if;
  select * into loja from public.vitrines_lojas where id=p_id for update;
  if not found then raise exception 'Esta loja já foi excluída ou não existe.' using errcode='22023'; end if;
  if p_versao is distinct from loja.atualizado_em then raise exception 'A loja mudou. Recarregue e confira o impacto antes de excluir.' using errcode='P0001'; end if;
  if p_confirmacao is distinct from loja.slug then raise exception 'Digite o endereço da loja para confirmar a exclusão.' using errcode='23514'; end if;
  if p_impacto is not null and p_impacto is distinct from jsonb_build_object(
    'anuncios',(select count(*) from public.anuncios where vitrine_id=p_id),
    'propostas',(select count(*) from public.radar_propostas where vitrine_id=p_id)) then
    raise exception 'Os anúncios ou propostas da loja mudaram. Recarregue e confira o impacto antes de excluir.' using errcode='P0001'; end if;
  if exists(select 1 from public.pagamentos where vitrine_id=p_id) or loja.gateway_assinatura_id is not null then
    raise exception 'Esta loja tem pagamentos ou assinatura vinculados. Suspenda a loja e resolva os vínculos financeiros antes da exclusão.' using errcode='23514'; end if;
  -- O lock da loja bloqueia novos filhos por FK. Os gatilhos existentes conferem retenções
  -- e serializam a exclusão dos anúncios/propostas com congelamentos concorrentes.
  insert into public.admin_gestao_eventos(tipo,alvo,autor,acao,motivo,detalhes)
    values('loja',p_id::text,public.usuario_id(),'excluir',p_motivo,
      jsonb_build_object('nome',loja.nome,'slug',loja.slug,'dono_id',loja.dono_id,
        'anuncios',(select count(*) from public.anuncios where vitrine_id=p_id)));
  delete from public.vitrines_lojas where id=p_id;
end $$;

revoke all on function public.admin_usuarios(text,integer,text[]),public.admin_usuario(text),
  public.admin_salvar_usuario(text,timestamptz,jsonb,text),public.admin_bloquear_usuario(text,boolean,text),
  public.admin_registrar_acesso(text,text,text),public.admin_loja_detalhe(uuid),
  public.admin_salvar_loja(uuid,timestamptz,jsonb,text),public.admin_excluir_loja(uuid,timestamptz,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.admin_usuarios(text,integer,text[]),public.admin_usuario(text),
  public.admin_salvar_usuario(text,timestamptz,jsonb,text),public.admin_bloquear_usuario(text,boolean,text),
  public.admin_registrar_acesso(text,text,text),public.admin_loja_detalhe(uuid),
  public.admin_salvar_loja(uuid,timestamptz,jsonb,text),public.admin_excluir_loja(uuid,timestamptz,text,text,jsonb) to authenticated;

-- A ficha da loja e o filtro da lista aceitam o identificador exato.
do $$
declare definicao text;
begin
  select pg_get_functiondef('public.admin_lojas(text,text,uuid,text,integer,integer)'::regprocedure) into definicao;
  definicao := replace(definicao, 'and (termo is null', 'and (termo is null or v.id::text = termo');
  execute definicao;
end $$;
