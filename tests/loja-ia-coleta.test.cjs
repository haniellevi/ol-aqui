const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { carregar } = require('./carregar.cjs');

const { FormLojaIa, etapaInicial } = carregar('src/components/anunciar/form-loja-ia.tsx');
const entrada = { nome: '', cidade: '', site: '', instagram: '', facebook: '', cnpj: '', descricao: '', materiais: [], consultarWhatsapp: false, avisarWhatsapp: false };
const props = { cidades: [{ nome: 'Cidade', uf: 'CE' }], whatsappConfirmado: false, whatsappConsultaDisponivel: false, cnpjDisponivel: false, rascunho: { id: 'rascunho', revisao: 1, entrada }, salvar: async () => ({ revisao: 2 }), prepararEnvio: async () => ({ id: 'imagem', urlEnvio: '', token: '' }), finalizarEnvio: async () => ({ id: 'imagem' }), iniciar: async () => {} };

test('coleta começa por nome e cidade sem iniciar geração', () => {
  const html = renderToStaticMarkup(React.createElement(FormLojaIa, props));
  assert.match(html, /Nome da loja/);
  assert.match(html, /Cidade/);
  assert.doesNotMatch(html, /Gerar rascunho/);
});

test('retoma na etapa de fontes ou materiais conforme os dados guardados', () => {
  assert.equal(etapaInicial(entrada), 0);
  assert.equal(etapaInicial({ ...entrada, nome: 'Loja', cidade: 'Cidade' }), 1);
  assert.equal(etapaInicial({ ...entrada, nome: 'Loja', cidade: 'Cidade', site: 'https://exemplo.com' }), 2);
  assert.equal(etapaInicial({ ...entrada, nome: 'Loja', cidade: 'Cidade', redesConcluidas: true }), 2);
});

test('etapa de redes oferece pular sem mostrar geração', () => {
  const html = renderToStaticMarkup(React.createElement(FormLojaIa, { ...props, rascunho: { ...props.rascunho, entrada: { ...entrada, nome: 'Loja', cidade: 'Cidade' } } }));
  assert.match(html, /Site/);
  assert.match(html, /Instagram/);
  assert.match(html, /Facebook/);
  assert.match(html, /Agora não/);
  assert.doesNotMatch(html, /Gerar rascunho/);
});

test('etapa final oferece materiais, consentimentos separados e geração', () => {
  const html = renderToStaticMarkup(React.createElement(FormLojaIa, { ...props, rascunho: { ...props.rascunho, entrada: { ...entrada, nome: 'Loja', cidade: 'Cidade', site: 'https://exemplo.com' } } }));
  assert.match(html, /Descrição da loja/);
  assert.match(html, /Logo/);
  assert.match(html, /Foto/);
  assert.match(html, /Gerar rascunho/);
  assert.match(html, /Confirme seu WhatsApp/);
  assert.equal((html.match(/type="checkbox" disabled=""/g) || []).length, 1);
});

test('logo e foto têm botões visíveis e seletores acessíveis com formatos aceitos', () => {
  const html = renderToStaticMarkup(React.createElement(FormLojaIa, { ...props, rascunho: { ...props.rascunho, entrada: { ...entrada, nome: 'Loja', cidade: 'Cidade', redesConcluidas: true } } }));
  assert.match(html, /<button[^>]*>[\s\S]*?Enviar logo/);
  assert.match(html, /Enviar foto/);
  assert.equal((html.match(/type="file"/g) || []).length, 2);
  assert.equal((html.match(/accept="image\/jpeg,image\/png,image\/webp"/g) || []).length, 2);
  assert.match(html, /JPEG, PNG ou WebP de até 20 MB/);
  assert.match(html, /aria-label="Selecionar logo"/);
  assert.match(html, /aria-label="Selecionar foto"/);
});

test('retoma as prévias apenas dos materiais vinculados ao rascunho', () => {
  const html = renderToStaticMarkup(React.createElement(FormLojaIa, { ...props, imagens: { logo: '/logo.webp', foto: '/foto.webp', outra: '/outra.webp' }, rascunho: { ...props.rascunho, entrada: { ...entrada, nome: 'Loja', cidade: 'Cidade', materiais: ['logo', 'foto'] } } }));
  assert.match(html, /src="\/logo.webp"/);
  assert.match(html, /src="\/foto.webp"/);
  assert.doesNotMatch(html, /src="\/outra.webp"/);
});

test('consulta sem integração explica a limitação e oferece só o consentimento disponível', () => {
  const p = { ...props, whatsappConfirmado: true, rascunho: { ...props.rascunho, entrada: { ...entrada, nome: 'Loja', cidade: 'Cidade', redesConcluidas: true } } };
  const html = renderToStaticMarkup(React.createElement(FormLojaIa, p));
  assert.match(html, /importação do perfil do WhatsApp Business ainda não está habilitada/);
  assert.doesNotMatch(html, /Autorizo importar/);
  assert.match(html, /Me avise quando ficar pronto/);
  const disponivel = renderToStaticMarkup(React.createElement(FormLojaIa, { ...p, whatsappConsultaDisponivel: true }));
  assert.match(disponivel, /Autorizo importar/);
  assert.doesNotMatch(disponivel, /ainda não está habilitada/);
});

