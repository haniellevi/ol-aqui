const test = require('node:test');
const assert = require('node:assert/strict');
const { carregar } = require('./carregar.cjs');
const id = '81000000-0000-4000-a000-000000000001';
const destino = '/radar/pedido/20000000-0000-4000-a000-000000000001';
function ambiente({ login = true, aviso = { id, link: destino }, leituraErro = null, resultado = 1, rpcErro = null, rede = false } = {}) {
  const chamadas = [];
  const consulta = {
    select: (...args) => { chamadas.push(['select', ...args]); return consulta; },
    eq: (...args) => { chamadas.push(['eq', ...args]); return consulta; },
    maybeSingle: async () => ({ data: aviso, error: leituraErro }),
  };
  const a = carregar('src/app/(conta)/minha-conta/notificacoes/actions.ts', {
    '@clerk/nextjs/server': { auth: async () => ({ userId: login ? 'user_comprador' : null }) },
    'next/cache': { revalidatePath: p => chamadas.push(['cache', p]) },
    '@/lib/supabase/server': { createClient: async () => ({
      from: t => { chamadas.push(['from', t]); return consulta; },
      rpc: async (...args) => { chamadas.push(['rpc', ...args]); if (rede) throw new Error('Offline'); return { data: resultado, error: rpcErro }; },
    }) },
  });
  return { a, chamadas };
}
test('notificações exigem sessão e ID válido antes de acessar o banco', async () => {
  const { a, chamadas } = ambiente({ login: false });
  for (const r of [await a.abrirAviso(id), await a.marcarTodasLidas(), await a.salvarPreferenciaAviso('proposta_nova', true)]) assert.equal(r.ok, false);
  assert.equal(chamadas.length, 0);
  const b = ambiente(); assert.equal((await b.a.abrirAviso('x')).ok, false); assert.equal(b.chamadas.length, 0);
});
test('abrir aviso usa destino do banco e exige dono e canal app', async () => {
  const { a, chamadas } = ambiente();
  const r = await a.abrirAviso(id, 'https://externo.example');
  assert.equal(r.destino, destino);
  for (const par of [['usuario_id', 'user_comprador'], ['canal', 'app'], ['id', id]]) assert.ok(chamadas.some(([acao, ...args]) => acao === 'eq' && JSON.stringify(args) === JSON.stringify(par)));
  for (const p of ['/minha-conta/notificacoes', '/minha-conta']) assert.ok(chamadas.some(([acao, valor]) => acao === 'cache' && valor === p));
});
test('aviso ausente, alheio ou com destino inseguro não é marcado nem aberto', async () => {
  for (const aviso of [null, { id: 'outro', link: destino }, ...['//externo.example','https://externo.example','/\\externo.example','/\n/externo.example','/%2f%2fexterno.example', 42].map(link => ({ id, link }))]) {
    const { a, chamadas } = ambiente({ aviso }); assert.equal((await a.abrirAviso(id)).ok, false);
    assert.equal(chamadas.filter(c => c[0] === 'rpc').length, 0);
  }
});
test('abrir sem link confirma leitura e repetição idempotente é aceita', async () => {
  const r = await ambiente({ aviso: { id, link: null }, resultado: 0 }).a.abrirAviso(id);
  assert.equal(r.ok, true); assert.equal(r.destino, undefined);
});
test('falha ou retorno incerto nunca confirma leitura e não invalida a tela', async () => {
  for (const entrada of [{ resultado: null }, { resultado: -1 }, { resultado: '1' }, { rpcErro: { message: 'Falhou' } }]) {
    const { a, chamadas } = ambiente(entrada);
    assert.equal((await a.abrirAviso(id)).ok, false); assert.equal((await a.marcarTodasLidas()).ok, false);
    assert.equal(chamadas.filter(c => c[0] === 'cache').length, 0);
  }
  await assert.rejects(ambiente({ rede: true }).a.marcarTodasLidas(), /Offline/);
});
test('preferência desligada retorna sucesso e entradas malformadas são recusadas', async () => {
  assert.equal((await ambiente({ resultado: false }).a.salvarPreferenciaAviso('proposta_nova', false)).ok, true);
  assert.equal((await ambiente({ resultado: true }).a.salvarPreferenciaAviso('proposta_nova', false)).ok, false);
  for (const [tipo, ligar] of [['proposta_nova', 'sim'], ['?', true], [null, false]]) {
    const { a, chamadas } = ambiente(); assert.equal((await a.salvarPreferenciaAviso(tipo, ligar)).ok, false); assert.equal(chamadas.length, 0);
  }
});
function dados(resposta, config = { data: ['proposta_nova', 'proposta_escolhida'], error: null }) {
  const chamadas = [];
  const consulta = { then: resolve => Promise.resolve(resposta).then(resolve) };
  for (const k of ['select', 'eq', 'is', 'order', 'range']) consulta[k] = (...args) => { chamadas.push([k, ...args]); return consulta; };
  const d = carregar('src/lib/dados/radar.ts', {
    '@clerk/nextjs/server': { auth: async () => ({ userId: 'user_comprador' }) },
    '@/lib/dados/config': {},
    '@/lib/supabase/server': { createClient: async () => ({ from: () => consulta, rpc: async () => config }) },
  }); return { d, chamadas };
}
test('lista pagina sem perder avisos antigos e filtra não lidos no servidor', async () => {
  const { d, chamadas } = dados({ data: [], error: null, count: 65 });
  assert.deepEqual(await d.minhasNotificacoes(3, true), { avisos: [], total: 65 });
  for (const esperado of [['range',60,89],['eq','usuario_id','user_comprador'],['eq','canal','app'],['is','lida_em',null],['order','id',{ascending:false}]]) assert.ok(chamadas.some(c => JSON.stringify(c) === JSON.stringify(esperado)));
});
test('falhas na lista, contagem e preferências não viram caixa vazia ou opções ligadas', async () => {
  for (const resposta of [{ data:null, count:null }, { data:[], count:null }, { data:[], count:0, error:{message:'Falha'} }]) {
    await assert.rejects(dados(resposta).d.minhasNotificacoes());
    await assert.rejects(dados(resposta).d.avisosNaoLidos());
  }
  await assert.rejects(dados({data:null}).d.minhasPreferenciasAvisos());
  await assert.rejects(dados({data:[]},{data:null,error:{message:'Falha'}}).d.minhasPreferenciasAvisos());
  const preferencias = await dados({data:[{tipo:'proposta_nova',ligado:false}]}).d.minhasPreferenciasAvisos();
  assert.equal(preferencias[0].ligado,false); assert.equal(preferencias[1].ligado,true);
});
test('resumo exige login, não usa cache público e distingue falha de zero', async () => {
  function rota(login, count) { return carregar('src/app/api/notificacoes/resumo/route.ts', {
    '@clerk/nextjs/server': { auth: async () => ({userId:login?'user_teste':null}) },
    '@/lib/dados/radar': { avisosNaoLidos: async () => { if(count === null) throw new Error('Falha'); return count; } },
  }); }
  assert.equal((await rota(false,5).GET()).status,401);
  assert.equal((await rota(true,null).GET()).status,503);
  const r = await rota(true,0).GET(); assert.equal(r.status,200); assert.equal(r.headers.get('cache-control'),'private, no-store'); assert.deepEqual(await r.json(),{naoLidas:0});
});
