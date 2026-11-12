const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { carregar } = require('./carregar.cjs');

// Categorias etapa 2: guardar o que a IA sugeriu e a categoria escolhida, e o painel "Acertos da IA".
const folha = (id, slug, nome) => ({ id, slug, nome, icone: '', filhas: [] });
const ARVORE = [
  { id: 'r1', slug: 'pet', nome: 'Pet', icone: '', filhas: [folha('f1', 'racao', 'Ração'), folha('f2', 'cachorros', 'Cachorros')] },
  { id: 'r2', slug: 'casa', nome: 'Casa', icone: '', filhas: [folha('f3', 'sofas-e-poltronas', 'Sofás e poltronas')] },
];
const ANUNCIO = '11111111-1111-4111-a111-111111111111';

async function comFetch(resposta, fn, { chave = 'teste' } = {}) {
  const antes = global.fetch, chaveAntes = process.env.TYPESAFE_API_KEY; const pedidos = [];
  global.fetch = async (url, op) => { pedidos.push({ url, op }); return typeof resposta === 'function' ? resposta() : resposta; };
  if (chave === null) delete process.env.TYPESAFE_API_KEY; else process.env.TYPESAFE_API_KEY = chave;
  try { return await fn(pedidos); } finally {
    global.fetch = antes;
    if (chaveAntes === undefined) delete process.env.TYPESAFE_API_KEY; else process.env.TYPESAFE_API_KEY = chaveAntes;
  }
}
const chances = (probabilities) => new Response(JSON.stringify({ answers: { categoria: { choice: Object.keys(probabilities)[0], probabilities } } }), { status: 200 });

// ---------- Lib da IA: falhou (null) x respondeu sem opção ([]) ----------
test('perguntarCategorias: null quando a IA não respondeu; [] quando respondeu sem opção de 5%', async () => {
  const m = () => carregar('src/lib/sugestao-categoria-ia.ts');
  await comFetch(chances({ racao: 0.9, cachorros: 0.08 }), async () => {
    assert.deepEqual(await m().perguntarCategorias(ARVORE, 'Ração 15kg'), [{ id: 'f1', chance: 0.9 }, { id: 'f2', chance: 0.08 }]);
  });
  await comFetch(chances({ racao: 0.03, cachorros: 0.02 }), async () => {
    assert.deepEqual(await m().perguntarCategorias(ARVORE, 'asdf qwer'), []);
    assert.deepEqual(await m().categoriasMaisProvaveis(ARVORE, 'asdf qwer'), []);
  });
  await comFetch(chances({ racao: 0.9 }), async () => assert.equal(await m().perguntarCategorias(ARVORE, 'Ração'), null), { chave: null });
  const ruins = [
    () => new Response('{}', { status: 500 }),
    () => { throw new DOMException('demorou', 'TimeoutError'); },
    () => new Response('não é json', { status: 200 }),
    () => new Response(JSON.stringify({ answers: {} }), { status: 200 }),
    () => new Response(JSON.stringify({ answers: { categoria: { probabilities: [0.9] } } }), { status: 200 }),
  ];
  for (const ruim of ruins) {
    await comFetch(ruim, async () => {
      assert.equal(await m().perguntarCategorias(ARVORE, 'Ração'), null);
      assert.deepEqual(await m().categoriasMaisProvaveis(ARVORE, 'Ração'), []);
    });
  }
});

// ---------- Ações do Anunciar ----------
function acoes({ userId = 'user_loja', rpcFalha = false, anuncio = null } = {}) {
  const rpcs = [];
  const db = {
    rpc: async (nome, args) => { rpcs.push({ nome, args }); if (rpcFalha) throw new Error('banco fora'); return { data: true, error: null }; },
  };
  const mocks = {
    '@clerk/nextjs/server': { auth: async () => ({ userId }) },
    '@/lib/supabase/server': { createClient: async () => db },
    '@/lib/dados/anuncios': { anuncioDaLoja: async () => anuncio },
    '@/lib/dados/conta': { contaDaLoja: async () => null },
    '@/lib/dados/categorias': { categoriaPorId: async () => null, categoriaDoAnuncio: async () => null, listarCategorias: async () => ARVORE },
    '@/lib/dados/regiao': { listarCidades: async () => [] },
    '@/lib/dados/config': { lerConfigNumero: async () => null },
    '@/lib/dados/cobranca': { avulsoParaMim: async () => null },
    '@/lib/asaas': { asaasConfigurado: () => false },
    'next/navigation': { redirect: (url) => { throw Error(`redirect:${url}`); }, unstable_rethrow: () => {} },
  };
  return { a: carregar('src/app/(conta)/anunciar/actions.ts', mocks), rpcs };
}