test('botão abre o seletor e envio confirmado atualiza materiais e prévia', async () => {
  const states = [];
  const refs = [];
  let cursor = 0;
  let refCursor = 0;
  const react = {
    ...React,
    useState(initial) {
      const i = cursor++;
      if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial;
      return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value; }];
    },
    useRef(initial) {
      const i = refCursor++;
      refs[i] ??= { current: initial };
      return refs[i];
    },
  };
  const chamadas = [];
  let uploadOk = true;
  const ok = dados => ({ ok: true, dados });
  const { FormLojaIa: Formulario } = carregar('src/components/anunciar/form-loja-ia.tsx', {
    react,
    '@/lib/fotos': {
      reduzirFoto: async () => { chamadas.push('reduzir'); return { blob: { size: 40, type: 'image/webp' }, formato: 'webp' }; },
      enviarFoto: async foto => { assert.equal(foto.size, 40); chamadas.push('upload'); return uploadOk; },
    },
  });
  const p = {
    ...props,
    rascunho: { ...props.rascunho, entrada: { ...entrada, nome: 'Loja', cidade: 'Cidade', redesConcluidas: true } },
    prepararEnvio: async (_id, arquivo, tipo) => { assert.deepEqual(arquivo, { nome: 'logo.webp', tipo: 'image/webp', tamanho: 40 }); chamadas.push(tipo); return ok({ id: 'original', urlEnvio: '/envio', token: '' }); },
    finalizarEnvio: async () => ok({ id: 'normalizada' }),
    salvar: async (_id, _revisao, dados) => { chamadas.push(dados.materiais); return ok({ revisao: 2 }); },
  };
  const render = () => { cursor = 0; refCursor = 0; return Formulario(p); };
  function achar(elemento, predicado) {
    if (!elemento || typeof elemento !== 'object') return null;
    if (predicado(elemento)) return elemento;
    for (const filho of React.Children.toArray(elemento.props?.children)) {
      const achado = achar(filho, predicado);
      if (achado) return achado;
    }
    return null;
  }
  let arvore = render();
  const seletor = achar(arvore, el => el.props?.['aria-label'] === 'Selecionar logo');
  seletor.props.ref({ click: () => chamadas.push('seletor') });
  achar(arvore, el => el.props?.onClick && React.Children.toArray(el.props.children).join('') === 'Enviar logo').props.onClick();
  seletor.props.onChange({ target: { files: [{ name: 'logo.png', type: 'image/png', size: 100 }], value: 'logo.png' } });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(chamadas, ['seletor', 'reduzir', 'logo', 'upload', ['normalizada']]);
  assert.match(renderToStaticMarkup(render()), /src="\/api\/loja\/imagem\/normalizada\/revisao\?rascunho=rascunho"/);
  chamadas.length = 0;
  arvore = render();
  uploadOk = false;
  achar(arvore, el => el.props?.['aria-label'] === 'Selecionar logo').props.onChange({ target: { files: [{ name: 'logo.png', type: 'image/png', size: 100 }], value: 'logo.png' } });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(chamadas, ['reduzir', 'logo', 'upload']);
  assert.match(renderToStaticMarkup(render()), /Não foi possível enviar a imagem/);
  assert.match(renderToStaticMarkup(render()), /normalizada/);
  chamadas.length = 0;
  arvore = render();
  achar(arvore, el => el.props?.['aria-label'] === 'Selecionar foto').props.onChange({ target: { files: [{ name: 'foto.gif', type: 'image/gif', size: 100 }], value: 'foto.gif' } });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(chamadas, []);
  assert.match(renderToStaticMarkup(render()), /Escolha uma imagem JPEG, PNG ou WebP/);
});

async function entradaLoja(params = {}, autorizado = true) {
  const { default: Pagina } = carregar('src/app/(conta)/quero-vender/loja/page.tsx', {
    '@/lib/assistente': { comAssistente: href => href, tentativaAssistente: () => null },
    '@/lib/dados/conta': { meuPerfilEVitrine: async () => ({ perfil: { microrregiao_id: 'regiao', cidade: 'Corrente' }, vitrine: null, plano: null }) },
    '@/lib/dados/regiao': { listarCidades: async () => [{ nome: 'Corrente', uf: 'PI' }] },
    '../_dados': { testeGratis: async () => ({ dias: 7, limite: 10 }) },
    '@/lib/supabase/server': { createClient: async () => ({ rpc: async () => ({ data: autorizado, error: null }) }) },
    './criar-com-ia/actions': { abrirRascunho: () => {} },
    '@/components/anunciar/form-loja': { FormLoja: () => React.createElement('form', null, 'Formulário manual') },
  });
  return renderToStaticMarkup(await Pagina({ searchParams: Promise.resolve(params) }));
}
test('novo lojista encontra criação com IA primeiro e alternativa manual acessível', async () => {
  const html = await entradaLoja();
  assert.match(html, /Começar com IA/);
  assert.match(html, /href="\/quero-vender\/loja\?manual=1"/);
  assert.ok(html.indexOf('criar-loja-ia') < html.indexOf('criar-loja-manual'));
  assert.doesNotMatch(html, /Formulário manual/);
});
test('escolha manual abre formulário e falha da IA oferece nova tentativa', async () => {
  assert.match(await entradaLoja({ manual: '1' }), /Formulário manual/);
  assert.match(await entradaLoja({ aviso: 'ia' }), /Não foi possível abrir o cadastro com IA/);
});
