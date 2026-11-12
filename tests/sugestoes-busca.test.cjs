const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup: render } = require('react-dom/server');
const { carregar } = require('./carregar.cjs');

const s = carregar('src/lib/sugestoes-busca.ts');
const folha = (id, nome, slug = id) => ({ id, slug, nome, icone: '', filhas: [] });
const arvore = [
  { id: 'casa', slug: 'casa', nome: 'Casa e Eletro', icone: '', filhas: [
    { id: 'eletro', slug: 'eletrodomesticos', nome: 'Eletrodomésticos', icone: '', filhas: [
      folha('geladeiras-e-freezers', 'Geladeiras e freezers'), folha('fogoes', 'Fogões'),
    ] },
  ] },
  { id: 'veiculos', slug: 'veiculos', nome: 'Veículos', icone: '', filhas: [folha('motos', 'Motos'), folha('carros', 'Carros')] },
];

test('texto curto não pede sugestão; acento e espaço não contam como letra', () => {
  assert.equal(s.termoSugestao('g'), '');
  assert.equal(s.termoSugestao('  '), '');
  assert.equal(s.termoSugestao('é '), '');
  assert.equal(s.termoSugestao(' ge '), 'ge');
  assert.equal(s.termoSugestao('x'.repeat(200)).length, 120);
});

test('combina pelo começo das palavras, sem acento e sem maiúscula', () => {
  assert.ok(s.combina('Padaria Pão Quente', 'PAD pao'));
  assert.ok(s.combina('Fogões', 'foga') === false);
  assert.ok(s.combina('Fogões', 'FOGO'));
  assert.ok(s.combina('Decoração', 'racao') === false);
  assert.ok(s.combina('Loja', '') === false);
});

test('categorias: pelo nome e pelas palavras de exemplo, com caminho e link canônico', () => {
  const gel = s.sugerirCategorias(arvore, 'gela');
  assert.deepEqual(gel, [{ tipo: 'categoria', nome: 'Geladeiras e freezers', detalhe: 'Casa e Eletro › Eletrodomésticos', href: '/c/eletrodomesticos/geladeiras-e-freezers' }]);
  // "frigobar" não está no nome: vem das palavras de exemplo (categorias-palavras.ts)
  assert.equal(s.sugerirCategorias(arvore, 'frigo')[0].nome, 'Geladeiras e freezers');
  assert.equal(s.sugerirCategorias(arvore, 'MOTO')[0].href, '/c/veiculos/motos');
  assert.ok(s.sugerirCategorias(arvore, 've').length <= s.LIMITE_CATEGORIAS);
  assert.deepEqual(s.sugerirCategorias(arvore, 'xyzw'), []);
  // o nome da categoria de cima não basta: "eletro" não sugere Fogões nem Geladeiras
  assert.deepEqual(s.sugerirCategorias(arvore, 'eletro'), []);
});

test('vários começos de palavra também perguntam ao banco só pela maior palavra', () => {
  assert.deepEqual(s.consultasAnuncios(' gela '), ['gela']);
  assert.deepEqual(s.consultasAnuncios('ge bras'), ['ge bras', 'bras']);
  assert.deepEqual(s.consultasAnuncios('Gelá-Br'), ['Gelá-Br', 'gela']);
});

test('anúncios: só os que têm o título combinando (o banco também acha pela descrição)', () => {
  const r = s.filtrarAnuncios([{ titulo: 'Fogão 4 bocas' }, { titulo: 'GELADEIRA usada' }, { titulo: 'Geladeira nova' }], 'gela', 1);
  assert.deepEqual(r, [{ titulo: 'GELADEIRA usada' }]);
});

test('lojas: no máximo 3, na ordem recebida, nome como veio do banco', () => {
  const lojas = ['MOTO PEÇAS CORRENTE', 'Moto Center', 'Motoca', 'Motos do Zé', 'Padaria'].map((nome, i) => ({ nome, cidade: 'Corrente', href: `/loja/${i}` }));
  const r = s.filtrarLojas(lojas, 'moto');
  assert.equal(r.length, 3);
  assert.deepEqual(r.map((l) => l.nome), ['MOTO PEÇAS CORRENTE', 'Moto Center', 'Motoca']);
  assert.deepEqual(r[0], { tipo: 'loja', nome: 'MOTO PEÇAS CORRENTE', detalhe: 'Corrente', href: '/loja/0' });
});

function dados({ falhar = {}, lojasTotal = 2 } = {}) {
  const chamadas = { anuncios: [], lojas: [] };
  const regiao = { id: 'r1', slug: 'corrente-pi', nome: 'Corrente', cidadeSede: 'Corrente', cidade: 'Corrente' };
  const mod = carregar('src/lib/dados/sugestoes-busca.ts', {
    '@/lib/dados/regiao': { regiaoAtual: async () => regiao },
    '@/lib/dados/seguro': { seguro: async (f, padrao) => { try { return await f(); } catch { return padrao; } } },
    '@/lib/dados/categorias': {
      listarCategorias: async () => { if (falhar.categorias) throw new Error('x'); return arvore; },
      totaisCategorias: async () => new Map([['geladeiras-e-freezers', 2], ['eletro', 2], ['casa', 2], ['motos', 1], ['veiculos', 1]]),
    },
    '@/lib/dados/catalogo': {
      lojasCatalogo: async (_r, _n, limite, offset = 0) => {
        chamadas.lojas.push(offset);
        if (falhar.lojas) throw new Error('x');
        return offset === 0 ? [{ id: 'l1', slug: 'gela-bem', nome: 'GELA BEM', cidade: 'Corrente', total: lojasTotal }] : [{ id: 'l2', slug: 'gelo', nome: 'Gelo Frio', cidade: 'Parnaguá', total: lojasTotal }];
      },
    },
    '@/lib/dados/anuncios': {
      buscarAnuncios: async (p) => {
        chamadas.anuncios.push(p);
        if (falhar.anuncios) throw new Error('x');
        return { anuncios: [{ id: 'a0', slug: 'fogao', titulo: 'Fogão 4 bocas', preco_centavos: null, cidade: 'Corrente' }, { id: 'a1', slug: 'geladeira-a1', titulo: 'GELADEIRA BRASTEMP', preco_centavos: 80000, cidade: 'Corrente' }], total: 2 };
      },
    },
  });
  return { mod, chamadas };
}

