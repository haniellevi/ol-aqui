const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { carregar } = require('./carregar.cjs');

// Etapa 2 das categorias: a IA (JEV, TypeSafe) sugere até 3 categorias enquanto a pessoa escreve.
const folha = (id, slug, nome) => ({ id, slug, nome, icone: '', filhas: [] });
const ARVORE = [
  { id: 'r1', slug: 'pet', nome: 'Pet', icone: 'paw-print', filhas: [
    { id: 's1', slug: 'produtos-para-pets', nome: 'Produtos para pets', icone: '', filhas: [folha('f1', 'racao', 'Ração')] },
    folha('f2', 'cachorros', 'Cachorros'),
  ] },
  { id: 'r2', slug: 'casa', nome: 'Casa', icone: 'sofa', filhas: [folha('f3', 'sofas-e-poltronas', 'Sofás e poltronas')] },
  { id: 'r3', slug: 'servicos', nome: 'Serviços', icone: 'hand-helping', filhas: [folha('f4', 'pedreiro', 'Pedreiro')] },
  { id: 'r4', slug: 'empregos', nome: 'Empregos', icone: 'briefcase', filhas: [folha('f5', 'vagas', 'Vagas')] },
];

const modulo = () => carregar('src/lib/sugestao-categoria-ia.ts');

async function comFetch(resposta, fn, { chave = 'teste' } = {}) {
  const antes = global.fetch, chaveAntes = process.env.TYPESAFE_API_KEY; const pedidos = [];
  global.fetch = async (url, op) => { pedidos.push({ url, op, corpo: JSON.parse(op.body) }); return typeof resposta === 'function' ? resposta() : resposta; };
  if (chave === null) delete process.env.TYPESAFE_API_KEY; else process.env.TYPESAFE_API_KEY = chave;
  try { return await fn(pedidos); } finally {
    global.fetch = antes;
    if (chaveAntes === undefined) delete process.env.TYPESAFE_API_KEY; else process.env.TYPESAFE_API_KEY = chaveAntes;
  }
}
const chances = (probabilities) => new Response(JSON.stringify({ answers: { categoria: { choice: Object.keys(probabilities)[0], probabilities } } }), { status: 200 });

test('texto da busca: junta espaços, corta em 90 e precisa de 3 letras com alguma letra', () => {
  const m = modulo();
  assert.equal(m.limparTextoBusca('  moto   Titan  160 '), 'moto Titan 160');
  assert.equal(m.limparTextoBusca('x'.repeat(120)).length, 90);
  for (const v of ['', 'ab', '  a  ', '123 456', '---', null, undefined]) assert.equal(m.limparTextoBusca(v), null);
  assert.equal(m.limparTextoBusca('Ração'), 'Ração');
});

test('opções da IA: só categorias finais, com caminho, dica de Serviços/Empregos e palavras de exemplo', () => {
  const { criterios, ids } = modulo().criteriosCategorias(ARVORE);
  assert.deepEqual(Object.keys(criterios).sort(), ['cachorros', 'pedreiro', 'racao', 'sofas-e-poltronas', 'vagas']);
  assert.equal(criterios.racao, 'Pet › Produtos para pets › Ração. Ex.: racao');
  assert.equal(criterios['sofas-e-poltronas'], 'Casa › Sofás e poltronas. Ex.: sofa, poltrona, puff');
  assert.equal(criterios.pedreiro, 'Serviços › Pedreiro. Serviço oferecido por alguém (mão de obra ou atendimento), não a venda de um produto');
  assert.equal(criterios.vagas, 'Empregos › Vagas. Vaga de trabalho ou pessoa procurando trabalho');
  assert.equal(ids.get('racao'), 'f1');
  assert.equal(ids.has('pet'), false);
});

