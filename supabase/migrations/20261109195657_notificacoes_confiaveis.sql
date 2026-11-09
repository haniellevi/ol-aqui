-- Leitura afeta somente os avisos do app e sempre fica restrita ao dono.
create or replace function public.marcar_notificacoes_lidas(p_ids uuid[] default null)
returns integer language plpgsql security definer
set search_path = public, extensions
as $$
declare uid text := public.usuario_id(); n integer;
begin
  if uid is null then raise exception 'Entre na sua conta para continuar.' using errcode='28000'; end if;
  if cardinality(p_ids) > 500 then raise exception 'Selecione até 500 avisos.' using errcode='22023'; end if;
  update public.notificacoes set lida_em=now()
   where usuario_id=uid and canal='app' and lida_em is null and (p_ids is null or id=any(p_ids));
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.marcar_notificacoes_lidas(uuid[]) from public, anon;
grant execute on function public.marcar_notificacoes_lidas(uuid[]) to authenticated;

-- Corrige somente o texto padrão, preservando personalizações da equipe.
-- O protetor congela texto_padrao; a pausa deste trigger ocorre na transação da migração.
alter table public.modelos_mensagem disable trigger modelos_mensagem_proteger;
update public.modelos_mensagem
   set texto = case when texto='O comprador de “{pedido}” escolheu a sua proposta e vai te chamar no WhatsApp.'
                    then 'O comprador de “{pedido}” escolheu sua proposta para conversar. Abra o pedido para acompanhar.' else texto end,
       texto_padrao='O comprador de “{pedido}” escolheu sua proposta para conversar. Abra o pedido para acompanhar.'
 where chave='proposta_escolhida' and canal='notificacao'
   and texto_padrao='O comprador de “{pedido}” escolheu a sua proposta e vai te chamar no WhatsApp.';
alter table public.modelos_mensagem enable trigger modelos_mensagem_proteger;
update public.configuracoes
   set valor=to_jsonb('O comprador de “{pedido}” escolheu sua proposta para conversar. Abra o pedido para acompanhar.'::text)
 where chave='radar.aviso.proposta_escolhida.texto'
   and valor=to_jsonb('O comprador de “{pedido}” escolheu a sua proposta e vai te chamar no WhatsApp.'::text);
