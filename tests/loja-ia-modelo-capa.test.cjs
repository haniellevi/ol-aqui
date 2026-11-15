const test = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const { carregar } = require('./carregar.cjs');

test('modelo do Merc é um arquivo WebP de 1500 por 500, sem acesso a serviços', async () => {
  const { desenharModeloCapa } = carregar('src/lib/loja-ia/modelo-capa.ts', { sharp: { default: sharp } });
  const imagem = await desenharModeloCapa();
  const metadata = await sharp(imagem).metadata();
  assert.equal(metadata.format, 'webp');
  assert.equal(metadata.width, 1500);
  assert.equal(metadata.height, 500);
});

test('reserva pronta retorna o mesmo ID sem repetir o trabalho', async () => {
  const id = '00000000-0000-4000-8000-000000000001';
  let uploads = 0;
  const { gerarModeloCapa } = carregar('src/lib/loja-ia/modelo-capa.ts', {
    sharp: { default: sharp },
    '@/lib/supabase/server': { createClient: async () => ({ rpc: async () => ({ data: { estado: 'pronta', id }, error: null }) }) },
    '@/lib/supabase/admin': { supabaseAdmin: () => { uploads++; throw new Error('não deveria acessar Storage'); } },
  });
  assert.deepEqual(await gerarModeloCapa(id), { id });
  assert.equal(uploads, 0);
});

test('preview autenticado nega imagem alheia sem consultar Storage', async () => {
  let acessos = 0;
  const { GET } = carregar('src/app/api/loja/imagem/[id]/revisao/route.ts', {
    '@/lib/supabase/server': { createClient: async () => ({ rpc: async () => ({ data: null, error: null }) }) },
    '@/lib/supabase/admin': { supabaseAdmin: () => { acessos++; throw new Error('acesso indevido'); } },
  });
  const id = '00000000-0000-4000-8000-000000000001';
  const resposta = await GET(new Request(`http://localhost/api/loja/imagem/${id}/revisao?rascunho=${id}`), { params: Promise.resolve({ id }) });
  assert.equal(resposta.status, 404);
  assert.match(resposta.headers.get('cache-control'), /no-store/);
  assert.equal(acessos, 0);
});

test('na Cloudflare, o modelo fixo vem do serviço interno', async (t) => {
  const antes = process.env.CLOUDFLARE_IMAGENS;
  process.env.CLOUDFLARE_IMAGENS = '1';
  t.after(() => { if (antes === undefined) delete process.env.CLOUDFLARE_IMAGENS; else process.env.CLOUDFLARE_IMAGENS = antes; });
  let destino = '';
  const { desenharModeloCapa } = carregar('src/lib/loja-ia/modelo-capa.ts', {
    sharp: { default: () => { throw new Error('sharp não funciona no Worker'); } },
    '@opennextjs/cloudflare': { getCloudflareContext: () => ({ env: { IMAGENS_TRATAMENTO: { fetch: async (url) => { destino = url; return new Response('modelo'); } } } }) },
  });
  assert.equal((await desenharModeloCapa()).toString(), 'modelo');
  assert.match(destino, /\/modelo-capa$/);
});
