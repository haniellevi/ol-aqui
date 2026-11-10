-- A exclusão de conta não remove conteúdo congelado pelo Compliance, nem por cascata.
-- Não há bypass para service_role: a retenção precisa ser resolvida antes da exclusão.
create function public.preservar_conteudo_congelado()
returns trigger language plpgsql security definer set search_path=public as $$
declare estado text;
begin
  if tg_table_name in ('anuncios','radar_pedidos') and old.status::text='congelado' then
    raise exception 'Conteúdo congelado exige revisão de Compliance antes da exclusão.' using errcode='55000';
  end if;
  if tg_table_name='anuncios' then
    if old.status_antes_exclusao::text='congelado' or old.congelado_motivo is not null then
      raise exception 'Anúncio sob retenção exige revisão de Compliance antes da exclusão.' using errcode='55000';
    end if;
  end if;
  if tg_table_name='radar_propostas' then
    -- Serializa a exclusão da proposta com o congelamento do pedido relacionado.
    select p.status::text into estado from public.radar_pedidos p where p.id=old.pedido_id for update;
    if estado='congelado' then
      raise exception 'Proposta de pedido congelado exige revisão de Compliance antes da exclusão.' using errcode='55000';
    end if;
  elsif tg_table_name='anuncios' then
    -- Excluir o anúncio faria ON DELETE SET NULL na oferta: também perderia sua referência.
    for estado in select p.status::text from public.radar_pedidos p
      where p.id in (select rp.pedido_id from public.radar_propostas rp where rp.anuncio_id=old.id)
      order by p.id for update
    loop
      if estado='congelado' then
        raise exception 'Anúncio ligado a pedido congelado exige revisão de Compliance antes da exclusão.' using errcode='55000';
      end if;
    end loop;
  end if;
  return old;
end $$;
revoke all on function public.preservar_conteudo_congelado() from public,anon,authenticated;
create trigger anuncios_preservar_congelado before delete on public.anuncios
  for each row execute function public.preservar_conteudo_congelado();
create trigger radar_pedidos_preservar_congelado before delete on public.radar_pedidos
  for each row execute function public.preservar_conteudo_congelado();
create trigger radar_propostas_preservar_congelado before delete on public.radar_propostas
  for each row execute function public.preservar_conteudo_congelado();
