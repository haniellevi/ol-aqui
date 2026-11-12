const test=require('node:test');const assert=require('node:assert/strict');
const React=require('react');const {renderToStaticMarkup:render}=require('react-dom/server');const {carregar}=require('./carregar.cjs');
const id='85000000-0000-4000-a000-000000000001';
const linha={anuncio_id:id,criado_em:'2026-11-09T12:00:00Z',anuncios:{id,titulo:'Mesa de teste',preco_centavos:150050,cidade:'Corrente',fotos:['/icone-192.png'],status:'ativo',destaque_ate:null,publicado_em:null,criado_em:'2026-11-01T12:00:00Z',vitrines_lojas:{nome:'Pessoa Sobrenome',tipo:'pf',selo_loja_verificada:false,status:'ativa'}}};
function leitura(op={}) {
 const chamadas=[];const q={select(...a){chamadas.push(['select',...a]);return this;},eq(...a){chamadas.push(['eq',...a]);return this;},order(...a){chamadas.push(['order',...a]);return this;},range(...a){chamadas.push(['range',...a]);return this;},async maybeSingle(){if(op.rede)throw Error('offline');return {data:op.single??null,error:op.erro??null};},then(a,b){return (op.rede?Promise.reject(Error('offline')):Promise.resolve({data:op.data===undefined?[linha]:op.data,count:op.count===undefined?1:op.count,error:op.erro??null})).then(a,b);}};
 const a=carregar('src/lib/dados/favoritos.ts',{'@clerk/nextjs/server':{auth:async()=>({userId:op.semLogin?null:'user_a'})},'@/lib/supabase/server':{createClient:async()=>({from(t){chamadas.push(['from',t]);return q;}})}});
 return {a,chamadas};
}
test('favoritos: consulta só a conta atual, pagina 24 e mantém ordem estável',async()=>{
 const {a,chamadas}=leitura({count:250});const r=await a.meusFavoritos(10);assert.equal(r.total,250);assert.equal(r.itens[0].anuncio.preco_centavos,150050);assert.equal(r.itens[0].anuncio.vitrine_nome,'Pessoa');
 assert.ok(chamadas.some(c=>c[0]==='eq'&&c[1]==='usuario_id'&&c[2]==='user_a'));
 assert.deepEqual(chamadas.find(c=>c[0]==='range'),['range',216,239]);
 assert.deepEqual(chamadas.filter(c=>c[0]==='order').map(c=>c[1]),['criado_em','anuncio_id']);
});
test('favoritos: sessão ausente e páginas inválidas não consultam o banco',async()=>{
 const a=leitura({semLogin:true});await assert.rejects(a.a.meusFavoritos());assert.deepEqual(a.chamadas,[]);
 for(const p of [0,-1,1.2,NaN,'1',100001]) {const a=leitura();await assert.rejects(a.a.meusFavoritos(p));assert.deepEqual(a.chamadas,[]);}
});
test('favoritos: falha, resposta malformada ou contagem desconhecida não viram lista vazia',async()=>{
 for(const o of [{erro:{message:'privado'}},{rede:true},{data:null},{data:{}},{count:null},{count:-1},{count:'1'},{data:[{...linha,anuncio_id:'errado'}]}]) await assert.rejects(leitura(o).a.meusFavoritos());
 assert.deepEqual(await leitura({data:[],count:0}).a.meusFavoritos(),{itens:[],total:0});
});
test('favoritos: anúncios vendidos ainda abrem; privados não expõem títulos, fotos ou vendedores',async()=>{
 const vendido={...linha,anuncios:{...linha.anuncios,status:'vendido',destaque_ate:'2099-01-01'}};
 const r=await leitura({data:[vendido]}).a.meusFavoritos();assert.equal(r.itens[0].situacao,'vendido');assert.equal(r.itens[0].anuncio.destaque,false);
 for(const anuncios of [null,...['rascunho','pausado','expirado','excluido','congelado','em_analise'].map(status=>({...linha.anuncios,status})),{...linha.anuncios,vitrines_lojas:null},{...linha.anuncios,vitrines_lojas:{...linha.anuncios.vitrines_lojas,status:'suspensa'}}]) {
  const r=await leitura({data:[{...linha,anuncios}]}).a.meusFavoritos();assert.equal(r.itens[0].anuncio,null);assert.equal(r.itens[0].situacao,'indisponivel');assert.ok(!JSON.stringify(r).includes('Mesa de teste'));
 }
});
test('favoritos: estado salvo distingue erro de ausência e valida identidade do anúncio',async()=>{
 assert.equal(await leitura().a.ehFavorito(id,'user_a'),false);assert.equal(await leitura({single:{anuncio_id:id}}).a.ehFavorito(id,'user_a'),true);
 for(const o of [{rede:true},{erro:{message:'falha'}},{single:{anuncio_id:'outro'}}]) await assert.rejects(leitura(o).a.ehFavorito(id,'user_a'));
 const b=leitura();assert.equal(await b.a.ehFavorito(id,null),false);assert.deepEqual(b.chamadas,[]);
});
function acao(op={}) {
 const chamadas=[];let salvo=op.salvo??false;
 const q={async insert(v){chamadas.push(['insert',v]);if(op.rede)throw Error('offline');if(!op.erro)salvo=true;return {error:op.erro??null};},delete(){chamadas.push(['delete']);return this;},eq(...a){chamadas.push(['eq',...a]);return this;},then(a,b){if(!op.erro)salvo=false;return (op.rede?Promise.reject(Error('offline')):Promise.resolve({error:op.erro??null})).then(a,b);}};
 const a=carregar('src/app/(conta)/minha-conta/favoritos/actions.ts',{'@clerk/nextjs/server':{auth:async()=>({userId:op.semLogin?null:'user_a'})},'@/lib/perfil':{garantirPerfil:async()=>chamadas.push(['perfil'])},'@/lib/supabase/server':{createClient:async()=>({from:()=>q})},'@/lib/dados/favoritos':{ehFavorito:async(...args)=>{chamadas.push(['ler',...args]);if(op.erroLeitura)throw Error('offline');return op.divergente?!salvo:salvo;}},'next/cache':{revalidatePath:(...a)=>chamadas.push(['cache',...a])}});
 return {a,chamadas};
}
test('favoritos: ações exigem sessão, UUID e booleano',async()=>{
 for(const [identificador,salvar] of [['x',true],[id,'true'],[null,false]]) {const b=acao();assert.equal((await b.a.definirFavorito(identificador,salvar)).ok,false);assert.deepEqual(b.chamadas,[]);}
 const b=acao({semLogin:true});assert.equal((await b.a.definirFavorito(id,true)).erro.codigo,'28000');assert.equal((await b.a.removerFavorito(id)).ok,false);assert.deepEqual(b.chamadas,[]);
});
test('favoritos: salvar usa identidade da sessão e invalida lista e detalhe',async()=>{
 const {a,chamadas}=acao();assert.deepEqual(await a.definirFavorito(id,true,'user_outro'),{ok:true,dados:{favorito:true}});
 assert.deepEqual(chamadas.find(c=>c[0]==='insert'),['insert',{usuario_id:'user_a',anuncio_id:id}]);
 assert.deepEqual(chamadas.find(c=>c[0]==='ler'),['ler',id,'user_a']);
 assert.deepEqual(chamadas.filter(c=>c[0]==='cache'),[['cache','/minha-conta/favoritos'],['cache','/anuncio/[idslug]','page']]);
});
test('favoritos: salvar repetido aceita conflito apenas depois de confirmar o registro',async()=>{
 assert.equal((await acao({salvo:true,erro:{code:'23505'}}).a.definirFavorito(id,true)).ok,true);
 assert.equal((await acao({erro:{code:'23505'}}).a.definirFavorito(id,true)).ok,false);
});
test('favoritos: remover filtra proprietário e anúncio; repetição mantém sucesso',async()=>{
 const {a,chamadas}=acao({salvo:true});assert.equal((await a.removerFavorito(id)).ok,true);assert.equal((await a.removerFavorito(id)).ok,true);
 for(const par of [['usuario_id','user_a'],['anuncio_id',id]]) assert.ok(chamadas.some(c=>JSON.stringify(c)===JSON.stringify(['eq',...par])));
 assert.equal(chamadas.some(c=>c[0]==='perfil'),false);
});
test('favoritos: sem confirmação ou com falha não mostra sucesso nem detalhes internos',async()=>{
 for(const o of [{rede:true},{erroLeitura:true},{divergente:true},{erro:{code:'42501',message:'SQL privado'}},{erro:{code:'23503'}},{erro:{code:'XX000'}}]) {
  const b=acao(o);const r=await b.a.definirFavorito(id,true);assert.equal(r.ok,false);assert.ok(!r.erro.mensagem.includes('SQL'));assert.equal(b.chamadas.some(c=>c[0]==='cache'),false);
 }
 assert.equal((await acao({erro:{code:'XX000'}}).a.removerFavorito(id)).ok,false);
});
const nav={useRouter:()=>({refresh(){},push(){}}),redirect:url=>{throw Error('redirect:'+url);}};
async function pagina(op={}) {const l=await leitura({data:op.data??[linha],count:op.total??1}).a.meusFavoritos();const {default:Page}=carregar('src/app/(conta)/minha-conta/favoritos/page.tsx',{'next/navigation':nav,'@/lib/dados/favoritos':{FAVORITOS_POR_PAGINA:24,meusFavoritos:async()=>{if(op.erro)throw Error('offline');return l;}},'@/app/(conta)/minha-conta/favoritos/actions':{},'@/lib/dados/conta':{meuPerfilEVitrine:async()=>op.semConta?null:({perfil:{microrregiao_id:'regiao-1'}})},'@/lib/dados/vitrine-completa':{vitrineNovaAtiva:async(r)=>{if(op.radar==='erro')throw Error('offline');return op.radar===true&&r==='regiao-1';}}});return render(await Page({searchParams:Promise.resolve({pagina:op.pagina??'1'})}));}
test('favoritos: página exibe erro recuperável diferente do vazio real',async()=>{
 assert.match(await pagina({erro:true}),/Não conseguimos carregar seus favoritos/);assert.doesNotMatch(await pagina({erro:true}),/Você ainda não tem favoritos/);
 const vazio=await pagina({data:[],total:0});assert.match(vazio,/Você ainda não tem favoritos/);assert.match(vazio,/Encontrar anúncios/);
});
test('favoritos: card tem link canônico, remoção separada e paginação',async()=>{
 const html=await pagina({total:250});assert.match(html,/250 anúncios salvos/);assert.match(html,/Página 1 de 11/);assert.match(html,/pagina=2/);assert.match(html,new RegExp('/anuncio/'+id+'-mesa-de-teste'));assert.match(html,/Remover/);
 await assert.rejects(pagina({data:[],total:24,pagina:'2'}),/redirect:\/minha-conta\/favoritos\?pagina=1/);
});
test('favoritos: anúncio fora do ar não recebe link de detalhe',async()=>{
 const html=await pagina({data:[{...linha,anuncios:null}]});assert.match(html,/Anúncio indisponível/);assert.doesNotMatch(html,/href="\/anuncio\//);assert.match(html,/Remover/);
});
test('favoritos: link do Radar leva título e categoria; fora do ar vai sem título',async()=>{
 const comCat={...linha,anuncios:{...linha.anuncios,titulo:'Mesa & cadeiras',categorias:{slug:'moveis'}}};
 let r=await leitura({data:[comCat]}).a.meusFavoritos();assert.equal(r.itens[0].radar,'/radar/pedir?q=Mesa%20%26%20cadeiras&categoria=moveis');
 r=await leitura({data:[{...linha,anuncios:{...linha.anuncios,categorias:{slug:'x" onload'}}}]}).a.meusFavoritos();assert.equal(r.itens[0].radar,'/radar/pedir?q=Mesa%20de%20teste');
 r=await leitura({data:[{...comCat,anuncios:{...comCat.anuncios,status:'pausado'}}]}).a.meusFavoritos();assert.equal(r.itens[0].radar,'/radar/pedir');
 const l=leitura();await l.a.meusFavoritos();assert.match(l.chamadas.find(c=>c[0]==='select')[1],/categorias!anuncios_categoria_id_fkey\(slug\)/);
});
test('favoritos: botão do Radar só com a vitrine nova ligada',async()=>{
 const desligada=await pagina();assert.doesNotMatch(desligada,/radar\/pedir|Estou procurando/);
 assert.doesNotMatch(await pagina({radar:'erro'}),/radar\/pedir|Estou procurando/);
 assert.doesNotMatch(await pagina({radar:true,semConta:true}),/radar\/pedir|Estou procurando/);
 const ligada=await pagina({radar:true});assert.match(ligada,/>Estou procurando…</);assert.match(ligada,/aria-label="Estou procurando algo parecido com Mesa de teste"/);assert.match(ligada,/href="\/radar\/pedir\?q=Mesa%20de%20teste"/);
 const fora=await pagina({radar:true,data:[{...linha,anuncios:null}]});assert.match(fora,/href="\/radar\/pedir"/);assert.match(fora,/aria-label="Estou procurando algo parecido"/);assert.match(fora,/Peça parecido no Radar/);
});
test('anúncio: estado desconhecido bloqueia alteração e oferece consulta novamente',()=>{
 const {BarraContato}=carregar('src/app/(publico)/anuncio/[idslug]/barra-contato.tsx',{'next/navigation':nav,'./actions':{}});
 const html=render(React.createElement(BarraContato,{anuncioId:id,favoritoInicial:null,podeFavoritar:true,logado:true,whatsappHref:null,entrarHref:'/entrar'}));
 assert.match(html,/Não conseguimos consultar seu favorito/);assert.match(html,/Tentar novamente/);assert.match(html,/Ver meus favoritos/);assert.match(html,/disabled=""/);assert.doesNotMatch(html,/aria-label="Salvar nos favoritos"/);
});
