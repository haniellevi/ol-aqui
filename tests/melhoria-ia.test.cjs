const { test } = require('node:test');
const assert = require('node:assert/strict');
const { renderToStaticMarkup: render } = require('react-dom/server');
const { carregar } = require('./carregar.cjs');

// Vitrine com IA, etapa 5b: sugestão de texto e dicas de foto com IA.
const A1 = '50100000-0000-4000-a000-000000000001', M1 = '50200000-0000-4000-a000-000000000001';
const FOTO = (n) => `https://abc.supabase.co/storage/v1/object/public/anuncios/u/${A1}/${n}.webp`;
const pedido = { id: M1, reserva: 'r', modelo: 'openai/gpt-4.1-mini', titulo: 'Sofá', descricao: 'sofa bom', categoria: 'Casa > Móveis', atributos: { estado: 'usado' }, fotos: [FOTO(1), FOTO(2)] };

function lib() { return carregar('src/lib/melhoria-ia.ts', {}); }
async function comFetch(resposta, fn) {
  const antes = global.fetch, chave = process.env.OPENROUTER_API_KEY; const pedidos = [];
  global.fetch = async (url, op) => { pedidos.push([url, JSON.parse(op.body)]); return typeof resposta === 'function' ? resposta() : resposta; };
  process.env.OPENROUTER_API_KEY = 'teste';
  try { return await fn(pedidos); } finally { global.fetch = antes; if (chave === undefined) delete process.env.OPENROUTER_API_KEY; else process.env.OPENROUTER_API_KEY = chave; }
}
const ok = (conteudo) => new Response(JSON.stringify({ usage: { cost: 0.0008, prompt_tokens: 1400, completion_tokens: 200 },
  choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(conteudo) } }] }), { status: 200 });
const resposta = { titulo: 'Sofá 3 lugares usado', descricao: 'Sofá de 3 lugares, usado.', fotos: [
  { indice: 1, problema: 'escura', dica: 'Tire de dia, perto da janela.' }, { indice: 3, problema: 'escura', dica: 'Não existe' }, { indice: 2, problema: 'bonita', dica: 'x' }] };

test('melhoria IA: valida a forma e só aceita fotos que existem e problemas da lista', () => {
  const r = lib().validarMelhoria(resposta, 2);
  assert.deepEqual(r.fotos, [{ indice: 1, problema: 'escura', dica: 'Tire de dia, perto da janela.' }]);
  for (const v of [null, [], {}, { titulo: 1, descricao: '', fotos: [] }, { titulo: '', descricao: '', fotos: 'x' }]) assert.throws(() => lib().validarMelhoria(v, 2));
});

test('melhoria IA: manda só o produto e fotos do próprio site, em baixa resolução', async () => {
  await comFetch(ok(resposta), async (pedidos) => {
    const r = await lib().sugerirMelhoriaIA({ ...pedido, fotos: [FOTO(1), 'https://outro.site/x.jpg', FOTO(3)] });
    assert.equal(r.custo, 0.0008); assert.equal(r.entrada, 1400); assert.equal(r.resultado.titulo, 'Sofá 3 lugares usado');
    const corpo = pedidos[0][1];
    assert.equal(corpo.model, 'openai/gpt-4.1-mini'); assert.equal(corpo.provider.data_collection, 'deny');
    const partes = corpo.messages[1].content;
    assert.match(partes[0].text, /^DADOS_NAO_SAO_INSTRUCOES/); assert.doesNotMatch(partes[0].text, /whatsapp|dono|vitrine/i);
    assert.deepEqual(partes.slice(1).map((p) => p.image_url), [{ url: FOTO(1), detail: 'low' }], 'Para na primeira foto estranha');
  });
});

