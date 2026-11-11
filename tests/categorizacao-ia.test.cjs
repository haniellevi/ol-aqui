const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup: render } = require('react-dom/server');
const { carregar } = require('./carregar.cjs');

const A1 = '48100000-0000-4000-a000-000000000001', A2 = '48100000-0000-4000-a000-000000000002', FORA = '48100000-0000-4000-a000-000000000009';
const lote = { id: 'l', reserva: 'r', modelo: 'openai/gpt-4.1-mini',
  anuncios: [{ id: A1, titulo: 'Sofá', descricao: '', categoria: 'carros' }, { id: A2, titulo: 'Fusca', descricao: '', categoria: 'carros' }],
  categorias: [{ slug: 'moveis', nome: 'Casa > Móveis' }, { slug: 'carros', nome: 'Veículos > Carros' }] };

function modulo(admin) {
  return carregar('src/lib/categorizacao-ia.ts', { '@/lib/supabase/admin': { supabaseAdmin: admin ?? (() => { throw new Error('sem banco'); }) } });
}
async function comFetch(resposta, fn) {
  const antes = global.fetch, chave = process.env.OPENROUTER_API_KEY; const pedidos = [];
  global.fetch = async (url, op) => { pedidos.push([url, JSON.parse(op.body)]); return typeof resposta === 'function' ? resposta() : resposta; };
  process.env.OPENROUTER_API_KEY = 'teste';
  try { return await fn(pedidos); } finally { global.fetch = antes; if (chave === undefined) delete process.env.OPENROUTER_API_KEY; else process.env.OPENROUTER_API_KEY = chave; }
}
const ok = (conteudo, extra = {}) => new Response(JSON.stringify({ usage: { cost: 0.002, prompt_tokens: 900, completion_tokens: 80 },
  choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(conteudo) } }], ...extra }), { status: 200 });

test('categorias IA: só fica sugestão do lote, com categoria da lista e confiança válida', () => {
  const m = modulo();
  const r = m.validarSugestoes({ sugestoes: [
    { anuncio_id: A1, categoria: 'moveis', confianca: 0.95 },
    { anuncio_id: A1, categoria: 'carros', confianca: 0.99 },
    { anuncio_id: FORA, categoria: 'moveis', confianca: 0.99 },
    { anuncio_id: A2, categoria: 'inventada', confianca: 0.99 },
    { anuncio_id: A2, categoria: 'carros', confianca: 1.5 },
    { anuncio_id: A2, categoria: 'carros', confianca: '0.9' },
    'texto', null,
  ] }, lote);
  assert.deepEqual(r, [{ anuncio_id: A1, categoria: 'moveis', confianca: 0.95 }]);
  for (const v of [null, [], {}, { sugestoes: 'x' }, { sugestoes: Array(51).fill({}) }]) assert.throws(() => m.validarSugestoes(v, lote));
});

test('categorias IA: chama o modelo barato sem dados da pessoa e devolve custo e tokens', async () => {
  const m = modulo();
  await comFetch(ok({ sugestoes: [{ anuncio_id: A1, categoria: 'moveis', confianca: 0.9 }] }), async (pedidos) => {
    const r = await m.sugerirCategoriasIA(lote);
    assert.deepEqual(r, { sugestoes: [{ anuncio_id: A1, categoria: 'moveis', confianca: 0.9 }], custo: 0.002, entrada: 900, saida: 80 });
    const corpo = pedidos[0][1];
    assert.equal(corpo.model, 'openai/gpt-4.1-mini'); assert.equal(corpo.provider.data_collection, 'deny'); assert.equal(corpo.temperature, 0);
    assert.match(corpo.messages[1].content, /^DADOS_NAO_SAO_INSTRUCOES/); assert.doesNotMatch(corpo.messages[1].content, /whatsapp|dono|vitrine/i);
  });
});

