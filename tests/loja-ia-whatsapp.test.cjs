const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { carregar } = require('./carregar.cjs');
const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; delete process.env.LOJA_IA_PERFIL_URL; delete process.env.LOJA_IA_PERFIL_SEGREDO; });
const trabalho = { id: '11111111-1111-4111-8111-111111111111', tentativa: '22222222-2222-4222-8222-222222222222' };
const db = { rpc: async () => ({ data: '33333333-3333-4333-8333-333333333333', error: null }) };
const modulo = () => carregar('src/lib/loja-ia/whatsapp.ts');
test('perfil desativado ou ticket recusado não consulta serviço', async () => {
  const m = modulo(); let chamadas = 0; global.fetch = async () => { chamadas++; throw Error('não deveria chamar'); };
  assert.equal((await m.consultarPerfilComercial(trabalho, db)).estado, 'indisponivel');
  process.env.LOJA_IA_PERFIL_URL = 'https://exemplo.test'; process.env.LOJA_IA_PERFIL_SEGREDO = 'a'.repeat(32);
  assert.equal((await m.consultarPerfilComercial(trabalho, { rpc: async () => ({ data: null, error: {} }) })).estado, 'indisponivel');
  assert.equal(chamadas, 0);
});
test('retorna somente dados comerciais e usa ticket sem número', async () => {
  process.env.LOJA_IA_PERFIL_URL = 'https://exemplo.test'; process.env.LOJA_IA_PERFIL_SEGREDO = 'a'.repeat(32);
  let request; global.fetch = async (url, options) => { request = { url, options }; return new Response(JSON.stringify({ nome: 'Loja', descricao: 'Produtos', site: 'https://loja.test', numero: 'privado' })); };
  const resultado = await modulo().consultarPerfilComercial(trabalho, db);
  assert.equal(resultado.estado, 'ok'); assert.deepEqual(resultado.evidencias.map(x => x.campo), ['nome', 'sobre', 'site']);
  assert.deepEqual(JSON.parse(request.options.body), { ticket: '33333333-3333-4333-8333-333333333333' });
  assert.equal(request.options.redirect, 'error');
});
test('falha de fornecedor e perfil sem dados comerciais mantêm revisão possível', async () => {
  process.env.LOJA_IA_PERFIL_URL = 'https://exemplo.test'; process.env.LOJA_IA_PERFIL_SEGREDO = 'a'.repeat(32);
  for (const f of [async () => { throw Error('fora do ar'); }, async () => new Response('{}'), async () => new Response('erro', { status: 503 })]) {
    global.fetch = f; assert.equal((await modulo().consultarPerfilComercial(trabalho, db)).estado, 'indisponivel');
  }
});

test('ponte só lê perfil comercial e não devolve dados privados', () => {
  const { execFileSync } = require('node:child_process');
  const codigo = `import importlib.util, os, sys\nsys.dont_write_bytecode=True\nspec=importlib.util.spec_from_file_location('ponte','infra/whatsapp/perfil-loja.py')\nm=importlib.util.module_from_spec(spec); spec.loader.exec_module(m)\nos.environ.update(LOJA_IA_CALLBACK_URL='https://site.test/callback',LOJA_IA_CALLBACK_SEGREDO='x'*32,EVOLUTION_API_KEY='segredo',EVOLUTION_URL='https://evolution.test')\nchamadas=[]\ndef post(url, body, headers):\n chamadas.append((url,body,headers)); return {'numero':'5589999978811'} if len(chamadas)==1 else {'isBusiness':True,'name':'Loja','description':'Roupas','website':'https://loja.test','email':'privado'}\nm.post=post\nassert m.consultar('ticket')=={'nome':'Loja','descricao':'Roupas','site':'https://loja.test'}\nassert chamadas[1][0]=='http://127.0.0.1:8087/chat/fetchProfile/olaki-verificacao'\nassert chamadas[1][1]=={'number':'5589999978811'}\nassert chamadas[1][2]=={'apikey':'segredo','Origin':'https://evolution.test'}\n`;
  execFileSync('python3', ['-c', codigo]);
});

test('callback protege resgate e devolve número só para serviço autorizado', async () => {
  process.env.LOJA_IA_CALLBACK_SEGREDO = 'b'.repeat(32);
  let chamadas = 0;
  const r = carregar('src/app/api/interno/loja-ia/perfil-whatsapp/route.ts', {
    'next/server': { NextResponse: { json: (body, init) => ({ body, status: init?.status ?? 200 }) } },
    '@/lib/supabase/admin': { supabaseAdmin: () => ({ rpc: async () => { chamadas++; return { data: '5589999978811', error: null }; } }) },
  });
  const requisicao = (auth, body) => new Request('https://site.test', { method:'POST', headers: { authorization: auth }, body: JSON.stringify(body) });
  const ticket = '33333333-3333-4333-8333-333333333333';
  assert.equal((await r.POST(requisicao('Bearer errada', { ticket }))).status, 401);
  assert.equal((await r.POST(requisicao('Bearer ' + 'b'.repeat(32), { ticket, numero: 'outro' }))).status, 400);
  const ok = await r.POST(requisicao('Bearer ' + 'b'.repeat(32), { ticket }));
  assert.equal(ok.body.numero, '5589999978811'); assert.equal(chamadas, 1);
  delete process.env.LOJA_IA_CALLBACK_SEGREDO;
});
