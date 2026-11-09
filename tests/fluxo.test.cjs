const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
// Executa o TypeScript real com as fronteiras externas substituídas, sem credenciais ou rede.
function carregar(arquivo, mocks = {}) {
  const filename = path.resolve(arquivo);
  const js = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const mod = { exports: {} };
  const requireLocal = (nome) => {
    if (Object.hasOwn(mocks, nome)) return mocks[nome];
    if (nome === 'server-only') return {};
    if (nome === 'react') return { cache: (f) => f };
    if (nome.startsWith('@/')) return carregar(`src/${nome.slice(2)}.ts`, mocks);
    return require(nome);
  };
  new Function('require', 'module', 'exports', js)(requireLocal, mod, mod.exports);
  return mod.exports;
}
const { centavosDoTexto } = carregar('src/lib/formato.ts');
for (const [texto, esperado] of [['1.500,50',150050],['1500.50',150050],['1.500',150000],['49,90',4990],['0',0],['R$ 12,90',1290],['',null],['abc',null],['1e5',null],['-1',null],['0x10',null],['12,345',null]]) {
  test(`preço ${JSON.stringify(texto)}`, () => assert.equal(centavosDoTexto(texto), esperado));
}
test('busca mantém texto, cidade, categoria e orçamento no pedido', () => {
  const { linkPedirRadar } = carregar('src/lib/rotas.ts');
  const url = new URL(linkPedirRadar('Geladeira & fogão', {cidade:'Corrente',categoria:'eletrodomesticos',precoMin:'100',precoMax:'1.500,50'}),'https://teste.local');
  assert.equal(url.pathname,'/radar/pedir');
  assert.deepEqual(Object.fromEntries(url.searchParams),{q:'Geladeira & fogão',categoria:'eletrodomesticos',cidade:'Corrente',preco_min:'100',preco_max:'1.500,50'});
  assert.equal(linkPedirRadar(),'/radar/pedir');
});
const usuario = {id:'user_teste',firstName:'Teste',lastName:null,imageUrl:'',primaryPhoneNumberId:null,phoneNumbers:[]};
function perfil(existente, erroLeitura = null, erroEscrita = null) {
  const gravacoes=[];
  const query = {
    select() { return this; }, eq() { return this; },
    maybeSingle: async () => ({data:existente,error:erroLeitura}),
    update(dados) { gravacoes.push(dados); return {eq:async()=>({error:erroEscrita})}; },
  };
  const mod = carregar('src/lib/perfil.ts', {
    '@/lib/supabase/admin': {supabaseAdmin:()=>({from:()=>query})},
    '@clerk/nextjs/server': {},
  });
  return {...mod,gravacoes};
}
test('telefone removido revoga número e confirmação',async()=>{
  const p=perfil({id:usuario.id,whatsapp:'5589999990000',whatsapp_verificado_em:'2026-01-01'});
  await p.sincronizarPerfil(usuario);
  assert.deepEqual(p.gravacoes,[{whatsapp:null,whatsapp_verificado_em:null}]);
});
test('telefone digitado permitido pelo painel não é apagado por ausência de confirmação',async()=>{
  const p=perfil({id:usuario.id,whatsapp:'5589999990000',whatsapp_verificado_em:null});
  await p.sincronizarPerfil(usuario); assert.equal(p.gravacoes.length,0);
});
test('troca confirmada sincroniza novo telefone',async()=>{
  const p=perfil({id:usuario.id,whatsapp:'5589999990000',whatsapp_verificado_em:'2026-01-01'});
  await p.sincronizarPerfil({...usuario,primaryPhoneNumberId:'phone1',phoneNumbers:[{id:'phone1',phoneNumber:'+5589999991111',verification:{status:'verified'}}]});
  assert.equal(p.gravacoes[0].whatsapp,'5589999991111'); assert.ok(p.gravacoes[0].whatsapp_verificado_em);
});
test('erro ao revogar telefone propaga falha para repetir webhook',async()=>{
  const p=perfil({id:usuario.id,whatsapp:'5589999990000',whatsapp_verificado_em:'2026-01-01'},null,{message:'offline'});
  await assert.rejects(p.sincronizarPerfil(usuario),/remover a confirmação/);
});
test('erro de leitura não tenta criar ou atualizar perfil',async()=>{
  const p=perfil(null,{message:'offline'});
  await assert.rejects(p.sincronizarPerfil(usuario),/consultar o perfil/); assert.equal(p.gravacoes.length,0);
});
test('pedido, propostas e cota indisponíveis produzem erro recuperável',async()=>{
  const radar=carregar('src/lib/dados/radar.ts',{
    '@clerk/nextjs/server': {},
    '@/lib/dados/config': {},
    '@/lib/supabase/server': {createClient:async()=>({rpc:async()=>({data:null,error:{message:'offline'}})})},
  });
  for (const chamada of [()=>radar.meusPedidos(),()=>radar.minhasPropostas(),()=>radar.acessoRadar(),()=>radar.pedidoRadar('10000000-0000-4000-a000-000000000001'),()=>radar.propostasDoPedido('10000000-0000-4000-a000-000000000001')]) await assert.rejects(chamada,/Não foi possível/);
});
test('criação recusa confirmação indisponível sem gravar pedido',async()=>{
  let consultas=0;
  const actions=carregar('src/app/radar/actions.ts',{
    '@clerk/nextjs/server': {auth:async()=>({userId:'user_teste'}),currentUser:async()=>{throw Error('indisponível');}},
    'next/cache': {revalidatePath:()=>{}},
    '@/lib/supabase/server': {createClient:async()=>{consultas++;throw Error('não deveria consultar');}},
    '@/lib/supabase/admin': {}, '@/lib/perfil': {}, '@/lib/dados/conta': {}, '@/lib/dados/radar': {},
  });
  const resposta=await actions.criarPedido({chaveEnvio:'10000000-0000-4000-a000-000000000001',titulo:'Procuro bicicleta',cidade:'Corrente',modo:'whatsapp_direto'});
  assert.equal(resposta.ok,false); assert.match(resposta.erro,/confirmar seus dados/);assert.equal(consultas,0);
});
