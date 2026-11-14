const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { carregar } = require('./carregar.cjs');

const env = { EVOLUTION_URL: 'https://whatsapp.exemplo.test', EVOLUTION_API_KEY: 'segredo-api', EVOLUTION_INSTANCE: 'olaki' };
const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
  for (const k of [...Object.keys(env), 'WHATSAPP_OTP_SECRET', 'TURNSTILE_SECRET_KEY', 'NEXT_PUBLIC_TURNSTILE_SITE_KEY', 'TURNSTILE_HOSTNAMES']) delete process.env[k];
});
function envio() { Object.assign(process.env, env); return carregar('src/lib/whatsapp/envio.ts'); }

test('configuração de envio funciona sem as chaves do Turnstile e do código', () => {
  const e = envio();
  assert.deepEqual(e.configuracaoEnvio(), { url: 'https://whatsapp.exemplo.test', chave: 'segredo-api', instancia: 'olaki' });
  process.env.EVOLUTION_URL = 'https://whatsapp.exemplo.test/';
  assert.equal(e.configuracaoEnvio().url, 'https://whatsapp.exemplo.test');
});

test('configuração de envio lança sem Evolution, sem https ou com instância/URL estranha', () => {
  const e = envio();
  for (const k of Object.keys(env)) {
    const antes = process.env[k]; delete process.env[k];
    assert.throws(() => e.configuracaoEnvio(), /Envio indisponível\./, k);
    process.env[k] = antes;
  }
  for (const [k, v] of [['EVOLUTION_URL', 'http://server.test'], ['EVOLUTION_URL', 'https://user:senha@server.test'], ['EVOLUTION_URL', 'https://server.test?x=1'],
    ['EVOLUTION_URL', 'nao e url'], ['EVOLUTION_INSTANCE', '../outro'], ['EVOLUTION_INSTANCE', 'a'.repeat(81)]]) {
    const antes = process.env[k]; process.env[k] = v;
    assert.throws(() => e.configuracaoEnvio(), /Envio indisponível\./, `${k}=${v}`);
    process.env[k] = antes;
  }
});

test('instância fechada não envia: falha (pode tentar de novo)', async () => {
  const e = envio(), c = e.configuracaoEnvio(); let chamadas = 0;
  global.fetch = async () => { chamadas++; return { ok: true, json: async () => ({ instance: { state: 'close' } }) }; };
  assert.equal(await e.enviarTexto('5585999990001', 'oi', c), 'falha');
  assert.equal(chamadas, 1);
  global.fetch = async () => { throw Error('rede'); };
  assert.equal(await e.enviarTexto('5585999990001', 'oi', c), 'falha');
  global.fetch = async () => ({ ok: false, status: 502, json: async () => ({}) });
  assert.equal(await e.enviarTexto('5585999990001', 'oi', c), 'falha');
});

test('5xx, timeout ou resposta sem key.fromMe é incerto; 4xx é falha', async () => {
  const e = envio(), c = e.configuracaoEnvio();
  const aberto = { ok: true, json: async () => ({ instance: { state: 'open' } }) };
  for (const [resposta, esperado] of [
    [{ ok: false, status: 500, json: async () => ({}) }, 'incerto'],
    [{ ok: false, status: 503, json: async () => ({}) }, 'incerto'],
    [{ ok: false, status: 400, json: async () => ({}) }, 'falha'],
    [{ ok: false, status: 404, json: async () => ({}) }, 'falha'],
    [{ ok: true, json: async () => ({}) }, 'incerto'],
    [{ ok: true, json: async () => ({ key: { id: 'm', fromMe: false } }) }, 'incerto'],
    [{ ok: true, json: async () => ({ key: { fromMe: true } }) }, 'incerto'],
    [{ ok: true, json: async () => ({ error: true, key: { id: 'm', fromMe: true } }) }, 'incerto'],
  ]) {
    global.fetch = async (url) => (url.includes('connectionState') ? aberto : resposta);
    assert.equal(await e.enviarTexto('5585999990001', 'oi', c), esperado);
  }
  global.fetch = async (url) => { if (url.includes('connectionState')) return aberto; throw Error('timeout'); };
  assert.equal(await e.enviarTexto('5585999990001', 'oi', c), 'incerto');
});

