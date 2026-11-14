-- O cadastro grava capa_url sem banner_url. Ao trocar o banner, aposenta essa capa.
create function public.loja_ia_limpar_capa_substituida() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.capa_url like '/api/loja/imagem/%' and new.capa_url is not distinct from old.capa_url
     and (new.banner_url is distinct from old.banner_url or new.banner_tipo is distinct from old.banner_tipo) then
    new.capa_url := null;
  end if;
  return new;
end $$;
revoke all on function public.loja_ia_limpar_capa_substituida() from public, anon, authenticated, service_role;
create trigger vitrines_2_limpar_capa_substituida before update of banner_url, banner_tipo on public.vitrines_lojas
for each row execute function public.loja_ia_limpar_capa_substituida();

-- A autorização de publicação da capa também termina quando ela é substituída ou removida.
create function public.loja_ia_revogar_capa_substituida() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.loja_ia_imagens_vinculos v
  where v.vitrine_id=old.id and v.uso='capa' and '/api/loja/imagem/' || v.imagem_id::text=old.capa_url
    and old.capa_url is distinct from new.banner_url;
  return null;
end $$;
revoke all on function public.loja_ia_revogar_capa_substituida() from public, anon, authenticated, service_role;
create trigger vitrines_revogar_capa_substituida after update on public.vitrines_lojas
for each row when (old.capa_url like '/api/loja/imagem/%' and new.capa_url is distinct from old.capa_url)
execute function public.loja_ia_revogar_capa_substituida();

-- A rota só entrega a capa exibida na vitrine, com os mesmos limites do plano.
create or replace function public.loja_ia_imagem_publica(p_imagem uuid) returns text
language sql stable security definer set search_path = '' as $$
  select i.caminho from public.loja_ia_imagens i
  join public.loja_ia_rascunhos r on r.id=i.rascunho_id
  join public.vitrines_lojas v on v.id=r.vitrine_id and v.dono_id=r.dono_id
  join public.loja_ia_imagens_vinculos vinculo on vinculo.imagem_id=i.id and vinculo.vitrine_id=v.id
  where i.id=p_imagem and i.estado='pronta' and r.estado='publicado' and v.tipo='loja' and v.status='ativa'
    and v.arquivada_em is null and v.excluida_em is null
    and ((vinculo.uso='logo' and v.logo_url='/api/loja/imagem/' || i.id::text) or (vinculo.uso='capa' and (
      public.loja_ia_capa_publica(v, (select foto_fachada from public.recursos_vitrine(v)))='/api/loja/imagem/' || i.id::text
      or (v.banner_url='/api/loja/imagem/' || i.id::text and v.banner_tipo='foto'
        and (v.banner_aki_posicao is not null or (select foto_fachada from public.recursos_vitrine(v))))
    )))
$$;

-- Mantém os banners convencionais na fila e inclui a capa do piloto quando está pública.
create function public.banners_para_moderacao()
returns table (id uuid, nome text, slug text, cidade text, banner_url text, atualizado_em timestamptz)
language sql stable security definer set search_path = '' as $$
  select v.id, v.nome, v.slug, v.cidade, imagem.url, v.atualizado_em
  from public.vitrines_lojas v
  cross join lateral (select case when v.banner_tipo='foto' and v.banner_url is not null then v.banner_url
    else public.loja_ia_capa_publica(v, (select foto_fachada from public.recursos_vitrine(v))) end as url) imagem
  where public.tem_papel('moderador') and imagem.url is not null
    and ((v.banner_tipo='foto' and v.banner_url is not null)
      or (v.banner_url is null and v.capa_url like '/api/loja/imagem/%'))
  order by v.atualizado_em desc
  limit 30
$$;
revoke all on function public.banners_para_moderacao() from public, anon, authenticated, service_role;
grant execute on function public.banners_para_moderacao() to authenticated;

create or replace function public.moderar_banner_vitrine(p_vitrine uuid, p_motivo text default null)
returns text language plpgsql security definer set search_path = '' as $$
declare v public.vitrines_lojas; url text;
begin
  if not public.tem_papel('moderador') then
    raise exception 'Apenas a equipe OLAKI pode moderar.' using errcode = '42501';
  end if;
  select * into v from public.vitrines_lojas where id = p_vitrine for update;
  if not found then
    raise exception 'Loja não encontrada.' using errcode = 'P0002';
  end if;
  url := coalesce(v.banner_url, public.loja_ia_capa_publica(v, (select foto_fachada from public.recursos_vitrine(v))));
  update public.vitrines_lojas
     set banner_tipo = 'modelo', banner_url = null, banner_moderado_em = now(),
         capa_url = case when v.banner_url is null and v.capa_url = url then null else v.capa_url end,
         banner_moderado_url = coalesce(url, banner_moderado_url),
         banner_moderado_motivo = left(coalesce(nullif(btrim(p_motivo), ''), 'Foto fora das regras do OLAKI'), 300)
   where id = p_vitrine;
  return url;
end $$;

-- A gestão preserva imagens privadas já aprovadas, sem aceitar novos endereços relativos.
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
  if exists (select 1 from (values
      (novo.logo_url, antigo.logo_url, 'logo'),
      (novo.capa_url, antigo.capa_url, 'capa'),
      (novo.banner_url, antigo.banner_url, 'capa')
    ) as imagem(url, anterior, uso)
    where imagem.url is not null and (length(imagem.url)>500 or imagem.url !~ '^https://[^[:space:]]+$')
      and not coalesce(imagem.url = imagem.anterior
        and public.loja_ia_imagem_aprovada(p_id, novo.dono_id, imagem.url, imagem.uso), false)) then
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
