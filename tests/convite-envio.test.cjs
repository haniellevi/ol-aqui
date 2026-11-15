const { test } = require('node:test');
const assert = require('node:assert/strict');
const { carregar } = require('./carregar.cjs');
const loja='42000000-0000-4000-a000-000000000001', token='42000000-0000-4000-a000-000000000002';
function ambiente(op={}) {
  const chamadas=[];
  const a=carregar('src/app/(conta)/minha-conta/lojas/actions.ts', {
    'next/cache': { revalidatePath: () => {} },
    '@/lib/supabase/server': { createClient: async () => ({rpc: async(nome,args)=>{chamadas.push([nome,args]); return nome==='convidar_gerente_loja' ? {data:token,error:null} : nome==='minhas_lojas' ? {data:[{id:loja,dono:true,nome:'Loja Exemplo'}],error:null} : {data:op.permite!==false,error:null};}}) },
    '@/lib/telefone-regiao': { dddDaLoja: async()=> '89', numeroComRegiao: async()=> '5589999999999' },
    '@/lib/whatsapp/servico': { numeroWhatsapp:()=>true },
    '@/lib/whatsapp/envio': { configuracaoEnvio:()=>({}), enviarTexto:async(numero,texto,config,conferir)=>{ chamadas.push(['envio',numero,texto]); return await conferir() ? (op.resultado??'enviado') : 'recusado'; } },
  });
  return {a,chamadas};
}
test('convite é enviado pelo sistema ao número informado após conferir autorização',async()=>{
  const {a,chamadas}=ambiente(); const r=await a.convidarGerente(loja,null,new FormData());
  assert.equal(r.envio,'enviado');assert.equal(r.link,`/convite-loja?codigo=${token}`);
  assert.ok(chamadas.some(x=>x[0]==='envio' && x[1]==='5589999999999' && x[2].includes(r.link) && x[2].includes('Loja Exemplo')));
  assert.ok(chamadas.some(x=>x[0]==='convite_gerente_reservar_envio'));
});
test('envio incerto não anuncia sucesso e mantém o link para compartilhamento manual',async()=>{
  const {a}=ambiente({resultado:'incerto'});const r=await a.convidarGerente(loja,null,new FormData());
  assert.equal(r.envio,'incerto');assert.ok(r.link);
});
test('convite revogado ou bloqueado não é dado como enviado',async()=>{
  const {a}=ambiente({permite:false}); const r=await a.convidarGerente(loja,null,new FormData());
  assert.equal(r.envio,'recusado');assert.ok(r.link);
});
