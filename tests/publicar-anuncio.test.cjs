const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup: render } = require('react-dom/server');
const { carregar } = require('./carregar.cjs');
const id = '60000000-0000-4000-a000-000000000001';
const base = 'src/app/(conta)/anunciar/';
const anuncio = { id, vitrine_id: 'loja', status: 'rascunho', fotos: [], atributos: {}, preco_centavos: null, categoria_id: null, publicado_em: null };
const conta = { vitrine: { id: 'loja', dono_id: 'user_loja', microrregiao_id: 'regiao', status: 'ativa' }, podePublicar: true };
function fronteiras(op = {}) {
  const gravacoes = []; const filtros = []; let chamadas = 0;
  const db = { from() { const q = { select() { return q; }, eq(...args) { filtros.push(args); return q; }, filter(...args) { filtros.push(args); return q; }, order() { return q; }, limit() { return q; }, update(dados) { gravacoes.push(dados); return q; }, insert(dados) { gravacoes.push(dados); return q; }, async maybeSingle() { chamadas++; return op.respostas?.[chamadas - 1] ?? { data: { id, status: 'rascunho' }, error: null }; }, async single() { return op.insertResposta ?? { data: { id }, error: null }; } }; return q; }, rpc: async () => op.rpc ?? { data: 'ativo', error: null } };
  const mocks = {
    '@clerk/nextjs/server': { auth: async () => ({ userId: op.semLogin ? null : 'user_loja' }) },
    '@/lib/supabase/server': { createClient: async () => db },
    '@/lib/dados/anuncios': { anuncioDaLoja: async () => op.semAnuncio ? null : { ...anuncio, ...op.anuncio }, anunciosDaLoja: async () => [] },
    '@/lib/dados/conta': { contaDaLoja: async () => conta },
    '@/lib/dados/loja-ativa': { lojasQueCuido: async () => [], lojaEscolhida: async () => ({ id: 'loja', nome: 'Loja', dono: true }) },
    '@/components/conta/seletor-loja': { SeletorLoja: () => null },
    '@/lib/dados/categorias': { categoriaPorId: async (id) => op.categorias?.[id] ?? null, categoriaDoAnuncio: async (id) => op.categorias?.[id] ?? null },
    '@/lib/dados/regiao': { listarCidades: async () => op.cidades ?? [{ nome: 'Corrente', uf: 'PI' }] },
    '@/lib/dados/config': { lerConfigNumero: async (chave, regiao) => { assert.equal(regiao, 'regiao'); return chave.endsWith('maximo') ? 2 : 1; } },
    '@/lib/dados/cobranca': { avulsoParaMim: async () => null }, '@/lib/asaas': { asaasConfigurado: () => false },
    'next/navigation': { redirect: url => { throw Error('redirect:' + url); }, unstable_rethrow: err => { if (err.message?.startsWith('redirect:')) throw err; } },
  };
  return { a: carregar(base + 'actions.ts', mocks), mocks, gravacoes, filtros };
}
function form(valores = {}) { const f = new FormData(); for (const [k, v] of Object.entries({ id, acao: 'seguir', ...valores })) f.set(k, v); return f; }

test('busca sem categoria oferece Diversos ativo sem selecionar automaticamente', () => {
  let indice = 0;
  const { EscolhaCategoria } = carregar('src/components/anunciar/escolha-categoria.tsx', {
    // 2º useState de EscolhaCategoria = texto digitado em "O que você está anunciando?"
    react: { ...React, useState: inicial => [indice++ === 1 ? 'Desenho para colorir' : typeof inicial === 'function' ? inicial() : inicial, () => {}], useMemo: fn => fn(), useEffect: () => {}, useRef: v => ({ current: v }) },
    './enviar': { useEnvioAnuncio: () => [null, () => {}, false, () => {}] },
    '@/app/(conta)/anunciar/actions': { salvarCategoria() {} },
  });
  const diversos = { id: 'tipo-diversos', slug: 'diversos', nome: 'Diversos' };
  const arvore = [{ id: 'grupo-outros', slug: 'outros', nome: 'Outros', filhas: [diversos] }];
  const html = render(EscolhaCategoria({ id, editar: false, formId: 'categoria', arvore, selecionadaId: null, tituloAtual: null }));
  assert.match(html, /Ver todas as categorias/);
  assert.match(html, /name="escolha-categoria" value="tipo-diversos"/);
  assert.match(html, /name="categoria_id" value=""/);
  assert.doesNotMatch(html, /<input[^>]*\schecked(?:=|\s|>)/);
});

