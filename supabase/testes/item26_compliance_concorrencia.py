"""Liberação e limpeza legítimas sobre provas sintéticas, no container sem rede."""
from concurrent.futures import ThreadPoolExecutor
import subprocess


def verificar_compliance_concorrente(container, sql, checked, fixture):
    checked(sql(fixture.split('set local role authenticated;')[0] + '\ncommit;'))
    item = '26000000-0000-4000-b000-000000000001'
    liberar = f"""set local role authenticated;
      set local request.jwt.claim.sub='user_c26admin';
      select compliance_liberar_retencao(compliance_abrir('Concorrência sintética',null),
        'anuncio','{item}','Encerramento sintético');"""
    limpar = f"select public.purgar_anuncio('{item}');"
    for primeiro, segundo in [(liberar, limpar), (limpar, liberar)]:
        with subprocess.Popen(['docker', 'exec', '-i', container, 'psql', '-XqAt', '-U', 'postgres', '-d', 'olaki', '-v', 'ON_ERROR_STOP=1'],
                              stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True) as p:
            p.stdin.write("begin; set local statement_timeout='10s';\n" + primeiro + '\n\\echo PRONTO\n')
            p.stdin.flush()
            while p.stdout.readline().strip() != 'PRONTO':
                if p.poll() is not None: raise AssertionError('Transação não chegou à barreira')
            with ThreadPoolExecutor(max_workers=1) as pool:
                futuro = pool.submit(sql, "begin; set local statement_timeout='10s';" + segundo + 'commit;')
                # A segunda operação termina enquanto a primeira transação continua
                # aberta: a limpeza deve excluir a prova dos candidatos, sem apagá-la.
                checked(futuro.result(timeout=15))
                p.stdin.write('commit;\n\\q\n')
                p.stdin.flush()
                assert p.wait(timeout=15) == 0
    checked(sql(f"""do $$ begin
      assert exists(select 1 from anuncios where id='{item}' and status='excluido');
      assert (select count(*)=1 from admin_gestao_eventos where acao='compliance_liberar_retencao'
        and detalhes->>'item'='{item}');
      assert not exists(select 1 from limpeza_arquivos where url='https://synthetic.invalid/c26.webp');
    end $$;"""))
    checked(sql("""begin; set local role authenticated; set local request.jwt.claim.sub='user_c26admin';
      select compliance_liberar_retencao(compliance_abrir('Rollback sintético',null),'anuncio',
        '26000000-0000-4000-b000-000000000002','Liberação a reverter'); rollback;
      do $$ begin assert not exists(select 1 from admin_gestao_eventos where acao='compliance_liberar_retencao'
        and detalhes->>'item'='26000000-0000-4000-b000-000000000002'); end $$;"""))
    # Fixture permanece apenas no PostgreSQL descartável. Não remove provas para limpar teste.
