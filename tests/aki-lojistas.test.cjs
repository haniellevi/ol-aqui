const { test } = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const { carregar } = require('./carregar.cjs');

const id = '42a00000-0000-4000-a000-000000000001';
const anuncio = '42a00000-0000-4000-a000-000000000002';
const uid = 'user_akiloja';
const origem = 'https://abc.supabase.co/storage/v1/object/public/anuncios/';
const webp = sharp({ create: { width: 320, height: 240, channels: 3, background: "#ddd" } }).webp().toBuffer();

function ambiente(t, { fiel = true, detalhe = '', logado = true, contaBloqueada = null, fotoOriginal = Buffer.from('foto indisponível para recorte local'), imagemProvedor = webp } = {}) {
  const chamadas = [];
  let reserva = null;
  let uploads = 0;
  let imagemSalva = null;
  let caminhoSalvo = null;
  const chaveAnterior = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'chave-de-teste-sem-rede';
  t.after(() => {
    if (chaveAnterior === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = chaveAnterior;
  });
  t.mock.method(console, 'error', () => {});
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    chamadas.push(url.split('/v1/').at(-1));
    if (url.endsWith('/chat/completions')) {
      assert.equal(JSON.parse(init.body).model, 'gpt-6-luna');
      assert.equal(reserva.estado, 'reservada');
      assert.equal(uploads, 0);
      return Response.json({ choices: [{ message: { content: JSON.stringify({ fiel, motivo: fiel ? "ok" : "produto", detalhe }) } }] });
    }
    if (url.endsWith('/images/edits')) assert.ok(init.body.get('image[]') instanceof Blob);
    return Response.json({ data: [{ b64_json: (await imagemProvedor).toString("base64") }] });
  });
  const db = {
    storage: { from: () => ({
      getPublicUrl: (path) => ({ data: { publicUrl: origem + path } }),
      download: async () => ({ data: new Blob([fotoOriginal], { type: 'image/webp' }) }),
      upload: async (path, bytes) => { uploads++; imagemSalva = bytes; caminhoSalvo = path; return { error: null }; },
    }) },
    rpc: async (nome, args) => {
      if (nome === 'config') return { data: args.p_padrao };
      assert.equal(nome, 'aki_reservar_imagem');
      assert.equal(args.p_usuario, uid);
      if (reserva) return { data: { ...reserva, restantes: 0 } };
      reserva = { estado: 'reservada' };
      return { data: { estado: 'nova', restantes: 0 } };
    },
    from(tabela) {
      const consulta = {
        eq: () => consulta, gt: () => consulta, select: () => consulta,
        single: async () => ({ data: { nome: 'Loja teste' } }),
        maybeSingle: async () => {
          if (['contas_revogadas', 'contas_bloqueadas', 'lixeira_contas'].includes(tabela)) {
            return { data: contaBloqueada === tabela ? { usuario_id: uid } : null, error: null };
          }
          return { data: { id } };
        },
        update: (dados) => { assert.equal(tabela, 'aki_imagens'); reserva = dados; return consulta; },
      };
      return consulta;
    },
  };
  const { POST } = carregar('src/app/api/aki/lojista/route.ts', {
    sharp: { default: sharp },
    '@clerk/nextjs/server': { auth: async () => ({ userId: logado ? uid : null }) },
    '@/lib/supabase/admin': { supabaseAdmin: () => db },
  });
  return {
    chamadas, reserva: () => reserva, uploads: () => uploads, imagemSalva: () => imagemSalva, caminhoSalvo: () => caminhoSalvo,
    gerar: (pedido) => POST(new Request('https://olaki.test/api/aki/lojista', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...pedido }) })),
  };
}

test('Merc guarda um banner e reapresenta a mesma arte sem chamar o provedor novamente', async (t) => {
  const a = ambiente(t);
  const primeira = await a.gerar({ tipo: 'banner' });
  assert.equal(primeira.status, 200);
  const arte = await primeira.json();
  assert.match(arte.url, /\/aki-banners\/aki-/);
  assert.deepEqual(await (await a.gerar({ tipo: 'banner' })).json(), arte);
  assert.deepEqual(a.chamadas, ['images/generations']);
  assert.equal(a.uploads(), 1);
  const { width, height } = await sharp(a.imagemSalva()).metadata();
  assert.deepEqual([width, height], [1500, 500]);
});

test('Merc libera a reserva se a foto tratada mudar detalhes do produto', async (t) => {
  const detalhe = "A inscrição 18V da bateria ficou ilegível.";
  const a = ambiente(t, { fiel: false, detalhe });
  const resposta = await a.gerar({ tipo: 'produto', anuncio, foto: origem + uid + '/' + anuncio + '/original.webp' });
  assert.equal(resposta.status, 502);
  const mensagem = (await resposta.json()).erro;
  assert.ok(mensagem.includes(detalhe));
  assert.match(mensagem, /crédito está disponível/);
  assert.deepEqual(a.chamadas, ['images/edits', 'chat/completions']);
  assert.equal(a.reserva().estado, 'falhou');
  assert.equal(a.uploads(), 0);
});

