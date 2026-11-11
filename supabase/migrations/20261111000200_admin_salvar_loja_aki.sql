-- O painel passa a salvar a categoria da loja e a posição do logo no banner feito pelo Aki.
-- Mesma função da 20261110234135, com os dois campos a mais.
create or replace function public.admin_salvar_loja(p_id uuid, p_versao timestamptz, p_dados jsonb, p_motivo text)
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
    if antigo.arquivada_em is not null then raise exception 'Restaure a loja antes de editar.' using errcode='23514'; end if;
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


