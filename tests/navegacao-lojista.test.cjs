const { test } = require('node:test');
const assert = require('node:assert/strict');
const { carregar } = require('./carregar.cjs');
const lojaA = { id: '20000000-0000-4000-a000-000000000001', nome: 'Loja A', dono: true };
const lojaB = { id: '20000000-0000-4000-a000-000000000002', nome: 'Loja B', dono: false };
function ambiente({ userId = 'user_teste', data = [], error = null } = {}) {
  const chamadas = [];
  const { atalhoLoja } = carregar('src/lib/dados/navegacao-lojista.ts', {
    '@clerk/nextjs/server': { auth: async () => ({ userId }) },
    '@/lib/supabase/server': { createClient: async () => ({ rpc: async nome => {
      chamadas.push(nome);
      return { data, error };
    } }) },
  });
  return { atalhoLoja, chamadas };
}
test('navegação: visitante e vendedor individual conservam entrada Anunciar', async () => {
  const visitante = ambiente({ userId: null });
  assert.equal(await visitante.atalhoLoja(), null);
  assert.deepEqual(visitante.chamadas, []);
  assert.equal(await ambiente().atalhoLoja(), null);
});
test('navegação: uma loja encaminha à gestão selecionando a loja, inclusive gerente com vitrine PF', async () => {
  for (const dono of [true, false]) {
    assert.deepEqual(await ambiente({ data: [{ ...lojaA, dono }] }).atalhoLoja(), {
      href: '/minha-conta/loja', rotulo: 'Minha loja', id: lojaA.id,
    });
  }
});
test('navegação: várias lojas encaminham ao seletor de lojas', async () => {
  assert.deepEqual(await ambiente({ data: [lojaA, lojaB] }).atalhoLoja(), {
    href: '/minha-conta/lojas', rotulo: 'Minhas lojas', id: null,
  });
});
test('navegação: falha da consulta e registro inválido usam navegação padrão', async () => {
  assert.equal(await ambiente({ error: { message: 'indisponível' } }).atalhoLoja(), null);
  assert.equal(await ambiente({ data: [{ id: 'invalido' }] }).atalhoLoja(), null);
});

const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
function barra(loja, caminho = '/minha-conta/loja') {
  const { BarraInferior } = carregar('src/components/ui/barra-inferior.tsx', {
    'next/navigation': { usePathname: () => caminho },
    '@/app/(conta)/_loja/actions': { escolherLoja: () => {} },
  });
  return renderToStaticMarkup(React.createElement(BarraInferior, { loja }));
}
test('barra móvel: loja única seleciona a gestão certa e marca apenas um destino atual', () => {
  const html = barra({ id: lojaA.id, href: '/minha-conta/loja', rotulo: 'Minha loja' });
  assert.match(html, /<form/);
  assert.match(html, new RegExp(`name="loja" value="${lojaA.id}"`));
  assert.match(html, /name="voltar" value="\/minha-conta\/loja"/);
  assert.match(html, /Minha loja/);
  assert.equal((html.match(/aria-current="page"/g) ?? []).length, 1);
});
test('barra móvel: várias lojas abrem lista e visitante tem Anunciar', () => {
  const varias = barra({ id: null, href: '/minha-conta/lojas', rotulo: 'Minhas lojas' }, '/');
  assert.match(varias, /href="\/minha-conta\/lojas"/);
  assert.match(varias, /Minhas lojas/);
  assert.match(barra(null, '/'), /href="\/anunciar"/);
});
