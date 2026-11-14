const { test } = require('node:test');
const assert = require('node:assert/strict');
const { renderToStaticMarkup } = require('react-dom/server');
const { carregar } = require('./carregar.cjs');

const arquivo = 'src/app/(conta)/minha-conta/loja/marketing/criativo/[id]/route.tsx';
const id = '11111111-1111-4111-8111-111111111111';
const origem = 'https://abc.supabase.co';
const foto = `${origem}/storage/v1/object/public/anuncios/user/${id}/1.png`;
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64');
process.env.NEXT_PUBLIC_SUPABASE_URL = origem;

function rota(op = {}) {
  const chamadas = [];
  const loja = { id: 'loja-autorizada', tipo: 'loja', status: 'ativa', nome: 'Loja da Ana', slug: 'loja-da-ana', logo_url: null, ...op.loja };
  const anuncio = { id, titulo: 'Tênis confortável', foto, preco_centavos: 9900, preco_antes_centavos: 12900, ...op.anuncio };
  let desenho;
  const { GET } = carregar(arquivo, {
    '@clerk/nextjs/server': { auth: async () => { chamadas.push('auth'); return { userId: op.semLogin ? null : 'user' }; } },
    '@/lib/dados/vitrine-completa': { minhaVitrineCompleta: async (exigir) => {
      chamadas.push(['loja', exigir]);
      if (op.erroLoja) throw Error('segredo interno');
      return op.semLoja ? null : loja;
    } },
    '@/lib/dados/marketing-loja': { meuMarketingLoja: async (lojaId) => {
      chamadas.push(['marketing', lojaId]);
      if (op.erroMarketing) throw Error('segredo interno');
      return op.dadosNulos ? null : { criativos: op.semAnuncio ? [] : [anuncio] };
    } },
    'next/og': op.imagemReal ? require('next/og') : { ImageResponse: class extends Response {
      constructor(arvore, options) {
        super('png', options);
        desenho = { html: renderToStaticMarkup(arvore), ...options };
      }
    } },
  });
  return {
    chamadas,
    get desenho() { return desenho; },
    async get(formato = '', anuncioId = id) {
      const anterior = global.fetch;
      global.fetch = async (url, options) => {
        chamadas.push(['fetch', url, options]);
        if (op.erroFoto) throw Error('segredo interno');
        return new Response(op.bytes ?? png, { status: op.statusFoto ?? 200, headers: { 'content-type': op.tipoFoto ?? 'image/png', ...op.headersFoto } });
      };
      try { return await GET(new Request(`https://mercadodaregiao.com.br/minha-conta/loja/marketing/criativo/${anuncioId}${formato}`), { params: Promise.resolve({ id: anuncioId }) }); }
      finally { global.fetch = anterior; }
    },
  };
}

test('marketing artes: autenticação precede consultas e loja ativa é obrigatória', async () => {
  const anonima = rota({ semLogin: true });
  assert.equal((await anonima.get()).status, 401);
  assert.deepEqual(anonima.chamadas, ['auth']);
  for (const op of [{ semLoja: true }, { loja: { tipo: 'pessoa' } }, { loja: { status: 'montagem' } }, { loja: { status: 'suspensa' } }]) {
    const r = rota(op);
    assert.equal((await r.get()).status, 404);
    assert.equal(r.chamadas.some(c => c[0] === 'marketing'), false);
  }
});

test('marketing artes: consulta a loja autorizada e restringe aos anúncios recomendados atuais', async () => {
  const r = rota({ loja: { ajudante: true } });
  assert.equal((await r.get()).status, 200);
  assert.deepEqual(r.chamadas.slice(0, 3), ['auth', ['loja', true], ['marketing', 'loja-autorizada']]);
  const ausente = rota({ semAnuncio: true });
  assert.equal((await ausente.get()).status, 404);
  assert.equal(ausente.chamadas.some(c => c[0] === 'fetch'), false);
  assert.equal((await rota().get('', 'outro-anuncio')).status, 404);
});

test('marketing artes: formatos, dimensões, conteúdo e cabeçalhos privados', async () => {
  for (const [formato, altura] of [['', 1350], ['?formato=feed', 1350], ['?formato=stories', 1920]]) {
    const r = rota();
    const resposta = await r.get(formato);
    assert.equal(resposta.status, 200);
    assert.equal(r.desenho.width, 1080);
    assert.equal(r.desenho.height, altura);
    assert.equal(resposta.headers.get('cache-control'), 'private, no-store');
    assert.equal(resposta.headers.get('vary'), 'Cookie, Authorization');
    assert.equal(resposta.headers.get('content-type'), 'image/png');
    assert.match(resposta.headers.get('content-disposition'), /^attachment; filename="mercado-da-regiao-[a-z0-9-]+-(feed|stories)\.png"$/);
    for (const texto of ['Tênis confortável', 'R$ 99', 'R$ 129', 'Loja da Ana', 'Mercado da Região', '/loja/loja-da-ana', 'object-fit:contain', 'data:image/png;base64,']) assert.ok(r.desenho.html.includes(texto), texto);
    const f = r.chamadas.find(c => c[0] === 'fetch');
    assert.equal(f[2].redirect, 'error');
    assert.equal(f[2].cache, 'no-store');
    assert.ok(f[2].signal instanceof AbortSignal);
  }
  for (const formato of ['?formato=quadrado', '?formato=', '?formato=feed&formato=stories']) assert.equal((await rota().get(formato)).status, 400);
});

