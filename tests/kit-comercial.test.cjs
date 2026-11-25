const {test}=require('node:test');
const assert=require('node:assert/strict');
const {carregar}=require('./carregar.cjs');
const {renderToStaticMarkup:render}=require('react-dom/server');

test('kit mostra link canônico, arte da loja, QR local e impressão sem telefone privado',()=>{
 const {KitLoja}=carregar('src/components/marketing/kit-loja.tsx');
 const html=render(require("react").createElement(KitLoja,{nome:'Casa Exemplo',slug:'casa-exemplo',cidade:'Corrente',logo:null,capa:null}));
 for(const texto of ['Casa Exemplo','/loja/casa-exemplo','Copiar link','Compartilhar','Baixar arte da loja','Imprimir','QR']) assert.ok(html.includes(texto),texto);
 assert.doesNotMatch(html,/wa.me|telefone|undefined/);
});
test('kit sem nome ou logo mantém identidade textual e preview',()=>{
 const {KitLoja}=carregar('src/components/marketing/kit-loja.tsx');
 const html=render(require("react").createElement(KitLoja,{nome:'',slug:'casa-exemplo',cidade:'Corrente',logo:null,capa:null}));
 assert.match(html,/Minha loja/); assert.doesNotMatch(html,/<img[^>]+src=""/);
});
test('busca da vitrine consulta catálogo inteiro no servidor com termo normalizado',async()=>{
 const chamadas=[];
 const {buscarProdutosVitrine}=carregar('src/lib/dados/busca-vitrine.ts',{'@/lib/supabase/server':{createClient:async()=>({rpc:async(...args)=>{chamadas.push(args);return {data:[],error:null}}})},'@/lib/dados/cards-extra':{completarCards:async a=>a}});
 assert.deepEqual(await buscarProdutosVitrine('71000000-0000-4000-a000-000000000001','  sofá  ','recentes',2),[]);
 assert.equal(chamadas[0][0],'buscar_produtos_vitrine');assert.equal(chamadas[0][1].p_busca,'sofá');assert.equal(chamadas[0][1].p_pagina,2);
});
