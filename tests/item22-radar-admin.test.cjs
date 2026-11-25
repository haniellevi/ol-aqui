const test = require('node:test');
const assert = require('node:assert/strict');
const { carregar } = require('./carregar.cjs');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const id = '89800000-0000-4000-b000-000000000001';
function ambiente(data, error = null, login = true) {
  const calls = [];
  const a = carregar('src/app/radar/actions.ts', {
    '@clerk/nextjs/server': { auth: async () => ({ userId: login ? 'user_teste' : null }) },
    'next/cache': { revalidatePath: p => calls.push(p) },
    '@/lib/supabase/server': { createClient: async () => ({ rpc: async (...args) => { calls.push(args); return { data, error }; } }) },
    '@/lib/perfil': {}, '@/lib/dados/conta': {}, '@/lib/dados/anuncios': {},
  });
  return { a, calls };
}
test('retirar proposta valida sessão, ID e confirmação do banco', async () => {
  const sem = ambiente(id, null, false);
  assert.equal((await sem.a.retirarProposta(id)).ok, false);
  assert.equal(sem.calls.length, 0);
  const invalido = ambiente(id);
  assert.equal((await invalido.a.retirarProposta('invalido')).ok, false);
  assert.equal(invalido.calls.length, 0);
  for (const data of [null, false, 'invalido']) assert.equal((await ambiente(data).a.retirarProposta(id)).ok, false);
  const ok = ambiente(id);
  assert.equal((await ok.a.retirarProposta(id)).ok, true);
  assert.deepEqual(ok.calls[0], ['retirar_proposta_radar', { p_proposta: id }]);
  assert.ok(ok.calls.includes(`/radar/${id}`));
  assert.equal((await ambiente(null, { code: 'P0002', message: 'Pedido fechado.' }).a.retirarProposta(id)).erro, 'Pedido fechado.');
});

test('conversas: páginas redirecionam anônimo antes de buscar dados e preservam destino', async () => {
  for (const [arquivo, destino] of [['src/app/(conta)/conversas/page.tsx', '/conversas'], ['src/app/(conta)/conversas/[id]/page.tsx', `/conversas/${id}`]]) {
    const p = carregar(arquivo, {
      '@clerk/nextjs/server': { auth: async () => ({ userId: null }) },
      'next/navigation': { redirect: url => { throw Error(url); } },
      '@/lib/dados/conversas': { conversasLigadas: () => { throw Error('Não deve buscar dados'); } },
      '@/lib/dados/radar': {},
      '@/components/conversas/conversa-aberta': {}, '@/components/conversas/lista-conversas': {},
      '@/components/conversas/menu-seguranca': {}, '@/components/conversas/faixa-ja-comprei': {},
    }).default;
    await assert.rejects(p({ params: Promise.resolve({ id }) }), e => new URL('https://local' + e.message).searchParams.get('redirect_url') === destino);
  }
});

async function filaVazia(papel) {
  const q = { select: () => q, eq: () => q, order: () => q, limit: () => q, then: r => r({ data: [], error: null }) };
  const p = carregar('src/app/admin/moderacao/page.tsx', {
    '@/lib/admin/equipe': { exigirTela: async () => ({ papel, supabase: { from: () => q, rpc: async () => ({ data: [], error: null }) } }) },
    './actions': {}, './botao-decisao': {}, './botao-tirar-banner': {}, './radar-moderacao': { RadarModeracao: () => null },
    'next/link': { default: ({ children, ...props }) => React.createElement('a', props, children) },
  }).default;
  return renderToStaticMarkup(await p({ searchParams: Promise.resolve({}) }));
}
test('fila vazia oferece anúncios só ao administrador e atualização ao moderador', async () => {
  assert.match(await filaVazia('administrador'), /href="\/admin\/anuncios"/);
  const moderador = await filaVazia('moderador');
  assert.doesNotMatch(moderador, /href="\/admin\/anuncios"/);
  assert.match(moderador, /href="\/admin\/moderacao"[^>]*>Atualizar fila/);
});

test('middleware exige login em conversas e subrotas sem alterar Radar público', async () => {
  let protegidos = 0;
  const p = carregar('src/middleware.ts', {
    '@clerk/nextjs/server': {
      createRouteMatcher: rotas => req => rotas.some(r => new RegExp('^' + r + '$').test(req.nextUrl.pathname)),
      clerkMiddleware: callback => req => callback({ protect: async () => { protegidos++; } }, req),
    },
    'next/server': { NextResponse: class {} },
    '@/lib/manutencao': { manutencaoLigada: () => false },
    '@/lib/supabase/leitura': {},
  }).default;
  for (const pathname of ['/conversas', `/conversas/${id}`]) await p({ nextUrl: { pathname } }, {});
  assert.equal(protegidos, 2);
  await p({ nextUrl: { pathname: '/radar/pedir' } }, {});
  assert.equal(protegidos, 2);
});