test('chances: só categorias da lista, de 5% para cima, da maior para a menor, até 3', () => {
  const { ids } = modulo().criteriosCategorias(ARVORE);
  const r = modulo().lerChances({ cachorros: 0.2, racao: 0.6, inventada: 0.9, pedreiro: 0.04, vagas: 0.1, 'sofas-e-poltronas': 0.06, pet: 0.5 }, ids);
  assert.deepEqual(r, [{ id: 'f1', chance: 0.6 }, { id: 'f2', chance: 0.2 }, { id: 'f5', chance: 0.1 }]);
  assert.deepEqual(modulo().lerChances({ racao: '0.9', cachorros: 1.5, vagas: NaN }, ids), []);
  for (const v of [null, undefined, 'x', [], 3]) assert.deepEqual(modulo().lerChances(v, ids), []);
});

test('freio: 30 por minuto por pessoa; cada pessoa tem o seu; passa depois de 1 minuto', () => {
  const m = modulo();
  for (let i = 0; i < 30; i++) assert.equal(m.dentroDoLimite('a', 1000 + i), true);
  assert.equal(m.dentroDoLimite('a', 2000), false);
  assert.equal(m.dentroDoLimite('b', 2000), true);
  assert.equal(m.dentroDoLimite('a', 1000 + 60_030), true);
});

test('freio geral: 300 por minuto somando todo mundo, mesmo com cada pessoa abaixo do seu limite', () => {
  const m = modulo();
  for (let i = 0; i < 300; i++) assert.equal(m.dentroDoLimite(`p${i}`, 1000 + i), true);
  assert.equal(m.dentroDoLimite('outra', 2000), false);
  assert.equal(m.dentroDoLimite('outra', 1000 + 60_000), true, 'no minuto seguinte volta');
});

test('freio com muita gente: esquece só quem usou há mais tempo, nunca zera o de todo mundo', () => {
  const m = modulo();
  m.dentroDoLimite('x', 0); // abre o minuto do freio geral
  for (let i = 0; i < 30; i++) m.dentroDoLimite('antiga', 50_000);
  for (let i = 0; i < 30; i++) m.dentroDoLimite('cheia', 50_001);
  for (let i = 0; i < 4997; i++) m.dentroDoLimite(`p${i}`, 50_002);
  assert.equal(m.dentroDoLimite('cheia', 50_003), false, '5000 pessoas: ninguém é esquecido');
  m.dentroDoLimite('nova1', 50_004); // 5001ª pessoa: sai só quem usou há mais tempo ("x")
  m.dentroDoLimite('nova2', 50_005); // depois "antiga"
  // minuto geral novo (60 s depois de "x"), mas os 30 de "cheia" e "antiga" ainda contam por pessoa
  assert.equal(m.dentroDoLimite('cheia', 60_000), false, 'quem estava no limite continua no limite');
  assert.equal(m.dentroDoLimite('antiga', 60_001), true, 'a mais antiga foi esquecida');
});

test('árvore para a IA: guarda por 5 min; vazia ou com erro não fica guardada', async () => {
  const m = modulo();
  let leituras = 0;
  const ler = async () => { leituras++; return ARVORE; };
  assert.equal(await m.arvoreParaIA(ler, 0), ARVORE);
  assert.equal(await m.arvoreParaIA(ler, 299_999), ARVORE);
  assert.equal(leituras, 1);
  await m.arvoreParaIA(ler, 300_000);
  assert.equal(leituras, 2);
  const outro = modulo();
  assert.deepEqual(await outro.arvoreParaIA(async () => [], 0), []);
  await assert.rejects(outro.arvoreParaIA(async () => { throw new Error('banco fora'); }, 1));
  assert.equal(await outro.arvoreParaIA(ler, 2), ARVORE);
  assert.equal(leituras, 3);
});

