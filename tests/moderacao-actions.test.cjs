const test = require('node:test');
const assert = require('node:assert/strict');
const { carregar } = require('./carregar.cjs');

const id = '7a0593da-15d2-47e6-bbe0-30c5fe4e1f16';
function contexto({ erro = null, autorizado = true } = {}) {
  const calls = [];
  const update = { eq: () => update, then: (resolve) => resolve({ error: null }) };
  const actions = carregar('src/app/admin/moderacao/actions.ts', {
    'next/cache': { revalidatePath() {} },
    'next/navigation': { redirect: (url) => { throw new Error(decodeURIComponent(url)); } },
    '@/lib/admin/equipe': { exigirTela: async () => {
      if (!autorizado) throw new Error('Sem permissão');
      return { userId: 'moderador', supabase: {
        rpc: async (nome, args) => { calls.push({ nome, args }); return { error: erro }; },
        from: () => ({ update: (args) => { calls.push({ nome: 'denuncias.update', args }); return update; } }),
      } };
    } },
    '@/lib/supabase/admin': { supabaseAdmin: () => { throw new Error('Não deve usar service role'); } },
  });
  const form = new FormData();
  form.set('id', id);
  form.set('tipo', 'pedido');
  form.set('motivo', '  Teste concluído, sem oferta comercial.  ');
  return { actions, calls, form };
}

for (const nome of ['decidirAnuncio', 'decidirPedido', 'resolverDenuncia', 'moderarRadar']) {
  test(`${nome}: decisão ausente ou desconhecida não altera dados`, async () => {
    for (const decisao of ['', undefined, null, 'qualquer', ['aprovar']]) {
      const { actions, calls, form } = contexto();
      await assert.rejects(actions[nome](decisao, form), /válid/);
      assert.deepEqual(calls, []);
    }
  });
  test(`${nome}: exige acesso de moderação antes de alterar dados`, async () => {
    const { actions, calls, form } = contexto({ autorizado: false });
    await assert.rejects(actions[nome]('aprovar', form), /Sem permissão/);
    assert.deepEqual(calls, []);
  });
}

for (const [nome, decisao, rpc, chave, valor, aviso] of [
  ['decidirAnuncio', 'aprovar', 'moderar_anuncio', 'p_decisao', 'aprovar', 'Anúncio aprovado'],
  ['decidirAnuncio', 'recusar', 'moderar_anuncio', 'p_decisao', 'recusar', 'Anúncio recusado'],
  ['decidirAnuncio', 'congelar', 'congelar_anuncio', 'p_anuncio_id', id, 'Anúncio congelado'],
  ['decidirPedido', 'aprovar', 'moderar_pedido', 'p_decisao', 'aprovar', 'Pedido aprovado'],
  ['decidirPedido', 'recusar', 'moderar_pedido', 'p_decisao', 'recusar', 'Pedido recusado'],
  ['resolverDenuncia', 'sim', 'resolver_denuncia', 'p_procedente', true, 'marcada como procedente'],
  ['resolverDenuncia', 'nao', 'resolver_denuncia', 'p_procedente', false, 'marcada como não procedente'],
  ['moderarRadar', 'ocultar', 'moderar_radar', 'p_acao', 'ocultar', 'Tirado do ar'],
  ['moderarRadar', 'devolver', 'moderar_radar', 'p_acao', 'devolver', 'Devolvido ao ar'],
  ['moderarRadar', 'remover', 'moderar_radar', 'p_acao', 'remover', 'Removido'],
]) {
  test(`${nome}: ${decisao} funciona sem o campo do botão e ignora campos conflitantes`, async () => {
    const { actions, calls, form } = contexto();
    form.set('decisao', 'valor conflitante');
    form.set('acao', 'valor conflitante');
    form.set('procedente', 'valor conflitante');
    form.set('confirmar_remover', 'sim');
    await assert.rejects(actions[nome](decisao, form), new RegExp(aviso));
    assert.equal(calls[0].nome, rpc);
    assert.equal(calls[0].args[chave], valor);
    if ('p_motivo' in calls[0].args) assert.equal(calls[0].args.p_motivo, 'Teste concluído, sem oferta comercial.');
  });
}

test('Radar: exige tipo, UUID, motivo e confirmação da remoção', async () => {
  for (const [campo, valor, acao, erro] of [
    ['tipo', '', 'ocultar', /Tipo de conteúdo inválido/],
    ['tipo', 'anuncio', 'ocultar', /Tipo de conteúdo inválido/],
    ['id', 'invalido', 'ocultar', /Conteúdo não encontrado/],
    ['motivo', ' ', 'ocultar', /Escreva o motivo/],
    ['motivo', 'ab', 'remover', /Escreva o motivo/],
    ['confirmar_remover', '', 'remover', /marque "Sim, remover de vez"/],
  ]) {
    const { actions, calls, form } = contexto();
    form.set(campo, valor);
    await assert.rejects(actions.moderarRadar(acao, form), erro);
    assert.deepEqual(calls, []);
  }
});

test('Decisão recusada pelo banco não é apresentada como sucesso', async () => {
  const { actions, calls, form } = contexto({ erro: { code: '23514', message: 'Este anúncio não está mais em análise.' } });
  await assert.rejects(actions.decidirAnuncio('recusar', form), /falha=Este anúncio não está mais em análise/);
  assert.equal(calls.length, 1);
});

test('Botão envia a ação vinculada e bloqueia todas as decisões enquanto salva', () => {
  const action = async () => {};
  const outra = async () => {};
  for (const acaoPendente of [action, outra]) {
    const { BotaoDecisao } = carregar('src/app/admin/moderacao/botao-decisao.tsx', {
      'react-dom': { useFormStatus: () => ({ pending: true, action: acaoPendente }) },
    });
    const el = BotaoDecisao({ action, className: '', children: 'Recusar' });
    assert.equal(el.props.formAction, action);
    assert.equal(el.props.disabled, true);
    assert.equal(el.props.children[1], acaoPendente === action ? 'Salvando...' : 'Recusar');
  }
});
