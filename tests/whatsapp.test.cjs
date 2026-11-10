const {test,afterEach}=require('node:test');
const assert=require('node:assert/strict');
const {carregar}=require('./carregar.cjs');
const env={EVOLUTION_URL:'https://whatsapp.exemplo.test',EVOLUTION_API_KEY:'segredo-api',EVOLUTION_INSTANCE:'olaki',WHATSAPP_OTP_SECRET:'segredo-de-teste-com-mais-de-32-caracteres',TURNSTILE_SECRET_KEY:'captcha-secret',NEXT_PUBLIC_TURNSTILE_SITE_KEY:'site-key',TURNSTILE_HOSTNAMES:'ol-aqui.vercel.app'};
const originalFetch=global.fetch;
afterEach(()=>{global.fetch=originalFetch;for(const k of [...Object.keys(env),"VERCEL_ENV","VERCEL_URL","VERCEL_BRANCH_URL"])delete process.env[k];});
function servico(){Object.assign(process.env,env);return carregar('src/lib/whatsapp/servico.ts');}
const id='80000000-0000-4000-a000-000000000001';
function acoes(op={}){
 Object.assign(process.env,env);const calls=[];
 const q={update(v){calls.push(['update',v]);return q;},eq(){return q;},then(resolve){return Promise.resolve({error:op.erroRegistro?{}:null}).then(resolve);}};
 const a=carregar('src/app/confirmar-celular/actions.ts',{
  '@clerk/nextjs/server':{auth:async()=>({userId:op.semLogin?null:'user_a'})},
  '@/lib/perfil':{garantirPerfil:async()=>op.perfilErrado?'user_b':'user_a'},
  '@/lib/whatsapp/servico':{...carregar('src/lib/whatsapp/servico.ts'),validarTurnstile:async()=>!op.captchaRuim,enviarCodigo:async(...v)=>{calls.push(['envio',...v]);return op.envio??'enviado';}},
  '@/lib/supabase/admin':{supabaseAdmin:()=>({from:()=>q,rpc:async(nome,args)=>{calls.push(['rpc',nome,args]);return {data:nome==='reservar_codigo_whatsapp'?(op.reserva??'reservado'):(op.confirmacao??'confirmado'),error:op.erroBanco?{}:null};}})},
  'next/cache':{revalidatePath:(...v)=>calls.push(['cache',...v])},
 });return {a,calls};
}
test('WhatsApp normaliza celular brasileiro e rejeita telefone fixo ou entrada arbitrária',()=>{
 const s=servico();for(const [v,r] of [['(89) 99999-0001','5589999990001'],['+55 (55) 99999-0001','5555999990001'],['55999990001','5555999990001']])assert.equal(s.numeroWhatsapp(v),r);
 for(const v of [null,{},'telefone 89999990001','8933334444','+12125551234','9'.repeat(31)])assert.equal(s.numeroWhatsapp(v),null);
});
test('prefixo internacional explícito não pode virar outro celular brasileiro',()=>{
 const s=servico();
 for(const entrada of ['+1 2999999999','++55 (89) 99999-0001','+5 58999990001','55+89 99999-0001','+55 99999-0001','(55) 99999-00012','(55) 99999-000123'])assert.equal(s.numeroWhatsapp(entrada),null,entrada);
 for(const [entrada,esperado] of [['+55 (89) 99999-0001','5589999990001'],['+55 (55) 99999-0001','5555999990001'],['55999990001','5555999990001']])assert.equal(s.numeroWhatsapp(entrada),esperado,entrada);
});
test('segredo HMAC vincula código à conta e ao desafio, sem armazenar código puro',()=>{
 const s=servico(),n=s.novoCodigo('user_a',env.WHATSAPP_OTP_SECRET);
 assert.match(n.codigo,/^\d{6}$/);assert.match(n.resumo,/^[a-f0-9]{64}$/);assert.notEqual(n.resumo,n.codigo);
 assert.equal(s.resumoCodigo('user_a',n.id,n.codigo,env.WHATSAPP_OTP_SECRET),n.resumo);
 assert.notEqual(s.resumoCodigo('user_b',n.id,n.codigo,env.WHATSAPP_OTP_SECRET),n.resumo);
 assert.notEqual(s.resumoCodigo('user_a',id,n.codigo,env.WHATSAPP_OTP_SECRET),n.resumo);
});
test('configuração exige HTTPS, destino fixo, segredo forte e CAPTCHA',()=>{
 const s=servico();assert.equal(s.configuracaoWhatsapp().hostnames[0],'ol-aqui.vercel.app');
 for(const [k,v] of [['EVOLUTION_URL','http://server.test'],['EVOLUTION_URL','https://user:pass@server.test'],['EVOLUTION_URL','https://server.test?redirect=evil'],['EVOLUTION_INSTANCE','../outro'],['WHATSAPP_OTP_SECRET','curto'],['TURNSTILE_SECRET_KEY',''],['TURNSTILE_HOSTNAMES','*.vercel.app']]){process.env[k]=v;assert.throws(()=>s.configuracaoWhatsapp());process.env[k]=env[k];}
});
test('Turnstile rejeita falhas, replay, origem e ação diferentes antes de qualquer envio',async()=>{
 const s=servico(),c=s.configuracaoWhatsapp();
 for(const result of [{success:false,'error-codes':['timeout-or-duplicate']},{success:true,hostname:'evil.test',action:'confirmar-whatsapp'},{success:true,hostname:'ol-aqui.vercel.app',action:'outra'}]){global.fetch=async()=>({ok:true,json:async()=>result});assert.equal(await s.validarTurnstile('token',c),false);}
 global.fetch=async()=>({ok:true,json:async()=>({success:true,hostname:'ol-aqui.vercel.app',action:'confirmar-whatsapp'})});assert.equal(await s.validarTurnstile('token',c),true);
 assert.equal(await s.validarTurnstile('a'.repeat(2049),c),false);
 global.fetch=async()=>{throw Error('rede');};assert.equal(await s.validarTurnstile('token',c),false);
});
test('sessão desconectada não envia; timeout não causa repetição automática',async()=>{
 const s=servico(),c=s.configuracaoWhatsapp();let calls=[];
 global.fetch=async(url,op)=>{calls.push([url,op]);return {ok:true,json:async()=>({instance:{state:'close'}})};};
 assert.equal(await s.enviarCodigo('5589999990001','123456',c),'falha');assert.equal(calls.length,1);
 calls=[];global.fetch=async(url,op)=>{calls.push([url,op]);if(calls.length===1)return {ok:true,json:async()=>({instance:{state:'open'}})};throw Error('timeout');};
 assert.equal(await s.enviarCodigo('5589999990001','123456',c),'incerto');assert.equal(calls.length,2);
 const body=JSON.parse(calls[1][1].body);assert.equal(body.number,'5589999990001');assert.match(body.text,/123456/);assert.equal(calls[1][1].redirect,'error');
});
test('retorno HTTP sozinho não confirma envio, API deve devolver mensagem de saída',async()=>{
 const s=servico(),c=s.configuracaoWhatsapp();
 for(const [payload,esperado] of [[{key:{id:'mensagem',fromMe:true}},'enviado'],[{error:true},'incerto'],[{},'incerto'],[{key:{id:'mensagem',fromMe:false}},'incerto']]){
 global.fetch=async(url)=>({ok:true,json:async()=>url.includes('connectionState')?{instance:{state:'open'}}:payload});assert.equal(await s.enviarCodigo('5589999990001','123456',c),esperado);}
});
test('envio exige sessão, identidade, telefone válido, CAPTCHA e reserva de cota',async()=>{
 for(const op of [{semLogin:true},{perfilErrado:true},{captchaRuim:true},{erroBanco:true},{reserva:'aguarde'},{reserva:'limite'},{reserva:'conta'}]){
 const {a,calls}=acoes(op);assert.ok((await a.solicitarCodigo('89999990001','token')).erro);assert.equal(calls.filter(c=>c[0]==='envio').length,0);}
 const {a,calls}=acoes();assert.ok((await a.solicitarCodigo('123','token')).erro);assert.equal(calls.length,0);
});
test('envio reserva antes de sair, grava só resumo e nunca retorna código ao navegador',async()=>{
 const {a,calls}=acoes();const r=await a.solicitarCodigo('89999990001','token');assert.ok(r.desafio);assert.equal(r.aguardar,60);
 assert.equal(calls[0][0],'rpc');assert.equal(calls[0][2].p_usuario,'user_a');assert.match(calls[0][2].p_resumo,/^[a-f0-9]{64}$/);
 assert.equal(JSON.stringify(r).includes(calls[1][2]),false);assert.deepEqual(calls[2][1],{envio:'enviado'});
});
test('envio incerto mantém desafio para código atrasado; falha explícita não anuncia sucesso',async()=>{
 for(const op of [{envio:'incerto'},{erroRegistro:true}]) {const {a}=acoes(op);const r=await a.solicitarCodigo('89999990001','token');assert.ok(r.desafio);assert.match(r.aviso,/Não conseguimos confirmar/);}
 const {a}=acoes({envio:'falha'});const r=await a.solicitarCodigo('89999990001','token');assert.ok(r.erro);assert.equal(r.desafio,undefined);
});
test('validação usa conta da sessão e somente confirmação atômica permite sucesso',async()=>{
 for(const resposta of ['bloqueado','expirado','incorreto','invalido',null]) {const {a,calls}=acoes({confirmacao:resposta??'outra'});const r=await a.confirmarCodigo(id,'123456');assert.ok(r.erro);assert.equal(calls.some(c=>c[0]==='cache'),false);}
 const {a,calls}=acoes();assert.deepEqual(await a.confirmarCodigo(id,'123456'),{confirmado:true});assert.equal(calls[0][2].p_usuario,'user_a');assert.equal(calls[0][2].p_id,id);
 for(const [d,c] of [[id,'123'],['invalido','123456'],[id,null],[id,'abcdef']])assert.ok((await a.confirmarCodigo(d,c)).erro);
});
test('WhatsApp vinculado a outra conta encerra o desafio sem confirmar o novo contato', async () => {
  const { a, calls } = acoes({ confirmacao: 'numero_vinculado' });
  const resposta = await a.confirmarCodigo(id, '123456');
  assert.match(resposta.erro, /vinculado a outra conta/);
  assert.equal(resposta.encerrado, true);
  assert.equal(resposta.confirmado, undefined);
  assert.equal(calls.some(c => c[0] === 'cache'), false);
});
test('sincronização Clerk preserva número confirmado pela Evolution e protege concorrência',async()=>{
 let updates=[],filters=[];let externo=true;
 const db={from(){let write=false;const q={select(){return q;},eq(k,v){filters.push([k,v]);return q;},update(v){write=true;updates.push(v);return q;},maybeSingle:async()=>({data:write?{id:'user_a'}:{id:'user_a',avatar_url:'foto',whatsapp:'5589999990001',whatsapp_verificado_em:'2026-01-01',whatsapp_origem:externo?'evolution':'clerk'},error:null}),then(resolve){return Promise.resolve({data:null,error:null}).then(resolve);}};return q;}};
 const s=carregar('src/lib/perfil.ts',{'@clerk/nextjs/server':{},'@/lib/supabase/admin':{supabaseAdmin:()=>db}});
 const u={id:'user_a',firstName:'Teste',lastName:null,imageUrl:'foto',primaryPhoneNumberId:null,phoneNumbers:[]};
 await s.sincronizarPerfil(u);assert.deepEqual(updates,[]);
 await s.sincronizarPerfil({...u,primaryPhoneNumberId:'phone1',phoneNumbers:[{id:'phone1',phoneNumber:'+5589999990002',verification:{status:'verified'}}]});assert.deepEqual(updates,[]);
 externo=false;await s.sincronizarPerfil(u);assert.ok(filters.some(([k,v])=>k==='whatsapp_origem'&&v==='clerk'));
});

test('domínios extras só vêm das variáveis da Vercel em preview',()=>{const s=servico();process.env.VERCEL_URL='preview.vercel.app';assert.equal(s.configuracaoWhatsapp().hostnames.includes('preview.vercel.app'),false);process.env.VERCEL_ENV='preview';assert.equal(s.configuracaoWhatsapp().hostnames.includes('preview.vercel.app'),true);process.env.VERCEL_BRANCH_URL='https://evil.test';assert.throws(()=>s.configuracaoWhatsapp());});
