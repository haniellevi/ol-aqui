const { test } = require('node:test');
const assert = require('node:assert/strict');
const { carregar } = require('./carregar.cjs');

// Fronteiras externas trocadas por mocks; as regras de decidir.ts rodam de verdade.
const estado = { receita: null, comprovante: null, fachada: null, chamadasIA: 0, chamadasFachada: 0, chamadas: [], lancarEm: null };
const mocks = {
  '@/lib/supabase/admin': { supabaseAdmin() { throw new Error('sem banco no teste unitário'); } },
  './receita': { consultarCnpj: async (cnpj) => { if (estado.lancarEm === cnpj) throw new Error('boom'); return estado.receita; } },
  './ia': {
    lerComprovante: async () => { estado.chamadasIA++; return estado.comprovante; },
    lerFachada: async () => { estado.chamadasFachada++; return estado.fachada; },
  },
};
const mod = carregar('src/lib/verificacao-loja/fila.ts', mocks);

const receitaOk = { estado: 'ok', dados: { situacao: 'ATIVA', razaoSocial: 'MARIA EXEMPLO DA SILVA LTDA', fantasia: 'Loja Exemplo', socios: ['MARIA EXEMPLO DA SILVA'], municipioIbge: 2203909, cidade: 'Corrente', uf: 'PI', logradouro: 'RUA DAS FLORES', abertura: '2020-01-01' } };
const leituraComp = { legivel: true, tipoDocumento: 'conta_servico', titular: 'MARIA EXEMPLO DA SILVA', logradouro: 'RUA DAS FLORES 100', cidade: 'CORRENTE', cep: '64980000', confianca: 0.95 };
const okComp = (l = leituraComp) => ({ ok: true, leitura: l, custoUsd: 0.002, tokensEntrada: 300, tokensSaida: 60 });
const okFach = { ok: true, leitura: { legivel: true, fachadaReal: true, nomeVisivel: 'LOJA EXEMPLO' }, custoUsd: 0.001, tokensEntrada: 200, tokensSaida: 30 };
const pedido = (n, extra = {}) => ({
  id: `ped-${n}`, reserva: `res-${n}`, cnpj: `1122233300018${n}`, comprovante: 'Q09NUFJPVkFOVEU=', tipo_comprovante: 'application/pdf',
  fachada: 'RkFDSEFEQQ==', tipo_fachada: 'image/png', loja_nome: 'Loja Exemplo', cidade: 'Corrente', endereco: 'Rua das Flores, 100', cnpj_em_outra_loja: false, ...extra,
});
function banco(pedidos, { cidade = true } = {}) {
  const chamadas = [];
  return {
    chamadas,
    rpc: async (nome, args) => {
      chamadas.push({ nome, args });
      if (nome === 'verificacao_loja_reservar') return { data: pedidos, error: null };
      if (nome === 'verificacao_loja_cidade_na_regiao') return { data: cidade, error: null };
      if (nome === 'verificacao_loja_concluir') return { data: 'ok', error: null };
      return { data: null, error: { message: 'rpc desconhecida' } };
    },
  };
}
const concluidas = (db) => db.chamadas.filter((c) => c.nome === 'verificacao_loja_concluir').map((c) => c.args);
function zerar() { Object.assign(estado, { receita: receitaOk, comprovante: okComp(), fachada: okFach, chamadasIA: 0, chamadasFachada: 0, lancarEm: null }); }

test('caminho feliz conclui uma vez com aprovar e custo somado', async () => {
  zerar();
  const db = banco([pedido(1)]);
  const r = await mod.processarFilaVerificacao(db);
  assert.equal(r.processados, 1);
  const c = concluidas(db);
  assert.equal(c.length, 1);
  assert.equal(c[0].p_decisao, 'aprovar');
  assert.equal(c[0].p_id, 'ped-1');
  assert.equal(c[0].p_reserva, 'res-1');
  assert.deepEqual(c[0].p_motivos_equipe, []);
  assert.ok(Math.abs(c[0].p_custo_usd - 0.003) < 1e-9);
  assert.equal(c[0].p_tokens_entrada, 500);
  assert.equal(c[0].p_tokens_saida, 90);
  assert.ok(db.chamadas.some((x) => x.nome === 'verificacao_loja_cidade_na_regiao' && x.args.p_id === 'ped-1' && x.args.p_ibge === 2203909));
});

test('Receita fora do ar: IA não é chamada e concluir recebe equipe com receita_fora_do_ar', async () => {
  zerar();
  estado.receita = { estado: 'fora_do_ar' };
  const db = banco([pedido(1)]);
  await mod.processarFilaVerificacao(db);
  assert.equal(estado.chamadasIA, 0);
  assert.equal(estado.chamadasFachada, 0);
  const c = concluidas(db);
  assert.equal(c.length, 1);
  assert.equal(c[0].p_decisao, 'equipe');
  assert.deepEqual(c[0].p_motivos_equipe, ['receita_fora_do_ar']);
  assert.equal(c[0].p_custo_usd, 0);
});

