const { test } = require('node:test');
const assert = require('node:assert/strict');
const { carregar } = require('./carregar.cjs');

const origem = 'https://olaki.test';
const id = '38000000-0000-4000-a000-000000000001';
const arquivo = '%PDF-1.7 Documento fictício';

function pedido(dados, origin = origem) {
  return new Request(`${origem}/api/verificacao-vendedor`, { method: 'POST', headers: { origin }, body: dados });
}

test('envio usa a sessão como titular e bloqueia origem externa e arquivo faltando', async () => {
  const chamadas = [];
  const { POST } = carregar('src/app/api/verificacao-vendedor/route.ts', {
    '@clerk/nextjs/server': { auth: async () => ({ userId: 'user_titular' }) },
    '@/lib/supabase/admin': { supabaseAdmin: () => ({
      rpc: async (...args) => { chamadas.push(args); return { data: 'enviada', error: null }; },
    }) },
  });
  const form = new FormData();
  form.set('perfil_id', 'user_terceiro');
  form.set('documento', new Blob([arquivo], { type: 'application/pdf' }), 'nome-privado.pdf');
  assert.equal((await POST(pedido(form))).status, 400);
  form.set('comprovante', new Blob(['%PDF-1.7 Comprovante fictício'], { type: 'application/pdf' }), 'endereco-privado.pdf');
  assert.equal((await POST(pedido(form, 'https://fora.test'))).status, 403);
  assert.deepEqual(chamadas, []);
  assert.equal((await POST(pedido(form))).status, 200);
  const [rpc, dados] = chamadas[0];
  assert.equal(rpc, 'enviar_verificacao_vendedor_pf');
  assert.equal(dados.p_usuario, 'user_titular');
  assert.equal(Buffer.from(dados.p_documento, 'base64').toString(), arquivo);
  assert.deepEqual(Object.keys(dados).sort(), ['p_comprovante', 'p_documento', 'p_usuario']);
});

test('download autorizado é anexo sem cache e recusa de papel não devolve bytes', async () => {
  let autorizado = true;
  const { GET } = carregar('src/app/api/verificacao-vendedor/[id]/[tipo]/route.ts', {
    '@clerk/nextjs/server': { auth: async () => ({ userId: 'user_equipe' }) },
    '@/lib/supabase/server': { createClient: async () => ({
      rpc(nome, args) {
        assert.equal(nome, 'admin_arquivo_verificacao_pf');
        assert.deepEqual(args, { p_id: id, p_tipo: 'documento' });
        return { maybeSingle: async () => autorizado
          ? { data: { arquivo_base64: Buffer.from(arquivo).toString('base64'), mime: 'application/pdf' }, error: null }
          : { data: null, error: { code: '42501' } } };
      },
    }) },
  });
  const parametros = { params: Promise.resolve({ id, tipo: 'documento' }) };
  const res = await GET(new Request(origem), parametros);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'private, no-store');
  assert.equal(res.headers.get('content-disposition'), 'attachment; filename="documento.pdf"');
  assert.equal(await res.text(), arquivo);
  autorizado = false;
  const negado = await GET(new Request(origem), parametros);
  assert.equal(negado.status, 403);
  assert.doesNotMatch(await negado.text(), /PDF/);
});
