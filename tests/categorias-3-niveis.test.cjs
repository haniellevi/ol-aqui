const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup: render } = require('react-dom/server');
const { carregar } = require('./carregar.cjs');

// Árvore de teste com 3 níveis: Grande › Sub › Tipo. Inativas ficam fora da árvore que o site lê.
const linhas = [
  { id: 'p1', slug: 'pet', nome: 'Pet', icone: 'paw-print', pai_id: null, ordem: 10, ativa: true, campos: [] },
  { id: 'p2', slug: 'produtos-para-pets', nome: 'Produtos para pets', icone: 'paw-print', pai_id: 'p1', ordem: 10, ativa: true, campos: [] },
  { id: 'p3', slug: 'racao', nome: 'Ração', icone: 'paw-print', pai_id: 'p2', ordem: 10, ativa: true, campos: [{ chave: 'peso', rotulo: 'Peso', tipo: 'numero', obrigatorio: true, filtro: true }] },
  { id: 'p4', slug: 'coleiras', nome: 'Coleiras', icone: 'paw-print', pai_id: 'p2', ordem: 20, ativa: true, campos: [] },
  { id: 'p5', slug: 'brinquedos-antigos', nome: 'Brinquedos antigos', icone: 'paw-print', pai_id: 'p2', ordem: 30, ativa: false, campos: [] },
  { id: 'p6', slug: 'outros-animais', nome: 'Outros animais', icone: 'paw-print', pai_id: 'p1', ordem: 20, ativa: true, campos: [] },
  { id: 'm1', slug: 'moveis', nome: 'Móveis', icone: 'sofa', pai_id: null, ordem: 20, ativa: true, campos: [] },
  { id: 'c1', slug: 'casa-e-moveis', nome: 'Casa e decoração', icone: 'sofa', pai_id: null, ordem: 30, ativa: true, campos: [] },
  { id: 'c2', slug: 'decoracao', nome: 'Decoração', icone: 'sofa', pai_id: 'c1', ordem: 10, ativa: true, campos: [] },
  { id: 'e1', slug: 'eletronicos', nome: 'Eletrônicos', icone: 'cpu', pai_id: null, ordem: 40, ativa: false, campos: [] },
];

// Banco de mentira: entende só o que as consultas das páginas usam (select, eq, is, order, maybeSingle).
function consulta(linhasBanco) {
  const filtros = [];
  const pronto = (r) => linhasBanco.filter((x) => filtros.every((f) => f(x)));
  const q = {
    select() { return q; },
    eq(c, v) { filtros.push((x) => x[c] === v); return q; },
    is(c, v) { filtros.push((x) => (x[c] ?? null) === v); return q; },
    order() { return q; },
    maybeSingle() { return Promise.resolve({ data: pronto(q)[0] ?? null, error: null }); },
    then(ok, falha) { return Promise.resolve({ data: pronto(q), error: null }).then(ok, falha); },
  };
  return q;
}
// Funções do banco: caminho do topo até a categoria e "escondida" (ela ou uma de cima desligada).
const caminhoDe = (id) => {
  const fora = [];
  for (let c = linhas.find((l) => l.id === id); c; c = linhas.find((l) => l.id === c.pai_id)) fora.unshift(c);
  return fora;
};
const rpcs = {
  categoria_escondida: ({ p_slug }) => {
    const c = linhas.find((l) => l.slug === p_slug);
    return !!c && caminhoDe(c.id).some((k) => !k.ativa);
  },
  categorias_do_caminho: ({ p_id }) => caminhoDe(p_id),
};
const banco = { from: () => consulta(linhas), rpc: async (nome, args) => ({ data: rpcs[nome] ? rpcs[nome](args) : linhas, error: null }) };
const cats = carregar('src/lib/dados/categorias.ts', { '@/lib/supabase/server': { createClient: async () => banco } });
const { percorrer, buscarFolhas, linkCanonico, nomeCaminho, ehFolha, alturaDe, montarArvore } = carregar('src/lib/categorias-arvore.ts');