test('IA sugerindo Diversos: a opção aparece uma vez só, e "Sugerir a categoria" continua', () => {
  let indice = 0;
  const { EscolhaCategoria } = carregar('src/components/anunciar/escolha-categoria.tsx', {
    // useState de EscolhaCategoria: escolhida, texto digitado, sugestão, IA
    react: { ...React, useState: inicial => {
      const i = indice++;
      if (i === 1) return ['Desenho para colorir', () => {}];
      if (i === 3) return [{ texto: 'Desenho para colorir', ids: ['tipo-diversos'] }, () => {}];
      return [typeof inicial === 'function' ? inicial() : inicial, () => {}];
    }, useMemo: fn => fn(), useEffect: () => {}, useRef: v => ({ current: v }) },
    './enviar': { useEnvioAnuncio: () => [null, () => {}, false, () => {}] },
    '@/app/(conta)/anunciar/actions': { salvarCategoria() {} },
  });
  const diversos = { id: 'tipo-diversos', slug: 'diversos', nome: 'Diversos' };
  const arvore = [{ id: 'grupo-outros', slug: 'outros', nome: 'Outros', filhas: [diversos] }];
  const html = render(EscolhaCategoria({ id, editar: false, formId: 'categoria', arvore, selecionadaId: null, tituloAtual: null }));
  assert.equal(html.match(/name="escolha-categoria" value="tipo-diversos"/g).length, 1);
  assert.match(html, /1 categoria parecida/);
  assert.match(html, /Sugerir a categoria/);
});

for (const [texto, centavos] of [['1500.50',150050],['1.500,50',150050],['1.500',150000],['49,90',4990]]) {
  test(`salvar preço ${texto} mantém o valor exato`, async () => {
    const { a, gravacoes } = fronteiras();
    await assert.rejects(a.salvarPreco(null, form({ preco: texto })), /redirect:\/anunciar\/local/);
    assert.equal(gravacoes[0].preco_centavos, centavos);
  });
}
for (const preco of ['', '0', '-1', 'abc', '12,345', '1e5', '1000000001']) test(`preço inválido ${preco} não grava`, async () => {
  const { a, gravacoes } = fronteiras(); const r = await a.salvarPreco(null, form({ preco }));
  assert.ok(r.campos.preco); assert.equal(gravacoes.length, 0);
});
test('Voltar do preço salva a edição antes de abrir os detalhes', async () => {
  const { a, gravacoes } = fronteiras();
  const { CabecalhoPasso } = carregar('src/components/anunciar/cabecalho-passo.tsx');
  const html = render(React.createElement(CabecalhoPasso, { passo: 'preco', id, editar: false, formId: 'form-preco', titulo: 'Preço' }));
  assert.match(html, /<button(?=[^>]*type="submit")(?=[^>]*form="form-preco")(?=[^>]*name="acao")(?=[^>]*value="ir:detalhes")[^>]*>(?:(?!<\/button>).)*Voltar<\/button>/);
  assert.deepEqual(await a.salvarPreco(null, form({ preco: '93,50', acao: 'ir:detalhes' })), { irPara: `/anunciar/detalhes?rascunho=${id}` });
  assert.deepEqual(gravacoes[0], { preco_centavos: 9350, aceita_troca: false });
});

test('salvar alterações no preço grava apenas a etapa e volta a Meus anúncios', async () => {
  const { a, gravacoes } = fronteiras({ anuncio: { status: 'pausado' } });
  assert.deepEqual(await a.salvarPreco(null, form({ preco: '93,50', acao: 'salvar', editar: '1' })), {
    irPara: `/minha-conta/anuncios?salvo=${id}`,
  });
  assert.deepEqual(gravacoes, [{ preco_centavos: 9350, aceita_troca: false }]);
});