test('sucesso: envia o texto e o número certos, sem seguir redirecionamento, e confirma a mensagem de saída', async () => {
  const e = envio(), c = e.configuracaoEnvio(); const chamadas = [];
  global.fetch = async (url, op) => {
    chamadas.push([url, op]);
    return { ok: true, json: async () => (url.includes('connectionState') ? { instance: { state: 'open' } } : { key: { id: 'abc', fromMe: true } }) };
  };
  assert.equal(await e.enviarTexto('5585999990001', 'Sua loja foi verificada https://exemplo.test/x', c), 'enviado');
  assert.equal(chamadas.length, 2);
  assert.ok(chamadas[1][0].endsWith('/message/sendText/olaki'));
  const corpo = JSON.parse(chamadas[1][1].body);
  assert.equal(corpo.number, '5585999990001');
  assert.equal(corpo.text, 'Sua loja foi verificada https://exemplo.test/x');
  assert.equal(chamadas[1][1].redirect, 'error');
  assert.equal(chamadas[1][1].headers.apikey, 'segredo-api');
});

// --- Rota ---
function rota({ segredoOk = true, linhas = [], resultados = [], configurar = true, pegarErro = false, decisoes = {} } = {}) {
  const estado = { pausas: [], envios: [], rpcs: [], ordem: [] };
  const fila = [...resultados];
  const mod = carregar('src/app/api/interno/whatsapp-fila/route.ts', {
    'next/server': { NextResponse: { json: (corpo, init) => ({ corpo, status: init?.status ?? 200 }) } },
    'node:timers/promises': { setTimeout: async (ms) => { estado.pausas.push(ms); estado.ordem.push('pausa'); } },
    '@/lib/moderacao-ia': { segredoModeracaoConfere: () => segredoOk },
    '@/lib/formato': { SITE: 'https://site.exemplo.test' },
    '@/lib/whatsapp/envio': {
      configuracaoEnvio: () => { if (!configurar) throw Error('Envio indisponível.'); return { url: 'https://w.test', chave: 'k', instancia: 'i' }; },
      enviarTexto: async (numero, texto) => { estado.envios.push([numero, texto]); estado.ordem.push('envio'); return fila.shift() ?? 'enviado'; },
    },
    '@/lib/supabase/admin': {
      supabaseAdmin: () => ({
        rpc: async (nome, args) => {
          estado.rpcs.push([nome, args]);
          if (nome === 'whatsapp_fila_pegar') return pegarErro ? { data: null, error: { message: 'x' } } : { data: linhas, error: null };
          if (nome === 'whatsapp_fila_confirmar_envio') {
            estado.ordem.push('confirma');
            return { data: Object.hasOwn(decisoes, args.p_id) ? decisoes[args.p_id] : 'pode', error: null };
          }
          return { data: 'ok', error: null };
        },
      }),
    },
  });
  return { mod, estado };
}
const linha = (n, extra = {}) => ({ id: `id-${n}`, numero: `558599999000${n}`, texto: `Mensagem ${n}`, link: '/minha-conta/loja/verificar', ...extra });
const req = { headers: { get: () => 'Bearer x' } };

test('rota: 401 sem segredo e nada é tocado', async () => {
  const { mod, estado } = rota({ segredoOk: false, linhas: [linha(1)] });
  assert.equal(mod.maxDuration, 60);
  assert.equal(mod.dynamic, 'force-dynamic');
  const r = await mod.POST({ headers: { get: () => null } });
  assert.equal(r.status, 401);
  assert.equal(estado.rpcs.length, 0);
  assert.equal(estado.envios.length, 0);
});

