const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup: render } = require('react-dom/server');
const { carregar } = require('./carregar.cjs');

// Sugestão de categoria (Etapa P2): cadastro do anúncio, painel do admin e decisão.
const ID = '70000000-0000-4000-a000-000000000001';
const PAI = '70000000-0000-4000-a000-000000000002';
const CAT = '70000000-0000-4000-a000-000000000003';
const ARVORE = [{ id: 'p1', slug: 'pet', nome: 'Pet', icone: 'paw-print', pai_id: null, ordem: 10, ativa: true, campos: [], filhas: [
  { id: 'p3', slug: 'racao', nome: 'Ração', icone: 'paw-print', pai_id: 'p1', ordem: 10, ativa: true, campos: [], filhas: [] },
] }];

// ---------- Escolha de categoria: botão e aviso ----------
function escolhaSugerida({ busca = '', sugestao = null } = {}) {
  const valores = [[], null, busca, sugestao];
  let i = 0;
  const { EscolhaCategoria } = carregar('src/components/anunciar/escolha-categoria.tsx', {
    react: { ...React, useState: (inicial) => [i < valores.length ? valores[i++] : inicial, () => {}], useMemo: (fn) => fn() },
    './enviar': { useEnvioAnuncio: () => [null, () => {}, false, () => {}] },
    '@/app/(conta)/anunciar/actions': { salvarCategoria() {} },
  });
  return render(EscolhaCategoria({ id: ID, editar: false, formId: 'f', arvore: ARVORE, selecionadaId: null }));
}

test('botão Sugerir aparece só quando a busca não acha nada', () => {
  const sem = escolhaSugerida({ busca: 'xyz' });
  assert.match(sem, /Sugerir a categoria/);
  assert.match(sem, /xyz/);
  assert.doesNotMatch(escolhaSugerida({ busca: 'racao' }), /Sugerir a categoria/);
  // uma letra só: a equipe não recebe pedido curto demais
  assert.doesNotMatch(escolhaSugerida({ busca: 'x' }), /Sugerir a categoria/);
});

test('depois de sugerir, o aviso aparece e o texto vai no campo escondido', () => {
  const html = escolhaSugerida({ sugestao: 'Ração Premium' });
  assert.match(html, /Escolha abaixo a categoria mais parecida\. Seu anúncio vai ao ar nela enquanto a equipe analisa a sugestão\./);
  assert.match(html, /name="sugestao_categoria" value="Ração Premium"/);
  assert.match(html, /Tirar a sugestão/);
  assert.doesNotMatch(escolhaSugerida({}), /name="sugestao_categoria" value="[^"]+"/);
});

// ---------- Ações do cadastro ----------
const anuncio = { id: ID, vitrine_id: 'loja', status: 'rascunho', fotos: [], atributos: {}, preco_centavos: null, categoria_id: null, publicado_em: null, atualizado_em: '2026-11-10T10:00:00Z' };
const conta = { vitrine: { id: 'loja', microrregiao_id: 'regiao', status: 'ativa' }, podePublicar: true };