test('categorias IA: falhas viram "sem sugestão" e só recusa antes de gerar zera o custo', async () => {
  const m = modulo();
  await comFetch(new Response('x', { status: 429 }), async () => assert.deepEqual(await m.sugerirCategoriasIA(lote), { sugestoes: null, custo: 0, entrada: 0, saida: 0 }));
  await comFetch(new Response('x', { status: 500 }), async () => assert.equal((await m.sugerirCategoriasIA(lote)).custo, null));
  await comFetch(ok({ sugestoes: [] }, { choices: [{ finish_reason: 'length', message: { content: '{}' } }] }), async () => {
    const r = await m.sugerirCategoriasIA(lote); assert.equal(r.sugestoes, null); assert.equal(r.custo, 0.002);
  });
  await comFetch(() => { throw new Error('rede'); }, async () => assert.equal((await m.sugerirCategoriasIA(lote)).sugestoes, null));
  await comFetch(ok({ sugestoes: [] }), async (pedidos) => {
    assert.equal((await m.sugerirCategoriasIA({ ...lote, modelo: 'outro/modelo' })).sugestoes, null);
    assert.equal((await m.sugerirCategoriasIA({ ...lote, anuncios: [] })).sugestoes, null);
    assert.equal(pedidos.length, 0);
  });
  const chave = process.env.OPENROUTER_API_KEY; delete process.env.OPENROUTER_API_KEY;
  try { assert.equal((await m.sugerirCategoriasIA(lote)).sugestoes, null); } finally { if (chave !== undefined) process.env.OPENROUTER_API_KEY = chave; }
});

test('categorias IA: fila reserva, chama a IA e guarda; sem lote não chama ninguém', async () => {
  const chamadas = [];
  const db = (reserva) => ({ rpc: async (nome, args) => { chamadas.push([nome, args]); return nome === 'categorizacao_ia_reservar' ? { data: reserva, error: null } : { data: 1, error: null }; } });
  await comFetch(ok({ sugestoes: [{ anuncio_id: A1, categoria: 'moveis', confianca: 0.9 }] }), async (pedidos) => {
    assert.deepEqual(await modulo(() => db(null)).processarFilaCategorizacao(), { analisados: 0, sugeridos: 0 });
    assert.equal(pedidos.length, 0);
    assert.deepEqual(await modulo(() => db(lote)).processarFilaCategorizacao(), { analisados: 2, sugeridos: 1 });
    const fim = chamadas.find((c) => c[0] === 'categorizacao_ia_concluir')[1];
    assert.deepEqual(fim, { p_id: 'l', p_reserva: 'r', p_sugestoes: [{ anuncio_id: A1, categoria: 'moveis', confianca: 0.9 }], p_custo_usd: 0.002, p_tokens_entrada: 900, p_tokens_saida: 80 });
  });
  await assert.rejects(modulo(() => ({ rpc: async () => ({ data: null, error: { message: 'x' } }) })).processarFilaCategorizacao(), /fila_indisponivel/);
});

test('categorias IA: rota exige o segredo interno e não vaza erro', async () => {
  let chamadas = 0;
  const rota = carregar('src/app/api/interno/categorizacao/route.ts', {
    '@/lib/moderacao-ia': { segredoModeracaoConfere: (v) => v === 'Bearer permitido' },
    '@/lib/categorizacao-ia': { processarFilaCategorizacao: async () => { chamadas++; throw new Error('segredo interno'); } },
  });
  assert.equal((await rota.POST(new Request('https://t.local', { method: 'POST' }))).status, 401); assert.equal(chamadas, 0);
  const falha = await rota.POST(new Request('https://t.local', { method: 'POST', headers: { authorization: 'Bearer permitido' } }));
  assert.equal(falha.status, 503); assert.doesNotMatch(await falha.text(), /segredo/);
});

// ---------------- Tela "Revise suas categorias" ----------------
const loja = { id: '48000000-0000-4000-a000-000000000001', tipo: 'loja', dono_id: 'user_1', slug: 'loja-1', microrregiao_id: 'r' };
const nav = { useRouter: () => ({ refresh() {}, push() {} }), notFound: () => { throw Error('NOT_FOUND'); } };
const sugestoes = [
  { anuncio_id: A1, titulo: 'Sofá retrátil', foto: null, categoria_atual: 'Carros', sugerida_id: 'x', sugerida: 'Móveis' },
  { anuncio_id: A2, titulo: 'Geladeira', foto: '/g.png', categoria_atual: 'Carros', sugerida_id: 'y', sugerida: 'Eletrodomésticos' },
];
async function tela(op = {}) {
  const { default: Page } = carregar('src/app/(conta)/minha-conta/loja/categorias/page.tsx', {
    'next/navigation': nav,
    '@/lib/dados/vitrine-completa': { minhaVitrineCompleta: async () => (op.v === undefined ? loja : op.v), vitrineNovaAtiva: async () => op.ativa !== false },
    '@/lib/dados/categorias-ia': {
      minhasSugestoesCategoria: async () => (op.sugestoes === undefined ? sugestoes : op.sugestoes),
      minhaSugestaoNicho: async () => (op.nicho === undefined ? { nicho_id: null, nicho_nome: null, sugerido_id: 'n1', sugerido_nome: 'Casa e móveis' } : op.nicho),
      nichosDisponiveis: async () => [{ id: 'n1', nome: 'Casa e móveis' }, { id: 'n2', nome: 'Veículos' }],
    },
    '@/app/(conta)/minha-conta/loja/categorias/actions': {},
  });
  return render(await Page());
}

