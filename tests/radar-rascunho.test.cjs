const { test } = require('node:test');
const assert = require('node:assert/strict');
const { carregar } = require('./carregar.cjs');

// Pedido escrito antes do login: o rascunho fica no aparelho por 2 horas.
const mod = () => carregar('src/lib/rascunho-radar.ts');
const ID1 = '11111111-1111-4111-8111-111111111111';
const ID2 = '22222222-2222-4222-8222-222222222222';
const DUAS_HORAS = 2 * 3600_000;
const BOM = {
  titulo: 'Geladeira frost free', detalhes: 'Branca', categoriaId: ID1, precoMin: '500', precoMax: '1.200',
  cidadesIds: [ID2], visibilidade: 'todos', modo: 'propostas_prazo', prazoHoras: 24,
};

test('rascunho: aceita o formato certo dentro de 2 horas', () => {
  const { rascunhoValido, VALIDADE_RASCUNHO_MS, LINK_RETOMAR_PEDIDO } = mod();
  assert.equal(VALIDADE_RASCUNHO_MS, DUAS_HORAS);
  assert.equal(LINK_RETOMAR_PEDIDO, '/radar/pedir?retomar=1');
  assert.deepEqual(rascunhoValido({ v: 1, em: 1000, dados: BOM }, 1000 + DUAS_HORAS - 1), BOM);
});

test('rascunho: vencido, versão errada, nulo ou texto vira null', () => {
  const { rascunhoValido } = mod();
  assert.equal(rascunhoValido({ v: 1, em: 1000, dados: BOM }, 1000 + DUAS_HORAS + 1), null);
  assert.equal(rascunhoValido({ v: 2, em: 1000, dados: BOM }, 1000), null);
  assert.equal(rascunhoValido(null, 1000), null);
  assert.equal(rascunhoValido('x', 1000), null);
  assert.equal(rascunhoValido({ v: 1, em: 1000 }, 1000), null);
});

test('rascunho: corta e limpa campos', () => {
  const { rascunhoValido } = mod();
  const muitos = Array.from({ length: 25 }, (_, i) => `${String(i).padStart(8, '0')}-1111-4111-8111-111111111111`);
  const r = rascunhoValido({ v: 1, em: 0, dados: {
    ...BOM, titulo: 'a'.repeat(300), detalhes: 'b'.repeat(2000), cidadesIds: ['nao-uuid', ...muitos],
    visibilidade: 'outra', modo: 'x', prazoHoras: '24', categoriaId: 'abc', precoMin: 5, precoMax: 'y'.repeat(200),
  } }, 0);
  assert.equal(r.titulo.length, 120);
  assert.equal(r.detalhes.length, 1000);
  assert.equal(r.cidadesIds.length, 20);
  assert.ok(!r.cidadesIds.includes('nao-uuid'));
  assert.equal(r.visibilidade, 'lojas');
  assert.equal(r.modo, 'propostas_prazo');
  assert.equal(r.prazoHoras, null);
  assert.equal(r.categoriaId, null);
  assert.equal(r.precoMin, '');
  assert.equal(r.precoMax.length, 120);
});

test('rascunho: título vazio vira null', () => {
  const { rascunhoValido } = mod();
  assert.equal(rascunhoValido({ v: 1, em: 0, dados: { ...BOM, titulo: '   ' } }, 0), null);
});
