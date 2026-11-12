const { test } = require('node:test');
const assert = require('node:assert/strict');
const { carregar } = require('./carregar.cjs');

const origem = 'https://olaki.test';
const pdf = (texto) => new Blob([texto], { type: 'application/pdf' });

function pedido(dados, origin = origem) {
  return new Request(`${origem}/api/verificacao-loja`, { method: 'POST', headers: { origin }, body: dados });
}

function montar({ userId = 'user_dono', retorno = 'enviada', erro = null } = {}) {
  const chamadas = [];
  const modulo = carregar('src/app/api/verificacao-loja/route.ts', {
    '@clerk/nextjs/server': { auth: async () => ({ userId }) },
    '@/lib/supabase/admin': { supabaseAdmin: () => ({
      rpc: async (...args) => {
        chamadas.push(args);
        const proximo = typeof retorno === 'function' ? retorno(chamadas.length) : retorno;
        return { data: erro ? null : proximo, error: erro };
      },
    }) },
  });
  return { ...modulo, chamadas };
}

function formulario({ cnpj = '12.345.678/0001-95', comprovante = true, fachada = false } = {}) {
  const form = new FormData();
  if (cnpj !== null) form.set('cnpj', cnpj);
  if (comprovante) form.set('comprovante', pdf('%PDF-1.7 Comprovante fictício'), 'conta.pdf');
  if (fachada) form.set('fachada', pdf('%PDF-1.7 Fachada fictícia'), 'fachada.pdf');
  return form;
}

test('sem login devolve 401 e não chama o banco', async () => {
  const { POST, chamadas } = montar({ userId: null });
  assert.equal((await POST(pedido(formulario()))).status, 401);
  assert.deepEqual(chamadas, []);
});

test('origem diferente devolve 403 e não chama o banco', async () => {
  const { POST, chamadas } = montar();
  assert.equal((await POST(pedido(formulario(), 'https://fora.test'))).status, 403);
  assert.deepEqual(chamadas, []);
});

test('sem comprovante devolve 400', async () => {
  const { POST, chamadas } = montar();
  assert.equal((await POST(pedido(formulario({ comprovante: false })))).status, 400);
  assert.deepEqual(chamadas, []);
});

test('CPF (11 dígitos) devolve 400 com a mensagem de CPF', async () => {
  const { POST, chamadas } = montar();
  const res = await POST(pedido(formulario({ cnpj: '123.456.789-09' })));
  assert.equal(res.status, 400);
  assert.equal((await res.json()).mensagem, 'Esse número é de CPF. O selo de loja pede CNPJ.');
  assert.deepEqual(chamadas, []);
});

test('CNPJ com dígito verificador errado devolve 400', async () => {
  const { POST, chamadas } = montar();
  const res = await POST(pedido(formulario({ cnpj: '12.345.678/0001-96' })));
  assert.equal(res.status, 400);
  assert.equal((await res.json()).mensagem, 'Confira o número do CNPJ.');
  assert.deepEqual(chamadas, []);
});

test('CNPJ formatado chega ao banco só com dígitos; fachada é opcional e vai nula', async () => {
  const { POST, chamadas } = montar();
  const res = await POST(pedido(formulario()));
  assert.equal(res.status, 200);
  const [nome, dados] = chamadas[0];
  assert.equal(nome, 'enviar_verificacao_loja');
  assert.equal(dados.p_cnpj, '12345678000195');
  assert.equal(dados.p_fachada, null);
  assert.equal(Buffer.from(dados.p_comprovante, 'base64').toString(), '%PDF-1.7 Comprovante fictício');
  assert.deepEqual(Object.keys(dados).sort(), ['p_cnpj', 'p_comprovante', 'p_fachada', 'p_usuario']);
});

test('fachada enviada vai em base64', async () => {
  const { POST, chamadas } = montar();
  assert.equal((await POST(pedido(formulario({ fachada: true })))).status, 200);
  assert.equal(Buffer.from(chamadas[0][1].p_fachada, 'base64').toString(), '%PDF-1.7 Fachada fictícia');
});

