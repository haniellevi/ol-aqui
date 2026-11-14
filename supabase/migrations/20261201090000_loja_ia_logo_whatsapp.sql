-- Imagens importadas usam o mesmo armazenamento privado e a mesma publicação.
alter table public.loja_ia_imagens drop constraint loja_ia_imagens_origem_check;
alter table public.loja_ia_imagens add constraint loja_ia_imagens_origem_check check (origem in ('enviada','merc','whatsapp'));

-- A mesma ordem de travas da conclusão das fontes impede publicação concorrente.
create function public.loja_ia_whatsapp_trabalho_ativo(p_trabalho uuid, p_tentativa uuid) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.loja_ia_rascunhos; t public.loja_ia_trabalhos;
begin
  select * into r from public.loja_ia_rascunhos where id=(select rascunho_id from public.loja_ia_trabalhos where id=p_trabalho) for update;
  if not found or r.estado not in ('processando','pronto') or not public.loja_ia_worker_autorizado(r.dono_id)
    or not public.loja_ia_whatsapp_consulta_atual(r.id) then return null; end if;
  select * into t from public.loja_ia_trabalhos where id=p_trabalho for update;
  if t.fonte <> 'whatsapp' or t.estado <> 'reservado' or t.tentativa is distinct from p_tentativa or t.reserva_ate is null or t.reserva_ate <= now() then return null; end if;
  return r.id;
end $$;

create function public.loja_ia_reservar_logo_whatsapp(p_trabalho uuid, p_tentativa uuid, p_sha256 text, p_tamanho bigint) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare r uuid; i public.loja_ia_imagens; novo uuid := gen_random_uuid();
begin
  r := public.loja_ia_whatsapp_trabalho_ativo(p_trabalho,p_tentativa);
  if r is null then raise exception 'Consulta não autorizada.' using errcode='42501'; end if;
  if p_sha256 is null or p_sha256 !~ '^[0-9a-f]{64}$' or p_tamanho is null or p_tamanho < 1 or p_tamanho > 20971520 then
    raise exception 'Imagem inválida.' using errcode='22023'; end if;
  select * into i from public.loja_ia_imagens where rascunho_id=r and origem='whatsapp' and tipo='logo'
    and sha256=p_sha256 and tamanho=p_tamanho and estado in ('preparando','pronta') order by criado_em limit 1;
  if not found then
    if (select count(*) from public.loja_ia_imagens where rascunho_id=r and estado in ('upload','preparando','pronta')) >= 24 then
      raise exception 'Limite de imagens atingido.' using errcode='22023'; end if;
    insert into public.loja_ia_imagens(id,rascunho_id,caminho,tipo,origem,estado,mime,tamanho,sha256)
    values(novo,r,r::text||'/pronta/'||novo::text||'.webp','logo','whatsapp','preparando','image/webp',p_tamanho,p_sha256) returning * into i;
  end if;
  return jsonb_build_object('id',i.id,'caminho',i.caminho,'estado',i.estado);
end $$;

create function public.loja_ia_concluir_logo_whatsapp(p_trabalho uuid, p_tentativa uuid, p_imagem uuid) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare r uuid; i uuid;
begin
  r := public.loja_ia_whatsapp_trabalho_ativo(p_trabalho,p_tentativa);
  if r is null then raise exception 'Consulta não autorizada.' using errcode='42501'; end if;
  update public.loja_ia_imagens set estado='pronta' where id=p_imagem and rascunho_id=r and origem='whatsapp' and tipo='logo'
    and estado in ('preparando','pronta') returning id into i;
  if i is null then raise exception 'Imagem indisponível.' using errcode='42501'; end if;
  return i;
end $$;

revoke all on function public.loja_ia_whatsapp_trabalho_ativo(uuid,uuid), public.loja_ia_reservar_logo_whatsapp(uuid,uuid,text,bigint),
  public.loja_ia_concluir_logo_whatsapp(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.loja_ia_reservar_logo_whatsapp(uuid,uuid,text,bigint),public.loja_ia_concluir_logo_whatsapp(uuid,uuid,uuid) to service_role;
