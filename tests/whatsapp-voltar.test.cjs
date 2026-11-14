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

function mensagem({ texto = 'oi', conversa = `${NUMERO}@s.whatsapp.net`, fromMe = false, evento = 'messages.upsert', extendida = false } = {}) {
  const message = extendida ? { extendedTextMessage: { text: texto } } : { conversation: texto };
  return { event: evento, data: { key: { remoteJid: conversa, fromMe, id: 'MSG1' }, message } };
}

function rota(db) {
  const { POST } = carregar('src/app/api/whatsapp/evolution/route.ts', {
    'next/server': { NextResponse: { json: (corpo, init) => new Response(JSON.stringify(corpo), { status: init?.status ?? 200, headers: { 'content-type': 'application/json' } }) } },
    '@/lib/supabase/admin': { supabaseAdmin: () => db },
  });
  return POST;
}

const pedido = (corpo, cabecalho = `Bearer ${SEGREDO}`) => new Request('https://teste.local/api/whatsapp/evolution', {
  method: 'POST', headers: { authorization: cabecalho, 'content-type': 'application/json' }, body: JSON.stringify(corpo),
});

test('intenção: VOLTAR só com a frase inteira; SIM só com a palavra; o resto é outra mensagem', () => {
  for (const t of ['SAIR', 'pare por favor']) assert.equal(lib.intencaoDaMensagem(t), 'sair', t);
  for (const t of ['voltar', 'Voltar!', 'volta', 'quero voltar', 'ativar', 'ativa', 'reativar', 'quero receber', 'quero receber de novo',
    'voltar a receber', 'religar', 'Quero voltar, por favor', 'voltar, obrigado']) {
    assert.equal(lib.intencaoDaMensagem(t), 'voltar', t);
  }
  // "ligar" pode ser pedido de ligação: não volta sozinho, só como SIM (com pergunta pendente)
  for (const t of ['sim', 'SIM!', 's', 'Sim quero', 'pode', 'quero', 'sim, por favor', 'Sim obrigado', 'ligar', 'Ligar!']) {
    assert.equal(lib.intencaoDaMensagem(t), 'sim', t);
  }
  for (const t of ['sim, vou sim', 'não', 'nao', 'não quero', 'voltar amanhã na loja', 'vou voltar amanhã', 'quero voltar amanhã',
    'sim vou na loja hoje', 'pode me mandar o preço', 'voltar '.repeat(12), 'oi', 'quero um sofá', '', null, 42]) {
    assert.equal(lib.intencaoDaMensagem(t), 'outra', String(t));
  }
});

test('pedido de mensagem: pessoa com número legível; mensagem nossa, grupo, status e outros eventos não valem', () => {
  const hVoltar = lib.hashDaMensagem('voltar');
  assert.deepEqual(lib.pedidoDeMensagem(mensagem({ texto: 'voltar' })), { numero: NUMERO, intencao: 'voltar', hash: hVoltar });
  assert.deepEqual(lib.pedidoDeMensagem(mensagem({ texto: 'Sim', extendida: true })), { numero: NUMERO, intencao: 'sim', hash: lib.hashDaMensagem('Sim') });
  assert.deepEqual(lib.pedidoDeMensagem(mensagem({ texto: 'quero um sofá' })), { numero: NUMERO, intencao: 'outra', hash: lib.hashDaMensagem('quero um sofá') });
  assert.deepEqual(lib.pedidoDeMensagem(mensagem({ texto: 'SAIR' })), { numero: NUMERO, intencao: 'sair', comando: 'SAIR' });
  // Sem texto (foto, figurinha, reação) não é pedido: não chama o banco
  assert.equal(lib.pedidoDeMensagem({ event: 'messages.upsert', data: { key: { remoteJid: `${NUMERO}@s.whatsapp.net`, fromMe: false }, message: { imageMessage: {} } } }), null);
  assert.equal(lib.pedidoDeMensagem(mensagem({ texto: '   ' })), null);
  assert.equal(lib.pedidoDeMensagem({ event: 'messages.upsert', data: { key: { remoteJid: `${NUMERO}@s.whatsapp.net`, fromMe: false }, message: { reactionMessage: { text: '👍' } } } }), null);
  assert.equal(lib.pedidoDeMensagem(mensagem({ fromMe: true, texto: 'voltar' })), null);
  assert.equal(lib.pedidoDeMensagem(mensagem({ conversa: '120363000000000000@g.us', texto: 'voltar' })), null);
  assert.equal(lib.pedidoDeMensagem(mensagem({ conversa: 'status@broadcast', texto: 'voltar' })), null);
  assert.equal(lib.pedidoDeMensagem(mensagem({ evento: 'connection.update', texto: 'voltar' })), null);
  assert.equal(lib.pedidoDeMensagem(null), null);
});

