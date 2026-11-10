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
        # O servidor temporário do entrypoint só aceita socket e reinicia antes do definitivo.
        if run('docker','exec',container,'pg_isready','-h','127.0.0.1','-U','postgres').returncode == 0: break
        time.sleep(.25)
    else:
        raise RuntimeError('PostgreSQL isolado não ficou pronto em 15 segundos')
    init = (root/'supabase/testes/00_simula_supabase.sql').read_text()
    checked(run('docker','exec','-i',container,'psql','-X','-q','-U','postgres','-v','ON_ERROR_STOP=1',input=init))
    for p in sorted((root/'supabase/migrations').glob('*.sql')):
        checked(sql('begin;\n'+p.read_text()+'\ncommit;'))
    migracao_home = (root/'supabase/migrations/20261109165907_texto_radar_inicio.sql').read_text()
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
    checked(sql((root/'supabase/testes/160_busca_filtros.sql').read_text()))
    print('PASS: busca combina filtros, ordena, pagina e isola região e status', flush=True)
    checked(sql((root/'supabase/testes/170_anuncio_contato.sql').read_text()))
    print('PASS: anúncio público protege contato, rascunho, vendido e pessoa sem confirmação', flush=True)
    checked(sql((root/'supabase/testes/180_criar_publicar_anuncio.sql').read_text()))
    print('PASS: rascunho, fotos concorrentes, preço, localização, publicação idempotente e contato público', flush=True)
    checked(sql((root/'supabase/testes/190_meus_anuncios.sql').read_text()))
    print('PASS: lixeira, restauração, fotos, venda, moderação, idempotência e isolamento entre usuários', flush=True)
    checked(sql((root/'supabase/testes/200_radar_pedido_proposta_contato.sql').read_text()))
    print('PASS: Radar completo preserva centavos, valida fotos, entrega avisos e protege contato e prazo', flush=True)
    checked(sql((root/'supabase/testes/210_notificacoes.sql').read_text()))
    print('PASS: notificações isolam contas, canais, leitura, preferências e repetição', flush=True)
    checked(sql((root/'supabase/testes/220_minha_conta.sql').read_text()))
    print('PASS: Minha conta protege identidade, perfil, confirmação e privilégios', flush=True)
    checked(sql((root/'supabase/testes/230_favoritos.sql').read_text()))
    print('PASS: favoritos protegem contas e anúncios privados, mantêm contagem e repetição', flush=True)
    checked(sql((root/'supabase/testes/240_pagina_loja.sql').read_text()))
    print('PASS: vitrine preserva contato permitido, seções, fixados, preços e paginação sem expor prévias privadas', flush=True)
    checked(sql((root/'supabase/testes/250_minha_loja.sql').read_text()))
    print('PASS: Minha loja protege edição e uploads, salva contato, fotos e horários até meia-noite', flush=True)
    checked(sql((root/'supabase/testes/260_meu_plano.sql').read_text()))
    print('PASS: Meu plano protege preço, histórico, reserva e confirmação repetida', flush=True)
    def reservar(i):
        return sql("begin; select reservar_criacao_asaas('60000000-0000-4000-a000-000000000026','sandbox'); select pg_sleep(0.2); commit;")
    with ThreadPoolExecutor(max_workers=4) as pool:
        reservas=list(pool.map(reservar,range(4)))
    for result in reservas: checked(result)
    assert sum(' t' in r.stdout for r in reservas)==1, [r.stdout for r in reservas]
    print('PASS: quatro conexões simultâneas reservam uma única criação de cobrança', flush=True)
    migracao_avisos = (root/'supabase/migrations/20261109195657_notificacoes_confiaveis.sql').read_text()
    checked(sql("""begin;
      update modelos_mensagem set texto='Texto personalizado da equipe' where chave='proposta_escolhida' and canal='notificacao';
      update configuracoes set valor='"Texto regional personalizado"' where chave='radar.aviso.proposta_escolhida.texto';
    """ + migracao_avisos + migracao_avisos + """
      do $$ begin
        assert (select texto='Texto personalizado da equipe' from modelos_mensagem where chave='proposta_escolhida' and canal='notificacao'), 'Texto personalizado foi substituído';
        assert not exists(select 1 from configuracoes where chave='radar.aviso.proposta_escolhida.texto' and valor <> '"Texto regional personalizado"'::jsonb), 'Configuração personalizada foi substituída';
        assert (select tgenabled='O' from pg_trigger where tgrelid='modelos_mensagem'::regclass and tgname='modelos_mensagem_proteger'), 'Protetor de modelos desabilitado';
      end $$;
      rollback;
    """))
    print('PASS: migração de avisos repetida preserva textos personalizados e protetor', flush=True)
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
