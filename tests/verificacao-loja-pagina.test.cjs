const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup: render } = require('react-dom/server');
const { carregar } = require('./carregar.cjs');

// Tarefa 8: página "Verificar minha loja" (assistente de 4 passos) e o botão na página da loja.
const CNPJ_OK = '11.222.333/0001-81';
const AVISO_IA = 'Uma inteligência artificial confere os seus documentos. Eles não ficam guardados: são apagados quando a conferência termina (no máximo em 7 dias, se a equipe precisar rever).';
const arquivo = (nome = 'conta.pdf', size = 1000, type = 'application/pdf') => ({ name: nome, size, type });
const passos = carregar('src/components/conta/passos-verificacao-loja.ts');

function pagina({ v = { tipo: 'loja', ajudante: false }, envio = { status: 'nao_enviada', motivo: null, whatsapp_ok: true }, rpcErro = false } = {}) {
  const chamadas = [];
  const mod = carregar('src/app/(conta)/minha-conta/loja/verificar/page.tsx', {
    'next/navigation': {
      redirect: (d) => { throw Error(`redirect:${d}`); },
      useRouter: () => ({ refresh() {} }),
    },
    '@/lib/dados/vitrine-completa': { minhaVitrineCompleta: async () => v },
    '@/lib/supabase/server': {
      createClient: async () => ({ rpc: (nome) => { chamadas.push(nome); return { maybeSingle: async () => (rpcErro ? { data: null, error: { message: 'x' } } : { data: envio, error: null }) }; } }),
    },
  });
  return { chamadas, abrir: async () => render(await mod.default()) };
}

test('estados da página: cada status mostra o texto exato', async () => {
  const html = (status, extra = {}) => pagina({ envio: { status, motivo: null, whatsapp_ok: true, ...extra } }).abrir();
  const conferindo = await html('conferindo');
  assert.match(conferindo, /role="status"[^>]*>Conferindo seus dados… Isso leva poucos minutos\./);
  assert.doesNotMatch(conferindo, /Qual é o CNPJ da loja\?/);
  assert.match(await html('equipe'), /Com a equipe\. Respondemos em até 1 dia útil\./);
  const aprovada = await html('aprovada');
  assert.match(aprovada, /Loja verificada\./);
  assert.doesNotMatch(aprovada, /Qual é o CNPJ da loja\?/);
});

test('dono pessoa física vai para a verificação de vendedor; ajudante vê o aviso; sem loja vê o convite', async () => {
  await assert.rejects(pagina({ v: { tipo: 'pf', ajudante: false } }).abrir(), /redirect:\/minha-conta\/verificacao$/);
  const ajudante = pagina({ v: { tipo: 'loja', ajudante: true } });
  const html = await ajudante.abrir();
  assert.match(html, /Só quem criou a loja pode pedir a verificação\./);
  assert.doesNotMatch(html, /Qual é o CNPJ da loja\?/);
  assert.deepEqual(ajudante.chamadas, [], 'ajudante não consulta a verificação');
  assert.match(await pagina({ v: null }).abrir(), /Abrir minha loja/);
});

test('sem WhatsApp confirmado: botão "Confirmar meu celular" com o destino codificado, sem assistente', async () => {
  const html = await pagina({ envio: { status: 'nao_enviada', motivo: null, whatsapp_ok: false } }).abrir();
  assert.match(html, /Confirmar meu celular/);
  assert.match(html, /href="\/confirmar-celular\?destino=%2Fminha-conta%2Floja%2Fverificar"/);
  assert.doesNotMatch(html, /Qual é o CNPJ da loja\?/);
});

test('consulta que falha avisa em role="alert" e não mostra o assistente', async () => {
  const html = await pagina({ rpcErro: true }).abrir();
  assert.match(html, /role="alert"[^>]*>Não foi possível consultar/);
  assert.doesNotMatch(html, /Qual é o CNPJ da loja\?/);
});

