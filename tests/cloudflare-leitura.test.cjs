const test = require('node:test');
const assert = require('node:assert/strict');
const { carregar } = require('./carregar.cjs');

test('prévia encaminha apenas RPC revisada como POST anônimo, preservando nulos', async () => {
  const { criarFetchLeitura } = carregar('src/lib/supabase/leitura.ts');
  const chamadas = [];
  const consultar = criarFetchLeitura('https://exemplo.supabase.co', 'chave-publica', Date.now() + 60000, async (req) => {
    chamadas.push(req);
    return new Response('[]');
  });
  await consultar('https://exemplo.supabase.co/rest/v1/rpc/catalogo_anuncios?select=*', {
    method: 'POST', headers: { authorization: 'Bearer usuario', 'content-type': 'application/json' },
    body: JSON.stringify({ p_id: '123', p_filtro: null, p_ids: [1, 2] }),
  });
  assert.equal(chamadas.length, 1);
  const req = chamadas[0];
  assert.equal(req.method, 'POST');
  assert.equal(req.headers.get('authorization'), 'Bearer chave-publica');
  assert.equal(req.headers.get('apikey'), 'chave-publica');
  assert.deepEqual(await req.json(), { p_id: '123', p_filtro: null, p_ids: [1, 2] });
});

test('prévia recusa escrita, outro destino e payload RPC inválido sem chamar a rede', async () => {
  const { criarFetchLeitura } = carregar('src/lib/supabase/leitura.ts');
  let chamadas = 0;
  const consultar = criarFetchLeitura('https://exemplo.supabase.co', 'publica', Date.now() + 60000, async () => { chamadas++; return new Response(); });
  for (const [url, init] of [
    ['https://exemplo.supabase.co/rest/v1/tabela', { method: 'POST', body: '{}' }],
    ['https://exemplo.supabase.co/rest/v1/tabela', { method: 'PATCH', body: '{}' }],
    ['https://exemplo.supabase.co/storage/v1/object/bucket/foto', { method: 'DELETE' }],
    ['https://outro.example/rest/v1/tabela', { method: 'GET' }],
    ['https://exemplo.supabase.co/rest/v1/rpc/acao', { method: 'POST', body: '[1]' }],
    ['https://exemplo.supabase.co/rest/v1/rpc/registrar_visita', { method: 'POST', body: '{}' }],
    ['https://exemplo.supabase.co/rest/v1/rpc/registrar_visita', { method: 'GET' }],
  ]) await assert.rejects(consultar(url, init));
  assert.equal(chamadas, 0);
});

test('prévia expirada bloqueia a consulta antes de chamar a rede', async () => {
  const { criarFetchLeitura } = carregar('src/lib/supabase/leitura.ts');
  let chamadas = 0;
  const consultar = criarFetchLeitura('https://exemplo.supabase.co', 'publica', Date.now() - 1, async () => { chamadas++; return new Response(); });
  await assert.rejects(consultar('https://exemplo.supabase.co/rest/v1/tabela'));
  assert.equal(chamadas, 0);
});

test('prévia permite somente leitura REST e bloqueia logins e métodos de escrita', () => {
  const { permitePrevia } = carregar('src/lib/supabase/leitura.ts');
  for (const path of ['/', '/busca', '/termos', '/privacidade', '/anuncio/1', '/loja/teste', '/planos']) assert.equal(permitePrevia('GET', path), true);
  for (const [method, path] of [['POST', '/'], ['POST', '/api/visita'], ['GET', '/api/visita'], ['GET', '/entrar'], ['GET', '/minha-conta'], ['GET', '/admin']]) assert.equal(permitePrevia(method, path), false);
});