test('resumo da mensagem: igual para o mesmo texto normalizado, diferente para outro texto, sempre 64 caracteres hexa', () => {
  assert.equal(lib.hashDaMensagem('Oi!'), lib.hashDaMensagem('oi'));
  assert.notEqual(lib.hashDaMensagem('oi'), lib.hashDaMensagem('tchau'));
  assert.match(lib.hashDaMensagem('oi'), /^[0-9a-f]{64}$/);
  assert.doesNotMatch(lib.hashDaMensagem('oi'), /oi/);
});

test('rota: VOLTAR, SIM e outra mensagem vão ao banco com a intenção e o resumo; SAIR continua em whatsapp_sair', async () => {
  const chamadas = [];
  const db = { rpc: async (...a) => { chamadas.push(a); return { data: 'nada', error: null }; } };
  const POST = rota(db);
  await comSegredo(SEGREDO, async () => {
    for (const texto of ['voltar', 'sim', 'quero um sofá', 'SAIR']) {
      assert.equal((await POST(pedido(mensagem({ texto }))).then((r) => r.status)), 200, texto);
    }
  });
  assert.deepEqual(chamadas, [
    ['whatsapp_mensagem_recebida', { p_numero: NUMERO, p_intencao: 'voltar', p_hash: lib.hashDaMensagem('voltar') }],
    ['whatsapp_mensagem_recebida', { p_numero: NUMERO, p_intencao: 'sim', p_hash: lib.hashDaMensagem('sim') }],
    ['whatsapp_mensagem_recebida', { p_numero: NUMERO, p_intencao: 'outra', p_hash: lib.hashDaMensagem('quero um sofá') }],
    ['whatsapp_sair', { p_numero: NUMERO, p_comando: 'SAIR' }],
  ]);
});

test('rota: mensagem nossa, de grupo ou de status não chega ao banco', async () => {
  const chamadas = [];
  const db = { rpc: async (...a) => { chamadas.push(a); return { data: null, error: null }; } };
  const POST = rota(db);
  await comSegredo(SEGREDO, async () => {
    for (const m of [
      mensagem({ texto: 'voltar', fromMe: true }),
      mensagem({ texto: 'voltar', conversa: '120363000000000000@g.us' }),
      mensagem({ texto: 'voltar', conversa: 'status@broadcast' }),
      mensagem({ texto: 'voltar', evento: 'connection.update' }),
      mensagem({ texto: '' }),
    ]) {
      const r = await POST(pedido(m));
      assert.equal(r.status, 200);
      assert.equal((await r.json()).ignorado, 'sem pedido');
    }
  });
  assert.equal(chamadas.length, 0);
});

test('rota: falha do banco na volta responde 503 e o log não traz número nem texto', async () => {
  const erros = [];
  const original = console.error;
  console.error = (...a) => erros.push(a.join(' '));
  try {
    const db = { rpc: async () => ({ data: null, error: { code: '22023', message: `falhou com ${NUMERO} e voltar` } }) };
    const POST = rota(db);
    await comSegredo(SEGREDO, async () => {
      assert.equal((await POST(pedido(mensagem({ texto: 'voltar' })))).status, 503);
    });
  } finally {
    console.error = original;
  }
  assert.equal(erros.length, 1);
  assert.doesNotMatch(erros[0], new RegExp(NUMERO));
  assert.doesNotMatch(erros[0], /voltar/);
});
