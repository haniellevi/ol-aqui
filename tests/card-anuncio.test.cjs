const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup: render } = require('react-dom/server');
const { carregar } = require('./carregar.cjs');

// Card de anúncio no jeito da OLX (12/11/2026): título, preço antes riscado, preço, "Hoje, 18:58 · Corrente - PI".
const f = carregar('src/lib/formato.ts');
const agora = new Date('2026-11-12T21:58:00Z'); // 18:58 no Piauí

test('quandoCard: hoje, ontem, dia/mês e ano só quando não é o atual (horário do Piauí)', () => {
  assert.equal(f.quandoCard('2026-11-12T21:58:00Z', agora), 'Hoje, 18:58');
  assert.equal(f.quandoCard('2026-11-12T03:05:00Z', agora), 'Hoje, 00:05');
  assert.equal(f.quandoCard('2026-11-12T02:59:00Z', agora), 'Ontem, 23:59'); // 23:59 do dia 11 no Piauí
  assert.equal(f.quandoCard('2026-11-11T12:10:00Z', agora), 'Ontem, 09:10');
  assert.equal(f.quandoCard('2026-11-10T12:10:00Z', agora), '10/11');
  assert.equal(f.quandoCard('2025-12-31T12:00:00Z', agora), '31/12/2025');
  assert.equal(f.quandoCard(null, agora), '');
  assert.equal(f.quandoCard('lixo', agora), '');
});

test('cidadeUf: "Corrente - PI"; sem UF válida, só a cidade', () => {
  assert.equal(f.cidadeUf('Corrente', 'PI'), 'Corrente - PI');
  assert.equal(f.cidadeUf(' Barreiras ', 'ba'), 'Barreiras - BA');
  assert.equal(f.cidadeUf('Corrente', null), 'Corrente');
  assert.equal(f.cidadeUf('Corrente', 'Piauí'), 'Corrente');
  assert.equal(f.cidadeUf('', 'PI'), '');
});

test('precoAntesValido: só risca quando o antes é maior que o atual', () => {
  assert.equal(f.precoAntesValido(150000, 120000), 150000);
  assert.equal(f.precoAntesValido(120000, 120000), null);
  assert.equal(f.precoAntesValido(100000, 120000), null);
  assert.equal(f.precoAntesValido(150000, null), null); // "a combinar" não tem riscado
  assert.equal(f.precoAntesValido(null, 120000), null);
});

const mocks = {
  'next/image': { __esModule: true, default: (p) => React.createElement('img', { src: p.src, alt: p.alt }) },
  'next/link': { __esModule: true, default: ({ href, children, ...r }) => React.createElement('a', { href, ...r }, children) },
};
const { CardAnuncio } = carregar('src/components/anuncio/card-anuncio.tsx', mocks);
const base = { id: '60000000-0000-4000-a000-000000000001', slug: 'moto-titan', titulo: 'Moto Titan 160', preco_centavos: 1450000, cidade: 'Corrente', capa: null, criado_em: new Date().toISOString(), destaque: false, vitrine_nome: 'Moto Peças', vitrine_selo: false, vitrine_tipo: 'loja' };
const desenhar = (a, props = {}) => render(React.createElement(CardAnuncio, { anuncio: { ...base, ...a }, ...props }));

test('card: título antes do preço, preço riscado com "Antes:" e linha "Hoje, hh:mm · Corrente - PI"', () => {
  const html = desenhar({ preco_antes_centavos: 1590000, uf: 'PI' });
  assert.ok(html.indexOf('Moto Titan 160') < html.indexOf('R$ 14.500'), 'título vem antes do preço');
  assert.match(html, /<s [^>]*><span class="sr-only">Antes: <\/span>R\$ 15\.900<\/s>/);
  assert.match(html, /<span class="sr-only">Agora: <\/span>R\$ 14\.500/);
  assert.match(html, /<time[^>]*>Hoje, \d\d:\d\d<\/time> · Corrente - PI/);
  assert.match(html, /Moto Peças/);
  assert.doesNotMatch(html, /há \d/);
});

test('card: preço antes menor ou igual, ou "a combinar", não aparece riscado; sem UF fica só a cidade', () => {
  assert.doesNotMatch(desenhar({ preco_antes_centavos: 1450000 }), /<s /);
  assert.doesNotMatch(desenhar({ preco_antes_centavos: 1000000 }), /<s /);
  const combinar = desenhar({ preco_centavos: null, preco_antes_centavos: 1000000 });
  assert.doesNotMatch(combinar, /<s /); assert.match(combinar, /A combinar/); assert.doesNotMatch(combinar, /Agora:/);
  assert.match(desenhar({}), /<\/time> · Corrente<\/span>/);
});

test('card: um selo só, "Patrocinado" para destaque pago (nunca "Destaque"); coração fora do link', () => {
  const html = desenhar({ destaque: true }, { acao: React.createElement('button', { type: 'button' }, 'salvar') });
  assert.equal(html.match(/Patrocinado/g).length, 1);
  assert.doesNotMatch(html, />Destaque</);
  assert.match(html, /<\/a><div class="absolute top-1 right-1"><button/);
  assert.doesNotMatch(desenhar({}), /Patrocinado/);
});

test('card: vendedor individual verificado vira linha leve (sem selo pesado) e pessoa física sem selo não mostra nome', () => {
  const pf = desenhar({ vitrine_tipo: 'pf', vitrine_nome: 'Ana', vendedor_pago: true, vendedor_pf_verificado: true });
  assert.match(pf, /Vendedor individual verificado/);
  assert.doesNotMatch(pf, /rounded-full[^"]*bg-sucesso-fundo/);
  assert.doesNotMatch(desenhar({ vitrine_tipo: 'pf', vitrine_nome: 'Ana' }), /Ana/);
});

test('completarCards junta preço antes e UF; se a consulta falhar, devolve os cards como vieram', async () => {
  const id = base.id;
  const ok = carregar('src/lib/dados/cards-extra.ts', { '@/lib/supabase/server': { createClient: async () => ({ rpc: async (nome, args) => {
    assert.equal(nome, 'anuncios_cards_extra'); assert.deepEqual(args, { p_ids: [id] });
    return { data: [{ id, preco_antes_centavos: '1590000', uf: 'PI' }], error: null };
  } }) } });
  assert.deepEqual(await ok.completarCards([{ id, titulo: 'x' }, { id: 'nao-uuid' }]), [{ id, titulo: 'x', preco_antes_centavos: 1590000, uf: 'PI' }, { id: 'nao-uuid' }]);
  const falha = carregar('src/lib/dados/cards-extra.ts', { '@/lib/supabase/server': { createClient: async () => ({ rpc: async () => ({ data: null, error: { message: 'function does not exist' } }) }) } });
  assert.deepEqual(await falha.completarCards([{ id }]), [{ id }]);
  const quebra = carregar('src/lib/dados/cards-extra.ts', { '@/lib/supabase/server': { createClient: async () => { throw Error('sem rede'); } } });
  assert.deepEqual(await quebra.completarCards([{ id }]), [{ id }]);
});
