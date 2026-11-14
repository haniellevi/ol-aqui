const test = require('node:test');
const assert = require('node:assert/strict');
const { carregar } = require('./carregar.cjs');

const SEGREDO = 'segredo-de-teste-com-mais-de-32-caracteres';
const NUMERO = '5589999950002';
const lib = carregar('src/lib/whatsapp/evolution.ts');

async function comSegredo(valor, fn) {
  const antes = process.env.EVOLUTION_WEBHOOK_SEGREDO;
  try {
    if (valor === undefined) delete process.env.EVOLUTION_WEBHOOK_SEGREDO;
    else process.env.EVOLUTION_WEBHOOK_SEGREDO = valor;
    return await fn();
  } finally {
    if (antes === undefined) delete process.env.EVOLUTION_WEBHOOK_SEGREDO;
    else process.env.EVOLUTION_WEBHOOK_SEGREDO = antes;
  }
}

function mensagem({ texto = 'SAIR', conversa = `${NUMERO}@s.whatsapp.net`, fromMe = false, evento = 'messages.upsert', extendida = false } = {}) {
  const message = extendida ? { extendedTextMessage: { text: texto } } : { conversation: texto };
  return { event: evento, data: { key: { remoteJid: conversa, fromMe, id: 'MSG1' }, message } };
}

test('segredo: sem valor ou curto demais, o webhook não aceita nada', async () => {
  assert.equal(await comSegredo(undefined, () => lib.segredoEvolution()), null);
  assert.equal(await comSegredo('curto', () => lib.segredoEvolution()), null);
  assert.equal(await comSegredo(`  ${SEGREDO}  `, () => lib.segredoEvolution()), SEGREDO);
});

test('cabeçalho: só o segredo exato entra; sem segredo configurado nada passa', () => {
  assert.equal(lib.cabecalhoEvolutionConfere(`Bearer ${SEGREDO}`, SEGREDO), true);
  assert.equal(lib.cabecalhoEvolutionConfere(`Bearer ${SEGREDO}x`, SEGREDO), false);
  assert.equal(lib.cabecalhoEvolutionConfere(SEGREDO, SEGREDO), false);
  assert.equal(lib.cabecalhoEvolutionConfere(null, SEGREDO), false);
  assert.equal(lib.cabecalhoEvolutionConfere(`Bearer ${SEGREDO}`, null), false);
});

test('SAIR, PARAR, STOP e CANCELAR valem sem acento e sem caixa; outras palavras não', () => {
  for (const t of ['SAIR', 'sair', ' Sáir! ', 'parar', 'Stop.', 'cancelar', 'CANCELÁR']) assert.notEqual(lib.comandoDeSaida(t), null, t);
  assert.equal(lib.comandoDeSaida('sair')?.toString(), 'SAIR');
  for (const t of ['quero sair daqui', 'oi', 'SAIRR', '', null, 42, 'x'.repeat(41)]) assert.equal(lib.comandoDeSaida(t), null, String(t));
});

test('número: só conversa de pessoa com celular brasileiro', () => {
  assert.equal(lib.numeroDoRemetente(`${NUMERO}@s.whatsapp.net`), NUMERO);
  assert.equal(lib.numeroDoRemetente('120363000000000000@g.us'), null);
  assert.equal(lib.numeroDoRemetente('5589999950002@lid'), null);
  assert.equal(lib.numeroDoRemetente('1589999950002@s.whatsapp.net'), null);
  assert.equal(lib.numeroDoRemetente(undefined), null);
});

test('evento: só mensagem recebida; mensagem nossa e outros eventos não valem', () => {
  assert.deepEqual(lib.pedidoDeSaida(mensagem()), { numero: NUMERO, comando: 'SAIR' });
  assert.deepEqual(lib.pedidoDeSaida(mensagem({ evento: 'MESSAGES_UPSERT', extendida: true, texto: 'parar' })), { numero: NUMERO, comando: 'PARAR' });
  assert.equal(lib.pedidoDeSaida(mensagem({ fromMe: true })), null);
  assert.equal(lib.pedidoDeSaida(mensagem({ evento: 'connection.update' })), null);
  assert.equal(lib.pedidoDeSaida(mensagem({ texto: 'oi' })), null);
  assert.equal(lib.pedidoDeSaida(null), null);
});

function rota(db) {
  const { POST } = carregar('src/app/api/whatsapp/evolution/route.ts', {
    'next/server': { NextResponse: { json: (corpo, init) => new Response(JSON.stringify(corpo), { status: init?.status ?? 200, headers: { 'content-type': 'application/json' } }) } },
    '@/lib/supabase/admin': { supabaseAdmin: () => {
      if (db === 'sem-chave') throw new Error('Falta SUPABASE_SECRET_KEY no servidor.');
      return db;
    } },
  });
  return POST;
}
const pedido = (corpo, cabecalho = `Bearer ${SEGREDO}`) => new Request('https://teste.local/api/whatsapp/evolution', {
  method: 'POST', headers: cabecalho ? { authorization: cabecalho, 'content-type': 'application/json' } : { 'content-type': 'application/json' }, body: JSON.stringify(corpo),
});

test('rota: 503 sem segredo, 401 com cabeçalho errado e nada chega ao banco', async () => {
  const chamadas = [];
  const db = { rpc: async (...a) => { chamadas.push(a); return { data: true, error: null }; } };
  const POST = rota(db);
  await comSegredo(undefined, async () => {
    assert.equal((await POST(pedido(mensagem(), `Bearer ${SEGREDO}`))).status, 503);
  });
  await comSegredo(SEGREDO, async () => {
    assert.equal((await POST(pedido(mensagem(), 'Bearer errado'))).status, 401);
    assert.equal((await POST(pedido(mensagem(), null))).status, 401);
  });
  assert.equal(chamadas.length, 0);
});

test('rota: SAIR com segredo certo chega ao banco com número e comando, e nada é registrado no log', async () => {
  const chamadas = [];
  const erros = [];
  const original = console.error;
  console.error = (...a) => erros.push(a);
  try {
    const db = { rpc: async (...a) => { chamadas.push(a); return { data: true, error: null }; } };
    const POST = rota(db);
    await comSegredo(SEGREDO, async () => {
      const r = await POST(pedido(mensagem({ texto: 'Sair' })));
      assert.equal(r.status, 200);
      const ignorada = await POST(pedido(mensagem({ texto: 'quero um sofá' })));
      assert.equal(ignorada.status, 200);
      assert.equal((await ignorada.json()).ignorado, 'sem pedido');
    });
  } finally {
    console.error = original;
  }
  assert.deepEqual(chamadas, [['whatsapp_sair', { p_numero: NUMERO, p_comando: 'SAIR' }]]);
  assert.equal(erros.length, 0);
});

test('rota: falha do banco responde 503 com só o código do erro, sem texto nem número', async () => {
  const erros = [];
  const original = console.error;
  console.error = (...a) => erros.push(a.join(' '));
  try {
    const db = { rpc: async () => ({ data: null, error: { code: '42501', message: `falhou com ${NUMERO}` } }) };
    const POST = rota(db);
    await comSegredo(SEGREDO, async () => {
      const r = await POST(pedido(mensagem()));
      assert.equal(r.status, 503);
    });
  } finally {
    console.error = original;
  }
  assert.equal(erros.length, 1);
  assert.doesNotMatch(erros[0], new RegExp(NUMERO));
  assert.doesNotMatch(erros[0], /falhou/);
});
