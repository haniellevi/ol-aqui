const {test}=require('node:test');
const assert=require('node:assert/strict');
const {carregar}=require('./carregar.cjs');

// Banco de mentira: cada tabela devolve a linha que o teste mandar, sem rede.
function admin(tabelas){
 return {supabaseAdmin:()=>({from:(tabela)=>{
  const q={select(){return q;},eq(){return q;},maybeSingle:async()=>tabelas[tabela]??{data:null,error:null}};
  return q;
 }})};
}
const regiao=(c)=>carregar('src/lib/telefone-regiao.ts',{'@/lib/supabase/admin':admin(c)});

test('DDD da região vem de microrregioes.ddd e só vale se for DDD de verdade',async()=>{
 assert.equal(await regiao({microrregioes:{data:{ddd:'89'},error:null}}).dddDaRegiao('r1'),'89');
 assert.equal(await regiao({microrregioes:{data:{ddd:null},error:null}}).dddDaRegiao('r1'),null);
 assert.equal(await regiao({microrregioes:{data:{ddd:'10'},error:null}}).dddDaRegiao('r1'),null);
 assert.equal(await regiao({microrregioes:{data:null,error:{message:'x'}}}).dddDaRegiao('r1'),null);
 assert.equal(await regiao({}).dddDaRegiao(null),null);
});

test('DDD da pessoa e da loja passam pela região dela',async()=>{
 const c={perfis:{data:{microrregiao_id:'r1'},error:null},vitrines_lojas:{data:{microrregiao_id:'r1'},error:null},microrregioes:{data:{ddd:'89'},error:null}};
 assert.equal(await regiao(c).dddDoPerfil('user_a'),'89');
 assert.equal(await regiao(c).dddDaLoja('loja_a'),'89');
 assert.equal(await regiao({perfis:{data:null,error:null}}).dddDoPerfil('user_a'),null);
 assert.equal(await regiao({vitrines_lojas:{data:null,error:null}}).dddDaLoja('loja_a'),null);
 assert.equal(await regiao({}).dddDoPerfil(null),null);
});

test('sem acesso ao banco, não chuta DDD',async()=>{
 const ruim=carregar('src/lib/telefone-regiao.ts',{'@/lib/supabase/admin':{supabaseAdmin:()=>{throw new Error('sem chave');}}});
 assert.equal(await ruim.dddDaRegiao('r1'),null);
 assert.equal(await ruim.dddDoPerfil('user_a'),null);
 assert.equal(await ruim.dddDaLoja('loja_a'),null);
});
