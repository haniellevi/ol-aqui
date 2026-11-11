const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PassThrough } = require('node:stream');
const { carregar } = require('./carregar.cjs');
const { centavosDoTexto } = carregar('src/lib/formato.ts');
const React = require('react');
const { renderToPipeableStream, renderToStaticMarkup } = require('react-dom/server');
function inicio({ regiao = { id: 'r', cidadeSede: 'Corrente', nome: 'Extremo Sul' }, anuncios = [], total = anuncios.length, destaques = [], blocos, lojas = [], erro = false, minimo = null } = {}) {
  return carregar('src/app/(publico)/page.tsx', {
    './inicio.module.css': { default: { fundo: 'inicio-fundo', categoria: 'inicio-categoria', vazio: 'inicio-vazio' } },
    '@/lib/dados/regiao': { regiaoAtual: async () => regiao },
    '@/lib/dados/categorias': { listarCategorias: async () => [
      { id: 'c1', slug: 'veiculos', nome: 'Veículos', icone: 'car' },
      { id: 'c2', slug: 'casa-e-moveis', nome: 'Casa e móveis', icone: 'sofa' },
    ] },
    '@/lib/dados/catalogo': {
      lojasCatalogo: async () => lojas,
      anunciosCatalogo: async (r, modo, limite) => {
        assert.equal(r, regiao);
        if (modo === 'patrocinados') return destaques;
        assert.equal(modo, 'feed');
        assert.equal(limite, 24);
        if (erro) throw new Error('Não foi possível consultar os anúncios.');
        return anuncios.map(a => ({ ...a, total }));
      },
    },
    '@/lib/dados/config': { lerConfigNumero: async () => minimo },
    '@/lib/dados/paginas': { blocosHome: async () => blocos ?? ['destaques', 'radar', 'recentes'].map(chave => ({ chave, ativo: true })) },
    '@/components/anuncio/card-anuncio': { CardAnuncio: ({ anuncio }) => React.createElement('article', null, anuncio.titulo) },
    '@/components/destaques/lojas-em-destaque': { LojasEmDestaque: () => null },
  });
}
test('início apresenta região, busca GET acessível e destinos das categorias', async () => {
  const html = renderToStaticMarkup(await inicio().default({ searchParams: Promise.resolve({}) }));
  assert.match(html, /<h1[^>]*>Compre e venda em Corrente e região<\/h1>/);
  const form = html.match(/<form\b[^>]*>/)?.[0] ?? '';
  for (const atributo of ['action="/busca"', 'method="get"', 'role="search"']) assert.ok(form.includes(atributo));
  assert.match(html, /<label for="busca-inicio"[^>]*>O que você procura\?/);
  const campo = html.match(/<input\b[^>]*>/)?.[0] ?? '';
  for (const atributo of ['id="busca-inicio"', 'type="search"', 'name="q"']) assert.ok(campo.includes(atributo));
  for (const href of ['/c/veiculos', '/c/casa-e-moveis', '/categorias']) assert.ok(html.includes(`href="${href}"`));
});
test('início usa a cidade escolhida e mantém um acesso ao catálogo com o bloco de lojas desligado', async () => {
  const pagina = inicio({
    regiao: { id: 'r', cidade: 'Bom Jesus', cidadeSede: 'Corrente', nome: 'Extremo Sul' },
    blocos: [{ chave: 'lojas_regiao', ativo: false }],
  });
  const html = renderToStaticMarkup(await pagina.default({ searchParams: Promise.resolve({}) }));
  assert.match(html, /<h1[^>]*>Compre e venda em Bom Jesus e região<\/h1>/);
  assert.equal((html.match(/href="\/lojas"/g) ?? []).length, 1);
  assert.doesNotMatch(html, /id="titulo-lojas"/);
});
test('início mostra um único acesso ao catálogo junto ao título da seção, mesmo sem lojas', async () => {
  const blocos = [{ chave: 'lojas_regiao', ativo: true }];
  for (const lojas of [[], [{ id: 'l1', slug: 'multi', nome: 'Multi' }]]) {
    const pagina = await inicio({ blocos, lojas }).default({ searchParams: Promise.resolve({}) });
    const destino = new PassThrough();
    const { pipe } = renderToPipeableStream(pagina, {
      onAllReady: () => pipe(destino),
      onError: (erro) => destino.destroy(erro),
    });
    const html = Buffer.concat(await destino.toArray()).toString();
    assert.equal((html.match(/href="\/lojas"/g) ?? []).length, 1);
    assert.match(html, /id="titulo-lojas"[^>]*>Lojas de Corrente e região<\/h2><a\b[^>]*href="\/lojas"[^>]*><span[^>]*>Ver todas as lojas/);
    assert.equal(html.includes('href="/loja/multi"'), lojas.length > 0);
  }
});
test('início vazio oferece anúncio e apenas um acesso ao pedido no Radar', async () => {
  const html = renderToStaticMarkup(await inicio().default({ searchParams: Promise.resolve({}) }));
  assert.match(html, /id="titulo-vender"[^>]*>Tem algo para vender\?/);
  assert.match(html, /href="\/anunciar"/);
  assert.equal((html.match(/href="\/radar\/pedir"/g) ?? []).length, 1);
  assert.match(html, /As lojas da região respondem e você escolhe com quem conversar/);
  assert.equal((html.match(/>Exemplo</g) ?? []).length, 2);
  assert.ok(html.indexOf('titulo-radar') < html.indexOf('titulo-vender'));
  assert.ok(html.indexOf('titulo-vender') < html.indexOf('href="/c/veiculos"'));
  assert.doesNotMatch(html, /<article|Ver mais anúncios|Seu anúncio pode ser o primeiro|id="titulo-recentes"/);
});
test('início com anúncios mantém destaques e paginação sem mostrar estado vazio', async () => {
  const anuncios = [{ id: 'a1', titulo: 'Mesa da região' }, { id: 'a2', titulo: 'Bicicleta da região' }];
  for (const total of [8, 25]) {
    const html = renderToStaticMarkup(await inicio({ anuncios, total, destaques: [{ id: 'd1', titulo: 'Destaque da região' }] }).default({ searchParams: Promise.resolve({}) }));
    for (const titulo of ['Destaque da região', 'Mesa da região', 'Bicicleta da região']) assert.ok(html.includes(titulo));
    assert.equal((html.match(/<article/g) ?? []).length, 3);
    assert.equal(html.includes('/?pagina=2#anuncios'), total > 24);
    assert.doesNotMatch(html, /Seu anúncio pode ser o primeiro|Anunciar agora|titulo-vender|>Exemplo</);
    assert.ok(html.indexOf('href="/c/veiculos"') < html.indexOf('titulo-radar'));
  }
});
test('início com poucos anúncios mostra as duas portas e os anúncios que já existem', async () => {
  const anuncios = [{ id: 'a1', titulo: 'Mesa da região' }, { id: 'a2', titulo: 'Bicicleta da região' }];
  const html = renderToStaticMarkup(await inicio({ anuncios }).default({ searchParams: Promise.resolve({}) }));
  assert.match(html, /id="titulo-vender"/);
  assert.equal((html.match(/href="\/radar\/pedir"/g) ?? []).length, 1);
  assert.match(html, /id="titulo-recentes"/);
  assert.equal((html.match(/<article/g) ?? []).length, 2);
  const segunda = renderToStaticMarkup(await inicio({ anuncios, total: 30 }).default({ searchParams: Promise.resolve({ pagina: '2' }) }));
  assert.doesNotMatch(segunda, /titulo-vender/);
  const ajustado = renderToStaticMarkup(await inicio({ anuncios, minimo: 2 }).default({ searchParams: Promise.resolve({}) }));
  assert.doesNotMatch(ajustado, /titulo-vender/);
});
test('início respeita textos, ordem e visibilidade definidos no painel', async () => {
  const blocos = [
    { chave: 'recentes', ativo: true, titulo: 'Novidades de {lugar}', texto: 'Anuncie em {lugar}.' },
    { chave: 'radar', ativo: true, titulo: 'Pedido em {lugar}', texto: 'Texto da equipe <seguro>', botao: 'Criar pedido' },
  ];
  const html = renderToStaticMarkup(await inicio({ blocos, minimo: 0 }).default({ searchParams: Promise.resolve({}) }));
  assert.match(html, /Novidades de Corrente e região/);
  assert.match(html, /Anuncie em Corrente e região\./);
  assert.match(html, /Texto da equipe &lt;seguro&gt;/);
  assert.match(html, /Criar pedido/);
  assert.ok(html.indexOf('titulo-recentes') < html.indexOf('titulo-radar'));
  const oculto = renderToStaticMarkup(await inicio({ minimo: 0, blocos: blocos.map(b => ({ ...b, ativo: b.chave !== 'radar' })) }).default({ searchParams: Promise.resolve({}) }));
  assert.doesNotMatch(oculto, /titulo-radar|href="\/radar\/pedir"/);
});
test('início no começo usa os textos e a ordem do painel nas duas portas', async () => {
  const blocos = [
    { chave: 'recentes', ativo: true, titulo: 'Novidades de {lugar}', texto: 'Anuncie em {lugar}.' },
    { chave: 'radar', ativo: true, titulo: 'Pedido em {lugar}', texto: 'Texto da equipe <seguro>', botao: 'Criar pedido' },
  ];
  const html = renderToStaticMarkup(await inicio({ blocos }).default({ searchParams: Promise.resolve({}) }));
  for (const texto of [/Pedido em Corrente e região/, /Texto da equipe &lt;seguro&gt;/, /Criar pedido/, /Anuncie em Corrente e região\./]) assert.match(html, texto);
  assert.ok(html.indexOf('titulo-vender') < html.indexOf('titulo-radar'));
  const semRadar = renderToStaticMarkup(await inicio({ blocos: blocos.map(b => ({ ...b, ativo: b.chave !== 'radar' })) }).default({ searchParams: Promise.resolve({}) }));
  assert.doesNotMatch(semRadar, /titulo-radar|\/radar\/pedir/);
  assert.match(semRadar, /titulo-vender/);
});
test('início sem região mantém busca e não inventa localização', async () => {
  const pagina = inicio({ regiao: null });
  const html = renderToStaticMarkup(await pagina.default({ searchParams: Promise.resolve({}) }));
  assert.match(html, /Compre e venda em sua região/);
  assert.match(html, /action="\/busca"/);
  assert.equal((html.match(/href="\/lojas"/g) ?? []).length, 1);
  const metadata = await pagina.generateMetadata();
  assert.equal(metadata.alternates.canonical, '/');
  assert.equal(metadata.title.absolute, 'Mercado da Região · Compre e venda em sua região');
});
test('falha ao consultar anúncios não vira página inicial falsamente vazia', async () => {
  await assert.rejects(inicio({ erro: true }).default({ searchParams: Promise.resolve({}) }), /Não foi possível consultar os anúncios/);
});
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
    then(resolve) { return Promise.resolve({data:null,error:erroEscrita}).then(resolve); },
    maybeSingle: async () => ({data:gravacoes.length ? {id:usuario.id} : existente && {avatar_url:"",...existente},error:gravacoes.length ? erroEscrita : erroLeitura}),
    update(dados) { gravacoes.push(dados); return this; },
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
  await assert.rejects(p.sincronizarPerfil(usuario),/atualizar o telefone da conta/);
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
    assert.equal(url,'https://mercadodaregiao.com.br/loja/loja-teste');
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
  for (const valor of ['/radar/pedir?q=Bicicleta&preco_max=1500','https://mercadodaregiao.com.br/radar/pedir?q=Bicicleta']) {
    const tela=await pagina.default({searchParams:Promise.resolve({redirect_url:valor})});
    const login=tela.props.children.find(e=>e.type==='ClerkSignIn');
    const destino=new URL(login.props.forceRedirectUrl,'https://teste.local');
    assert.equal(destino.pathname,'/completar-perfil');
    assert.equal(destino.searchParams.get('redirect_url'),new URL(valor,'https://teste.local').pathname+new URL(valor,'https://teste.local').search);
    assert.equal(login.props.signUpForceRedirectUrl,login.props.forceRedirectUrl);
  }
});
test('perfil sem sessão mantém o destino original ao pedir login',async()=>{
  const pagina=carregar('src/app/completar-perfil/page.tsx',{
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
