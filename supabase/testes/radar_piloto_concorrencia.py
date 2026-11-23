from contextlib import contextmanager
from concurrent.futures import ThreadPoolExecutor
import json
import subprocess
import time


def verificar_radar_piloto(container, sql, checked, fixture):
    def valor(command):
        result = sql(command)
        checked(result)
        return result.stdout.strip()

    @contextmanager
    def transacao(command):
        with subprocess.Popen(
            ['docker', 'exec', '-i', container, 'psql', '-XqAt', '-U', 'postgres',
             '-d', 'olaki', '-v', 'ON_ERROR_STOP=1'],
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True,
        ) as session:
            session.stdin.write("begin; set local statement_timeout='12s';\n" + command + "\n\\echo PRONTO\n")
            session.stdin.flush()
            while (line := session.stdout.readline().strip()) != 'PRONTO':
                if not line and session.poll() is not None:
                    raise RuntimeError(f'Transação de teste interrompida: {command}')
            try:
                yield session
            finally:
                session.stdin.write("commit;\n\\q\n")
                session.stdin.flush()
                if session.wait(timeout=15):
                    raise RuntimeError('Transação de teste não confirmou')

    def esperar_bloqueio(nome):
        limite = time.monotonic() + 10
        while time.monotonic() < limite:
            if valor(f"select count(*) as n from pg_stat_activity where application_name='{nome}' and wait_event_type='Lock' \\gset\n\\echo :n") == '1':
                return
            time.sleep(.04)
        raise AssertionError(f'{nome} não chegou à barreira')

    def sessao(uid, query):
        return f"set local role authenticated; set local request.jwt.claim.sub='{uid}'; {query}"

    buyer, shop = 'user_899buyer', 'user_899shop'
    loja = "89900000-0000-4000-c000-000000000001"
    fila_prefixos = {
        'pedido_novo': (shop, '5589998990011'),
        'proposta_nova': (buyer, '5589998990010'),
        'proposta_escolhida': (shop, '5589998990011'),
    }

    def pedido(n):
        return f"""select criar_pedido_radar_site('89900000-0000-4000-a000-{n:012}',
          'Procuro sofá novo para teste','Corrente','propostas_prazo',72,null,
          (select id from categorias where slug='sofas-e-poltronas'))->>'id' as ped \\gset
        """

    def proposta(ped):
        return f"""select proposta_id as prop from propor_radar({ped},'{loja}',null,120000,
          'Proposta de teste') \\gset
        """

    checked(sql('\\set concorrencia899 1\n' + fixture))
    checked(sql("""
      create function public.test_899_barreira() returns trigger language plpgsql as $$
      begin
        if current_setting('test.radar_barreira',true)=split_part(new.chave,':',1) then
          perform pg_advisory_xact_lock(89900001);
        end if;
        return new;
      end $$;
      create trigger test_899_barreira before insert on whatsapp_fila for each row execute function public.test_899_barreira();
    """))

    cenarios = [(tipo, destino, numero, False) for tipo, (destino, numero) in fila_prefixos.items()]
    cenarios.append(('pedido_novo', shop, '5589998990011', True))
    for indice, (tipo, destino, numero, pelo_site) in enumerate(cenarios, start=1):
        def evento(numero_pedido):
            criar = sessao(buyer, pedido(numero_pedido))
            if tipo == 'pedido_novo':
                return '', criar
            if tipo == 'proposta_nova':
                return criar, sessao(shop, proposta(":'ped'::uuid"))
            return criar + sessao(shop, proposta(":'ped'::uuid")), sessao(buyer, "select * from escolher_proposta(:'prop'::uuid);")

        preparar, produzir = evento(10 + indice)
        tag = f'radar_{tipo}'
        with ThreadPoolExecutor(max_workers=1) as pool:
            with transacao('select pg_advisory_xact_lock(89900001);'):
                desligar = sessao(destino, f"select salvar_preferencia_whatsapp_radar_tipo('{tipo}',false);") if pelo_site else f"select whatsapp_sair('{numero}','SAIR');"
                with transacao(desligar):
                    produtor = pool.submit(sql, f"""begin; set local statement_timeout='12s';
                        set local application_name='radar899-produtor'; {preparar}
                        set local test.radar_barreira='{tag}'; {produzir}
                        commit;""")
                    esperar_bloqueio('radar899-produtor')
                desligado_em = valor(f"select atualizado_em as marca from preferencias_avisos where usuario_id='{destino}' " +
                                     f"and canal='whatsapp' and tipo='{tipo}' \\gset\n\\echo :marca")
                if pelo_site:
                    checked(sql("begin; " + sessao(destino, f"select salvar_preferencia_whatsapp_radar_tipo('{tipo}',true);") + " commit;"))
                else:
                    checked(sql(f"""do $$ begin assert whatsapp_mensagem_recebida(
                        '{numero}','voltar',repeat('e',64))='voltou'; end $$;"""))
            checked(produtor.result(timeout=15))

        checked(sql(f"""
          do $$ declare item whatsapp_fila; begin
            select * into strict item from whatsapp_fila where usuario_id='{destino}'
              and split_part(chave,':',1)='{tag}' order by criado_em desc limit 1;
            assert item.criado_em > '{desligado_em}'::timestamptz, 'a fila pode parecer posterior à saída';
            assert item.radar_autorizacao_id <> (select radar_autorizacao_id from preferencias_avisos
              where usuario_id='{destino}' and canal='whatsapp' and tipo='{tipo}');
            update whatsapp_fila set estado='enviando' where id=item.id;
            assert whatsapp_fila_confirmar_envio(item.id)='cancelada';
          end $$;
        """))
        preparar, produzir = evento(20 + indice)
        checked(sql(f"begin; {preparar}{produzir} reset role; commit;"))
        checked(sql(f"""
          do $$ declare item uuid; begin
            select id into strict item from whatsapp_fila where usuario_id='{destino}'
              and split_part(chave,':',1)='{tag}' order by criado_em desc limit 1;
            update whatsapp_fila set estado='enviando' where id=item and estado='pendente';
            assert found;
            assert whatsapp_fila_confirmar_envio(item)='pode';
            perform whatsapp_fila_resultado(item,'enviado');
          end $$;
        """))

    with ThreadPoolExecutor(max_workers=1) as pool:
        with transacao("""select id from radar_piloto_controle for update;
                          update radar_piloto_controle set modo='pausado';"""):
            optin = pool.submit(sql, "begin; set local application_name='radar899-optin'; " +
                                sessao(shop, "select salvar_preferencia_whatsapp_radar_tipo('proposta_nova',true);") + " commit;")
            esperar_bloqueio('radar899-optin')
            # O desligamento segue disponível, embora o controle esteja travado.
            checked(sql("begin; set local statement_timeout='3s'; " +
                        sessao(shop, "select salvar_preferencia_whatsapp_radar_tipo('pedido_novo',false);") + " commit;"))
        erro = optin.result(timeout=10)
        assert erro.returncode and 'Este aviso ainda não está disponível' in erro.stderr, erro

    for rpc in (
        "salvar_preferencia_whatsapp_radar(true)",
        "salvar_preferencia_whatsapp_radar_completa(true)",
    ):
        checked(sql("update radar_piloto_controle set modo='legado';"))
        with ThreadPoolExecutor(max_workers=1) as pool:
            with transacao("""select id from radar_piloto_controle for update;
                              update radar_piloto_controle set modo='fechado';"""):
                optin = pool.submit(sql, "begin; set local application_name='radar899-legado'; " +
                                    sessao(shop, f"select {rpc};") + " commit;")
                esperar_bloqueio('radar899-legado')
            rejeitado = optin.result(timeout=10)
            assert rejeitado.returncode and 'Este aviso ainda não está disponível' in rejeitado.stderr

    # A validade temporal pode terminar mesmo enquanto a transação de opt-in segura o controle compartilhado.
    checked(sql("""update radar_piloto_participantes set fim_em=clock_timestamp()+interval '2 seconds'
                   where usuario_id='user_899buyer';"""))
    with ThreadPoolExecutor(max_workers=1) as pool:
        with transacao("select pg_advisory_xact_lock(hashtext('whatsapp_voltar:user_899buyer'));"):
            optin = pool.submit(sql, "begin; set local application_name='radar899-expira'; " +
                                sessao(buyer, "select salvar_preferencia_whatsapp_radar_tipo('pedido_novo',true);") + " commit;")
            esperar_bloqueio('radar899-expira')
            checked(sql("""select pg_sleep(greatest(0, extract(epoch from fim_em-clock_timestamp()))+.01)
                          from radar_piloto_participantes where usuario_id='user_899buyer';"""))
        rejeitado = optin.result(timeout=10)
        assert rejeitado.returncode and 'Este aviso ainda não está disponível' in rejeitado.stderr

    # Na ordem inversa, a operação administrativa espera até a habilitação confirmar.
    with ThreadPoolExecutor(max_workers=1) as pool:
        with transacao(sessao(shop, "select salvar_preferencia_whatsapp_radar_tipo('pedido_novo',true);")):
            pausa = pool.submit(sql, """begin; set local application_name='radar899-pausa';
                select id from radar_piloto_controle for update;
                update radar_piloto_controle set modo='pausado'; commit;""")
            esperar_bloqueio('radar899-pausa')
        checked(pausa.result(timeout=10))

    checked(sql("""insert into whatsapp_fila(usuario_id,numero,texto,chave,enviar_apos)
      select 'user_899buyer','5589998990010','Fila alheia fictícia','teste899-concorrente:'||n,now()
      from generate_series(1,12) n;"""))
    colher = r"""select jsonb_agg(id)::text as ids from whatsapp_fila_pegar_em(5,
      (date_trunc('day',clock_timestamp() at time zone 'America/Fortaleza')+interval '1 day 10 hours')
         at time zone 'America/Fortaleza') \gset
      \echo :ids"""
    with ThreadPoolExecutor(max_workers=2) as pool:
        a, b = list(pool.map(lambda _: set(json.loads(valor(colher))), range(2)))
    assert len(a) == len(b) == 5 and a.isdisjoint(b), (a,b)

    checked(sql("""
      drop trigger test_899_barreira on whatsapp_fila;
      drop function public.test_899_barreira();
      update radar_piloto_controle set modo='legado', rodada_id=null, microrregiao_id=null,
          inicio_em=null, fim_em=null, piso_fila_em=null;
      delete from perfis where id in ('user_899buyer','user_899shop','user_899out');
      update configuracoes set valor='false' where chave='radar.whatsapp_ativo' and microrregiao_id is null;
    """))
