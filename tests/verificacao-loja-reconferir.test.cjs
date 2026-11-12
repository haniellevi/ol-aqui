const { test } = require('node:test');
const assert = require('node:assert/strict');
const { carregar } = require('./carregar.cjs');

const estado = { respostas: {}, lancarEm: null, consultadas: [] };
const mocks = {
  '@/lib/supabase/admin': { supabaseAdmin() { throw new Error('sem banco no teste unitário'); } },
  './receita': {
    consultarCnpj: async (cnpj) => {
      estado.consultadas.push(cnpj);
      if (estado.lancarEm === cnpj) throw new Error('boom');
      return estado.respostas[cnpj];
    },
  },
};
const mod = carregar('src/lib/verificacao-loja/reconferir.ts', mocks);

const ok = (situacao) => ({ estado: 'ok', dados: { situacao, razaoSocial: 'X', fantasia: null, socios: [], municipioIbge: 1, cidade: 'C', uf: 'PI', logradouro: null, abertura: null } });
const lojas = (n) => Array.from({ length: n }, (_, i) => ({ vitrine_id: `v${i + 1}`, cnpj: `c${i + 1}` }));
function banco(lista, { falharRegistroEm = null } = {}) {
  const chamadas = [];
  return {
    chamadas,
    rpc: async (nome, args) => {
      chamadas.push({ nome, args });
      if (nome === 'verificacao_loja_reconferir_reservar') return { data: lista, error: null };
      if (nome === 'verificacao_loja_reconferir_registrar') {
        if (args.p_vitrine === falharRegistroEm) return { data: null, error: { message: 'x' } };
        return { data: null, error: null };
      }
      return { data: null, error: { message: 'rpc desconhecida' } };
    },
  };
}
const registros = (db) => db.chamadas.filter((c) => c.nome === 'verificacao_loja_reconferir_registrar').map((c) => c.args);
function zerar() { estado.respostas = {}; estado.lancarEm = null; estado.consultadas = []; }

test('ativa, inativa e não encontrada chamam registrar com o resultado certo', async () => {
  zerar();
  estado.respostas = { c1: ok('ATIVA'), c2: ok('BAIXADA'), c3: { estado: 'nao_encontrada' } };
  const db = banco(lojas(3));
  const esperas = [];
  const r = await mod.reconferirLojas(db, { esperar: async (ms) => { esperas.push(ms); } });
  assert.deepEqual(r, { conferidas: 3, removidas: 2, parouPorReceita: false });
  assert.deepEqual(registros(db), [
    { p_vitrine: 'v1', p_cnpj: 'c1', p_resultado: 'ativa', p_situacao: 'ATIVA' },
    { p_vitrine: 'v2', p_cnpj: 'c2', p_resultado: 'inativa', p_situacao: 'BAIXADA' },
    { p_vitrine: 'v3', p_cnpj: 'c3', p_resultado: 'nao_encontrada', p_situacao: null },
  ]);
  assert.equal(db.chamadas[0].args.p_limite, 30);
  assert.deepEqual(esperas, [1000, 1000]);
});

test('fora do ar na 2ª loja interrompe a rodada e a 3ª nem é consultada', async () => {
  zerar();
  estado.respostas = { c1: ok('ATIVA'), c2: { estado: 'fora_do_ar' }, c3: ok('ATIVA') };
  const db = banco(lojas(3));
  const r = await mod.reconferirLojas(db, { esperar: async () => {} });
  assert.deepEqual(r, { conferidas: 1, removidas: 0, parouPorReceita: true });
  assert.deepEqual(estado.consultadas, ['c1', 'c2']);
  assert.equal(registros(db).length, 1);
});

test('erro em uma loja não impede a seguinte', async () => {
  zerar();
  estado.respostas = { c1: ok('ATIVA'), c2: ok('ATIVA'), c3: ok('SUSPENSA') };
  estado.lancarEm = 'c1';
  const db = banco(lojas(3), { falharRegistroEm: 'v2' });
  const r = await mod.reconferirLojas(db, { esperar: async () => {} });
  assert.deepEqual(estado.consultadas, ['c1', 'c2', 'c3']);
  assert.deepEqual(r, { conferidas: 1, removidas: 1, parouPorReceita: false });
  assert.equal(registros(db).length, 2);
});

test('resposta com situação vazia para a rodada e não chama registrar', async () => {
  zerar();
  estado.respostas = { c1: ok('  '), c2: ok('BAIXADA') };
  const db = banco(lojas(2));
  const r = await mod.reconferirLojas(db, { esperar: async () => {} });
  assert.deepEqual(r, { conferidas: 0, removidas: 0, parouPorReceita: true });
  assert.deepEqual(estado.consultadas, ['c1']);
  assert.equal(registros(db).length, 0);
});

test('falha ao reservar lança erro (a rota responde 503)', async () => {
  zerar();
  await assert.rejects(mod.reconferirLojas({ rpc: async () => ({ data: null, error: { message: 'x' } }) }));
  await assert.rejects(mod.reconferirLojas({ rpc: async () => { throw new Error('rede'); } }));
});

test('rota: 401 sem segredo, 503 se a reserva falhar e 200 com segredo', async () => {
  let segredoOk = false, rodou = 0, falhar = false;
  const rota = carregar('src/app/api/interno/verificacao-loja-reconferir/route.ts', {
    'next/server': { NextResponse: { json: (corpo, init) => ({ corpo, status: init?.status ?? 200 }) } },
    '@/lib/moderacao-ia': { segredoModeracaoConfere: () => segredoOk },
    '@/lib/verificacao-loja/reconferir': { reconferirLojas: async () => { rodou++; if (falhar) throw new Error('reservar_falhou'); return { conferidas: 2, removidas: 1, parouPorReceita: false }; } },
  });
  assert.equal(rota.maxDuration, 300);
  assert.equal(rota.dynamic, 'force-dynamic');
  assert.equal((await rota.POST({ headers: { get: () => null } })).status, 401);
  assert.equal(rodou, 0);
  segredoOk = true;
  falhar = true;
  assert.equal((await rota.POST({ headers: { get: () => 'Bearer x' } })).status, 503);
  falhar = false;
  const com = await rota.POST({ headers: { get: () => 'Bearer x' } });
  assert.equal(com.status, 200);
  assert.deepEqual(com.corpo, { ok: true, conferidas: 2, removidas: 1, parouPorReceita: false });
});
