const {test}=require('node:test');
const assert=require('node:assert/strict');
const {carregar}=require('./carregar.cjs');
const lib=()=>carregar('src/lib/metricas/externos.ts');
const uuid=n=>`36000000-0000-4000-a000-${String(n).padStart(12,'0')}`;
const config=(destino='ga4',extra={})=>lib().configuracaoExterna(destino,'local',{id:destino==='ga4'?'G-TESTE03600':'123456789012345',solicitarHomologacao:true,...extra});
test('configurações por ambiente negam por padrão e formato nunca comprova conta',()=>{
 const m=lib();
 for(const ambiente of ['local','homologacao','producao']) for(const destino of ['ga4','meta']) {
  assert.equal(m.CONFIGURACOES_EXTERNAS[ambiente][destino].solicitarHomologacao,false);
  assert.equal(m.configuracaoExterna(destino,ambiente).status,'nao_configurado');
 }
 assert.equal(config().status,'pronto_para_homologar');assert.equal(config().habilitado,false);
 assert.equal(config('ga4',{solicitarHomologacao:false}).status,'desativado');
 for(const id of ['token@teste.invalid','G-x',' G-TESTE03600','G-TESTE03600\n']) assert.equal(config('ga4',{id}).status,'invalido');
 for(const id of ['token','0','123456789012345\n']) assert.equal(config('meta',{id}).status,'invalido');
 assert.equal(m.configuracaoExterna('ga4','desconhecido',{id:'G-TESTE03600'}).status,'invalido');
});
test('ensaio relê consentimentos separados, consome recusa e retirada sem retroenvio',async()=>{
 const m=lib(),rows=[];let p={estatistica:false,marketing:true};
 const run=m.criarEnsaioExterno({configuracao:()=>config(),preferencia:()=>p,transporte:e=>rows.push(e)});
 const evt={nome:'page_view',rota:'/'};
 assert.equal(await run(evt,uuid(1)),false);p.estatistica=true;
 assert.equal(await run(evt,uuid(1)),false);assert.equal(await run(evt,uuid(2)),true);
 p.estatistica=false;assert.equal(await run(evt,uuid(3)),false);
 assert.equal(rows.length,1);
 const meta=m.criarEnsaioExterno({configuracao:()=>config('meta'),preferencia:()=>p,transporte:e=>rows.push(e)});
 assert.equal(await meta(evt,uuid(4)),true);p.marketing=false;
 assert.equal(await meta(evt,uuid(5)),false);
});
test('gate de produção, ausência de transporte e fonte indisponível falham fechados',async()=>{
 const m=lib();let calls=0;
 for(const ambiente of ['homologacao','producao']) {
  const run=m.criarEnsaioExterno({configuracao:()=>m.configuracaoExterna('ga4',ambiente,{id:'G-TESTE03600',solicitarHomologacao:true}),preferencia:()=>({estatistica:true}),transporte:()=>calls++});
  assert.equal(await run({nome:'page_view',rota:'/'},uuid(6)),false);
 }
 for(const cfg of [null,config('ga4',{id:''}),config('ga4',{id:'email'}),config('ga4',{solicitarHomologacao:false}),{...config(),habilitado:true}]) {
  const run=m.criarEnsaioExterno({configuracao:()=>cfg,preferencia:()=>({estatistica:true}),transporte:()=>calls++});
  assert.equal(await run({nome:'page_view',rota:'/'},uuid(7)),false);
 }
 const run=m.criarEnsaioExterno({configuracao:()=>config(),preferencia:()=>{throw Error('indisponível')}});
 assert.equal(await run({nome:'page_view',rota:'/'},uuid(8)),false);assert.equal(calls,0);
});
test('adaptadores limitam rotas e eventos, sem dados livres ou Lead fictício',async()=>{
 const m=lib(),rows=[];
 for(const destino of ['ga4','meta']) {
  const run=m.criarEnsaioExterno({configuracao:()=>config(destino),preferencia:()=>({estatistica:true,marketing:true}),transporte:e=>rows.push(e)});
  let i=100;
  for(const rota of ['/conta','/convite/abc','/cupom/abc','/conversas','/radar','/anuncio/pessoal','/loja/pessoal','/categoria/pessoal','/busca','/?email=segredo','/#codigo','//outro']) assert.equal(await run({nome:'page_view',rota},uuid(i++)),false);
  for(const nome of ['search_completed','view_item','view_store','share','purchase','lead']) assert.equal(await run({nome,rota:'/'},uuid(i++)),false);
  for(const extra of [{email:'segredo'},{referrer:'segredo'},{faixa:'zero'},{codigo:'segredo'}]) assert.equal(await run({nome:'page_view',rota:'/',...extra},uuid(i++)),false);
  assert.equal(await run({nome:'page_view',rota:'/lojas'},uuid(i++)),true);
  assert.equal(await run({nome:'contact_intent',rota:'/lojas'},uuid(i++)),true);
 }
 assert.deepEqual(rows.map(e=>e.evento.name),['page_view','contact_intent','PageView','ContactIntent']);
 assert.deepEqual(rows[0].evento.params,{route_model:'/lojas',source:'interno',cohort:'consentida_v1'});
 assert.equal(rows[3].evento.metodo,'trackSingleCustom');assert.equal(rows[3].evento.eventID,rows[3].ocorrencia);
 assert.doesNotMatch(JSON.stringify(rows),/segredo|user_id|page_location|referrer|email/);
});
test('retirada bloqueia novos despachos enquanto uma requisição aceita termina',async()=>{
 const m=lib();let p={estatistica:true},resolver,calls=0;
 const run=m.criarEnsaioExterno({configuracao:()=>config(),preferencia:()=>p,transporte:()=>{calls++;return new Promise(r=>resolver=r)}});
 const pendente=run({nome:'page_view',rota:'/'},uuid(401));p={estatistica:false};
 assert.equal(await run({nome:'page_view',rota:'/lojas'},uuid(402)),false);resolver();
 assert.equal(await pendente,true);assert.equal(calls,1);
});
test('erros de configuração e preferência falham fechados sem chamar transporte',async()=>{
 const m=lib();let calls=0;
 for(const fontes of [{configuracao:()=>{throw Error('fonte indisponível')},preferencia:()=>({estatistica:true})},{configuracao:()=>config(),preferencia:()=>{throw Error('cookie bloqueado')}}]) {
  const run=m.criarEnsaioExterno({...fontes,transporte:()=>calls++});assert.equal(await run({nome:'page_view',rota:'/'},uuid(403)),false);
 }
 assert.equal(calls,0);
});
test('deduplica ocorrência, navegação e falha sem retry ou fila; A B A permanece válido',async()=>{
 const m=lib();let calls=0;
 const run=m.criarEnsaioExterno({configuracao:()=>config(),preferencia:()=>({estatistica:true}),transporte:async()=>{calls++;if(calls===1)throw Error('offline')}});
 assert.equal(await run({nome:'page_view',rota:'/'},uuid(200)),false);
 assert.equal(await run({nome:'page_view',rota:'/'},uuid(200)),false);
 assert.equal(await run({nome:'page_view',rota:'/'},uuid(201)),false);
 assert.equal(await run({nome:'page_view',rota:'/lojas'},uuid(202)),true);
 assert.equal(await run({nome:'page_view',rota:'/'},uuid(203)),true);
 assert.equal(calls,3);
});
test('ensaio não usa rede nem muda DESTINOS, mesmo com transporte ausente',async()=>{
 const m=lib();assert.deepEqual(carregar('src/lib/metricas/contrato.ts').DESTINOS,{ga4:false,meta:false});
 const previous=global.fetch;global.fetch=()=>{throw Error('rede proibida')};
 try {const run=m.criarEnsaioExterno({configuracao:()=>config(),preferencia:()=>({estatistica:true})});assert.equal(await run({nome:'page_view',rota:'/'},uuid(300)),false);}finally{global.fetch=previous;}
});
test('Admin mostra dois destinos sem prometer conta confirmada ou envio ativo',()=>{
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
 const {PreparacaoGa4}=carregar('src/app/admin/preparacao-ga4.tsx');
 const html=renderToStaticMarkup(React.createElement(PreparacaoGa4));
 assert.match(html,/Pixel ID Meta/);assert.match(html,/Preparar homologação/);
 assert.match(html,/não confirma/);assert.match(html,/não são salvos/);
 assert.equal((html.match(/não configurado/g)||[]).length,2);
 assert.doesNotMatch(html,/<script|<noscript|preconnect/);
});
