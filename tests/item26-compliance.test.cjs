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
  for (const [k,v] of Object.entries({consulta:'00000000-0000-4000-a000-000000000001',id:'00000000-0000-4000-a000-000000000002',tipo:'anuncio',retencao:'42',motivo:'  Ofício sintético concluído  ',acao:'liberar'})) form.set(k,v);
  return { actions, chamadas, form };
}
test('liberação valida entrada e entrega motivo normalizado à transação autenticada', async () => {
  const { actions, chamadas, form } = contexto();
  assert.ok((await actions.registrarRetencao(null,form)).ok);
  assert.equal(chamadas[0].nome,'compliance_liberar_retencao');
  assert.equal(chamadas[0].args.p_motivo,'Ofício sintético concluído');
  assert.equal(chamadas[0].args.p_retencao,'42');
});
test('entrada inválida não registra liberação', async () => {
  for (const [k,v] of [['id','x'],['tipo','conta'],['motivo',' '],['acao','apagar'],['consulta','x'],['retencao',''],['retencao','42x']]) {
    const { actions, chamadas, form } = contexto(); form.set(k,v);
    assert.ok((await actions.registrarRetencao(null,form)).erro); assert.equal(chamadas.length,0);
  }
});
test('erro do banco não devolve sucesso', async () => {
  const { actions,form } = contexto({message:'Falha sintética',code:'55000'});
  assert.ok((await actions.registrarRetencao(null,form)).erro);
});
test('confirmação distingue item e retenção com motivo próprio; fila exibe os mesmos dados', () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  let pedido;
  const { RevisaoRetencao } = carregar('src/app/admin/compliance/retencoes.tsx', {
    './retencoes-actions': {},
    '@/components/admin/form-gestao': { useGestaoForm: () => [null,()=>{},false] },
    '@/components/ui/confirmar': { useConfirmar: () => ()=>{}, confirmarAntes: (_,p) => {pedido=p; return ()=>{};} },
  });
  const item = {tipo:'anuncio',id:'00000000-0000-4000-a000-000000000002',titulo:'Sofá sintético',estado_comercial:'ativo',estado:'retido',retencao_id:'42',retencao_em:'2026-11-25T12:00:00Z',retencao_motivo:'Ofício sintético 42',motivo:null,autor:null,criado_em:null,ultima_revisao:null};
  const html = renderToStaticMarkup(React.createElement(RevisaoRetencao,{item,consulta:item.id}));
  const confirmacao=renderToStaticMarkup(React.createElement(React.Fragment,null,pedido.texto));
  for (const texto of [item.titulo,item.id,item.retencao_id,item.retencao_motivo]) {
    assert.ok(html.includes(texto)); assert.ok(confirmacao.includes(texto));
  }
});
