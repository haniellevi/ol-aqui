#!/usr/bin/env python3
"""Regressão dos crons: PostgreSQL real, sem rede e sem consumidor HTTP real."""
from pathlib import Path
import subprocess
import time
import uuid

ROOT = Path(__file__).resolve().parents[2]
MIGRATION = '20261203032000_cron_origem_configuravel.sql'
container = 'mr-cron-' + uuid.uuid4().hex[:10]


def run(*args, **kwargs):
    return subprocess.run(args, text=True, capture_output=True, **kwargs)


def checked(result):
    if result.returncode:
        raise RuntimeError(result.stderr + result.stdout)
    return result.stdout


def sql(body, database='olaki'):
    return run('docker', 'exec', '-i', container, 'psql', '-h', '/tmp', '-X', '-q',
               '-U', 'postgres', '-d', database, '-v', 'ON_ERROR_STOP=1', input=body)


try:
    checked(run('docker', 'run', '-d', '--rm', '--name', container, '--network', 'none',
                '--tmpfs', '/tmp:rw,mode=1777', '--user', 'postgres', '--entrypoint', 'bash',
                'public.ecr.aws/supabase/postgres:17.11.0.018', '-c',
                'initdb -D /tmp/cron-pg -A trust >/tmp/init.log && exec postgres -D /tmp/cron-pg '
                '-c unix_socket_directories=/tmp -c shared_preload_libraries=pg_cron,pg_net '
                '-c cron.database_name=olaki -c cron.launch_active_jobs=off'))
    for _ in range(80):
        if run('docker', 'exec', container, 'pg_isready', '-h', '/tmp', '-U', 'postgres').returncode == 0:
            break
        time.sleep(.25)
    else:
        raise RuntimeError('Banco isolado indisponível')
    checked(sql((ROOT / 'supabase/testes/00_simula_supabase.sql').read_text(), 'postgres'))
    for path in sorted((ROOT / 'supabase/migrations').glob('*.sql')):
        if path.name < MIGRATION:
            checked(sql('begin;\n' + path.read_text() + '\ncommit;'))
    checked(sql((ROOT / 'supabase/testes/cron_origem_fixture.sql').read_text()))
    regression = (ROOT / 'supabase/testes/cron_origem.sql').read_text()
    before = sql(regression)
    if before.returncode == 0 or 'Origem configurada ignorada' not in before.stderr:
        raise RuntimeError('RED não reproduziu o defeito esperado: ' + before.stderr)
    print('RED: sete definições legadas; regressão detectou origem configurada ignorada', flush=True)
    migration = ROOT / 'supabase/migrations' / MIGRATION
    if not migration.exists():
        raise RuntimeError('Regressão confirmada; migração ainda ausente (RED)')
    for attempt in range(2):
        if attempt == 1:
            # Uma agenda desativada/personalizada pelo operador também deve sobreviver.
            checked(sql("update cron.job set active=false,schedule='1 4 * * *' where jobname='olaki-limpeza-lixeira'; "
                        "truncate cron_agenda_antes; insert into cron_agenda_antes select * from cron.job;"))
        checked(sql('begin;\n' + migration.read_text() + '\ncommit;'))
        checked(sql(regression))
        print(f'PASS: origem, falhas, credenciais, ACL e agenda; aplicação {attempt + 1}', flush=True)
    # Ausência inesperada não pode criar função com grants padrão.
    absent = sql('begin; drop function public.limpeza_disparar();\n' + migration.read_text() + '\nrollback;')
    if absent.returncode == 0 or 'Preflight necessário' not in absent.stderr:
        raise RuntimeError('Migração precisa recusar catálogo incompleto')
    # Reversão usa as definições capturadas antes, nunca tokens ou aliases recriados.
    checked(sql("do $$ declare f record; begin for f in select definicao from cron_funcoes_antes loop "
                "execute f.definicao; end loop; end $$;"))
    rollback = sql(regression)
    if rollback.returncode == 0 or 'Origem configurada ignorada' not in rollback.stderr:
        raise RuntimeError('Reversão não restaurou o comportamento anterior')
    print('PASS: catálogo incompleto recusado e reversão das sete definições verificada', flush=True)
finally:
    run('docker', 'stop', container)