test('ação: guarda o texto limpo e as sugestões com a chance, para o anúncio, e devolve os ids', async () => {
  await comFetch(chances({ cachorros: 0.7, racao: 0.2 }), async () => {
    const { a, rpcs } = acoes();
    assert.deepEqual(await a.categoriasSugeridasIA('  filhote   de poodle ', ANUNCIO), ['f2', 'f1']);
    assert.deepEqual(rpcs, [{ nome: 'registrar_sugestao_categoria_ia', args: {
      p_anuncio: ANUNCIO, p_texto: 'filhote de poodle', p_sugestoes: [{ id: 'f2', chance: 0.7 }, { id: 'f1', chance: 0.2 }] } }]);
  });
});

test('ação: resposta sem opção também é guardada (lista vazia)', async () => {
  await comFetch(chances({ racao: 0.01 }), async () => {
    const { a, rpcs } = acoes();
    assert.deepEqual(await a.categoriasSugeridasIA('asdf qwer', ANUNCIO), []);
    assert.deepEqual(rpcs.map((r) => r.args.p_sugestoes), [[]]);
  });
});

test('ação: sem id válido, IA fora ou sem login, não guarda nada; erro ao guardar não tira as sugestões', async () => {
  await comFetch(() => chances({ racao: 0.9 }), async () => {
    for (const id of [undefined, '', 'x', `${ANUNCIO}0`]) {
      const { a, rpcs } = acoes();
      assert.deepEqual(await a.categoriasSugeridasIA('Ração', id), ['f1']);
      assert.equal(rpcs.length, 0);
    }
    const sem = acoes({ userId: null });
    assert.deepEqual(await sem.a.categoriasSugeridasIA('Ração', ANUNCIO), []);
    assert.equal(sem.rpcs.length, 0);
    const quebrado = acoes({ rpcFalha: true });
    assert.deepEqual(await quebrado.a.categoriasSugeridasIA('Ração', ANUNCIO), ['f1']);
  });
  await comFetch(() => new Response('{}', { status: 500 }), async () => {
    const { a, rpcs } = acoes();
    assert.deepEqual(await a.categoriasSugeridasIA('Ração', ANUNCIO), []);
    assert.equal(rpcs.length, 0, 'IA falhou: nada guardado');
  });
});

test('salvar categoria: guarda a escolha (o banco lê a categoria do anúncio) antes de seguir', async () => {
  const anuncio = { id: ANUNCIO, status: 'ativo', categoria_id: 'f1', publicado_em: '2026-11-01', titulo: 'Ração', atributos: {}, atualizado_em: 'v1' };
  const form = new FormData();
  form.set('id', ANUNCIO); form.set('acao', 'seguir'); form.set('categoria_id', 'f1');
  const semIA = acoes({ anuncio });
  await assert.rejects(semIA.a.salvarCategoria(null, form), /redirect:/);
  assert.deepEqual(semIA.rpcs, [], 'sem sugestão da IA na tela: nada a medir');
  form.set('texto_ia', '  ração   golden ');
  const { a, rpcs } = acoes({ anuncio });
  await assert.rejects(a.salvarCategoria(null, form), /redirect:/);
  assert.deepEqual(rpcs, [{ nome: 'registrar_escolha_categoria_ia', args: { p_anuncio: ANUNCIO, p_texto: 'ração golden' } }]);
  const quebrado = acoes({ anuncio, rpcFalha: true });
  await assert.rejects(quebrado.a.salvarCategoria(null, form), /redirect:/, 'erro ao guardar não segura quem anuncia');
});

test('tela do Anunciar: manda o id do anúncio e o texto das sugestões que estão na tela', () => {
  const tela = fs.readFileSync('src/components/anunciar/escolha-categoria.tsx', 'utf8');
  assert.match(tela, /categoriasSugeridasIA\(texto, id\)/);
  assert.match(tela, /name="texto_ia" value=\{ia\.texto && ia\.texto === textoDaBusca\(busca\) \? ia\.texto : ""\}/, 'só manda o texto se as sugestões dele estão na tela');
});