test('sugestões juntam categorias com anúncio, lojas e anúncios da região escolhida', async () => {
  const { mod, chamadas } = dados();
  const r = await mod.sugestoesBusca('gel');
  assert.deepEqual(r.categorias.map((c) => c.nome), ['Geladeiras e freezers']);
  assert.deepEqual(r.lojas, [{ tipo: 'loja', nome: 'GELA BEM', detalhe: 'Corrente', href: '/loja/gela-bem' }]);
  assert.deepEqual(r.anuncios.map((a) => a.nome), ['GELADEIRA BRASTEMP']);
  assert.equal(r.anuncios[0].href, '/anuncio/geladeira-a1');
  assert.match(r.anuncios[0].detalhe, /^R\$\s?800 · Corrente$/);
  assert.deepEqual(chamadas.anuncios, [{ q: 'gel', regiao: 'corrente-pi', limite: 15 }]);
  assert.deepEqual(chamadas.lojas, [0]);
});

test('"ge br" acha "Geladeira Brastemp" mesmo quando a busca do banco com as duas não acha', async () => {
  const pedidos = [];
  const mod = carregar('src/lib/dados/sugestoes-busca.ts', {
    '@/lib/dados/regiao': { regiaoAtual: async () => ({ id: 'r1', slug: 'corrente-pi' }) },
    '@/lib/dados/seguro': { seguro: async (f, padrao) => { try { return await f(); } catch { return padrao; } } },
    '@/lib/dados/categorias': { listarCategorias: async () => [], totaisCategorias: async () => null },
    '@/lib/dados/catalogo': { lojasCatalogo: async () => [] },
    '@/lib/dados/anuncios': {
      buscarAnuncios: async (p) => {
        pedidos.push(p.q);
        const a = { id: 'a1', slug: 'g', titulo: 'Geladeira Brastemp', preco_centavos: null, cidade: 'Corrente' };
        // o banco só acha pela palavra sozinha; o mesmo anúncio nas duas respostas aparece uma vez
        return { anuncios: p.q === 'ge br' ? [] : [a, a], total: 1 };
      },
    },
  });
  const r = await mod.sugestoesBusca('ge br');
  assert.deepEqual(pedidos, ['ge br', 'ge']);
  assert.deepEqual(r.anuncios.map((a) => a.nome), ['Geladeira Brastemp']);
});

test('categoria sem anúncio na região não aparece', async () => {
  const { mod } = dados();
  assert.deepEqual((await mod.sugestoesBusca('fogo')).categorias, []);
});

test('região com muitas lojas lê mais páginas do catálogo (até 4)', async () => {
  const { mod, chamadas } = dados({ lojasTotal: 500 });
  const r = await mod.sugestoesBusca('gel');
  assert.deepEqual(chamadas.lojas.sort((a, b) => a - b), [0, 48, 96, 144]);
  assert.deepEqual(r.lojas.map((l) => l.nome), ['GELA BEM', 'Gelo Frio', 'Gelo Frio']);
});

test('texto curto não consulta nada; parte que falha fica vazia e as outras aparecem', async () => {
  const curto = dados();
  assert.deepEqual(await curto.mod.sugestoesBusca('g'), s.SEM_SUGESTOES);
  assert.equal(curto.chamadas.anuncios.length + curto.chamadas.lojas.length, 0);
  const { mod } = dados({ falhar: { anuncios: true, lojas: true } });
  const r = await mod.sugestoesBusca('gel');
  assert.deepEqual(r.anuncios, []); assert.deepEqual(r.lojas, []);
  assert.equal(r.categorias.length, 1);
});

test('rota devolve JSON privado (depende da cidade do visitante)', async () => {
  const pedidos = [];
  const { GET } = carregar('src/app/api/busca/sugestoes/route.ts', {
    '@/lib/dados/sugestoes-busca': { sugestoesBusca: async (q) => { pedidos.push(q); return s.SEM_SUGESTOES; } },
  });
  const r = await GET(new Request('https://teste.local/api/busca/sugestoes?q=gel'));
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), s.SEM_SUGESTOES);
  assert.match(r.headers.get('cache-control'), /private, no-store/);
  assert.deepEqual(pedidos, ['gel']);
});

test('campo do topo vira combobox; sem a opção continua o campo simples', () => {
  const navegacao = { useRouter: () => ({ push() {} }) };
  const { CampoBusca } = carregar('src/components/busca/campo-busca.tsx', { 'next/navigation': navegacao });
  const com = render(React.createElement(CampoBusca, { id: 'busca-topo', sugestoes: true }));
  assert.match(com, /role="combobox"/);
  assert.match(com, /aria-autocomplete="list"/);
  assert.match(com, /aria-expanded="false"/);
  assert.match(com, /role="listbox"[^>]*hidden=""/);
  assert.match(com, /name="q"/);
  assert.match(com, /<form role="search"[^>]*action="\/busca" method="get"/);
  const sem = render(React.createElement(CampoBusca, { id: 'busca-inicio' }));
  assert.doesNotMatch(sem, /combobox|listbox/);
});
