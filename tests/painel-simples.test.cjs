const { test } = require('node:test');
const assert = require('node:assert/strict');
const { carregar } = require('./carregar.cjs');
const { ENTRADAS_ADMIN, entradaAdminAtiva } = carregar('src/lib/admin/navegacao.ts');
const { podeVerLink } = carregar('src/lib/tipos-equipe.ts');
const { configGenericaEditavel, permiteExcecaoRegional } = carregar('src/lib/admin/config-visibilidade.ts');

test('as sete entradas preservam o acesso de cada papel', () => {
  assert.equal(ENTRADAS_ADMIN.length, 7);
  const links = papel => ENTRADAS_ADMIN.filter(e => podeVerLink(papel, e.href)).map(e => e.href);
  assert.deepEqual(links('moderador'), ['/admin/moderacao']);
  assert.deepEqual(links('financeiro'), ['/admin/pagamentos']);
  assert.deepEqual(links('suporte'), ['/admin/lojas']);
  assert.deepEqual(links('franqueado'), ['/admin/lojas']);
  assert.deepEqual(links(null), []);
});

test('páginas existentes e fichas continuam pertencendo à área correta', () => {
  for (const p of ['/admin/planos', '/admin/destaques', '/admin/robo', '/admin/textos', '/admin/regioes/123', '/admin/categorias/123', '/admin/equipe', '/admin/compliance', '/admin/mensagens']) assert.equal(entradaAdminAtiva(p), '/admin/configuracoes');
  assert.equal(entradaAdminAtiva('/admin/relatorios'), '/admin');
  assert.equal(entradaAdminAtiva('/admin/visitas'), '/admin');
  assert.equal(entradaAdminAtiva('/admin/funil/123'), '/admin/lojas');
  assert.equal(entradaAdminAtiva('/admin/lixeira'), '/admin/lojas');
  assert.equal(entradaAdminAtiva('/admin/usuarios/123'), '/admin/lojas');
  assert.equal(entradaAdminAtiva('/admin/lojas/123'), '/admin/lojas');
  assert.equal(entradaAdminAtiva('/admin/anuncios/conversas/123'), '/admin/anuncios');
});

test('exceções reais do Radar continuam editáveis sem reabrir o editor global obsoleto', () => {
  assert.equal(configGenericaEditavel('radar.aviso.pedido_novo.texto'), false);
  assert.equal(configGenericaEditavel('radar.aviso.pedido_novo.texto', true), true);
  assert.equal(permiteExcecaoRegional('radar.dias_pedido'), true);
  for (const chave of ['asaas.ambiente', 'hoje.max_tarefas', 'funil.etapa_ao_pagar', 'visitas.guardar_dias', 'robo.orcamento_mensal_centavos']) assert.equal(permiteExcecaoRegional(chave), false);
});

function acoes(atual) {
  const alteracoes = [];
  const db = { from(t) {
    assert.equal(t, 'configuracoes');
    const q = { select() { return q; }, eq() { return q; }, is() { return q; }, single: async () => ({ data: atual, error: null }),
      update(v) { alteracoes.push(v); return q; }, then(resolve) { resolve({ data: [], error: null }); } };
    return q;
  } };
  const api = carregar('src/app/admin/configuracoes/actions.ts', {
    '@/lib/admin/auth': { exigirAdmin: async () => ({ supabase: db, userId: 'admin' }) },
    'next/cache': { revalidatePath() {} },
  });
  return { ...api, alteracoes };
}

test('formulário antigo não consegue salvar controle removido nem criar exceção sem efeito', async () => {
  for (const chave of ['fotos.tamanho_max_bytes', 'moderacao.preco_min_centavos', 'radar.aviso.proposta_nova.titulo', 'robo.modelo_conversa']) {
    const a = acoes({ chave, valor: 1, microrregiao_id: null });
    const f = new FormData(); f.set('id', 'config'); f.set('valor', '2'); f.set('tipo', 'numero');
    assert.ok((await a.salvarConfig(null, f)).erro);
    assert.equal(a.alteracoes.length, 0);
  }
  const a = acoes(null), f = new FormData();
  f.set('chave', 'asaas.ambiente'); f.set('microrregiao_id', 'regiao'); f.set('valor', 'producao');
  assert.ok((await a.criarExcecao(null, f)).erro);
  assert.equal(a.alteracoes.length, 0);
});

test('o servidor mantém o tipo do banco, mesmo que o formulário envie outro tipo', async () => {
  const a = acoes({ chave: 'hoje.max_tarefas', valor: 10, microrregiao_id: null });
  const f = new FormData(); f.set('id', 'config'); f.set('valor', '12'); f.set('tipo', 'texto');
  assert.ok((await a.salvarConfig(null, f)).ok);
  assert.equal(a.alteracoes[0].valor, 12);
});
