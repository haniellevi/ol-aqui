const {test}=require('node:test');
const assert=require('node:assert/strict');
const {carregar}=require('./carregar.cjs');
const React=require('react');
function ambiente(rota,aceito=true,bloqueado=false){
 const cookies=new Map(),local=new Map(),sessao=new Map(),eventos=new EventTarget();
 if(aceito)cookies.set('mr_privacidade_v1',encodeURIComponent('{"v":1,"estatistica":true,"marketing":false}'));
 const doc=new EventTarget();doc.visibilityState='visible';
 Object.defineProperty(doc,'cookie',{get:()=>[...cookies].map(([k,v])=>`${k}=${v}`).join('; '),set:s=>{const [par]=s.split(';');const i=par.indexOf('='),key=par.slice(0,i);if(bloqueado&&key==='mr_medicao_visitante')return;if(s.includes('Max-Age=0'))cookies.delete(key);else cookies.set(key,par.slice(i+1))}});
 const store=m=>({getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)});
 Object.assign(global,{document:doc,location:{protocol:'http:',search:'?origem=radio'},window:{location:{pathname:rota},addEventListener:(...a)=>eventos.addEventListener(...a),removeEventListener:(...a)=>eventos.removeEventListener(...a),dispatchEvent:e=>eventos.dispatchEvent(e)},localStorage:store(local),sessionStorage:store(sessao),matchMedia:()=>({matches:true})});
 return {cookies,local,sessao,permitirCookie(){bloqueado=false},clear(){for(const k of ['document','location','window','localStorage','sessionStorage','matchMedia'])delete global[k]}};
}
function montar(file,fn,props,mocks){
 const refs=[],deps=[];let cursor=0;
 const mod=carregar(file,{...mocks,react:{...React,useRef:v=>{const i=cursor++;return refs[i]??(refs[i]={current:v})},useEffect:(f,d)=>{const i=cursor++;if(!deps[i]||d.some((v,j)=>v!==deps[i][j])){deps[i]=d;f()}}}});
 return ()=>{cursor=0;mod[fn](props)};
}
for(const tipo of ['anuncio','loja'])test(`entrada ${tipo}: identidade pronta antes da ação real, uma tentativa sem coletor global`,async()=>{
 const a=ambiente(`/${tipo}/exemplo`);const calls=[];
 const mocks={
  'next/headers':{cookies:async()=>({get:k=>a.cookies.has(k)?{value:a.cookies.get(k)}:undefined}),headers:async()=>new Headers({host:'teste.invalid',referer:`http://teste.invalid/${tipo}/exemplo`})},
  '@clerk/nextjs/server':{auth:async()=>({userId:null})},'@/lib/supabase/admin':{supabaseAdmin:()=>({rpc:async(n,p)=>{calls.push([n,p]);return {data:true,error:null}}})},
  '@/app/(conta)/minha-conta/favoritos/actions':{},'@/lib/supabase/server':{},'@/lib/perfil':{},'@/lib/vistos':{guardarVisto:()=>{}}
 };
 try{
  const actionPath=tipo==='anuncio'?'src/app/(anuncio-publico)/anuncio/[idslug]/actions.ts':'src/app/(publico)/loja/[slug]/actions.ts';
  const action=carregar(actionPath,mocks);
  const m=montar(actionPath.replace('actions.ts',tipo==='anuncio'?'registrar-visita.tsx':'medir-loja.tsx'),tipo==='anuncio'?'RegistrarVisita':'MedirLoja',tipo==='anuncio'?{anuncioId:'91000000-0000-4000-a000-000000000020'}:{vitrineId:'91000000-0000-4000-a000-000000000020'},{...mocks,'./actions':action});
  m();await new Promise(r=>setImmediate(r));m();await new Promise(r=>setImmediate(r));
  assert.equal(calls.length,1);assert.ok(a.cookies.get('mr_medicao_visitante'));assert.equal(a.local.get('mr_visitante'),a.cookies.get('mr_medicao_visitante'));
 }finally{a.clear()}
});
test('identidade só após aceite atual; falha de cookie e retirada negam, sem fila',()=>{
 const a=ambiente('/anuncio/exemplo',false);try{
  const c=carregar('src/lib/metricas/cliente.ts');
  assert.equal(c.prepararIdentidadeMedicao(),null);assert.equal(a.local.size,0);
  assert.equal(c.sessaoPageviews(1000,''),null);assert.equal(a.sessao.size,0);
  c.salvarPreferencia({v:1,estatistica:true,marketing:false});const id=c.prepararIdentidadeMedicao();assert.ok(id);
  a.cookies.delete('mr_medicao_visitante');assert.equal(c.prepararIdentidadeMedicao().visitante,id.visitante,'Recuperar cookie auxiliar conserva o UUID já consentido');
  c.salvarPreferencia({v:1,estatistica:false,marketing:false});assert.equal(c.prepararIdentidadeMedicao(),null);assert.equal(a.local.has('mr_visitante'),false);
 }finally{a.clear()}
 const b=ambiente('/loja/exemplo',true,true);try{assert.equal(carregar('src/lib/metricas/cliente.ts').prepararIdentidadeMedicao(),null)}finally{b.clear()}
});
test('sessão observada expira sem pageview, conserva origem e explicita cópia de storage',()=>{
 const a=ambiente('/');const c=carregar('src/lib/metricas/cliente.ts');
 try{
  const first=c.sessaoPageviews(1000,'?origem=radio');
  const copy=JSON.parse(a.sessao.get('mr_medicao_sessao'));
  assert.equal(c.sessaoPageviews(1000+29*60000,'?origem=instagram').id,first.id);
  assert.equal(c.sessaoPageviews(1000+29*60000,'?origem=instagram').origem,'radio');
  // Leitura/interação não chama esta função. Aos 30 min desde o último despacho, renova.
  const renewed=c.sessaoPageviews(1000+59*60000,'?origem=instagram');assert.notEqual(renewed.id,first.id);
  a.sessao.set('mr_medicao_sessao',JSON.stringify(copy));
  assert.equal(c.sessaoPageviews(1001,'?origem=whatsapp').id,first.id,'Cópia do sessionStorage pode compartilhar o fluxo; não é isolamento de aba');
 }finally{a.clear()}
});
test('novo objeto de vistos no mesmo anúncio não recupera montagem pré-aceite nem falha de preparação',()=>{
 for(const aceito of [false,true]){
  const a=ambiente('/anuncio/exemplo',aceito,true),calls=[];
  try{
   const props={anuncioId:'91000000-0000-4000-a000-000000000020',visto:{}};
   const m=montar('src/app/(anuncio-publico)/anuncio/[idslug]/registrar-visita.tsx','RegistrarVisita',props,{'./actions':{registrarEvento:async()=>{calls.push('evento');return true}},'@/lib/vistos':{guardarVisto:()=>{}}});
   m();assert.equal(calls.length,0);
   a.permitirCookie();
   carregar('src/lib/metricas/cliente.ts').salvarPreferencia({v:1,estatistica:true,marketing:false});
   props.visto={};m();assert.equal(calls.length,0,'Rerender de dados não é uma nova navegação ou aceite retroativo');
  }finally{a.clear()}
 }
});
