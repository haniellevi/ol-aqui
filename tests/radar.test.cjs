const test=require('node:test');
const assert=require('node:assert/strict');
const {carregar}=require('./carregar.cjs');
const {validarPedido,validarProposta}=carregar('src/components/radar/validacao.ts');
const id='80000000-0000-4000-a000-000000000001';
const pedido={chaveEnvio:id,titulo:'Procuro mesa de madeira',cidade:'Corrente',modo:'propostas_prazo',prazoHoras:72,visibilidade:'lojas'};
test('orçamento mantém centavos e recusa limites invertidos antes de enviar',()=>{
 assert.equal(validarPedido({...pedido,precoMin:'1.500,50',precoMax:'1600.99'}),null);
 assert.equal(validarPedido({...pedido,precoMin:'1600',precoMax:'1500'}).campo,'preco_max_centavos');
 for(const preco of ['abc','-10','1e6','1000000001',{},10]) assert.ok(validarPedido({...pedido,precoMax:preco}));
});
test('pedido rejeita payloads malformados, texto excessivo, cidade e prazo ausentes',()=>{
 for(const entrada of [null,{}, {...pedido,titulo:'abc'},{...pedido,titulo:'a'.repeat(121)}, {...pedido,detalhes:'a'.repeat(1001)},{...pedido,cidade:'a'.repeat(81)},{...pedido,prazoHoras:null},{...pedido,categoriaId:'x'},{...pedido,modo:'privado'}]) assert.ok(validarPedido(entrada));
 assert.equal(validarPedido(pedido),null);
});
test('proposta preserva formato decimal e rejeita referência ambígua ou inválida',()=>{
 assert.equal(validarProposta({pedidoId:id,anuncioId:id,preco:'49,90'}),null);
 for(const entrada of [null,{pedidoId:id,anuncioId:'x'},{pedidoId:id,anuncioId:id,fotoUrl:'https://teste/foto'},{pedidoId:id,preco:[]},{pedidoId:id,mensagem:'a'.repeat(501)}])assert.ok(validarProposta(entrada));
 const {textoPrecoProposta}=carregar('src/components/radar/util.ts');
 assert.equal(textoPrecoProposta(150050),'1500,50');assert.equal(textoPrecoProposta(1),'0,01');assert.equal(textoPrecoProposta(null),'');
});
function ambiente(resposta,{login=true}={}){
 const chamadas=[];
 const a=carregar('src/app/radar/actions.ts',{
  '@clerk/nextjs/server':{auth:async()=>({userId:login?'user_loja':null}),currentUser:async()=>({id:'user_loja'})},
  'next/cache':{revalidatePath:p=>chamadas.push(['cache',p])},
  '@/lib/perfil':{sincronizarPerfil:async()=>{}},
  '@/lib/dados/conta':{meuPerfilEVitrine:async()=>({perfil:{id:'user_loja',whatsapp:'5589999990001',whatsapp_verificado_em:'2026-11-01'}})},
  '@/lib/dados/radar':{},'@/lib/supabase/admin':{},
  '@/lib/supabase/server':{createClient:async()=>({rpc:(...args)=>{chamadas.push(args);return {single:async()=>resposta,then:resolve=>Promise.resolve(resposta).then(resolve)};}})},
 });return {a,chamadas};
}
test('ações negam sessão e IDs inválidos sem chamar o banco',async()=>{
 const {a,chamadas}=ambiente({}, {login:false});
 for(const r of [await a.criarPedido(pedido),await a.enviarProposta({pedidoId:id}),await a.escolherProposta(id),await a.fecharPedido(id,'cancelado')]) assert.equal(r.ok,false);
 assert.equal(chamadas.length,0);
 const sem=ambiente({});assert.equal((await sem.a.enviarProposta({pedidoId:id,anuncioId:'x'})).ok,false);assert.equal(sem.chamadas.length,0);
});
test('criação só confirma identificador e estado conhecidos',async()=>{
 for(const data of [null,{}, {id:'invalido',status:'aberto'},{id,status:'encerrado'}]) assert.equal((await ambiente({data,error:null}).a.criarPedido(pedido)).ok,false);
 for(const status of ['aberto','em_analise'])assert.deepEqual(await ambiente({data:{id,status},error:null}).a.criarPedido(pedido),{ok:true,id,status});
});
test('contato só produz link wa.me com número e resposta válidos',async()=>{
 for(const data of [null,{}, {whatsapp:'abc',mensagem:'Oi'},{whatsapp:'123',mensagem:'Oi'},{whatsapp:'5589999990001',mensagem:null}])assert.equal((await ambiente({data,error:null}).a.escolherProposta(id)).ok,false);
 const r=await ambiente({data:{whatsapp:'5589999990001',mensagem:'Olá! & teste'},error:null}).a.escolherProposta(id);
 assert.equal(r.ok,true);assert.equal(new URL(r.linkWhatsapp).hostname,'wa.me');assert.equal(new URL(r.linkWhatsapp).searchParams.get('text'),'Olá! & teste');
});
test('envio diferencia proposta privada de contato direto e não aceita modo desconhecido',async()=>{
 const r=await ambiente({data:{modo:'propostas_prazo',editada:false},error:null}).a.enviarProposta({pedidoId:id,preco:'1500,50'});
 assert.equal(r.ok,true);assert.equal(r.linkWhatsapp,undefined);
 assert.equal((await ambiente({data:{modo:'qualquer',whatsapp:'5589999990001',mensagem:'Oi'},error:null}).a.enviarProposta({pedidoId:id})).ok,false);
});
test('encerramento exige retorno confirmado e atualiza as duas visões do pedido',async()=>{
 for(const data of [null,'aberto','atendido']) assert.equal((await ambiente({data,error:null}).a.fecharPedido(id,'cancelado')).ok,false);
 const {a,chamadas}=ambiente({data:'encerrado',error:null});assert.equal((await a.fecharPedido(id,'cancelado')).ok,true);
 for(const p of ['/radar',`/radar/${id}`,`/radar/pedido/${id}`])assert.ok(chamadas.some(([a,b])=>a==='cache'&&b===p));
});
test('leitura nula ou inválida de propostas não simula caixa vazia',async()=>{
 for(const data of [null,{},'erro']) {
 const d=carregar('src/lib/dados/radar.ts',{'@clerk/nextjs/server':{},'@/lib/dados/config':{},'@/lib/supabase/server':{createClient:async()=>({rpc:async()=>({data,error:null})})}});
 await assert.rejects(d.propostasDoPedido(id),/Não foi possível/);await assert.rejects(d.meusPedidos(),/Não foi possível/);
 }
});
const pedidoV2={...pedido,visibilidade:'lojas'};
test('v2: pedido aceita região toda sem cidade e valida cidades e visibilidade',()=>{
 const {cidade:_c,...semCidade}=pedidoV2;
 assert.equal(validarPedido({...semCidade,cidadesIds:[]}),null);
 assert.equal(validarPedido({...semCidade,cidadesIds:[id],visibilidade:'todos'}),null);
 assert.equal(validarPedido({...semCidade,cidadesIds:Array(21).fill(id)}).campo,'cidades');
 assert.equal(validarPedido({...semCidade,cidadesIds:['x']}).campo,'cidades');
 assert.equal(validarPedido({...semCidade,visibilidade:'privado'}).campo,'visibilidade');
});
test('v2: criarPedido manda p_cidades_ids nulo se vazio, array se não, e a visibilidade',async()=>{
 const ok={data:{id,status:'aberto'},error:null};
 const a1=ambiente(ok);await a1.a.criarPedido({...pedidoV2,cidadesIds:[]});
 const rpc1=a1.chamadas.find(c=>c[0]==='criar_pedido_radar_site');
 assert.equal(rpc1[1].p_cidades_ids,null);assert.equal(rpc1[1].p_visibilidade,'lojas');
 const a2=ambiente(ok);await a2.a.criarPedido({...pedidoV2,cidadesIds:[id],visibilidade:'todos'});
 const rpc2=a2.chamadas.find(c=>c[0]==='criar_pedido_radar_site');
 assert.deepEqual(rpc2[1].p_cidades_ids,[id]);assert.equal(rpc2[1].p_visibilidade,'todos');
});
test('v2: estender, resolver, avaliar e indicar recusam entrada ruim sem chamar o banco',async()=>{
 const {a,chamadas}=ambiente({data:null,error:null});
 assert.equal((await a.estenderPedido('x')).ok,false);
 assert.equal((await a.resolverPedido(id,id,true)).ok,false);
 assert.equal((await a.resolverPedido('x',null,false)).ok,false);
 assert.equal((await a.resolverPedido(id,'x',false)).ok,false);
 assert.equal((await a.avaliarPedido(id,0)).ok,false);
 assert.equal((await a.indicarAnuncio('x',id)).ok,false);
 assert.equal((await a.indicarAnuncio(id,'x')).ok,false);
 assert.equal(chamadas.length,0);
 const sem=ambiente({},{login:false});
 for(const r of [await sem.a.estenderPedido(id),await sem.a.resolverPedido(id,null,true),await sem.a.avaliarPedido(id,1),await sem.a.indicarAnuncio(id,id)])assert.equal(r.ok,false);
 assert.equal(sem.chamadas.length,0);
});
test('v2: ações novas chamam o banco com os parâmetros certos',async()=>{
 const e=ambiente({data:'2026-11-20T10:00:00Z',error:null});
 const r=await e.a.estenderPedido(id);assert.deepEqual(r,{ok:true,expiraEm:'2026-11-20T10:00:00Z'});
 assert.deepEqual(e.chamadas.find(c=>c[0]==='estender_pedido_radar')[1],{p_id:id});
 const f=ambiente({data:null,error:null});
 assert.equal((await f.a.resolverPedido(id,null,true)).ok,true);
 assert.deepEqual(f.chamadas.find(c=>c[0]==='resolver_pedido_radar')[1],{p_id:id,p_proposta_id:null,p_fora:true});
 assert.equal((await f.a.avaliarPedido(id,-1)).ok,true);
 assert.deepEqual(f.chamadas.find(c=>c[0]==='avaliar_pedido_radar')[1],{p_id:id,p_avaliacao:-1});
 const g=ambiente({data:id,error:null});
 assert.deepEqual(await g.a.indicarAnuncio(id,id),{ok:true,id});
 assert.deepEqual(g.chamadas.find(c=>c[0]==='indicar_anuncio_radar')[1],{p_pedido:id,p_anuncio:id});
 assert.equal((await ambiente({data:'lixo',error:null}).a.estenderPedido(id)).ok,false);
 assert.equal((await ambiente({data:'lixo',error:null}).a.indicarAnuncio(id,id)).ok,false);
 assert.equal((await ambiente({data:null,error:{code:'P0002',message:'Já foi indicado.'}}).a.indicarAnuncio(id,id)).erro,'Já foi indicado.');
});
test('v2: leitura de indicações e pedido bloqueado',async()=>{
 const lin={anuncio_id:id,titulo:'Mesa',preco_centavos:100,foto:null,vitrine_nome:'Loja',criado_em:'2026-11-12T00:00:00Z'};
 const mk=(data,error=null)=>carregar('src/lib/dados/radar.ts',{'@clerk/nextjs/server':{},'@/lib/dados/config':{},'@/lib/supabase/server':{createClient:async()=>({rpc:async()=>({data,error})})}});
 assert.deepEqual(await mk([lin]).indicacoesDoPedido(id),[lin]);
 assert.deepEqual(await mk([lin]).indicacoesDoPedido('x'),[]);
 await assert.rejects(mk(null).indicacoesDoPedido(id),/Não foi possível/);
 assert.equal((await mk([{id,bloqueado:true}]).pedidoRadar(id)).bloqueado,true);
});
test('v2 telas: cada campo de erro volta ao passo dele',()=>{
 const {passoDoCampo}=carregar('src/components/radar/passos-pedido.ts');
 for(const c of ['titulo','detalhes','categoria','preco','preco_min_centavos','preco_max_centavos']) assert.equal(passoDoCampo(c),1);
 assert.equal(passoDoCampo('cidades'),2);assert.equal(passoDoCampo('cidade'),2);
 assert.equal(passoDoCampo('visibilidade'),3);
 for(const c of ['prazo','whatsapp','celular',undefined,null]) assert.equal(passoDoCampo(c),4);
});
test('v2 telas: o passo só confere o que pergunta',()=>{
 const {erroDoPasso}=carregar('src/components/radar/passos-pedido.ts');
 const c1='80000000-0000-4000-a000-0000000000c1',c2='80000000-0000-4000-a000-0000000000c2';
 const e={chaveEnvio:id,titulo:'Procuro mesa de madeira',modo:'propostas_prazo',prazoHoras:null,cidadesIds:[],visibilidade:'lojas'};
 // passo 1 não reclama do prazo (passo 4), mas reclama do título e do preço
 assert.equal(erroDoPasso(1,e,[c1]),null);
 assert.equal(erroDoPasso(1,{...e,titulo:'abc'},[c1]).campo,'titulo');
 assert.equal(erroDoPasso(1,{...e,precoMin:'20',precoMax:'10'},[c1]).campo,'preco_max_centavos');
 // passo 2: só cidades da lista; vazio = região toda
 assert.equal(erroDoPasso(2,e,[c1]),null);
 assert.equal(erroDoPasso(2,{...e,cidadesIds:[c1]},[c1]),null);
 assert.equal(erroDoPasso(2,{...e,cidadesIds:[c2]},[c1]).campo,'cidades');
 assert.equal(erroDoPasso(3,{...e,visibilidade:'x'},[c1]).campo,'visibilidade');
 assert.equal(erroDoPasso(3,{...e,visibilidade:'todos'},[c1]),null);
 // passo 4 confere tudo
 assert.equal(erroDoPasso(4,e,[c1]).campo,'prazo');
 assert.equal(erroDoPasso(4,{...e,prazoHoras:72},[c1]),null);
});
test('v2 telas: área vira lista sem repetidas e texto do resumo',()=>{
 const {cidadesParaEnvio,textoArea}=carregar('src/components/radar/passos-pedido.ts');
 const cs=[{id:'a',nome:'Corrente'},{id:'b',nome:'Gilbués'}];
 assert.deepEqual(cidadesParaEnvio([]),[]);
 assert.deepEqual(cidadesParaEnvio(['a','b','a']),['a','b']);
 assert.equal(textoArea([],cs),'Toda a região');
 assert.equal(textoArea(['b','a'],cs),'Corrente, Gilbués');
});
test('v2 telas: a fala preenche o título vazio ou soma aos detalhes',()=>{
 const {juntarFala}=carregar('src/components/radar/passos-pedido.ts');
 assert.deepEqual(juntarFala('','','  geladeira  usada '),{titulo:'geladeira usada',detalhes:''});
 assert.deepEqual(juntarFala('Geladeira','branca','de 2 portas'),{titulo:'Geladeira',detalhes:'branca de 2 portas'});
 assert.deepEqual(juntarFala('Geladeira','','  '),{titulo:'Geladeira',detalhes:''});
 assert.equal(juntarFala('','','a'.repeat(200)).titulo.length,120);
});
test('v2 telas: vencimento e quando mostrar Pedir de novo',()=>{
 const {diasParaVencer,textoVencimento,mostrarPedirDeNovo}=carregar('src/components/radar/passos-pedido.ts');
 const agora=Date.parse('2026-11-12T12:00:00Z');
 assert.equal(diasParaVencer('2026-11-13T11:00:00Z',agora),1);
 assert.equal(diasParaVencer('2026-11-26T12:00:00Z',agora),14);
 assert.equal(diasParaVencer('2026-11-10T12:00:00Z',agora),0);
 assert.equal(diasParaVencer('lixo',agora),0);
 assert.equal(textoVencimento(0),'Vence hoje');assert.equal(textoVencimento(1),'Vence em 1 dia');assert.equal(textoVencimento(9),'Vence em 9 dias');
 const base={situacao:'aberto',fechado_motivo:null,pode_estender:false,extensoes:2,diasRestantes:1};
 assert.equal(mostrarPedirDeNovo(base),true);
 assert.equal(mostrarPedirDeNovo({...base,pode_estender:true}),false);
 assert.equal(mostrarPedirDeNovo({...base,extensoes:0}),false);
 assert.equal(mostrarPedirDeNovo({...base,diasRestantes:10}),false);
 assert.equal(mostrarPedirDeNovo({...base,situacao:'fechado',fechado_motivo:'resolvido'}),true);
 assert.equal(mostrarPedirDeNovo({...base,situacao:'fechado',fechado_motivo:'moderacao'}),false);
 assert.equal(mostrarPedirDeNovo({...base,situacao:'prazo_acabou'}),false);
});
test('v2 telas: toque duplo em Continuar não publica antes de mostrar o resumo',()=>{
 const {podePublicar,ESPERA_PUBLICAR_MS}=carregar('src/components/radar/passos-pedido.ts');
 assert.equal(ESPERA_PUBLICAR_MS,600);
 assert.equal(podePublicar(null,10_000),false); // passo 4 ainda não apareceu
 assert.equal(podePublicar(10_000,10_000),false); // mesmo instante do Continuar
 assert.equal(podePublicar(10_000,10_599),false);
 assert.equal(podePublicar(10_000,10_600),true);
 assert.equal(podePublicar(10_000,20_000),true);
});
function folhaResolver(estado=[]){
 const React=require('react');const {renderToStaticMarkup}=require('react-dom/server');
 const log={acoes:[],estado:[],refresh:0,botoes:{}};let fila=[...estado];
 const reactMock={...React,cache:f=>f,
  useState:(ini)=>{const v=fila.length?fila.shift():ini;return [v,(n)=>log.estado.push(n)];},
  useTransition:()=>[false,(cb)=>{log.ultima=cb();}],useRef:(v)=>({current:v})};
 const Inline=({children})=>React.createElement('div',null,children);
 const texto=(c)=>React.Children.toArray(c).map(x=>typeof x==='string'?x:'').join('').trim();
 const {FolhaResolver}=carregar('src/components/radar/folha-resolver.tsx',{
  react:reactMock,'next/navigation':{useRouter:()=>({refresh:()=>log.refresh++})},
  '@/app/radar/actions':{resolverPedido:async(...a)=>{log.acoes.push(['resolver',...a]);return {ok:true};},avaliarPedido:async(...a)=>{log.acoes.push(['avaliar',...a]);return {ok:true};}},
  '@/components/ui/folha':{Folha:Inline,FolhaContent:Inline,FolhaHeader:Inline,FolhaTitle:Inline,FolhaDescription:Inline},
  '@/components/ui/botao':{Botao:({children,onClick})=>{log.botoes[texto(children)]=onClick;return React.createElement('button',null,children);}},
  '@/components/ui/alert':{Alert:Inline},
 });
 const html=renderToStaticMarkup(React.createElement(FolhaResolver,{pedidoId:id,propostas:[{propostaId:'p1',lojaNome:'Eletro Corrente'}]}));
 return {html,log};
}
test('v2 telas: FolhaResolver — Outro lugar resolve fora e fecha; loja vai para Como foi',async()=>{
 const um=folhaResolver([true,1,null,null]);
 assert.match(um.html,/Com quem você resolveu\?/);assert.match(um.html,/Eletro Corrente/);assert.match(um.html,/Outro lugar/);
 um.log.botoes['Outro lugar']();await um.log.ultima;
 assert.deepEqual(um.log.acoes,[['resolver',id,null,true]]);
 assert.ok(um.log.estado.includes(false));assert.equal(um.log.refresh,1); // fechou e atualizou
 const loja=folhaResolver([true,1,null,null]);
 loja.log.botoes['Eletro Corrente']();await loja.log.ultima;
 assert.deepEqual(loja.log.acoes,[['resolver',id,'p1',false]]);
 assert.ok(loja.log.estado.includes(2));assert.ok(loja.log.estado.includes('Eletro Corrente')); // vai para "Como foi?"
 const dois=folhaResolver([true,2,'Eletro Corrente',null]);
 assert.match(dois.html,/Como foi\?/);assert.match(dois.html,/Foi bom/);assert.match(dois.html,/Não foi bom/);assert.match(dois.html,/Pular/);
 dois.log.botoes['Não foi bom']();await dois.log.ultima;
 assert.deepEqual(dois.log.acoes,[['avaliar',id,-1]]);
});
test('v2 Eu sei onde tem: busca exige sessão, usa a região do pedido e devolve só o que a tela usa',async()=>{
 const monta=({login=true,falha=false,pedido={id,bloqueado:false}}={})=>{const buscas=[],leituras=[];const a=carregar('src/app/radar/actions.ts',{
  '@clerk/nextjs/server':{auth:async()=>({userId:login?'user_x':null}),currentUser:async()=>({id:'user_x'})},
  'next/cache':{revalidatePath(){}},'@/lib/perfil':{sincronizarPerfil:async()=>{}},'@/lib/dados/conta':{meuPerfilEVitrine:async()=>({perfil:{microrregiao_id:'reg1'}})},
  '@/lib/dados/radar':{},'@/lib/supabase/admin':{},'@/lib/supabase/server':{createClient:async()=>({
    rpc:async(...x)=>{leituras.push(x);return {data:pedido?[pedido]:[],error:null};},
    from:t=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{slug:'corrente-pi'}})})})})})},
  '@/lib/dados/anuncios':{buscarAnuncios:async p=>{buscas.push(p);if(falha)throw new Error('x');return {anuncios:[{id:'a1',titulo:'Geladeira',preco_centavos:100000,capa:null,vitrine_nome:'Loja',slug:'s',cidade:'C',atributos:{}}],total:1};}}});return {a,buscas,leituras};};
 const sem=monta({login:false});assert.equal((await sem.a.buscarParaIndicar(id,'geladeira')).ok,false);assert.equal(sem.buscas.length,0);
 assert.equal((await monta().a.buscarParaIndicar('x','geladeira')).ok,false);
 const curto=monta();assert.deepEqual(await curto.a.buscarParaIndicar(id,' g '),{ok:true,anuncios:[]});assert.equal(curto.buscas.length,0);
 const fora=monta({pedido:null});assert.equal((await fora.a.buscarParaIndicar(id,'geladeira')).ok,false);assert.equal(fora.buscas.length,0);
 const bloq=monta({pedido:{id,bloqueado:true}});assert.equal((await bloq.a.buscarParaIndicar(id,'geladeira')).ok,false);assert.equal(bloq.buscas.length,0);
 const bom=monta();const r=await bom.a.buscarParaIndicar(id,'geladeira');
 assert.deepEqual(bom.leituras,[['radar_pedido',{p_id:id}]]);
 assert.deepEqual(bom.buscas,[{q:'geladeira',limite:8,regiao:'corrente-pi'}]);
 assert.deepEqual(r.anuncios,[{id:'a1',titulo:'Geladeira',preco_centavos:100000,capa:null,vitrine_nome:'Loja'}]);
 const ruim=await monta({falha:true}).a.buscarParaIndicar(id,'geladeira');assert.equal(ruim.ok,false);assert.match(ruim.erro,/Tente novamente/);
});

