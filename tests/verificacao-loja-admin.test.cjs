const test = require('node:test');
const assert = require('node:assert/strict');
const { carregar } = require('./carregar.cjs');

const id = '7a0593da-15d2-47e6-bbe0-30c5fe4e1f16';
const MUDOU = 'Os dados ou a decisão mudaram. Atualize a página e confira novamente.';

function contexto({ papel = 'suporte', erro = null } = {}) {
  const calls = [];
  const actions = carregar('src/app/admin/lojas/actions.ts', {
    'next/cache': { revalidatePath(c) { calls.push({ nome: 'revalidatePath', args: c }); } },
    'next/navigation': { unstable_rethrow(e) { throw e; } },
    '@/lib/admin/equipe': { exigirTela: async () => ({ papel, supabase: {
      rpc: async (nome, args) => { calls.push({ nome, args }); return { error: erro }; },
    } }) },
  });
  const form = new FormData();
  form.set('id', id); // resolverAvisoVerificacaoLoja
  form.set('pedido', id); // decidirVerificacaoLoja (campo "id" no form fazia o React perder o botão apertado)
  return { actions, calls, form };
}
const rpcs = (calls) => calls.filter(c => c.nome !== 'revalidatePath');

test('decidirVerificacaoLoja: só administrador e suporte; moderador, financeiro e franqueado são recusados sem chamar o banco', async () => {
  for (const papel of ['moderador', 'financeiro', 'franqueado']) {
    const { actions, calls, form } = contexto({ papel });
    form.set('decisao', 'recusar');
    form.set('motivo', 'outro');
    const r = await actions.decidirVerificacaoLoja(null, form);
    assert.match(r.erro, /papel/);
    assert.deepEqual(calls, []);
  }
  for (const papel of ['administrador', 'suporte']) {
    const { actions, calls, form } = contexto({ papel });
    form.set('decisao', 'recusar');
    form.set('motivo', 'cnpj_inativo');
    const r = await actions.decidirVerificacaoLoja(null, form);
    assert.ok(r.ok, papel);
    assert.equal(rpcs(calls).length, 1);
  }
});

test('decidirVerificacaoLoja: repassa os argumentos certos de cada decisão', async () => {
  const casos = [
    ['aprovar', { conferido: 'on', motivo: 'outro' }, { p_decisao: 'aprovar', p_motivo: null, p_conferido: true }, /aprovada/i],
    ['correcao', { motivo: 'comprovante_invalido' }, { p_decisao: 'correcao', p_motivo: 'comprovante_invalido', p_conferido: false }, /correção/i],
    ['recusar', { motivo: 'cnpj_nao_encontrado' }, { p_decisao: 'recusar', p_motivo: 'cnpj_nao_encontrado', p_conferido: false }, /recusad/i],
    ['confirmar', { motivo: 'outro' }, { p_decisao: 'confirmar', p_motivo: null, p_conferido: false }, /confirmad/i],
    ['tirar_selo', { motivo: 'titularidade' }, { p_decisao: 'tirar_selo', p_motivo: 'titularidade', p_conferido: false }, /selo/i],
  ];
  for (const [decisao, campos, esperado, aviso] of casos) {
    const { actions, calls, form } = contexto();
    form.set('decisao', decisao);
    for (const [k, v] of Object.entries(campos)) form.set(k, v);
    const r = await actions.decidirVerificacaoLoja(null, form);
    assert.match(r.ok, aviso, decisao);
    assert.deepEqual(rpcs(calls), [{ nome: 'admin_decidir_verificacao_loja', args: { p_id: id, ...esperado } }], decisao);
    assert.ok(calls.some(c => c.nome === 'revalidatePath' && c.args === '/admin/lojas'), 'atualiza a tela');
  }
});