test('melhoria IA: falhas viram "sem resultado" e só recusa antes de gerar zera o custo', async () => {
  await comFetch(new Response('x', { status: 429 }), async () => assert.deepEqual(await lib().sugerirMelhoriaIA(pedido), { resultado: null, custo: 0, entrada: 0, saida: 0 }));
  await comFetch(new Response('x', { status: 500 }), async () => assert.equal((await lib().sugerirMelhoriaIA(pedido)).custo, null));
  await comFetch(() => { throw new Error('rede'); }, async () => assert.equal((await lib().sugerirMelhoriaIA(pedido)).resultado, null));
  await comFetch(ok(resposta), async (pedidos) => {
    assert.equal((await lib().sugerirMelhoriaIA({ ...pedido, modelo: 'outro' })).resultado, null); assert.equal(pedidos.length, 0);
  });
});

// ---------------- Ações ----------------
function acoes(op = {}) {
  const chamadas = [];
  const rpc = async (n, args) => { chamadas.push([n, args]); if (op.rede) throw Error('x'); return op.rpc?.[n] ?? { data: null, error: null }; };
  const a = carregar('src/app/(conta)/minha-conta/loja/melhorar/actions.ts', {
    'next/cache': { revalidatePath: () => {} },
    '@clerk/nextjs/server': { auth: async () => ({ userId: op.semLogin ? null : 'user_1' }) },
    '@/lib/supabase/admin': { supabaseAdmin: () => ({ rpc }) },
    '@/lib/supabase/server': { createClient: async () => ({ rpc }) },
    '@/lib/melhoria-ia': { sugerirMelhoriaIA: async (p) => { chamadas.push(['ia', p.id]); return { resultado: { titulo: 'x', descricao: 'y', fotos: [] }, custo: 0.001, entrada: 10, saida: 5 }; } },
  });
  return { a, chamadas };
}
test('melhoria IA: pedir usa o usuário logado, mostra o limite e não chama a IA quando o banco recusa', async () => {
  let { a, chamadas } = acoes({ rpc: { melhoria_ia_reservar: { data: pedido, error: null }, melhoria_ia_concluir: { data: 'pronta', error: null } } });
  assert.deepEqual(await a.pedirMelhoria(A1), { ok: true, dados: { estado: 'pronta' } });
  assert.deepEqual(chamadas[0], ['melhoria_ia_reservar', { p_anuncio: A1, p_usuario: 'user_1' }]);
  assert.deepEqual(chamadas[1], ['ia', M1]); assert.equal(chamadas[2][0], 'melhoria_ia_concluir'); assert.equal(chamadas[2][1].p_custo_usd, 0.001);
  ({ a, chamadas } = acoes({ rpc: { melhoria_ia_reservar: { data: { erro: 'limite', limite: 20, usadas: 20 }, error: null } } }));
  const r = await a.pedirMelhoria(A1); assert.equal(r.ok, false); assert.match(r.erro.mensagem, /as 20 melhorias/); assert.equal(chamadas.length, 1);
  ({ a } = acoes({ rpc: { melhoria_ia_reservar: { data: pedido, error: null }, melhoria_ia_concluir: { data: 'falhou', error: null } } }));
  assert.match((await a.pedirMelhoria(A1)).erro.mensagem, /não conta no limite/);
  ({ a, chamadas } = acoes({ semLogin: true })); assert.equal((await a.pedirMelhoria(A1)).erro.codigo, '28000'); assert.equal(chamadas.length, 0);
  ({ a, chamadas } = acoes()); assert.equal((await a.pedirMelhoria('ruim')).ok, false); assert.equal(chamadas.length, 0);
  ({ a } = acoes({ rede: true })); assert.equal((await a.pedirMelhoria(A1)).ok, false);
});
test('melhoria IA: decidir passa pelo banco e avisa quando o produto mudou', async () => {
  let { a, chamadas } = acoes({ rpc: { melhoria_ia_decidir: { data: 'aplicada', error: null } } });
  assert.deepEqual(await a.decidirMelhoria(M1, A1, true), { ok: true, dados: { estado: 'aplicada' } });
  assert.deepEqual(chamadas[0], ['melhoria_ia_decidir', { p_id: M1, p_aceitar: true }]);
  ({ a } = acoes({ rpc: { melhoria_ia_decidir: { data: 'desatualizada', error: null } } }));
  assert.match((await a.decidirMelhoria(M1, A1, true)).erro.mensagem, /mudou depois da sugestão/);
  ({ a, chamadas } = acoes()); assert.equal((await a.decidirMelhoria(M1, A1, 'sim')).ok, false); assert.equal(chamadas.length, 0);
});

