const { test } = require('node:test');
const assert = require('node:assert/strict');
const { carregar } = require('./carregar.cjs');
function contexto(error = null) {
  const chamadas = [];
  const actions = carregar('src/app/admin/compliance/retencoes-actions.ts', {
    '@/lib/admin/auth': { exigirAdmin: async () => ({ supabase: { rpc: async (nome, args) => {
      chamadas.push({ nome, args }); return { data: '00000000-0000-4000-a000-000000000001', error };
    } } }) },
    'next/cache': { revalidatePath() {} },
    'next/navigation': { unstable_rethrow() {} },
  });
  const form = new FormData();
  for (const [k,v] of Object.entries({consulta:'00000000-0000-4000-a000-000000000001',id:'00000000-0000-4000-a000-000000000002',tipo:'anuncio',motivo:'  Ofício sintético concluído  ',acao:'liberar'})) form.set(k,v);
  return { actions, chamadas, form };
}
test('liberação valida entrada e entrega motivo normalizado à transação autenticada', async () => {
  const { actions, chamadas, form } = contexto();
  assert.ok((await actions.registrarRetencao(null,form)).ok);
  assert.equal(chamadas[0].nome,'compliance_liberar_retencao');
  assert.equal(chamadas[0].args.p_motivo,'Ofício sintético concluído');
});
test('entrada inválida não registra liberação', async () => {
  for (const [k,v] of [['id','x'],['tipo','conta'],['motivo',' '],['acao','apagar'],['consulta','x']]) {
    const { actions, chamadas, form } = contexto(); form.set(k,v);
    assert.ok((await actions.registrarRetencao(null,form)).erro); assert.equal(chamadas.length,0);
  }
});
test('erro do banco não devolve sucesso', async () => {
  const { actions,form } = contexto({message:'Falha sintética',code:'55000'});
  assert.ok((await actions.registrarRetencao(null,form)).erro);
});
