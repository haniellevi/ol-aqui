const { test } = require('node:test');
const assert = require('node:assert/strict');
const { existsSync } = require('node:fs');
const path = require('node:path');
const { carregar } = require('./carregar.cjs');
const { linkAnuncio, idDoLinkAnuncio, slugDoTitulo, slugTexto, ehSlugAnuncio } = carregar('src/lib/formato.ts');
const { slugDe } = carregar('src/lib/admin/regras-cadastros.ts');
const id = '3f2a9c1e-7b4d-4e8a-9c2f-1a2b3c4d5e6f';

test('link com endereço curto usa só o slug', () => {
  assert.equal(linkAnuncio(id, 'Geladeira Brastemp K3X', 'geladeira-brastemp-k3x-a1b2'), '/anuncio/geladeira-brastemp-k3x-a1b2');
});

for (const slug of [null, undefined, '']) {
  test(`link sem endereço (${slug}) cai no formato antigo id-titulo`, () => {
    assert.equal(linkAnuncio(id, 'Moto Titan 150 – 2015, revisada!', slug), `/anuncio/${id}-moto-titan-150-2015-revisada`);
  });
}

test('link antigo sem título usa "anuncio"', () => {
  assert.equal(linkAnuncio(id, null, null), `/anuncio/${id}-anuncio`);
});

test('idDoLinkAnuncio extrai o UUID do formato antigo, com ou sem título, em maiúsculas ou codificado', () => {
  assert.equal(idDoLinkAnuncio(id), id);
  assert.equal(idDoLinkAnuncio(`${id}-moto-titan-2015`), id);
  assert.equal(idDoLinkAnuncio(`${id.toUpperCase()}-moto`), id);
  assert.equal(idDoLinkAnuncio(encodeURIComponent(`${id}-moto-titan-2015`)), id);
});

test('idDoLinkAnuncio não confunde o endereço curto com um id', () => {
  assert.equal(idDoLinkAnuncio('geladeira-brastemp-k3x-a1b2'), null);
  assert.equal(idDoLinkAnuncio('%E0%A4%A'), null);
});

test('ehSlugAnuncio aceita só o formato do banco', () => {
  assert.equal(ehSlugAnuncio('geladeira-brastemp-k3x-a1b2'), true);
  assert.equal(ehSlugAnuncio('Geladeira'), false);
  assert.equal(ehSlugAnuncio('geladeira--k3x'), false);
  assert.equal(ehSlugAnuncio('-geladeira'), false);
  assert.equal(ehSlugAnuncio(`${'a'.repeat(71)}`), false);
  assert.equal(ehSlugAnuncio(null), false);
});

// Os valores abaixo são os mesmos que public.slug_texto() devolve no banco (ver supabase/testes/530).
const casos = [
  ['Moto Titan 150 – 2015, revisada!', 'moto-titan-150-2015-revisada'],
  ['Sofá & Cama Mola Ação', 'sofa-cama-mola-acao'],
  ['  Ração   para  Cães!! ', 'racao-para-caes'],
  ['Straße Øl', 'strasse-ol'],
  ['Casa e Móveis', 'casa-e-moveis'],
];
for (const [titulo, esperado] of casos) {
  test(`slug igual ao do banco para: ${titulo}`, () => {
    assert.equal(slugTexto(titulo), esperado);
    assert.equal(slugDoTitulo(titulo), esperado);
    assert.equal(slugDe(titulo), esperado);
  });
}

test('título sem letras úteis usa "anuncio" como base', () => {
  assert.equal(slugDoTitulo('!!! ###'), 'anuncio');
  assert.equal(slugDoTitulo('a'), 'anuncio');
  assert.equal(slugDoTitulo(null), 'anuncio');
});

test('base longa é cortada em 60 letras sem hífen no fim', () => {
  const titulo = 'Aaaaaaaaa Bbbbbbbbb Ccccccccc Ddddddddd Eeeeeeeee Fffffffff Ggggggggg Hhhhhhhhh';
  assert.equal(slugDoTitulo(titulo), 'aaaaaaaaa-bbbbbbbbb-ccccccccc-ddddddddd-eeeeeeeee-fffffffff');
  assert.equal(slugDoTitulo(titulo).length, 59);
});

