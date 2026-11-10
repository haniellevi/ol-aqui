const test = require('node:test');
const assert = require('node:assert/strict');
const { carregar } = require('./carregar.cjs');
const usuario = 'user_piloto';

function exportacao(op = {}) {
  const consultas = [];
  const tabelas = {
    vitrines_lojas: [{ id: 'loja', dono_id: usuario }],
    favoritos: Array.from({ length: 5 }, (_, i) => ({ anuncio_id: `a${i}`, usuario_id: usuario })),
    robo_conversas: [{ id: 'conversa', usuario_id: usuario }],
    robo_mensagens: Array.from({ length: 5 }, (_, i) => ({ id: i, usuario_id: usuario, conversa_id: 'conversa', papel: 'usuario', conteudo: { texto: `mensagem ${i}` } })),
    radar_propostas: [
      { id: 'recebida', vitrine_id: 'outra-loja', status: 'ativa', radar_pedidos: { comprador_id: usuario } },
      { id: 'de-terceiro', vitrine_id: 'outra-loja', status: 'ativa', radar_pedidos: { comprador_id: 'outro' } },
      { id: 'oculta', vitrine_id: 'outra-loja', status: 'oculta', radar_pedidos: { comprador_id: usuario } },
      { id: 'enviada', vitrine_id: 'loja', status: 'ativa', radar_pedidos: { comprador_id: 'outro' } },
    ],
    ...op.tabelas,
  };
  const db = {
    rpc: async () => ({ data: op.perfilVazio ? [] : [{ id: op.perfilId ?? usuario }], error: op.perfilErro ? { message: 'interno' } : null }),
    from(tabela) {
      const c = { tabela, filtros: [], ordem: [], inicio: 0, fim: 499 };
      const q = {
        select(colunas) { c.colunas = colunas; return q; },
        eq(coluna, valor) { c.filtros.push([coluna, valor]); return q; },
        order(coluna) { c.ordem.push(coluna); return q; },
        range(inicio, fim) { c.inicio = inicio; c.fim = fim; return q; },
        returns() { return q; },
        async maybeSingle() { const r = await q; return { ...r, data: r.data?.[0] ?? null }; },
        then(resolve, reject) {
          consultas.push(c);
          if (op.rede === tabela) return Promise.reject(Error('segredo interno')).then(resolve, reject);
          if (op.erro === tabela && (!op.erroDepois || c.inicio > 0)) return Promise.resolve({ data: null, error: { message: 'segredo interno' } }).then(resolve, reject);
          const rows = (tabelas[tabela] ?? []).filter(row => c.filtros.every(([coluna, valor]) => coluna.split('.').reduce((o, k) => o?.[k], row) === valor));
          rows.sort((a, b) => c.ordem.reduce((v, coluna) => v || String(a[coluna]).localeCompare(String(b[coluna])), 0));
          // Simula API com limite menor que a página solicitada.
          return Promise.resolve({ data: rows.slice(c.inicio, Math.min(c.fim + 1, c.inicio + 2)), error: null }).then(resolve, reject);
        },
      };
      return q;
    },
  };
  const a = carregar('src/app/(conta)/minha-conta/privacidade/baixar/route.ts', {
    '@clerk/nextjs/server': { auth: async () => ({ userId: op.semLogin ? null : usuario }) },
    '@/lib/supabase/server': { createClient: async () => db },
    '@/lib/formato': { SITE: 'olaki.test' },
  });
  return { get: a.GET, consultas };
}

