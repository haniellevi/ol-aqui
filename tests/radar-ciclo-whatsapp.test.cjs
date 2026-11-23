const test = require('node:test');
const assert = require('node:assert/strict');
const { carregar } = require('./carregar.cjs');

const SEGREDO = 'segredo-de-teste-com-mais-de-32-caracteres';
const NUMERO_COMPRADOR = '5589999910001';
const NUMERO_LOJA = '5589999920002';
const PEDIDO_ID = '89800000-0000-4000-a000-000000000001';
const PROPOSTA_ID = '89800000-0000-4000-b000-000000000002';

test('fila WhatsApp: envia proposta_nova ao comprador e cancela proposta_escolhida se pedido fechou antes do envio', async () => {
  const envios = [];
  const resultados = [];
  const mod = carregar('src/app/api/interno/whatsapp-fila/route.ts', {
    'next/server': { NextResponse: { json: (corpo, init) => ({ corpo, status: init?.status ?? 200 }) } },
    'node:timers/promises': { setTimeout: async () => {} },
    '@/lib/moderacao-ia': { segredoModeracaoConfere: () => true },
    '@/lib/formato': { SITE: 'https://mercadodaregiao.test' },
    '@/lib/whatsapp/envio': {
      configuracaoEnvio: () => ({ url: 'https://w.test', chave: 'k', instancia: 'i' }),
      enviarTexto: async (numero, texto, _c, conferir) => {
        if (conferir && !(await conferir())) return 'recusado';
        envios.push({ numero, texto });
        return 'enviado';
      },
    },
    '@/lib/supabase/admin': {
      supabaseAdmin: () => ({
        rpc: async (nome, args) => {
          if (nome === 'whatsapp_fila_pegar') {
            return {
              data: [
                {
                  id: 'fila-prop-nova',
                  numero: NUMERO_COMPRADOR,
                  texto: 'Loja Centro mandou uma proposta no Radar do Mercado da Região para “Sofá”.',
                  link: `/radar/pedido/${PEDIDO_ID}`,
                },
                {
                  id: 'fila-prop-escolhida',
                  numero: NUMERO_LOJA,
                  texto: 'Mercado da Região: o comprador de “Sofá” escolheu a proposta da Loja Centro para conversar.',
                  link: `/radar/${PEDIDO_ID}`,
                },
              ],
              error: null,
            };
          }
          if (nome === 'whatsapp_fila_confirmar_envio') {
            return { data: args.p_id === 'fila-prop-escolhida' ? 'cancelada' : 'pode', error: null };
          }
          if (nome === 'whatsapp_fila_resultado') resultados.push(args);
          return { data: 'ok', error: null };
        },
      }),
    },
  });

  const resp = await mod.POST({ headers: { get: () => `Bearer ${SEGREDO}` } });
  assert.equal(resp.status, 200);
  assert.deepEqual(resp.corpo, {
    ok: true,
    enviadas: 1,
    falhas: 0,
    incertas: 0,
    erros_resultado: 0,
    devolvidas: 0,
    canceladas: 1,
  });
  assert.deepEqual(envios, [
    {
      numero: NUMERO_COMPRADOR,
      texto: `Loja Centro mandou uma proposta no Radar do Mercado da Região para “Sofá”. https://mercadodaregiao.test/radar/pedido/${PEDIDO_ID}`,
    },
  ]);
  assert.deepEqual(resultados, [{ p_id: 'fila-prop-nova', p_resultado: 'enviado' }]);
});

test('webhook Evolution: encaminha SAIR e VOLTAR de comprador ou lojista (inclusive @lid)', async () => {
  const chamadas = [];
  const antes = process.env.EVOLUTION_WEBHOOK_SEGREDO;
  process.env.EVOLUTION_WEBHOOK_SEGREDO = SEGREDO;
  try {
    const { POST } = carregar('src/app/api/whatsapp/evolution/route.ts', {
      'next/server': {
        NextResponse: {
          json: (corpo, init) => new Response(JSON.stringify(corpo), { status: init?.status ?? 200 }),
        },
      },
      '@/lib/supabase/admin': {
        supabaseAdmin: () => ({
          rpc: async (...args) => {
            chamadas.push(args);
            return { data: true, error: null };
          },
        }),
      },
    });

    const req = (key, text) =>
      new Request('https://teste.local/api/whatsapp/evolution', {
        method: 'POST',
        headers: { authorization: `Bearer ${SEGREDO}`, 'content-type': 'application/json' },
        body: JSON.stringify({ event: 'messages.upsert', data: { key: { ...key, fromMe: false }, message: { conversation: text } } }),
      });

    assert.equal((await POST(req({ remoteJid: '999999999@lid', remoteJidAlt: `${NUMERO_COMPRADOR}@s.whatsapp.net` }, 'SAIR'))).status, 200);
    assert.equal((await POST(req({ remoteJid: `${NUMERO_COMPRADOR}@s.whatsapp.net` }, 'VOLTAR'))).status, 200);
    assert.equal((await POST(req({ remoteJid: `${NUMERO_LOJA}@s.whatsapp.net` }, 'SIM'))).status, 200);
  } finally {
    if (antes === undefined) delete process.env.EVOLUTION_WEBHOOK_SEGREDO;
    else process.env.EVOLUTION_WEBHOOK_SEGREDO = antes;
  }

  assert.equal(chamadas.length, 3);
  assert.deepEqual(chamadas[0], ['whatsapp_sair', { p_numero: NUMERO_COMPRADOR, p_comando: 'SAIR' }]);
  assert.equal(chamadas[1][0], 'whatsapp_mensagem_recebida');
  assert.equal(chamadas[1][1].p_numero, NUMERO_COMPRADOR);
  assert.equal(chamadas[1][1].p_intencao, 'voltar');
  assert.equal(chamadas[2][0], 'whatsapp_mensagem_recebida');
  assert.equal(chamadas[2][1].p_numero, NUMERO_LOJA);
  assert.equal(chamadas[2][1].p_intencao, 'sim');
});

