const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup: render } = require('react-dom/server');
const { carregar } = require('./carregar.cjs');
const regiao = { id: 'regiao', cidade: 'Corrente', cidadeSede: 'Corrente', nome: 'Extremo Sul' };

test('catálogo: busca por nome vai ao banco antes da paginação e preserva chamada antiga sem busca', async () => {
  const chamadas = [];
  const { lojasCatalogo } = carregar('src/lib/dados/catalogo.ts', {
    '@/lib/supabase/server': { createClient: async () => ({ rpc: async (nome, args) => {
      chamadas.push({ nome, args });
      return { data: [], error: null };
    } }) },
  });
  await lojasCatalogo(regiao, 'moveis', 24, 24, false, 'Árvore');
  assert.equal(chamadas[0].nome, 'catalogo_lojas_busca');
  assert.equal(chamadas[0].args.p_busca, 'Árvore');
  assert.equal(chamadas[0].args.p_offset, 24);
  assert.equal(chamadas[0].args.p_nicho, 'moveis');
  await lojasCatalogo(regiao, null, 24);
  assert.equal(chamadas[1].nome, 'catalogo_lojas');
  assert.equal(Object.hasOwn(chamadas[1].args, 'p_busca'), false);
});

async function pagina(params, lojas = []) {
  const consultas = [];
  const { default: Catalogo } = carregar('src/app/(publico)/lojas/page.tsx', {
    '@/lib/dados/regiao': { regiaoAtual: async () => regiao },
    '@/lib/dados/categorias': { listarCategorias: async () => [{ id:'moveis',slug:'moveis',nome:'Móveis',filhas:[] }] },
    '@/lib/dados/catalogo': {
      lojasComOferta: async (...args) => { consultas.push(['lojas', args]); return lojas; },
      anunciosCatalogo: async (...args) => { consultas.push(['produtos', args]); return []; },
    },
    '@/components/anuncio/grade-anuncios': { GradeAnuncios: () => React.createElement('div',null,'Produtos da região') },
  });
  return { html:render(await Catalogo({ searchParams:Promise.resolve(params) })), consultas };
}
test('catálogo: campo acessível mantém busca e categoria na paginação', async () => {
  const { html, consultas } = await pagina({ q:'  regional   árvore  ', nicho:'moveis',lojas:'2' }, [{id:'loja',slug:'arvore',nome:'Regional Árvore',cidade:'Corrente',logo_url:null,total:70}]);
  assert.match(html, /for="busca-loja"/);
  assert.match(html, /name="q"[^>]*value="regional árvore"/);
  assert.equal(consultas[0][1][5], 'regional árvore');
  assert.equal(consultas[0][1][3], 24);
  assert.match(html, /q=regional\+%C3%A1rvore/);
  assert.match(html, /nicho=moveis/);
  assert.match(html, /Limpar busca/);
  assert.doesNotMatch(html, /Produtos da região/);
});
test('catálogo: busca vazia e parâmetro repetido mantêm catálogo normal de lojas e produtos', async () => {
  for (const q of ['', ['uma','outra']]) {
    const { html, consultas } = await pagina({ q });
    assert.equal(consultas.length, 2);
    assert.match(html, /Produtos da região/);
  }
});
test('catálogo: resultado vazio mostra o termo escapado e permite limpar a busca', async () => {
  const { html } = await pagina({ q:'<loja>' });
  assert.match(html, /Nenhuma loja encontrada/);
  assert.match(html, /&lt;loja&gt;/);
  assert.match(html, /Limpar busca/);
});

test('catálogo: oferta ativa e vazio têm indicação honesta com rota direta',async()=>{
 const {html}=await pagina({},[{id:'a',slug:'cheia',nome:'Cheia',cidade:'Corrente',produtos_ativos:8,total:2},{id:'b',slug:'vazia',nome:'Vazia',cidade:'Corrente',produtos_ativos:0,total:2}]);
 assert.match(html,/8 produtos ativos/);assert.match(html,/Ainda sem produtos ativos/);assert.match(html,/href="\/loja\/vazia"/);
});
