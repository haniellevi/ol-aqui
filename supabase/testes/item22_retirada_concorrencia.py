"""Duas sessões sintéticas disputam escolher/retirar, sem rede ou dados externos."""
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
import subprocess
import time
import re


def verificar_retirada_concorrente(container, sql, checked, fixture):
    @contextmanager
    def transacao(comando):
        with subprocess.Popen(['docker', 'exec', '-i', container, 'psql', '-XqAt', '-U', 'postgres', '-d', 'olaki', '-v', 'ON_ERROR_STOP=1'],
                              stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True) as p:
            p.stdin.write("begin; set local statement_timeout='12s';\n" + comando + "\n\\echo PRONTO\n")
            p.stdin.flush()
            while p.stdout.readline().strip() != 'PRONTO':
                if p.poll() is not None:
                    raise AssertionError('Sessão sintética não chegou à barreira')
            try:
                yield
            finally:
                p.stdin.write('commit;\n\\q\n')
                p.stdin.flush()
                assert p.wait(timeout=15) == 0

    def esperar():
        limite = time.monotonic() + 10
        while time.monotonic() < limite:
            r = sql("select count(*) as n from pg_stat_activity where application_name='item22_race' and wait_event_type='Lock' \\gset\n\\echo :n")
            checked(r)
            if r.stdout.strip() == '1':
                return
            time.sleep(.04)
        raise AssertionError('Sessão concorrente não bloqueou na linha esperada')

    for retirar_primeiro, numero in [(False, '223'), (True, '224')]:
        # Reusa o cenário válido já testado, até antes de alterar os estados.
        setup = fixture.split('-- Gerente sintético')[0].replace('d22', 'd' + numero).replace('22200000', numero + '00000').replace('55899922', '55899' + numero).replace('Loja sintética', 'Loja sintética ' + numero)
        checked(sql(setup + '\ncommit;'))
        loja = numero + '00000-0000-4000-b000-000000000001'
        prop = f"(select id from public.radar_propostas where vitrine_id='{loja}')"
        dono, comprador = 'user_d' + numero + '1', 'user_d' + numero + '2'
        primeira = f"set local role authenticated; set local request.jwt.claim.sub='{dono if retirar_primeiro else comprador}'; select public.{'retirar_proposta_radar' if retirar_primeiro else 'escolher_proposta'}({prop});"
        segunda = f"begin; set local application_name='item22_race'; set local statement_timeout='12s'; set local role authenticated; set local request.jwt.claim.sub='{comprador if retirar_primeiro else dono}'; select public.{'escolher_proposta' if retirar_primeiro else 'retirar_proposta_radar'}({prop}); commit;"
        # IDs são obtidos antes de trocar o papel, sem ampliar a leitura da contraparte.
        ids = sql(f"select id::text || ',' || pedido_id::text from public.radar_propostas where vitrine_id='{loja}';")
        checked(ids)
        proposta_id, pedido_id = re.findall(r'[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}', ids.stdout)
        primeira = primeira.replace(prop, "'" + proposta_id + "'")
        segunda = segunda.replace(prop, "'" + proposta_id + "'")
        with ThreadPoolExecutor(max_workers=1) as pool:
            with transacao(f"select id from public.radar_pedidos where id='{pedido_id}' for update; " + primeira):
                futuro = pool.submit(sql, segunda)
                esperar()
            resultado = futuro.result(timeout=15)
        assert resultado.returncode != 0, 'Escolha e retirada não podem ambas confirmar'
        assert 'não está mais disponível' in resultado.stderr or 'não escolhida' in resultado.stderr, resultado.stderr
        estado = "status='retirada' and not escolhida" if retirar_primeiro else "status='ativa' and escolhida"
        checked(sql(f"do $$ begin assert (select {estado} from public.radar_propostas where id='{proposta_id}'); end $$;"))
        # Não deixa os anúncios sintéticos alterarem contagens globais de outros cenários.
        checked(sql(f"delete from public.radar_pedidos where comprador_id='{comprador}'; delete from public.vitrines_lojas where id='{loja}'; delete from public.perfis where id like 'user_d{numero}%';"))
