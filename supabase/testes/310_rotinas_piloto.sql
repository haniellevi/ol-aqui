\set ON_ERROR_STOP on
\set QUIET on
begin;
do $$
declare corretos integer;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    -- O PostgreSQL isolado não instala extensões nem cria um agendador falso.
    raise notice 'Sem pg_cron: migração aplicada sem criar agendamentos; ramo com extensão requer teste próprio.';
    return;
  end if;

  execute $consulta$
    select count(*) from cron.job j
    join (values
      ('olaki-radar-prazos', '*/10 * * * *', 'select public.radar_avisar_prazos()'),
      ('olaki-mensagens-planos', '20 * * * *', 'select public.mensagens_avisar_planos()'),
      ('olaki-expirar', '15 3 * * *', 'select public.expirar_rotina()')
    ) esperado(nome, agenda, comando)
      on j.jobname = esperado.nome and j.schedule = esperado.agenda and j.command = esperado.comando
    where j.active and j.username = current_user and j.database = current_database()
  $consulta$ into corretos;
  assert corretos = 3, 'Rotinas do piloto ausentes, desativadas ou com agenda, comando, usuário ou banco incorretos';
end $$;
rollback;
