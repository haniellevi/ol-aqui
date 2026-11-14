-- Modelo local determinístico, sem fornecedor externo e sem cobrança de IA.
create function public.loja_ia_reservar_modelo_capa(p_rascunho uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare uid text := public.loja_ia_exigir_elegibilidade(); r public.loja_ia_rascunhos; i public.loja_ia_imagens; novo uuid := gen_random_uuid(); caminho text;
begin
  select * into r from public.loja_ia_rascunhos where id=p_rascunho and dono_id=uid for update;
  if not found or r.estado <> 'pronto' then raise exception 'Rascunho não disponível para revisão.' using errcode='42501'; end if;
  select * into i from public.loja_ia_imagens where rascunho_id=r.id and origem='merc' and tipo='capa' and sha256 is not null order by criado_em limit 1;
  if found then
    if i.estado='pronta' then return jsonb_build_object('estado','pronta','id',i.id); end if;
    return jsonb_build_object('estado','esgotada');
  end if;
  select * into i from public.loja_ia_imagens where rascunho_id=r.id and origem='merc' and tipo='capa' and estado='preparando' order by criado_em desc limit 1 for update;
  if found and i.criado_em > now() - interval '5 minutes' then return jsonb_build_object('estado','preparando'); end if;
  if found then update public.loja_ia_imagens set estado='descarte' where id=i.id; end if;
  caminho := r.id::text || '/pronta/' || novo::text || '.webp';
  insert into public.loja_ia_imagens(id,rascunho_id,caminho,tipo,origem,estado,mime,tamanho)
  values(novo,r.id,caminho,'capa','merc','preparando','image/webp',1);
  return jsonb_build_object('estado','nova','id',novo,'caminho',caminho);
end $$;

create function public.loja_ia_concluir_modelo_capa(p_imagem uuid, p_sha256 text, p_tamanho bigint) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare i public.loja_ia_imagens; r public.loja_ia_rascunhos;
begin
  select * into r from public.loja_ia_rascunhos where id=(select rascunho_id from public.loja_ia_imagens where id=p_imagem) for update;
  select * into i from public.loja_ia_imagens where id=p_imagem and rascunho_id=r.id for update;
  if i.estado is distinct from 'preparando' or i.origem is distinct from 'merc' or i.tipo is distinct from 'capa' or i.criado_em <= now()-interval '5 minutes'
    or r.estado is distinct from 'pronto' or not exists(select 1 from public.loja_ia_convites where usuario_id=r.dono_id)
    or p_sha256 !~ '^[0-9a-f]{64}$' or p_tamanho < 1 or p_tamanho > 20971520 then
    raise exception 'Reserva de capa indisponível.' using errcode='42501';
  end if;
  update public.loja_ia_imagens set estado='pronta', sha256=p_sha256, tamanho=p_tamanho where id=i.id;
  return i.id;
end $$;
revoke all on function public.loja_ia_reservar_modelo_capa(uuid), public.loja_ia_concluir_modelo_capa(uuid,text,bigint) from public,anon,authenticated;
grant execute on function public.loja_ia_reservar_modelo_capa(uuid) to authenticated;
grant execute on function public.loja_ia_concluir_modelo_capa(uuid,text,bigint) to service_role;