test('corrigir pelo resumo volta à revisão depois de gravar e mantém a validação', async () => {
  const { a, gravacoes } = fronteiras();
  const invalido = await a.salvarPreco(null, form({ acao: 'salvar-revisao', preco: '' }));
  assert.ok(invalido.campos.preco);
  assert.deepEqual(gravacoes, []);
  assert.deepEqual(await a.salvarPreco(null, form({ preco: '93,50', acao: 'salvar-revisao' })), {
    irPara: `/anunciar/revisar?rascunho=${id}`,
  });
  assert.deepEqual(gravacoes, [{ preco_centavos: 9350, aceita_troca: false }]);
});

test('a combinar e troca são escolhas explícitas e salvar e sair mantém destino', async () => {
  const { a, gravacoes } = fronteiras();
  await assert.rejects(a.salvarPreco(null, form({ a_combinar: 'on', aceita_troca: 'on', acao: 'sair' })), /redirect:\/minha-conta\/anuncios/);
  assert.deepEqual(gravacoes[0], { preco_centavos: null, aceita_troca: true });
});
for (const cidades of [[], [{ nome: 'Outra cidade', uf: 'PI' }]]) test('cidade fora da lista ou lista indisponível não grava', async () => {
  const { a, gravacoes } = fronteiras({ cidades });
  assert.ok((await a.salvarLocal(null, form({ cidade: 'Corrente' }))).campos.cidade);
  assert.equal(gravacoes.length, 0);
});
test('local válido normaliza bairro e leva à revisão', async () => {
  const { a, gravacoes } = fronteiras();
  await assert.rejects(a.salvarLocal(null, form({ cidade: 'Corrente', bairro: '  Centro   Sul ' })), /redirect:\/anunciar\/revisar/);
  assert.deepEqual(gravacoes[0], { cidade: 'Corrente', bairro: 'Centro Sul' });
});
test('rascunho repetido retoma a mesma chave somente se pertencer ao usuário', async () => {
  const { a, gravacoes } = fronteiras({ insertResposta: { error: { code: '23505' } } });
  await assert.rejects(a.novoRascunho({ chave: id }), /redirect:\/anunciar\/fotos/);
  assert.equal(gravacoes[0].id, id);
  const outro = fronteiras({ semAnuncio: true, insertResposta: { error: { code: '23505' } } });
  assert.ok((await outro.a.novoRascunho({ chave: id })).erro);
});
test('abrir a página de anunciar não cria rascunho', async () => {
  const { mocks, gravacoes } = fronteiras();
  const { default: Pagina } = carregar(base + 'page.tsx', mocks);
  const html = render(await Pagina());
  assert.match(html, /Começar meu anúncio/); assert.equal(gravacoes.length, 0);
});
test('falha de rede mantém erro recuperável e sinais de redirect continuam funcionando', async () => {
  const { envioRecuperavel } = carregar('src/components/anunciar/enviar.ts', fronteiras().mocks);
  const r = await envioRecuperavel(async () => { throw Error('offline'); }, null, form());
  assert.match(r.erro.mensagem, /dados continuam nesta tela/);
  await assert.rejects(envioRecuperavel(async () => { throw Error('redirect:/destino'); }, null, form()), /redirect:/);
});
const url = `https://abc.supabase.co/storage/v1/object/public/anuncios/user_loja/${id}/1.webp`;
test('fotos rejeitam origem, dono, duplicata e limite regional antes da gravação', async () => {
  const anterior = process.env.NEXT_PUBLIC_SUPABASE_URL; process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://abc.supabase.co';
  try {
    for (const fotos of [[url.replace('abc.supabase.co','outro.test')], [url.replace('user_loja','user_outro')], [url,url], [url,url+'2',url+'3']]) {
      const { a, gravacoes } = fronteiras(); assert.equal((await a.salvarFotos(id, fotos)).ok, false); assert.equal(gravacoes.length, 0);
    }
    const { a, filtros } = fronteiras(); assert.equal((await a.salvarFotos(id, [url], [])).ok, true);
    assert.ok(filtros.some(f => f[0] === 'fotos' && f[1] === 'eq' && f[2] === '{}'));
  } finally { if (anterior === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = anterior; }
});
test('foto na pasta do ID antigo (troca do Clerk): dono põe, tira e reordena; foto antiga de fora continua recusada', async () => {
  const anterior = process.env.NEXT_PUBLIC_SUPABASE_URL; process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://abc.supabase.co';
  try {
    const velha1 = url.replace('user_loja', 'user_antigo'), velha2 = velha1.replace('1.webp', '2.webp'), nova = url.replace('1.webp', '3.webp');
    const op = { anuncio: { fotos: [velha1, velha2] } };
    for (const [caso, fotos] of [['reordenar', [velha2, velha1]], ['tirar', [velha2]], ['pôr foto nova (limite de 2 no teste)', [velha1, nova]], ['nova na capa', [nova, velha1]]]) {
      const { a, gravacoes } = fronteiras(op);
      const r = await a.salvarFotos(id, fotos, [velha1, velha2]);
      assert.equal(r.ok, true, caso); assert.deepEqual(gravacoes, [{ fotos }], caso);
    }
    for (const fotos of [[velha1, velha1.replace('1.webp', '9.webp')], [velha1, url.replace('user_loja', 'user_outro')]]) {
      const { a, gravacoes } = fronteiras(op);
      assert.equal((await a.salvarFotos(id, fotos, [velha1, velha2])).ok, false); assert.equal(gravacoes.length, 0);
    }
  } finally { if (anterior === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = anterior; }
});
test('fotos concorrentes retornam a lista atual e resposta perdida pode ser repetida', async () => {
  const anterior = process.env.NEXT_PUBLIC_SUPABASE_URL; process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://abc.supabase.co';
  try {
    const outro = url.replace('1.webp','2.webp');
    let { a } = fronteiras({ respostas: [{ data: null }, { data: { fotos: [outro] } }] });
    const r = await a.salvarFotos(id, [url], []); assert.equal(r.ok, false); assert.deepEqual(r.fotosAtuais, [outro]);
    ({ a } = fronteiras({ respostas: [{ data: null }, { data: { fotos: [url] } }] }));
    assert.equal((await a.salvarFotos(id, [url], [])).ok, true);
  } finally { if (anterior === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = anterior; }
});
test('publicação usa status retornado pelo banco e preserva erros de validação', async () => {
  for (const status of ['ativo','em_analise']) {
    const { a } = fronteiras({ rpc: { data: status } });
    await assert.rejects(a.publicarAnuncio(null, form()), status === 'ativo' ? /redirect:\/anunciar\/pronto\?id=.*0001$/ : /status=analise/);
  }
  const { a } = fronteiras({ rpc: { error: { code: '23514', message: 'Coloque foto', details: 'campo:fotos' } } });
  assert.equal((await a.publicarAnuncio(null, form())).erro.campo, 'fotos');
});
test('P5c: publicar na loja em montagem deixa o produto pronto e mostra a tela certa', async () => {
  const { a } = fronteiras({ rpc: { data: 'pronto' } });
  await assert.rejects(a.publicarAnuncio(null, form()), /redirect:\/anunciar\/pronto\?id=.*0001&status=pronto$/);
  const { mocks } = fronteiras({ anuncio: { status: 'rascunho', titulo: 'Mesa', pronto_em: '2026-11-12T10:00:00Z' } });
  const { default: Pagina } = carregar(base + 'pronto/page.tsx', mocks);
  const html = render(await Pagina({ searchParams: Promise.resolve({ id, status: 'pronto' }) }));
  assert.match(html, /Produto pronto/);
  assert.match(html, /vai ao ar quando o dono aceitar a loja/);
  assert.doesNotMatch(html, /Seu anúncio está no ar!/);
});
test('publicação não permite editar anúncio de outro usuário', async () => {
  const { a, gravacoes } = fronteiras({ semAnuncio: true });
  assert.ok((await a.publicarAnuncio(null, form())).erro); assert.equal(gravacoes.length, 0);
});
test('confirmação mostra o estado do banco, inclusive quando a URL diz o contrário', async () => {
  const motivo = 'Termo sexual ou violento: exemplo';
  for (const status of ['ativo', 'em_analise']) {
    const { mocks } = fronteiras({ anuncio: { status, titulo: 'Anúncio de teste', motivo_analise: motivo } });
    const { default: Pagina } = carregar(base + 'pronto/page.tsx', mocks);
    const html = render(await Pagina({ searchParams: Promise.resolve({ id, status: status === 'ativo' ? 'analise' : 'ativo' }) }));
    if (status === 'ativo') {
      assert.match(html, /Seu anúncio está no ar!/);
      assert.doesNotMatch(html, /Seu anúncio está em análise/);
    } else {
      assert.match(html, /Seu anúncio está em análise/);
      assert.match(html, /A equipe precisa conferir/);
      assert.ok(html.includes(motivo));
      assert.doesNotMatch(html, /Seu anúncio está no ar!|automática|em até \d+/);
    }
  }
});
test('foto vazia ou acima de 20 MB é recusada antes da decodificação', async () => {
  const { reduzirFoto, MAX_FOTO_ORIGINAL } = carregar('src/lib/fotos.ts');
  await assert.rejects(reduzirFoto(new Blob()), /até 20 MB/);
  await assert.rejects(reduzirFoto({ size: MAX_FOTO_ORIGINAL + 1 }), /até 20 MB/);
});

test('formulários renderizam ação segura, preço legível e localização sem entrada livre', () => {
  const mocks = { ...fronteiras().mocks, '@/app/(conta)/anunciar/actions': { salvarPreco: async () => null, salvarLocal: async () => null } };
  const { FormPreco } = carregar('src/components/anunciar/form-preco.tsx', mocks);
  const html = render(React.createElement(FormPreco, { id, editar: false, formId: 'preco', precoInicial: 150050, aCombinarInicial: false, aceitaTrocaInicial: false, dicaFaixa: null }));
  assert.match(html, /value="1.500,50"/); assert.match(html, /action="javascript:/); assert.doesNotMatch(html, /method="get"/);
  const { FormLocal } = carregar('src/components/anunciar/form-local.tsx', mocks);
  const local = render(React.createElement(FormLocal, { id, editar: false, formId: 'local', cidades: [], cidadeInicial: '', bairroInicial: '' }));
  assert.match(local, /Não há cidades disponíveis/); assert.match(local, /type="hidden" name="cidade"/); assert.match(local, /disabled/);
});

test('Detalhes usa duas colunas no celular e três em telas maiores quando há três opções', () => {
  const { FormDetalhes } = carregar('src/components/anunciar/form-detalhes.tsx', {
    '@/app/(conta)/anunciar/actions': { salvarDetalhes: async () => null },
  });
  const campos = [
    { chave: 'garantia', rotulo: 'Garantia', tipo: 'sim_nao', obrigatorio: true },
    { chave: 'entrega', rotulo: 'Entrega', tipo: 'lista', obrigatorio: false, opcoes: ['Retirada', 'Envio'] },
    { chave: 'material', rotulo: 'Material', tipo: 'lista', obrigatorio: true, opcoes: ['Madeira', 'Metal', 'Vidro', 'Plástico'] },
  ];
  const html = render(React.createElement(FormDetalhes, {
    id, categoriaId: null, editar: false, formId: 'detalhes', tituloInicial: '', descricaoInicial: '', campos, atributos: {},
  }));
  const grades = [...html.matchAll(/<div class="(grid gap-2[^"]*)"><label/g)].map(([, classes]) => classes.trim().split(/\s+/));
  assert.equal(grades.length, 3);
  for (const grade of grades) assert.ok(grade.includes('grid-cols-2'));
  assert.deepEqual(grades.map(grade => grade.includes('sm:grid-cols-3')), [false, true, false]);
});

test('Carros e Casas mostram e validam seus próprios detalhes', async () => {
  const carro = '60000000-0000-4000-a000-000000000011';
  const casa = '60000000-0000-4000-a000-000000000012';
  const categorias = {
    [carro]: { categoria: { campos: [
      { chave: 'marca', rotulo: 'Marca', tipo: 'texto', obrigatorio: true },
      { chave: 'km', rotulo: 'Quilometragem', tipo: 'numero', unidade: 'km' },
    ] } },
    [casa]: { categoria: { campos: [
      { chave: 'finalidade', rotulo: 'Venda ou aluguel', tipo: 'lista', obrigatorio: true, opcoes: ['Venda', 'Aluguel'] },
      { chave: 'area', rotulo: 'Área', tipo: 'numero', unidade: 'm²' },
    ] } },
  };
  for (const [categoriaId, obrigatorio, valores, atributo, outro] of [
    [carro, 'attr_marca', { attr_marca: 'Fiat', attr_km: '62.000' }, { marca: 'Fiat', km: 62000 }, 'attr_area'],
    [casa, 'attr_finalidade', { attr_finalidade: 'Venda', attr_area: '95,5' }, { finalidade: 'Venda', area: 95.5 }, 'attr_km'],
  ]) {
    const anuncio = { categoria_id: categoriaId, atributos: { campo_antigo: 'preservado' }, atualizado_em: '2026-11-10T10:00:00Z' };
    const { a, mocks, gravacoes, filtros } = fronteiras({ categorias, anuncio });
    const { FormDetalhes } = carregar('src/components/anunciar/form-detalhes.tsx', { ...mocks, '@/app/(conta)/anunciar/actions': a });
    const html = render(React.createElement(FormDetalhes, {
      id, categoriaId, editar: false, formId: 'detalhes', tituloInicial: '', descricaoInicial: '',
      campos: categorias[categoriaId].categoria.campos, atributos: {},
    }));
    assert.ok(html.includes(`name="${obrigatorio}"`));
    assert.ok(!html.includes(`name="${outro}"`));
    const base = { categoria_id: categoriaId, titulo: 'Anúncio fictício' };
    assert.ok((await a.salvarDetalhes(null, form(base))).campos[obrigatorio]);
    assert.match((await a.salvarDetalhes(null, form({ ...base, categoria_id: 'anterior', ...valores }))).erro.mensagem, /categoria mudou/);
    assert.equal(gravacoes.length, 0);
    await assert.rejects(a.salvarDetalhes(null, form({ ...base, ...valores })), /redirect:\/anunciar\/preco/);
    assert.deepEqual(gravacoes[0].atributos, { ...atributo, campo_antigo: 'preservado' });
    assert.ok(filtros.some(([chave, valor]) => chave === 'atualizado_em' && valor === anuncio.atualizado_em));
  }
});

test('troca de Casas para Fazendas mantém finalidade e pede área na unidade nova', async () => {
  const casa = '60000000-0000-4000-a000-000000000012';
  const fazenda = '60000000-0000-4000-a000-000000000013';
  const finalidade = { chave: 'finalidade', tipo: 'lista', opcoes: ['Venda', 'Aluguel'] };
  const area = { chave: 'area', tipo: 'numero' };
  const categorias = {
    [casa]: { pai: {}, filhas: [], categoria: { campos: [finalidade, { ...area, unidade: 'm²' }] } },
    [fazenda]: { pai: {}, filhas: [], categoria: { campos: [finalidade, { ...area, unidade: 'ha' }] } },
  };
  const { a, gravacoes } = fronteiras({ categorias, anuncio: { categoria_id: casa, atributos: { finalidade: 'Venda', area: 95 } } });
  await assert.rejects(a.salvarCategoria(null, form({ categoria_id: fazenda })), /redirect:\/anunciar\/detalhes/);
  assert.deepEqual(gravacoes[0], { categoria_id: fazenda, atributos: { finalidade: 'Venda' } });
});

test('foto ainda referenciada ou consulta indisponível nunca é apagada do Storage', async () => {
  for (const resposta of [{ data: [{ id }] }, { error: { message: 'offline' }, data: null }, { data: [] }]) {
    let removidas = 0;
    const q = { select() { return q; }, contains() { return q; }, or() { return q; }, eq() { return q; }, async limit() { return resposta; } };
    const { apagarFoto } = carregar('src/lib/dados/fotos.ts', {
      '@clerk/nextjs/server': { auth: async () => ({ userId: 'user_loja' }) },
      '@/lib/dados/loja-ativa': { lojasQueCuido: async () => [{ id: 'loja', nome: 'Loja', dono: true }] },
      '@/lib/dados/edicao-admin': { edicaoAdmin: async () => null },
      '@/lib/supabase/server': { createClient: async () => ({ from: () => q, storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: url } }), remove: async () => { removidas++; return { error: null }; } }) } }) },
    });
    const r = await apagarFoto(url);
    assert.equal(removidas, resposta.data?.length === 0 ? 1 : 0); assert.equal(r.ok, removidas === 1);
    assert.equal((await apagarFoto(url.replace('user_loja','user_outro'))).ok, false);
  }
});

