const {test}=require('node:test');
const assert=require('node:assert/strict');
const {carregar}=require('./carregar.cjs');
test('GA4 permanece desligado; simulador exige finalidade, ambiente e ocorrência válida',()=>{
 const g=carregar('src/lib/metricas/ga4.ts');
 assert.equal(g.configuracaoGa4('', 'producao').status,'nao_configurado');
 assert.equal(g.configuracaoGa4('G-TESTE911','producao').habilitado,false);
 assert.equal(g.configuracaoGa4('email@teste.invalid','producao').status,'invalido');
 const rows=[],sim=g.criarSimuladorGa4(e=>rows.push(e));
 const cfg=g.configuracaoGa4('G-TESTE911','simulacao');
 const evt={nome:'page_view',rota:'/loja/exemplo?q=segredo#token'};
 const id='91100000-0000-4000-a000-000000000001';
 assert.equal(sim(cfg,{estatistica:false,marketing:true},evt,id),false);
 assert.equal(sim(g.configuracaoGa4('G-TESTE911','producao'),{estatistica:true},evt,id),false);
 assert.equal(rows.length,0);
 assert.equal(sim(cfg,{estatistica:true},evt,id),true);
 assert.equal(sim(cfg,{estatistica:true},evt,id),false);
 assert.equal(rows.length,1);
 assert.deepEqual(rows[0],{name:'page_view',params:{route_model:'/loja/:loja',source:'interno',cohort:'consentida_v1'}});
 assert.equal(sim(cfg,{estatistica:true},{...evt,email:'segredo'},id.replace(/1$/,'2')),false);
 assert.equal(sim(cfg,{estatistica:true},{nome:'page_view',rota:'/minha-conta'},id.replace(/1$/,'3')),false);
 assert.equal(sim(cfg,{estatistica:true},evt,'sentinela'),false);
});
test('links e QR usam somente origem ativa na allowlist e destinos do gerador',()=>{
 const {linkComOrigem}=carregar('src/lib/metricas/links.ts');
 assert.equal(linkComOrigem('https://teste.invalid','/lojas','radio',['radio']),'https://teste.invalid/lojas?origem=radio');
 for(const [path,origin,active] of [['/lojas','email@teste.invalid',['email@teste.invalid']],['/lojas','radio',[]],['//outro.invalid','radio',['radio']],['/lojas?q=segredo','radio',['radio']],['/minha-conta','radio',['radio']]]) assert.equal(linkComOrigem('https://teste.invalid',path,origin,active),'');
});
test('simulador não tenta reenviar ocorrência cujo transporte lançou exceção',()=>{
 const g=carregar('src/lib/metricas/ga4.ts');let tentativas=0;
 const sim=g.criarSimuladorGa4(()=>{tentativas++;throw Error('falha sintética')});
 const run=()=>sim(g.configuracaoGa4('G-TESTE911','simulacao'),{estatistica:true},{nome:'page_view',rota:'/'},'91100000-0000-4000-a000-000000000006');
 assert.equal(run(),false);assert.equal(run(),false);assert.equal(tentativas,1);
});
test('intervalos equivalentes e base zero não criam crescimento fictício',()=>{
 const a=carregar('src/lib/admin/lancamento.ts');
 const r=a.periodoLancamento({dias:'7'},'2026-11-25');
 assert.deepEqual(r,{de:'2026-11-19',ate:'2026-11-25',anteriorDe:'2026-11-12',anteriorAte:'2026-11-18',aviso:null});
 assert.equal(a.variacao(3,0),'Sem base anterior');
 assert.equal(a.variacao(0,0),'Sem base anterior');
 assert.equal(a.variacao(6,3),'+100%');
 assert.equal(a.periodoLancamento({dias:'30'},'2026-11-25').de,'2026-10-27');
 assert.equal(a.periodoLancamento({dias:'90'},'2026-11-25').de,'2026-08-28');
 assert.ok(a.periodoLancamento({de:'2026-02-31',ate:'2026-11-25'},'2026-11-25').aviso);
});
test('leitura rejeita falha/malformação e preserva base zero válida',()=>{
 const a=carregar('src/lib/admin/lancamento.ts'),{lancamento}=require('./fixtures/lancamento.cjs');
 assert.equal(a.lerLancamento(null),null);
 assert.equal(a.lerLancamento({...lancamento,oferta:{}}),null);
 assert.equal(a.lerLancamento(lancamento).medicao.sessoes,15);
 assert.equal(a.lerLancamento({...lancamento,medicao:{...lancamento.medicao,pageviews:-1}}),null);
});
test('painel diferencia contatos, vendas, pagamentos e indisponibilidade, sem criar zero por erro',()=>{
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
 const {lancamento}=require('./fixtures/lancamento.cjs');
 const {PainelLancamento}=carregar('src/app/admin/painel-lancamento.tsx',{'next/link':{__esModule:true,default:({children,...p})=>React.createElement('a',p,children)},'./preparacao-ga4':{PreparacaoGa4:()=>null}});
 const periodo={de:'2026-11-19',ate:'2026-11-25',anteriorDe:'2026-11-12',anteriorAte:'2026-11-18',aviso:null};
 const html=renderToStaticMarkup(React.createElement(PainelLancamento,{atual:lancamento,anterior:lancamento,periodo}));
 assert.match(html,/Contatos observados/);assert.match(html,/Vendas declaradas/);assert.match(html,/Recebimentos confirmados/);
 assert.match(html,/10 lojas/);assert.match(html,/48 horas/);assert.match(html,/24 horas/);
 assert.match(html,/sem anúncio/);assert.match(html,/Corrente/);assert.match(html,/coorte/);
 assert.match(html,/Período aberto/);
 const erro=renderToStaticMarkup(React.createElement(PainelLancamento,{atual:null,anterior:null,periodo}));
 assert.match(erro,/indisponíveis/);assert.doesNotMatch(erro,/Recebimentos confirmados/);
 const misto=renderToStaticMarkup(React.createElement(PainelLancamento,{atual:{...lancamento,corte:'2026-11-20T12:00:00Z'},anterior:lancamento,periodo}));
 assert.match(misto,/Comparação de tráfego indisponível/);
 const fechado=renderToStaticMarkup(React.createElement(PainelLancamento,{atual:lancamento,anterior:lancamento,periodo:{...periodo,ate:'2026-11-24'}}));
 assert.doesNotMatch(fechado,/Período aberto/);assert.match(fechado,/0% ante período anterior/);
});
test('Resultados preserva acesso por papel, consulta duas janelas e mantém atual quando anterior falha',async()=>{
 const {lancamento}=require('./fixtures/lancamento.cjs');
 let papel='suporte',calls=[];
 const page=carregar('src/app/admin/page.tsx',{
  'next/navigation':{redirect:p=>{throw Error('redirect:'+p)}},
  '@/lib/admin/equipe':{exigirEquipe:async()=>({papel,supabase:{rpc:async(name,args)=>{calls.push({name,args});return calls.length===1?{data:lancamento,error:null}:{data:null,error:{message:'offline'}}}}})},
  './estatisticas':{Estatisticas:()=>null},'./painel-lancamento':{PainelLancamento:()=>null}
 });
 await assert.rejects(()=>page.default({searchParams:Promise.resolve({dias:'7'})}),/redirect:\/admin\/lojas/);
 assert.equal(calls.length,0);
 papel='administrador';const tree=await page.default({searchParams:Promise.resolve({dias:'7'})});
 assert.equal(calls.length,2);assert.equal(calls[0].name,'admin_lancamento');
 assert.ok(tree.props.children[1].props.atual);assert.equal(tree.props.children[1].props.anterior,null);
});
