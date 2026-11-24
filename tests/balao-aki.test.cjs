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
  avisoIa: 'A Lia usa IA.',
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
    "@/components/ui/dialog": {
      Dialog: ({ children }) => React.createElement(React.Fragment, null, children),
      DialogConversaContent: ({ children }) => React.createElement("section", { role: "dialog" }, children),
      DialogTitle: ({ children, ...props }) => React.createElement("h2", props, children),
    },
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

test('BalaoAki fechado garante toque >= 44px no atalho e no convite da Lia', () => {
  const html = renderBalao({
    modo: 'balao',
    estados: { aberto: false, dica: { texto: 'Quer ajuda da Lia?', pedido: {} } },
  });
  assert.match(html, /data-aki-atalho[^>]*min-h-toque/);
  assert.match(html, /aria-label="Abrir conversa com a Lia"[^>]*>.*Lia<\/button>/);
  assert.match(html, /data-aki-dica/);
  assert.match(html, /aria-label="Fechar o convite da Lia" class="[^"]*size-toque/);
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
  assert.match(htmlFolhaVazia, /aria-label="Fechar conversa com a Lia" class="[^"]*size-toque/);
  assert.match(htmlFolhaVazia, /<h2 id="aki-titulo"[^>]*>Lia<\/h2>/);
  assert.match(htmlFolhaVazia, /<label[^>]*for="aki-texto"[^>]*>Mensagem para a Lia<\/label>/);
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

// P0: a busca pode ocultar o atalho, nunca o contêiner da conversa.
test("busca mobile mantém contêiner do assistente visível e conversa usa portal modal", () => {
  const fs = require("node:fs");
  const css = fs.readFileSync("src/app/globals.css", "utf8");
  assert.doesNotMatch(css, /[^{}]*\.assistente-publico[^{}]*\{[^{}]*display:\s*none/s);
  assert.match(css, /\[data-comprador\][^{}]*\[data-aki-atalho\]/);
  const balao = fs.readFileSync("src/components/aki/balao-aki.tsx", "utf8");
  assert.match(balao, /pagina \? \"section\" : DialogConversaContent/);
  assert.doesNotMatch(balao, /document\.body\.style\.overflow\s*=/);
  const dialog = fs.readFileSync("src/components/ui/dialog.tsx", "utf8");
  assert.match(dialog, /function DialogConversaContent[\s\S]*?<DialogPortal>[\s\S]*?<DialogPrimitive\.Popup/);
});

test("folha de conversa preserva posicionamento mesmo sem className do consumidor", () => {
  const { DialogConversaContent } = carregar("src/components/ui/dialog.tsx", {
    "@base-ui/react/dialog": { Dialog: {
      Portal: ({ children }) => React.createElement(React.Fragment, null, children),
      Backdrop: (props) => React.createElement("div", props),
      Popup: (props) => React.createElement("section", props),
    } },
  });
  const html = render(React.createElement(DialogConversaContent, { className: undefined }, "Exemplo"));
  assert.match(html, /<section class=\"[^\"]*fixed[^\"]*h-\[88dvh\]/);
});

test("entrada na própria tentativa não repete Continuar", () => {
  function entrada(ocultarContinuar) {
    let i = 0;
    const valores = [false, { atual: { objetivo: "procurar", tentativa: "exemplo", dono: null } }];
    const { EntradaAssistente } = carregar("src/components/assistente/entrada.tsx", { react: { ...React, useState: () => [valores[i++], () => {}], useEffect: () => {}, useRef: () => ({current:null}) } });
    return render(React.createElement(EntradaAssistente, {dono:null, ocultarContinuar}));
  }
  assert.match(entrada(false), /Continuar/);
  assert.doesNotMatch(entrada(true), /Continuar/);
  assert.match(entrada(true), /Preciso de ajuda/);
});