test('actions Radar: escolherProposta e fecharPedido chamam as RPCs corretas e revalidam caminhos do pedido', async () => {
  const chamadas = [];
  const actions = carregar('src/app/radar/actions.ts', {
    '@clerk/nextjs/server': { auth: async () => ({ userId: 'user_comprador' }), currentUser: async () => ({ id: 'user_comprador' }) },
    'next/cache': { revalidatePath: (...args) => chamadas.push(['cache', ...args]) },
    '@/lib/perfil': { sincronizarPerfil: async () => {} },
    '@/lib/dados/conta': {},
    '@/lib/dados/radar': {},
    '@/lib/supabase/admin': {},
    '@/lib/supabase/server': {
      createClient: async () => ({
        rpc: (nome, args) => {
          chamadas.push(['rpc', nome, args]);
          const res =
            nome === 'escolher_proposta'
              ? { data: { whatsapp: NUMERO_LOJA, mensagem: 'Olá, Loja Centro!' }, error: null }
              : { data: 'atendido', error: null };
          return { single: async () => res, then: (ok) => Promise.resolve(res).then(ok) };
        },
      }),
    },
  });

  const escolha = await actions.escolherProposta(PROPOSTA_ID);
  assert.equal(escolha.ok, true);
  assert.ok(escolha.linkWhatsapp.startsWith(`https://wa.me/${NUMERO_LOJA}?text=`));

  const fechado = await actions.fecharPedido(PEDIDO_ID, 'resolvido');
  assert.deepEqual(fechado, { ok: true, mensagem: 'Que bom! Pedido marcado como resolvido.' });

  assert.deepEqual(chamadas.find((c) => c[0] === 'rpc' && c[1] === 'escolher_proposta'), [
    'rpc',
    'escolher_proposta',
    { p_proposta_id: PROPOSTA_ID },
  ]);
  assert.deepEqual(chamadas.find((c) => c[0] === 'rpc' && c[1] === 'fechar_pedido_radar'), [
    'rpc',
    'fechar_pedido_radar',
    { p_pedido: PEDIDO_ID, p_motivo: 'resolvido' },
  ]);
});

test('preferência Radar WhatsApp: estado parcial de conta antiga permite desligar em 1 clique e action mapeia permissões', async () => {
  const fs = require('node:fs');
  const componente = fs.readFileSync(require.resolve('../src/components/conta/preferencia-whatsapp-radar.tsx'), 'utf8');
  assert.match(componente, /Receber avisos do Radar no WhatsApp/);
  assert.match(componente, /Ligado \(só pedidos\)/);
  assert.match(componente, /só os avisos de pedidos novos no WhatsApp/);
  assert.match(componente, /propostas novas/i);
  assert.match(componente, /proposta da loja escolhida/i);
  assert.match(componente, /SAIR/);

  const dadosRadar = carregar('src/lib/dados/radar.ts', {
    '@clerk/nextjs/server': { auth: async () => ({ userId: 'user_antiga' }) },
    '@/lib/dados/config': {},
    '@/lib/supabase/server': {
      createClient: async () => ({
        rpc: async () => ({ data: { ligado: true, parcial: true, confirmado: true, ativo: false }, error: null }),
      }),
    },
  });
  assert.deepEqual(await dadosRadar.minhaPreferenciaWhatsappRadar(), {
    ligado: true,
    parcial: true,
    confirmado: true,
    ativo: false,
  });

  const chamadas = [];
  const ambiente = (resultado, rpcError = null) => carregar('src/app/(conta)/minha-conta/notificacoes/actions.ts', {
    '@clerk/nextjs/server': { auth: async () => ({ userId: 'user_teste' }) },
    'next/cache': { revalidatePath: () => {} },
    '@/lib/supabase/server': {
      createClient: async () => ({
        rpc: async (...args) => {
          chamadas.push(args);
          return { data: resultado, error: rpcError };
        },
      }),
    },
  });

  const desligarParcial = await ambiente(false).salvarPreferenciaWhatsappRadar(false);
  assert.equal(desligarParcial.ok, true);
  assert.deepEqual(chamadas[0], ['salvar_preferencia_whatsapp_radar_completa', { p_ligado: false }]);

  const ok = await ambiente(true).salvarPreferenciaWhatsappRadar(true);
  assert.equal(ok.ok, true);
  assert.match(ok.mensagem, /Avisos do Radar por WhatsApp ligados/);
  assert.deepEqual(chamadas[1], ['salvar_preferencia_whatsapp_radar_completa', { p_ligado: true }]);

  const semTel = await ambiente(null, { code: '42501', message: 'Confirme' }).salvarPreferenciaWhatsappRadar(true);
  assert.equal(semTel.ok, false);
  assert.match(semTel.erro, /Confirme seu WhatsApp/);

  const pausado = await ambiente(null, { code: '55000', message: 'Indisponivel' }).salvarPreferenciaWhatsappRadar(true);
  assert.equal(pausado.ok, false);
  assert.match(pausado.erro, /ainda não está disponível/);
});
