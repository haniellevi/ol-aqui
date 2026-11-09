const test = require('node:test');
const assert = require('node:assert/strict');
const { carregar } = require('./carregar.cjs');
const id = 'user_perfil';
function form(valores = {}) { const f = new FormData(); for (const [k,v] of Object.entries({ nome: 'Pessoa de teste', cidade: 'Corrente', bairro: 'Centro', ...valores })) f.set(k,v); return f; }
function ambiente(op = {}) {
  const chamadas = [];
  const consulta = {
    update(v) { chamadas.push(['update',v]); return this; },
    eq(...v) { chamadas.push(['eq',...v]); return this; },
    is(...v) { chamadas.push(['is',...v]); return this; },
    select() { return this; },
    async maybeSingle() { if(op.rede) throw Error('offline'); return { data: op.semLinha ? null : {id: op.retornoId ?? id}, error: op.erro ?? null }; },
  };
  const db = { from(t) { chamadas.push(['from',t]); return consulta; } };
  const a = carregar('src/app/(conta)/minha-conta/dados/actions.ts', {
    '@clerk/nextjs/server': {auth:async()=>({userId: op.semLogin ? null : id}),currentUser:async()=>op.semUsuario ? null : ({id:op.clerkId ?? id})},
    'next/cache': {revalidatePath:p=>chamadas.push(['cache',p])},
    '@/lib/supabase/server': {createClient:async()=>db},
    '@/lib/supabase/admin': {supabaseAdmin:()=>db},
    '@/lib/dados/conta': {meuPerfilEVitrine:async()=>op.semConta ? null : ({perfil:{id:op.perfilId ?? id,microrregiao_id:'regiao',whatsapp_verificado_em:op.confirmado ? '2026-11-09' : null}})},
    '@/lib/dados/regiao': {listarCidades:async()=>{if(op.erroCidades) throw Error('offline');return op.semCidades ? [] : [{nome:'Corrente'}];}},
    '@/lib/dados/radar': {exigeCelularConfirmado:async()=>op.exigeCodigo ?? false},
    '@/lib/perfil': {sincronizarPerfil:async(u)=>{if(op.erroSync) throw Error('offline');chamadas.push(['sync',u.id]);}},
  });
  return {a,chamadas};
}
test('perfil: ações exigem sessão e a sincronização exige o mesmo usuário Clerk', async()=>{
  const {a,chamadas}=ambiente({semLogin:true});
  for(const r of [await a.salvarDados(null,form()),await a.salvarWhatsapp(null,form({whatsapp:'89999990001'})),await a.atualizarPerfilClerk()]) assert.match(r.erro,/Entre/);
  assert.deepEqual(chamadas,[]);
  for(const o of [{semUsuario:true},{clerkId:'outra_pessoa'}]) {
    const b=ambiente(o); assert.ok((await b.a.atualizarPerfilClerk()).erro); assert.ok((await b.a.salvarWhatsapp(null,form({whatsapp:'89999990001'}))).erro);
    assert.deepEqual(b.chamadas,[]);
  }
});
test('perfil: valida nome, bairro, cidade indisponível e tipo de entrada antes de gravar',async()=>{
  for(const valores of [{nome:'x'},{nome:'x'.repeat(121)},{bairro:'x'.repeat(81)},{cidade:'Outra região'},{nome:new Blob(['nome'])}]) {
    const {a,chamadas}=ambiente(); assert.ok((await a.salvarDados(null,form(valores))).erro); assert.equal(chamadas.some(c=>c[0]==='update'),false);
  }
  for(const o of [{semCidades:true},{erroCidades:true},{semConta:true},{perfilId:'outro'}]) {
    const {a,chamadas}=ambiente(o);assert.ok((await a.salvarDados(null,form())).erro);assert.equal(chamadas.some(c=>c[0]==='update'),false);
  }
});
test('perfil: salva apenas campos permitidos na identidade da sessão, normaliza espaços e limpa opcionais',async()=>{
  const {a,chamadas}=ambiente();
  assert.equal((await a.salvarDados(null,form({nome:'  Maria   Silva ',cidade:'',bairro:' ',id:'outro',avatar_url:'https://evil',e_admin:'true',whatsapp:'5511999998888'}))).ok,true);
  assert.deepEqual(chamadas.find(c=>c[0]==='update')[1],{nome:'Maria Silva',cidade:null,bairro:null});
  assert.ok(chamadas.some(c=>c[0]==='eq'&&c[1]==='id'&&c[2]===id));
});
test('perfil: zero linhas, retorno de outra pessoa, erro de banco ou rede não confirmam sucesso',async()=>{
  for(const o of [{semLinha:true},{retornoId:'outro'},{erro:{message:'SQL privado'}},{rede:true}]) {
    const {a,chamadas}=ambiente(o);const r=await a.salvarDados(null,form()); assert.ok(r.erro); assert.equal(r.ok,undefined); assert.equal(r.erro.includes('SQL privado'),false);
    assert.equal(chamadas.some(c=>c[0]==='cache'),false);
  }
});
test('WhatsApp: aceita DDD 55 e formato internacional sem duplicar país',async()=>{
  for(const [entrada,numero] of [['(89) 99999-0001','5589999990001'],['+55 (55) 99999-0001','5555999990001'],['55999990001','5555999990001']]) {
    const {a,chamadas}=ambiente();assert.equal((await a.salvarWhatsapp(null,form({whatsapp:entrada,id:'outro',whatsapp_verificado_em:'2026-11-09'}))).ok,true);
    assert.deepEqual(chamadas.find(c=>c[0]==='update')[1],{whatsapp:numero,whatsapp_verificado_em:null});
    assert.ok(chamadas.some(c=>c[0]==='eq'&&c[1]==='id'&&c[2]===id));
    assert.ok(chamadas.some(c=>c[0]==='is'&&c[1]==='whatsapp_verificado_em'&&c[2]===null));
    assert.ok(chamadas.findIndex(c=>c[0]==='sync')<chamadas.findIndex(c=>c[0]==='update'));
  }
});
test('WhatsApp: recusa inválidos, telefone fixo, texto e número estrangeiro',async()=>{
  for(const whatsapp of ['', '123','(89) 3333-4444','+1 212 555 1234','telefone 89999990001','9'.repeat(31),new Blob(['89999990001'])]) {
    const {a,chamadas}=ambiente();const r=await a.salvarWhatsapp(null,form({whatsapp})); assert.ok(r.campos.whatsapp); assert.deepEqual(chamadas,[]);
  }
});
test('WhatsApp: confirmação, política regional, conta alheia e falhas de sincronização bloqueiam a troca direta',async()=>{
  for(const o of [{confirmado:true},{exigeCodigo:true},{perfilId:'outro'},{semConta:true},{erroSync:true}]) {
    const {a,chamadas}=ambiente(o);assert.ok((await a.salvarWhatsapp(null,form({whatsapp:'89999990001'}))).erro);
    assert.equal(chamadas.some(c=>c[0]==='update'),false);
  }
});
test('WhatsApp: confirmação concorrente ou ausência do perfil não gera falso sucesso',async()=>{
  for(const o of [{semLinha:true},{retornoId:'outro'},{rede:true},{erro:{message:'privado'}}]) assert.ok((await ambiente(o).a.salvarWhatsapp(null,form({whatsapp:'89999990001'}))).erro);
});
test('perfil: sincronização falha com mensagem recuperável e usa só dados do Clerk',async()=>{
  const {a,chamadas}=ambiente();assert.equal((await a.atualizarPerfilClerk({id:'outro',avatar_url:'https://evil'})).ok,true);assert.deepEqual(chamadas[0],['sync',id]);
  assert.ok((await ambiente({erroSync:true}).a.atualizarPerfilClerk()).erro);
});
function syncAmbiente(op={}) {
  const updates=[];
  const existente={id,whatsapp:'5589999990001',whatsapp_verificado_em:'2026-01-01',avatar_url:'https://img/antiga',...op.existente};
  const user={id,firstName:'Nome do login',lastName:null,imageUrl:'https://img/nova',hasImage:true,primaryPhoneNumberId:'phone1',phoneNumbers:[{id:'phone1',phoneNumber:'+5589999990001',verification:{status:'verified'}}],...op.user};
  const db={from(){let alterou=false;const q={select(){return q;},eq(){return q;},update(v){alterou=true;updates.push(v);return q;},async maybeSingle(){return {data:alterou ? (op.semLinha?null:{id}):existente,error:op.erro?{message:'falhou'}:null};}};return q;}};
  const a=carregar('src/lib/perfil.ts',{'@clerk/nextjs/server':{},'@/lib/supabase/admin':{supabaseAdmin:()=>db}});
  return {run:()=>a.sincronizarPerfil(user),updates};
}
test('foto: sincroniza mudança sem exigir troca do telefone e preserva nome e confirmação',async()=>{
  const a=syncAmbiente();await a.run();assert.deepEqual(a.updates,[{avatar_url:'https://img/nova'}]);
});
test('foto: remoção apaga avatar salvo mesmo que Clerk forneça imagem padrão',async()=>{
  const a=syncAmbiente({user:{hasImage:false}});await a.run();assert.deepEqual(a.updates,[{avatar_url:null}]);
});
test('sincronização: não regrava quando não há mudanças e propaga falha do banco',async()=>{
  const a=syncAmbiente({user:{imageUrl:'https://img/antiga'}});await a.run();assert.equal(a.updates.length,0);
  await assert.rejects(syncAmbiente({semLinha:true}).run());await assert.rejects(syncAmbiente({erro:true}).run());
});
test('sincronização: número principal não confirmado não usa um secundário antigo',async()=>{
  const a=syncAmbiente({user:{primaryPhoneNumberId:'phone2',phoneNumbers:[{id:'phone1',phoneNumber:'+5589999990001',verification:{status:'verified'}},{id:'phone2',phoneNumber:'+5589999990002',verification:{status:'unverified'}}]}});
  await a.run();assert.deepEqual(a.updates,[{avatar_url:'https://img/nova',whatsapp:null,whatsapp_verificado_em:null}]);
});
test('sincronização: mantém WhatsApp digitado sem código e atualiza foto',async()=>{
  const a=syncAmbiente({existente:{whatsapp_verificado_em:null},user:{phoneNumbers:[],primaryPhoneNumberId:null}});await a.run();assert.deepEqual(a.updates,[{avatar_url:'https://img/nova'}]);
});
test('sincronização: novo principal confirmado troca telefone e confirmação',async()=>{
  const a=syncAmbiente({user:{phoneNumbers:[{id:'phone1',phoneNumber:'+5589999990002',verification:{status:'verified'}}]}});await a.run();assert.equal(a.updates[0].whatsapp,'5589999990002');assert.ok(Date.parse(a.updates[0].whatsapp_verificado_em));
});
