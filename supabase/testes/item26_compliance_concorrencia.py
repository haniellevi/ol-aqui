"""Liberação e limpeza legítimas sobre provas sintéticas, no container sem rede."""
from concurrent.futures import ThreadPoolExecutor
import subprocess


def verificar_compliance_concorrente(container, sql, checked, fixture):
    for indice, liberar_primeiro in [(261, True), (262, False)]:
        # Cada ordem começa sem liberação anterior e usa identidades/itens próprios.
        independente = fixture.replace('26000000', f'{indice}00000').replace('c26',f'c{indice}').replace('558999992600',f'5589999{indice}00').replace('Loja sintética',f'Loja sintética {indice}')
        checked(sql(independente.split('set local role authenticated;')[0] + '\ncommit;'))
        item = f'{indice}00000-0000-4000-b000-000000000001'
        checked(sql(f"do $$ begin assert not exists(select 1 from admin_gestao_eventos where acao='compliance_liberar_retencao' and detalhes->>'item'='{item}'); end $$;"))
        liberar = f"""set local role authenticated;
      set local request.jwt.claim.sub='user_c{indice}admin';
      select compliance_liberar_retencao(c.id,'anuncio','{item}','Encerramento sintético',
        (select x->>'retencao_id' from jsonb_array_elements(compliance_fila_retencoes(c.id)) x where x->>'id'='{item}'))
      from (select compliance_abrir('Concorrência sintética',null) id) c;"""
        limpar = f"select public.purgar_anuncio('{item}');"
        primeiro, segundo = (liberar, limpar) if liberar_primeiro else (limpar, liberar)
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
      assert not exists(select 1 from limpeza_arquivos where url='https://synthetic.invalid/c{indice}.webp');
    end $$;"""))
        rollback = liberar.replace(item, f'{indice}00000-0000-4000-b000-000000000002')
        checked(sql(f"""begin; {rollback} rollback;
      do $$ begin assert not exists(select 1 from admin_gestao_eventos where acao='compliance_liberar_retencao'
        and detalhes->>'item'='{indice}00000-0000-4000-b000-000000000002'); end $$;"""))
    # Fixture permanece apenas no PostgreSQL descartável. Não remove provas para limpar teste.
