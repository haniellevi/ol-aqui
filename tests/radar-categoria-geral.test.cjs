const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup: render } = require('react-dom/server');
const { carregar } = require('./carregar.cjs');

// Pedido do Radar em "geral" (migração 20261125050000): a lista do admin marca o grupo, leva ao pedido e
// a volta da decisão conta os pedidos que mudaram de categoria.
const PEDIDO_1 = '86000000-0000-4000-a000-000000000001';
const PEDIDO_2 = '86000000-0000-4000-a000-000000000002';
const PAI = '86000000-0000-4000-a000-000000000010';
const CAT = '86000000-0000-4000-a000-000000000011';

const GRUPO_RADAR = {
  texto_norm: 'procuro bicicleta infantil', texto: 'Procuro bicicleta infantil', quantidade: 2, anuncios: 0,
  proximas: [{ id: 'd1', caminho: 'Outros › Diversos', vezes: 2 }], primeira: '2026-11-25T10:00:00Z', ultima: '2026-11-25T11:00:00Z',
  parecidas: [], radar: 2, pedidos_radar: [PEDIDO_2, PEDIDO_1],
};
const GRUPO_SEM_RADAR = {
  texto_norm: 'sal grosso', texto: 'Sal grosso', quantidade: 1, anuncios: 1,
  proximas: [{ id: 'p3', caminho: 'Pet › Ração', vezes: 1 }], primeira: '2026-11-10T10:00:00Z', ultima: '2026-11-10T10:00:00Z',
  parecidas: [], radar: 0, pedidos_radar: [],
};
const LINHAS_ADMIN = [
  { id: 'p1', slug: 'pet', nome: 'Pet', pai_id: null, ativa: true, campos: [] },
  { id: 'p2', slug: 'produtos', nome: 'Produtos para pets', pai_id: 'p1', ativa: true, campos: [] },
  { id: 'p3', slug: 'racao', nome: 'Ração', pai_id: 'p2', ativa: true, campos: [] },
  { id: 'd1', slug: 'diversos', nome: 'Diversos', pai_id: null, ativa: true, campos: [] },
];

function bancoAdmin({ grupos = [GRUPO_RADAR, GRUPO_SEM_RADAR], decidir = { decididas: 2, movidos: 0, revisar: 0, pedidos: 2 } } = {}) {
  const chamadas = [];
  return {
    chamadas,
    rpc: async (nome, args) => {
      chamadas.push([nome, args]);
      if (nome === 'e_admin') return { data: true, error: null };
      if (nome === 'e_super_admin') return { data: true, error: null };
      if (nome === 'admin_categorias') return { data: LINHAS_ADMIN, error: null };
      if (nome === 'admin_categorias_sugeridas') return { data: grupos, error: null };
      if (nome === 'decidir_categorias_sugeridas') return { data: decidir, error: null };
      return { data: null, error: null };
    },
  };
}
const navegacao = { redirect: (url) => { throw Error(`redirect:${url}`); }, notFound: () => { throw Error('NOT_FOUND'); } };
const mocksAdmin = (banco) => ({
  '@/lib/admin/auth': { exigirAdmin: async () => ({ supabase: banco }), eSuperAdmin: async () => true },
  'next/link': { default: ({ href, children, className }) => React.createElement('a', { href, className }, children) },
  'next/cache': { revalidatePath() {} },
  'next/navigation': navegacao,
});

test('lista do admin marca o grupo do Radar e leva a cada pedido', async () => {
  const banco = bancoAdmin();
  const { default: pagina } = carregar('src/app/admin/categorias/sugeridas/page.tsx', mocksAdmin(banco));
  const html = render(await pagina({ searchParams: Promise.resolve({}) }));
  assert.match(html, />Pedido do Radar<\/span>/);
  assert.match(html, /2 pedidos feitos em Geral/);
  assert.match(html, /href="\/radar\/86000000-0000-4000-a000-000000000002"[^>]*>Ver pedido 1</);
  assert.match(html, /href="\/radar\/86000000-0000-4000-a000-000000000001"[^>]*>Ver pedido 2</);
});

test('grupo sem pedido do Radar não ganha a marca', async () => {
  const banco = bancoAdmin({ grupos: [GRUPO_SEM_RADAR] });
  const { default: pagina } = carregar('src/app/admin/categorias/sugeridas/page.tsx', mocksAdmin(banco));
  const html = render(await pagina({ searchParams: Promise.resolve({}) }));
  assert.match(html, /“Sal grosso”/);
  assert.doesNotMatch(html, />Pedido do Radar<\/span>/);
  assert.doesNotMatch(html, /\/radar\//);
});

test('grupo antigo, sem os campos novos, não quebra a lista', async () => {
  const antigo = { ...GRUPO_SEM_RADAR };
  delete antigo.radar;
  delete antigo.pedidos_radar;
  const banco = bancoAdmin({ grupos: [antigo] });
  const { default: pagina } = carregar('src/app/admin/categorias/sugeridas/page.tsx', mocksAdmin(banco));
  const html = render(await pagina({ searchParams: Promise.resolve({}) }));
  assert.match(html, /“Sal grosso”/);
  assert.doesNotMatch(html, />Pedido do Radar<\/span>/);
});

test('decidir um grupo do Radar volta com o número de pedidos que mudaram de categoria', async () => {
  const banco = bancoAdmin();
  const a = carregar('src/app/admin/categorias/sugeridas/actions.ts', {
    '@/lib/admin/auth': { exigirAdmin: async () => ({ supabase: banco }), eSuperAdmin: async () => true },
    'next/cache': { revalidatePath() {} },
    'next/navigation': navegacao,
  });
  const f = new FormData();
  f.set('acao', 'juntar'); f.set('categoria_id', CAT); f.append('grupo', 'procuro bicicleta infantil');
  await assert.rejects(a.decidirSugestoes(null, f), /feito=juntar&decididas=2&movidos=0&revisar=0&pedidos=2/);
});

test('a volta da decisão diz quantos pedidos do Radar mudaram', async () => {
  const banco = bancoAdmin();
  const { default: pagina } = carregar('src/app/admin/categorias/sugeridas/page.tsx', mocksAdmin(banco));
  const html = render(await pagina({ searchParams: Promise.resolve({ feito: 'juntar', decididas: '2', movidos: '0', revisar: '0', pedidos: '2' }) }));
  assert.match(html, /2 pedidos do Radar mudaram de categoria\./);
  const umPedido = render(await pagina({ searchParams: Promise.resolve({ feito: 'aprovar', decididas: '1', movidos: '0', revisar: '0', pedidos: '1' }) }));
  assert.match(umPedido, /Categoria criada\./);
  assert.match(umPedido, /1 pedido do Radar mudou de categoria\./);
});