test('corpo grande demais devolve 413', async () => {
  const { POST, chamadas } = montar();
  const form = formulario();
  form.set('fachada', new Blob([new Uint8Array(5 * 1024 * 1024)], { type: 'application/pdf' }), 'grande.pdf');
  // Corpo já serializado: no Node 24 o FormData vira um stream que segue escrevendo depois que a rota cancela a leitura.
  const pronto = new Response(form);
  const corpo = new Uint8Array(await pronto.arrayBuffer());
  const req = new Request(`${origem}/api/verificacao-loja`, {
    method: 'POST',
    headers: { origin: origem, 'content-type': pronto.headers.get('content-type') },
    body: corpo,
  });
  assert.equal((await POST(req)).status, 413);
  assert.deepEqual(chamadas, []);
});

test('cada código do banco vira status e mensagem', async () => {
  const casos = [
    ['enviada', 200, 'Documentos enviados para conferência.'],
    ['pendente', 409, 'Sua loja já tem um envio em análise. Atualize esta página.'],
    ['verificada', 409, 'Sua loja já foi verificada.'],
    ['conta', 403, 'O envio é para contas de loja.'],
    ['whatsapp', 403, 'Confirme seu WhatsApp antes de enviar.'],
    ['limite', 429, 'Você atingiu o limite de envios em 24 horas. Tente novamente mais tarde.'],
    ['cnpj', 400, 'Esse CNPJ não pode ser usado. Confira o número ou fale com a equipe pela Ajuda.'],
    ['invalido', 400, 'Envie arquivos em PDF, JPG ou PNG, cada um com até 2 MB.'],
    ['qualquer_outro', 503, 'Não foi possível confirmar o envio. Consulte a situação na sua loja.'],
  ];
  for (const [codigo, status, mensagem] of casos) {
    const { POST } = montar({ retorno: codigo });
    const res = await POST(pedido(formulario()));
    assert.equal(res.status, status, codigo);
    assert.equal((await res.json()).mensagem, mensagem, codigo);
  }
});

test('erro do banco devolve 503', async () => {
  const { POST } = montar({ erro: { message: 'falhou' } });
  assert.equal((await POST(pedido(formulario()))).status, 503);
});

test('p_usuario vem da sessão mesmo que o formulário traga outro', async () => {
  const { POST, chamadas } = montar();
  const form = formulario();
  form.set('p_usuario', 'user_terceiro');
  form.set('usuario', 'user_terceiro');
  await POST(pedido(form));
  assert.equal(chamadas[0][1].p_usuario, 'user_dono');
});

test('duas chamadas seguidas: a segunda recebe pendente e devolve 409', async () => {
  const { POST } = montar({ retorno: (n) => (n === 1 ? 'enviada' : 'pendente') });
  assert.equal((await POST(pedido(formulario()))).status, 200);
  assert.equal((await POST(pedido(formulario()))).status, 409);
});

test('textoMotivoVerificacaoLoja cobre todos os motivos do banco', () => {
  const { MOTIVOS_VERIFICACAO_LOJA, textoMotivoVerificacaoLoja } = carregar('src/lib/verificacao-loja/constantes.ts');
  const todos = ['dados_inconsistentes', 'link_invalido', 'contato_nao_confirmado', 'titularidade', 'outro',
    'arquivo_ilegivel', 'comprovante_invalido', 'cnpj_inativo', 'cnpj_nao_encontrado', 'dados_mudaram'];
  for (const m of todos) assert.ok(MOTIVOS_VERIFICACAO_LOJA[m]?.length > 10, m);
  assert.equal(textoMotivoVerificacaoLoja('cnpj_inativo'), 'O CNPJ não está ativo na Receita. Procure seu contador para regularizar.');
  assert.equal(textoMotivoVerificacaoLoja('algo_novo'), MOTIVOS_VERIFICACAO_LOJA.outro);
  assert.equal(textoMotivoVerificacaoLoja(''), null);
  assert.equal(textoMotivoVerificacaoLoja(null), null);
  assert.equal(textoMotivoVerificacaoLoja(undefined), null);
});
