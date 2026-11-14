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
  assert.equal((html.match(/type="checkbox" disabled=""/g) || []).length, 2);
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
