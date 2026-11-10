-- Reenvio com intervalo de um minuto por conta e por destinatário.
create or replace function public.reservar_codigo_whatsapp(p_usuario text, p_id uuid, p_numero text, p_resumo text)
returns text language plpgsql security definer set search_path = public as $$
begin
  -- Serializa a reserva, inclusive quando contas diferentes usam o mesmo número.
  perform pg_advisory_xact_lock(771192004);
  if p_numero !~ '^55[1-9][0-9]9[0-9]{8}$' or p_resumo !~ '^[a-f0-9]{64}$' or p_id is null then return 'invalido'; end if;
  perform 1 from perfis where id = p_usuario for update;
  if not found then return 'conta'; end if;
  -- Retenção máxima operacional: a limpeza ocorre no próximo envio solicitado.
  delete from whatsapp_desafios where criado_em < clock_timestamp() - interval '2 days';
  if exists(select 1 from whatsapp_desafios where (usuario_id = p_usuario or numero = p_numero)
    and criado_em > clock_timestamp() - interval '60 seconds') then return 'aguarde'; end if;
  update whatsapp_desafios set cancelado = true where usuario_id = p_usuario and consumido_em is null and not cancelado;
  insert into whatsapp_desafios(id,usuario_id,numero,resumo) values(p_id,p_usuario,p_numero,p_resumo);
  return 'reservado';
end $$;

revoke all on function public.reservar_codigo_whatsapp(text,uuid,text,text) from public, anon, authenticated;
grant execute on function public.reservar_codigo_whatsapp(text,uuid,text,text) to service_role;
