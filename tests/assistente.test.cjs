const { test } = require('node:test');
const assert = require('node:assert/strict');
const { carregar } = require('./carregar.cjs');
const { lerProgresso, podeConcluir, linkAssistente, comAssistente, etapaAnuncio } = carregar('src/lib/assistente.ts');

const tentativa = '29c64cc8-609d-4ffc-81f5-7036063a15b2';
const anterior = '66a3e370-b6bd-4e22-a06c-1a77db18bf7b';
const progresso = { dono: 'user_a', tentativa, objetivo: 'loja' };

test('retomada só lê progresso da conta atual e ignora armazenamento inválido', () => {
  const raw = JSON.stringify(progresso);
  assert.deepEqual(lerProgresso(raw, 'user_a'), progresso);
  assert.equal(lerProgresso(raw, 'user_b'), null);
  assert.equal(lerProgresso(raw, null), null);
  assert.equal(lerProgresso('{', 'user_a'), null);
  assert.equal(lerProgresso(JSON.stringify({ ...progresso, objetivo: '//externo.test' }), 'user_a'), null);
});

test('uma aba antiga não conclui a tentativa atual', () => {
  assert.equal(podeConcluir(progresso, anterior), false);
  assert.equal(podeConcluir(progresso, tentativa), true);
});

test('retorno é interno e mantém filtros ao acrescentar a tentativa', () => {
  assert.equal(linkAssistente('procurar', tentativa), '/assistente?objetivo=procurar&tentativa=' + tentativa);
  assert.equal(comAssistente('/radar/pedir?q=mesa&cidade=Corrente', tentativa), '/radar/pedir?q=mesa&cidade=Corrente&assistente=' + tentativa);
  assert.equal(comAssistente('/radar/pedir?q=mesa', '//externo.test'), '/radar/pedir?q=mesa');
});

test('rascunho com dados já preenchidos volta ao primeiro passo obrigatório faltante', () => {
  const rascunho = { fotos: ['capa'], categoria_id: 'cat', titulo: 'Mesa de madeira', descricao: 'Madeira', preco_centavos: 1000, cidade: null };
  assert.equal(etapaAnuncio(rascunho), 'local');
  assert.equal(etapaAnuncio({ ...rascunho, cidade: 'Corrente' }), 'revisar');
  assert.equal(etapaAnuncio({ ...rascunho, cidade: 'Corrente', preco_centavos: null }), 'revisar');
  assert.equal(etapaAnuncio({ ...rascunho, cidade: 'Corrente', titulo: 'Mesa' }), 'detalhes');
});

test('o retorno autenticado vincula a tentativa antes de enviar para confirmar perfil', async () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const { default: pagina } = carregar('src/app/assistente/page.tsx', {
    '@clerk/nextjs/server': { auth: async () => ({ userId: 'user_a' }) },
    '@/lib/perfil': { garantirPerfil: async () => 'user_a' },
    '@/lib/dados/conta': { meuPerfilEVitrine: async () => ({ perfil: { whatsapp: null } }) },
    '@/lib/dados/paginas': { termosPendentes: async () => [] },
    '@/components/assistente/retomar': { VincularAssistente: ({ dono, destino }) => React.createElement('a', { 'data-dono': dono, href: destino }, 'Continuar') },
  });
  const html = renderToStaticMarkup(await pagina({ searchParams: Promise.resolve({ objetivo: 'procurar', tentativa, radar: '1' }) }));
  assert.match(html, /data-dono="user_a"/);
  assert.match(html, /completar-perfil\?redirect_url=%2Fassistente%3Fobjetivo%3Dprocurar%26tentativa%3D/);
  assert.match(html, /%26radar%3D1/);
});

test('o login assistido vincula o objetivo antes da tela obrigatória de perfil', async () => {
  const { default: entrar } = carregar('src/app/entrar/[[...entrar]]/page.tsx', {
    'next/image': {}, 'next/link': {}, '@clerk/nextjs': { SignIn: 'ClerkSignIn' },
  });
  const destino = linkAssistente('procurar', tentativa) + '&radar=1';
  const tela = await entrar({ searchParams: Promise.resolve({ redirect_url: destino }) });
  const login = tela.props.children.find(e => e.type === 'ClerkSignIn');
  assert.equal(login.props.forceRedirectUrl, destino);
  assert.equal(login.props.signUpForceRedirectUrl, destino);
});

