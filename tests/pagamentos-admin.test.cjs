const { test } = require('node:test');
const assert = require('node:assert/strict');
const { carregar } = require('./carregar.cjs');
const filtros = { ambiente: 'producao', loja: null, status: null, tipo: null, regiao: null, de: null, ate: null };
const linha = (dono) => ({ id: dono, vitrine_id: `v-${dono}`, vitrines_lojas: { dono_id: dono, nome: dono, slug: dono }, anuncios: null });

function ambiente({ linhas = [], comerciais = {}, papel = 'financeiro', erroPapel = null, erroLista = null, erroContato = null } = {}) {
  const consultas = [];
  let privilegiadas = 0;
  const q = { select(colunas) { assert.doesNotMatch(colunas, /perfis\s*\(|whatsapp/); return q; }, order() { return q; }, range() { return q; }, eq() { return q; }, not() { return q; }, limit() { return q; }, then(resolve) { resolve({ data: linhas, error: erroLista }); } };
  const db = { from(t) { assert.equal(t, 'pagamentos'); return q; }, async rpc(nome) { assert.equal(nome, 'meu_papel'); return { data: papel, error: erroPapel }; } };
  const admin = { from(t) { assert.ok(['perfis', 'vitrines_lojas'].includes(t)); return { select(c) { assert.equal(c, 'id, whatsapp'); return { async in(campo, ids) { assert.equal(campo, 'id'); consultas.push({ t, ids }); return { data: ids.map(id => ({ id, whatsapp: t === 'perfis' ? `fone-${id}` : comerciais[id] })), error: erroContato }; } }; } }; } };
  const mod = carregar('src/lib/admin/pagamentos.ts', { '@/lib/supabase/admin': { supabaseAdmin() { privilegiadas++; return admin; } } });
  return { ...mod, db, consultas, privilegiadas: () => privilegiadas, run: () => mod.listarPagamentos(db, filtros, 200) };
}

test('pagamentos: consulta vazia dispensa contato e WhatsApp comercial tem prioridade', async () => {
  const vazio = ambiente(); assert.deepEqual(await vazio.run(), []); assert.equal(vazio.privilegiadas(), 0);
  const a = ambiente({ linhas: [linha('loja')], comerciais: { 'v-loja': 'fone-loja' } });
  const [p] = await a.run(); assert.equal(p.vitrine_whatsapp, 'fone-loja');
  assert.deepEqual(a.consultas, [{ t: 'vitrines_lojas', ids: ['v-loja'] }]);
});

test('pagamentos: contato privado limitado aos donos retornados pela RLS e papéis autorizados', async () => {
  for (const papel of ['administrador', 'financeiro']) {
    const a = ambiente({ papel, linhas: [linha('permitido'), linha('permitido'), linha('loja')], comerciais: { 'v-loja': 'fone-loja' } });
    const rows = await a.run(); assert.deepEqual(a.consultas, [
      { t: 'vitrines_lojas', ids: ['v-permitido', 'v-loja'] }, { t: 'perfis', ids: ['permitido'] },
    ]);
    assert.equal(rows[0].vitrine_whatsapp, 'fone-permitido'); assert.equal(rows[2].vitrine_whatsapp, 'fone-loja');
    assert.equal('dono_id' in rows[0], false); assert.equal('vitrines_lojas' in rows[0], false);
  }
});

test('pagamentos: papéis sem permissão e falha na verificação nunca leem contatos privados', async () => {
  for (const papel of [null, 'moderador', 'suporte', 'franqueado', 'desconhecido']) {
    const a = ambiente({ papel, linhas: [linha('restrito')] });
    assert.equal((await a.run())[0].vitrine_whatsapp, null); assert.equal(a.privilegiadas(), 0);
  }
  const a = ambiente({ linhas: [linha('restrito')], erroPapel: { message: 'offline' } });
  assert.equal((await a.run())[0].vitrine_whatsapp, null); assert.equal(a.privilegiadas(), 0);
});

test('pagamentos: falhas preservam lista sem revelar contato, mas erro financeiro não vira lista vazia', async () => {
  const a = ambiente({ linhas: [linha('pf')], erroContato: { message: 'offline' } });
  assert.equal((await a.run())[0].vitrine_whatsapp, null);
  const b = ambiente({ erroLista: { message: 'offline' } });
  await assert.rejects(b.run(), /Não deu para ler/);
  await assert.rejects(b.devolucoesAFazer(b.db, filtros), /Não deu para ler as devoluções/);
  assert.equal(b.privilegiadas(), 0);
});

test('pagamentos: lotes de contatos são limitados e devoluções usam o mesmo escopo', async () => {
  const a = ambiente({ linhas: Array.from({ length: 205 }, (_, i) => linha(`p${i}`)) });
  assert.equal((await a.devolucoesAFazer(a.db, filtros)).length, 205);
  for (const tabela of ['vitrines_lojas', 'perfis']) {
    assert.deepEqual(a.consultas.filter(c => c.t === tabela).map(c => c.ids.length), [100, 100, 5]);
  }
});

test('pagamentos: exportação CSV dispensa consultas de contatos privados', async () => {
  const a = ambiente({ linhas: [linha('pf')] });
  const { linhas, cortado } = await a.listarTodosPagamentos(a.db, filtros, 10000);
  assert.equal(linhas.length, 1); assert.equal(cortado, false);
  assert.equal(a.privilegiadas(), 0); assert.deepEqual(a.consultas, []);
});