// Preço antes (riscado no card): só quando o campo apareceu na edição; precisa ser maior que o preço de agora.
test('preço antes maior que o atual é gravado junto com o preço', async () => {
  const { a, gravacoes } = fronteiras();
  await assert.rejects(a.salvarPreco(null, form({ preco: '1.200', tem_preco_antes: '1', preco_antes: '1.500,00' })), /redirect:/);
  assert.deepEqual(gravacoes[0], { preco_centavos: 120000, aceita_troca: false, preco_antes_centavos: 150000 });
});
for (const [antes, valores] of [['1.200', {}], ['900', {}], ['abc', {}], ['1.500', { preco: '', a_combinar: '' }]]) {
  test(`preço antes ${antes} inválido para o preço de agora não grava`, async () => {
    const { a, gravacoes } = fronteiras({ anuncio: { status: 'ativo', publicado_em: '2026-11-01T00:00:00Z' } });
    const r = await a.salvarPreco(null, form({ preco: '1.200', tem_preco_antes: '1', preco_antes: antes, ...valores }));
    assert.ok(r.campos.preco_antes || r.campos.preco); assert.equal(gravacoes.length, 0);
  });
}
test('preço antes vazio ou "a combinar" apaga o riscado; sem o campo na tela nada muda', async () => {
  for (const valores of [{ preco: '1.200', preco_antes: '' }, { a_combinar: 'on', preco_antes: '1.500' }]) {
    const { a, gravacoes } = fronteiras();
    await assert.rejects(a.salvarPreco(null, form({ tem_preco_antes: '1', ...valores })), /redirect:/);
    assert.equal(gravacoes[0].preco_antes_centavos, null);
  }
  const { a, gravacoes } = fronteiras();
  await assert.rejects(a.salvarPreco(null, form({ preco: '1.200', preco_antes: '1.500' })), /redirect:/);
  assert.equal('preco_antes_centavos' in gravacoes[0], false);
});
test('campo "Preço antes" só aparece na edição e quando o banco já tem a coluna', () => {
  const { FormPreco } = carregar('src/components/anunciar/form-preco.tsx', {
    './enviar': { useEnvioAnuncio: () => [null, () => {}, false, () => {}] },
    '@/app/(conta)/anunciar/actions': { salvarPreco() {} },
  });
  const props = { id, formId: 'p', precoInicial: 120000, aCombinarInicial: false, aceitaTrocaInicial: false, dicaFaixa: null };
  const comCampo = render(React.createElement(FormPreco, { ...props, editar: true, precoAntesInicial: 150000 }));
  assert.match(comCampo, /Preço antes<span[^>]*>\(opcional\)<\/span>/); assert.match(comCampo, /name="preco_antes"[^>]*value="1\.500,00"/);
  assert.match(comCampo, /name="tem_preco_antes" value="1"/);
  assert.doesNotMatch(render(React.createElement(FormPreco, { ...props, editar: false, precoAntesInicial: null })), /Preço antes/);
  assert.doesNotMatch(render(React.createElement(FormPreco, { ...props, editar: true })), /Preço antes/);
});