test('o destino do Radar recupera os filtros ou abre o pedido já recebido', () => {
  const { destinoRadarAssistente } = carregar('src/lib/assistente.ts');
  const radar = { dono: 'user_a', objetivo: 'procurar', tentativa, radar: { q: 'cadeira de madeira', cidade: 'Corrente', precoMax: '150' } };
  const url = new URL(destinoRadarAssistente(radar, tentativa), 'https://olaki.invalid');
  assert.equal(url.pathname, '/radar/pedir');
  assert.equal(url.searchParams.get('q'), 'cadeira de madeira');
  assert.equal(url.searchParams.get('cidade'), 'Corrente');
  assert.equal(url.searchParams.get('preco_max'), '150');
  assert.equal(url.searchParams.get('assistente'), tentativa);
  const concluido = destinoRadarAssistente({ ...radar, pedidoId: anterior }, tentativa);
  assert.equal(concluido, '/radar/pedido/' + anterior + '?novo=1&assistente=' + tentativa);
  assert.equal(destinoRadarAssistente(radar, anterior), '/radar/pedir?assistente=' + anterior);
});

test('adiar os termos no assistente volta ao início sem repetir a mesma etapa', async () => {
  const React = require('react');
  const { default: pagina } = carregar('src/app/completar-perfil/page.tsx', {
    '@clerk/nextjs/server': { auth: async () => ({ userId: 'user_a' }) },
    '@/lib/perfil': { garantirPerfil: async () => 'user_a' },
    '@/lib/dados/conta': { meuPerfilEVitrine: async () => ({ perfil: { whatsapp: 'teste', whatsapp_verificado_em: 'hoje' } }) },
    '@/lib/dados/paginas': { termosPendentes: async () => [{ id: 'termo', tipo: 'termos' }] },
    './botao-aceitar': { BotaoAceitarTermos: 'Termos' },
  });
  const tela = await pagina({ searchParams: Promise.resolve({ redirect_url: linkAssistente('loja', tentativa) }) });
  const rodape = React.Children.toArray(tela.props.children).find((e) => e.props.destino);
  assert.equal(rodape.props.destino, linkAssistente('loja', tentativa));
  assert.equal(rodape.props.adiarHref, '/');
});

test('conta com loja mostra o nome da própria vitrine antes de anunciar um item', async () => {
  const { renderToStaticMarkup } = require('react-dom/server');
  const { default: pagina } = carregar('src/app/assistente/page.tsx', {
    '@clerk/nextjs/server': { auth: async () => ({ userId: 'user_a' }) },
    '@/lib/perfil': { garantirPerfil: async () => 'user_a' },
    '@/lib/dados/conta': { meuPerfilEVitrine: async () => ({
      perfil: { whatsapp: 'teste', whatsapp_verificado_em: 'hoje' },
      vitrine: { tipo: 'loja', nome: 'Oficina da Praça', status: 'ativa' },
    }) },
    '@/lib/dados/paginas': { termosPendentes: async () => [] },
    '@/app/(conta)/quero-vender/actions': { anunciarPelaVitrinePropria: async () => {} },
  });
  const tela = await pagina({ searchParams: Promise.resolve({ objetivo: 'item', tentativa }) });
  const html = renderToStaticMarkup(tela);
  assert.match(html, /O anúncio sairá pela loja Oficina da Praça/);
  assert.match(html, /Anunciar pela loja/);
});

test('confirmar a loja escolhe a própria mesmo que exista loja ajudada', async () => {
  const chamadas = [];
  const { anunciarPelaVitrinePropria } = carregar('src/app/(conta)/quero-vender/actions.ts', {
    'next/navigation': { redirect: (url) => { throw Error(url); } },
    '@/lib/dados/loja-ativa': {
      lojasQueCuido: async () => [{ id: anterior, dono: false }, { id: tentativa, dono: true }],
      guardarLojaEscolhida: async (id) => { chamadas.push(id); return true; },
    },
  });
  await assert.rejects(anunciarPelaVitrinePropria(tentativa, 'item'),
    (error) => error.message === '/anunciar?assistente=' + tentativa);
  assert.deepEqual(chamadas, [tentativa]);
  await assert.rejects(anunciarPelaVitrinePropria('//fora.invalid', 'item'),
    (error) => error.message === '/anunciar');
  assert.deepEqual(chamadas, [tentativa]);
});