function acoesAnuncio({ erroSugerir = null, categoriaSalva = null } = {}) {
  const log = [];
  const q = {
    select() { return q; }, eq() { return q; }, filter() { return q; }, order() { return q; }, limit() { return q; },
    update() { log.push('update'); return q; }, insert() { log.push('insert'); return q; },
    async maybeSingle() { return { data: { id: ID, status: 'rascunho' }, error: null }; },
  };
  const db = {
    from: () => q,
    rpc: async (nome, args) => {
      log.push(nome);
      if (nome === 'sugerir_categoria' && erroSugerir) return { data: null, error: erroSugerir };
      return { data: null, error: null, args, categoriaSalva };
    },
  };
  const mocks = {
    '@clerk/nextjs/server': { auth: async () => ({ userId: 'user_loja' }) },
    '@/lib/supabase/server': { createClient: async () => db },
    '@/lib/dados/anuncios': { meuAnuncio: async () => anuncio },
    '@/lib/dados/conta': { meuPerfilEVitrine: async () => conta },
    '@/lib/dados/categorias': {
      categoriaPorId: async (id) => (id === CAT ? { categoria: { id: CAT, nome: 'Ração', campos: [] }, filhas: [] } : null),
      categoriaDoAnuncio: async () => null,
    },
    '@/lib/dados/regiao': { listarCidades: async () => [] },
    '@/lib/dados/config': { lerConfigNumero: async () => null },
    '@/lib/dados/cobranca': { avulsoParaMim: async () => null },
    '@/lib/asaas': { asaasConfigurado: () => false },
    'next/navigation': { redirect: (url) => { throw Error(`redirect:${url}`); }, unstable_rethrow: (err) => { if (err.message?.startsWith('redirect:')) throw err; } },
  };
  return { a: carregar('src/app/(conta)/anunciar/actions.ts', mocks), log, rpcs: db.rpc };
}

function formCategoria(valores = {}) {
  const f = new FormData();
  for (const [k, v] of Object.entries({ id: ID, acao: 'seguir', categoria_id: CAT, ...valores })) f.set(k, v);
  return f;
}

test('salvar categoria: salva a categoria e depois manda a sugestão à equipe', async () => {
  const { a, log } = acoesAnuncio();
  await assert.rejects(a.salvarCategoria(null, formCategoria({ sugestao_categoria: '  Ração   Premium ' })), /redirect:/);
  assert.deepEqual(log, ['update', 'sugerir_categoria']);
});

test('trocar de categoria sem sugestão não chama a equipe e cancela a sugestão antiga', async () => {
  const { a, log } = acoesAnuncio();
  await assert.rejects(a.salvarCategoria(null, formCategoria({ sugestao_categoria: '' })), /redirect:/);
  assert.deepEqual(log, ['update', 'cancelar_sugestao_categoria']);
});

test('erro da sugestão volta como mensagem e a categoria continua salva', async () => {
  const erro = { code: '22023', message: 'Essa categoria já existe. Procure por ela na lista.' };
  const { a, log } = acoesAnuncio({ erroSugerir: erro });
  const r = await a.salvarCategoria(null, formCategoria({ sugestao_categoria: 'Rações' }));
  assert.equal(r.erro.mensagem, 'Categoria salva. A sugestão não foi enviada: Essa categoria já existe. Procure por ela na lista.');
  assert.deepEqual(log, ['update', 'sugerir_categoria']);
});

test('cancelar sugestão chama a função do banco do próprio anúncio', async () => {
  const { a, log } = acoesAnuncio();
  const r = await a.cancelarSugestaoCategoria(null, formCategoria({ categoria_id: undefined }));
  assert.deepEqual(log, ['cancelar_sugestao_categoria']);
  assert.equal(r.ok, 'Sugestão cancelada.');
});

test('aviso da sugestão pendente mostra o texto e o botão de cancelar', () => {
  const { SugestaoPendente } = carregar('src/components/anunciar/sugestao-pendente.tsx', {
    './enviar': { useEnvioAnuncio: () => [null, () => {}, false, () => {}] },
    '@/app/(conta)/anunciar/actions': { cancelarSugestaoCategoria() {} },
  });
  const html = render(SugestaoPendente({ id: ID, editar: false, texto: 'Ração' }));
  assert.match(html, /Você sugeriu “Ração”\. A equipe vai analisar\./);
  assert.match(html, /Cancelar sugestão/);
});