test('rota: envia uma por vez, com 1,5 s entre as mensagens, e acrescenta o endereço do site ao link', async () => {
  const { mod, estado } = rota({ linhas: [linha(1), linha(2, { link: null }), linha(3)] });
  const r = await mod.POST(req);
  assert.equal(r.status, 200);
  assert.deepEqual(r.corpo, { ok: true, enviadas: 3, falhas: 0, incertas: 0, erros_resultado: 0, devolvidas: 0, canceladas: 0 });
  assert.deepEqual(estado.pausas, [1500, 1500]);
  assert.deepEqual(estado.ordem, ['confirma', 'envio', 'pausa', 'confirma', 'envio', 'pausa', 'confirma', 'envio']);
  assert.deepEqual(estado.envios.map((e) => e[1]), ['Mensagem 1 https://site.exemplo.test/minha-conta/loja/verificar', 'Mensagem 2', 'Mensagem 3 https://site.exemplo.test/minha-conta/loja/verificar']);
  const pegar = estado.rpcs.find((c) => c[0] === 'whatsapp_fila_pegar');
  assert.deepEqual(pegar[1], { p_limite: 5 });
  assert.deepEqual(estado.rpcs.filter((c) => c[0] === 'whatsapp_fila_resultado').map((c) => c[1]),
    [1, 2, 3].map((n) => ({ p_id: `id-${n}`, p_resultado: 'enviado' })));
});

test('rota: nunca passa de 5 por rodada', async () => {
  const { mod, estado } = rota({ linhas: [1, 2, 3, 4, 5, 6, 7].map((n) => linha(n)) });
  await mod.POST(req);
  assert.equal(estado.envios.length, 5);
  assert.equal(estado.pausas.length, 4);
});

test('rota: incerto não volta para a fila; falha devolve "falha" ao banco, que decide as 3 tentativas', async () => {
  const { mod, estado } = rota({ linhas: [linha(1), linha(2), linha(3)], resultados: ['incerto', 'falha', 'enviado'] });
  const r = await mod.POST(req);
  assert.deepEqual(r.corpo, { ok: true, enviadas: 1, falhas: 1, incertas: 1, erros_resultado: 0, devolvidas: 0, canceladas: 0 });
  assert.equal(estado.envios.length, 3); // cada linha foi enviada uma única vez nesta rodada
  assert.deepEqual(estado.rpcs.filter((c) => c[0] === 'whatsapp_fila_resultado').map((c) => c[1].p_resultado), ['incerto', 'falha', 'enviado']);
  // Três rodadas com falha: a rota só repassa o resultado; as 3 tentativas e o "falha" final estão em whatsapp_fila_resultado (testado em 730).
  for (let i = 0; i < 3; i++) {
    const { mod: m, estado: e } = rota({ linhas: [linha(1)], resultados: ['falha'] });
    assert.deepEqual((await m.POST(req)).corpo, { ok: true, enviadas: 0, falhas: 1, incertas: 0, erros_resultado: 0, devolvidas: 0, canceladas: 0 });
    assert.equal(e.rpcs.filter((c) => c[0] === 'whatsapp_fila_resultado')[0][1].p_resultado, 'falha');
  }
});

test('rota: erro ao enviar vira incerto (nunca repete) e o resto da rodada segue', async () => {
  const { mod, estado } = rota({ linhas: [linha(1), linha(2)] });
  let n = 0;
  const mocks = {
    'next/server': { NextResponse: { json: (corpo, init) => ({ corpo, status: init?.status ?? 200 }) } },
    'node:timers/promises': { setTimeout: async () => {} },
    '@/lib/moderacao-ia': { segredoModeracaoConfere: () => true },
    '@/lib/formato': { SITE: 'https://site.exemplo.test' },
    '@/lib/whatsapp/envio': { configuracaoEnvio: () => ({}), enviarTexto: async () => { if (n++ === 0) throw Error('boom'); return 'enviado'; } },
    '@/lib/supabase/admin': { supabaseAdmin: () => ({ rpc: async (nome, args) => { estado.rpcs.push([nome, args]); return nome === 'whatsapp_fila_pegar' ? { data: [linha(1), linha(2)], error: null } : nome === 'whatsapp_fila_confirmar_envio' ? { data: 'pode', error: null } : { data: 'ok', error: null }; } }) },
  };
  estado.rpcs.length = 0;
  const r = await carregar('src/app/api/interno/whatsapp-fila/route.ts', mocks).POST(req);
  assert.deepEqual(r.corpo, { ok: true, enviadas: 1, falhas: 0, incertas: 1, erros_resultado: 0, devolvidas: 0, canceladas: 0 });
  assert.deepEqual(estado.rpcs.filter((c) => c[0] === 'whatsapp_fila_resultado').map((c) => c[1].p_resultado), ['incerto', 'enviado']);
  assert.ok(mod);
});

