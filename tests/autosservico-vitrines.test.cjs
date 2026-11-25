const test = require('node:test');
const assert = require('node:assert/strict');
const { carregar } = require('./carregar.cjs');
const id = '11111111-1111-4111-8111-111111111111';
function acoes(userId, rpc) {
 return carregar('src/app/(conta)/minha-conta/lojas/autosservico-actions.ts', {
  '@clerk/nextjs/server': { auth: async () => ({ userId }) },
  '@/lib/supabase/server': { createClient: async () => ({ rpc }) },
  'next/cache': { revalidatePath() {} },
  'next/headers': { cookies: async () => ({ delete() {} }) },
 });
}
test('autosserviço exige login e identificador válido antes de chamar banco', async () => {
 const rpc = () => { throw Error('não deve chamar'); };
 assert.ok((await acoes(null, rpc).sairDaLoja(id)).erro);
 assert.ok((await acoes('pessoa', rpc).sairDaLoja('inválido')).erro);
 assert.ok((await acoes('pessoa', rpc).descartarLojaIa(id, -1)).erro);
});
test('saída e descarte usam RPC do usuário e devolvem feedback sem expor falha interna', async () => {
 const chamadas=[];
 const a=acoes('pessoa', async (nome,args) => { chamadas.push([nome,args]); return {data:true,error:null}; });
 assert.deepEqual(await a.sairDaLoja(id), {ok:true});
 assert.deepEqual(await a.descartarLojaIa(id,3), {ok:true});
 assert.deepEqual(chamadas,[['sair_da_loja',{p_loja:id}],['loja_ia_descartar',{p_id:id,p_revisao:3}]]);
 const b=acoes('pessoa',async()=>({error:{code:'XX000',message:'segredo'}}));
 assert.ok(!(await b.sairDaLoja(id)).erro.includes('segredo'));
});
