const { test } = require('node:test');
const assert = require('node:assert/strict');
const { carregar } = require('./carregar.cjs');

// Etapa 3 das categorias: "busca que entende" (JEV só ao enviar a busca; sem IA, a busca normal).
const folha = (id, slug, nome) => ({ id, slug, nome, icone: '', filhas: [] });
const ARVORE = [
  { id: 'r1', slug: 'casa', nome: 'Casa', icone: '', filhas: [
    { id: 's1', slug: 'eletro', nome: 'Eletrodomésticos', icone: '', filhas: [folha('f1', 'geladeiras-e-freezers', 'Geladeiras e freezers')] },
  ] },
  { id: 'r2', slug: 'pet', nome: 'Pet', icone: '', filhas: [folha('f2', 'racao', 'Ração'), folha('f3', 'gatos', 'Gatos')] },
];
const lib = () => carregar('src/lib/busca-entendida.ts');
const resp = (answers) => new Response(JSON.stringify({ answers }), { status: 200 });
const prob = (o) => ({ choice: Object.keys(o)[0], probabilities: o });

async function comFetch(resposta, fn, { chave = 'teste' } = {}) {
  const antes = global.fetch, chaveAntes = process.env.TYPESAFE_API_KEY; const pedidos = [];
  global.fetch = async (url, op) => { pedidos.push({ url, op, corpo: JSON.parse(op.body) }); return typeof resposta === 'function' ? resposta() : resposta; };
  if (chave === null) delete process.env.TYPESAFE_API_KEY; else process.env.TYPESAFE_API_KEY = chave;
  try { return await fn(pedidos); } finally {
    global.fetch = antes;
    if (chaveAntes === undefined) delete process.env.TYPESAFE_API_KEY; else process.env.TYPESAFE_API_KEY = chaveAntes;
  }
}

test('números do texto: preço possível, sem pegar 150cc, ps5 nem a4', () => {
  const { numerosDoTexto: n } = lib();
  assert.deepEqual(n('geladeira usada até 800').map((x) => x.reais), [800]);
  assert.deepEqual(n('sofá por 1.500').map((x) => x.reais), [1500]);
  assert.deepEqual(n('moto até 2 mil').map((x) => x.reais), [2000]);
  assert.deepEqual(n('carro até R$ 1,5 mil').map((x) => x.reais), [1500]);
  assert.deepEqual(n('tv 800,50').map((x) => x.reais), [800.5]);
  assert.deepEqual(n('moto 150cc ps5 a4 s20'), []);
  assert.deepEqual(n('casa 2 quartos até 900').map((x) => x.reais), [2, 900]);
  assert.equal(n('1 2 3 4 5').length, 3);
  assert.deepEqual(n('0 reais'), []);
});

test('opções: só categorias finais e a saída "nenhuma"', () => {
  const { criteriosBusca } = lib();
  const { criterios, ids } = criteriosBusca(ARVORE);
  assert.deepEqual([...ids.keys()], ['geladeiras-e-freezers', 'racao', 'gatos']);
  assert.ok(criterios._nenhuma);
  assert.match(criterios['geladeiras-e-freezers'], /Casa › Eletrodomésticos › Geladeiras e freezers/);
  assert.match(criterios['geladeiras-e-freezers'], /Ex\.: .*geladeira/);
});

test('respostas: só passa o que tem chance suficiente; nunca inventa filtro', () => {
  const { lerRespostas, numerosDoTexto, criteriosBusca } = lib();
  const { ids } = criteriosBusca(ARVORE);
  const nums = numerosDoTexto('geladeira usada até 800');
  const boa = lerRespostas({
    categoria: prob({ 'geladeiras-e-freezers': 0.9, racao: 0.05, _nenhuma: 0.05 }),
    estado: prob({ usado: 0.92, novo: 0.03, nao_disse: 0.05 }),
    numero_0: prob({ preco_maximo: 0.95, outra_coisa: 0.05 }),
  }, ids, nums);
  assert.equal(boa.categoriaId, 'f1');
  assert.equal(boa.estado, 'usado');
  assert.equal(boa.precoMaxReais, 800);
  const duvida = lerRespostas({
    categoria: prob({ racao: 0.4, gatos: 0.35, _nenhuma: 0.25 }),
    estado: prob({ usado: 0.5, nao_disse: 0.5 }),
    numero_0: prob({ preco_maximo: 0.5, outra_coisa: 0.5 }),
  }, ids, nums);
  assert.deepEqual(duvida, { categoriaId: null, categoriaSlug: null, estado: null, precoMaxReais: null, numero: null });
  const nenhuma = lerRespostas({ categoria: prob({ _nenhuma: 0.8, racao: 0.2 }) }, ids, nums);
  assert.equal(nenhuma.categoriaId, null);
  for (const lixo of [null, 'x', [], { categoria: 5 }, { categoria: { probabilities: { racao: 'a' } } }]) {
    assert.equal(lerRespostas(lixo, ids, nums).categoriaId, null);
  }
});

