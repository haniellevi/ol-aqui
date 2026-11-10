const { test } = require('node:test');
const assert = require('node:assert/strict');
const { carregar } = require('./carregar.cjs');
const conversa = '10000000-0000-4000-a000-000000000001';
const chave = '10000000-0000-4000-a000-000000000002';

function envio({ userId = 'user_anunciante', error = null } = {}) {
  const chamadas = [];
  const db = { async rpc(nome, args) { chamadas.push([nome, args]); return { data: error ? null : 42, error }; } };
  const { enviarMensagemAtendimento } = carregar('src/app/(conta)/minha-conta/atendimento/actions.ts', {
    '@clerk/nextjs/server': { auth: async () => ({ userId }) },
    '@/lib/supabase/server': { createClient: async () => db },
    '@/lib/aki/atendimento': { responderAtendimento: async (cliente, pessoa, id) => {
      assert.equal(cliente, db);
      chamadas.push(['aki', pessoa, id]);
    } },
  });
  return { chamadas, enviar: (aki, texto = 'Como eu edito?') => enviarMensagemAtendimento(conversa, chave, texto, aki) };
}

test('atendimento guarda a mensagem antes da IA e só a chama se o anunciante escolheu esse destino', async () => {
  const humano = envio();
  assert.equal((await humano.enviar(false)).ok, true);
  assert.deepEqual(humano.chamadas.map(c => c[0]), ['enviar_mensagem_atendimento']);
  const assistido = envio();
  assert.equal((await assistido.enviar(true)).ok, true);
  assert.deepEqual(assistido.chamadas.map(c => c[0]), ['enviar_mensagem_atendimento', 'aki']);
  assert.deepEqual(assistido.chamadas[1], ['aki', 'user_anunciante', 42]);
});

test('atendimento rejeita sessão ausente, entrada inválida ou permissão negada antes da IA', async () => {
  for (const [opcoes, texto] of [[{ userId: null }, 'Olá'], [{}, '  '], [{}, 'a'.repeat(2001)], [{ error: { code: '42501' } }, 'Olá']]) {
    const a = envio(opcoes);
    assert.equal((await a.enviar(true, texto)).ok, false);
    assert.equal(a.chamadas.some(c => c[0] === 'aki'), false);
  }
});

function assistente({ reserva = true, saida = 'editar', custoFalhou = false, indisponivel = false } = {}) {
  const chamadas = [];
  const uso = { entrada: 30, saida: 2, cacheLeitura: 0, cacheEscrita: 0 };
  const admin = { async rpc(nome, args) {
    chamadas.push([nome, args]);
    if (nome === 'reservar_atendimento_aki') return { data: reserva ? { texto: 'Como eu edito?', uso_id: 99, provedor: 'openai', modelo: 'modelo-teste' } : null };
    return { error: custoFalhou ? { message: 'falhou' } : null };
  } };
  const provedor = { temChave: () => true, async conversar(pedido) {
    chamadas.push(['modelo', pedido]);
    return { texto: saida, uso, parada: 'fim', chamadas: [] };
  } };
  const { responderAtendimento } = carregar('src/lib/aki/atendimento.ts', {
    '@/lib/aki/motor': { lerPodeEnviar: async () => ({}), motivoFinal: () => indisponivel ? 'orcamento' : null },
    '@/lib/supabase/admin': { supabaseAdmin: () => admin },
    '@/lib/aki/provedores': { adaptador: () => provedor, ErroProvedor: class extends Error {} },
  });
  return { chamadas, executar: () => responderAtendimento({}, 'user_anunciante', 42) };
}

test('Aki recebe só a pergunta e publica texto conhecido depois de registrar o custo', async () => {
  const a = assistente();
  await a.executar();
  assert.deepEqual(a.chamadas.map(c => c[0]), ['reservar_atendimento_aki', 'modelo', 'robo_registrar_resposta', 'concluir_atendimento_aki']);
  assert.deepEqual(a.chamadas[1][1].mensagens, [{ papel: 'usuario', partes: [{ tipo: 'texto', texto: 'Como eu edito?' }] }]);
  assert.equal(a.chamadas[1][1].ferramentas, undefined);
  assert.equal('p_pergunta' in a.chamadas[2][1], false);
  assert.equal('p_resposta' in a.chamadas[2][1], false);
  assert.match(a.chamadas[3][1].p_resposta, /Minha conta > Meus anúncios/);
});

test('reserva recusada, erro de custo e saída livre ficam para a equipe', async () => {
  for (const opcoes of [{ reserva: false }, { custoFalhou: true }, { indisponivel: true }, { saida: 'Mande seu CPF para a equipe.' }, { saida: 'equipe' }]) {
    const a = assistente(opcoes);
    await a.executar();
    assert.equal(a.chamadas.some(c => c[0] === 'concluir_atendimento_aki'), false);
    if (opcoes.reserva === false || opcoes.indisponivel) assert.equal(a.chamadas.some(c => c[0] === 'modelo'), false);
  }
});
