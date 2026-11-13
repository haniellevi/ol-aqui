const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup: render } = require('react-dom/server');
const { carregar } = require('./carregar.cjs');
const anuncio = require('./fixtures/anuncio.cjs');
const caminho = 'src/app/(publico)/anuncio/[idslug]/';
const navegacao = { useRouter: () => ({ push() {} }), unstable_rethrow() {}, redirect: url => { throw Error(`redirect:${url}`); }, notFound: () => { throw Error('404'); } };
const mocks = { 'next/navigation': navegacao, './actions': { registrarEvento: async () => true, alternarFavorito: async () => ({ ok: true }), denunciarAnuncio: async () => null } };
const { ConteudoAnuncio } = carregar(caminho + 'conteudo-anuncio.tsx', mocks);
const { idDoLinkAnuncio, linkAnuncio } = carregar('src/lib/formato.ts');
const conteudo = (extra = {}) => render(React.createElement(ConteudoAnuncio, { a: { ...anuncio, ...extra }, favorito: false, logado: false, parecidos: [] }));

test('anúncio apresenta preço, detalhes, vendedor, descrição e contato com URL canônica', () => {
  const html = conteudo();
  for (const texto of ['R$ 850', 'Aceita troca', 'Marchas', '18', 'Vendedor', 'Compartilhar', 'Copiar link', 'Ver descrição completa']) assert.ok(html.includes(texto), texto);
  const href = html.match(/href="(https:\/\/wa.me\/[^\"]+)"/)[1].replaceAll('&amp;', '&');
  const url = new URL(href);
  assert.equal(url.pathname, '/5589999990000');
  assert.ok(url.searchParams.get('text').includes(anuncio.titulo));
  assert.ok(url.searchParams.get('text').includes('https://mercadodaregiao.com.br' + linkAnuncio(anuncio.id, anuncio.titulo, null)));
  assert.match(html, /target="_blank" rel="noopener noreferrer"/);
  assert.match(html, /Entre para salvar nos favoritos/);
  assert.doesNotMatch(html, /Vendedor Fictício/); // Pessoa física: somente primeiro nome.
});
for (const whatsapp of [null, '', 'abc', '551', 'https://outro.local']) {
  test(`contato ausente ou inválido não gera link externo: ${whatsapp}`, () => {
    const html = conteudo({ whatsapp });
    assert.doesNotMatch(html, /https:\/\/wa.me\//);
    assert.match(html, /Contato por WhatsApp indisponível/);
    assert.match(html, /Ver anúncios/);
  });
}
test('vendido e prévia do dono não oferecem contato para uma venda indisponível', () => {
  const vendido = conteudo({ status: 'vendido' });
  assert.match(vendido, /Este anúncio já foi vendido/); assert.doesNotMatch(vendido, /https:\/\/wa.me\//);
  const dono = conteudo({ status: 'rascunho', e_dono: true });
  assert.match(dono, /Prévia: só você vê/); assert.match(dono, /Este anúncio é seu/);
  assert.doesNotMatch(dono, /https:\/\/wa.me\/|Copiar link|application\/ld\+json/);
});
test('anúncio volta à mesma busca com filtros repetidos, ordenação e página', async () => {
  const { default: Pagina } = carregar(caminho + 'page.tsx', { ...mocks, '@clerk/nextjs/server': { auth: async () => ({ userId: null }) }, '@/lib/supabase/server': {}, '@/lib/dados/paginas': {}, '@/lib/dados/anuncios': { anuncioPublico: async () => anuncio, buscarAnuncios: async () => ({ anuncios: [] }) } });
  const idslug = linkAnuncio(anuncio.id, anuncio.titulo).split('/').pop();
  const voltar = '/busca?q=bike&cidade=Corrente&c_estado=Novo&c_estado=Usado&ordem=menor_preco&pagina=2';
  for (const [entrada, esperado] of [[voltar, voltar], ['//fora.example/busca', '/busca'], ['/busca\\fora', '/busca']]) {
    const html = render(await Pagina({ params: Promise.resolve({ idslug }), searchParams: Promise.resolve({ voltar: entrada }) }));
    assert.ok(html.includes('href="' + esperado.replaceAll('&', '&amp;') + '"'), esperado);
  }
});

test('galeria vazia e descrição curta são legíveis sem controles desnecessários', () => {
  const html = conteudo({ fotos: [], descricao: 'Descrição curta.' });
  assert.match(html, /Anúncio sem foto/); assert.match(html, /Descrição curta/);
  assert.doesNotMatch(html, /Abrir em tela cheia|Ver descrição completa/);
});
test('título e descrição maliciosos são escapados no HTML e dados estruturados', () => {
  const html = conteudo({ titulo: '</script><img src=x onerror=alert(1)>', descricao: '<script>alert(1)</script>' });
  assert.doesNotMatch(html, /<img src=x|<script>alert/);
  const json = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1];
  // O título aparece no padrão do site (1ª letra maiúscula, formatarNome) e continua escapado.
  assert.equal(JSON.parse(json).name, '</Script><img src=x onerror=alert(1)>');
});
test('endereço com codificação quebrada é inválido sem lançar URIError', () => {
  assert.equal(idDoLinkAnuncio('%E0%A4%A'), null);
  assert.equal(idDoLinkAnuncio('inexistente'), null);
  assert.equal(idDoLinkAnuncio(linkAnuncio(anuncio.id, anuncio.titulo, null).split('/').pop()), anuncio.id);
});
test('falha de dados é recuperável e não se transforma em anúncio inexistente', async () => {
  for (const resposta of [{ error: { message: 'falha' }, data: null }, { error: null, data: null }]) {
    const { anuncioPublico } = carregar('src/lib/dados/anuncios.ts', { '@/lib/supabase/server': { createClient: async () => ({ rpc: async () => resposta }) }, '@clerk/nextjs/server': {}, '@/lib/dados/regiao': {} });
    await assert.rejects(anuncioPublico(anuncio.id), /Não foi possível carregar/);
  }
  const { anuncioPublico } = carregar('src/lib/dados/anuncios.ts', { '@/lib/supabase/server': { createClient: async () => ({ rpc: async () => ({ data: [], error: null }) }) }, '@clerk/nextjs/server': {}, '@/lib/dados/regiao': {} });
  assert.equal(await anuncioPublico(anuncio.id), null);
});
test('falha de recomendações mantém o anúncio e contato principal disponíveis', async () => {
  const { default: Pagina } = carregar(caminho + 'page.tsx', { ...mocks, '@clerk/nextjs/server': { auth: async () => ({ userId: null }) }, '@/lib/supabase/server': {}, '@/lib/dados/paginas': {}, '@/lib/dados/anuncios': { anuncioPublico: async () => anuncio, buscarAnuncios: async () => { throw Error('offline'); } } });
  const html = render(await Pagina({ params: Promise.resolve({ idslug: linkAnuncio(anuncio.id, anuncio.titulo, null).split('/').pop() }) }));
  assert.match(html, /https:\/\/wa.me\//); assert.doesNotMatch(html, /Parecidos na região/);
});
test('favoritos recusam usuário sem sessão e identificador inválido antes de gravar', async () => {
  const { alternarFavorito } = carregar(caminho + 'actions.ts', { '@clerk/nextjs/server': { auth: async () => ({ userId: null }) }, '@/lib/supabase/server': { createClient: async () => { throw Error('não deve chamar'); } }, '@/lib/supabase/admin': {}, '@/lib/perfil': {} });
  assert.equal((await alternarFavorito(anuncio.id, true)).erro.codigo, '28000');
  assert.equal((await alternarFavorito('invalido', true)).ok, false);
  assert.equal((await alternarFavorito(anuncio.id, 'false')).ok, false);
});

test('falha de autenticação nas ações recebe mensagem recuperável', async () => {
  const acoes = carregar(caminho + 'actions.ts', { '@clerk/nextjs/server': { auth: async () => { throw Error('rede'); } }, '@/lib/supabase/server': {}, '@/lib/supabase/admin': {}, '@/lib/perfil': {} });
  assert.equal((await acoes.alternarFavorito(anuncio.id, true)).ok, false);
  const form = new FormData(); form.set('anuncio_id', anuncio.id); form.set('motivo', 'falso');
  assert.equal((await acoes.denunciarAnuncio(null, form)).mensagem, 'Algo deu errado. Tente de novo.');
  form.set('motivo', 'constructor');
  assert.equal((await acoes.denunciarAnuncio(null, form)).mensagem, 'Escolha um motivo.');
});

for (const caso of ['copiar', 'nativo', 'cancelado', 'indisponivel']) {
  test(`compartilhamento ${caso} respeita sucesso, cancelamento e alternativa manual`, async () => {
    const estados = []; let evento = 0; let recebido;
    const url = 'https://mercadodaregiao.com.br' + linkAnuncio(anuncio.id, anuncio.titulo, null);
    const anterior = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    const nav = caso === 'copiar' ? { clipboard: { writeText: async valor => { recebido = valor; } } } : caso === 'indisponivel' ? {} : { share: async valor => { recebido = valor; if (caso === 'cancelado') throw new DOMException('Cancelado', 'AbortError'); } };
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: nav });
    try {
      const { CompartilharAnuncio } = carregar(caminho + 'compartilhar.tsx', { react: { ...React, useState: inicial => { const i = estados.length; estados.push(inicial); return [inicial, valor => { estados[i] = valor; }]; } }, './actions': { registrarEvento: async () => { evento++; } } });
      const tree = CompartilharAnuncio({ anuncioId: anuncio.id, titulo: anuncio.titulo, url });
      const botoes = tree.props.children[0].props.children;
      await botoes[caso === 'copiar' ? 1 : 0].props.onClick();
      // O handler dispara a tarefa async sem bloquear o clique; libera as continuações da promessa.
      await new Promise(resolve => setImmediate(resolve));
      if (caso === 'copiar') { assert.equal(recebido, url); assert.match(estados[0], /Link copiado/); }
      if (caso === 'nativo') assert.deepEqual(recebido, { title: anuncio.titulo, url });
      assert.equal(evento, ['copiar', 'nativo'].includes(caso) ? 1 : 0);
      assert.equal(estados[1], caso === 'indisponivel');
      assert.equal(estados[2], false);
    } finally {
      if (anterior) Object.defineProperty(globalThis, 'navigator', anterior); else delete globalThis.navigator;
    }
  });
}