test('correção, recusada e obsoleta mostram o assistente no passo 1; o motivo aparece acima', async () => {
  const novo = await pagina().abrir();
  assert.match(novo, /Qual é o CNPJ da loja\?/);
  assert.match(novo, /Passo 1 de 4/);
  assert.match(novo, /<h2[^>]*tabindex="-1"/);
  assert.doesNotMatch(novo, /Não conseguimos ler o arquivo/);

  const correcao = await pagina({ envio: { status: 'correcao', motivo: 'arquivo_ilegivel', whatsapp_ok: true } }).abrir();
  assert.match(correcao, /Não conseguimos ler o arquivo\. Mande uma foto mais clara/);
  assert.match(correcao, /Qual é o CNPJ da loja\?/);
  const recusada = await pagina({ envio: { status: 'recusada', motivo: 'cnpj_inativo', whatsapp_ok: true } }).abrir();
  assert.match(recusada, /O CNPJ não está ativo na Receita/);
  const obsoleta = await pagina({ envio: { status: 'obsoleta', motivo: 'dados_mudaram', whatsapp_ok: true } }).abrir();
  assert.match(obsoleta, /Seus dados mudaram durante a conferência/);
  const desconhecido = await pagina({ envio: { status: 'correcao', motivo: 'motivo_novo', whatsapp_ok: true } }).abrir();
  assert.match(desconhecido, /Não foi possível verificar\. Fale com a equipe pela Ajuda\./);
});

test('passo 1: só avança com CNPJ válido; CPF e número errado têm mensagem própria', () => {
  assert.equal(passos.podeAvancar(1, { cnpj: '' }), false);
  assert.equal(passos.podeAvancar(1, { cnpj: '11.222.333/0001-80' }), false);
  assert.equal(passos.podeAvancar(1, { cnpj: '123' }), false);
  assert.equal(passos.podeAvancar(1, { cnpj: CNPJ_OK }), true);
  assert.equal(passos.podeAvancar(1, { cnpj: '11222333000181' }), true);
  assert.equal(passos.erroDoPasso(1, { cnpj: '529.982.247-25' }), 'Esse número é de CPF. O selo de loja pede CNPJ.');
  assert.equal(passos.erroDoPasso(1, { cnpj: '52998224725' }), 'Esse número é de CPF. O selo de loja pede CNPJ.');
  assert.equal(passos.erroDoPasso(1, { cnpj: '11.222.333/0001-80' }), 'Confira o número do CNPJ.');
  assert.equal(passos.erroDoPasso(1, { cnpj: CNPJ_OK }), null);
});

test('passo 2 não avança sem comprovante; passo 3 avança sem foto; arquivo ruim é barrado', () => {
  const base = { cnpj: CNPJ_OK };
  assert.equal(passos.podeAvancar(2, { ...base, comprovante: null }), false);
  assert.equal(passos.podeAvancar(2, base), false);
  assert.equal(passos.podeAvancar(2, { ...base, comprovante: arquivo() }), true);
  assert.equal(passos.podeAvancar(3, { ...base, comprovante: arquivo(), fachada: null }), true);
  assert.equal(passos.podeAvancar(3, { ...base, comprovante: arquivo() }), true);
  assert.equal(passos.podeAvancar(3, { ...base, comprovante: arquivo(), fachada: arquivo('f.jpg', 500, 'image/jpeg') }), true);
  assert.match(passos.erroDoPasso(2, { ...base, comprovante: null }), /Escolha o comprovante de endereço/);
  assert.match(passos.erroDoPasso(2, { ...base, comprovante: arquivo('a.pdf', 3 * 1024 * 1024) }), /até 2 MB/);
  assert.match(passos.erroDoPasso(2, { ...base, comprovante: arquivo('a.gif', 100, 'image/gif') }), /PDF, JPG ou PNG/);
  assert.match(passos.erroDoPasso(3, { ...base, comprovante: arquivo(), fachada: arquivo('f.gif', 100, 'image/gif') }), /PDF, JPG ou PNG|JPG ou PNG/);
});