// ---------- Painel ----------
const painel = () => carregar('src/lib/admin/acertos-ia.ts');
const RESPOSTA = {
  dias: 30, total: 4, acertou_1: 1, acertou_3: 2, sem_sugestao: 1,
  erros: [
    { anuncio_id: 'a4', texto: 'filhote de poodle', sugestoes: [{ id: 'c1', chance: 0.5 }, { id: 'c2', chance: 0.3 }], escolhida_id: 'c2', escolhida_em: '2026-11-12T14:00:00Z', entre_as_3: true },
    { anuncio_id: 'a3', texto: 'asdf qwer', sugestoes: [], escolhida_id: 'c1', escolhida_em: '2026-11-12T13:00:00Z', entre_as_3: false },
  ],
};

test('painel: período 7, 30 ou 90; o resto vira 30', () => {
  const m = painel();
  assert.equal(m.periodoAcertos('7'), 7);
  assert.equal(m.periodoAcertos('90'), 90);
  for (const v of [undefined, '', '15', 'abc', '30.5', ['7']]) assert.equal(m.periodoAcertos(v), 30);
});

test('painel: lê a resposta do banco e recusa forma estranha', () => {
  const m = painel();
  assert.deepEqual(m.lerResposta(RESPOSTA), RESPOSTA);
  const quebras = [
    null, [], 'x',
    { ...RESPOSTA, total: -1 },
    { ...RESPOSTA, acertou_1: 3 },              // mais acertos na 1ª que entre as 3
    { ...RESPOSTA, acertou_3: 5 },              // mais que o total
    { ...RESPOSTA, erros: null },
    { ...RESPOSTA, erros: [{ ...RESPOSTA.erros[0], sugestoes: [{ id: 'c1', chance: 2 }] }] },
    { ...RESPOSTA, erros: [{ ...RESPOSTA.erros[0], sugestoes: [1, 2, 3, 4] }] },
    { ...RESPOSTA, erros: [{ ...RESPOSTA.erros[0], texto: '' }] },
    { ...RESPOSTA, erros: [{ ...RESPOSTA.erros[0], entre_as_3: 'sim' }] },
  ];
  for (const q of quebras) assert.equal(m.lerResposta(q), null, JSON.stringify(q));
});

test('painel: chama a função do admin com o período; erro do banco vira null', async () => {
  const m = painel();
  const chamadas = [];
  const db = (resposta) => ({ rpc: async (nome, args) => { chamadas.push({ nome, args }); return resposta; } });
  assert.deepEqual(await m.lerAcertosIA(db({ data: RESPOSTA, error: null }), 90), RESPOSTA);
  assert.deepEqual(chamadas, [{ nome: 'admin_acertos_categoria_ia', args: { p_dias: 90 } }]);
  assert.equal(await m.lerAcertosIA(db({ data: null, error: { message: 'Acesso restrito.' } }), 30), null);
});

test('painel: porcentagem e chance em texto', () => {
  const m = painel();
  assert.equal(m.porcentagem(1, 4), '25%');
  assert.equal(m.porcentagem(2, 3), '67%');
  assert.equal(m.porcentagem(0, 0), '—');
  assert.equal(m.chanceEmTexto(0.8123), '81%');
  assert.equal(m.chanceEmTexto(0.004), 'menos de 1%');
  assert.equal(m.chanceEmTexto(1), '100%');
});

test('migração: RLS ligada, leitura só do admin e nada de escrita direta', () => {
  const sql = fs.readFileSync('supabase/migrations/20261116020000_acertos_categoria_ia.sql', 'utf8');
  assert.match(sql, /alter table public\.categorias_ia_escolhas enable row level security/);
  assert.match(sql, /for select using \(public\.e_admin\(\)\)/);
  assert.match(sql, /revoke all on public\.categorias_ia_escolhas from public, anon, authenticated;/);
  assert.match(sql, /grant select on public\.categorias_ia_escolhas to authenticated;/);
  assert.doesNotMatch(sql, /grant (insert|update|delete|all)[^;]*categorias_ia_escolhas/i);
  assert.match(sql, /pode_mexer_vitrine\(a\.vitrine_id\)/);
});