test('texto que sobra: tira preço, ligação, estado, palavras da categoria e enfeites', () => {
  const { textoRestante: r, numerosDoTexto: n } = lib();
  const t1 = 'geladeira usada até 800';
  assert.equal(r(t1, { estado: 'usado', numero: n(t1)[0] }, ['Geladeiras e freezers', 'geladeira']), '');
  const t2 = 'moto honda 150 barata';
  assert.equal(r(t2, { estado: null, numero: null }, ['Motos', 'moto']), 'honda 150');
  const t3 = 'ração de gato por no máximo 2 mil reais';
  assert.equal(r(t3, { estado: null, numero: n(t3)[0] }, ['Ração', 'racao']), 'gato');
  // palavra de várias letras da categoria só sai inteira: "ar" não é arrancado de "ar condicionado"
  const t4 = 'ar condicionado split 12000 btu';
  assert.equal(r(t4, { estado: null, numero: null }, ['Ar e ventiladores', 'ventiladores', 'ar condicionado', 'split']), '12000 btu');
  assert.equal(r('ar de carro', { estado: null, numero: null }, ['Ar e ventiladores', 'ar condicionado']), 'ar carro');
  // estado não entendido: "usada" fica no texto (não some sem virar filtro)
  assert.equal(r('geladeira usada', { estado: null, numero: null }, ['geladeira']), 'usada');
});

test('JEV: pergunta categoria, estado e cada número; usa jev-latest e devolve o entendido', async () => {
  const { entenderBusca } = lib();
  const r = await comFetch(resp({
    categoria: prob({ 'geladeiras-e-freezers': 0.9, _nenhuma: 0.1 }),
    estado: prob({ usado: 0.9, nao_disse: 0.1 }),
    numero_0: prob({ preco_maximo: 0.9, outra_coisa: 0.1 }),
  }), async (pedidos) => {
    const e = await entenderBusca(ARVORE, 'geladeira usada até 800');
    assert.equal(pedidos.length, 1);
    assert.equal(pedidos[0].corpo.model, 'jev-latest');
    assert.deepEqual(Object.keys(pedidos[0].corpo.questions), ['categoria', 'estado', 'numero_0']);
    assert.equal(pedidos[0].corpo.state.busca_da_pessoa, 'geladeira usada até 800');
    return e;
  });
  assert.equal(r.categoriaSlug, 'geladeiras-e-freezers');
  assert.equal(r.precoMaxReais, 800);
});

test('JEV: sem chave, texto curto, erro, resposta estranha ou demora = null (busca normal)', async () => {
  const { entenderBusca } = lib();
  await comFetch(resp({}), async (p) => { assert.equal(await entenderBusca(ARVORE, 'geladeira'), null); assert.equal(p.length, 0); }, { chave: null });
  await comFetch(resp({}), async (p) => { assert.equal(await entenderBusca(ARVORE, 'ab'), null); assert.equal(p.length, 0); });
  await comFetch(new Response('{}', { status: 500 }), async () => assert.equal(await entenderBusca(ARVORE, 'geladeira'), null));
  await comFetch(new Response('não é json', { status: 200 }), async () => assert.equal(await entenderBusca(ARVORE, 'geladeira'), null));
  await comFetch(() => { throw new Error('rede'); }, async () => assert.equal(await entenderBusca(ARVORE, 'geladeira'), null));
  await comFetch(() => new Promise((_, rej) => rej(new DOMException('prazo', 'TimeoutError'))), async () => assert.equal(await entenderBusca(ARVORE, 'geladeira'), null));
});

test('freio: 10 por minuto por pessoa e 200 no total; a janela recomeça', () => {
  const { dentroDoLimiteBusca: ok } = lib();
  const t0 = 1_000_000;
  for (let i = 0; i < 10; i++) assert.equal(ok('a', t0 + i), true);
  assert.equal(ok('a', t0 + 20), false);
  assert.equal(ok('b', t0 + 21), true);
  assert.equal(ok('a', t0 + 61_000), true);
});