test('chama o JEV com o título, só as categorias finais e a chave no cabeçalho; devolve as mais prováveis', async () => {
  await comFetch(chances({ racao: 0.9, cachorros: 0.08, vagas: 0.01 }), async (pedidos) => {
    const r = await modulo().categoriasMaisProvaveis(ARVORE, '  Ração Golden  15kg ');
    assert.deepEqual(r, [{ id: 'f1', chance: 0.9 }, { id: 'f2', chance: 0.08 }]);
    assert.equal(pedidos.length, 1);
    const { url, op, corpo } = pedidos[0];
    assert.equal(url, 'https://api.typesafe.ai/v1/systemone');
    assert.equal(op.method, 'POST');
    assert.equal(op.headers.authorization, 'Bearer teste');
    assert.equal(op.redirect, 'error');
    assert.ok(op.signal, 'tem prazo');
    assert.equal(corpo.model, 'jev-latest');
    assert.deepEqual(corpo.state, { titulo_do_anuncio: 'Ração Golden 15kg' });
    assert.equal(corpo.questions.categoria.type, 'choice');
    assert.match(corpo.questions.categoria.instructions, /categoria mais específica/);
    assert.deepEqual(Object.keys(corpo.questions.categoria.criteria).sort(), ['cachorros', 'pedreiro', 'racao', 'sofas-e-poltronas', 'vagas']);
  });
});

test('sem chave, texto curto, erro, demora ou resposta estranha: lista vazia (fica a busca local)', async () => {
  await comFetch(chances({ racao: 0.9 }), async (pedidos) => {
    assert.deepEqual(await modulo().categoriasMaisProvaveis(ARVORE, 'Ração'), []);
    assert.equal(pedidos.length, 0);
  }, { chave: null });
  await comFetch(chances({ racao: 0.9 }), async (pedidos) => {
    assert.deepEqual(await modulo().categoriasMaisProvaveis(ARVORE, 'ab'), []);
    assert.deepEqual(await modulo().categoriasMaisProvaveis([], 'Ração'), []);
    assert.equal(pedidos.length, 0);
  });
  const ruins = [
    () => new Response('{}', { status: 429 }),
    () => new Response('{}', { status: 500 }),
    () => { throw new DOMException('demorou', 'TimeoutError'); },
    () => new Response('não é json', { status: 200 }),
    () => new Response(JSON.stringify({ answers: {} }), { status: 200 }),
    () => new Response('x'.repeat(100_001), { status: 200 }),
  ];
  for (const ruim of ruins) {
    await comFetch(ruim, async () => assert.deepEqual(await modulo().categoriasMaisProvaveis(ARVORE, 'Ração'), []));
  }
});

// ---------- Ação do cadastro ----------
function acoes({ userId = 'user_loja', arvore = ARVORE } = {}) {
  const chamadas = { auth: 0, arvore: 0 };
  const mocks = {
    '@clerk/nextjs/server': { auth: async () => { chamadas.auth++; return { userId }; } },
    '@/lib/supabase/server': { createClient: async () => { throw new Error('sem banco'); } },
    '@/lib/dados/anuncios': { anuncioDaLoja: async () => null },
    '@/lib/dados/conta': { contaDaLoja: async () => null },
    '@/lib/dados/categorias': {
      categoriaPorId: async () => null, categoriaDoAnuncio: async () => null,
      listarCategorias: async () => { chamadas.arvore++; if (!arvore) throw new Error('banco fora'); return arvore; },
    },
    '@/lib/dados/regiao': { listarCidades: async () => [] },
    '@/lib/dados/config': { lerConfigNumero: async () => null },
    '@/lib/dados/cobranca': { avulsoParaMim: async () => null },
    '@/lib/asaas': { asaasConfigurado: () => false },
    'next/navigation': { redirect: (url) => { throw Error(`redirect:${url}`); }, unstable_rethrow: () => {} },
  };
  return { a: carregar('src/app/(conta)/anunciar/actions.ts', mocks), chamadas };
}

test('ação: devolve os ids sugeridos para quem está logado', async () => {
  await comFetch(chances({ cachorros: 0.7, racao: 0.2 }), async (pedidos) => {
    const { a, chamadas } = acoes();
    assert.deepEqual(await a.categoriasSugeridasIA('filhote de poodle'), ['f2', 'f1']);
    assert.equal(chamadas.arvore, 1);
    assert.equal(pedidos.length, 1);
  });
});

