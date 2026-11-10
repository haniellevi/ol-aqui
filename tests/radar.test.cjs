const test=require('node:test');
const assert=require('node:assert/strict');
const {carregar}=require('./carregar.cjs');
const {validarPedido,validarProposta}=carregar('src/components/radar/validacao.ts');
const id='80000000-0000-4000-a000-000000000001';
const pedido={chaveEnvio:id,titulo:'Procuro mesa de madeira',cidade:'Corrente',modo:'propostas_prazo',prazoHoras:72};
test('orçamento mantém centavos e recusa limites invertidos antes de enviar',()=>{
 assert.equal(validarPedido({...pedido,precoMin:'1.500,50',precoMax:'1600.99'}),null);
 assert.equal(validarPedido({...pedido,precoMin:'1600',precoMax:'1500'}).campo,'preco_max_centavos');
 for(const preco of ['abc','-10','1e6','1000000001',{},10]) assert.ok(validarPedido({...pedido,precoMax:preco}));
});
test('pedido rejeita payloads malformados, texto excessivo, cidade e prazo ausentes',()=>{
 for(const entrada of [null,{}, {...pedido,titulo:'abc'},{...pedido,titulo:'a'.repeat(121)}, {...pedido,detalhes:'a'.repeat(1001)},{...pedido,cidade:''},{...pedido,prazoHoras:null},{...pedido,categoriaId:'x'},{...pedido,modo:'privado'}]) assert.ok(validarPedido(entrada));
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