// Rota /anuncio/[idslug]: link curto, link antigo com 308 e anúncio que não existe.
const fixtureAnuncio = require('./fixtures/anuncio.cjs');
const rota = 'src/app/(anuncio-publico)/anuncio/[idslug]/page.tsx';
const SLUG = 'geladeira-brastemp-k3x-a1b2';
const comSlug = { ...fixtureAnuncio, slug: SLUG };
function rotaCarregada(dados, foraDoAr = null) {
  const mocks = {
    'next/navigation': {
      redirect: url => { throw Error(`redirect:${url}`); },
      permanentRedirect: url => { throw Error(`permanente:${url}`); },
      notFound: () => { throw Error('404'); },
    },
    '@clerk/nextjs/server': { auth: async () => ({ userId: null }) },
    '@/lib/dados/favoritos': { ehFavorito: async () => false },
    '@/lib/dados/seguro': { seguro: async (f, d) => { try { return await f(); } catch { return d; } } },
    '@/lib/dados/paginas': { anuncioForaDoAr: async () => foraDoAr },
    '@/components/paginas/anuncio-fora-do-ar': { AnuncioForaDoAr: () => null },
    './conteudo-anuncio': { ConteudoAnuncio: () => null },
    '@/lib/dados/anuncios': {
      anuncioPublico: async id => (id === fixtureAnuncio.id ? dados : null),
      anuncioIdPorSlug: async s => (s === SLUG ? fixtureAnuncio.id : null),
      buscarAnuncios: async () => ({ anuncios: [] }),
    },
  };
  return carregar(rota, mocks);
}
const pagina = dados => rotaCarregada(dados).default;
const abrir = (Pagina, idslug) => Pagina({ params: Promise.resolve({ idslug }) });

test('rota de anúncio decide o 404 antes de qualquer tela de carregamento', () => {
  let pasta = path.dirname(rota);
  while (pasta !== 'src') {
    assert.equal(existsSync(path.join(pasta, 'loading.tsx')), false, pasta);
    pasta = path.dirname(pasta);
  }
});

test('link curto abre o anúncio sem redirecionar', async () => {
  const el = await abrir(pagina(comSlug), SLUG);
  assert.equal(el.props.a.slug, SLUG);
});

test('link antigo de anúncio com endereço curto vai para o curto com 308', async () => {
  const antigo = `${fixtureAnuncio.id}-${slugDoTitulo(fixtureAnuncio.titulo)}`;
  await assert.rejects(abrir(pagina(comSlug), antigo), { message: `permanente:/anuncio/${SLUG}` });
});

test('link antigo de anúncio sem endereço continua abrindo no formato antigo', async () => {
  const antigo = `${fixtureAnuncio.id}-${slugDoTitulo(fixtureAnuncio.titulo)}`;
  const el = await abrir(pagina({ ...fixtureAnuncio, slug: null }), antigo);
  assert.equal(el.props.a.slug, null);
});

test('link antigo com título errado, sem endereço curto, é corrigido com redirecionamento comum', async () => {
  await assert.rejects(abrir(pagina({ ...fixtureAnuncio, slug: null }), `${fixtureAnuncio.id}-titulo-errado`), { message: `redirect:/anuncio/${fixtureAnuncio.id}-${slugDoTitulo(fixtureAnuncio.titulo)}` });
});

test('endereço curto que não existe vira "não encontrado"', async () => {
  await assert.rejects(abrir(pagina(comSlug), 'nao-existe-0000'), { message: '404' });
});

test('link excluído vira 404 pelo slug e pelo UUID mesmo quando o dono consegue resolver o slug', async () => {
  const excluido = pagina(null);
  for (const endereco of [SLUG, `${fixtureAnuncio.id}-${slugDoTitulo(fixtureAnuncio.titulo)}`]) {
    await assert.rejects(abrir(excluido, endereco), { message: '404' });
  }
});

test('link pausado vira 404 pelo slug e pelo UUID mesmo para quem pode editar', async () => {
  const { default: Pagina, generateMetadata } = rotaCarregada({ ...comSlug, status: 'pausado' });
  for (const endereco of [SLUG, `${fixtureAnuncio.id}-${slugDoTitulo(fixtureAnuncio.titulo)}`]) {
    await assert.rejects(abrir(Pagina, endereco), { message: '404' });
    const meta = await abrir(generateMetadata, endereco);
    assert.equal(meta.title, 'Anúncio não encontrado');
    assert.equal(meta.robots.index, false);
  }
});

test('anúncio expirado ainda mostra a página fora do ar para visitantes', async () => {
  const { default: Pagina } = rotaCarregada(null, { categoria_slug: 'moveis', categoria_nome: 'Móveis' });
  const el = await abrir(Pagina, SLUG);
  assert.equal(el.props.categoriaSlug, 'moveis');
});
