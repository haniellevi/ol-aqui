-- As rotinas anteriores foram migradas antes de pg_cron ser habilitado.
-- Reaplicar esta migração com o mesmo usuário atualiza os jobs pelo nome,
-- sem duplicá-los e sem alterar olaki-moderacao-ia ou outros agendamentos.
-- Jobs existentes desativados permanecem desativados; uma pausa operacional
-- não é revertida por esta migração. Confirmar active = true antes do piloto.
-- As expressões usam cron.timezone, cujo padrão é GMT (UTC), não TimeZone
-- da sessão. Em UTC, 03:15 corresponde a 00:15 em America/Fortaleza.
-- Não altera o fuso global. Conferir cron.timezone e cron.job_run_details
-- no ambiente publicado antes de convidar os participantes.
-- Estas funções atualizam dados e notificações internas; não enviam WhatsApp,
-- e-mail nem criam cobranças no gateway. A rotina diária aplica vencimentos,
-- pausas de anúncios e cancelamento de registros locais pendentes antigos.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('olaki-radar-prazos', '*/10 * * * *', 'select public.radar_avisar_prazos()');
    perform cron.schedule('olaki-mensagens-planos', '20 * * * *', 'select public.mensagens_avisar_planos()');
    perform cron.schedule('olaki-expirar', '15 3 * * *', 'select public.expirar_rotina()');
  end if;
end $$;