test('passo 4: resumo com CNPJ, comprovante e fachada; aviso de IA exato', () => {
  assert.equal(passos.AVISO_IA, AVISO_IA);
  const r = passos.resumo({ cnpj: '11222333000181', comprovante: arquivo('luz.pdf'), fachada: null });
  assert.deepEqual(r.map((l) => [l.rotulo, l.valor, l.passo]), [
    ['CNPJ', CNPJ_OK, 1],
    ['Comprovante de endereço', 'luz.pdf', 2],
    ['Foto da frente da loja', 'Não enviada', 3],
  ]);
  assert.equal(passos.resumo({ cnpj: CNPJ_OK, comprovante: arquivo('luz.pdf'), fachada: arquivo('frente.jpg') })[2].valor, 'frente.jpg');
  assert.equal(passos.podeAvancar(4, { cnpj: CNPJ_OK, comprovante: arquivo() }), true);
  assert.equal(passos.podeAvancar(4, { cnpj: CNPJ_OK, comprovante: null }), false);
});

test('textos dos passos do assistente', () => {
  assert.deepEqual([1, 2, 3, 4].map((n) => passos.PERGUNTAS[n]), [
    'Qual é o CNPJ da loja?', 'Mande um comprovante de endereço', 'Quer mandar uma foto da frente da loja?', 'Confira e envie',
  ]);
});

test('o assistente (render do servidor) começa no passo 1 com campo de CNPJ, "Não tenho CNPJ" e botão grande', async () => {
  const html = await pagina().abrir();
  assert.match(html, /name="cnpj"/);
  assert.match(html, /inputMode="numeric"|inputmode="numeric"/);
  assert.match(html, /Não tenho CNPJ/);
  assert.match(html, /min-h-12/);
  assert.match(html, /text-facil/);
  assert.doesNotMatch(html, /Mande um comprovante de endereço/);
  assert.doesNotMatch(html, new RegExp(AVISO_IA.slice(0, 30)));
});

test('os outros passos (render do formulário) trazem os textos do roteiro', () => {
  const { PassoVerificacaoLoja } = carregar('src/components/conta/form-verificacao-loja.tsx', {
    'next/navigation': { useRouter: () => ({ refresh() {} }) },
  });
  const dados = { cnpj: CNPJ_OK, comprovante: arquivo('luz.pdf'), fachada: null };
  const props = { dados, erro: null, semCnpj: false, aoMudar() {}, aoEscolher() {}, aoRemover() {}, aoAlternarSemCnpj() {}, irPara() {} };
  const p1 = render(React.createElement(PassoVerificacaoLoja, { ...props, passo: 1, semCnpj: true }));
  assert.match(p1, /O selo de loja pede CNPJ\. Quem vende como pessoa física tem a própria verificação\./);
  assert.match(p1, /href="\/minha-conta\/verificacao"/);
  const p2 = render(React.createElement(PassoVerificacaoLoja, { ...props, passo: 2 }));
  assert.match(p2, /Conta de luz, água ou internet, no nome da empresa ou de um sócio\./);
  assert.match(p2, /Escolhido: luz\.pdf/);
  const p3 = render(React.createElement(PassoVerificacaoLoja, { ...props, passo: 3 }));
  assert.match(p3, /Esse passo é opcional\./);
  assert.match(p3, />Pular</);
  const p4 = render(React.createElement(PassoVerificacaoLoja, { ...props, passo: 4 }));
  assert.ok(p4.includes(AVISO_IA), 'aviso de IA exato no passo 4');
  assert.match(p4, /11\.222\.333\/0001-81/);
  assert.match(p4, /luz\.pdf/);
  assert.match(p4, /Alterar/);
  const erro = render(React.createElement(PassoVerificacaoLoja, { ...props, passo: 1, erro: 'Esse número é de CPF. O selo de loja pede CNPJ.' }));
  assert.match(erro, /role="alert"[^>]*>Esse número é de CPF\. O selo de loja pede CNPJ\./);
});

