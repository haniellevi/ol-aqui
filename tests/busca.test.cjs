const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup: render } = require('react-dom/server');
const { carregar } = require('./carregar.cjs');
const { lerEstadoBusca, manterFiltros, comParametros } = carregar('src/components/busca/parametros.ts');
const campos = [
  { chave: 'ano', rotulo: 'Ano', tipo: 'numero', filtro: true, min: 1900, max: 2100 },
  { chave: 'estado', rotulo: 'Estado', tipo: 'lista', filtro: true, opcoes: ['Novo', 'Usado'] },
  { chave: 'troca', rotulo: 'Aceita troca', tipo: 'sim_nao', filtro: true },
];
const carro = { id: 'carros', slug: 'carros', nome: 'Carros', campos };
const pai = { id: 'veiculos', slug: 'veiculos', nome: 'Veículos', campos: [], filhas: [carro] };
const encontrada = { categoria: carro, pai, filhas: [] };
const sp = { q: 'fiat', categoria: 'carros', cidade: 'Corrente', preco_min: '1.500,50', preco_max: '30.000', ordem: 'menor_preco', c_ano_min: '2015', c_ano_max: '2020', c_estado: ['Novo', 'Usado'], c_troca: 'nao', pagina: '2' };
const cards = { CardAnuncio: ({ anuncio }) => React.createElement('article', null, anuncio.titulo) };
function parametrosDoLink(tag) {
  return new URL(tag.match(/href="([^"]*)"/)[1].replaceAll('&amp;', '&'), 'https://teste.local').searchParams;
}

