const { test } = require('node:test');
const assert = require('node:assert/strict');
const { carregar } = require('./carregar.cjs');
const { corDominante, tonsDaCor } = carregar('src/lib/cor-logo.ts');
const { promptBanner } = carregar('src/lib/aki/padrao-banner.ts');

function pixels(lista) {
  const out = [];
  for (const [r, g, b, a, vezes] of lista) for (let i = 0; i < vezes; i++) out.push(r, g, b, a);
  return Uint8ClampedArray.from(out);
}

test('cor da logo ignora fundo transparente e branco e prefere a cor viva', () => {
  const logo = pixels([[0, 0, 0, 0, 5000], [255, 255, 255, 255, 3000], [128, 128, 128, 255, 900], [20, 120, 220, 255, 600]]);
  const cor = corDominante(logo);
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(cor.slice(i, i + 2), 16));
  assert.ok(b > r + 100 && b > g, `esperava azul, veio ${cor}`);
});

test('logo só cinza devolve cinza; logo vazia devolve null', () => {
  assert.match(corDominante(pixels([[120, 120, 120, 255, 100]])), /^#787878$/);
  assert.equal(corDominante(pixels([[255, 255, 255, 255, 100], [0, 0, 0, 0, 100]])), null);
});

test('tons da cor: escura mais escura, clara mais clara, cor inválida usa a padrão', () => {
  const t = tonsDaCor('#1478dc');
  const lum = (h) => [1, 3, 5].reduce((s, i) => s + parseInt(h.slice(i, i + 2), 16), 0);
  assert.equal(t.principal, '#1478dc');
  assert.ok(lum(t.escura) < lum(t.principal) && lum(t.clara) > lum(t.principal));
  assert.equal(tonsDaCor('').principal, '#4b1248');
});

test('prompt do banner segue o padrão fixo e usa a paleta da loja', () => {
  const p = promptBanner({ loja: 'Café Bom', categoria: 'Cafeteria', descricao: '', cor: '#1478dc', estilo: 'mais alegre' });
  for (const trecho of ['ESTILO FIXO', 'PALETA OBRIGATÓRIA', 'COMPOSIÇÃO', 'MOTIVO', 'PROIBIDO', '#1478dc', 'mais alegre', 'Café Bom']) assert.ok(p.includes(trecho), trecho);
  assert.ok(!promptBanner({ cor: '', estilo: '' }).includes('PREFERÊNCIA EXTRA'));
});