test('a árvore tem até 3 níveis, só com categorias ativas, e o caminho sai completo', async () => {
  const arvore = await cats.listarCategorias();
  assert.deepEqual(arvore.map((p) => p.slug), ['pet', 'moveis', 'casa-e-moveis']);
  const racao = percorrer(arvore).find((x) => x.no.slug === 'racao');
  assert.equal(nomeCaminho(racao.caminho), 'Pet › Produtos para pets › Ração');
  assert.equal(linkCanonico(racao.caminho), '/c/produtos-para-pets/racao');
  assert.equal(linkCanonico(arvore.slice(0, 1)), '/c/pet');
  assert.deepEqual(percorrer(arvore).find((x) => x.no.slug === 'brinquedos-antigos'), undefined);
  assert.equal(alturaDe(arvore[0]), 2);
  assert.equal(ehFolha(arvore[1]), true);
});

test('busca acha folha em qualquer nível, sem acento, e mostra só folhas', async () => {
  const arvore = await cats.listarCategorias();
  // busca por trecho: "decoração" também contém "racao" (sem acento)
  assert.deepEqual(buscarFolhas(arvore, 'racao').map((x) => x.no.slug), ['racao', 'decoracao']);
  assert.deepEqual(buscarFolhas(arvore, 'RAÇÃO').map((x) => x.no.slug), ['racao', 'decoracao']);
  assert.deepEqual(buscarFolhas(arvore, 'pet').map((x) => x.no.slug), ['racao', 'coleiras', 'outros-animais']);
  assert.deepEqual(buscarFolhas(arvore, 'produtos para').map((x) => x.no.slug), ['racao', 'coleiras']);
  assert.deepEqual(buscarFolhas(arvore, '   '), []);
});

test('montarArvore ignora filha de pai que não está na lista', () => {
  const arvore = montarArvore([{ id: 'x', slug: 'x', nome: 'X', pai_id: 'nao-existe', ordem: 1, ativa: true, campos: [] }]);
  assert.deepEqual(arvore, []);
});

test('página de categoria: grande abre; sub e tipo vão para o endereço com o pai; slug escondido vai para a lista', async () => {
  const nav = { redirect: (d) => { throw Error(`redirect:${d}`); }, notFound: () => { throw Error('NOT_FOUND'); } };
  const mockListagem = { Listagem: (props) => React.createElement('main', null, props.caminho), '@/components/busca/listagem': null };
  const paginas = {
    grande: carregar('src/app/(publico)/c/[categoria]/page.tsx', { 'next/navigation': nav, '@/lib/dados/categorias': cats, '@/components/busca/listagem': mockListagem, '@/components/busca/cabecalho-categoria': { CabecalhoCategoria: () => null } }),
    sub: carregar('src/app/(publico)/c/[categoria]/[sub]/page.tsx', { 'next/navigation': nav, '@/lib/dados/categorias': cats, '@/components/busca/listagem': mockListagem, '@/components/busca/cabecalho-categoria': { CabecalhoCategoria: () => null } }),
  };
  const sp = Promise.resolve({});
  const abre = async (pagina, params) => render(await pagina.default({ params: Promise.resolve(params), searchParams: sp }));
  const desvia = async (pagina, params) => { try { await pagina.default({ params: Promise.resolve(params), searchParams: sp }); return null; } catch (e) { return e.message; } };

  assert.match(await abre(paginas.grande, { categoria: 'pet' }), /<main>\/c\/pet<\/main>/);
  assert.equal(await desvia(paginas.grande, { categoria: 'racao' }), 'redirect:/c/produtos-para-pets/racao');
  assert.equal(await desvia(paginas.grande, { categoria: 'eletronicos' }), 'redirect:/categorias');
  assert.equal(await desvia(paginas.grande, { categoria: 'nao-existe' }), 'NOT_FOUND');

  assert.match(await abre(paginas.sub, { categoria: 'pet', sub: 'produtos-para-pets' }), /<main>\/c\/pet\/produtos-para-pets<\/main>/);
  assert.match(await abre(paginas.sub, { categoria: 'produtos-para-pets', sub: 'racao' }), /<main>\/c\/produtos-para-pets\/racao<\/main>/);
  // par que não bate (categoria que mudou de lugar) segue para o endereço certo
  assert.equal(await desvia(paginas.sub, { categoria: 'pet', sub: 'racao' }), 'redirect:/c/produtos-para-pets/racao');
  assert.equal(await desvia(paginas.sub, { categoria: 'casa-e-moveis', sub: 'moveis' }), 'redirect:/c/moveis');
  assert.equal(await desvia(paginas.sub, { categoria: 'pet', sub: 'eletronicos' }), 'redirect:/categorias');
  assert.equal(await desvia(paginas.sub, { categoria: 'pet', sub: 'nao-existe' }), 'NOT_FOUND');
});

