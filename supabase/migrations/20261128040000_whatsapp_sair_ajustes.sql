-- SAIR: ajustes depois da revisão (25/11/2026). Substitui duas funções da 20261128010000 (create or replace):
-- 1. whatsapp_fila_confirmar_envio: a conferência antes do envio passa a usar as mesmas regras de quem recebe
--    o aviso do Radar que radar_avisar_pedido_novo usa ao enfileirar (loja ativa na região, WhatsApp verificado e igual
--    ao da fila, conta não revogada, plano que avisa na hora, área e nicho do pedido). Motivo novo: sem_direito_aviso.
-- 2. whatsapp_sair: a resposta de confirmação aponta para "Minha conta > Notificações" (nome real da tela; antes
--    dizia "Avisos", que não existe).
-- Só mexe em funções. Não altera tabelas nem dados. Não manda mensagem por si só.

-- ---------------------------------------------------------------------
-- 1. Conferência logo antes de enviar (só o servidor)
-- ---------------------------------------------------------------------
create or replace function public.whatsapp_fila_confirmar_envio(p_id uuid)
returns text
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  f public.whatsapp_fila;
  pedido public.radar_pedidos;
  motivo text;
begin
  if coalesce(auth.role(), '') <> 'service_role' and session_user not in ('postgres', 'supabase_admin') then
    raise exception 'Acesso restrito.' using errcode = '42501';
  end if;
  select * into f from public.whatsapp_fila x where x.id = p_id and x.estado = 'enviando' for update;
  if f.id is null then return 'ignorada'; end if;
  if f.chave is null or f.chave not like 'radar_pedido_novo:%' then return 'pode'; end if;

  select * into pedido from public.radar_pedidos rp
   where rp.id::text = substring(f.chave from '^radar_pedido_novo:([0-9a-f-]{36}):');

  if public.config('radar.whatsapp_ativo', null, 'false'::jsonb) is distinct from 'true'::jsonb then
    motivo := 'radar_desligado';
  elsif not exists (select 1 from public.preferencias_avisos pa
                     where pa.usuario_id = f.usuario_id and pa.tipo = 'pedido_novo' and pa.canal = 'whatsapp' and pa.ligado) then
    motivo := 'radar_desligado';
  elsif pedido.id is null or not (
          pedido.status = 'aberto' and pedido.expira_em > now()
          and pedido.total_propostas < pedido.max_propostas
          and (pedido.modo_contato <> 'propostas_prazo' or (pedido.propostas_ate is not null and pedido.propostas_ate > now()))) then
    motivo := 'pedido_fechado';
  elsif public.radar_categoria_pedido(pedido.categoria_id, pedido.categoria) is null
     or not exists (
       select 1 from public.vitrines_lojas v
         join public.perfis pf on pf.id = v.dono_id and pf.microrregiao_id = v.microrregiao_id
        where v.id::text = substring(f.chave from '([^:]+)$')
          and v.dono_id = f.usuario_id and v.dono_id <> pedido.comprador_id
          and v.status = 'ativa' and v.microrregiao_id = pedido.microrregiao_id
          and pf.whatsapp is not null and pf.whatsapp = f.numero and pf.whatsapp_verificado_em is not null
          and not exists (select 1 from public.contas_revogadas r where r.usuario_id = v.dono_id)
          and public.recebe_aviso_radar_na_hora(v.dono_id)
          and public.radar_pedido_na_area(pedido, v)
          and exists (select 1 from public.anuncios a
                       where a.vitrine_id = v.id and a.microrregiao_id = v.microrregiao_id and a.status = 'ativo'
                         and public.radar_nicho_corresponde(public.radar_categoria_pedido(pedido.categoria_id, pedido.categoria), a.categoria_id))) then
    motivo := 'sem_direito_aviso';
  end if;

  if motivo is null then return 'pode'; end if;
  update public.whatsapp_fila set estado = 'cancelada', erro = motivo where id = f.id;
  return 'cancelada';
end $$;

-- ---------------------------------------------------------------------
-- 2. SAIR / PARAR / STOP / CANCELAR: igual à 20261128010000, com o nome certo da tela na resposta
-- ---------------------------------------------------------------------
create or replace function public.whatsapp_sair(p_numero text, p_comando text)
returns boolean language plpgsql security definer
set search_path = public, extensions
as $$
declare
  alvo record;
  achou boolean := false;
  primeiro text;
  variantes text[];
  numero13 text;
begin
  if coalesce(auth.role(), '') <> 'service_role' and session_user not in ('postgres', 'supabase_admin') then
    raise exception 'Acesso restrito.' using errcode = '42501';
  end if;
  if p_numero is null or p_numero !~ '^55[1-9][0-9]9?[0-9]{8}$' or p_comando not in ('SAIR', 'PARAR', 'STOP', 'CANCELAR') then
    raise exception 'Pedido de saída inválido.' using errcode = '22023';
  end if;
  -- 13 dígitos (com o 9): a outra forma tira o 9 da 5ª posição; 12 dígitos (sem o 9): a outra põe
  variantes := case when length(p_numero) = 13
                    then array[p_numero, substr(p_numero, 1, 4) || substr(p_numero, 6)]
                    else array[p_numero, substr(p_numero, 1, 4) || '9' || substr(p_numero, 5)] end;
  numero13 := case when length(p_numero) = 13 then p_numero else substr(p_numero, 1, 4) || '9' || substr(p_numero, 5) end;
  for alvo in select distinct pf.id from public.perfis pf where pf.whatsapp = any(variantes) order by pf.id loop
    achou := true;
    primeiro := coalesce(primeiro, alvo.id);
    insert into public.preferencias_avisos (usuario_id, tipo, canal, ligado, atualizado_em)
    values (alvo.id, 'pedido_novo', 'whatsapp', false, now())
    on conflict (usuario_id, tipo, canal) do update set ligado = false, atualizado_em = now();
    update public.whatsapp_fila f set estado = 'cancelada', erro = 'saiu'
     where f.usuario_id = alvo.id and f.estado = 'pendente' and f.chave like 'radar_pedido_novo:%';
    insert into public.whatsapp_respostas (usuario_id, comando) values (alvo.id, p_comando);
  end loop;
  -- Resposta de confirmação: sai na hora (fora da janela também), uma por número e dia, e o Radar não a cancela.
  if achou then
    insert into public.whatsapp_fila (usuario_id, numero, texto, link, chave, enviar_apos)
    values (primeiro, p_numero,
            'Pronto. Você não vai mais receber pedidos do Radar pelo WhatsApp. Para voltar, ligue o aviso em Minha conta > Notificações no Mercado da Região.',
            null,
            'whatsapp_saida:' || numero13 || ':' || to_char(now() at time zone 'America/Fortaleza', 'YYYY-MM-DD'),
            now())
    on conflict (chave) where chave is not null do nothing;
  end if;
  return achou;
end $$;