// Tela /radar/[id]: bloqueado esconde o pedido; quem não atende num pedido "todos" só indica
async function telaPedido(pedido,acesso,conta){
 const React=require('react');const {renderToStaticMarkup}=require('react-dom/server');
 const pg=carregar('src/app/radar/[id]/page.tsx',{
  'next/link':{__esModule:true,default:({href,children})=>React.createElement('a',{href:String(href)},children)},
  'next/navigation':{redirect(u){throw new Error('redirect '+u)},useRouter:()=>({push(){},refresh(){}})},
  '@/app/radar/actions':{},
  '@/lib/dados/radar':{pedidoRadar:async()=>pedido,minhaPropostaNoPedido:async()=>null,acessoRadar:async()=>acesso,
    planosComRadar:async()=>[{codigo:'full',nome:'Full',preco_centavos:9900,periodo_dias:30,propostas_radar_mes:null}],meusAnunciosNoAr:async()=>[],regrasRadar:async()=>({mensagemMax:300})},
  '@/lib/dados/conta':{meuPerfilEVitrine:async()=>conta}});
 return renderToStaticMarkup(await pg.default({params:Promise.resolve({id:pedido.id}),searchParams:Promise.resolve({})}));
}
const baseTela={id,titulo:'Geladeira secreta',detalhes:'Detalhe',categoria_nome:null,preco_min_centavos:null,preco_max_centavos:100000,cidade:'Corrente',area_texto:'Toda a região',visibilidade:'todos',
 modo_contato:'whatsapp_direto',propostas_ate:null,criado_em:new Date().toISOString(),expira_em:new Date(Date.now()+864e5).toISOString(),status:'aberto',situacao:'aberto',total_propostas:1,max_propostas:5,
 comprador_primeiro_nome:null,comprador_certificado:false,sou_comprador:false,ja_propus:false,mesma_regiao:true,tem_acesso:false,bloqueado:false};