// ---------- Escolha de categoria (anúncio) ----------
function escolha({ abertas = [], filhaId = null, busca = '' } = {}) {
  // Ordem dos useState: EscolhaCategoria (filhaId, busca, sugestão) e depois ArvoreCategorias (abertas, recentes).
  let indice = 0;
  const valores = [filhaId, busca, null, abertas, []];
  const { EscolhaCategoria } = carregar('src/components/anunciar/escolha-categoria.tsx', {
    react: {
      ...React,
      useState: (ini) => [indice < valores.length ? valores[indice++] : typeof ini === 'function' ? ini() : ini, () => {}],
      useMemo: (fn) => fn(),
      useEffect: () => {},
    },
    './enviar': { useEnvioAnuncio: () => [null, () => {}, false, () => {}] },
    '@/app/(conta)/anunciar/actions': { salvarCategoria() {} },
  });
  return async () => render(EscolhaCategoria({ id: 'an1', editar: false, formId: 'f', arvore: await cats.listarCategorias(), selecionadaId: null, tituloAtual: null }));
}

test('escolha de categoria: começa nas grandes; grande com filhas abre a lista; só folha vira opção', async () => {
  const topo = await escolha()();
  assert.match(topo, /O que você está anunciando\?/); assert.match(topo, /Ou escolha na lista/);
  assert.match(topo, />Pet</); assert.match(topo, /value="m1"/);
  assert.doesNotMatch(topo, /value="p3"/);
  // sem título ainda: o texto digitado vai junto para virar o começo do título
  assert.match(topo, /name="titulo_inicial"/);

  const pet = await escolha({ abertas: ['p1'] })();
  assert.match(pet, /id="titulo-aberta"[^>]*>Pet</);
  assert.match(pet, /Todas as categorias/);
  assert.match(pet, /value="p6"/);
  assert.doesNotMatch(pet, /value="p3"/);

  const racoes = await escolha({ abertas: ['p1', 'p2'] })();
  assert.match(racoes, /value="p3"/); assert.match(racoes, /value="p4"/);
  assert.doesNotMatch(racoes, /Brinquedos antigos/);
});

test('busca em qualquer nível mostra o caminho completo e só folhas são escolhíveis', async () => {
  const html = await escolha({ busca: 'racao' })();
  assert.match(html, /name="escolha-categoria" value="p3"/);
  assert.match(html, /Ração<\/span><span[^>]*>Pet › Produtos para pets</);
  assert.doesNotMatch(html, /value="c2"/); // "Decoração" não é "ração"
  assert.doesNotMatch(html, /value="p2"/);
});