test('duplo toque em "Enviar" faz uma só requisição', async () => {
  const dados = { cnpj: CNPJ_OK, comprovante: { name: 'a.pdf', size: 10, type: 'application/pdf' }, fachada: null };
  const trava = passos.criarTrava();
  assert.equal(trava.pegar(), true);
  assert.equal(trava.pegar(), false);
  trava.soltar();
  assert.equal(trava.pegar(), true);

  let pedidos = 0;
  let corpo = null;
  const fetcher = async (url, init) => { pedidos++; corpo = { url, init }; await new Promise((r) => setTimeout(r, 10)); return { ok: true, status: 200, json: async () => ({ ok: true, mensagem: 'Documentos enviados para conferência.' }) }; };
  const t = passos.criarTrava();
  const [a, b] = await Promise.all([passos.enviarVerificacaoLoja(dados, t, fetcher), passos.enviarVerificacaoLoja(dados, t, fetcher)]);
  assert.equal(pedidos, 1);
  assert.deepEqual([a.tipo, b.tipo].sort(), ['ignorado', 'ok']);
  assert.equal(corpo.url, '/api/verificacao-loja');
  assert.equal(corpo.init.method, 'POST');
  assert.equal(corpo.init.body.get('cnpj'), '11222333000181');
  assert.equal(corpo.init.body.has('fachada'), false);
  // Depois de terminar, a trava solta (dá para tentar de novo se falhou).
  const c = await passos.enviarVerificacaoLoja(dados, t, fetcher);
  assert.equal(c.tipo, 'ok');
  assert.equal(pedidos, 2);
});

test('envio: erro do servidor mostra a mensagem; 409 pede atualizar; rede que cai tem texto próprio', async () => {
  const dados = { cnpj: CNPJ_OK, comprovante: { name: 'a.pdf', size: 10, type: 'application/pdf' }, fachada: null };
  const com = (status, corpo) => async () => ({ ok: status === 200, status, json: async () => corpo });
  const r400 = await passos.enviarVerificacaoLoja(dados, passos.criarTrava(), com(400, { ok: false, mensagem: 'Confira o número do CNPJ.' }));
  assert.deepEqual(r400, { tipo: 'erro', mensagem: 'Confira o número do CNPJ.', atualizar: false });
  const r409 = await passos.enviarVerificacaoLoja(dados, passos.criarTrava(), com(409, { ok: false, mensagem: 'Sua loja já tem um envio em análise. Atualize esta página.' }));
  assert.equal(r409.atualizar, true);
  const semCorpo = await passos.enviarVerificacaoLoja(dados, passos.criarTrava(), async () => ({ ok: false, status: 500, json: async () => { throw Error('x'); } }));
  assert.match(semCorpo.mensagem, /Não foi possível enviar/);
  const rede = await passos.enviarVerificacaoLoja(dados, passos.criarTrava(), async () => { throw Error('rede'); });
  assert.match(rede.mensagem, /Não conseguimos confirmar o envio/);
});

test('depois de chegar ao passo 4, "Enviar" ignora o toque por 600 ms', () => {
  assert.equal(passos.podeEnviar(null, 1000), false);
  assert.equal(passos.podeEnviar(1000, 1300), false);
  assert.equal(passos.podeEnviar(1000, 1600), true);
});

test('CampoArquivo: o tamanho "grande" é opcional e o padrão das outras telas não muda', () => {
  const { CampoArquivo } = carregar('src/components/ui/campo-arquivo.tsx');
  const normal = render(React.createElement(CampoArquivo, { rotulo: 'Documento', name: 'doc' }));
  assert.doesNotMatch(normal, /text-facil|min-h-12/);
  assert.match(normal, /text-rotulo/);
  const grande = render(React.createElement(CampoArquivo, { rotulo: 'Documento', name: 'doc', tamanho: 'grande', erro: 'Falhou' }));
  assert.match(grande, /min-h-12/);
  assert.match(grande, /text-facil/);
  assert.match(grande, /role="alert"/);
});

