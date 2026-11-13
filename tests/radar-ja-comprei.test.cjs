const { test } = require('node:test');
const assert = require('node:assert/strict');
const { carregar } = require('./carregar.cjs');

// IA do Radar: "já comprei" na conversa. Filtro de palavras, máscara, JEV e gancho no envio. Sem rede: fetch falso.
const { temPalavraDeCompra, mascararParaIA } = carregar('src/components/conversas/palavras-compra.ts');
const MSG = '81000000-0000-4000-d000-000000000001';
const PED = '81000000-0000-4000-a000-000000000001';
const CONV = '81000000-0000-4000-d000-000000000009';

test('filtro: só mensagem com palavra de compra vai para a IA', () => {
  for (const t of ['Já comprei, obrigado', 'Comprei!', 'consegui em outro lugar', 'ACHEI', 'já resolvi', 'Não preciso mais', 'ja tenho', 'peguei ontem',
    'já encontrei em outra loja, valeu', 'achamos aqui perto', 'não preciso, obrigado'])
    assert.equal(temPalavraDeCompra(t), true, t);
  for (const t of ['tem azul?', 'você comprou?', 'quanto custa', 'compra garantida', 'acho que sim', '', null, 42])
    assert.equal(temPalavraDeCompra(t), false, String(t));
});

test('máscara: link, e-mail e telefone não vão para a IA; corta em 300', () => {
  const r = mascararParaIA('comprei, me liga (89) 99999-0000 ou www.loja.test ou https://x.test/a e fulano@x.test');
  assert.doesNotMatch(r, /\d{4}|www|https|@/);
  assert.match(r, /^comprei, me liga \[removido\]/);
  assert.equal(mascararParaIA('comprei ' + 'a'.repeat(400)).length, 300);
  assert.equal(mascararParaIA('comprei 2 bicicletas'), 'comprei 2 bicicletas');
});

// ---------- verificarJaComprei ----------
const PED2 = '81000000-0000-4000-a000-000000000002';
const UM_PEDIDO = { mensagem_id: MSG, usuario_id: 'user_cli', texto: 'comprei, me liga 89 99999-0000', pedidos: [{ id: PED, titulo: 'bicicleta aro 29 tel 89 98888-7777' }] };
function bancoFalso({ candidato = UM_PEDIDO, reserva = 7 } = {}) {
  const chamadas = [];
  const db = { rpc: async (nome, args) => {
    chamadas.push({ nome, args });
    if (nome === 'ja_comprei_candidato') return { data: candidato, error: null };
    if (nome === 'radar_ia_reservar') return { data: reserva, error: null };
    if (nome === 'ja_comprei_registrar') return { data: args.p_resolveu === true, error: null };
    return { data: null, error: null };
  } };
  return { db, chamadas };
}
async function comFetch(resposta, fn) {
  const antes = global.fetch; const chave = process.env.TYPESAFE_API_KEY;
  const pedidos = [];
  global.fetch = async (url, op) => { pedidos.push({ url, corpo: op.body }); if (resposta instanceof Error) throw resposta; return resposta; };
  process.env.TYPESAFE_API_KEY = 'teste';
  try { return await fn(pedidos); } finally {
    global.fetch = antes;
    if (chave === undefined) delete process.env.TYPESAFE_API_KEY; else process.env.TYPESAFE_API_KEY = chave;
  }
}
const jev = (p) => new Response(JSON.stringify({ answers: { resposta: { probabilities: p } } }), { status: 200 });
const modulo = (banco) => carregar('src/lib/radar-ia/ja-comprei.ts', { '@/lib/supabase/admin': { supabaseAdmin: () => banco.db } });
const registrar = (banco) => banco.chamadas.find((c) => c.nome === 'ja_comprei_registrar');

test('sem candidato (chave desligada, loja, pedido fechado): JEV não é chamado', async () => {
  await comFetch(jev({ [PED]: 0.9, ainda_procura: 0.1 }), async (pedidos) => {
    const banco = bancoFalso({ candidato: null });
    assert.equal(await modulo(banco).verificarJaComprei(MSG), false);
    assert.equal(pedidos.length, 0);
    assert.equal(banco.chamadas.some((c) => c.nome === 'radar_ia_reservar'), false);
  });
});

test('sem reserva (teto do mês, 20 usos do dia): JEV não é chamado', async () => {
  await comFetch(jev({ [PED]: 0.9, ainda_procura: 0.1 }), async (pedidos) => {
    const banco = bancoFalso({ reserva: null });
    assert.equal(await modulo(banco).verificarJaComprei(MSG), false);
    assert.equal(pedidos.length, 0);
    assert.equal(registrar(banco), undefined);
  });
});