test('filtros combinados preservam moeda brasileira, zero, lista e booleano falso', () => {
  const e = lerEstadoBusca(sp, campos, true);
  assert.deepEqual(e.erros, {});
  assert.equal(e.precoMin, 150050); assert.equal(e.precoMax, 3000000);
  assert.equal(e.pagina, 2); assert.equal(e.quantos, 7);
  assert.deepEqual(e.filtros, { ano: { min: 2015, max: 2020 }, estado: ['Novo', 'Usado'], troca: false });
  assert.equal(lerEstadoBusca({ preco_min: '0' }).precoMin, 0);
  assert.equal(lerEstadoBusca({ q: [] }).q, '');
});
for (const preco of ['abc', '-1', '1e5', '0x10', '9007199254740992']) {
  test(`preço inválido ${preco} exige correção`, () => {
    const e = lerEstadoBusca({ preco_min: preco });
    assert.ok(e.erros.preco_min); assert.equal(e.precoMinTexto, preco); assert.equal(e.quantos, 1);
  });
}
test('faixas invertidas e números fora dos limites são recusados', () => {
  assert.ok(lerEstadoBusca({ preco_min: '200', preco_max: '100' }).erros.preco_max);
  for (const value of ['0x780', '2e3', 'abc', '1899', '2101']) assert.ok(lerEstadoBusca({ c_ano_min: value }, campos).erros.c_ano_min);
  assert.ok(lerEstadoBusca({ c_ano_min: '2020', c_ano_max: '2015' }, campos).erros.c_ano_max);
  const removido = lerEstadoBusca({ c_estado: ['Novo', 'Novo', 'inexistente'] }, campos);
  assert.deepEqual(removido.filtros.estado, ['Novo']);
  assert.deepEqual(removido.valores.c_estado, ['Novo', 'inexistente']);
  assert.match(removido.erros.c_estado, /indisponíveis no catálogo/);
});
test('trocar termo mantém filtros repetidos e remove página e parâmetros estranhos', () => {
  const manter = manterFiltros({ ...sp, debug: '1' });
  assert.equal(manter.pagina, undefined); assert.equal(manter.q, undefined); assert.equal(manter.debug, undefined);
  assert.deepEqual(manter.c_estado, ['Novo', 'Usado']);
  const { CampoBusca } = carregar('src/components/busca/campo-busca.tsx');
  const html = render(React.createElement(CampoBusca, { valor: 'outro carro', manter: sp, caminho: '/c/veiculos/carros' }));
  assert.match(html, /action="\/c\/veiculos\/carros"/);
  assert.equal((html.match(/name="c_estado"/g) ?? []).length, 2);
  for (const name of ['cidade', 'preco_min', 'preco_max', 'ordem', 'c_ano_min', 'c_ano_max', 'c_troca']) assert.ok(html.includes(`name="${name}"`));
  assert.equal((html.match(/name="q"/g) ?? []).length, 1);
  assert.doesNotMatch(html, /name="pagina"/);
});
test('paginação preserva todos os filtros e alterações voltam à página inicial', () => {
  const proxima = new URL(comParametros('/busca', sp, { pagina: '3' }), 'https://teste.local');
  assert.equal(proxima.searchParams.get('pagina'), '3');
  assert.deepEqual(proxima.searchParams.getAll('c_estado'), ['Novo', 'Usado']);
  const semCidade = new URL(comParametros('/busca', sp, { cidade: null }), 'https://teste.local');
  assert.equal(semCidade.searchParams.get('cidade'), null); assert.equal(semCidade.searchParams.get('pagina'), null);
  assert.equal(semCidade.searchParams.get('preco_max'), '30.000');
});
test('filtros ativos podem ser removidos individualmente sem apagar os outros', () => {
  const { ResultadosBusca } = carregar('src/components/busca/resultados-busca.tsx', { '@/components/anuncio/card-anuncio': cards });
  const html = render(React.createElement(ResultadosBusca, { caminho: '/busca', sp, estado: lerEstadoBusca(sp, campos, true), campos, cidades: [], categorias: [pai], nomeCategoria: 'Carros', lugar: 'Corrente e região', anuncios: [{ id: 'a', titulo: 'Carro teste' }], total: 60, vazio: null }));
  const links = html.match(/<a\b[^>]*>/g);
  const cidade = parametrosDoLink(links.find(l => l.includes('aria-label="Remover filtro: Cidade: Corrente"')));
  assert.equal(cidade.get('cidade'), null); assert.equal(cidade.get('preco_min'), '1.500,50');
  assert.equal(cidade.get('pagina'), null); assert.deepEqual(cidade.getAll('c_estado'), ['Novo', 'Usado']);
  const categoria = parametrosDoLink(links.find(l => l.includes('aria-label="Remover filtro: Carros"')));
  assert.equal(categoria.get('categoria'), null); assert.equal(categoria.get('c_ano_min'), null);
  assert.equal(categoria.get('c_estado'), null); assert.equal(categoria.get('cidade'), 'Corrente');
  assert.equal(parametrosDoLink(links.find(l => l.includes('rel="next"'))).get('pagina'), '3');
  assert.equal(parametrosDoLink(links.find(l => l.includes('rel="prev"'))).get('pagina'), null);
  assert.match(html, /Página 2 de 3/);
});
test('subcategoria mantém cidade, preço e ordem ao buscar ou trocar de tipo', () => {
  const { CabecalhoCategoria } = carregar('src/components/busca/cabecalho-categoria.tsx');
  const html = render(React.createElement(CabecalhoCategoria, { achada: encontrada, q: 'fiat', sp }));
  assert.match(html, /action="\/c\/veiculos\/carros"/);
  const tudo = (html.match(/<a\b[^>]*>/g) ?? []).find(l => /href="\/c\/veiculos\?/.test(l));
  const filtros = parametrosDoLink(tudo);
  assert.equal(filtros.get('cidade'), 'Corrente'); assert.equal(filtros.get('preco_max'), '30.000');
  assert.equal(filtros.get('q'), 'fiat'); assert.equal(filtros.get('c_estado'), null); assert.equal(filtros.get('pagina'), null);
});
test('filtros inválidos na URL não consultam o banco nem simulam ausência de anúncios', async () => {
  let chamadas = 0;
  const { Listagem } = carregar('src/components/busca/listagem.tsx', {
    '@/lib/dados/categorias': { listarCategorias: async () => [pai] },
    '@/lib/dados/regiao': { regiaoAtual: async () => ({ id: 'r', nome: 'Corrente' }), listarCidades: async () => [] },
    '@/lib/dados/anuncios': { buscarAnuncios: async () => { chamadas++; throw Error('não deveria consultar'); } },
    '@/components/anuncio/card-anuncio': cards,
    '@/components/busca/vazio-busca': { VazioBusca: () => 'VAZIO' },
  });
  for (const parametros of [{ preco_min: 'abc' }, { preco_min: '500', preco_max: '200' }, { categoria: 'inexistente' }]) {
    const html = render(await Listagem({ caminho: '/busca', sp: parametros, categoria: null, categoriaPeloEndereco: false, topo: null }));
    assert.match(html, /Não foi possível aplicar os filtros/); assert.doesNotMatch(html, /Nenhum anúncio|VAZIO/);
  }
  assert.equal(chamadas, 0);
});
test('listagem envia combinação completa e paginação para a consulta real', async () => {
  const consultas = [];
  const { Listagem } = carregar('src/components/busca/listagem.tsx', {
    '@/lib/dados/categorias': { listarCategorias: async () => [pai] },
    '@/lib/dados/regiao': { regiaoAtual: async () => ({ id: 'r', nome: 'Corrente' }), listarCidades: async () => [] },
    '@/lib/dados/anuncios': { buscarAnuncios: async p => { consultas.push(p); return { anuncios: [{ id: 'a', titulo: 'Carro teste' }], total: 25 }; } },
    '@/components/busca/vazio-busca': { VazioBusca: () => null },
  });
  await Listagem({ caminho: '/busca', sp, categoria: encontrada, categoriaPeloEndereco: false, topo: null });
  assert.equal(consultas.length, 1);
  assert.deepEqual(consultas[0], { q: 'fiat', categoria: 'carros', cidade: 'Corrente', precoMin: 150050, precoMax: 3000000, filtros: { ano: { min: 2015, max: 2020 }, estado: ['Novo', 'Usado'], troca: false }, ordem: 'menor_preco', limite: 24, deslocamento: 24 });
});
test('listagem regional envia facetas e mantém selecionadas as opções com zero', async () => {
  const consultas = [];
  const { Listagem } = carregar('src/components/busca/listagem.tsx', {
    '@/lib/dados/regiao': { regiaoAtual: async () => ({ id: 'r', slug: 'corrente-pi', nome: 'Corrente' }), listarCidades: async () => [] },
    '@/lib/dados/anuncios': { buscarAnuncios: async p => {
      consultas.push(p);
      return { anuncios: [{ id: 'a', titulo: 'Carro teste' }], total: 1, facetas: { estado: { opcoes: { Novo: 2 } }, ano: { min: 2015, max: 2020 } } };
    } },
    '@/components/anuncio/card-anuncio': cards,
    '@/components/busca/vazio-busca': { VazioBusca: () => null },
  });
  const html = render(await Listagem({
    caminho: '/c/veiculos/carros', sp: { c_estado: ['Novo', 'Usado'] }, categoria: encontrada, categoriaPeloEndereco: true, topo: null,
  }));
  assert.equal(consultas.length, 1);
  assert.equal(consultas[0].facetas, true);
  assert.equal(consultas[0].regiao, 'corrente-pi');
  assert.deepEqual(consultas[0].filtros, { estado: ['Novo', 'Usado'] });
  assert.match(html, /Novo \(2\)/);
  assert.match(html, /Usado \(0\)/);
  assert.match(html, /aria-label="Remover filtro: Estado: Novo, Usado"/);
  assert.match(html, /Disponível de 2015 a 2020/);
  assert.doesNotMatch(html, /id="filtro-troca"/);
});
test('painel separa catálogo e disponibilidade e mantém o filtro booleano falso', () => {
  const { FolhaFiltros } = carregar('src/components/busca/folha-filtros.tsx');
  const props = { caminho: '/c/veiculos/carros', estado: lerEstadoBusca({ c_troca: 'nao' }, campos), campos, cidades: [] };
  const html = render(React.createElement(FolhaFiltros, { ...props, facetas: { estado: { opcoes: { Novo: 1 } }, troca: { opcoes: { sim: 3 } } } }));
  assert.match(html, /Sim \(3\)/);
  assert.match(html, /Não \(0\)/);
  assert.match(html, /Novo \(1\)/);
  assert.doesNotMatch(html, /value="Usado"|id="filtro-ano"/);
  assert.match(render(React.createElement(FolhaFiltros, { ...props, facetas: null })), /value="Usado"/);
});
test('sugestões priorizam a categoria escolhida antes de ampliar para outras', async () => {
  const consultas = [];
  const { Listagem } = carregar('src/components/busca/listagem.tsx', {
    '@/lib/dados/categorias': { listarCategorias: async () => [pai] },
    '@/lib/dados/regiao': { regiaoAtual: async () => ({ id: 'r', nome: 'Corrente' }), listarCidades: async () => [] },
    '@/lib/dados/anuncios': { buscarAnuncios: async p => {
      consultas.push(p);
      return consultas.length === 1 ? { anuncios: [], total: 0 } : { anuncios: [{ id: 'a', titulo: 'Carro parecido' }], total: 1 };
    } },
    '@/components/busca/vazio-busca': { VazioBusca: () => null },
    'next/server': { after: f => depois.push(f) },
    '@/lib/dados/buscas': { registrarBusca: async (...args) => { buscas.push(args); } },
  });
  const depois = [], buscas = [];
  await Listagem({ caminho: '/busca', sp: { ...sp, pagina: '1' }, categoria: encontrada, categoriaPeloEndereco: false, topo: null });
  assert.equal(consultas.length, 2);
  assert.deepEqual(consultas[1], { q: 'fiat', categoria: 'carros', limite: 10 });
  // A busca digitada é contada depois da resposta, com o total da consulta principal (0 = sem resultado).
  assert.equal(depois.length, 1); assert.equal(buscas.length, 0);
  await depois[0]();
  assert.deepEqual(buscas, [['fiat', 'r', 'carros', 0]]);
});