test('v2 tela do pedido: bloqueado esconde o título e mostra a frase e os planos, mesmo para quem é comprador',async()=>{
 const html=await telaPedido({...baseTela,bloqueado:true,titulo:null,detalhes:null,sou_comprador:true},{temAcesso:false,restantes:0},{perfil:{},vitrine:null});
 assert.match(html,/Este pedido é só para lojas verificadas\./);assert.match(html,/Quer ver pedidos como este\?/);assert.match(html,/Ver planos/);
 assert.doesNotMatch(html,/Geladeira secreta/);assert.doesNotMatch(html,/Eu sei onde tem|Mandar oferta/);
});
test('v2 tela do pedido: quem não atende num pedido "todos" vê detalhes e "Eu sei onde tem", sem oferta nem propostas restantes',async()=>{
 const html=await telaPedido(baseTela,{temAcesso:false,restantes:7},{perfil:{microrregiao_id:'m'},vitrine:{id:'v'}});
 assert.match(html,/Geladeira secreta/);assert.match(html,/Detalhe/);assert.match(html,/Eu sei onde tem/);
 assert.doesNotMatch(html,/Mandar oferta|Propor|restantes|você chama o comprador/);
 const prazo=await telaPedido({...baseTela,situacao:'prazo_acabou',modo_contato:'propostas_prazo',propostas_ate:new Date(Date.now()-1e3).toISOString()},{temAcesso:false,restantes:0},{perfil:{},vitrine:null});
 assert.match(prazo,/Eu sei onde tem/); // R3: indicar vale enquanto o pedido está aberto, mesmo com o prazo das propostas vencido
 const fechado=await telaPedido({...baseTela,status:'encerrado',situacao:'fechado'},{temAcesso:false,restantes:0},{perfil:{},vitrine:null});
 assert.doesNotMatch(fechado,/Eu sei onde tem/);
});
test('v2 tela do pedido: loja que atende, mas de fora da área de um pedido "todos", vê a área e "Eu sei onde tem" (RF3)',async()=>{
 const html=await telaPedido({...baseTela,area_texto:'Corrente',pode_propor:false,tem_acesso:true},{temAcesso:true,restantes:null},{perfil:{microrregiao_id:'m'},vitrine:{id:'v',status:'ativa',tipo:'loja'},plano:{acesso_radar:true,e_teste:false,preco_centavos:9900}});
 assert.match(html,/Este pedido é para lojas de Corrente\./);assert.match(html,/Eu sei onde tem/);
 assert.doesNotMatch(html,/Mandar oferta|Ver planos|você chama o comprador/);
 const dentro=await telaPedido({...baseTela,pode_propor:true,tem_acesso:true},{temAcesso:true,restantes:null},{perfil:{microrregiao_id:'m'},vitrine:{id:'v',status:'ativa',tipo:'loja'},plano:{acesso_radar:true,e_teste:false,preco_centavos:9900}});
 assert.doesNotMatch(dentro,/Este pedido é para lojas de|Eu sei onde tem/);
});
test('v2 tela do pedido: plano pago sem selo vê "Verificar minha loja" no lugar de "Ver planos"',async()=>{
 const conta={perfil:{microrregiao_id:'m'},vitrine:{id:'v',status:'ativa',tipo:'loja'},plano:{acesso_radar:true,e_teste:false,preco_centavos:4990}};
 const bloq=await telaPedido({...baseTela,bloqueado:true,titulo:null,detalhes:null,visibilidade:'lojas'},{temAcesso:false,restantes:0},conta);
 assert.match(bloq,/Verificar minha loja/);assert.match(bloq,/href="\/minha-conta\/loja\/verificar"/);assert.doesNotMatch(bloq,/Ver planos/);
 const pf=await telaPedido({...baseTela,bloqueado:true,titulo:null,detalhes:null,visibilidade:'lojas'},{temAcesso:false,restantes:0},{...conta,vitrine:{id:'v',status:'ativa',tipo:'pf'}});
 assert.match(pf,/href="\/minha-conta\/verificacao"/);
 const teste=await telaPedido({...baseTela,bloqueado:true,titulo:null,detalhes:null,visibilidade:'lojas'},{temAcesso:false,restantes:0},{...conta,plano:{acesso_radar:true,e_teste:true,preco_centavos:0}});
 assert.match(teste,/Ver planos/);assert.doesNotMatch(teste,/Verificar minha loja/);
});
test('Aki: pedido sem cidade vale para a região toda',()=>{
 const {validarPedidoRadar}=carregar('src/lib/aki/validar.ts');
 const r=validarPedidoRadar({titulo:'Procuro mesa de jantar'});assert.equal(r.ok,true);assert.equal(r.dados.cidade,null);
});

