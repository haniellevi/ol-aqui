const test = require('node:test');
const assert = require('node:assert/strict');
const { carregar } = require('./carregar.cjs');

test('processamento preserva resultado parcial, consulta evidências atuais e conta erros de limpeza', async () => {
  const fila = [
    [{ id: 'site', fonte: 'site', tentativa: 'primeira', entrada: { site: 'https://loja.exemplo' } }],
    [{ id: 'merc', dono_id: 'dono', fonte: 'merc', tentativa: 'segunda', entrada: {} }],
  ];
  const evidencias = [{ id: 'desc', campo: 'sobre', valor: 'Artesanato', origem: { fonte: 'informado', rotulo: 'Informado' } }];
  const gravacoes = [];
  const banco = { rpc: async (nome, args) => {
    switch (nome) {
      case 'loja_ia_pegar': return { data: fila.shift(), error: null };
      case 'loja_ia_evidencias_atuais':
        assert.deepEqual(args, { p_trabalho: 'merc', p_tentativa: 'segunda' });
        return { data: evidencias, error: null };
      case 'loja_ia_concluir_fonte': gravacoes.push(args); return { data: true, error: null };
      case 'loja_ia_enfileirar_avisos': return { data: 1, error: null };
      default: throw Error(nome);
    }
  } };
  const { processarFilaLojaIa } = carregar('src/lib/loja-ia/processar.ts', {
    '@/lib/supabase/admin': { supabaseAdmin: () => banco },
    './fontes': {
      coletarFonte: async () => { throw new Error('Provedor indisponível'); },
      gerarSugestoesMerc: async () => { throw new Error('Limite do Merc'); },
      montarSugestoes: async (atuais, gerar) => {
        assert.deepEqual(atuais, evidencias);
        assert.deepEqual(await gerar(atuais), []);
        return atuais.map(({ campo, valor, origem }) => ({ campo, valor, origem }));
      },
    },
    './imagens': { limparMateriaisPendentes: async () => 2 },
    './whatsapp': {},
  });
  assert.deepEqual(await processarFilaLojaIa(), { concluidos: 2, erros: 2 });
  assert.deepEqual(gravacoes.map(({p_trabalho,p_tentativa,p_resultado}) => [p_trabalho,p_tentativa,p_resultado.estado]), [
    ['site','primeira','indisponivel'], ['merc','segunda','indisponivel'],
  ]);
  assert.equal(gravacoes[1].p_resultado.sugestoes[0].valor, 'Artesanato');
});

test('rota só executa a fila com o segredo interno e informa falha operacional', async () => {
  let execucoes = 0;
  const { POST } = carregar('src/app/api/interno/loja-ia/route.ts', {
    'next/server': { NextResponse: Response },
    '@/lib/moderacao-ia': { segredoModeracaoConfere: valor => valor === 'Bearer fixture' },
    '@/lib/loja-ia/processar': { processarFilaLojaIa: async () => { execucoes++; return { concluidos: 3, erros: 1 }; } },
  });
  assert.equal((await POST(new Request('https://teste.invalid'))).status, 401);
  assert.equal(execucoes, 0);
  const resposta = await POST(new Request('https://teste.invalid', { headers: { authorization: 'Bearer fixture' } }));
  assert.equal(resposta.status, 503);
  assert.deepEqual(await resposta.json(), { ok: false, concluidos: 3, erros: 1 });
  assert.equal(execucoes, 1);
});