test('escolha mostra a categoria já escolhida com o caminho', async () => {
  const html = render(await (async () => {
    const { EscolhaCategoria } = carregar('src/components/anunciar/escolha-categoria.tsx', {
      react: { ...React, useState: (i) => [typeof i === 'function' ? i() : i, () => {}], useMemo: (fn) => fn(), useEffect: () => {} },
      './enviar': { useEnvioAnuncio: () => [null, () => {}, false, () => {}] },
      '@/app/(conta)/anunciar/actions': { salvarCategoria() {} },
    });
    return EscolhaCategoria({ id: 'an1', editar: false, formId: 'f', arvore: await cats.listarCategorias(), selecionadaId: 'p3', tituloAtual: 'Ração 15kg' });
  })());
  assert.match(html, /Escolhida: <strong>Pet › Produtos para pets › Ração<\/strong>/);
  assert.doesNotMatch(html, /name="titulo_inicial"/); // já tem título: não mexe nele
  assert.match(html, /id="titulo-aberta"[^>]*>Produtos para pets</); // abre no nível da escolhida
});

// ---------- Painel: níveis e pais possíveis ----------
test('painel: mães possíveis respeitam o máximo de 3 níveis e não incluem a própria árvore', async () => {
  const { lerCategorias, maesPossiveis } = carregar('src/lib/admin/cadastros.ts');
  const { todas } = await lerCategorias(banco);
  assert.equal(todas.find((c) => c.slug === 'racao').nivel, 3);
  const nova = maesPossiveis(todas).map((m) => m.nome);
  assert.ok(nova.includes('Pet'));
  assert.ok(nova.includes('Pet › Produtos para pets'));
  assert.ok(!nova.some((n) => n.endsWith('Ração')));
  // editar "Produtos para pets" (tem tipos dentro): só grandes podem ser mãe, e ela não se coloca em si mesma
  const sub = maesPossiveis(todas, 'p2').map((m) => m.nome);
  assert.ok(sub.includes('Pet') && sub.includes('Móveis'));
  assert.ok(!sub.includes('Pet › Produtos para pets'));
  assert.ok(!sub.includes('Pet › Outros animais') && sub.every((n) => !n.includes('›')));
});

test('painel novo: busca pelo título inteiro acha a categoria final, sem acento e no plural', async () => {
  const { sugerirPorTexto } = carregar('src/lib/categorias-arvore.ts');
  const arvore = await cats.listarCategorias();
  // nome da própria categoria vale mais que o da mãe
  assert.deepEqual(sugerirPorTexto(arvore, 'Ração Golden 15kg').map((x) => x.no.slug), ['racao']);
  assert.deepEqual(sugerirPorTexto(arvore, 'coleiras de couro').map((x) => x.no.slug), ['coleiras']);
  // palavra só da mãe traz as filhas dela
  assert.deepEqual(sugerirPorTexto(arvore, 'produtos pet').map((x) => x.no.slug), ['racao', 'coleiras', 'outros-animais']);
  // palavras curtas não contam; nada parecido → vazio
  assert.deepEqual(sugerirPorTexto(arvore, 'de um'), []);
  assert.deepEqual(sugerirPorTexto(arvore, 'trator'), []);
  assert.deepEqual(sugerirPorTexto(arvore, 'ração', 1).length, 1);
});

test('painel novo: para quem procura some a vazia e a com mais anúncios vem primeiro', async () => {
  const { arvoreComAnuncios, enxugarArvore } = carregar('src/lib/categorias-arvore.ts');
  const arvore = await cats.listarCategorias();
  const totais = new Map([['p1', 2], ['p2', 2], ['p3', 2], ['c1', 5], ['c2', 5]]);
  const r = arvoreComAnuncios(arvore, totais);
  assert.deepEqual(r.map((c) => c.slug), ['casa-e-moveis', 'pet']);
  assert.deepEqual(r[1].filhas.map((c) => c.slug), ['produtos-para-pets']);
  assert.deepEqual(r[1].filhas[0].filhas.map((c) => c.slug), ['racao']);
  // sem contagem: tudo como veio
  assert.equal(arvoreComAnuncios(arvore, null), arvore);
  // a versão leve leva só o que o painel usa
  assert.deepEqual(Object.keys(enxugarArvore(arvore)[0]).sort(), ['filhas', 'icone', 'id', 'nome', 'slug']);
});