test('rota: sem configuração do Evolution ou com erro no banco, responde 503 sem pegar nem enviar nada', async () => {
  const a = rota({ configurar: false, linhas: [linha(1)] });
  assert.equal((await a.mod.POST(req)).status, 503);
  assert.equal(a.estado.rpcs.length, 0);
  assert.equal(a.estado.envios.length, 0);
  const b = rota({ pegarErro: true });
  assert.equal((await b.mod.POST(req)).status, 503);
  assert.equal(b.estado.envios.length, 0);
});

test('rota: passou do prazo, devolve à fila o que não foi tentado e não começa envio novo', async () => {
  const { mod, estado } = rota({ linhas: [linha(1), linha(2), linha(3), linha(4)] });
  const agora = Date.now;
  let relogio = 1_000_000;
  Date.now = () => relogio;
  const pausaOriginal = estado.pausas;
  // Cada envio "demora" 30 s: depois do 2º já passou de 45 s.
  const mocks = {};
  try {
    const m = carregar('src/app/api/interno/whatsapp-fila/route.ts', {
      'next/server': { NextResponse: { json: (corpo, init) => ({ corpo, status: init?.status ?? 200 }) } },
      'node:timers/promises': { setTimeout: async () => {} },
      '@/lib/moderacao-ia': { segredoModeracaoConfere: () => true },
      '@/lib/formato': { SITE: 'https://site.exemplo.test' },
      '@/lib/whatsapp/envio': { configuracaoEnvio: () => ({}), enviarTexto: async (numero) => { estado.envios.push([numero]); relogio += 30000; return 'enviado'; } },
      '@/lib/supabase/admin': { supabaseAdmin: () => ({ rpc: async (nome, args) => {
        estado.rpcs.push([nome, args]);
        if (nome === 'whatsapp_fila_pegar') return { data: [linha(1), linha(2), linha(3), linha(4)], error: null };
        if (nome === 'whatsapp_fila_devolver') return { data: args.p_ids.length, error: null };
        if (nome === 'whatsapp_fila_confirmar_envio') return { data: 'pode', error: null };
        return { data: 'ok', error: null };
      } }) },
    });
    const r = await m.POST(req);
    assert.deepEqual(r.corpo, { ok: true, enviadas: 2, falhas: 0, incertas: 0, erros_resultado: 0, devolvidas: 2, canceladas: 0 });
  } finally { Date.now = agora; }
  assert.equal(estado.envios.length, 2);
  const devolver = estado.rpcs.filter((c) => c[0] === 'whatsapp_fila_devolver');
  assert.equal(devolver.length, 1);
  assert.deepEqual(devolver[0][1], { p_ids: ['id-3', 'id-4'] });
  assert.deepEqual(estado.rpcs.filter((c) => c[0] === 'whatsapp_fila_resultado').map((c) => c[1].p_id), ['id-1', 'id-2']);
  assert.ok(mod && mocks && pausaOriginal);
});

test('rota: dentro do prazo não devolve nada', async () => {
  const { mod, estado } = rota({ linhas: [linha(1), linha(2)] });
  await mod.POST(req);
  assert.equal(estado.rpcs.filter((c) => c[0] === 'whatsapp_fila_devolver').length, 0);
});

