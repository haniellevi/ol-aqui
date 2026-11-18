const test = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const { carregar } = require('./carregar.cjs');
const { normalizarMaterial } = carregar('src/lib/loja-ia/imagens.ts', { sharp: { default: sharp } });

test('normalização rejeita MIME incompatível com o conteúdo', async () => {
  const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: 'red' } }).png().toBuffer();
  await assert.rejects(normalizarMaterial(png, 'image/jpeg'), /formato/i);
});

test('normalização gera WebP e recusa arquivo excessivo', async () => {
  const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: 'red' } }).png().toBuffer();
  const saida = await normalizarMaterial(png, 'image/png');
  assert.equal((await sharp(saida).metadata()).format, 'webp');
  await assert.rejects(normalizarMaterial(Buffer.alloc(20 * 1024 * 1024 + 1), 'image/png'), /20 MB/);
});

test('rota nega imagem sem vínculo e nunca armazena resposta', async () => {
  let download = 0;
  const { GET } = carregar('src/app/api/loja/imagem/[id]/route.ts', {
    '@/lib/supabase/admin': { supabaseAdmin: () => ({ rpc: async () => ({ data: null, error: null }), storage: { from: () => ({ download: async () => { download++; } }) } }) },
  });
  const response = await GET(new Request('http://localhost'), { params: Promise.resolve({ id: '00000000-0000-4000-8000-000000000001' }) });
  assert.equal(response.status, 404);
  assert.match(response.headers.get('cache-control'), /no-store/);
  assert.equal(download, 0);
});

test('rota serve objeto apenas após autorização do banco', async () => {
  const { GET } = carregar('src/app/api/loja/imagem/[id]/route.ts', {
    '@/lib/supabase/admin': { supabaseAdmin: () => ({ rpc: async () => ({ data: 'privado/teste.webp', error: null }), storage: { from: () => ({ download: async () => ({ data: new Blob(['imagem']), error: null }) }) } }) },
  });
  const response = await GET(new Request('http://localhost'), { params: Promise.resolve({ id: '00000000-0000-4000-8000-000000000001' }) });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'image/webp');
  assert.match(response.headers.get('cache-control'), /no-store/);
});

test('limpeza só confirma exclusão após Storage aceitar remoção', async () => {
  const chamadas = [];
  let falhar = true;
  const admin = {
    rpc: async (nome) => { chamadas.push(nome); return { data: nome === 'loja_ia_marcar_descarte' ? 'caminho' : null, error: null }; },
    storage: { from: () => ({ remove: async () => ({ error: falhar ? new Error('falha') : null }) }) },
  };
  const { limparMaterial } = carregar('src/lib/loja-ia/imagens.ts', { sharp: { default: sharp }, '@/lib/supabase/admin': { supabaseAdmin: () => admin } });
  const id = '00000000-0000-4000-8000-000000000001';
  assert.equal(await limparMaterial(id), false);
  assert.deepEqual(chamadas, ['loja_ia_marcar_descarte']);
  falhar = false;
  assert.equal(await limparMaterial(id), true);
  assert.deepEqual(chamadas, ['loja_ia_marcar_descarte', 'loja_ia_marcar_descarte', 'loja_ia_confirmar_descarte']);
});

test('coleta de materiais usa só imagens prontas do rascunho', async () => {
  const consultas = [];
  const imagem = '00000000-0000-4000-8000-000000000001';
  const rascunho = '00000000-0000-4000-8000-000000000002';
  const query = { select() { return this; }, eq(chave, valor) { consultas.push([chave, valor]); return this; }, in(chave, valor) { consultas.push([chave, valor]); return this; }, then(resolve) { resolve({ data: [{ id: imagem, tipo: 'logo' }], error: null }); } };
  const { coletarMateriais } = carregar('src/lib/loja-ia/imagens.ts', { sharp: { default: sharp }, '@/lib/supabase/admin': { supabaseAdmin: () => ({ from: () => query }) } });
  const resultado = await coletarMateriais(rascunho, [imagem]);
  assert.deepEqual(consultas, [['rascunho_id', rascunho], ['estado', 'pronta'], ['id', [imagem]]]);
  assert.equal(resultado.evidencias[0].campo, 'logo');
  assert.equal(resultado.evidencias[0].valor, imagem);
});

test('na Cloudflare, normalização usa o serviço interno sem carregar sharp', async (t) => {
  const anterior = process.env.CLOUDFLARE_IMAGENS;
  process.env.CLOUDFLARE_IMAGENS = '1';
  t.after(() => { if (anterior === undefined) delete process.env.CLOUDFLARE_IMAGENS; else process.env.CLOUDFLARE_IMAGENS = anterior; });
  let recebido = null;
  const { normalizarMaterial: normalizar } = carregar('src/lib/loja-ia/imagens.ts', {
    sharp: { default: () => { throw new Error('sharp não funciona no Worker'); } },
    '@opennextjs/cloudflare': { getCloudflareContext: () => ({ env: { IMAGENS_TRATAMENTO: { fetch: async (url, init) => { recebido = { url, tipo: init.headers['content-type'], bytes: Buffer.from(init.body) }; return new Response(Buffer.from('webp')); } } } }) },
  });
  const resultado = await normalizar(Buffer.from('foto de teste'), 'image/png');
  assert.equal(resultado.toString(), 'webp');
  assert.equal(recebido.tipo, 'image/png');
  assert.equal(recebido.bytes.toString(), 'foto de teste');
  assert.match(recebido.url, /\/normalizar$/);
});

test('falha do serviço de imagens não acusa arquivo válido como inválido', async (t) => {
  const antes = process.env.CLOUDFLARE_IMAGENS;
  process.env.CLOUDFLARE_IMAGENS = '1';
  t.after(() => { if (antes === undefined) delete process.env.CLOUDFLARE_IMAGENS; else process.env.CLOUDFLARE_IMAGENS = antes; });
  const { normalizarMaterial: normalizar } = carregar('src/lib/loja-ia/imagens.ts', {
    '@opennextjs/cloudflare': { getCloudflareContext: () => ({ env: { IMAGENS_TRATAMENTO: { fetch: async () => new Response(null, { status: 503 }) } } }) },
  });
  await assert.rejects(normalizar(Buffer.from('imagem'), 'image/png'), /serviço de imagens indisponível/i);
});
