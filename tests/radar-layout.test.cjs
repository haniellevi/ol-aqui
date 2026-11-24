const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { carregar } = require('./carregar.cjs');
const mocks = {
  'next/link': { default: ({ children, ...props }) => React.createElement('a', props, children) },
  '@/components/ui/voltar': { Voltar: () => null },
  './atualizar-radar': { AtualizarRadar: () => null },
};
const { RadarDeNegocios } = carregar('src/components/radar/radar-de-negocios.tsx', mocks);
const pedido = i => ({ id: String(i), titulo: `Pedido exemplo ${i}`, detalhes: null, cidade: 'Cidade exemplo', urgencia: 'normal', totalPropostas: 0, maxPropostas: 5, modoContato: 'propostas_prazo', criadoEm: new Date().toISOString(), visibilidade: 'lojas' });
const render = (n, extra = {}) => renderToStaticMarkup(React.createElement(RadarDeNegocios, { pedidos: Array.from({ length: n }, (_, i) => pedido(i)), categorias: [], nicho: 'todas', vende: true, textoBusca: null, pagina: 1, temAcesso: false, propostasRestantes: 0, emTeste: false, planos: [], ...extra }));
test('plano vem após os primeiros dois pedidos, ou após o único disponível', () => {
  for (const n of [1, 2, 4]) {
    const html = render(n);
    const plano = html.indexOf('Esses clientes já querem comprar.');
    assert.ok(plano > html.indexOf(`Pedido exemplo ${Math.min(1, n - 1)}`));
    if (n > 2) assert.ok(plano < html.indexOf('Pedido exemplo 2'));
    assert.equal(html.match(/Ver planos/g).length, 1);
  }
});
test('vazio mantém saída antes da divulgação e verificação mantém destino próprio', () => {
  const html = render(0);
  assert.ok(html.indexOf('Ver todas as categorias') < html.indexOf('Ver planos'));
  const verificacao = render(4, { linkVerificar: '/conta/verificar' });
  assert.ok(verificacao.indexOf('Pedido exemplo 1') < verificacao.indexOf('Esses clientes já querem comprar.'));
  assert.ok(!verificacao.includes('Ver planos'));
});
test('pedido usa casca isolada e demais rotas conservam navegação', () => {
  for (const pathname of ['/radar/pedir', '/radar', '/radar/pedido/1']) {
    const { CascaRadar } = carregar('src/components/radar/casca-radar.tsx', { 'next/navigation': { usePathname: () => pathname } });
    const html = renderToStaticMarkup(React.createElement(CascaRadar, { cabecalho: 'CABEÇALHO', navegacao: 'NAVEGAÇÃO' }, 'CONTEÚDO'));
    assert.equal(html.includes('NAVEGAÇÃO'), pathname !== '/radar/pedir');
    assert.equal(html.includes('CABEÇALHO'), pathname !== '/radar/pedir');
    assert.ok(html.includes('CONTEÚDO'));
  }
});
