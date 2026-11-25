const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup: render } = require('react-dom/server');
const { carregar } = require('./carregar.cjs');
const id = '22200000-0000-4000-a000-000000000001';
const link = { default: ({ children, ...props }) => React.createElement('a', props, children) };

test('gerente existente percorre Minhas lojas até edição e retirada sem novo convite', async () => {
  const fragmento = ({ children }) => React.createElement(React.Fragment, null, children);
  const mocks = {
    'next/link': link,
    'next/navigation': { useRouter: () => ({}), notFound: () => { throw Error('404'); } },
    '@/components/ui/dropdown-menu': { DropdownMenu: fragmento, DropdownMenuContent: fragmento,
      DropdownMenuTrigger: ({ children }) => React.createElement('button', null, children),
      DropdownMenuItem: ({ render: elemento, children }) => elemento ? React.cloneElement(elemento, {}, children) : React.createElement('button', null, children) },
    '@/app/(conta)/minha-conta/lojas/autosservico-actions': {},
    '@/app/(conta)/_loja/actions': { escolherLoja() {} },
    '@/lib/dados/conta': { meuPerfilEVitrine: async () => ({ vitrine: null }) },
    '@/lib/supabase/server': { createClient: async () => ({ rpc: async nome => ({ data: nome === 'minhas_lojas' ? [{ id, nome: 'Loja Sintética', dono: false }] : null, error: null }) }) },
  };
  const lista = carregar('src/app/(conta)/minha-conta/lojas/page.tsx', mocks).default;
  const html = render(await lista());
  assert.match(html, /Cuidar dos anúncios/);
  assert.match(html, /Sair desta loja/);
  assert.match(html, /Cuidar da loja/);
  assert.match(html, /Editar vitrine completa/);
  assert.match(html, /name="voltar" value="\/minha-conta\/loja"/);
  const destino = html.match(/href="([^\"]+)"[^>]*>Editar loja e propostas/)[1];
  assert.equal(destino, `/minha-conta/lojas/${id}`);

  const chamadas = [];
  const db = { rpc: (nome, args) => {
    chamadas.push([nome, args]);
    const data = nome === 'minhas_lojas' ? [{ id, nome: 'Loja Sintética', dono: false }]
      : nome === 'propostas_retiraveis_loja' ? [{ id, titulo: 'Oferta sintética existente' }]
      : { endereco: 'Rua Sintética', lat: null, lng: null, horarios: null, sobre: null, faz_entrega: false, entrega_obs: null };
    return { then: r => r({ data, error: null }), maybeSingle: async () => ({ data, error: null }) };
  } };
  const fronteiras = { ...mocks, '@/lib/supabase/server': { createClient: async () => db }, '../actions': { salvarVitrineGerenciada() {} } };
  const propostas = await carregar('src/components/radar/propostas-retiraveis-loja.tsx', fronteiras).PropostasRetiraveisLoja({ loja: id });
  const detalhe = carregar('src/app/(conta)/minha-conta/lojas/[id]/page.tsx', {
    ...fronteiras, '@/components/radar/propostas-retiraveis-loja': { PropostasRetiraveisLoja: () => propostas },
  }).default;
  const tela = render(await detalhe({ params: Promise.resolve({ id: destino.split('/').pop() }) }));
  assert.match(tela, /Rua Sintética/);
  assert.match(tela, /Propostas no Radar/);
  assert.match(tela, /Oferta sintética existente/);
  assert.match(tela, /Retirar proposta/);
  assert.ok(chamadas.some(([nome]) => nome === 'dados_loja_gerenciada'));
  assert.ok(chamadas.some(([nome]) => nome === 'propostas_retiraveis_loja'));
  assert.ok(chamadas.every(([nome]) => !nome.includes('convite')));
});
