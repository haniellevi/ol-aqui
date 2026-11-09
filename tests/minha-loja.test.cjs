const test = require('node:test');
const assert = require('node:assert/strict');
const {carregar} = require('./carregar.cjs');
const uid='user_loja', id='95000000-0000-4000-a000-000000000001';
const base='https://store.test';
process.env.NEXT_PUBLIC_SUPABASE_URL=base;
const img=(p='loja',user=uid,n='foto.webp')=>`${base}/storage/v1/object/public/anuncios/${user}/${p}/${n}`;
const defaults={nome:'Loja de teste',whatsapp:'(89) 99999-0001',cidade:'Corrente',bairro:'Centro',logo_url:'',banner_tipo:'modelo',banner_url:'',banner_cor:'#4B1248',banner_modelo:'liso',endereco:'Rua de teste',lat:'',lng:'',instagram:'',sobre:'',faz_entrega:'',entrega_obs:'',horarios:''};
function form(values={}){const f=new FormData();for(const [k,v] of Object.entries({...defaults,...values})) {if(Array.isArray(v))v.forEach(x=>f.append(k,x));else f.set(k,v);}return f;}
function ambiente(o={}) {
 const chamadas=[];
 const v={id,dono_id:uid,tipo:'loja',slug:'loja-teste',status:'ativa',cidade:'Corrente',logo_url:img(),banner_url:img('vitrine'),banner_tipo:'modelo',banner_cor:'#4B1248',formas_pagamento:['Crediário antigo'],...o.v};
 const q={update(x){chamadas.push(['update',x]);return this;},eq(...x){chamadas.push(['eq',...x]);return this;},select(){return this;},async maybeSingle(){if(o.rede)throw Error('segredo');return {data:o.zero?null:{id:o.idRetorno??id},error:o.erro??null};}};
 const db={from(){return q;},storage:{from(){return {async createSignedUploadUrl(p){chamadas.push(['upload',p]);return {data:{signedUrl:'https://signed.test'},error:null};},getPublicUrl(p){return {data:{publicUrl:`${base}/storage/v1/object/public/anuncios/${p}`}};}};}}};
 const mocks={
  '@clerk/nextjs/server':{auth:async()=>({userId:o.semLogin?null:uid})},
  'next/cache':{revalidatePath:p=>chamadas.push(['cache',p])},
  '@/lib/supabase/server':{createClient:async()=>db},
  '@/lib/dados/fotos':{apagarFoto:async u=>{chamadas.push(['delete',u]);return {ok:true};}},
  '@/lib/dados/vitrine-completa':{minhaVitrineCompleta:async()=>{if(o.falhaLeitura)throw Error('segredo');return o.semLoja?null:v;},meusRecursosVitrine:async()=>{if(o.falhaPlano)throw Error('segredo');return {foto_fachada:!o.semFoto};},opcoesVitrine:async()=>({cores:['#4B1248','#E76824'],formasPagamento:['Pix','Dinheiro']})},
  '@/lib/dados/regiao':{listarCidades:async()=>o.semCidades?[]:[{nome:'Corrente'},{nome:'Cristalândia do Piauí'}]},
 };
 return {a:carregar('src/app/(conta)/minha-conta/loja/actions.ts',mocks),b:carregar('src/app/(conta)/minha-conta/loja/vitrine-actions.ts',mocks),chamadas};
}
test('Minha loja: salvar dados, capa e informações exige a identidade proprietária',async()=>{
 for(const o of [{semLogin:true},{semLoja:true},{v:{dono_id:'outro'}},{v:{tipo:'pf'}},{falhaLeitura:true}]) {
  const {a,b,chamadas}=ambiente(o);
  for(const r of [await a.salvarLoja(null,form()),await b.salvarBanner(null,form()),await b.salvarInformacoes(null,form())])assert.ok(r.erro);
  assert.equal(chamadas.some(x=>x[0]==='update'),false);
 }
});
test('Minha loja: zero linhas, outra linha, banco e rede não confirmam sucesso nem removem imagem',async()=>{
 for(const o of [{zero:true},{idRetorno:'outro'},{erro:{message:'segredo'}},{rede:true}]) {
  const {a,b,chamadas}=ambiente(o);
  for(const r of [await a.salvarLoja(null,form()),await b.salvarBanner(null,form()),await b.salvarInformacoes(null,form())]){assert.ok(r.erro);assert.ok(!r.ok);assert.ok(!r.erro.includes('segredo'));}
  assert.equal(chamadas.some(x=>['cache','delete'].includes(x[0])),false);
 }
});
test('Minha loja: salva somente campos permitidos, confirma linha e atualiza contato público',async()=>{
 const {a,chamadas}=ambiente();assert.ok((await a.salvarLoja(null,form({nome:'  Loja   Local ',dono_id:'outro',status:'suspensa',plano_id:'gratis'}))).ok);
 assert.deepEqual(chamadas.find(x=>x[0]==='update')[1],{nome:'Loja Local',whatsapp:'5589999990001',cidade:'Corrente',bairro:'Centro',logo_url:null});
 assert.ok(chamadas.some(x=>x[0]==='eq'&&x[1]==='dono_id'&&x[2]===uid));
 assert.ok(chamadas.some(x=>x[0]==='cache'&&x[1]==='/anuncio/[idslug]'));
 assert.equal(chamadas.filter(x=>x[0]==='delete').length,1);
});
test('Minha loja: valida nome, telefone, região, uploads alheios e entradas não textuais',async()=>{
 for(const valores of [{nome:'x'},{whatsapp:'123'},{cidade:'Cidade de fora'},{bairro:'x'.repeat(81)},{logo_url:img('loja','outro')},{logo_url:img('loja',uid,'a..webp')},{logo_url:'https://evil.test/a.webp'},{nome:new Blob(['nome'])}]){
  const {a,chamadas}=ambiente();assert.ok((await a.salvarLoja(null,form(valores))).erro);assert.equal(chamadas.some(x=>x[0]==='update'),false);
 }
 const {a}=ambiente({semCidades:true});assert.ok((await a.salvarLoja(null,form({cidade:'Nova cidade'}))).erro);assert.ok((await a.salvarLoja(null,form())).ok);
});
test('Minha loja: envio de logo/capa limita formato, dono, suspensão e plano',async()=>{
 for(const o of [{semLogin:true},{semLoja:true},{v:{dono_id:'outro'}},{v:{status:'suspensa'}},{falhaLeitura:true}]){
  const {a,b,chamadas}=ambiente(o);assert.equal((await a.prepararEnvioImagemLoja('logo','webp')).ok,false);assert.equal((await b.prepararEnvioBanner('jpg')).ok,false);assert.equal(chamadas.some(x=>x[0]==='upload'),false);
 }
 for(const o of [{semFoto:true},{falhaPlano:true}])assert.equal((await ambiente(o).b.prepararEnvioBanner('jpg')).ok,false);
 const {a,b,chamadas}=ambiente();assert.equal((await a.prepararEnvioImagemLoja('capa','webp')).ok,false);assert.equal((await a.prepararEnvioImagemLoja('logo','html')).ok,false);assert.equal((await b.prepararEnvioBanner('html')).ok,false);
 assert.ok((await a.prepararEnvioImagemLoja('logo','webp')).ok);assert.ok((await b.prepararEnvioBanner('jpg')).ok);
 assert.match(chamadas.find(x=>x[0]==='upload')[1],/^user_loja\/loja\/logo-[\w-]+\.webp$/);
});
test('Capa: bloqueia enum, cor, URL e foto ausente; conserva foto no plano menor',async()=>{
 for(const values of [{banner_tipo:'outro'},{banner_modelo:'html'},{banner_cor:'#FFFFFF'},{banner_url:img('vitrine','outro')},{banner_url:img('vitrine',uid,'a..webp')},{banner_tipo:'foto',banner_url:''}])assert.ok((await ambiente().b.salvarBanner(null,form(values))).erro);
 const {b,chamadas}=ambiente({semFoto:true,v:{banner_tipo:'foto'}});assert.ok((await b.salvarBanner(null,form({banner_cor:'#E76824'}))).ok);
 assert.equal(chamadas.find(x=>x[0]==='update')[1].banner_url,img('vitrine'));assert.equal(chamadas.some(x=>x[0]==='delete'),false);
 assert.ok((await ambiente({falhaPlano:true,v:{banner_tipo:'foto'}}).b.salvarBanner(null,form())).erro);
});
test('Informações: horários válidos incluem meia-noite sem modificar o fechamento',async()=>{
 const h={seg:[{abre:'08:00',fecha:'12:00'},{abre:'14:00',fecha:'24:00'}],dom:[]};const {b,chamadas}=ambiente();
 assert.ok((await b.salvarInformacoes(null,form({horarios:JSON.stringify(h),instagram:'https://www.instagram.com/loja.local/',formas_pagamento:['Pix','Crediário antigo','Pix'],faz_entrega:'sim',entrega_obs:'Entrega local'}))).ok);
 const saved=chamadas.find(x=>x[0]==='update')[1];assert.deepEqual(saved.horarios,h);assert.equal(saved.instagram,'loja.local');assert.deepEqual(saved.formas_pagamento,['Pix','Crediário antigo']);assert.equal(saved.faz_entrega,true);
});
test('Informações: recusa sobreposição, horário invertido, dia desconhecido e contato inválido',async()=>{
 for(const values of [{horarios:'{'},{horarios:JSON.stringify({seg:[{abre:'18:00',fecha:'08:00'}]})},{horarios:JSON.stringify({seg:[{abre:'08:00',fecha:'12:00'},{abre:'11:00',fecha:'15:00'}]})},{horarios:JSON.stringify({x:[]})},{horarios:JSON.stringify({seg:[{abre:'24:00',fecha:'24:00'}]})},{instagram:'nome..invalido'},{lat:'90.1',lng:'-42'},{lat:'-10',lng:''},{faz_entrega:'talvez'},{formas_pagamento:['Outra']},{sobre:new Blob(['txt'])}]){
  const {b,chamadas}=ambiente();assert.ok((await b.salvarInformacoes(null,form(values))).erro);assert.equal(chamadas.some(x=>x[0]==='update'),false);
 }
});
test('Minha loja: leitura estrita distingue ausência, erro de serviço e loja alheia',async()=>{
 for(const o of [{data:null,error:null},{data:null,error:{message:'falhou'}},{data:{id,dono_id:'outro'},error:null},{data:{id,dono_id:uid,formas_pagamento:[]},error:null}]){
  const q={select(){return this;},eq(){return this;},maybeSingle:async()=>o};const {minhaVitrineCompleta}=carregar('src/lib/dados/vitrine-completa.ts',{'@clerk/nextjs/server':{auth:async()=>({userId:uid})},'@/lib/supabase/server':{createClient:async()=>({from:()=>q})}});
  if(o.error||o.data?.dono_id==='outro')await assert.rejects(minhaVitrineCompleta(true));else assert.equal((await minhaVitrineCompleta(true))?.id??null,o.data?.id??null);
 }
});
test('Capa: recusa arquivo vazio ou maior que 20 MB antes de decodificar',async()=>{
 const {abrirFoto}=carregar('src/components/vitrine/cortar-banner.ts');await assert.rejects(abrirFoto(new Blob([])),/20 MB/);await assert.rejects(abrirFoto(new Blob([new Uint8Array(20*1024*1024+1)])),/20 MB/);
});