// Página da loja: o botão "Verificar minha loja" nos estados certos.
function paginaLoja(estado, envio, motivo = null) {
  const rpc = async (nome) => {
    if (nome === 'minha_loja_exclusao') return { data: { na_lixeira: false, tem_pagamentos: false }, error: null };
    if (nome === 'minha_verificacao_loja_envio') return envio === 'erro' ? { data: null, error: { message: 'x' } } : { data: envio ? [{ status: envio, motivo, whatsapp_ok: true }] : [], error: null };
    return { data: [{ estado, motivo }], error: null };
  };
  const dono = { id: 'loja-1', dono_id: 'user_dono', ajudante: false, tipo: 'loja', status: 'ativa', slug: 'loja', nome: 'Loja', whatsapp: '5589999990001', cidade: 'Corrente', bairro: null, logo_url: null, microrregiao_id: 'r', banner_tipo: 'modelo', banner_url: null, banner_modelo: 'liso', banner_cor: '#4B1248' };
  return carregar('src/app/(conta)/minha-conta/loja/page.tsx', {
    '@/lib/dados/regiao': { listarCidades: async () => [] },
    '@/lib/dados/vitrine-completa': {
      minhaVitrineCompleta: async () => dono,
      meusRecursosVitrine: async () => ({ foto_fachada: true, secoes_max: 3, fixados_max: 3, secoes_total: 0, fixados_total: 0, banner_moderado_motivo: null }),
      planosPublicos: async () => [],
      vitrineNovaAtiva: async () => false,
    },
    '@/lib/dados/categorias-ia': { minhasSugestoesCategoria: async () => [] },
    '@/lib/dados/historico': { lerHistorico: async () => [] },
    '@/lib/dados/destaques': { resultadosDestaques: async () => [] },
    '@/lib/supabase/server': { createClient: async () => ({ rpc }) },
    '@/lib/dados/loja-ativa': { lojasQueCuido: async () => [], lojaEscolhida: async () => null },
    '@/components/conta/seletor-loja': { SeletorLoja: () => null },
    '@/components/conta/form-minha-loja': { FormMinhaLoja: () => null },
    '@/components/destaques/destaques-ativos': { DestaquesAtivos: () => null },
    '@/components/vitrine/banner-loja': { BannerLoja: () => null },
    '@/components/conta/excluir-loja': { ExcluirLoja: () => null, LojaNaLixeira: () => null },
    '@/app/receber-loja/form-receber': { FormTerminarRecebimento: () => null },
    '@/lib/dados/montagem': { prontosPendentes: async () => 0 },
  }).default({ searchParams: Promise.resolve({}) });
}
const htmlLoja = async (...a) => render(await paginaLoja(...a));

test('página da loja: "Verificar minha loja" em correção, recusada e pendente sem envio; nunca em aprovada', async () => {
  const comBotao = (h) => /href="\/minha-conta\/loja\/verificar"/.test(h) && /Verificar minha loja/.test(h);
  const correcao = await htmlLoja('correcao', 'correcao', 'arquivo_ilegivel');
  assert.ok(comBotao(correcao));
  assert.match(correcao, /Não conseguimos ler o arquivo/);
  assert.ok(comBotao(await htmlLoja('recusada', 'recusada', 'cnpj_inativo')));
  assert.ok(comBotao(await htmlLoja('pendente', 'nao_enviada')));
  assert.ok(comBotao(await htmlLoja('pendente', 'obsoleta')));
  const aprovada = await htmlLoja('aprovada', 'aprovada');
  assert.match(aprovada, /Loja verificada\./);
  assert.doesNotMatch(aprovada, /Verificar minha loja/);
  for (const envio of ['conferindo', 'equipe']) {
    const h = await htmlLoja('pendente', envio);
    assert.doesNotMatch(h, /Verificar minha loja/, envio);
    assert.match(h, /Verificação pendente/);
  }
  // Sem saber se há envio em andamento, não oferece o botão em "pendente".
  assert.doesNotMatch(await htmlLoja('pendente', 'erro'), /Verificar minha loja/);
});