test('JEV diz que já resolveu: grava a pergunta; o telefone não vai para a IA', async () => {
  await comFetch(jev({ [PED]: 0.9, ainda_procura: 0.1 }), async (pedidos) => {
    const banco = bancoFalso();
    assert.equal(await modulo(banco).verificarJaComprei(MSG), true);
    assert.equal(pedidos.length, 1);
    assert.doesNotMatch(pedidos[0].corpo, /99999|98888|7777/);
    const corpo = JSON.parse(pedidos[0].corpo);
    assert.equal(corpo.model, 'jev-latest');
    assert.deepEqual(Object.keys(corpo.state), ['mensagem']);
    assert.deepEqual(Object.keys(corpo.questions.resposta.criteria).sort(), [PED, 'ainda_procura'].sort());
    assert.match(corpo.questions.resposta.criteria[PED], /bicicleta aro 29 tel \[removido\]/);
    assert.deepEqual(banco.chamadas.find((c) => c.nome === 'radar_ia_reservar').args, { p_usuario: 'user_cli', p_parte: 'ja_comprei' });
    assert.deepEqual(registrar(banco).args, { p_mensagem: MSG, p_pedido: PED, p_resolveu: true });
    assert.equal(banco.chamadas.find((c) => c.nome === 'radar_ia_concluir').args.p_erro, null);
  });
});

test('dois pedidos abertos: pergunta sobre o que o JEV escolheu', async () => {
  const dois = { ...UM_PEDIDO, texto: 'já comprei o capacete', pedidos: [{ id: PED, titulo: 'bicicleta' }, { id: PED2, titulo: 'capacete' }] };
  await comFetch(jev({ [PED]: 0.05, [PED2]: 0.9, ainda_procura: 0.05 }), async () => {
    const banco = bancoFalso({ candidato: dois });
    assert.equal(await modulo(banco).verificarJaComprei(MSG), true);
    assert.deepEqual(registrar(banco).args, { p_mensagem: MSG, p_pedido: PED2, p_resolveu: true });
  });
});

test('JEV em dúvida: marca lida sem perguntar', async () => {
  await comFetch(jev({ [PED]: 0.5, ainda_procura: 0.5 }), async () => {
    const banco = bancoFalso();
    assert.equal(await modulo(banco).verificarJaComprei(MSG), false);
    assert.deepEqual(registrar(banco).args, { p_mensagem: MSG, p_pedido: PED, p_resolveu: false });
  });
});

test('JEV fora do ar: não grava nada (a próxima mensagem pode tentar)', async () => {
  await comFetch(new Error('rede'), async () => {
    const banco = bancoFalso();
    assert.equal(await modulo(banco).verificarJaComprei(MSG), false);
    assert.equal(registrar(banco), undefined);
    assert.ok(banco.chamadas.find((c) => c.nome === 'radar_ia_concluir').args.p_erro);
  });
});

test('id inválido: nem consulta o banco', async () => {
  const banco = bancoFalso();
  assert.equal(await modulo(banco).verificarJaComprei('x'), false);
  assert.equal(banco.chamadas.length, 0);
});

// ---------- ações ----------
function acoes({ login = true } = {}) {
  const chamadas = []; const agendados = [];
  const a = carregar('src/app/(conta)/conversas/actions.ts', {
    '@clerk/nextjs/server': { auth: async () => ({ userId: login ? 'user_cli' : null }) },
    'next/cache': { revalidatePath: (p) => chamadas.push(['cache', p]) },
    'next/server': { after: (fn) => agendados.push(fn) },
    '@/lib/radar-ia/ja-comprei': { verificarJaComprei: async (id) => { chamadas.push(['verificar', id]); return true; } },
    '@/lib/supabase/server': { createClient: async () => ({ rpc: async (...args) => { chamadas.push(args); return { data: MSG, error: null }; } }) },
  });
  return { a, chamadas, agendados };
}

test('enviar com palavra de compra agenda a IA depois da resposta; sem palavra, não', async () => {
  const { a, chamadas, agendados } = acoes();
  assert.equal((await a.enviarMensagem(CONV, 'tem azul?')).ok, true);
  assert.equal(agendados.length, 0);
  assert.equal((await a.enviarMensagem(CONV, 'Já comprei, obrigado!')).ok, true);
  assert.equal(agendados.length, 1);
  assert.equal(chamadas.some((c) => c[0] === 'verificar'), false);
  await agendados[0]();
  assert.deepEqual(chamadas.at(-1), ['verificar', MSG]);
});

test('recusar: sem login ou ids inválidos não chama o banco; certo chama recusar_ja_comprei', async () => {
  const fora = acoes({ login: false });
  assert.equal((await fora.a.jaCompreiRecusar(CONV, PED)).ok, false);
  const { a, chamadas } = acoes();
  assert.equal((await a.jaCompreiRecusar('x', PED)).ok, false);
  assert.equal((await a.jaCompreiRecusar(CONV, 'x')).ok, false);
  assert.equal(fora.chamadas.length + chamadas.length, 0);
  assert.deepEqual(await a.jaCompreiRecusar(CONV, PED), { ok: true, dados: null });
  assert.deepEqual(chamadas[0], ['recusar_ja_comprei', { p_pedido: PED }]);
  assert.deepEqual(chamadas[1], ['cache', `/conversas/${CONV}`]);
});
