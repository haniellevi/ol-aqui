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