test('cidadesDoRascunho: fica só com as da região e avisa se perdeu',()=>{
 const {cidadesDoRascunho}=carregar('src/components/radar/passos-pedido.ts');
 assert.deepEqual(cidadesDoRascunho(['a','b'],['a','c']),{ids:['a'],perdeu:true});
 assert.deepEqual(cidadesDoRascunho(['a'],['a']),{ids:['a'],perdeu:false});
 assert.deepEqual(cidadesDoRascunho([],['a']),{ids:[],perdeu:false});
});

test('estadoRetomada: quando mostrar o rascunho e qual aviso',()=>{
 const {estadoRetomada}=carregar('src/components/radar/passos-pedido.ts');
 // Voltou do login
 assert.equal(estadoRetomada({retomar:true,anonimo:false,temRascunho:true,perdeuCidades:false}),'ok');
 assert.equal(estadoRetomada({retomar:true,anonimo:false,temRascunho:true,perdeuCidades:true}),'perdeu_cidades');
 assert.equal(estadoRetomada({retomar:true,anonimo:false,temRascunho:false,perdeuCidades:false}),'sem_rascunho');
 // Sem login: Voltar do navegador na tela de entrar traz o pedido de volta; sem rascunho, nada
 assert.equal(estadoRetomada({retomar:false,anonimo:true,temRascunho:true,perdeuCidades:false}),'continua');
 assert.equal(estadoRetomada({retomar:false,anonimo:true,temRascunho:false,perdeuCidades:false}),null);
 // Logado sem ?retomar=1: não mexe
 assert.equal(estadoRetomada({retomar:false,anonimo:false,temRascunho:true,perdeuCidades:false}),null);
});