test('decidirVerificacaoLoja: confere o que dá antes de chamar o banco', async () => {
  const falhas = [
    [{ pedido: 'abc', decisao: 'recusar', motivo: 'outro' }, /não encontrad/i],
    [{ decisao: 'apagar', motivo: 'outro' }, /decisão/i],
    [{ decisao: '' }, /decisão/i],
    [{ decisao: 'aprovar' }, /conferi/i],
    [{ decisao: 'aprovar', conferido: 'sim' }, /conferi/i],
    [{ decisao: 'correcao' }, /motivo/i],
    [{ decisao: 'recusar', motivo: 'qualquer' }, /motivo/i],
    [{ decisao: 'tirar_selo', motivo: '' }, /motivo/i],
  ];
  for (const [campos, erro] of falhas) {
    const { actions, calls, form } = contexto();
    for (const [k, v] of Object.entries(campos)) form.set(k, v);
    const r = await actions.decidirVerificacaoLoja(null, form);
    assert.match(r.erro, erro, JSON.stringify(campos));
    assert.deepEqual(calls, [], JSON.stringify(campos));
  }
});

test('decidirVerificacaoLoja: lê o pedido do campo "pedido" (não mais de "id")', async () => {
  const { actions, calls, form } = contexto();
  form.delete('pedido');
  form.set('decisao', 'recusar');
  form.set('motivo', 'outro');
  assert.match((await actions.decidirVerificacaoLoja(null, form)).erro, /não encontrad/i);
  assert.deepEqual(calls, []);
});

test('analisarVerificacao: lê a verificação do campo "verificacao" e respeita o botão apertado', async () => {
  const montar = (campos) => {
    const calls = [];
    const actions = carregar('src/app/admin/lojas/actions.ts', {
      'next/cache': { revalidatePath() {} },
      'next/navigation': { unstable_rethrow(e) { throw e; } },
      '@/lib/admin/equipe': { exigirTela: async () => ({ papel: 'suporte', supabase: { rpc: async (nome, args) => { calls.push({ nome, args }); return { error: null }; } } }) },
    });
    const form = new FormData();
    for (const [k, v] of Object.entries(campos)) form.set(k, v);
    return { actions, calls, form };
  };
  const aprovar = montar({ verificacao: id, decisao: 'aprovar', motivo: 'documento legível' });
  assert.equal((await aprovar.actions.analisarVerificacao(null, aprovar.form)).ok, 'Aprovada.');
  assert.deepEqual(aprovar.calls, [{ nome: 'admin_analisar_verificacao', args: { p_id: id, p_aprovar: true, p_motivo: 'documento legível' } }]);
  const antigo = montar({ id, decisao: 'aprovar' });
  assert.match((await antigo.actions.analisarVerificacao(null, antigo.form)).erro, /não encontrada/);
  assert.deepEqual(antigo.calls, []);
});

test('decidirVerificacaoLoja: devolve o erro do banco traduzido, sem atualizar a tela', async () => {
  const { actions, calls, form } = contexto({ erro: { code: 'P0001', message: MUDOU } });
  form.set('decisao', 'recusar');
  form.set('motivo', 'outro');
  const r = await actions.decidirVerificacaoLoja(null, form);
  assert.equal(r.erro, MUDOU);
  assert.equal(r.ok, undefined);
  assert.equal(calls.some(c => c.nome === 'revalidatePath'), false);
  const sem = contexto({ erro: { code: 'XX000', message: 'relation "verificacoes_loja" does not exist' } });
  sem.form.set('decisao', 'recusar');
  sem.form.set('motivo', 'outro');
  const r2 = await sem.actions.decidirVerificacaoLoja(null, sem.form);
  assert.doesNotMatch(r2.erro, /relation|verificacoes_loja/);
});

