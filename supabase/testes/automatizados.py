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
    marca_documentos = (root/'supabase/migrations/20261110234147_marca_documentos_atuais.sql').read_text()
    checked(sql((root/'supabase/testes/440_marca_documentos_atuais.sql').read_text().replace('-- REAPLICAR_DOCUMENTOS', marca_documentos + marca_documentos)))
    print('PASS: marca nos documentos ativos e idempotência, versões antigas preservadas', flush=True)
    migracao_marca = (root/'supabase/migrations/20261110190000_marca_mercado_da_regiao.sql').read_text()
    teste_marca = (root/'supabase/testes/430_marca_mercado_da_regiao.sql').read_text()
    checked(sql(teste_marca.replace('-- APLICAR_MIGRACAO_MARCA', migracao_marca)))
    print('PASS: marca atualizada duas vezes, com personalizações, documentos, aceites e convites preservados', flush=True)
    checked(sql((root/'supabase/testes/420_gerentes_loja.sql').read_text()))
    print('PASS: convites e edição de gerentes isolados por loja, com expiração e revogação', flush=True)
    checked(sql((root/'supabase/testes/430_admin_arquivo_lojas.sql').read_text()))
    print('PASS: arquivamento e restauração de lojas, permissões, histórico e pagamentos por ambiente', flush=True)
    checked(sql((root/'supabase/testes/430_gestao_usuarios_lojas.sql').read_text()))
    print('PASS: gestão de usuários e lojas, permissões e exclusão', flush=True)
    checked(sql((root/'supabase/testes/450_aki_lojistas.sql').read_text()))
    print('PASS: cadastro assistido, créditos, falhas, renovação, isolamento e banner gratuito do Aki', flush=True)
    checked(sql((root/'supabase/testes/450_lixeira_contas_lojas.sql').read_text()))
    print('PASS: lixeira de 30 dias para conta e loja, cancelamento, suspensão em cascata e limpeza com provas preservadas', flush=True)
    checked(sql((root/'supabase/testes/460_vitrine_ia_base.sql').read_text()))
    print('PASS: vitrine com IA, base: nicho da loja, buscas somadas, categoria sugerida e chave desligada', flush=True)
    checked(sql((root/'supabase/testes/470_favoritos_radar.sql').read_text()))
    print('PASS: lembrete de favoritos no sino: chave, um por dia, fora do ar primeiro, preferência e privacidade', flush=True)
    checked(sql((root/'supabase/testes/480_categorizacao_ia.sql').read_text()))
    print('PASS: categorias com IA: lote, sugestão confiante, falha volta à fila, limites, nicho e decisão do dono', flush=True)
    checked(sql((root/'supabase/testes/490_painel_loja.sql').read_text()))
    print('PASS: painel da loja: eventos, números, dicas por regra e resumo semanal', flush=True)
    checked(sql((root/'supabase/testes/500_melhoria_ia.sql').read_text()))
    print('PASS: melhoria com IA: cota por plano, texto seguro, dicas de foto e decisão do dono', flush=True)
    checked(sql((root/'supabase/testes/510_categorias_3_niveis.sql').read_text()))
    print('PASS: categorias em 3 níveis: travas, caminho, busca, Radar, nicho e sugestão da troca', flush=True)
    checked(sql((root/'supabase/testes/520_categorias_sugeridas.sql').read_text()))
    print('PASS: categorias sugeridas: normalização, grupo, parecidas, aprovar, juntar, recusar e aviso', flush=True)
    checked(sql((root/'supabase/testes/530_slug_anuncios.sql').read_text()))
    print('PASS: link curto do anúncio: endereço fixo, formato, resolvedor, busca, backfill e redirecionamento', flush=True)
    checked(sql((root/'supabase/testes/540_metricas_anuncios.sql').read_text()))
    print('PASS: métricas do produto: números diários, termos normalizados, aparições, favoritar, tempo até sair e permissões', flush=True)
    checked(sql((root/'supabase/testes/550_super_admin_historico.sql').read_text()))
    print('PASS: super admin só pelo banco, histórico do dono, lixeira e apagar de vez pela equipe', flush=True)
    checked(sql((root/'supabase/testes/560_ajudantes_anuncios.sql').read_text()))
    print('PASS: ajudante da loja cuida dos anúncios; estranho, revogado e sem WhatsApp não mexem', flush=True)
    checked(sql((root/'supabase/testes/570_super_admin_edita_anuncio.sql').read_text()))
    print('PASS: super admin edita anúncio dos outros só com motivo, prazo de 2 horas e um aviso ao dono', flush=True)
    checked(sql((root/'supabase/testes/580_ajudantes_loja.sql').read_text()))
    print('PASS: ajudante cuida da Minha loja sem mudar nome, WhatsApp nem plano; estranho não mexe', flush=True)
    checked(sql((root/'supabase/testes/590_montar_e_transferir_loja.sql').read_text()))
    print('PASS: super admin monta loja escondida e o dono recebe pelo convite; fotos mudam de pasta e prontos vão ao ar', flush=True)
    checked(sql((root/'supabase/testes/600_radar_quem_atende.sql').read_text()))
    print('PASS: Radar só atende loja verificada e paga (ou cortesia da equipe); aviso na hora só no Full', flush=True)
    checked(sql((root/'supabase/testes/610_radar_area_visibilidade.sql').read_text()))
    print('PASS: pedido do Radar com várias cidades, visibilidade só lojas ou todos, área da loja e até 5 lojas', flush=True)
    checked(sql((root/'supabase/testes/620_radar_aviso_full.sql').read_text()))
    print('PASS: aviso de pedido novo só para Full verificada e cortesia, dentro da área e do nicho', flush=True)
    checked(sql((root/'supabase/testes/630_radar_prazo.sql').read_text()))
    print('PASS: pedido do Radar avisa 2 dias antes de vencer e o comprador estende com Ainda preciso até 2 vezes', flush=True)
    checked(sql((root/'supabase/testes/640_radar_resolver_indicar.sql').read_text()))
    print('PASS: Radar pergunta com quem resolveu, guarda a nota 👍/👎 e aceita indicação de anúncio (Eu sei onde tem)', flush=True)
    checked(sql((root/'supabase/testes/650_radar_ajustes_finais.sql').read_text()))
    print('PASS: Radar devolve pode_propor, loja de fora da área indica, loja ativa nas indicações, aviso com a região e contas internas fechadas', flush=True)
    checked(sql((root/'supabase/testes/600_acertos_categoria_ia.sql').read_text()))
    print('PASS: acertos da IA de categorias: guarda sugestão e escolha, só quem cuida grava, só admin lê, período e erros', flush=True)
    checked(sql((root/'supabase/testes/610_preco_antes.sql').read_text()))
    print('PASS: preço antes e UF no card: só quem cuida grava, visitante lê o que está no ar, rascunho fica privado', flush=True)
    checked(sql((root/'supabase/testes/700_verificacao_reabertura.sql').read_text()))
    print('PASS: selo da loja só cai com CNPJ, endereço, cidade ou WhatsApp; nome e Instagram deixam aviso para a equipe', flush=True)
    checked(sql((root/'supabase/testes/710_verificacao_loja_nucleo.sql').read_text()))
    print('PASS: núcleo da verificação da loja: envio com limite e arquivos privados, decisão única, situação da loja e permissões', flush=True)
    checked(sql((root/'supabase/testes/720_verificacao_loja_fila.sql').read_text()))
    print('PASS: fila da IA da verificação da loja: reserva com orçamento, decisão final, nova tentativa da Receita, 3ª recusa, cadastro que muda e permissões', flush=True)
    checked(sql((root/'supabase/testes/730_whatsapp_fila.sql').read_text()))
    print('PASS: fila de WhatsApp e avisos da verificação: janela 8h-20h, destinatários da equipe, chaves desligadas, um aviso por transição, lembrete de 24 h e permissões', flush=True)
    checked(sql((root/'supabase/testes/740_verificacao_loja_equipe.sql').read_text()))
    print('PASS: fila da equipe na verificação da loja: só suporte e administrador, arquivos só nos status certos, aprovar/correção/recusar/confirmar/tirar selo, corrida, cadastro que mudou, avisos e limpeza das amostras', flush=True)
    checked(sql((root/'supabase/testes/750_verificacao_loja_reconferir.sql').read_text()))
    print('PASS: reconferência mensal do CNPJ: reserva das lojas vencidas, ativa só atualiza a data, inativa e não encontrada tiram o selo com um aviso da loja e da equipe, nova verificação depois, aprovações gravam a data e permissões', flush=True)
    checked(sql((root/'supabase/testes/760_verificacao_loja_ajustes.sql').read_text()))
    print('PASS: ajustes da revisão final da verificação: reconferência desligada de fábrica, dono não escreve cnpj_conferido_em, revisão manual fecha o pedido aberto sem aviso errado, selo removido fecha a revisão por amostra e pedido parado há mais de 30 minutos vai para a equipe', flush=True)
    checked(sql((root/'supabase/testes/770_cortesia_lancamento.sql').read_text()))
    print('PASS: cortesia de lançamento do Radar: 30 dias só para loja e PF pagas sem selo, uma vez só, aviso ao dono, vale até o prazo, aviso de fim uma vez e permissões', flush=True)
    checked(sql((root/'supabase/testes/780_troca_id_clerk.sql').read_text()))
    print('PASS: troca de ID do Clerk: perfil, loja, anúncio, tabelas sem chave estrangeira, histórico em jsonb, fotos e Storage vão ao ID novo; desfazer com IDs invertidos; só service_role executa; erro no meio não deixa nada pela metade', flush=True)
    checked(sql((root/'supabase/testes/790_conversas_base.sql').read_text()))
    print('PASS: conversas: abrir pelo anúncio, enviar, ler por lado, limites, alerta de golpe, telefone escondido até o cliente mostrar e acesso só de quem participa', flush=True)
    checked(sql((root/'supabase/testes/800_conversas_radar_seguranca.sql').read_text()))
    print('PASS: conversas: proposta do Radar abre a conversa com cartão, bloquear, denunciar já bloqueia, admin só lê denunciada (registrado) e limpeza em 180 dias', flush=True)
    checked(sql((root/'supabase/testes/790_radar_ia.sql').read_text()))
    print('PASS: IA do Radar: chaves desligadas, 20 usos por dia, teto do mês próprio, livro-caixa e aviso de anúncio novo parecido 1 vez por dia', flush=True)
    checked(sql((root/'supabase/testes/810_radar_ja_comprei.sql').read_text()))
    print('PASS: IA do Radar "já comprei": chave própria desligada, só mensagem do cliente com pedido dele aberto, pergunta só para o cliente, "não" vale para sempre naquele pedido e só o servidor lê', flush=True)
    checked(sql((root/'supabase/testes/820_fotos_pasta_antiga.sql').read_text()))
    print('PASS: fotos na pasta do ID antigo após a troca do Clerk: dono reordena, tira e põe foto nova; foto antiga fora do anúncio, em outro anúncio ou de outra pessoa continua recusada', flush=True)
    checked(sql((root/'supabase/testes/830_leitura_publica_colunas.sql').read_text()))
    print('PASS: leitura pública: visitante só lê colunas das telas públicas, logado sem IP de criação e revisão interna, ID do dono fora do visitante, dona, ajudante, admin e outra pessoa', flush=True)
    checked(sql((root/'supabase/testes/831_config_equipe_merc.sql').read_text()))
    print('PASS: configurações: config_publica só entrega chaves públicas, moderação sem config(), financeiro fora de anúncios e lojas, conversas do Merc só do dono', flush=True)
    checked(sql((root/'supabase/testes/832_campos_do_dono.sql').read_text()))
    print('PASS: campos do dono restaurados pelo banco, nome de loja com filtro de palavras e volta à conferência, recusa da fila deixa anúncio em revisão humana', flush=True)
    checked(sql((root/'supabase/testes/833_permissoes_sobrando.sql').read_text()))
    print('PASS: permissões de tabela sobrando retiradas, perguntas sobre outra conta só do próprio dono ou da equipe ativa, verificação só na pasta da própria pessoa', flush=True)
    migracao_lote = (root/'supabase/migrations/20261125010000_seguranca_lote_banco.sql').read_text()
    checked(sql((root/'supabase/testes/834_recusados_antes_do_lote.sql').read_text().replace('-- LOTE_REAPLICADO', migracao_lote)))
    print('PASS: anúncio recusado antes do lote ganha revisão manual e a republicação vai para análise', flush=True)
    migracao_home = (root/'supabase/migrations/20261117040000_radar_textos.sql').read_text()
    checked(sql("""begin;
      do $$ begin
        assert (select texto = 'Diga o que precisa. As lojas da região te respondem.' and botao = 'Estou procurando…' from home_blocos where chave = 'radar'), 'Texto padrão do Radar incorreto';
      end $$;
      update home_blocos set texto = 'Conte o que procura. As lojas podem enviar propostas, e você escolhe com quem conversar.', botao = 'Pedir no Radar' where chave = 'radar';
    """ + migracao_home + """
      do $$ begin
        assert (select texto = 'Diga o que precisa. As lojas da região te respondem.' and botao = 'Estou procurando…' from home_blocos where chave = 'radar'), 'Migração não trocou o texto antigo';
      end $$;
      update home_blocos set texto = 'Texto personalizado da equipe', botao = 'Botão da equipe' where chave = 'radar';
    """ + migracao_home + migracao_home + """
      do $$ begin
        assert (select texto = 'Texto personalizado da equipe' and botao = 'Botão da equipe' from home_blocos where chave = 'radar'), 'Migração sobrescreveu texto personalizado';
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
    checked(sql((root/'supabase/testes/185_publicar_buscar_facetas.sql').read_text()))
    print('PASS: Carros e Casas passam de rascunho a anúncio público com filtros e facetas regionais', flush=True)
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
    checked(sql((root/'supabase/testes/270_confirmacao_whatsapp.sql').read_text()))
    print('PASS: OTP privado, três erros, prazo, consumo único, reenvio com intervalo e sem cota diária, troca segura e contadores públicos', flush=True)
    checked(sql((root/'supabase/testes/280_moderacao_aluguel.sql').read_text()))
    print('PASS: aluguel e venda publicam sem moderação por preço e preservam filtro de conteúdo', flush=True)
    checked(sql((root/'supabase/testes/290_moderacao_ia.sql').read_text()))
    print('PASS: IA protege revisão, orçamento, fotos, denúncias, contato, congelamento, concorrência e repetição', flush=True)
    checked(sql((root/'supabase/testes/300_privacidade.sql').read_text()))
    print('PASS: exportação lê colunas concedidas e exclusão financeira preserva cobrança sem conteúdo operacional', flush=True)
    checked(sql((root/'supabase/testes/320_atendimento_anuncios.sql').read_text()))
    print('PASS: atendimento isola participantes, notifica, evita repetição e permite retomar a delegação', flush=True)
    resultado_cron=sql((root/'supabase/testes/310_rotinas_piloto.sql').read_text())
    checked(resultado_cron)
    if 'Sem pg_cron' in resultado_cron.stderr:
        print('SKIP: agendamentos310 exigem pg_cron; ramo sem extensão passou', flush=True)
    else:
        print('PASS: agendamentos310 conferidos no catálogo real do pg_cron', flush=True)
    checked(sql((root/'supabase/testes/320_verificacao_lojas.sql').read_text()))
    print('PASS: revisão de loja, links e telefone, isolamento, edição e histórico', flush=True)
    checked(sql((root/'supabase/testes/330_radar_feed_nichos.sql').read_text()))
    print('PASS: nicho filtra antes de paginar e protege dados e região', flush=True)
    checked(sql((root/'supabase/testes/340_radar_avisos_nicho.sql').read_text()))
    print('PASS: avisos do Radar respeitam nicho, plano e preferências', flush=True)
    checked(sql((root/'supabase/testes/350_radar_arquivo.sql').read_text()))
    print('PASS: arquivamento do Radar protege histórico, autoria e estado', flush=True)
    checked(sql((root/'supabase/testes/360_admin_estatisticas.sql').read_text()))
    print('PASS: estatísticas separam receitas e propostas, preservam recortes e restringem papéis', flush=True)
    checked(sql((root/'supabase/testes/370_catalogo_regional.sql').read_text()))
    print('PASS: catálogo, cidade, campanhas e contatos verificados', flush=True)
    checked(sql((root/'supabase/testes/380_documentos_vendedor_pf.sql').read_text()))
    print('PASS: documentos PF privados, revisão autorizada, reenvio e limpeza', flush=True)
    checked(sql((root/'supabase/testes/390_moderacao_sensivel.sql').read_text()))
    print('PASS: termos sensíveis, publicação imediata, edição, revisão humana e isolamento do Radar', flush=True)
    migracao_moderacao = (root/'supabase/migrations/20261110121649_moderacao_sensivel_anuncios.sql').read_text()
    checked(sql((root/'supabase/testes/400_migracao_moderacao_sensivel.sql').read_text().replace(
        '-- REAPLICAR_MIGRACAO_MODERACAO_SENSIVEL', migracao_moderacao + '\n' + migracao_moderacao)))
    print('PASS: migração repetida libera retenções antigas e preserva conteúdo sensível, restrições e ajuda personalizada', flush=True)
    def solicitar_otp(i):
        return sql("select reservar_codigo_whatsapp('user_semcodigo',gen_random_uuid(),'5589999990088',repeat('a',64));")
    with ThreadPoolExecutor(max_workers=4) as pool:
        pedidos=list(pool.map(solicitar_otp,range(4)))
    for result in pedidos: checked(result)
    assert sum('reservado' in r.stdout for r in pedidos)==1, [r.stdout for r in pedidos]
    print('PASS: quatro envios simultâneos reservam um único código', flush=True)
    def confirmar_otp(i):
        return sql("select confirmar_codigo_whatsapp('user_semcodigo',(select id from whatsapp_desafios where usuario_id='user_semcodigo' and not cancelado),repeat('a',64));")
    with ThreadPoolExecutor(max_workers=4) as pool:
        confirmacoes=list(pool.map(confirmar_otp,range(4)))
    for result in confirmacoes: checked(result)
    assert sum('confirmado' in r.stdout for r in confirmacoes)==1, [r.stdout for r in confirmacoes]
    print('PASS: quatro confirmações simultâneas consomem o código uma única vez', flush=True)
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
    checked(sql("""
      update configuracoes set valor='true' where chave='moderacao.ia_ativa';
      update configuracoes set valor=to_jsonb(275+(select coalesce(sum(custo_centavos),0) from robo_uso where criado_em>=robo_inicio('mes')))
        where chave='robo.orcamento_mensal_centavos';
      insert into anuncios(id,vitrine_id,categoria_id,titulo,cidade,preco_centavos,atributos,fotos,status)
      select ('99000000-0000-4000-a000-00000000000'||n)::uuid,v.id,c.id,'Casa de avaliação concorrente','Corrente',100000,'{"finalidade":"Venda"}',
        array['https://abc.supabase.co/storage/v1/object/public/anuncios/user_loja/99000000-0000-4000-a000-00000000000'||n||'/1.webp'],'rascunho'::status_anuncio
      from generate_series(1,2) n cross join vitrines_lojas v cross join categorias c where v.dono_id='user_loja' and c.slug='casas';
      update anuncios set status='em_analise',motivo_analise='Preço fora do normal para a categoria' where id::text like '99000000%';
    """))
    def reservar_ia(i):
        return sql("begin; select moderacao_ia_reservar(); select pg_sleep(0.1); commit;")
    with ThreadPoolExecutor(max_workers=4) as pool:
        results=list(pool.map(reservar_ia,range(4)))
    for result in results: checked(result)
    assert sum('"reserva"' in r.stdout for r in results)==1, [r.stdout for r in results]
    checked(sql("do $$ begin assert (select count(*)=1 from robo_uso where tipo='moderacao'), 'Reserva duplicada ou orçamento excedido'; end $$;"))
    print('PASS: quatro workers de IA reservam apenas uma chamada quando o orçamento permite uma', flush=True)
    # O congelamento toma o lock primeiro; as exclusões precisam aguardar e recusar.
    checked(sql("""
      insert into radar_pedidos(id,comprador_id,microrregiao_id,titulo,cidade)
       select ('94000000-0000-4000-a000-00000000000'||n)::uuid,'user_comprador',microrregiao_id,'Pedido de retenção concorrente','Corrente'
       from perfis cross join generate_series(1,2) n where id='user_comprador';
      insert into radar_propostas(pedido_id,vitrine_id,anuncio_id,mensagem)
       select ('94000000-0000-4000-a000-00000000000'||n)::uuid,id,
              case when n=2 then '99000000-0000-4000-a000-000000000001'::uuid end,'Proposta sob teste concorrente'
       from vitrines_lojas cross join generate_series(1,2) n where dono_id='user_loja';
    """))
    def conferir_retencao_concorrente(congelar, apagar):
        with ThreadPoolExecutor(max_workers=2) as pool:
            futuro=pool.submit(sql,"begin; set application_name='olaki-congelamento-teste'; "+congelar+"; select pg_sleep(1); commit;")
            for _ in range(40):
                trava=sql("select exists(select 1 from pg_stat_activity where application_name='olaki-congelamento-teste' and wait_event='PgSleep');")
                checked(trava)
                if ' t' in trava.stdout: break
                time.sleep(.01)
            else: raise AssertionError('Congelamento não iniciou para o teste concorrente')
            exclusao=pool.submit(sql,apagar)
            checked(futuro.result())
            resultado=exclusao.result()
        assert resultado.returncode != 0 and ('congelad' in resultado.stderr or 'retenção' in resultado.stderr), resultado.stderr
    conferir_retencao_concorrente(
      "update radar_pedidos set status='congelado' where id='94000000-0000-4000-a000-000000000001'",
      "delete from radar_propostas where pedido_id='94000000-0000-4000-a000-000000000001'")
    conferir_retencao_concorrente(
      "update radar_pedidos set status='congelado' where id='94000000-0000-4000-a000-000000000002'",
      "delete from anuncios where id='99000000-0000-4000-a000-000000000001'")
    checked(sql("update radar_pedidos set status='aberto' where id::text like '94000000%';"))
    conferir_retencao_concorrente(
      "update anuncios set status='congelado' where id='99000000-0000-4000-a000-000000000002'",
      "delete from perfis where id='user_loja'")
    checked(sql("""do $$ begin
      assert (select count(*)=2 from radar_propostas where pedido_id::text like '94000000%'), 'Proposta congelada perdida';
      assert exists(select 1 from anuncios where id='99000000-0000-4000-a000-000000000001'), 'Referência da oferta congelada perdida';
      assert exists(select 1 from perfis where id='user_loja'), 'Cascata perdeu a conta com retenção';
    end $$;"""))
    print('PASS: congelamento concorrente preserva proposta, anúncio referenciado e cascata da conta', flush=True)
    checked(sql("""
      update configuracoes set valor='true' where chave='robo.ativo';
      insert into perfis(id,microrregiao_id,nome,cidade)
        select 'user_akiconcorrente', id, 'Loja Aki Concorrente', 'Corrente' from microrregioes where slug='corrente-pi';
      insert into vitrines_lojas(dono_id,microrregiao_id,nome,slug,cidade,tipo,plano,teste_expira_em)
        select id,microrregiao_id,nome,'loja-aki-concorrente',cidade,'loja','teste',now()+interval '30 days'
        from perfis where id='user_akiconcorrente';
    """))
    def reservar_arte(_):
        return sql("begin; select aki_reservar_imagem('user_akiconcorrente',gen_random_uuid(),'banner',null,null)->>'estado'; select pg_sleep(0.1); commit;")
    with ThreadPoolExecutor(max_workers=4) as pool:
        artes=list(pool.map(reservar_arte,range(4)))
    for result in artes: checked(result)
    assert sum('nova' in r.stdout for r in artes)==1 and sum('sem_credito' in r.stdout for r in artes)==3, [r.stdout for r in artes]
    print('PASS: quatro pedidos simultâneos do Aki disputam um único crédito', flush=True)
finally:
    run('docker','stop',container)