test('Merc exige sessão antes de reservar créditos ou chamar o provedor', async (t) => {
  const a = ambiente(t, { logado: false });
  const resposta = await a.gerar({ tipo: 'banner' });
  assert.equal(resposta.status, 401);
  assert.equal(a.reserva(), null);
  assert.deepEqual(a.chamadas, []);
});

for (const tabela of ['contas_revogadas', 'contas_bloqueadas', 'lixeira_contas']) {
  test(`Merc recusa conta em ${tabela} antes de reservar créditos ou chamar o provedor`, async (t) => {
    const a = ambiente(t, { contaBloqueada: tabela });
    const resposta = await a.gerar({ tipo: 'banner' });
    assert.equal(resposta.status, 403);
    assert.equal(a.reserva(), null);
    assert.deepEqual(a.chamadas, []);
  });
}

test('foto de produto do Merc fica na pasta do anúncio e passa na moderação automática', async (t) => {
  const a = ambiente(t);
  const resposta = await a.gerar({ tipo: 'produto', anuncio, foto: origem + uid + '/' + anuncio + '/original.webp' });
  assert.equal(resposta.status, 200);
  assert.equal(a.caminhoSalvo(), `${uid}/${anuncio}/aki-${id}.webp`);
  const anterior = process.env.NEXT_PUBLIC_SUPABASE_URL;
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://abc.supabase.co';
  t.after(() => { if (anterior === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = anterior; });
  const { fotoModeracaoPermitida } = carregar('src/lib/moderacao-ia.ts');
  assert.equal(fotoModeracaoPermitida(origem + a.caminhoSalvo(), { dono_id: uid, anuncio_id: anuncio }), true);
});

test('fundo liso clareia sem redesenhar marca, risco ou pixels do produto', async (t) => {
  const largura = 1600, altura = 1200;
  const pos = (x, y) => (y * largura + x) * 3;
  const original = Buffer.alloc(largura * altura * 3, Buffer.from([214, 198, 173]));
  const produto = Buffer.from([28, 78, 130]);
  for (let y = 300; y < 900; y++) original.fill(produto, pos(300, y), pos(1300, y));
  original.set([250, 250, 245], pos(680, 550)); // detalhe claro do rótulo
  original.set([143, 176, 197], pos(740, 790)); // risco
  const fotoOriginal = await sharp(original, { raw: { width: largura, height: altura, channels: 3 } }).webp({ lossless: true }).toBuffer();
  const a = ambiente(t, { fotoOriginal });
  const resposta = await a.gerar({ tipo: 'produto', anuncio, foto: origem + uid + '/' + anuncio + '/original.webp' });
  assert.equal(resposta.status, 200);
  assert.deepEqual(a.chamadas, ['chat/completions']);
  assert.equal(a.reserva().estado, 'pronta');
  const { data: tratada, info } = await sharp(a.imagemSalva()).raw().toBuffer({ resolveWithObject: true });
  assert.deepEqual([info.width, info.height], [1600, 1200]);
  assert.deepEqual([...tratada.subarray(0, 3)], [255, 255, 255]);
  for (let y = 300; y < 900; y++) {
    const inicio = pos(300, y);
    const fim = pos(1300, y);
    assert.deepEqual(tratada.subarray(inicio, fim), original.subarray(inicio, fim));
  }
});

test('foto vertical entra inteira no quadro do feed, com margens brancas', async (t) => {
  const foto = sharp({ create: { width: 320, height: 640, channels: 3, background: "#2b619e" } }).webp().toBuffer();
  const a = ambiente(t, { imagemProvedor: foto });
  const resposta = await a.gerar({ tipo: 'produto', anuncio, foto: origem + uid + '/' + anuncio + '/original.webp' });
  assert.equal(resposta.status, 200);
  const { data, info } = await sharp(a.imagemSalva()).raw().toBuffer({ resolveWithObject: true });
  assert.deepEqual([info.width, info.height], [1600, 1200]);
  const rgb = (x, y) => [...data.subarray((y * info.width + x) * 3, (y * info.width + x) * 3 + 3)];
  assert.deepEqual(rgb(100, 600), [255, 255, 255]);
  assert.deepEqual(rgb(1500, 600), [255, 255, 255]);
  assert.deepEqual(rgb(800, 1), rgb(800, 1198));
  assert.ok(rgb(800, 1)[2] > rgb(800, 1)[0], 'A imagem deve chegar inteira às bordas de cima e de baixo');
});
