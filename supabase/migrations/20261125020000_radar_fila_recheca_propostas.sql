-- Fila do WhatsApp: na hora de enviar, o aviso do Radar confere de novo se o pedido ainda aceita proposta.
-- Antes só conferia status e expira_em; um aviso que esperou a janela das 8h podia sair depois do prazo de
-- propostas ou com o limite cheio. Mesma assinatura: as permissões (só interno) continuam as de 20261125010000.

create or replace function public.whatsapp_fila_pegar_em(p_limite integer, p_quando timestamptz)
returns table (id uuid, numero text, texto text, link text, tentativas smallint)
language plpgsql
set search_path = public, extensions
as $$
declare
  radar_ligado boolean := public.config('radar.whatsapp_ativo', null, 'false'::jsonb) = 'true'::jsonb;
begin
  update public.whatsapp_fila f set estado = 'incerta', erro = 'travada'
   where f.estado = 'enviando' and f.enviar_apos < p_quando - interval '10 minutes';
  -- Aviso do Radar de pedido que não aceita mais proposta não sai (fechado, vencido, prazo de propostas acabou
  -- ou limite de propostas cheio): mesmas regras de radar_avisar_pedido_novo. O id do pedido está na chave.
  update public.whatsapp_fila f set estado = 'cancelada', erro = 'pedido_fechado'
   where f.estado = 'pendente' and f.chave like 'radar_pedido_novo:%'
     and not exists (
       select 1 from public.radar_pedidos rp
        where rp.id::text = substring(f.chave from '^radar_pedido_novo:([0-9a-f-]{36}):')
          and rp.status = 'aberto' and rp.expira_em > p_quando
          and rp.total_propostas < rp.max_propostas
          and (rp.modo_contato <> 'propostas_prazo' or (rp.propostas_ate is not null and rp.propostas_ate > p_quando)));
  -- Aviso do Radar de quem desligou (SAIR ou Minha conta) não sai mais
  update public.whatsapp_fila f set estado = 'cancelada', erro = 'radar_desligado'
   where f.estado = 'pendente' and f.chave like 'radar_pedido_novo:%'
     and not exists (select 1 from public.preferencias_avisos pa
                      where pa.usuario_id = f.usuario_id and pa.tipo = 'pedido_novo' and pa.canal = 'whatsapp' and pa.ligado);
  if public.proxima_janela_whatsapp(p_quando) <> p_quando then return; end if;
  return query
    update public.whatsapp_fila f set estado = 'enviando', tentativas = f.tentativas + 1, enviar_apos = p_quando
     where f.id in (
       select x.id from public.whatsapp_fila x
        where x.estado = 'pendente' and x.enviar_apos <= p_quando
          and (radar_ligado or x.chave is null or x.chave not like 'radar_pedido_novo:%')
        order by x.enviar_apos, x.criado_em
        limit greatest(least(coalesce(p_limite, 5), 5), 1)
        for update skip locked)
    returning f.id, f.numero, f.texto, f.link, f.tentativas;
end $$;