test('marketing artes: falhas têm resposta legível e preservam privacidade', async () => {
  for (const op of [{ erroLoja: true }, { erroMarketing: true }, { dadosNulos: true }, { erroFoto: true }, { statusFoto: 302 }, { tipoFoto: 'image/svg+xml' }, { bytes: Buffer.alloc(30) }, { bytes: Buffer.alloc(2_000_001) }, { headersFoto: { 'content-length': '2000001' } }]) {
    const resposta = await rota(op).get();
    assert.equal(resposta.status, 503);
    assert.equal(resposta.headers.get('cache-control'), 'private, no-store');
    assert.doesNotMatch(await resposta.text(), /segredo interno/);
  }
});

test('marketing artes: fotos externas, credenciais, portas, parâmetros e desvios de caminho são recusados antes do fetch', async () => {
  for (const url of ['http://127.0.0.1/a.png', 'https://externo.com/a.png', foto.replace('abc.supabase.co', 'abc.supabase.co.evil.test'), foto.replace('https://', 'https://user:senha@'), foto.replace('.co/', '.co:444/'), `${foto}?url=http://127.0.0.1`, `${foto}#fragmento`, foto.replace('/public/anuncios/', '/sign/anuncios/'), foto.replace('/1.png', '/1.svg'), foto.replace('/1.png', '/%2e%2e/segredo.png')]) {
    const r = rota({ anuncio: { foto: url } });
    assert.equal((await r.get()).status, 503, url);
    assert.equal(r.chamadas.some(c => c[0] === 'fetch'), false, url);
  }
});

test('marketing artes: logo externa é omitida sem buscar e preço anterior só aparece quando maior', async () => {
  const r = rota({ loja: { logo_url: 'https://externo.com/logo.png' }, anuncio: { preco_antes_centavos: 9900 } });
  assert.equal((await r.get()).status, 200);
  assert.equal(r.chamadas.filter(c => c[0] === 'fetch').length, 1);
  assert.doesNotMatch(r.desenho.html, /line-through/);
  const semPreco = rota({ anuncio: { preco_centavos: null, preco_antes_centavos: 12900 } });
  await semPreco.get();
  assert.match(semPreco.desenho.html, /A combinar/);
  assert.doesNotMatch(semPreco.desenho.html, /R\$ 129/);
});

test('marketing legenda: copia o texto e oferece seleção manual quando a permissão é recusada', async () => {
  const React = require('react');
  const anterior = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  try {
    for (const recusado of [false, true]) {
      let estado = 'inicial';
      let recebido;
      Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard: { writeText: async (texto) => {
        if (recusado) throw Error('sem permissão');
        recebido = texto;
      } } } });
      const { CopiarLegenda } = carregar('src/components/marketing/copiar-legenda.tsx', {
        react: { ...React, useState: () => [estado, (valor) => { estado = valor; }] },
        '@/components/ui/botao': { Botao: ({ variante, icone, carregando, children, ...props }) => React.createElement('button', props, children) },
        '@/components/ui/textarea': { Textarea: 'textarea' },
      });
      const texto = 'Tênis por R$ 99\nhttps://mercadodaregiao.com.br/loja/ana';
      await CopiarLegenda({ texto }).props.children[0].props.onClick();
      await new Promise(resolve => setImmediate(resolve));
      assert.equal(estado, recusado ? 'manual' : 'copiado');
      const html = renderToStaticMarkup(CopiarLegenda({ texto }));
      assert.match(html, /role="status"/);
      if (recusado) {
        assert.match(html, /textarea/);
        assert.match(html, /Selecione/);
      } else {
        assert.equal(recebido, texto);
        assert.match(html, /Legenda copiada/);
      }
    }
  } finally {
    if (anterior) Object.defineProperty(globalThis, 'navigator', anterior);
    else delete globalThis.navigator;
  }
});

test('marketing artes: renderiza PNG real nas duas dimensões', async () => {
  for (const [formato, altura] of [['feed', 1350], ['stories', 1920]]) {
    const resposta = await rota({ imagemReal: true }).get(`?formato=${formato}`);
    assert.equal(resposta.status, 200);
    const bytes = Buffer.from(await resposta.arrayBuffer());
    assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(bytes.readUInt32BE(16), 1080);
    assert.equal(bytes.readUInt32BE(20), altura);
    assert.ok(bytes.length > 1000);
  }
});
