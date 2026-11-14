const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { carregar } = require('./carregar.cjs');

const { FormLojaIa, etapaInicial } = carregar('src/components/anunciar/form-loja-ia.tsx');
const entrada = { nome: '', cidade: '', site: '', instagram: '', facebook: '', cnpj: '', descricao: '', materiais: [], consultarWhatsapp: false, avisarWhatsapp: false };
const props = { cidades: [{ nome: 'Cidade', uf: 'CE' }], whatsappConfirmado: false, rascunho: { id: 'rascunho', revisao: 1, entrada }, salvar: async () => ({ revisao: 2 }), enviarMaterial: async () => 'imagem', iniciar: async () => {} };

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
