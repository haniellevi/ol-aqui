const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createElement } = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { carregar } = require('./carregar.cjs');

const { PAPEIS, podeVerTela, podeVerLink } = carregar('src/lib/tipos-equipe.ts');
const caminho = '/admin/anuncios';
const estados = ['ativo', 'pausado', 'rascunho', 'em_analise', 'vendido', 'expirado', 'congelado', 'excluido'];
const anuncios = estados.map(status => ({
  id: status,
  titulo: `Item ${status}`,
  status,
  atualizado_em: '2026-11-10T12:00:00Z',
  cidade: 'Corrente',
  preco_centavos: 12000,
  vitrines_lojas: { nome: 'Loja de teste' },
}));

function ambiente({ linhas = anuncios, error = null } = {}) {
  let filtro;
  const consulta = {
    select() { return this; },
    order() { return this; },
    eq(coluna, valor) { assert.equal(coluna, 'status'); filtro = valor; return this; },
    async range(de, ate) {
      const encontrados = filtro ? linhas.filter(item => item.status === filtro) : linhas;
      return { data: error ? null : encontrados.slice(de, ate + 1), count: encontrados.length, error };
    },
  };
  const { default: pagina } = carregar('src/app/admin/anuncios/page.tsx', {
    'next/link': { default: ({ href, children, className, 'aria-current': atual }) =>
      createElement('a', { href, className, 'aria-current': atual }, children) },
    'next/navigation': { redirect: url => { throw Error(`redirect:${url}`); } },
    '@/lib/admin/equipe': { exigirTela: async tela => {
      assert.equal(tela, 'anuncios');
      return { supabase: { from: tabela => {
        assert.equal(tabela, 'anuncios');
        return consulta;
      } } };
    } },
  });
  return async (sp = {}) => {
    filtro = undefined;
    return renderToStaticMarkup(await pagina({ searchParams: Promise.resolve(sp) }));
  };
}

test('painel de anúncios e item do menu ficam restritos ao administrador', () => {
  for (const papel of [...PAPEIS, null]) {
    assert.equal(podeVerTela(papel, 'anuncios'), papel === 'administrador');
    assert.equal(podeVerLink(papel, caminho), papel === 'administrador');
  }
});

test('Todos inclui os demais estados e cada filtro seleciona apenas a situação pedida', async () => {
  const render = ambiente();
  const todos = await render();
  for (const estado of estados) assert.ok(todos.includes(`Item ${estado}</h3>`));
  for (const status of estados.slice(0, 4)) {
    const html = await render({ status });
    const selecionado = html.match(/<a\b[^>]*aria-current="true"[^>]*>/g);
    assert.equal(selecionado?.length, 1);
    assert.ok(selecionado[0].includes(`href="${caminho}?status=${status}"`));
    for (const estado of estados) assert.equal(html.includes(`Item ${estado}</h3>`), estado === status);
  }
  assert.equal(await render({ status: ['ativo', 'rascunho'], pagina: '-1' }), todos);
});

test('paginação mantém o filtro e volta à primeira página quando o resultado encolhe', async () => {
  const linhas = Array.from({ length: 31 }, (_, i) => ({
    ...anuncios[1], id: String(i), titulo: `Pausado ${i + 1}`,
  }));
  const render = ambiente({ linhas });
  const primeira = await render({ status: 'pausado' });
  assert.match(primeira, /status=pausado&amp;pagina=2/);
  assert.doesNotMatch(primeira, /Pausado 31<\/h3>/);
  assert.match(await render({ status: 'pausado', pagina: '2' }), /Pausado 31<\/h3>/);
  await assert.rejects(render({ status: 'pausado', pagina: '3' }), /redirect:\/admin\/anuncios\?status=pausado/);
});

test('falha da consulta é visível e se distingue de uma lista vazia', async () => {
  assert.match(await ambiente({ linhas: [] })({ status: 'ativo' }), /Nenhum anúncio nesta situação/);
  const html = await ambiente({ error: { code: '42501' } })();
  assert.match(html, /role="alert"/);
  assert.doesNotMatch(html, /Nenhum anúncio cadastrado/);
});

test('rascunho incompleto tem um título legível no catálogo', async () => {
  const rascunho = { ...anuncios[2], titulo: null, cidade: null, preco_centavos: null };
  const html = await ambiente({ linhas: [rascunho] })({ status: 'rascunho' });
  assert.match(html, /Anúncio sem título<\/h3>/);
  assert.match(html, /Loja de teste<\/p>/);
});
