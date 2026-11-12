const { test } = require('node:test');
const assert = require('node:assert/strict');
const { carregar } = require('./carregar.cjs');
const termos = carregar('src/lib/metricas/termos.ts');
const aparicoes = carregar('src/lib/metricas/aparicoes.ts');
const { normalizarTermo, termoDaBusca, montarBuscaAberta, termoDaAberturaRecente, TEMPO_ABERTURA_MS } = termos;
const { validarAparicoes, ehBot, MAXIMO_APARICOES_POR_ENVIO } = aparicoes;
const SITE = 'https://mercadodaregiao.com.br';
const ID1 = '54100000-0000-4000-a000-000000000001';
const ID2 = '54100000-0000-4000-a000-000000000002';

// Os mesmos casos de supabase/testes/540_metricas_anuncios.sql (public.normaliza_termo).
test('termo: mesma forma do banco (minúsculas, sem acento, espaços e sinais limpos)', () => {
  assert.equal(normalizarTermo('  Ação  Ótima! 2 x '), 'acao otima 2 x');
  assert.equal(normalizarTermo(' Geladeira  Brastemp! '), 'geladeira brastemp');
  assert.equal(normalizarTermo('Refrigerador Ação'), 'refrigerador acao');
  assert.equal(normalizarTermo('Sofá & Cama, 2 lugares'), 'sofa cama 2 lugares');
});

test('termo vazio, sem letras ou que não é texto vira null', () => {
  assert.equal(normalizarTermo('!!!'), null);
  assert.equal(normalizarTermo('   '), null);
  assert.equal(normalizarTermo(''), null);
  assert.equal(normalizarTermo(null), null);
  assert.equal(normalizarTermo(undefined), null);
  assert.equal(normalizarTermo(123), null);
});

test('termo para em 60 letras, sem espaço sobrando no fim', () => {
  const longo = normalizarTermo('ab '.repeat(40));
  assert.ok(longo.length <= 60);
  assert.equal(longo, longo.trim());
  assert.equal(normalizarTermo('a'.repeat(100)).length, 60);
});

test('termo da busca vem só da busca deste site, com a palavra em ?q=', () => {
  assert.equal(termoDaBusca(`${SITE}/busca?q=Geladeira%20Brastemp`, SITE), 'geladeira brastemp');
  assert.equal(termoDaBusca(`${SITE}/busca?q=sof%C3%A1&categoria=moveis`, SITE), 'sofa');
  assert.equal(termoDaBusca('https://outro-site.com/busca?q=geladeira', SITE), null);
  assert.equal(termoDaBusca(`${SITE}/categoria?q=geladeira`, SITE), null);
  assert.equal(termoDaBusca(`${SITE}/busca`, SITE), null);
  assert.equal(termoDaBusca(`${SITE}/busca?q=`, SITE), null);
  assert.equal(termoDaBusca('', SITE), null);
  assert.equal(termoDaBusca(null, SITE), null);
  assert.equal(termoDaBusca('não é endereço', SITE), null);
});

test('marca do clique na busca vale só para o mesmo anúncio e por pouco tempo', () => {
  const agora = 1_000_000;
  const caminho = '/anuncio/geladeira-brastemp-k3x-a1b2';
  const marca = montarBuscaAberta('geladeira brastemp', caminho, agora);
  assert.equal(termoDaAberturaRecente(marca, caminho, agora + 5_000), 'geladeira brastemp');
  assert.equal(termoDaAberturaRecente(marca, '/anuncio/outro-0000', agora + 5_000), null);
  assert.equal(termoDaAberturaRecente(marca, caminho, agora + TEMPO_ABERTURA_MS + 1), null);
  assert.equal(termoDaAberturaRecente(marca, caminho, agora - 1), null);
});

test('marca guardada fora do formato é ignorada', () => {
  const caminho = '/anuncio/x-0000';
  assert.equal(termoDaAberturaRecente(null, caminho, 1), null);
  assert.equal(termoDaAberturaRecente('', caminho, 1), null);
  assert.equal(termoDaAberturaRecente('{nao-json', caminho, 1), null);
  assert.equal(termoDaAberturaRecente('"texto"', caminho, 1), null);
  assert.equal(termoDaAberturaRecente(JSON.stringify({ termo: 5, caminho, quando: 1 }), caminho, 1), null);
  assert.equal(termoDaAberturaRecente(JSON.stringify({ termo: 'sofa', caminho, quando: 'hoje' }), caminho, 1), null);
  assert.equal(termoDaAberturaRecente(JSON.stringify({ termo: '!!!', caminho, quando: 1 }), caminho, 1), null);
});

test('aparições: posição é a ordem na tela, ids inválidos ficam de fora e o id vira minúsculo', () => {
  const r = validarAparicoes('busca', ['nao-e-id', ID1, ID2.toUpperCase()]);
  assert.deepEqual(r, { pagina: 'busca', itens: [{ id: ID1, posicao: 2 }, { id: ID2, posicao: 3 }] });
});

test('aparições: página desconhecida, lista vazia ou que não é lista não contam', () => {
  assert.equal(validarAparicoes('xxx', [ID1]), null);
  assert.equal(validarAparicoes(undefined, [ID1]), null);
  assert.equal(validarAparicoes('busca', [ID1.replace(/-/g, '')]), null);
  assert.equal(validarAparicoes('busca', []), null);
  assert.equal(validarAparicoes('busca', 'x'), null);
  assert.equal(validarAparicoes('busca', null), null);
});

test('aparições: no máximo 60 por envio', () => {
  const muitos = Array.from({ length: 61 }, () => ID1);
  const r = validarAparicoes('loja', muitos);
  assert.equal(MAXIMO_APARICOES_POR_ENVIO, 60);
  assert.equal(r.itens.length, 60);
  assert.equal(r.itens[59].posicao, 60);
});

test('bot ou navegador sem identificação não conta', () => {
  assert.equal(ehBot('Googlebot/2.1 (+http://www.google.com/bot.html)'), true);
  assert.equal(ehBot('Mozilla/5.0 HeadlessChrome/120.0'), true);
  assert.equal(ehBot('facebookexternalhit/1.1'), true);
  assert.equal(ehBot('WhatsApp/2.23.20.0'), true);
  assert.equal(ehBot(null), true);
  assert.equal(ehBot(''), true);
  assert.equal(ehBot('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/124.0 Mobile Safari/537.36'), false);
});
