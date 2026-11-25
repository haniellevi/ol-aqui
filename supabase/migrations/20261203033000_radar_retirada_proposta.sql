-- Retirada lógica: preserva evidência, consumo de cota e gatilhos de cancelamento da fila.
alter table public.radar_propostas drop constraint radar_propostas_status_check;
alter table public.radar_propostas add constraint radar_propostas_status_check
  check (status in ('ativa', 'oculta', 'retirada'));

create function public.retirar_proposta_radar(p_proposta uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  uid text := public.usuario_id();
  rp public.radar_propostas;
  pedido public.radar_pedidos;
  loja public.vitrines_lojas;
  era_dono boolean;
begin
  if uid is null then raise exception 'Entre na sua conta para continuar.' using errcode='28000'; end if;
  select * into rp from public.radar_propostas where id=p_proposta;
  if rp.id is null then raise exception 'Proposta não encontrada.' using errcode='42501'; end if;
  -- A revogação do gerente disputa o mesmo bloqueio; segue o contrato de edição gerenciada.
  select * into loja from public.vitrines_lojas where id=rp.vitrine_id;
  era_dono := loja.dono_id=uid;
  if not coalesce(era_dono,false) then
    perform 1 from public.convites_gerente_loja c join public.perfis pf on pf.id=c.aceito_por
      where c.vitrine_id=loja.id and c.aceito_por=uid and c.revogado_em is null
        and c.aceito_em is not null and pf.whatsapp is not null and pf.whatsapp_verificado_em is not null
      for update of c;
    if not found then raise exception 'Proposta não encontrada.' using errcode='42501'; end if;
  end if;
  if exists(select 1 from public.termos_pendentes()) then
    raise exception 'Aceite os termos atualizados para continuar.' using errcode='42501';
  end if;
  -- Propor trava loja/pedido; escolher trava pedido/proposta. Nunca inverte essas ordens.
  select * into loja from public.vitrines_lojas where id=rp.vitrine_id for update;
  select * into pedido from public.radar_pedidos where id=rp.pedido_id for update;
  select * into rp from public.radar_propostas where id=p_proposta for update;
  if loja.id is null or pedido.id is null or rp.id is null
    or loja.status <> 'ativa' or loja.tipo <> 'loja'
    or (era_dono and loja.dono_id is distinct from uid) then
    raise exception 'Esta loja não está disponível.' using errcode='42501';
  end if;
  if pedido.status <> 'aberto' or pedido.expira_em <= now() or rp.escolhida then
    raise exception 'Só é possível retirar uma proposta não escolhida de pedido aberto.' using errcode='P0002';
  end if;
  if rp.status='retirada' then return pedido.id; end if;
  if rp.status <> 'ativa' then raise exception 'Esta proposta não está disponível.' using errcode='P0002'; end if;
  update public.radar_propostas set status='retirada', atualizado_em=now() where id=rp.id;
  return pedido.id;
end $$;
revoke all on function public.retirar_proposta_radar(uuid) from public, anon;
grant execute on function public.retirar_proposta_radar(uuid) to authenticated;

-- Não permite que a moderação devolva uma oferta retirada pelo autor.
-- Mídia antiga só entra na fila de limpeza já existente quando nenhuma referência a usa.
create function public.radar_proposta_preservar_retirada()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.status='retirada' and new.status <> old.status then
    raise exception 'Uma proposta retirada não pode voltar ao ar.' using errcode='P0002';
  end if;
  if old.foto_url is distinct from new.foto_url or old.anuncio_id is distinct from new.anuncio_id then
    perform 1 from public.radar_pedidos where id=old.pedido_id for update;
    if exists(select 1 from public.radar_pedidos where id=old.pedido_id and status='congelado')
      or exists(select 1 from public.denuncias where alvo_id in (old.id,old.pedido_id) and status in ('aberta','procedente')) then
      raise exception 'A mídia desta proposta precisa ser preservada para revisão.' using errcode='55000';
    end if;
  end if;
  return new;
end $$;
revoke all on function public.radar_proposta_preservar_retirada() from public, anon, authenticated;
create trigger radar_proposta_preservar_retirada before update on public.radar_propostas
  for each row execute function public.radar_proposta_preservar_retirada();

create function public.radar_proposta_limpar_midia_substituida()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.foto_url is not null and old.foto_url is distinct from new.foto_url then
    perform public.limpeza_enfileirar(array[old.foto_url]);
  end if;
  return null;
end $$;
revoke all on function public.radar_proposta_limpar_midia_substituida() from public, anon, authenticated;
create trigger z_radar_proposta_limpar_midia_substituida after update on public.radar_propostas
  for each row execute function public.radar_proposta_limpar_midia_substituida();

-- Leitura mínima para a ação gerenciada; não expõe contatos, IP, preço ou mensagens.
create function public.propostas_retiraveis_loja(p_loja uuid)
returns table(id uuid, titulo text) language sql stable security definer set search_path = '' as $$
  select rp.id, p.titulo from public.radar_propostas rp
    join public.radar_pedidos p on p.id=rp.pedido_id
    join public.vitrines_lojas v on v.id=rp.vitrine_id
   where v.id=p_loja and v.tipo='loja' and v.status='ativa'
     and (v.dono_id=public.usuario_id() or exists(
       select 1 from public.convites_gerente_loja c join public.perfis pf on pf.id=c.aceito_por
        where c.vitrine_id=v.id and c.aceito_por=public.usuario_id() and c.revogado_em is null
          and c.aceito_em is not null and pf.whatsapp is not null and pf.whatsapp_verificado_em is not null))
     and p.status='aberto' and p.expira_em>now() and rp.status='ativa' and not rp.escolhida
   order by rp.criado_em desc
$$;
revoke all on function public.propostas_retiraveis_loja(uuid) from public, anon;
grant execute on function public.propostas_retiraveis_loja(uuid) to authenticated;