test('resolverAvisoVerificacaoLoja: só a equipe, id válido, chama o banco e atualiza a tela', async () => {
  const bloqueado = contexto({ papel: 'moderador' });
  assert.match((await bloqueado.actions.resolverAvisoVerificacaoLoja(null, bloqueado.form)).erro, /papel/);
  assert.deepEqual(bloqueado.calls, []);
  const ruim = contexto();
  ruim.form.set('id', 'x');
  assert.ok((await ruim.actions.resolverAvisoVerificacaoLoja(null, ruim.form)).erro);
  assert.deepEqual(ruim.calls, []);
  const { actions, calls, form } = contexto();
  const r = await actions.resolverAvisoVerificacaoLoja(null, form);
  assert.ok(r.ok);
  assert.deepEqual(rpcs(calls), [{ nome: 'admin_resolver_aviso_verificacao', args: { p_id: id } }]);
  const falha = contexto({ erro: { code: 'P0001', message: 'Este aviso já foi marcado como visto. Atualize a página.' } });
  assert.match((await falha.actions.resolverAvisoVerificacaoLoja(null, falha.form)).erro, /já foi marcado/);
});

function rota({ userId = 'user_1', data = null, error = null } = {}) {
  const calls = [];
  const { GET } = carregar('src/app/api/verificacao-loja/[id]/[tipo]/route.ts', {
    '@clerk/nextjs/server': { auth: async () => ({ userId }) },
    '@/lib/supabase/server': { createClient: async () => ({
      rpc(nome, args) {
        calls.push({ nome, args });
        return { maybeSingle: async () => ({ data, error }) };
      },
    }) },
  });
  const chamar = (i = id, tipo = 'comprovante') => GET(new Request('http://x/api'), { params: Promise.resolve({ id: i, tipo }) });
  return { chamar, calls };
}

test('rota do arquivo: 401 sem login e 404 para id ou tipo fora do combinado, sem consultar o banco', async () => {
  const sem = rota({ userId: null });
  assert.equal((await sem.chamar()).status, 401);
  assert.deepEqual(sem.calls, []);
  const r = rota();
  assert.equal((await r.chamar('abc')).status, 404);
  assert.equal((await r.chamar(id, 'documento')).status, 404);
  assert.equal((await r.chamar(id, '../x')).status, 404);
  assert.deepEqual(r.calls, []);
});

test('rota do arquivo: 403 para quem não é da equipe, 404 sem linha, 503 para outro erro', async () => {
  const r403 = rota({ error: { code: '42501', message: 'Só a equipe autorizada pode consultar os arquivos.' } });
  assert.equal((await r403.chamar()).status, 403);
  assert.equal((await rota({ data: null }).chamar()).status, 404);
  assert.equal((await rota({ data: { arquivo_base64: '', mime: 'application/pdf' } }).chamar()).status, 404);
  assert.equal((await rota({ data: { arquivo_base64: 'AAAA', mime: 'text/html' } }).chamar()).status, 404);
  assert.equal((await rota({ error: { code: '08006', message: 'x' } }).chamar()).status, 503);
});

test('rota do arquivo: entrega o arquivo da equipe como anexo, sem cache e sem adivinhar tipo', async () => {
  const bytes = Buffer.from('%PDF-1.7 teste');
  for (const [tipo, mime, nome] of [['comprovante', 'application/pdf', 'comprovante.pdf'], ['fachada', 'image/png', 'fachada.png'], ['fachada', 'image/jpeg', 'fachada.jpg']]) {
    const { chamar, calls } = rota({ data: { arquivo_base64: bytes.toString('base64'), mime } });
    const res = await chamar(id, tipo);
    assert.equal(res.status, 200);
    assert.deepEqual(calls, [{ nome: 'admin_arquivo_verificacao_loja', args: { p_id: id, p_tipo: tipo } }]);
    assert.equal(res.headers.get('Cache-Control'), 'private, no-store');
    assert.equal(res.headers.get('X-Content-Type-Options'), 'nosniff');
    assert.equal(res.headers.get('Content-Type'), mime);
    assert.equal(res.headers.get('Content-Disposition'), `attachment; filename="${nome}"`);
    assert.deepEqual(Buffer.from(await res.arrayBuffer()), bytes);
  }
});
