const {test}=require('node:test');const assert=require('node:assert/strict');
const React=require('react');const {renderToStaticMarkup:render}=require('react-dom/server');const {carregar}=require('./carregar.cjs');
const {loja,produto}=require('./fixtures/loja.cjs');
const caminho='src/app/(publico)/loja/[slug]/';
const nav={notFound(){throw Error('404');}};
function dados(op={}) {let chamadas=[]; const banco={rpc:async(n,p)=>{chamadas.push([n,p]);if(op.rede)throw Error('offline');return {data:op.data,error:op.error??null};},from:()=>({select(){return this;},eq:async()=>({data:op.config??[],error:op.error??null})})};return {chamadas,...carregar('src/lib/dados/vitrine-completa.ts',{'@/lib/supabase/server':{createClient:async()=>banco},'@clerk/nextjs/server':{}})};}
function tela(op={}) {return carregar(caminho+'page.tsx',{'next/navigation':nav,'@/lib/dados/vitrine-completa':{vitrinePublica:async()=>{if(op.erroLoja)throw Error('interno');return op.v===null?null:{...loja,...op.v};},anunciosVitrine:async()=>{if(op.erroProdutos)throw Error('interno');return op.anuncios??[produto(1),produto(2),produto(3)];},anunciosPorPaginaVitrine:async()=>{if(op.erroConfig)throw Error('interno');return op.tamanho??2;}}});}
async function html(op={}) {return render(await tela(op).default({params:Promise.resolve({slug:'loja-teste'}),searchParams:Promise.resolve(op.sp??{})}));}
test('loja: leitura distingue inexistente de falha e rejeita resposta malformada',async()=>{
 assert.equal(await dados({data:null}).vitrinePublica('loja-teste'),null);
 for(const op of [{error:{}},{rede:true},{data:[]},{data:{...loja,total_anuncios:-1}},{data:{...loja,slug:'outra'}}]) await assert.rejects(dados(op).vitrinePublica('loja-teste'));
 const d=dados({data:loja});assert.equal((await d.vitrinePublica(' LOJA-TESTE ')).slug,'loja-teste');assert.equal(await d.vitrinePublica('../segredo'),null);assert.equal(d.chamadas.length,1);
});
test('loja: produtos validam identificador, ordem e página; erro não vira vazio',async()=>{
 for(const op of [{data:null},{error:{}},{rede:true},{data:[{id:'errado',na_pagina:true}]}]) await assert.rejects(dados(op).anunciosVitrine(loja.id));
 assert.deepEqual(await dados({data:[]}).anunciosVitrine(loja.id),[]);
 for(const args of [['x'],[loja.id,'x'],[loja.id,'recentes',0],[loja.id,'recentes',1001]]) await assert.rejects(dados({data:[]}).anunciosVitrine(...args));
 const d=dados({data:[produto(1)]});await d.anunciosVitrine(loja.id,'menor_preco',2);assert.deepEqual(d.chamadas[0][1],{p_vitrine_id:loja.id,p_ordem:'menor_preco',p_pagina:2});
});
test('loja: paginação usa configuração regional e não disfarça falha',async()=>{
 const config=[{microrregiao_id:null,valor:120},{microrregiao_id:loja.microrregiao_id,valor:'2,5'}];
 assert.equal(await dados({config}).anunciosPorPaginaVitrine(loja.microrregiao_id),3);assert.equal(await dados().anunciosPorPaginaVitrine(null),120);await assert.rejects(dados({error:{}}).anunciosPorPaginaVitrine(null));
});
test('loja: contato tem destino e texto corretos, copiar link e atalhos acessíveis',async()=>{
 const h=await html();const url=new URL(h.match(/href="(https:\/\/wa.me\/[^\"]+)"/)[1].replaceAll('&amp;','&'));
 assert.equal(url.pathname,'/5589999990002');assert.match(url.searchParams.get('text'),/https:\/\/mercadodaregiao.com.br\/loja\/loja-teste/);
 for(const t of ['Copiar link da loja','Informações da loja','Ver anúncios','Formas de pagamento','Como chegar','Instagram','Sobre nós','Faz entrega']) assert.ok(h.includes(t),t);
 assert.doesNotMatch(h,/Editar minha vitrine/);
});
test('loja: contato inválido e vitrine inativa não têm WhatsApp; prévia não oferece divulgação',async()=>{
 for(const whatsapp of [null,'','123','javascript:alert(1)']) {const h=await html({v:{whatsapp}});assert.doesNotMatch(h,/https:\/\/wa.me/);assert.match(h,/Contato por WhatsApp indisponível/);}
 const h=await html({v:{status:'suspensa',e_dono:true}});assert.match(h,/Editar minha vitrine/);assert.match(h,/Prévia da vitrine fora do ar/);assert.doesNotMatch(h,/https:\/\/wa.me|Copiar link da loja|https:\/\/instagram|google.com\/maps/);
});
test('loja: erro dos produtos mantém informações e contato, sem simular lista vazia',async()=>{
 for(const op of [{erroProdutos:true},{erroConfig:true}]) {const h=await html(op);assert.match(h,/Não conseguimos carregar os anúncios/);assert.match(h,/Tentar novamente/);assert.match(h,/Chamar no WhatsApp/);assert.doesNotMatch(h,/ainda não tem anúncio/);}
 assert.match(await html({erroLoja:true}),/Não conseguimos carregar a loja/);await assert.rejects(html({v:null}),/404/);
});
test('loja: estado vazio e página fora da faixa têm saídas úteis',async()=>{
 assert.match(await html({anuncios:[],v:{total_anuncios:0}}),/Esta loja ainda não tem anúncio no ar/);
 const h=await html({anuncios:[],sp:{pagina:'99',ordem:'menor_preco'}});assert.match(h,/Não tem mais produtos/);assert.match(h,/href="\/loja\/loja-teste\?ordem=menor_preco"/);
});
test('loja: menor preço preserva sequência global sem duplicar produtos das seções',async()=>{
 const a=[produto(1,{categoria_pai_nome:'Z'}),produto(2,{categoria_pai_nome:'A'}),produto(3,{na_pagina:false})];
 const h=await html({anuncios:a,sp:{ordem:'menor_preco'},v:{secoes:[{id:'secao',nome:'Seção de teste',anuncios:[a[2].id]}]}});
 assert.ok(h.indexOf('Produto de teste 1')<h.indexOf('Produto de teste 2'));assert.doesNotMatch(h,/Produto de teste 3|Seção de teste/);assert.match(h,/Do menor para o maior preço/);assert.match(h,/ordem=menor_preco&amp;pagina=2/);
});
test('loja: vitrine padrão preserva fixados, seções fora da página e categorias',async()=>{
 const a=[produto(1,{fixado:1}),produto(2),produto(3,{na_pagina:false})];const h=await html({anuncios:a,v:{secoes:[{id:'secao',nome:'Escolhas da loja',anuncios:[a[2].id]}]}});
 for(const t of ['Destaques da loja','Escolhas da loja','Produto de teste 1','Produto de teste 2','Produto de teste 3','Casa'])assert.ok(h.includes(t),t);
 const segunda=await html({anuncios:[produto(2)],sp:{pagina:'2'}});assert.doesNotMatch(segunda,/Destaques da loja|Escolhas da loja/);assert.match(segunda,/Página anterior/);
});
test('loja: metadados privados omitem nome, imagem e contato',async()=>{
 const p=await tela({v:{status:'suspensa',nome:'Nome privado'}}).generateMetadata({params:Promise.resolve({slug:'loja-teste'})});assert.equal(p.robots.index,false);assert.ok(!JSON.stringify(p).includes('Nome privado'));assert.equal(p.openGraph,undefined);
 const ok=await tela().generateMetadata({params:Promise.resolve({slug:'loja-teste'})});assert.equal(ok.alternates.canonical,'/loja/loja-teste');
});
test('loja: imagem nunca usa cache público; inativa/ausente é 404 e falha é 503',async()=>{
 for(const [v,status] of [[loja,200],[{...loja,status:'suspensa',e_dono:true},404],[null,404],['erro',503]]) {
 const {GET}=carregar(caminho+'imagem/route.tsx',{'@/lib/dados/vitrine-completa':{vitrinePublica:async()=>{if(v==='erro')throw Error('interno');return v;}},'next/og':{ImageResponse:class extends Response {constructor(_,op){super('imagem',op);}}}});
 const r=await GET(new Request('http://localhost'),{params:Promise.resolve({slug:'loja-teste'})});assert.equal(r.status,status);assert.equal(r.headers.get('cache-control'),'private, no-store');
 }
});
test('loja: horários, mapas e Instagram usam destinos seguros e limites válidos',()=>{
 const r=carregar('src/components/vitrine/regras.ts');assert.equal(r.situacaoAgora(loja.horarios,new Date('2026-11-09T14:00:00Z')).aberto,true);assert.equal(r.situacaoAgora(loja.horarios,new Date('2026-11-09T16:00:00Z')).aberto,false);
 assert.equal(r.linkComoChegar({lat:91,lng:0,endereco:null}),null);assert.match(r.linkComoChegar({lat:0,lng:0,endereco:null}),/destination=0,0$/);assert.equal(r.linkInstagram('javascript:alert(1)'),null);
});
