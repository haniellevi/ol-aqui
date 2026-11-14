-- SAIR à prova de falha (25/11/2026):
-- 1. Na hora de enviar, cada aviso do Radar confere de novo se ainda pode sair (chave geral, preferência de quem
--    ligou, pedido aberto e dentro do prazo/limite). Se não pode, vira "cancelada" com o motivo e não é enviado.
-- 2. Resposta à saída: depois de registrar o SAIR (ou PARAR, STOP, CANCELAR) de quem tem conta, entra UMA mensagem
--    de confirmação na fila (uma por número e dia). Ela sai fora da janela de 8h às 20h e o Radar não a cancela.
--    Sem conta, nada é registrado e nada é respondido.
-- Só mexe em funções. Não altera tabelas nem dados. Não manda mensagem nenhuma por si só.

-- ---------------------------------------------------------------------
-- 1. Fila: fora da janela de 8h às 20h só sai a resposta de saída (chave whatsapp_saida:)
-- ---------------------------------------------------------------------
create or replace function public.whatsapp_fila_pegar_em(p_limite integer, p_quando timestamptz)
returns table (id uuid, numero text, texto text, link text, tentativas smallint)
language plpgsql
set search_path = public, extensions
as $$
declare
  radar_ligado boolean := public.config('radar.whatsapp_ativo', null, 'false'::jsonb) = 'true'::jsonb;
  dentro_janela boolean := public.proxima_janela_whatsapp(p_quando) = p_quando;
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
  return query
    update public.whatsapp_fila f set estado = 'enviando', tentativas = f.tentativas + 1, enviar_apos = p_quando
     where f.id in (
       select x.id from public.whatsapp_fila x
        where x.estado = 'pendente' and x.enviar_apos <= p_quando
          and (dentro_janela or x.chave like 'whatsapp_saida:%')
          and (radar_ligado or x.chave is null or x.chave not like 'radar_pedido_novo:%')
        order by x.enviar_apos, x.criado_em
        limit greatest(least(coalesce(p_limite, 5), 5), 1)
        for update skip locked)
    returning f.id, f.numero, f.texto, f.link, f.tentativas;
end $$;

-- ---------------------------------------------------------------------
-- 2. Conferência logo antes de enviar cada mensagem (só o servidor)
-- ---------------------------------------------------------------------
-- Devolve 'pode' (envia), 'cancelada' (não envia; o motivo fica em erro), ou 'ignorada' (a linha já não está
-- "enviando"). Aviso do Radar confere de novo: chave geral, preferência de quem recebe e pedido ainda aberto,
-- dentro do prazo e com vaga. Outras mensagens (verificação da loja, resposta de saída) passam direto.
create function public.whatsapp_fila_confirmar_envio(p_id uuid)
returns text
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  f public.whatsapp_fila;
  motivo text;
begin
  if coalesce(auth.role(), '') <> 'service_role' and session_user not in ('postgres', 'supabase_admin') then
    raise exception 'Acesso restrito.' using errcode = '42501';
  end if;
  select * into f from public.whatsapp_fila x where x.id = p_id and x.estado = 'enviando' for update;
  if f.id is null then return 'ignorada'; end if;
  if f.chave is null or f.chave not like 'radar_pedido_novo:%' then return 'pode'; end if;

  if public.config('radar.whatsapp_ativo', null, 'false'::jsonb) is distinct from 'true'::jsonb then
    motivo := 'radar_desligado';
  elsif not exists (select 1 from public.preferencias_avisos pa
                     where pa.usuario_id = f.usuario_id and pa.tipo = 'pedido_novo' and pa.canal = 'whatsapp' and pa.ligado) then
    motivo := 'radar_desligado';
  elsif not exists (
    select 1 from public.radar_pedidos rp
     where rp.id::text = substring(f.chave from '^radar_pedido_novo:([0-9a-f-]{36}):')
       and rp.status = 'aberto' and rp.expira_em > now()
       and rp.total_propostas < rp.max_propostas
       and (rp.modo_contato <> 'propostas_prazo' or (rp.propostas_ate is not null and rp.propostas_ate > now()))) then
    motivo := 'pedido_fechado';
  end if;

  if motivo is null then return 'pode'; end if;
  update public.whatsapp_fila set estado = 'cancelada', erro = motivo where id = f.id;
  return 'cancelada';
end $$;

-- ---------------------------------------------------------------------
-- 3. SAIR / PARAR / STOP / CANCELAR: desliga, cancela, registra e confirma com UMA resposta
-- ---------------------------------------------------------------------
-- Igual à 20261125010000, mais: se achou conta, põe na fila uma resposta para o número que mandou a mensagem.
-- Chave whatsapp_saida:<número com 9>:<dia em Fortaleza>, então é uma por número e por dia. Sem conta: nada.
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
            'Pronto. Você não vai mais receber pedidos do Radar pelo WhatsApp. Para voltar, ligue o aviso em Minha conta > Avisos no Mercado da Região.',
            null,
            'whatsapp_saida:' || numero13 || ':' || to_char(now() at time zone 'America/Fortaleza', 'YYYY-MM-DD'),
            now())
    on conflict (chave) where chave is not null do nothing;
  end if;
  return achou;
end $$;

-- ---------------------------------------------------------------------
-- 4. Permissões
-- ---------------------------------------------------------------------
revoke all on function public.whatsapp_fila_confirmar_envio(uuid) from public, anon, authenticated;
grant execute on function public.whatsapp_fila_confirmar_envio(uuid) to service_role;
revoke all on function public.whatsapp_sair(text, text) from public, anon, authenticated;
grant execute on function public.whatsapp_sair(text, text) to service_role;
revoke all on function public.whatsapp_fila_pegar_em(integer, timestamptz) from public, anon, authenticated, service_role;
