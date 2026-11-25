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
test('gate do servidor bloqueia ausência, retirada e rota sensível antes de qualquer coletor', async () => {
  let valor, ref = 'https://teste.invalid/busca?q=sentinela';
  const gate = carregar('src/lib/metricas/gate-servidor.ts', {
    'next/headers': {
      cookies: async () => ({ get: () => valor ? { value: encodeURIComponent(JSON.stringify(valor)) } : undefined }),
      headers: async () => new Headers({ host:'teste.invalid', referer:ref }),
    },
  });
  assert.equal(await gate.permiteEstatistica(), false);
  valor = {v:1, estatistica:false, marketing:true}; assert.equal(await gate.permiteEstatistica(), false);
  valor = {v:1, estatistica:true, marketing:false}; assert.equal(await gate.permiteEstatistica(), true);
  ref = 'https://teste.invalid/minha-conta'; assert.equal(await gate.permiteEstatistica(), false);
  ref = 'https://outro.invalid/busca'; assert.equal(await gate.permiteEstatistica(), false);
  valor.estatistica=false; ref='https://teste.invalid/'; assert.equal(await gate.permiteEstatistica(), false);
});
test('endpoint nega sem consentimento e reconstrói payload sem dados extras', async () => {
  let permite=false; const chamadas=[];
  const api=carregar('src/app/api/visita/route.ts', {
    '@/lib/metricas/gate-servidor': { permiteEstatistica: async()=>permite },
    '@/lib/supabase/admin': { supabaseAdmin:()=>({rpc:async(n,args)=>{chamadas.push([n,args]);return {error:null}}}) },
  });
  const id='91000000-0000-4000-a000-000000000001';
  const req=()=>new Request('https://teste.invalid/api/visita',{method:'POST',headers:{'user-agent':'Mozilla/5.0'},body:JSON.stringify({visitante:id,sessao:id,ocorrencia:id,caminho:'/busca?q=email%40teste.invalid',origem:'sentinela',conta:{origem:'segredo'},referencia:'token',termo:'telefone'})});
  assert.equal((await api.POST(req())).status,403); assert.equal(chamadas.length,0);
  permite=true; assert.equal((await api.POST(req())).status,200);
  assert.deepEqual(chamadas[0],['registrar_visita_consentida',{p_visitante:id,p_sessao:id,p_ocorrencia:id,p_caminho:'/busca',p_origem:null,p_celular:false,p_primeira:false}]);
});

test('cliente nega sem preferência, separa marketing e limpa IDs na retirada', () => {
  global.document = { cookie: '' };
  global.window = { location: { pathname: '/' }, dispatchEvent() {} };
  global.location = { protocol: 'https:' };
  const removidas = [];
  global.localStorage = { removeItem(k) { removidas.push(k) }, setItem() {} };
  global.sessionStorage = { removeItem(k) { removidas.push(k) } };
  const cliente = carregar('src/lib/metricas/cliente.ts');
  assert.equal(cliente.podeMedir(), false);
  cliente.salvarPreferencia({v:1, estatistica:false, marketing:true});
  assert.equal(cliente.podeMedir(), false);
  cliente.salvarPreferencia({v:1, estatistica:true, marketing:false});
  assert.equal(cliente.podeMedir(), true);
  window.location.pathname = '/entrar'; assert.equal(cliente.podeMedir(), false);
  cliente.salvarPreferencia({v:1, estatistica:false, marketing:false});
  assert.ok(removidas.includes('mr_visitante'));
  assert.ok(removidas.includes('olaki.buscaAberta'));
  for (const k of ['window','document','location','localStorage','sessionStorage']) delete global[k];
});
