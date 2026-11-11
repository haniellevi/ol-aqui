const { test } = require('node:test');
const assert = require('node:assert/strict');
const { carregar } = require('./carregar.cjs');
const conversa = '10000000-0000-4000-a000-000000000001';
const chave = '10000000-0000-4000-a000-000000000002';

function envio({ userId = 'user_anunciante', error = null, resposta = 'respondido', falhaAki = false } = {}) {
  const chamadas = [];
  const db = { async rpc(nome, args) { chamadas.push([nome, args]); return { data: error ? null : 42, error }; } };
  const { enviarMensagemAtendimento } = carregar('src/app/(conta)/minha-conta/atendimento/actions.ts', {
    '@clerk/nextjs/server': { auth: async () => ({ userId }) },
    '@/lib/supabase/server': { createClient: async () => db },
    '@/lib/aki/atendimento': { responderAtendimento: async (cliente, pessoa, id) => {
      assert.equal(cliente, db);
      chamadas.push(['aki', pessoa, id]);
      if (falhaAki) throw new Error('Falha inesperada');
      return resposta;
    } },
  });
  return { chamadas, enviar: (aki, texto = 'Como eu edito?') => enviarMensagemAtendimento(conversa, chave, texto, aki) };
}

test('atendimento guarda a mensagem antes da IA e só a chama se o anunciante escolheu esse destino', async () => {
  const humano = envio();
  assert.deepEqual(await humano.enviar(false), { ok: true, dados: { destino: 'equipe', mensagem: 'Mensagem enviada.' } });
  assert.deepEqual(humano.chamadas.map(c => c[0]), ['enviar_mensagem_atendimento']);
  const assistido = envio();
  assert.deepEqual(await assistido.enviar(true), { ok: true, dados: { destino: 'aki', mensagem: 'O Merc respondeu na conversa.' } });
  assert.deepEqual(assistido.chamadas.map(c => c[0]), ['enviar_mensagem_atendimento', 'aki']);
  assert.deepEqual(assistido.chamadas[1], ['aki', 'user_anunciante', 42]);
});

test('envio confirmado informa encaminhamento ou indisponibilidade sem sugerir reenvio', async () => {
  const equipe = await envio({ resposta: 'equipe' }).enviar(true);
  assert.deepEqual(equipe, { ok: true, dados: { destino: 'equipe', mensagem: 'Sua mensagem foi encaminhada à equipe.' } });
  for (const opcoes of [{ resposta: 'indisponivel' }, { falhaAki: true }]) {
    const resultado = await envio(opcoes).enviar(true);
    assert.equal(resultado.ok, true);
    assert.equal(resultado.dados.destino, 'equipe');
    assert.match(resultado.dados.mensagem, /não conseguiu responder agora.*ficou para a equipe/);
  }
});

test('atendimento rejeita sessão ausente, entrada inválida ou permissão negada antes da IA', async () => {
  for (const [opcoes, texto] of [[{ userId: null }, 'Olá'], [{}, '  '], [{}, 'a'.repeat(2001)], [{ error: { code: '42501' } }, 'Olá']]) {
    const a = envio(opcoes);
    assert.equal((await a.enviar(true, texto)).ok, false);
    assert.equal(a.chamadas.some(c => c[0] === 'aki'), false);
  }
});

function assistente({ reserva = true, saida = 'editar', custoFalhou = false, indisponivel = false, conclusao = true, erroConclusao = false, falhaProvedor = false, medeUso = true, temChave = true } = {}) {
  const chamadas = [];
  const uso = { entrada: 30, saida: 2, cacheLeitura: 0, cacheEscrita: 0 };
  const admin = { async rpc(nome, args) {
    chamadas.push([nome, args]);
    if (nome === 'reservar_atendimento_aki') return { data: reserva ? { texto: 'Como eu edito?', uso_id: 99, provedor: 'openai', modelo: 'modelo-teste' } : null };
    if (nome === 'concluir_atendimento_aki') return { data: conclusao, error: erroConclusao ? { message: 'falhou' } : null };
    return { error: custoFalhou ? { message: 'falhou' } : null };
  } };
  const provedor = { temChave: () => temChave, async conversar(pedido) {
    chamadas.push(['modelo', pedido]);
    if (falhaProvedor) throw new Error('Tempo esgotado');
    return { texto: saida, uso: medeUso ? uso : undefined, parada: 'fim', chamadas: [] };
  } };
  const { responderAtendimento } = carregar('src/lib/aki/atendimento.ts', {
    '@/lib/aki/motor': { lerPodeEnviar: async () => ({}), motivoFinal: () => indisponivel ? 'orcamento' : null },
    '@/lib/supabase/admin': { supabaseAdmin: () => admin },
    '@/lib/aki/provedores': { adaptador: () => provedor, ErroProvedor: class extends Error {} },
  });
  return { chamadas, executar: () => responderAtendimento({}, 'user_anunciante', 42) };
}

test('Merc recebe só a pergunta e publica texto conhecido depois de registrar o custo', async () => {
  const a = assistente();
  assert.equal(await a.executar(), 'respondido');
  assert.deepEqual(a.chamadas.map(c => c[0]), ['reservar_atendimento_aki', 'modelo', 'robo_registrar_resposta', 'concluir_atendimento_aki']);
  assert.deepEqual(a.chamadas[1][1].mensagens, [{ papel: 'usuario', partes: [{ tipo: 'texto', texto: 'Como eu edito?' }] }]);
  assert.equal(a.chamadas[1][1].ferramentas, undefined);
  assert.equal('p_pergunta' in a.chamadas[2][1], false);
  assert.equal('p_resposta' in a.chamadas[2][1], false);
  assert.match(a.chamadas[3][1].p_resposta, /Minha conta > Meus anúncios/);
});

test('reserva recusada e saída livre informam o encaminhamento à equipe', async () => {
  for (const opcoes of [{ reserva: false }, { saida: 'Mande seu CPF para a equipe.' }, { saida: 'equipe' }]) {
    const a = assistente(opcoes);
    assert.equal(await a.executar(), 'equipe');
    assert.equal(a.chamadas.some(c => c[0] === 'concluir_atendimento_aki'), false);
    if (opcoes.reserva === false) assert.equal(a.chamadas.some(c => c[0] === 'modelo'), false);
  }
});

test('falhas de IA ou registro retornam indisponibilidade em vez de silêncio', async () => {
  for (const opcoes of [{ custoFalhou: true }, { indisponivel: true }, { falhaProvedor: true }, { medeUso: false }, { temChave: false }]) {
    const a = assistente(opcoes);
    assert.equal(await a.executar(), 'indisponivel');
    assert.equal(a.chamadas.some(c => c[0] === 'concluir_atendimento_aki'), false);
    if (opcoes.indisponivel || opcoes.temChave === false) assert.equal(a.chamadas.some(c => c[0] === 'modelo'), false);
  }
});

test('só anuncia resposta do Merc depois que o banco confirma a publicação', async () => {
  assert.equal(await assistente({ conclusao: false }).executar(), 'equipe');
  assert.equal(await assistente({ erroConclusao: true }).executar(), 'indisponivel');
});

test('agradecimentos e cumprimentos recebem uma resposta aprovada', async () => {
  for (const [saida, esperado] of [['agradecimento', /Por nada!/], ['saudacao', /Olá! Como posso ajudar/]]) {
    const a = assistente({ saida });
    assert.equal(await a.executar(), 'respondido');
    assert.match(a.chamadas.find(c => c[0] === 'concluir_atendimento_aki')[1].p_resposta, esperado);
  }
});
