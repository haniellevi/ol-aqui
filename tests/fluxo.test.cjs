const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PassThrough } = require('node:stream');
const { carregar } = require('./carregar.cjs');
const { centavosDoTexto } = carregar('src/lib/formato.ts');
const React = require('react');
const { renderToPipeableStream, renderToStaticMarkup } = require('react-dom/server');
const CATEGORIAS = [
  { id: 'c1', slug: 'veiculos', nome: 'Veículos', icone: 'car', filhas: [] },
  { id: 'c2', slug: 'pet', nome: 'Pet', icone: 'paw-print', filhas: [{ id: 'c21', slug: 'racao', nome: 'Ração', icone: 'bone', filhas: [] }] },
];
function inicio({ regiao = { id: 'r', cidadeSede: 'Corrente', nome: 'Extremo Sul' }, anuncios = [], total = anuncios.length, destaques = [], blocos, lojas = [], categoriasLojas = new Map(), erro = false } = {}) {
  return carregar('src/app/(publico)/page.tsx', {
    './inicio.module.css': { default: { fundo: 'inicio-fundo', categoria: 'inicio-categoria', vazio: 'inicio-vazio' } },
    '@clerk/nextjs/server': { auth: async () => ({ userId: null }) },
    '@/lib/dados/favoritos': { favoritosEntre: async () => new Set() },
    '@/lib/dados/anuncios': { buscarAnuncios: async () => ({ anuncios: [] }) },
    '@/components/anuncio/salvar-ao-voltar': { SalvarAoVoltar: () => null },
    '@/components/anuncio/vistos-recentemente': { VistosRecentemente: () => null },
    '@/components/busca/campo-busca': { CampoBusca: ({ id }) => React.createElement('form', { role: 'search', action: '/busca', method: 'get' }, React.createElement('input', { id, type: 'search', name: 'q' })) },
    '@/components/vitrine/avatar-vitrine': { AvatarVitrine: ({ nome }) => React.createElement('span', null, nome[0]) },
    '@/lib/dados/regiao': { regiaoAtual: async () => regiao },
    '@/lib/dados/categorias': { listarCategorias: async () => CATEGORIAS, totaisCategorias: async () => null },
    '@/lib/dados/catalogo': {
      lojasCatalogo: async () => lojas,
      categoriasDasLojas: async () => categoriasLojas,
      anunciosCatalogo: async (r, modo, limite) => {
        assert.equal(r, regiao);
        if (modo === 'patrocinados') return destaques;
        assert.equal(modo, 'feed');
        assert.equal(limite, 24);
        if (erro) throw new Error('Não foi possível consultar os anúncios.');
        return anuncios.map(a => ({ ...a, total }));
      },
    },
    '@/lib/dados/paginas': { blocosHome: async () => blocos ?? ['lojas_regiao', 'destaques', 'radar', 'recentes'].map(chave => ({ chave, ativo: true, titulo: null, texto: null, botao: null })) },
    '@/components/anuncio/card-anuncio': { CardAnuncio: ({ anuncio }) => React.createElement('article', null, anuncio.titulo) },
    '@/components/destaques/lojas-em-destaque': { LojasEmDestaque: () => null },
  });
}
async function htmlInicio(opcoes, params = {}) {
  const pagina = await inicio(opcoes).default({ searchParams: Promise.resolve(params) });
  const destino = new PassThrough();
  const { pipe } = renderToPipeableStream(pagina, { onAllReady: () => pipe(destino), onError: (e) => destino.destroy(e) });
  return Buffer.concat(await destino.toArray()).toString();
}
const LOJAS = [
  { id: 'l1', slug: 'multi', nome: 'Multi', cidade: 'Corrente', logo_url: null, verificada: true },
  { id: 'l2', slug: 'rvs', nome: 'RVS TECNOLOGIA', cidade: 'Corrente', logo_url: null, verificada: false },
];
test('início apresenta região, busca GET acessível e destinos das categorias', async () => {
  const html = await htmlInicio();
  assert.match(html, /<h1[^>]*>Anúncios em (<!-- -->)?Corrente e região<\/h1>/);
  assert.match(html, /<form[^>]*role="search"[^>]*action="\/busca"/);
  for (const href of ['/c/veiculos', '/c/pet', '/categorias']) assert.ok(html.includes(`href="${href}"`));
});
test('início mostra as lojas no topo do feed, com busca, tipo de loja e um só "Ver todas"', async () => {
  const html = await htmlInicio({ lojas: LOJAS, categoriasLojas: new Map([['l1', ['c21', 'c21']], ['l2', ['c1']]]), anuncios: [{ id: 'a1', titulo: 'Mesa' }] });
  assert.match(html, /id="titulo-lojas"[^>]*>Lojas de Corrente e região<\/h2><a\b[^>]*href="\/lojas"[^>]*>(<span[^>]*>)?Ver todas<\//);
  assert.equal((html.match(/href="\/lojas"/g) ?? []).length, 1);
  assert.match(html, /<label for="busca-loja"[^>]*>Buscar loja<\/label>/);
  assert.match(html, /role="group" aria-label="Tipo de loja"/);
  for (const nome of ['>Todos os tipos<', '>Pet<', '>Veículos<']) assert.ok(html.includes(nome), nome);
  for (const slug of ['multi', 'rvs']) assert.ok(html.includes(`href="/loja/${slug}"`));
  assert.match(html, /aria-label="Loja verificada"/);
  const lojasEm = html.indexOf('titulo-lojas');
  assert.ok(lojasEm < html.indexOf('titulo-inicio') && lojasEm < html.indexOf('titulo-recentes'));
  assert.doesNotMatch(html, /Ver todas as lojas/);
});
test('início esconde o filtro de tipo quando as lojas não têm tipos diferentes', async () => {
  const html = await htmlInicio({ lojas: LOJAS });
  assert.doesNotMatch(html, /aria-label="Tipo de loja"/);
  assert.match(html, /busca-loja/);
  const vazio = await htmlInicio({ lojas: [] });
  assert.match(vazio, /id="titulo-lojas"/);
  assert.doesNotMatch(vazio, /busca-loja/);
  assert.equal((vazio.match(/href="\/lojas"/g) ?? []).length, 1);
});
test('início com o bloco de lojas desligado mantém um acesso ao catálogo', async () => {
  const html = await htmlInicio({ regiao: { id: 'r', cidade: 'Bom Jesus', cidadeSede: 'Corrente', nome: 'Extremo Sul' }, blocos: [{ chave: 'recentes', ativo: true }, { chave: 'lojas_regiao', ativo: false }], lojas: LOJAS });
  assert.match(html, /<h1[^>]*>Anúncios em (<!-- -->)?Bom Jesus e região<\/h1>/);
  assert.equal((html.match(/href="\/lojas"/g) ?? []).length, 1);
  assert.match(html, /Ver todas as lojas/);
  assert.doesNotMatch(html, /id="titulo-lojas"|href="\/loja\/multi"/);
});
test('início troca os cartões grandes por uma faixa fina de Radar e Anunciar acima dos anúncios', async () => {
  for (const anuncios of [[], [{ id: 'a1', titulo: 'Mesa da região' }]]) {
    const html = await htmlInicio({ anuncios });
    assert.match(html, /<nav aria-label="Pedir no Radar ou anunciar">/);
    assert.equal((html.match(/href="\/radar\/pedir"/g) ?? []).length, 1);
    assert.match(html, /Não achou\?.*Estou procurando/);
    assert.match(html, /Quer vender\?.*>Anunciar</);
    assert.doesNotMatch(html, /titulo-vender|>Exemplo<|Anunciar grátis|Tem algo parado em casa/);
    assert.ok(html.indexOf('Pedir no Radar ou anunciar') < html.indexOf('titulo-recentes'));
  }
});
test('início vazio mostra a grade vazia com saída para anunciar', async () => {
  const html = await htmlInicio();
  assert.match(html, /Seu anúncio pode ser o primeiro/);
  assert.match(html, /id="titulo-recentes"/);
  assert.doesNotMatch(html, /<article/);
});
test('início com anúncios mantém destaques e paginação sem mostrar estado vazio', async () => {
  const anuncios = [{ id: 'a1', titulo: 'Mesa da região' }, { id: 'a2', titulo: 'Bicicleta da região' }];
  for (const total of [8, 25]) {
    const html = await htmlInicio({ anuncios, total, destaques: [{ id: 'd1', titulo: 'Destaque da região' }] });
    for (const titulo of ['Destaque da região', 'Mesa da região', 'Bicicleta da região']) assert.ok(html.includes(titulo));
    assert.equal((html.match(/<article/g) ?? []).length, 3);
    assert.equal(html.includes('/?pagina=2#anuncios'), total > 24);
    assert.doesNotMatch(html, /Seu anúncio pode ser o primeiro/);
  }
});
test('início respeita textos, ordem e visibilidade definidos no painel', async () => {
  const blocos = [
    { chave: 'lojas_regiao', ativo: true, titulo: 'Comércio de {lugar}' },
    { chave: 'recentes', ativo: true, titulo: 'Novidades de {lugar}', texto: 'Anuncie em {lugar}.' },
    { chave: 'radar', ativo: true, titulo: 'Pedido em {lugar}?', texto: 'Texto da equipe', botao: 'Criar <pedido>' },
  ];
  const html = await htmlInicio({ blocos });
  assert.match(html, /id="titulo-lojas"[^>]*>Comércio de Corrente e região</);
  assert.match(html, /Novidades de Corrente e região/);
  assert.match(html, /Anuncie em Corrente e região\./);
  assert.match(html, /Pedido em Corrente e região\?/);
  assert.match(html, /Criar &lt;pedido&gt;/);
  assert.ok(html.indexOf('href="/anunciar"') < html.indexOf('href="/radar/pedir"'));
  const oculto = await htmlInicio({ blocos: blocos.map(b => ({ ...b, ativo: b.chave !== 'radar' })) });
  assert.doesNotMatch(oculto, /href="\/radar\/pedir"|Pedido em/);
  assert.match(oculto, /Quer vender\?/);
});
test('início sem região mantém busca e não inventa localização', async () => {
  const pagina = inicio({ regiao: null });
  const html = renderToStaticMarkup(await pagina.default({ searchParams: Promise.resolve({}) }));
  assert.match(html, /Anúncios em sua região/);
  assert.match(html, /action="\/busca"/);
  assert.equal((html.match(/href="\/lojas"/g) ?? []).length, 1);
  const metadata = await pagina.generateMetadata();
  assert.equal(metadata.alternates.canonical, '/');
  assert.equal(metadata.title.absolute, 'Mercado da Região · Compre e venda em sua região');
});
test('falha ao consultar anúncios não vira página inicial falsamente vazia', async () => {
  await assert.rejects(inicio({ erro: true }).default({ searchParams: Promise.resolve({}) }), /Não foi possível consultar os anúncios/);
});
test('tipo de loja sobe até a categoria de cima e ordena pelos que têm mais lojas', () => {
  const { tiposDasLojas } = carregar('src/lib/tipos-de-loja.ts');
  const { porLoja, tipos } = tiposDasLojas(
    [{ id: 'l1' }, { id: 'l2' }, { id: 'l3' }],
    new Map([['l1', ['c21', 'c1', 'c21']], ['l2', ['c21', 'sumiu']], ['l3', []]]),
    CATEGORIAS,
  );
  assert.deepEqual(porLoja.get('l1'), ['pet', 'veiculos']);
  assert.deepEqual(porLoja.get('l2'), ['pet']);
  assert.deepEqual(porLoja.get('l3'), []);
  assert.deepEqual(tipos.map(t => t.slug), ['pet', 'veiculos']);
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
  const resposta=await actions.criarPedido({chaveEnvio:'10000000-0000-4000-a000-000000000001',titulo:'Procuro bicicleta',cidade:'Corrente',modo:'whatsapp_direto',visibilidade:'lojas'});
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
test('Pedir de novo leva detalhes, categoria, preço, área e quem vê para o formulário',async()=>{
  const {linkPedirRadar}=carregar('src/lib/rotas.ts');
  const link=linkPedirRadar('Procuro mesa',{detalhes:'x'.repeat(1500),categoriaId:'cat1',precoMin:'10',precoMax:'20',cidades:['c1','c2'],visibilidade:'todos'});
  const u=new URL(link,'https://teste.local');
  assert.equal(u.searchParams.get('detalhes').length,1000);assert.equal(u.searchParams.get('categoria_id'),'cat1');
  assert.equal(u.searchParams.get('cidades'),'c1,c2');assert.equal(u.searchParams.get('quem'),'todos');assert.equal(u.searchParams.get('preco_max'),'20');
  const pagina=carregar('src/app/radar/pedir/page.tsx',{
    'next/link':{},'lucide-react':{},
    '@clerk/nextjs/server':{currentUser:async()=>({id:'user_teste'})},
    '@/lib/perfil':{garantirPerfil:async()=>{},sincronizarPerfil:async()=>{}},
    '@/lib/dados/conta':{meuPerfilEVitrine:async()=>({perfil:{microrregiao_id:'r',cidade:null}})},
    '@/lib/dados/categorias':{listarCategorias:async()=>[{id:'cat1',slug:'mesas',nome:'Mesas',filhas:[]}]},
    '@/lib/dados/regiao':{listarCidades:async()=>['Avelino Lopes','Bom Jesus'].map((nome,i)=>({id:`c${i}`,nome,uf:'PI'})),regiaoAtual:async()=>({id:'r',cidade:null,cidadeSede:'Corrente'})},
    '@/lib/dados/radar':{exigeCelularConfirmado:async()=>false,regrasRadar:async()=>({})},
    '@/components/ui/botao':{},'@/components/ui/vazio':{},'@/components/ui/alert':{Alert:'Alert'},'@/components/radar/form-pedido':{FormPedido:'FormPedido'},
  });
  const tela=await pagina.default({searchParams:Promise.resolve({q:'Procuro mesa',detalhes:'Madeira',categoria_id:'cat1',cidades:'c1,c9',quem:'todos',preco_min:'10'})});
  const formulario=tela.props.children.find(e=>typeof e.type==='function');
  const campos=await formulario.type(formulario.props);
  const form=campos.props.children.find(e=>e&&e.type==='FormPedido');
  assert.equal(form.props.detalhesInicial,'Madeira');assert.equal(form.props.categoriaInicial,'cat1');
  assert.deepEqual(form.props.cidadesIniciais,['c1']);assert.equal(form.props.visibilidadeInicial,'todos');assert.equal(form.props.precoMinInicial,'10');
});
test('pedido começa em Toda a região, manda as cidades com id e avisa cidade de fora',async()=>{
  for (const [busca,selecionada,avisa] of [['',null,false],['','Bom Jesus',false],['Corrente','Bom Jesus',false],['Outra região',null,true]]) {
    const pagina=carregar('src/app/radar/pedir/page.tsx',{
      'next/link':{},'lucide-react':{},
      '@clerk/nextjs/server':{currentUser:async()=>({id:'user_teste'})},
      '@/lib/perfil':{garantirPerfil:async()=>{},sincronizarPerfil:async()=>{}},
      '@/lib/dados/conta':{meuPerfilEVitrine:async()=>({perfil:{microrregiao_id:'r',cidade:null}})},
      '@/lib/dados/categorias':{listarCategorias:async()=>[]},
      '@/lib/dados/regiao':{listarCidades:async()=>['Avelino Lopes','Bom Jesus','Corrente'].map((nome,i)=>({id:`c${i}`,nome,uf:'PI'})),regiaoAtual:async()=>({id:'r',cidade:selecionada,cidadeSede:'Corrente'})},
      '@/lib/dados/radar':{exigeCelularConfirmado:async()=>false,regrasRadar:async()=>({})},
      '@/components/ui/botao':{},'@/components/ui/vazio':{},'@/components/ui/alert':{Alert:'Alert'},'@/components/radar/form-pedido':{FormPedido:'FormPedido'},
    });
    const tela=await pagina.default({searchParams:Promise.resolve({cidade:busca})});
    const formulario=tela.props.children.find(e=>typeof e.type==='function');
    const campos=await formulario.type(formulario.props);
    const form=campos.props.children.find(e=>e&&e.type==='FormPedido');
    assert.equal(form.props.cidadesIniciais,undefined);
    assert.deepEqual(form.props.cidades,[{id:'c0',nome:'Avelino Lopes'},{id:'c1',nome:'Bom Jesus'},{id:'c2',nome:'Corrente'}]);
    assert.equal(campos.props.children.some(e=>e&&e.type==='Alert'),avisa);
  }
});
