#!/usr/bin/env python3
"""Banco sem portas, volume persistente ou acesso à rede. Nunca usa credenciais externas."""
from pathlib import Path
import subprocess, time, uuid
from concurrent.futures import ThreadPoolExecutor
root = Path(__file__).resolve().parents[2]
container = 'olaki-test-' + uuid.uuid4().hex[:10]
def run(*args, **kwargs):
    return subprocess.run(args, text=True, capture_output=True, **kwargs)
def sql(body):
    return run('docker','exec','-i',container,'psql','-X','-q','-U','postgres','-d','olaki','-v','ON_ERROR_STOP=1',input=body)
def checked(result):
    if result.returncode:
        raise RuntimeError(result.stderr + result.stdout)
try:
    checked(run('docker','run','-d','--rm','--name',container,'--network','none','--tmpfs','/var/lib/postgresql/data:rw','-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:17-alpine'))
    for _ in range(60):
        if run('docker','exec',container,'pg_isready','-U','postgres').returncode == 0: break
        time.sleep(.25)
    init = (root/'supabase/testes/00_simula_supabase.sql').read_text()
    checked(run('docker','exec','-i',container,'psql','-X','-q','-U','postgres','-v','ON_ERROR_STOP=1',input=init))
    for p in sorted((root/'supabase/migrations').glob('*.sql')):
        checked(sql('begin;\n'+p.read_text()+'\ncommit;'))
    migracao_home = (root/'supabase/migrations/20261109150000_texto_radar_inicio.sql').read_text()
    checked(sql("""begin;
      do $$ begin
        assert (select texto = 'Conte o que procura. As lojas podem enviar propostas, e você escolhe com quem conversar.' from home_blocos where chave = 'radar'), 'Texto padrão do Radar incorreto';
      end $$;
      update home_blocos set texto = 'Texto personalizado da equipe' where chave = 'radar';
    """ + migracao_home + migracao_home + """
      do $$ begin
        assert (select texto = 'Texto personalizado da equipe' from home_blocos where chave = 'radar'), 'Migração sobrescreveu texto personalizado';
      end $$;
      rollback;
    """))
    print('PASS: texto do Radar atualizado sem sobrescrever personalização do painel', flush=True)
    checked(sql((root/'supabase/testes/150_fluxo_seguro.sql').read_text()))
    print('PASS: criação, repetição, RLS, regiões, proposta, escolha, encerramento e contato', flush=True)
    def propose(i):
        return sql(f"begin; set role authenticated; set request.jwt.claim.role='authenticated'; set request.jwt.claim.sub='user_cota'; select * from revelar_contato_radar('20000000-0000-4000-a000-00000000000{i}',null,'Oferta concorrente',10000); select pg_sleep(0.2); commit;")
    with ThreadPoolExecutor(max_workers=4) as pool:
        results=list(pool.map(propose,range(1,5)))
    successes=sum(r.returncode==0 for r in results)
    assert successes==3, f'Cota deveria aceitar 3 propostas, aceitou {successes}: {[r.stderr for r in results]}'
    assert all(r.returncode==0 or 'todas as propostas' in r.stderr for r in results)
    print('PASS: quatro respostas simultâneas respeitam a cota de três', flush=True)
    def publish(i):
        return sql(f"begin; set role authenticated; set request.jwt.claim.role='authenticated'; set request.jwt.claim.sub='user_cota'; select publicar_anuncio('30000000-0000-4000-a000-00000000000{i}'); select pg_sleep(0.2); commit;")
    with ThreadPoolExecutor(max_workers=3) as pool:
        results=list(pool.map(publish,range(1,4)))
    assert sum(r.returncode==0 for r in results)==1, [r.stderr for r in results]
    assert all(r.returncode==0 or 'limite de 1' in r.stderr for r in results), [r.stderr for r in results]
    print('PASS: três publicações simultâneas respeitam a única vaga do plano', flush=True)
    def repeat(i):
        return sql("begin; set role authenticated; set request.jwt.claim.role='authenticated'; set request.jwt.claim.sub='user_comprador'; select criar_pedido_radar_site('10000000-0000-4000-a000-000000000002','Procuro armário de cozinha','Corrente'); select pg_sleep(0.2); commit;")
    with ThreadPoolExecutor(max_workers=4) as pool:
        results=list(pool.map(repeat,range(4)))
    for result in results: checked(result)
    checked(sql("do $$ begin assert (select count(*)=1 from radar_pedidos where chave_envio='10000000-0000-4000-a000-000000000002'), 'pedido duplicado'; end $$;"))
    print('PASS: quatro envios simultâneos criam um único pedido', flush=True)
finally:
    run('docker','stop',container)