// ---- a ligação na tela (endereço novo com chips) ----
function ligacao({ entendida, total = 5, campos = [{ chave: 'estado', tipo: 'lista', filtro: true, opcoes: ['Novo', 'Seminovo', 'Usado'] }], key = 'k' }) {
  process.env.TYPESAFE_API_KEY = key;
  const buscas = [];
  const cat = { categoria: { slug: 'geladeiras-e-freezers', nome: 'Geladeiras e freezers', campos }, filhas: [] };
  const mod = carregar('src/components/busca/entender.ts', {
    'next/headers': { headers: async () => new Headers({ 'x-forwarded-for': `9.9.9.${Math.floor(Math.random() * 250)}` }) },
    '@/lib/dados/anuncios': { buscarAnuncios: async (p) => { buscas.push(p); return { anuncios: [], total: p.q ? total : 3 }; } },
    '@/lib/dados/categorias': { categoriaPorSlug: async () => cat, listarCategorias: async () => ARVORE },
    '@/lib/busca-entendida': { ...lib(), entenderBusca: async () => entendida, dentroDoLimiteBusca: () => true },
  });
  return { mod, buscas };
}
const ENT = { categoriaId: 'f1', categoriaSlug: 'geladeiras-e-freezers', estado: 'usado', precoMaxReais: 800, numero: { reais: 800, inicio: 20, fim: 23 } };

test('tela: "geladeira usada até 800" vira categoria + estado + preço máximo, com o texto original guardado', async () => {
  const { mod } = ligacao({ entendida: ENT });
  const url = await mod.enderecoEntendido({ q: 'geladeira usada até 800' }, 'geladeira usada até 800');
  const u = new URL(url, 'http://x');
  assert.equal(u.pathname, '/busca');
  assert.equal(u.searchParams.get('categoria'), 'geladeiras-e-freezers');
  assert.equal(u.searchParams.get('preco_max'), '800');
  assert.equal(u.searchParams.get('c_estado'), 'Usado');
  assert.equal(u.searchParams.get('ia'), 'geladeira usada até 800');
  assert.equal(u.searchParams.has('q'), false);
});

test('tela: estado só vira filtro se a categoria tem o campo Estado; preço com vírgula', async () => {
  const { mod } = ligacao({ entendida: { ...ENT, precoMaxReais: 800.5 }, campos: [] });
  const u = new URL(await mod.enderecoEntendido({ q: 'x geladeira' }, 'geladeira usada até 800,50'), 'http://x');
  assert.equal(u.searchParams.has('c_estado'), false);
  assert.equal(u.searchParams.get('preco_max'), '800,5');
});

test('tela: texto que sobra só entra se ainda houver resultado; senão cai fora', async () => {
  const entendida = { ...ENT, estado: null, precoMaxReais: null, numero: null };
  const com = ligacao({ entendida, total: 4 });
  let u = new URL(await com.mod.enderecoEntendido({ q: 'geladeira consul' }, 'geladeira consul'), 'http://x');
  assert.equal(u.searchParams.get('q'), 'consul');
  const sem = ligacao({ entendida, total: 0 });
  u = new URL(await sem.mod.enderecoEntendido({ q: 'geladeira consul' }, 'geladeira consul'), 'http://x');
  assert.equal(u.searchParams.has('q'), false);
  assert.equal(u.searchParams.get('categoria'), 'geladeiras-e-freezers');
});

test('tela: nada entendido, sem chave ou com filtros já no endereço = null (busca normal, sem pergunta)', async () => {
  const nada = { categoriaId: null, categoriaSlug: null, estado: null, precoMaxReais: null, numero: null };
  assert.equal(await ligacao({ entendida: nada }).mod.enderecoEntendido({ q: 'coisa' }, 'coisa boa'), null);
  assert.equal(await ligacao({ entendida: null }).mod.enderecoEntendido({ q: 'coisa' }, 'coisa boa'), null);
  const l = ligacao({ entendida: ENT });
  assert.equal(await l.mod.enderecoEntendido({ q: 'a', categoria: 'pet' }, 'geladeira usada'), null);
  assert.equal(await l.mod.enderecoEntendido({ q: 'a', preco_max: '5' }, 'geladeira usada'), null);
  assert.equal(await l.mod.enderecoEntendido({ q: 'a', pagina: '2' }, 'geladeira usada'), null);
  const antes = process.env.TYPESAFE_API_KEY; delete process.env.TYPESAFE_API_KEY;
  assert.equal(await l.mod.enderecoEntendido({ q: 'a' }, 'geladeira usada'), null);
  process.env.TYPESAFE_API_KEY = antes;
});

test('tela: cidade e ordem escolhidas seguem; nova busca depois da IA começa sem os filtros dela', () => {
  const { manterFiltros } = carregar('src/components/busca/parametros.ts');
  assert.deepEqual(manterFiltros({ categoria: 'pet', cidade: 'Corrente' }), { categoria: 'pet', cidade: 'Corrente' });
  assert.deepEqual(manterFiltros({ ia: 'geladeira usada até 800', categoria: 'geladeiras-e-freezers', preco_max: '800' }), {});
});
