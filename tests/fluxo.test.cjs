const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
// Executa o TypeScript real com as fronteiras externas substituídas, sem credenciais ou rede.
function carregar(arquivo, mocks = {}) {
  const filename = path.resolve(arquivo);
  const js = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
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


test('compartilhamento usa o endereço do site e respeita domínio configurado', () => {
  const antigo=process.env.NEXT_PUBLIC_SITE_URL;
  try {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    const f=carregar('src/lib/formato.ts');
    const url=f.urlAbsoluta('/loja/loja-teste');
    assert.equal(url,'https://ol-aqui.vercel.app/loja/loja-teste');
    assert.ok(new URL(f.linkWhatsApp('55109000000002','Teste',url)).searchParams.get('text').includes(url));
    process.env.NEXT_PUBLIC_SITE_URL='https://mercado.example/';
    assert.equal(carregar('src/lib/formato.ts').urlAbsoluta('loja/teste'),'https://mercado.example/loja/teste');
  } finally {
    if (antigo === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL=antigo;
  }
});
test('falha na consulta de termos não equivale a aceite concluído',async()=>{
  const paginas=carregar('src/lib/dados/paginas.ts',{
    '@clerk/nextjs/server':{auth:async()=>({userId:'user_teste'})},
    '@/lib/dados/seguro':{},
    '@/lib/supabase/server':{createClient:async()=>({rpc:async()=>({data:null,error:{message:'offline'}})})},
  });
  await assert.rejects(paginas.termosPendentes(),/consultar os termos/);
});
test('login e cadastro preservam destino passando pela conclusão de perfil',async()=>{
  const pagina=carregar('src/app/entrar/[[...entrar]]/page.tsx',{
    'next/image':{},'next/link':{},'@clerk/nextjs':{SignIn:'ClerkSignIn'},
  });
  for (const valor of ['/radar/pedir?q=Bicicleta&preco_max=1500','https://ol-aqui.vercel.app/radar/pedir?q=Bicicleta']) {
    const tela=await pagina.default({searchParams:Promise.resolve({redirect_url:valor})});
    const login=tela.props.children.find(e=>e.type==='ClerkSignIn');
    const destino=new URL(login.props.forceRedirectUrl,'https://teste.local');
    assert.equal(destino.pathname,'/entrar/perfil');
    assert.equal(destino.searchParams.get('redirect_url'),new URL(valor,'https://teste.local').pathname+new URL(valor,'https://teste.local').search);
    assert.equal(login.props.signUpForceRedirectUrl,login.props.forceRedirectUrl);
  }
});
test('perfil sem sessão mantém o destino original ao pedir login',async()=>{
  const pagina=carregar('src/app/entrar/perfil/page.tsx',{
    'next/image':{},'next/link':{},'lucide-react':{},
    'next/navigation':{redirect:(url)=>{throw Error(url);}},
    '@clerk/nextjs/server':{auth:async()=>({userId:null})},
    '@/lib/perfil':{},'@/lib/dados/paginas':{},'./botao-aceitar':{},
  });
  await assert.rejects(pagina.default({searchParams:Promise.resolve({redirect_url:'/radar/pedir?q=Bicicleta'})}),e=>e.message==='/entrar?redirect_url=%2Fradar%2Fpedir%3Fq%3DBicicleta');
});
test('pedido usa cidade da busca, cidade escolhida ou sede e nunca a primeira alfabética',async()=>{
  for (const [busca,selecionada,esperado] of [['',null,'Corrente'],['','Bom Jesus','Bom Jesus'],['Corrente','Bom Jesus','Corrente'],['Outra região',null,null]]) {
    const pagina=carregar('src/app/radar/pedir/page.tsx',{
      'next/link':{},'lucide-react':{},
      '@clerk/nextjs/server':{currentUser:async()=>({id:'user_teste'})},
      '@/lib/perfil':{garantirPerfil:async()=>{},sincronizarPerfil:async()=>{}},
      '@/lib/dados/conta':{meuPerfilEVitrine:async()=>({perfil:{microrregiao_id:'r',cidade:null}})},
      '@/lib/dados/categorias':{listarCategorias:async()=>[]},
      '@/lib/dados/regiao':{listarCidades:async()=>['Avelino Lopes','Bom Jesus','Corrente'].map(nome=>({nome})),regiaoAtual:async()=>({id:'r',cidade:selecionada,cidadeSede:'Corrente'})},
      '@/lib/dados/radar':{exigeCelularConfirmado:async()=>false,regrasRadar:async()=>({})},
      '@/components/ui/botao':{},'@/components/ui/vazio':{},'@/components/radar/form-pedido':{FormPedido:'FormPedido'},
    });
    const tela=await pagina.default({searchParams:Promise.resolve({cidade:busca})});
    const formulario=tela.props.children.find(e=>typeof e.type==='function');
    const campos=await formulario.type(formulario.props);
    assert.equal(campos.props.children.find(e=>e.type==='FormPedido').props.cidadeInicial,esperado);
  }
});