// ---------- Admin: decisão ----------
const GRUPOS = [
  { texto_norm: 'sal grosso', texto: 'Sal grosso', quantidade: 2, anuncios: 2, proximas: [{ id: 'p3', caminho: 'Pet › Ração', vezes: 2 }], primeira: '2026-11-10T10:00:00Z', ultima: '2026-11-11T10:00:00Z', parecidas: ['sal groso'] },
  { texto_norm: 'sal groso', texto: 'Sal groso', quantidade: 1, anuncios: 1, proximas: [{ id: 'p3', caminho: 'Pet › Ração', vezes: 1 }], primeira: '2026-11-10T10:00:00Z', ultima: '2026-11-10T10:00:00Z', parecidas: ['sal grosso'] },
];
const LINHAS_ADMIN = [
  { id: 'p1', slug: 'pet', nome: 'Pet', pai_id: null, ativa: true, campos: [] },
  { id: 'p2', slug: 'produtos', nome: 'Produtos para pets', pai_id: 'p1', ativa: true, campos: [] },
  { id: 'p3', slug: 'racao', nome: 'Ração', pai_id: 'p2', ativa: true, campos: [] },
];

function bancoAdmin({ admin = true, decidir = { decididas: 3, movidos: 2, revisar: 1 } } = {}) {
  const chamadas = [];
  return {
    chamadas,
    rpc: async (nome, args) => {
      chamadas.push([nome, args]);
      if (nome === 'e_admin') return { data: admin, error: null };
      if (nome === 'admin_categorias') return { data: LINHAS_ADMIN, error: null };
      if (nome === 'admin_categorias_sugeridas') return { data: GRUPOS, error: null };
      if (nome === 'decidir_categorias_sugeridas') return { data: decidir, error: null };
      return { data: null, error: null };
    },
  };
}
const navegacaoAdmin = { redirect: (url) => { throw Error(`redirect:${url}`); }, notFound: () => { throw Error('NOT_FOUND'); } };

test('admin decide com os grupos marcados e mostra o resumo na volta', async () => {
  const banco = bancoAdmin();
  const a = carregar('src/app/admin/categorias/sugeridas/actions.ts', {
    '@/lib/admin/auth': { exigirAdmin: async () => ({ supabase: banco }), eSuperAdmin: async () => true },
    'next/cache': { revalidatePath() {} },
    'next/navigation': navegacaoAdmin,
  });
  const f = new FormData();
  f.set('acao', 'aprovar'); f.set('nome', 'Sal grosso'); f.set('pai_id', PAI);
  for (const g of ['sal grosso', 'sal groso', 'sal grosso']) f.append('grupo', g);
  await assert.rejects(a.decidirSugestoes(null, f), /redirect:\/admin\/categorias\/sugeridas\?feito=aprovar&decididas=3&movidos=2&revisar=1/);
  const [nome, args] = banco.chamadas.find(([n]) => n === 'decidir_categorias_sugeridas');
  assert.equal(nome, 'decidir_categorias_sugeridas');
  assert.deepEqual(args, { p_grupos: ['sal grosso', 'sal groso'], p_acao: 'aprovar', p_nome: 'Sal grosso', p_pai: PAI, p_categoria: null });
});

test('juntar manda a categoria escolhida e recusar não manda nome nem lugar', async () => {
  const banco = bancoAdmin({ decidir: { decididas: 1, movidos: 0, revisar: 0 } });
  const a = carregar('src/app/admin/categorias/sugeridas/actions.ts', {
    '@/lib/admin/auth': { exigirAdmin: async () => ({ supabase: banco }), eSuperAdmin: async () => true },
    'next/cache': { revalidatePath() {} },
    'next/navigation': navegacaoAdmin,
  });
  const juntar = new FormData();
  juntar.set('acao', 'juntar'); juntar.set('categoria_id', CAT); juntar.append('grupo', 'sal grosso');
  await assert.rejects(a.decidirSugestoes(null, juntar), /feito=juntar/);
  const recusar = new FormData();
  recusar.set('acao', 'recusar'); recusar.append('grupo', 'sal grosso');
  await assert.rejects(a.decidirSugestoes(null, recusar), /feito=recusar&decididas=1&movidos=0&revisar=0/);
  const chamadas = banco.chamadas.filter(([n]) => n === 'decidir_categorias_sugeridas').map(([, args]) => args);
  assert.deepEqual(chamadas[0], { p_grupos: ['sal grosso'], p_acao: 'juntar', p_nome: null, p_pai: null, p_categoria: CAT });
  assert.deepEqual(chamadas[1], { p_grupos: ['sal grosso'], p_acao: 'recusar', p_nome: null, p_pai: null, p_categoria: null });
});

