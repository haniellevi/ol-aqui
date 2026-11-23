const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup: render } = require('react-dom/server');
const { carregar } = require('./carregar.cjs');

const ESTADO_BASE = {
  ligado: true,
  logado: true,
  pode: true,
  motivo: null,
  avisoIa: 'O Merc usa IA.',
  boasVindas: 'Olá! Acesse https://mercadodaregiao.com.br/exemplo-boas-vindas-longo',
  sugestoes: ['Preciso de ajuda com https://mercadodaregiao.com.br/sugestao-longa'],
  maxCaracteres: 500,
  restantes: 5,
  fotoLadoMaximo: 1024,
  conversaId: 'conv-1',
  mensagens: [],
};

function renderBalao({ modo = 'balao', estados = {} } = {}) {
  const valores = [
    estados.estado ?? ESTADO_BASE,
    false,
    estados.aberto ?? (modo === 'pagina'),
    false,
    estados.mensagens ?? [],
    'conv-1',
    '',
    estados.foto ?? null,
    false,
    false,
    null,
    null,
    null,
    false,
    false,
    false,
    estados.dica ?? null,
    '/',
  ];
  let indice = 0;
  const { BalaoAki } = carregar('src/components/aki/balao-aki.tsx', {
    react: {
      ...React,
      useState: (inicial) => {
        const valor = indice < valores.length ? valores[indice] : (typeof inicial === 'function' ? inicial() : inicial);
        indice++;
        return [valor, () => {}];
      },
      useEffect: () => {},
      useCallback: (fn) => fn,
      useRef: (v) => ({ current: v }),
    },
    'next/navigation': { usePathname: () => '/' },
    '@/lib/fotos': { enviarFoto: async () => true, reduzirFoto: async () => ({}) },
    '@/lib/dados/fotos': { apagarFoto: async () => {}, criarUrlEnvioFoto: async () => ({ ok: false, erro: { mensagem: '' } }) },
    '@/lib/aki/acoes': { adicionarFotoRascunho: async () => ({ ok: true }), apagarMinhasConversas: async () => ({ ok: true, mensagem: '' }) },
    './resposta-aki': { RespostaAki: () => React.createElement('div', { 'data-resposta-mock': true }) },
  });
  return render(React.createElement(BalaoAki, { modo }));
}

test('BalaoAki fechado garante toque >= 44px no atalho e no convite do Merc', () => {
  const html = renderBalao({
    modo: 'balao',
    estados: { aberto: false, dica: { texto: 'Quer ajuda do Merc?', pedido: {} } },
  });
  assert.match(html, /data-aki-atalho[^>]*min-h-toque/);
  assert.match(html, /data-aki-dica/);
  assert.match(html, /aria-label="Fechar o convite do Merc" class="[^"]*size-toque/);
  assert.doesNotMatch(html, /\b(?:h-10|min-h-10|size-10)\b/);
});

test('BalaoAki aberto usa alvos >= 44px, Enviar de 48px e quebra de URLs longas', () => {
  const htmlPagina = renderBalao({
    modo: 'pagina',
    estados: {
      aberto: true,
      mensagens: [
        { id: 1, papel: 'usuario', conteudo: { texto: 'https://mercadodaregiao.com.br/token-gigante-sem-espacos-para-320px', foto: false }, criado_em: '2026-11-23T12:00:00Z' },
      ],
      foto: { base64: '', tipo: 'image/webp', previa: 'blob:previa', blob: {}, formato: 'webp' },
    },
  });
  assert.match(htmlPagina, /aria-label="Voltar ao início" class="[^"]*size-toque/);
  assert.match(htmlPagina, /class="[^"]*min-h-toque[^"]*"[^>]*>.*Apagar conversa/s);
  assert.match(htmlPagina, /aria-label="Tirar a foto" class="[^"]*size-toque/);
  assert.match(htmlPagina, /class="[^"]*min-h-toque min-w-toque[^"]*"[^>]*>.*Foto<\/button>/s);
  assert.match(htmlPagina, /<textarea id="aki-texto"[^>]*class="[^"]*min-h-toque/);
  const botaoEnviar = htmlPagina.match(/<button type="submit"[\s\S]*?<\/button>/)?.[0] ?? '';
  assert.match(botaoEnviar, /\bmin-h-acao\b/);
  assert.match(botaoEnviar, /Enviar/);
  assert.match(htmlPagina, /\[overflow-wrap:anywhere\]/);
  assert.match(htmlPagina, /break-words/);
  assert.doesNotMatch(htmlPagina, /\b(?:h-10|min-h-10|size-10)\b/);

  const htmlFolhaVazia = renderBalao({ modo: 'balao', estados: { aberto: true, mensagens: [] } });
  assert.match(htmlFolhaVazia, /aria-label="Fechar" class="[^"]*size-toque/);
  assert.match(htmlFolhaVazia, /\[overflow-wrap:anywhere\]/);
  assert.match(htmlFolhaVazia, /break-words/);
});

test('RespostaAki usa botões de avaliação >= 44px e quebra URLs longas nas mensagens', () => {
  const { RespostaAki } = carregar('src/components/aki/resposta-aki.tsx', {
    '@/lib/aki/acoes': {
      abrirAtendimentoCadastro: async () => ({ ok: true }),
      avaliarResposta: async () => ({ ok: true }),
      confirmarPedidoRadar: async () => ({ ok: true, mensagem: 'ok' }),
    },
    '@/components/anuncio/card-anuncio': { CardAnuncio: () => React.createElement('div') },
  });
  const html = render(React.createElement(RespostaAki, {
    mensagem: {
      id: 99,
      papel: 'assistente',
      conteudo: { texto: 'Veja https://mercadodaregiao.com.br/url-muito-longa-sem-quebra-natural' },
      criado_em: '2026-11-23T12:00:00Z',
      nota: null,
    },
    escrevendo: false,
    pensando: null,
    aoAvaliar: () => {},
  }));
  assert.match(html, /\[overflow-wrap:anywhere\]/);
  assert.match(html, /break-words/);
  assert.match(html, /aria-label="Ajudou"[^>]*class="[^"]*size-toque/);
  assert.match(html, /aria-label="Não ajudou"[^>]*class="[^"]*size-toque/);
  assert.doesNotMatch(html, /\bsize-10\b/);
});
