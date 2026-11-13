const test=require('node:test');
const assert=require('node:assert/strict');
const {carregar}=require('./carregar.cjs');
const {validarMensagem,MOTIVOS_DENUNCIA}=carregar('src/components/conversas/validacao.ts');
const id='79000000-0000-4000-a000-000000000001';

test('mensagem precisa de 1 a 1000 letras depois de tirar os espaços das pontas',()=>{
 assert.equal(validarMensagem('oi'),null);
 assert.equal(validarMensagem('  '+'a'.repeat(1000)+'  '),null);
 for(const t of ['','   ','a'.repeat(1001),null,undefined,10,{}]) assert.equal(validarMensagem(t).campo,'texto');
});
test('motivos de denúncia são os da fila da equipe',()=>{
 assert.deepEqual([...MOTIVOS_DENUNCIA.map(m=>m.valor)],['golpe','proibido','falso','ofensivo','duplicado','outro']);
});

function ambiente(resposta,{login=true}={}){
 const chamadas=[];
 const a=carregar('src/app/(conta)/conversas/actions.ts',{
  '@clerk/nextjs/server':{auth:async()=>({userId:login?'user_cli':null})},
  'next/cache':{revalidatePath:p=>chamadas.push(['cache',p])},
  '@/lib/supabase/server':{createClient:async()=>({rpc:async(...args)=>{chamadas.push(args);return resposta;}})},
 });
 return {a,chamadas};
}

test('sem login nenhuma ação chama o banco',async()=>{
 const {a,chamadas}=ambiente({data:null,error:null},{login:false});
 for(const r of [await a.abrirConversaAnuncio(id),await a.enviarMensagem(id,'oi'),await a.mensagensDepois(id,null),await a.marcarLida(id),
  await a.mostrarMeuWhatsapp(id),await a.bloquear(id,true),await a.denunciar(id,'golpe',null)]) assert.equal(r.ok,false);
 assert.equal(chamadas.length,0);
});
test('id inválido, texto vazio, motivo fora da lista e data ruim recusam sem chamar o banco',async()=>{
 const {a,chamadas}=ambiente({data:null,error:null});
 for(const r of [await a.abrirConversaAnuncio('x'),await a.enviarMensagem('x','oi'),await a.marcarLida('x'),await a.bloquear('x',true),
  await a.mostrarMeuWhatsapp('x'),await a.denunciar('x','golpe',null),await a.mensagensDepois('x',null),await a.mensagensDepois(id,'ontem')]) assert.equal(r.ok,false);
 const vazio=await a.enviarMensagem(id,'   ');assert.equal(vazio.ok,false);assert.equal(vazio.erro.campo,'texto');
 assert.equal((await a.enviarMensagem(id,'a'.repeat(1001))).erro.campo,'texto');
 assert.equal((await a.denunciar(id,'spam',null)).ok,false);
 assert.equal((await a.denunciar(id,'golpe','a'.repeat(1001))).erro.campo,'detalhes');
 assert.equal(chamadas.length,0);
});
test('enviar manda o texto sem espaços nas pontas e devolve o id',async()=>{
 const novo='79000000-0000-4000-a000-000000000009';
 const {a,chamadas}=ambiente({data:novo,error:null});
 const r=await a.enviarMensagem(id,'  tem azul?  ');
 assert.deepEqual(r,{ok:true,dados:{id:novo}});
 assert.deepEqual(chamadas[0],['enviar_mensagem',{p_conversa:id,p_texto:'tem azul?'}]);
});
test('abrir conversa só confirma um id válido vindo do banco',async()=>{
 assert.deepEqual(await ambiente({data:id,error:null}).a.abrirConversaAnuncio(id),{ok:true,dados:{id}});
 assert.equal((await ambiente({data:'lixo',error:null}).a.abrirConversaAnuncio(id)).ok,false);
 const {a,chamadas}=ambiente({data:id,error:null});await a.abrirConversaAnuncio(id);
 assert.deepEqual(chamadas[0],['abrir_conversa_anuncio',{p_anuncio:id}]);
});
test('erro do banco vira mensagem para a pessoa, inclusive P0002',async()=>{
 const r=await ambiente({data:null,error:{code:'P0002',message:'Este anúncio não está mais no ar.'}}).a.abrirConversaAnuncio(id);
 assert.deepEqual(r,{ok:false,erro:{mensagem:'Este anúncio não está mais no ar.',codigo:'P0002'}});
 const p=await ambiente({data:null,error:{code:'P0001',message:'Muitas mensagens seguidas. Espere um pouco.'}}).a.enviarMensagem(id,'oi');
 assert.equal(p.erro.mensagem,'Muitas mensagens seguidas. Espere um pouco.');
});
test('bloquear, denunciar e mostrar WhatsApp chamam a função certa e atualizam a conversa',async()=>{
 const {a,chamadas}=ambiente({data:id,error:null});
 assert.equal((await a.bloquear(id,false)).ok,true);
 assert.equal((await a.denunciar(id,'golpe','  pediu pix  ')).ok,true);
 assert.equal((await a.mostrarMeuWhatsapp(id)).ok,true);
 const rpcs=chamadas.filter(c=>c[0]!=='cache');
 assert.deepEqual(rpcs,[['bloquear_conversa',{p_conversa:id,p_bloquear:false}],
  ['denunciar_conversa',{p_conversa:id,p_motivo:'golpe',p_detalhes:'pediu pix'}],['mostrar_meu_whatsapp',{p_conversa:id}]]);
 assert.ok(chamadas.some(c=>c[0]==='cache'&&c[1]===`/conversas/${id}`));
});
test('mensagens novas: lista do banco ou vazio',async()=>{
 const linhas=[{id,lado:'loja',tipo:'texto',texto:'oi',alerta_golpe:false,criado_em:'2026-11-13T10:00:00Z'}];
 const {a,chamadas}=ambiente({data:linhas,error:null});
 assert.deepEqual(await a.mensagensDepois(id,'2026-11-13T09:00:00.000Z'),{ok:true,dados:linhas});
 assert.deepEqual(chamadas[0],['conversa_mensagens_de',{p_conversa:id,p_depois:'2026-11-13T09:00:00.000Z'}]);
 assert.deepEqual(await ambiente({data:null,error:null}).a.mensagensDepois(id,null),{ok:true,dados:[]});
});