test('não-admin é barrado na ação: nada é decidido', async () => {
  const banco = bancoAdmin({ admin: false });
  const a = carregar('src/app/admin/categorias/sugeridas/actions.ts', {
    '@clerk/nextjs/server': { auth: async () => ({ userId: 'user_comum' }) },
    '@/lib/perfil': { garantirPerfil: async () => {} },
    '@/lib/supabase/server': { createClient: async () => banco },
    'next/cache': { revalidatePath() {} },
    'next/navigation': navegacaoAdmin,
  });
  const f = new FormData();
  f.set('acao', 'recusar'); f.append('grupo', 'sal grosso');
  await assert.rejects(a.decidirSugestoes(null, f), /NOT_FOUND/);
  assert.equal(banco.chamadas.some(([n]) => n === 'decidir_categorias_sugeridas'), false);
});

const mocksAdmin = (banco, extra = {}) => ({
  '@/lib/admin/auth': { exigirAdmin: async () => ({ supabase: banco }), eSuperAdmin: async () => true },
  'next/link': { default: ({ href, children, className }) => React.createElement('a', { href, className }, children) },
  'next/cache': { revalidatePath() {} },
  'next/navigation': navegacaoAdmin,
  ...extra,
});

test('página de sugestões lista os grupos com as ações e as parecidas marcáveis', async () => {
  const banco = bancoAdmin();
  const { default: pagina } = carregar('src/app/admin/categorias/sugeridas/page.tsx', mocksAdmin(banco));
  const html = render(await pagina({ searchParams: Promise.resolve({}) }));
  assert.match(html, /“Sal grosso”/);
  assert.match(html, /Mais perto de:<\/span> Pet › Ração \(2 vezes\)/);
  assert.match(html, /value="Sal grosso"/);
  assert.match(html, /name="acao" value="aprovar"/);
  assert.match(html, /name="acao" value="juntar"/);
  assert.match(html, /name="acao" value="recusar"/);
  assert.match(html, /“Sal groso”/);
});

test('página mostra o resumo da última decisão', async () => {
  const banco = bancoAdmin();
  const { default: pagina } = carregar('src/app/admin/categorias/sugeridas/page.tsx', mocksAdmin(banco));
  const html = render(await pagina({ searchParams: Promise.resolve({ feito: 'aprovar', decididas: '3', movidos: '2', revisar: '1' }) }));
  assert.match(html, /Categoria criada\. 3 sugestões decididas\. 2 anúncios mudaram de categoria\. 1 anúncio ficou onde estava: a categoria pede informações que ele não tem\. O vendedor foi avisado\./);
});

test('página de sugestões barra quem não é admin', async () => {
  const banco = bancoAdmin({ admin: false });
  const { default: pagina } = carregar('src/app/admin/categorias/sugeridas/page.tsx', {
    '@clerk/nextjs/server': { auth: async () => ({ userId: 'user_comum' }) },
    '@/lib/perfil': { garantirPerfil: async () => {} },
    '@/lib/supabase/server': { createClient: async () => banco },
    'next/navigation': navegacaoAdmin,
  });
  await assert.rejects(pagina({ searchParams: Promise.resolve({}) }), /NOT_FOUND/);
  assert.equal(banco.chamadas.some(([n]) => n === 'admin_categorias_sugeridas'), false);
});

test('tela de categorias mostra o link com a contagem de sugestões pendentes', async () => {
  const banco = bancoAdmin();
  const { default: pagina } = carregar('src/app/admin/categorias/page.tsx', mocksAdmin(banco));
  const html = render(await pagina());
  assert.match(html, /Categorias sugeridas \(3\)/);
  assert.match(html, /href="\/admin\/categorias\/sugeridas"/);
});