test('exportação: sem sessão não consulta dados e nunca permite cache', async () => {
  const a = exportacao({ semLogin: true }); const r = await a.get();
  assert.equal(r.status, 401); assert.equal(r.headers.get('cache-control'), 'private, no-store');
  assert.deepEqual(a.consultas, []);
});
test('exportação: pagina coleções e mensagens sem truncar pelo limite menor do servidor', async () => {
  const a = exportacao(); const r = await a.get(); const dados = await r.json();
  assert.equal(r.status, 200); assert.equal(dados.favoritos.length, 5);
  assert.equal(dados.conversas_com_o_aki[0].robo_mensagens.length, 5);
  assert.deepEqual(a.consultas.filter(c => c.tabela === 'robo_mensagens').map(c => c.inicio), [0, 2, 4, 5]);
  assert.match(r.headers.get('content-disposition'), /attachment/);
});
test('exportação: propostas recebidas são apenas ativas de pedidos próprios e sem campo de IP', async () => {
  const a = exportacao(); const dados = await (await a.get()).json();
  assert.deepEqual(dados.propostas_radar_recebidas.map(p => p.id), ['recebida']);
  assert.equal('radar_pedidos' in dados.propostas_radar_recebidas[0], false);
  assert.deepEqual(dados.propostas_radar_enviadas.map(p => p.id), ['enviada']);
  assert.ok(a.consultas.filter(c => c.tabela === 'radar_propostas').every(c => !c.colunas.includes('*') && !c.colunas.includes('criado_ip')));
});
test('exportação: qualquer coleção com erro, inclusive página posterior, falha sem arquivo parcial', async () => {
  for (const op of [{ perfilErro: true }, { perfilVazio: true }, { perfilId: "outro" }, { erro: 'vitrines_lojas' }, { erro: 'favoritos', erroDepois: true }, { erro: 'pagamentos' }, { erro: 'radar_propostas' }, { erro: 'robo_mensagens' }, { rede: 'aceites' }]) {
    const r = await exportacao(op).get();
    assert.equal(r.status, 500, JSON.stringify(op));
    assert.equal(r.headers.get('content-disposition'), null);
    assert.equal(r.headers.get('cache-control'), 'private, no-store');
    assert.doesNotMatch(await r.text(), /segredo interno/);
  }
});
test('exportação: conta sem vitrine continua exportando dados do comprador', async () => {
  const a = exportacao({ tabelas: { vitrines_lojas: [] } }); const dados = await (await a.get()).json();
  assert.equal(dados.vitrine, null); assert.deepEqual(dados.pagamentos, []);
  assert.deepEqual(dados.propostas_radar_recebidas.map(p => p.id), ['recebida']);
});

const erroFinanceiro = { code: '23503', message: 'update or delete violates foreign key constraint "pagamentos_vitrine_id_fkey" on table "pagamentos"' };
function webhook(op = {}) {
  const chamadas = []; let exclusoes = 0;
  const db = {
    storage: { from(bucket) { return {
      async list(pasta, pag) { chamadas.push({ tabela: bucket, acao: 'storage-list', pasta, ...pag }); return { data: [], error: op.storageErro ? { message: 'storage falhou' } : null }; },
      async remove() { return { error: null }; },
    }; } },
    from(tabela) {
      const c = { tabela, filtros: [] };
      const q = {
        delete() { c.acao = 'delete'; return q; },
        upsert(valores, opcoes) { c.acao = 'upsert'; c.valores = valores; c.opcoes = opcoes; return q; },
        update(valores) { c.acao = 'update'; c.valores = valores; return q; },
        select(colunas) { c.acao = 'select'; c.colunas = colunas; return q; },
        eq(...f) { c.filtros.push(['eq', ...f]); return q; },
        in(...f) { c.filtros.push(['in', ...f]); return q; },
        neq(...f) { c.filtros.push(['neq', ...f]); return q; },
        limit(n) { c.limite = n; return q; },
        or(filtro) { c.ou = filtro; return q; },
        then(resolve, reject) {
          chamadas.push(c);
          let error = null;
          if (tabela === 'perfis' && c.acao === 'delete') { exclusoes++; error = op.excluirErro ?? null; }
          if (op.falhaRetencao === tabela && c.acao === 'select') error = { message: 'consulta falhou' };
          if (op.falha === tabela && c.acao !== 'select') error = { message: 'falha parcial' };
          return Promise.resolve({ data: tabela === 'vitrines_lojas' && c.acao === 'select' ? [{ id: '12345678-1234-1234-1234-123456789012' }] : op.congelado === tabela && c.acao === 'select' ? [{ id: 'congelado' }] : [], error }).then(resolve, reject);
        },
      }; return q;
    },
  };
  const a = carregar('src/app/api/webhooks/clerk/route.ts', {
    '@clerk/nextjs/server': { clerkClient: async () => ({ users: { async getUser() { if (op.clerkAtivo) return { id: usuario }; throw { status: op.clerkStatus ?? 404 }; } } }) },
    '@clerk/nextjs/webhooks': { verifyWebhook: async () => { if (op.assinaturaRuim) throw Error('inválida'); return { type: op.evento ?? 'user.deleted', data: { id: usuario } }; } },
    '@/lib/perfil': { sincronizarPerfil: async () => chamadas.push({ acao: 'sync' }) },
    '@/lib/supabase/admin': { supabaseAdmin: () => db },
  });
  return { post: () => a.POST({}), chamadas, get exclusoes() { return exclusoes; } };
}