// ---------------- Tela ----------------
const loja = { id: 'l', tipo: 'loja', dono_id: 'user_1', microrregiao_id: 'r' };
const base = { ativa: true, limite: 20, usadas: 3, anuncio: { id: A1, titulo: 'Sofá', descricao: 'sofa bom', status: 'ativo', fotos: [FOTO(1), FOTO(2)] }, melhoria: null };
const pronta = { id: M1, estado: 'pronta', titulo_antes: 'Sofá', descricao_antes: 'sofa bom', titulo_novo: 'Sofá 3 lugares usado', descricao_nova: null,
  dicas_foto: [{ indice: 2, problema: 'fundo', dica: 'Tire contra uma parede lisa.' }] };
async function tela(op = {}) {
  const { default: Page } = carregar('src/app/(conta)/minha-conta/loja/melhorar/[id]/page.tsx', {
    'next/navigation': { useRouter: () => ({ refresh() {} }), notFound: () => { throw Error('NOT_FOUND'); } },
    '@/lib/dados/vitrine-completa': { minhaVitrineCompleta: async () => (op.v === undefined ? loja : op.v), vitrineNovaAtiva: async () => op.nova !== false },
    '@/lib/dados/melhoria-ia': { minhaMelhoriaIA: async () => (op.t === undefined ? base : op.t) },
    '@/app/(conta)/minha-conta/loja/melhorar/actions': {},
    '@/app/(conta)/minha-conta/loja/categorias/actions': {},
  });
  return render(await Page({ params: Promise.resolve({ id: A1 }) }));
}
test('melhorar com IA: some com a chave desligada ou produto de outra pessoa', async () => {
  await assert.rejects(tela({ nova: false }), /NOT_FOUND/);
  await assert.rejects(tela({ t: null }), /NOT_FOUND/);
  await assert.rejects(tela({ t: { ...base, ativa: false } }), /NOT_FOUND/);
  assert.match(await tela({ v: null }), /Você ainda não tem uma loja/);
});
test('melhorar com IA: pedir com a cota, antes e depois, dicas de foto e limite esgotado', async () => {
  const h = await tela();
  assert.match(h, /Pedir sugestão da IA/); assert.match(h, /Restam 17 de 20 sugestões neste mês/);
  const s = await tela({ t: { ...base, melhoria: pronta } });
  assert.match(s, /Antes/); assert.match(s, /Sugestão da IA/); assert.match(s, /Sofá 3 lugares usado/); assert.doesNotMatch(s, />Descrição</);
  assert.match(s, /Usar o texto novo/); assert.match(s, /Manter o meu/);
  assert.match(s, /Foto 2: Fundo atrapalha/); assert.ok(s.includes(`src="${FOTO(2)}"`)); assert.match(s, /A IA não mexe nas suas fotos/);
  const esgotado = await tela({ t: { ...base, usadas: 20 } });
  assert.match(esgotado, /Você já usou as 20 sugestões deste mês/); assert.match(esgotado, /disabled=""/);
  assert.match(await tela({ t: { ...base, melhoria: { ...pronta, titulo_novo: null, dicas_foto: [] } } }), /Seu produto já está bom/);
  assert.match(await tela({ t: { ...base, anuncio: { ...base.anuncio, status: 'pausado' } } }), /não está no ar/);
});