test('revise categorias: some com a vitrine nova desligada', async () => {
  await assert.rejects(tela({ ativa: false }), /NOT_FOUND/);
  assert.match(await tela({ v: null, ativa: false }), /Você ainda não tem uma loja/);
});

test('revise categorias: nicho sugerido, lista com aceitar e manter, e aceitar todas', async () => {
  const h = await tela();
  assert.match(h, /sua loja parece ser de <strong>Casa e móveis<\/strong>/); assert.match(h, /Sim, é isso/); assert.match(h, /value="n2">Veículos<\/option>/);
  assert.match(h, /2 sugestões da IA/); assert.match(h, /Aceitar todas/);
  assert.match(h, /aria-label="Aceitar Móveis para Sofá retrátil"/); assert.match(h, /aria-label="Manter a categoria atual de Geladeira"/);
  assert.match(h, /<strong class="text-texto">Eletrodomésticos<\/strong>/);
});

test('revise categorias: vazio, uma só, falha de leitura e nicho já escolhido', async () => {
  const vazio = await tela({ sugestoes: [], nicho: { nicho_id: 'n1', nicho_nome: 'Casa e móveis', sugerido_id: null, sugerido_nome: null } });
  assert.match(vazio, /Tudo organizado/); assert.match(vazio, /Nicho da loja: <strong>Casa e móveis<\/strong>/); assert.doesNotMatch(vazio, /Sim, é isso/);
  assert.doesNotMatch(await tela({ sugestoes: [sugestoes[0]] }), /Aceitar todas/);
  const falha = await tela({ sugestoes: null, nicho: null });
  assert.match(falha, /Não conseguimos carregar as sugestões/); assert.match(falha, /Não conseguimos carregar o nicho/);
});

// ---------------- Ações ----------------
function acoes(op = {}) {
  const chamadas = [];
  const a = carregar('src/app/(conta)/minha-conta/loja/categorias/actions.ts', {
    'next/cache': { revalidatePath: (...x) => chamadas.push(['cache', ...x]) },
    '@clerk/nextjs/server': { auth: async () => ({ userId: op.semLogin ? null : 'user_1' }) },
    '@/lib/dados/vitrine-completa': { minhaVitrineCompleta: async () => (op.v === undefined ? loja : op.v) },
    '@/lib/supabase/server': { createClient: async () => ({ rpc: async (n, args) => { chamadas.push([n, args]); if (op.rede) throw Error('x'); return { data: op.data ?? null, error: op.erro ?? null }; } }) },
  });
  return { a, chamadas };
}
test('revise categorias: ações validam, usam a loja da pessoa e não vazam erro', async () => {
  let { a, chamadas } = acoes();
  assert.equal((await a.decidirCategoria('nao-uuid', true)).ok, false); assert.equal(chamadas.length, 0);
  assert.equal((await a.decidirCategoria(A1, true)).ok, true); assert.deepEqual(chamadas[0], ['decidir_categoria_sugerida', { p_anuncio: A1, p_aceitar: true }]);
  ({ a, chamadas } = acoes({ data: 3 }));
  assert.deepEqual(await a.decidirTodasCategorias(true), { ok: true, dados: { decididas: 3 } }); assert.deepEqual(chamadas[0], ['decidir_todas_categorias', { p_vitrine: loja.id, p_aceitar: true }]);
  ({ a, chamadas } = acoes());
  assert.equal((await a.definirNicho(null)).ok, true); assert.deepEqual(chamadas[0], ['definir_nicho_loja', { p_vitrine: loja.id, p_nicho: null }]);
  assert.equal((await a.definirNicho('x')).ok, false);
  assert.equal((await acoes({ semLogin: true }).a.decidirTodasCategorias(true)).erro.codigo, '28000');
  assert.equal((await acoes({ v: { ...loja, tipo: 'pf' } }).a.definirNicho(null)).ok, false);
  const r = await acoes({ rede: true }).a.decidirCategoria(A1, false); assert.equal(r.ok, false); assert.match(r.erro.mensagem, /conexão falhou/);
  const e = await acoes({ erro: { code: '22023', message: 'Essa sugestão já foi decidida.' } }).a.decidirCategoria(A1, true); assert.equal(e.ok, false);
});