test('CNPJ não encontrado: não chama a IA e pede novo envio', async () => {
  zerar();
  estado.receita = { estado: 'nao_encontrada' };
  const db = banco([pedido(1)]);
  await mod.processarFilaVerificacao(db);
  assert.equal(estado.chamadasIA, 0);
  assert.equal(concluidas(db)[0].p_decisao, 'pedir_novo');
  assert.equal(concluidas(db)[0].p_motivo, 'cnpj_nao_encontrado');
});

test('falha da IA no comprovante vai para a equipe com ia_falhou', async () => {
  zerar();
  estado.comprovante = { ok: false, falha: 'ia_desligada', custoUsd: 0 };
  const db = banco([pedido(1)]);
  await mod.processarFilaVerificacao(db);
  const c = concluidas(db)[0];
  assert.equal(c.p_decisao, 'equipe');
  assert.deepEqual(c.p_motivos_equipe, ['ia_falhou']);
});

test('falha só na fachada segue sem ela', async () => {
  zerar();
  estado.fachada = { ok: false, falha: 'fachada_pdf', custoUsd: 0 };
  const db = banco([pedido(1, { fachada: 'JVBERi0=', tipo_fachada: 'application/pdf' })]);
  await mod.processarFilaVerificacao(db);
  const c = concluidas(db)[0];
  assert.equal(c.p_decisao, 'aprovar');
  assert.ok(c.p_parecer.some((i) => i.item === 'fachada' && i.ok === null));
});

test('sem fachada enviada: não chama a leitura de fachada', async () => {
  zerar();
  const db = banco([pedido(1, { fachada: null, tipo_fachada: null })]);
  await mod.processarFilaVerificacao(db);
  assert.equal(estado.chamadasFachada, 0);
  assert.equal(concluidas(db)[0].p_decisao, 'aprovar');
});

test('pdf sem texto ou ilegível pede arquivo novo', async () => {
  for (const falha of ['pdf_sem_texto', 'pdf_ilegivel']) {
    zerar();
    estado.comprovante = { ok: false, falha, custoUsd: 0 };
    const db = banco([pedido(1)]);
    await mod.processarFilaVerificacao(db);
    const c = concluidas(db)[0];
    assert.equal(c.p_decisao, 'pedir_novo', falha);
    assert.equal(c.p_motivo, 'arquivo_ilegivel', falha);
  }
});

test('exceção em um pedido conclui só esse como ia_falhou e o outro segue', async () => {
  zerar();
  const a = pedido(1), b = pedido(2);
  estado.lancarEm = a.cnpj;
  const db = banco([a, b]);
  const r = await mod.processarFilaVerificacao(db);
  assert.equal(r.processados, 2);
  const c = concluidas(db);
  assert.equal(c.length, 2);
  const da = c.find((x) => x.p_id === 'ped-1'), dbb = c.find((x) => x.p_id === 'ped-2');
  assert.equal(da.p_decisao, 'equipe');
  assert.deepEqual(da.p_motivos_equipe, ['ia_falhou']);
  assert.equal(da.p_custo_usd, null);
  assert.equal(dbb.p_decisao, 'aprovar');
});

test('argumentos de concluir não levam titular, endereço, razão social nem base64', async () => {
  zerar();
  const db = banco([pedido(1)]);
  await mod.processarFilaVerificacao(db);
  const texto = JSON.stringify(concluidas(db));
  for (const proibido of ['MARIA', 'EXEMPLO', 'FLORES', 'Rua das', 'Q09NUFJPVkFOVEU', 'RkFDSEFEQQ', '64980000']) {
    assert.ok(!texto.includes(proibido), proibido);
  }
});

test('nunca lança: erro ao reservar devolve zero e erro ao concluir é engolido', async () => {
  zerar();
  const ruim = { rpc: async () => ({ data: null, error: { message: 'x' } }) };
  assert.deepEqual(await mod.processarFilaVerificacao(ruim), { processados: 0 });
  const lanca = { rpc: async () => { throw new Error('rede'); } };
  assert.deepEqual(await mod.processarFilaVerificacao(lanca), { processados: 0 });
  const semConcluir = { rpc: async (n) => (n === 'verificacao_loja_reservar' ? { data: [pedido(1)], error: null } : n === 'verificacao_loja_cidade_na_regiao' ? { data: true, error: null } : { data: null, error: { message: 'falhou' } }) };
  assert.deepEqual(await mod.processarFilaVerificacao(semConcluir), { processados: 1 });
});

test('rota: 401 sem segredo e 200 com segredo', async () => {
  let segredoOk = false, rodou = 0;
  const rota = carregar('src/app/api/interno/verificacao-loja/route.ts', {
    'next/server': { NextResponse: { json: (corpo, init) => ({ corpo, status: init?.status ?? 200 }) } },
    '@/lib/moderacao-ia': { segredoModeracaoConfere: () => segredoOk },
    '@/lib/verificacao-loja/fila': { processarFilaVerificacao: async () => { rodou++; return { processados: 2 }; } },
  });
  assert.equal(rota.maxDuration, 120);
  assert.equal(rota.dynamic, 'force-dynamic');
  const sem = await rota.POST({ headers: { get: () => null } });
  assert.equal(sem.status, 401);
  assert.equal(rodou, 0);
  segredoOk = true;
  const com = await rota.POST({ headers: { get: () => 'Bearer x' } });
  assert.equal(com.status, 200);
  assert.deepEqual(com.corpo, { ok: true, processados: 2 });
});