test('exclusão: assinatura inválida, conta ativa ou Clerk indisponível não apagam dados', async (t) => {
  t.mock.method(console, 'error', () => {});
  for (const [op, status] of [[{ assinaturaRuim: true }, 400], [{ clerkAtivo: true }, 200], [{ clerkStatus: 503 }, 500]]) {
    const a = webhook(op); assert.equal((await a.post()).status, status); assert.deepEqual(a.chamadas, []);
  }
});
test('exclusão: sucesso direto não entra em anonimização e aceita repetição do evento', async () => {
  const a = webhook(); assert.equal((await a.post()).status, 200); assert.equal((await a.post()).status, 200);
  assert.equal(a.exclusoes, 2); assert.equal(a.chamadas.some(c => c.acao === 'update'), false);
});
test('exclusão: somente a FK financeira conhecida permite retenção, outros erros exigem retry', async (t) => {
  t.mock.method(console, 'error', () => {});
  for (const excluirErro of [{ code: '42501', message: 'sem permissão' }, { code: '08006', message: 'rede' }, { code: '23503', message: 'outra FK' }]) {
    const a = webhook({ excluirErro }); assert.equal((await a.post()).status, 500);
    assert.equal(a.chamadas.some(c => c.acao === 'update' || (c.acao === 'delete' && c.tabela !== 'perfis')), false);
  }
});
test('exclusão: retenção financeira remove conteúdo operacional e identidade pública sem apagar pagamentos ou logs', async () => {
  const a = webhook({ excluirErro: erroFinanceiro }); assert.equal((await a.post()).status, 200);
  for (const tabela of ['anuncios', 'radar_propostas', 'radar_pedidos', 'robo_conversas', 'robo_avaliacoes', 'favoritos', 'notificacoes', 'preferencias_avisos', 'perfis_verificacoes', 'whatsapp_desafios', 'equipe']) {
    assert.ok(a.chamadas.some(c => c.tabela === tabela && c.acao === 'delete'), tabela);
  }
  assert.equal(a.chamadas.some(c => ['pagamentos', 'logs_atividade'].includes(c.tabela)), false);
  const perfil = a.chamadas.find(c => c.tabela === 'perfis' && c.acao === 'update');
  assert.equal(perfil.valores.whatsapp, null); assert.equal(perfil.valores.criado_ip, null); assert.equal(perfil.valores.e_admin, false);
  const slug = a.chamadas.find(c => c.tabela === 'vitrines_lojas' && c.valores?.slug);
  assert.match(slug.valores.slug, /^encerrada-/);
  assert.equal((await a.post()).status, 200);
});
test('exclusão: falha parcial ou do Storage não confirma sucesso ao provedor', async (t) => {
  t.mock.method(console, 'error', () => {});
  for (const op of [{ storageErro: true }, { excluirErro: erroFinanceiro, falha: 'robo_conversas' }]) assert.equal((await webhook(op).post()).status, 500);
});

test('exclusão: conteúdo congelado ou verificação indisponível bloqueia antes do Storage, inclusive sem cobrança', async (t) => {
  t.mock.method(console, 'error', () => {});
  for (const tabela of ['anuncios', 'radar_pedidos', 'radar_propostas']) {
    for (const op of [{ congelado: tabela }, { falhaRetencao: tabela }]) {
      const a = webhook(op); assert.equal((await a.post()).status, 500);
      assert.equal(a.exclusoes, 0);
      assert.ok(a.chamadas.every(c => c.acao === 'select' || c.tabela === 'contas_revogadas'));
      assert.equal(a.chamadas[0].tabela, 'contas_revogadas');
    }
  }
});

test('exclusão: arquivos só são removidos após confirmação do banco, inclusive em retry', async (t) => {
  t.mock.method(console, 'error', () => {});
  for (const op of [{}, { excluirErro: erroFinanceiro }]) {
    const a = webhook(op); assert.equal((await a.post()).status, 200);
    const armazenamento = a.chamadas.findIndex(c => c.acao === 'storage-list');
    assert.ok(armazenamento > 0); assert.ok(a.chamadas.slice(armazenamento).every(c => c.acao === 'storage-list'));
  }
  for (const op of [{ excluirErro: { code: '55000', message: 'Congelado após consulta' } }, { excluirErro: erroFinanceiro, falha: 'radar_propostas' }]) {
    const a = webhook(op); assert.equal((await a.post()).status, 500);
    assert.equal(a.chamadas.some(c => c.acao === 'storage-list'), false);
  }
});

test('exclusão: revoga JWT antes da limpeza sem renovar data; falha no marcador impede remover arquivos ou dados', async (t) => {
  t.mock.method(console, 'error', () => {});
  const a = webhook(); assert.equal((await a.post()).status, 200);
  assert.deepEqual(a.chamadas[0], { tabela: 'contas_revogadas', filtros: [], acao: 'upsert', valores: { usuario_id: usuario }, opcoes: { onConflict: 'usuario_id', ignoreDuplicates: true } });
  const b = webhook({ falha: 'contas_revogadas' }); assert.equal((await b.post()).status, 500);
  assert.equal(b.chamadas.length, 1);
});
