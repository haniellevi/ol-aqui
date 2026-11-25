const { test } = require('node:test');
const assert = require('node:assert/strict');
const { carregar } = require('./carregar.cjs');
const c = carregar('src/lib/metricas/consentimento.ts');
const contrato = carregar('src/lib/metricas/contrato.ts');
test('ausente, inválido e versão antiga negam; finalidades independentes', () => {
  for (const valor of [null, '', 'null', '{}', '{', '{"v":0,"estatistica":true}']) assert.equal(c.lerPreferencia(valor).estatistica, false);
  assert.deepEqual(c.lerPreferencia('{"v":1,"estatistica":true,"marketing":false}'), { v:1, estatistica:true, marketing:false });
  assert.equal(c.lerPreferencia('{"v":1,"estatistica":"true","marketing":true}').estatistica, false);
});
test('rotas neutras descartam parâmetros; desconhecidas e sensíveis bloqueadas', () => {
  assert.equal(contrato.rotaNeutra('/busca?q=pessoa%40teste.invalid#token'), '/busca');
  assert.equal(contrato.rotaNeutra('/anuncio/pessoa-123'), '/anuncio/:item');
  assert.equal(contrato.rotaNeutra('/loja/nome-privado'), '/loja/:loja');
  for (const rota of ['/minha-conta', '/admin', '/entrar', '/convite/token', '/api/x', '//site/busca', '/desconhecido']) assert.equal(contrato.rotaNeutra(rota), null);
});
test('UTM usa catálogo fechado e mantém prioridade do gerador legado', () => {
  assert.deepEqual(contrato.origemPermitida('?origem=radio&utm_source=instagram&campanha=telefone-89999999999'), { origem:'radio', campanha:null });
  assert.equal(contrato.origemPermitida('?utm_source=pessoa%40teste.invalid&utm_term=segredo').origem, null);
});
test('navegação consecutiva deduplica re-render, mas preserva revisita A B A', () => {
  const contar = contrato.contadorNavegacao();
  assert.equal(contar('/'), true); assert.equal(contar('/'), false);
  assert.equal(contar('/busca'), true); assert.equal(contar('/'), true);
});
test('contrato rejeita texto livre e propriedades extras, aceita faixa mínima', () => {
  assert.equal(contrato.eventoPermitido({ nome:'search_completed', rota:'/busca', faixa:'zero', termo:'sentinela' }), null);
  assert.deepEqual(contrato.eventoPermitido({ nome:'search_completed', rota:'/busca', faixa:'zero' }), { nome:'search_completed', rota:'/busca', faixa:'zero', fonte:'interno', coorte:'consentida_v1' });
});
