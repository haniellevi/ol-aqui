const { test } = require('node:test');
const assert = require('node:assert/strict');
const { renderToStaticMarkup: render } = require('react-dom/server');
const { carregar } = require('./carregar.cjs');

// Vitrine com IA, etapa 5a: contagem na página da loja, números do dono e dicas por regra.
const LOJA = '49000000-0000-4000-a000-000000000001', P1 = '49100000-0000-4000-a000-000000000001', P2 = '49100000-0000-4000-a000-000000000002';

// ---------------- Ação que conta visita e cliques ----------------
function acao(op = {}) {
  const chamadas = [];
  const a = carregar('src/app/(publico)/loja/[slug]/actions.ts', {
    'next/headers': { cookies: async () => ({ get: () => ({ value: '91000000-0000-4000-a000-000000000001' }) }) },
    '@/lib/metricas/gate-servidor': { permiteEstatistica: async () => !op.negado },
    '@clerk/nextjs/server': { auth: async () => ({ userId: op.usuario ?? null }) },
    '@/lib/supabase/admin': { supabaseAdmin: () => ({ rpc: async (n, args) => { chamadas.push([n, args]); if (op.rede) throw Error('x'); return { data: op.data ?? true, error: op.erro ?? null }; } }) },
  });
  return { a, chamadas };
}
test('painel da loja: ação conta pelo servidor com navegador consentido e nunca lança erro', async () => {
  let { a, chamadas } = acao({ usuario: 'user_9' });
  assert.equal(await a.registrarEventoLoja(LOJA, 'visita'), true);
  assert.deepEqual(chamadas[0], ['registrar_evento_loja', { p_vitrine: LOJA, p_tipo: 'visita', p_visitante: '91000000-0000-4000-a000-000000000001', p_usuario: 'user_9' }]);
  assert.equal(await a.registrarEventoLoja('nao-uuid', 'visita'), false);
  assert.equal(await a.registrarEventoLoja(LOJA, 'compra'), false); assert.equal(chamadas.length, 1);
  ({ a, chamadas } = acao({ semIp: true, data: false }));
  assert.equal(await a.registrarEventoLoja(LOJA, 'clique_mapa'), false); assert.equal(chamadas[0][1].p_visitante, '91000000-0000-4000-a000-000000000001');
  ({ a, chamadas } = acao({ negado: true }));
  assert.equal(await a.registrarEventoLoja(LOJA, 'visita'), false); assert.equal(chamadas.length, 0);
  ({ a } = acao({ rede: true })); assert.equal(await a.registrarEventoLoja(LOJA, 'clique_whatsapp'), false);
  ({ a } = acao({ erro: { message: 'x' } })); assert.equal(await a.registrarEventoLoja(LOJA, 'visita'), false);
});

// ---------------- Leitura dos números ----------------
function dados(resposta) {
  const chamadas = [];
  const m = carregar('src/lib/dados/painel-loja.ts', {
    '@/lib/supabase/server': { createClient: async () => ({ rpc: async (n, args) => { chamadas.push([n, args]); return typeof resposta === 'function' ? resposta(n) : resposta; } }) },
  });
  return { m, chamadas };
}
test('painel da loja: números limpos, só https nas fotos e dicas com motivo conhecido', async () => {
  let { m, chamadas } = dados({ data: { dias: 30, atual: { visitas: 3, visualizacoes: -1, cliques_whatsapp: 'x' }, anterior: null,
    mais_vistos: [{ anuncio_id: P1, titulo: ' ', foto: 'javascript:x', visualizacoes: 4, cliques: 1 }, { anuncio_id: 'ruim' }] }, error: null });
  const d = await m.meuDesempenhoLoja(LOJA, 30);
  assert.deepEqual(chamadas[0], ['minha_loja_desempenho', { p_vitrine: LOJA, p_dias: 30 }]);
  assert.deepEqual(d.atual, { visitas: 3, visualizacoes: 0, cliques_whatsapp: 0, cliques_mapa: 0, favoritos: 0 });
  assert.deepEqual(d.mais_vistos, [{ anuncio_id: P1, titulo: 'Produto', foto: null, visualizacoes: 4, cliques: 1 }]);
  assert.equal(await m.meuDesempenhoLoja('ruim', 7), null);
  ({ m } = dados({ data: null, error: { message: 'x' } })); assert.equal(await m.meuDesempenhoLoja(LOJA, 7), null);
  ({ m } = dados({ data: [{ anuncio_id: P1, titulo: 'Sofá', motivo: 'sem_foto', texto: 'Coloque uma foto.' }, { anuncio_id: P2, titulo: 'Mesa', motivo: 'inventado', texto: 'x' }], error: null }));
  assert.deepEqual(await m.minhasDicasLoja(LOJA), [{ anuncio_id: P1, titulo: 'Sofá', motivo: 'sem_foto', texto: 'Coloque uma foto.' }]);
});

