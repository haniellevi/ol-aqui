const test = require('node:test');
const assert = require('node:assert/strict');
const { carregar } = require('./carregar.cjs');

const caminho = 'src/app/(conta)/quero-vender/loja/criar-com-ia/actions.ts';
const entrada = { nome: 'Loja local', cidade: 'Corrente', materiais: [], consultarWhatsapp: false, avisarWhatsapp: false, redesConcluidas: true };

function acoes(rpc) {
  return carregar(caminho, {
    '@/lib/supabase/server': { createClient: async () => ({ rpc }) },
    'next/cache': { revalidatePath: () => {} },
    '@/lib/cadastro-loja': {
      validarCadastroLoja: async () => ({ campos: { nome: 'Loja local', cidade: 'Corrente', slug: 'loja-local' } }),
      resultadoCadastroLoja: data => ({ feito: data }),
    },
    '@/lib/loja-ia/imagens': {
      prepararImagemPublicacao: async () => { throw Error('Imagem ausente'); },
    },
    '@/lib/loja-ia/modelo-capa': {},
  });
}

test('coleta preserva etapa e devolve o erro localizado como dado', async () => {
  const chamadas = [];
  const { salvarColeta, iniciarRascunho } = acoes(async (nome, args) => {
    chamadas.push({ nome, args });
    if (nome === 'loja_ia_salvar_coleta') return { data: { id: 'rascunho', revisao: 2 }, error: null };
    return { data: null, error: { code: '22023', message: 'Adicione uma fonte ou escreva pelo menos 10 caracteres sobre a loja.' } };
  });
  assert.deepEqual(await salvarColeta('rascunho', 1, entrada), { ok: true, dados: { revisao: 2 } });
  assert.deepEqual(chamadas[0].args.p_entrada, entrada);
  assert.deepEqual(await iniciarRascunho('rascunho', 2), { ok: false, erro: 'Adicione uma fonte ou escreva pelo menos 10 caracteres sobre a loja.' });
});

test('confirmação repetida recupera a vitrine sem exigir o rascunho ativo', async () => {
  const resultado = { vitrine_id: 'vitrine', slug: 'loja-local' };
  const { confirmarLojaIa } = acoes(async (nome, args) => {
    if (nome === 'loja_ia_obter') return { data: null, error: null };
    assert.equal(nome, 'loja_ia_publicar');
    assert.deepEqual(args, { p_id: 'rascunho', p_revisao: 2, p_campos: null, p_imagens: null });
    return { data: resultado, error: null };
  });
  assert.deepEqual(await confirmarLojaIa('rascunho', 2, new FormData()), { feito: resultado });
});

test('falha ao abrir criação IA volta à escolha com aviso explícito', async () => {
  const { abrirRascunho } = acoes(async () => ({ data: null, error: { code: 'XX000' } }));
  await assert.rejects(abrirRascunho(), erro => erro.digest?.includes('/quero-vender/loja?aviso=ia'));
});
