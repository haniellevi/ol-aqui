const { test } = require('node:test');
const assert = require('node:assert/strict');
const { carregar } = require('./carregar.cjs');
const fixture = require('./fixtures/receita-cnpj.json');
const mod = carregar('src/lib/verificacao-loja/receita.ts');

async function comFetch(impl, fn) {
  const antes = global.fetch;
  global.fetch = impl;
  try { return await fn(); } finally { global.fetch = antes; }
}
const json = (corpo, status = 200) => new Response(typeof corpo === 'string' ? corpo : JSON.stringify(corpo), { status });

test('lê a fixture da BrasilAPI e usa só os 14 dígitos na URL', async () => {
  let url, init;
  const r = await comFetch(async (u, i) => { url = String(u); init = i; return json(fixture); }, () => mod.consultarCnpj('12.345.678/0001-95'));
  assert.equal(url, 'https://brasilapi.com.br/api/cnpj/v1/12345678000195');
  assert.equal(init.redirect, 'error');
  assert.equal(init.cache, 'no-store');
  assert.ok(init.signal);
  // Sem identificação, o Cloudflare da BrasilAPI barra o fetch do Node (403/429).
  assert.match(init.headers['user-agent'], /^OLAKI\//);
  assert.equal(init.headers.accept, 'application/json');
  assert.equal(r.estado, 'ok');
  assert.equal(r.dados.situacao, 'ATIVA');
  assert.equal(r.dados.razaoSocial, fixture.razao_social);
  assert.equal(r.dados.fantasia, fixture.nome_fantasia);
  assert.deepEqual(r.dados.socios, fixture.qsa.map(s => s.nome_socio));
  assert.equal(r.dados.municipioIbge, 3550308);
  assert.equal(r.dados.cidade, 'SAO PAULO');
  assert.equal(r.dados.uf, 'SP');
  assert.equal(r.dados.logradouro, 'RUA DAS FLORES EXEMPLO');
  assert.equal(r.dados.abertura, '2019-03-12');
});

test('normaliza campos ausentes: situação string, sócios [], fantasia null, município null', async () => {
  const bruto = { ...fixture, nome_fantasia: '  ', qsa: null, codigo_municipio_ibge: null };
  delete bruto.descricao_situacao_cadastral;
  const r = await comFetch(async () => json(bruto), () => mod.consultarCnpj('12345678000195'));
  assert.equal(r.estado, 'ok');
  assert.equal(r.dados.situacao, '');
  assert.deepEqual(r.dados.socios, []);
  assert.equal(r.dados.fantasia, null);
  assert.equal(r.dados.municipioIbge, null);
  for (const v of [0, -1, '3550308', NaN]) {
    const x = await comFetch(async () => json({ ...fixture, codigo_municipio_ibge: v }), () => mod.consultarCnpj('12345678000195'));
    assert.equal(x.dados.municipioIbge, null, String(v));
  }
  const vazio = await comFetch(async () => json({ ...fixture, qsa: [] }), () => mod.consultarCnpj('12345678000195'));
  assert.deepEqual(vazio.dados.socios, []);
});

test('404 e 400 são não encontrada', async () => {
  for (const s of [404, 400]) {
    const r = await comFetch(async () => json({ message: 'x' }, s), () => mod.consultarCnpj('12345678000195'));
    assert.deepEqual(r, { estado: 'nao_encontrada' }, String(s));
  }
});

test('429, 5xx, rede, timeout, JSON quebrado e corpo gigante são fora do ar', async () => {
  const casos = {
    429: async () => json('x', 429),
    503: async () => json('x', 503),
    abort: async () => { const e = new Error('t'); e.name = 'AbortError'; throw e; },
    rede: async () => { throw new TypeError('fetch failed'); },
    json: async () => json('{quebrado'),
    gigante: async () => json('x'.repeat(100_001)),
    naoObjeto: async () => json('[]'),
  };
  for (const [nome, impl] of Object.entries(casos)) {
    const r = await comFetch(impl, () => mod.consultarCnpj('12345678000195'));
    assert.deepEqual(r, { estado: 'fora_do_ar' }, nome);
  }
});

test('CNPJ que não tem 14 dígitos nem chama a rede', async () => {
  let chamadas = 0;
  const r = await comFetch(async () => { chamadas++; return json(fixture); }, () => mod.consultarCnpj('123'));
  assert.deepEqual(r, { estado: 'nao_encontrada' });
  assert.equal(chamadas, 0);
});