test('rota: erro ao gravar o resultado (supabase-js devolve { error }) é registrado e contado, sem vazar dados', async () => {
  const logs = [];
  const original = console.error;
  console.error = (...a) => logs.push(a.join(' '));
  try {
    const m = carregar('src/app/api/interno/whatsapp-fila/route.ts', {
      'next/server': { NextResponse: { json: (corpo, init) => ({ corpo, status: init?.status ?? 200 }) } },
      'node:timers/promises': { setTimeout: async () => {} },
      '@/lib/moderacao-ia': { segredoModeracaoConfere: () => true },
      '@/lib/formato': { SITE: 'https://site.exemplo.test' },
      '@/lib/whatsapp/envio': { configuracaoEnvio: () => ({}), enviarTexto: async () => 'enviado' },
      '@/lib/supabase/admin': { supabaseAdmin: () => ({ rpc: async (nome, args) => (nome === 'whatsapp_fila_pegar'
        ? { data: [linha(1), linha(2)], error: null }
        : nome === 'whatsapp_fila_confirmar_envio' ? { data: 'pode', error: null }
        : args.p_id === 'id-1' ? { data: null, error: { message: 'falhou 5585999990001' } } : { data: 'ok', error: null }) }) },
    });
    const r = await m.POST(req);
    assert.equal(r.status, 200);
    assert.deepEqual(r.corpo, { ok: true, enviadas: 2, falhas: 0, incertas: 0, erros_resultado: 1, devolvidas: 0, canceladas: 0 });
  } finally { console.error = original; }
  assert.equal(logs.length, 1);
  assert.ok(!/\d{8}|falhou/.test(logs[0]));
});

test('rota: confere cada mensagem logo antes de enviar, uma por vez', async () => {
  const { mod, estado } = rota({ linhas: [linha(1), linha(2)] });
  await mod.POST(req);
  assert.deepEqual(estado.ordem, ['confirma', 'envio', 'pausa', 'confirma', 'envio']);
  assert.deepEqual(estado.rpcs.filter((c) => c[0] === 'whatsapp_fila_confirmar_envio').map((c) => c[1]), [{ p_id: 'id-1' }, { p_id: 'id-2' }]);
});

test('rota: mensagem cancelada pelo banco (SAIR, preferência, pedido fechado) não é enviada e não grava resultado', async () => {
  const { mod, estado } = rota({ linhas: [linha(1), linha(2)], decisoes: { 'id-1': 'cancelada' } });
  const r = await mod.POST(req);
  assert.deepEqual(r.corpo, { ok: true, enviadas: 1, falhas: 0, incertas: 0, erros_resultado: 0, devolvidas: 0, canceladas: 1 });
  assert.deepEqual(estado.envios.map((e) => e[0]), ['5585999990002']);
  assert.deepEqual(estado.rpcs.filter((c) => c[0] === 'whatsapp_fila_resultado').map((c) => c[1].p_id), ['id-2']);
});

test('rota: linha que já não está "enviando" é pulada sem contar e sem gravar nada', async () => {
  const { mod, estado } = rota({ linhas: [linha(1)], decisoes: { 'id-1': 'ignorada' } });
  const r = await mod.POST(req);
  assert.deepEqual(r.corpo, { ok: true, enviadas: 0, falhas: 0, incertas: 0, erros_resultado: 0, devolvidas: 0, canceladas: 0 });
  assert.equal(estado.envios.length, 0);
  assert.equal(estado.rpcs.filter((c) => c[0] === 'whatsapp_fila_resultado').length, 0);
});

test('rota: se a conferência falha (erro do banco ou resposta fora de "pode"), não envia e volta como falha', async () => {
  for (const decisao of [null, 'qualquer']) {
    const { mod, estado } = rota({ linhas: [linha(1)], decisoes: { 'id-1': decisao } });
    const r = await mod.POST(req);
    assert.deepEqual(r.corpo, { ok: true, enviadas: 0, falhas: 1, incertas: 0, erros_resultado: 0, devolvidas: 0, canceladas: 0 });
    assert.equal(estado.envios.length, 0, String(decisao));
    assert.deepEqual(estado.rpcs.filter((c) => c[0] === 'whatsapp_fila_resultado').map((c) => c[1].p_resultado), ['falha']);
  }
});