test('ação: sem login, sem chave, texto curto, no limite ou com o banco fora: [] sem chamar a IA', async () => {
  await comFetch(chances({ racao: 0.9 }), async (pedidos) => {
    const sem = acoes({ userId: null });
    assert.deepEqual(await sem.a.categoriasSugeridasIA('Ração'), []);
    assert.equal(sem.chamadas.arvore, 0);

    const curto = acoes();
    assert.deepEqual(await curto.a.categoriasSugeridasIA('ab'), []);
    assert.equal(curto.chamadas.auth, 0);

    const fora = acoes({ arvore: null });
    assert.deepEqual(await fora.a.categoriasSugeridasIA('Ração'), []);

    const muito = acoes();
    for (let i = 0; i < 30; i++) await muito.a.categoriasSugeridasIA('Ração');
    const antes = pedidos.length;
    assert.deepEqual(await muito.a.categoriasSugeridasIA('Ração'), []);
    assert.equal(pedidos.length, antes, 'a 31ª no mesmo minuto não chama a IA');
    assert.equal(muito.chamadas.arvore, 1, 'a árvore é lida uma vez e guardada');
  });
  await comFetch(chances({ racao: 0.9 }), async (pedidos) => {
    const { a, chamadas } = acoes();
    assert.deepEqual(await a.categoriasSugeridasIA('Ração'), []);
    assert.equal(chamadas.auth + chamadas.arvore + pedidos.length, 0);
  }, { chave: null });
});

// ---------- Tela: espera e resposta antiga ----------
test('tela: chama só 0,5 s depois de parar de digitar e ignora resposta de texto antigo', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const pedidos = [];
  const salvos = [];
  const rodada = { current: 0 };
  let efeito = null;
  let limpar = null;
  const { EscolhaCategoria } = carregar('src/components/anunciar/escolha-categoria.tsx', {
    react: { ...React,
      useState: (inicial) => {
        const i = desenhar.indice++;
        if (i === 1) return [desenhar.busca, () => {}];
        if (i === 3) return [{ texto: '', ids: [] }, (v) => salvos.push(v)];
        return [typeof inicial === 'function' ? inicial() : inicial, () => {}];
      },
      useMemo: (fn) => fn(), useEffect: (fn) => { efeito = fn; }, useRef: () => rodada },
    './enviar': { useEnvioAnuncio: () => [null, () => {}, false, () => {}] },
    '@/app/(conta)/anunciar/actions': {
      salvarCategoria() {},
      categoriasSugeridasIA: (texto) => new Promise((ok, falha) => pedidos.push({ texto, ok, falha })),
    },
  });
  // Cada "desenho" com texto novo: o React limpa o efeito anterior e roda o novo.
  function desenhar(busca) {
    desenhar.indice = 0; desenhar.busca = busca;
    EscolhaCategoria({ id: 'an1', editar: false, formId: 'f', arvore: ARVORE, selecionadaId: null, tituloAtual: null });
    if (limpar) limpar();
    limpar = efeito();
  }
  const esvaziar = () => new Promise((r) => setImmediate(r));

  desenhar('mo');
  t.mock.timers.tick(1000);
  assert.equal(pedidos.length, 0, 'menos de 3 letras: não chama');

  desenhar('moto');
  t.mock.timers.tick(499);
  desenhar('moto t'); // digitou antes de 0,5 s: o pedido de "moto" não sai
  t.mock.timers.tick(499);
  assert.equal(pedidos.length, 0);
  t.mock.timers.tick(1);
  assert.deepEqual(pedidos.map((p) => p.texto), ['moto t']);

  desenhar('moto  titan '); // espaços juntados
  t.mock.timers.tick(500);
  assert.deepEqual(pedidos.map((p) => p.texto), ['moto t', 'moto titan']);

  // A resposta nova chega antes da antiga: só a nova vale.
  pedidos[1].ok(['f2']);
  await esvaziar();
  pedidos[0].ok(['f1']);
  await esvaziar();
  assert.deepEqual(salvos, [{ texto: 'moto titan', ids: ['f2'] }]);

  // Falha da ação: nada muda e não estoura erro.
  desenhar('geladeira');
  t.mock.timers.tick(500);
  pedidos[2].falha(new Error('sem rede'));
  await esvaziar();
  assert.equal(salvos.length, 1);
});