// ---------------- Tela "Desempenho da loja" ----------------
const loja = { id: LOJA, tipo: 'loja', dono_id: 'user_1', slug: 'loja-1', microrregiao_id: 'r' };
const nav = { notFound: () => { throw Error('NOT_FOUND'); } };
const zero = { visitas: 0, visualizacoes: 0, cliques_whatsapp: 0, cliques_mapa: 0, favoritos: 0 };
const desempenho = { dias: 7, atual: { visitas: 12, visualizacoes: 40, cliques_whatsapp: 5, cliques_mapa: 2, favoritos: 1 },
  anterior: { visitas: 10, visualizacoes: 40, cliques_whatsapp: 7, cliques_mapa: 0, favoritos: 0 },
  mais_vistos: [{ anuncio_id: P2, titulo: 'Mesa de jantar', foto: null, visualizacoes: 25, cliques: 1 }] };
const dicas = [{ anuncio_id: P1, titulo: 'Sofá', motivo: 'sem_foto', texto: 'Coloque uma foto. Produto sem foto quase não recebe contato.' },
  { anuncio_id: P2, titulo: 'Mesa de jantar', motivo: 'sem_preco', texto: 'Mostre o preço.' }];
async function tela(op = {}) {
  const pedidos = [];
  const { default: Page } = carregar('src/app/(conta)/minha-conta/loja/desempenho/page.tsx', {
    'next/navigation': nav,
    '@/lib/dados/vitrine-completa': { minhaVitrineCompleta: async () => (op.v === undefined ? loja : op.v), vitrineNovaAtiva: async () => op.ativa !== false, melhoriaIAAtiva: async () => !!op.ia },
    '@/lib/dados/painel-loja': {
      meuDesempenhoLoja: async (id, dias) => { pedidos.push(dias); return op.d === undefined ? { ...desempenho, dias } : op.d; },
      minhasDicasLoja: async () => (op.dicas === undefined ? dicas : op.dicas),
    },
  });
  const h = render(await Page({ searchParams: Promise.resolve(op.sp ?? {}) }));
  return { h, pedidos };
}
test('desempenho da loja: some com a vitrine nova desligada', async () => {
  await assert.rejects(tela({ ativa: false }), /NOT_FOUND/);
  assert.match((await tela({ v: null, ativa: false })).h, /Você ainda não tem uma loja/);
});
test('desempenho da loja: números com comparação, mais vistos e dicas com link de edição', async () => {
  const { h, pedidos } = await tela();
  assert.deepEqual(pedidos, [7]);
  assert.match(h, /Visitas na loja/); assert.match(h, />12</); assert.match(h, /2 a mais que na semana anterior/);
  assert.match(h, /2 a menos que na semana anterior/); assert.match(h, /Igual à semana anterior/);
  assert.match(h, /Mesa de jantar/); assert.match(h, /25 vistas · 1 clique no WhatsApp/);
  assert.match(h, /href="\/anunciar\/fotos\?rascunho=49100000-0000-4000-a000-000000000001&amp;editar=1"/);
  assert.match(h, /href="\/anunciar\/preco\?rascunho=49100000-0000-4000-a000-000000000002&amp;editar=1"/);
  assert.match(h, /aria-current="true"[^>]*>.*Últimos 7 dias/s);
  assert.doesNotMatch(h, /Melhorar com IA/, 'Sem IA ligada, sem atalho');
  assert.match((await tela({ ia: true })).h, /href="\/minha-conta\/loja\/melhorar\/49100000-0000-4000-a000-000000000001"/);
});
test('desempenho da loja: 30 dias, sem visitas, sem dicas e falhas de leitura', async () => {
  const { h, pedidos } = await tela({ sp: { dias: '30' }, d: { dias: 30, atual: zero, anterior: zero, mais_vistos: [] }, dicas: [] });
  assert.deepEqual(pedidos, [30]); assert.match(h, /Igual aos 30 dias anteriores/);
  assert.match(h, /Nenhum produto foi visto neste período/); assert.match(h, /Ainda não há sugestões para seus anúncios/);
  assert.doesNotMatch(h, /Seus produtos têm foto, preço e boa descrição/);
  assert.deepEqual((await tela({ sp: { dias: '99' } })).pedidos, [7]);
  const falha = (await tela({ d: null, dicas: null })).h;
  assert.match(falha, /Não conseguimos carregar os números/); assert.match(falha, /Não conseguimos carregar as dicas/); assert.doesNotMatch(falha, /Produtos mais vistos/);
});

test('números por produto mostram eventos e mantêm os detalhes acessíveis', () => {
  const { NumerosProdutos } = carregar('src/app/(conta)/minha-conta/loja/desempenho/numeros-produtos.tsx', {
    '@/lib/dados/metricas-produtos': { PERIODOS_PRODUTOS: [7, 30, 90] },
  });
  const produto = { anuncio_id: P1, titulo: 'Sofá', foto: null, status: 'ativo', aparicoes: 10,
    visualizacoes: 4, cliques_whatsapp: 2, favoritos: 1, posicao_media: 2, pct_chamou: 50,
    termos: [{ termo: 'sofá', vezes: 3 }], tempo_ate_sair_dias: null };
  const html = render(require('react').createElement(NumerosProdutos, { lista: [produto], periodo: 30, diasDaLoja: 7 }));
  assert.match(html, /Visualizações/);
  assert.match(html, /Cliques no WhatsApp/);
  assert.doesNotMatch(html, /Pessoas que abriram|Chamaram no WhatsApp/);
  assert.match(html, /<details[^>]*>.*Mais detalhes/s);
  assert.match(html, /Cliques a cada 100 visualizações/);
  assert.match(html, /sofá \(3\)/);
});
