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

test('cidade com DDD diferente do da região não recebe o DDD da região (a tela pede o DDD)',async()=>{
 const formosa={perfis:{data:{microrregiao_id:'r1',cidade:'Formosa do Rio Preto'},error:null},microrregioes:{data:{ddd:'89'},error:null},cidades:{data:{ddd:'77'},error:null}};
 assert.equal(await regiao(formosa).dddDoPerfil('user_a'),null);
 const corrente={perfis:{data:{microrregiao_id:'r1',cidade:'Corrente'},error:null},microrregioes:{data:{ddd:'89'},error:null},cidades:{data:{ddd:'89'},error:null}};
 assert.equal(await regiao(corrente).dddDoPerfil('user_a'),'89');
 assert.equal(await regiao({perfis:{data:{microrregiao_id:'r1',cidade:'Corrente'},error:null},microrregioes:{data:{ddd:'89'},error:null}}).dddDoPerfil('user_a'),'89');
 assert.equal(await regiao({perfis:{data:{microrregiao_id:'r1',cidade:'Corrente'},error:null},microrregioes:{data:{ddd:'89'},error:null},cidades:{data:null,error:{message:'x'}}}).dddDoPerfil('user_a'),null);
 const loja={vitrines_lojas:{data:{microrregiao_id:'r1',cidade:'Barreiras'},error:null},microrregioes:{data:{ddd:'89'},error:null},cidades:{data:{ddd:'77'},error:null}};
 assert.equal(await regiao(loja).dddDaLoja('loja_a'),null);
});

test('número sem DDD: com DDD não consulta a região; sem DDD usa a da região; sem região não chuta',async()=>{
 const T=carregar('src/lib/telefone.ts');
 const r=carregar('src/lib/telefone-regiao.ts',{'@/lib/supabase/admin':admin({})});
 const normalizar=(entrada,ddd)=>T.numeroTelefone(entrada,{ddd,aceitaFixo:false});
 let consultas=0;
 const regiao89=async()=>{consultas++;return '89';};
 assert.equal(await r.numeroComRegiao('(89) 99999-0000',regiao89,normalizar),'5589999990000');
 assert.equal(await r.numeroComRegiao('89 99999 0000',regiao89,normalizar),'5589999990000');
 assert.equal(consultas,0);
 assert.equal(await r.numeroComRegiao('9999-0000',regiao89,normalizar),'5589999990000');
 assert.equal(await r.numeroComRegiao('99999-0000',regiao89,normalizar),'5589999990000');
 assert.equal(consultas,2);
 assert.equal(await r.numeroComRegiao('9999-0000',async()=>null,normalizar),null);
 assert.equal(await r.numeroComRegiao(null,regiao89,normalizar),null);
 assert.equal(await r.numeroComRegiao(12345,regiao89,normalizar),null);
 assert.equal(await r.numeroComRegiao('1234',regiao89,normalizar),null);
});

test('fixo sem DDD só vale quando a tela aceita fixo',async()=>{
 const T=carregar('src/lib/telefone.ts');
 const r=carregar('src/lib/telefone-regiao.ts',{'@/lib/supabase/admin':admin({})});
 const normalizar=(entrada,ddd)=>T.numeroTelefone(entrada,{ddd,aceitaFixo:true});
 assert.equal(await r.numeroComRegiao('3333-4444',async()=>'89',normalizar,false),null);
 assert.equal(await r.numeroComRegiao('3333-4444',async()=>'89',normalizar,true),'558933334444');
 assert.equal(await r.numeroComRegiao('3333-4444',async()=>null,normalizar,true),null);
});

test('número guardado: ehTelefoneGuardado aceita só 55 + DDD + número do formato do banco',()=>{
 const T=carregar('src/lib/telefone.ts');
 assert.equal(T.ehTelefoneGuardado('5589999990000'),true);
 assert.equal(T.ehTelefoneGuardado('558933334444'),true);
 assert.equal(T.ehTelefoneGuardado('89999990000'),false);
 assert.equal(T.ehTelefoneGuardado(null),false);
 assert.equal(T.ehTelefoneGuardado(undefined),false);
 assert.equal(T.ehTelefoneGuardado(5589999990000),false);
});

