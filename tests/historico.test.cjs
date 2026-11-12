const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup: render } = require('react-dom/server');
const { carregar } = require('./carregar.cjs');

// Etapa P5a: histórico visível ao dono e ações do super admin.
const H = carregar('src/lib/historico.ts');
const AGORA = new Date('2026-11-13T12:00:00-03:00');
const linha = (extra) => ({ quando: '2026-11-12T14:30:00-03:00', acao: 'editou', de: null, para: null, motivo: null, papel: 'dono', nome: 'Raniel', e_voce: false, ...extra });

test('quem fez: você, equipe com a marca, ajudante, dono e sistema', () => {
  assert.equal(H.quemFez(linha({ e_voce: true })), 'você');
  assert.equal(H.quemFez(linha({ papel: 'equipe', nome: 'Ana' })), 'Ana (Equipe Mercado da Região)');
  assert.equal(H.quemFez(linha({ papel: 'equipe', nome: null })), 'a Equipe Mercado da Região');
  assert.equal(H.quemFez(linha({ papel: 'ajudante', nome: 'João' })), 'João (ajudante da loja)');
  assert.equal(H.quemFez(linha({ papel: 'dono', nome: '' })), 'o dono');
  assert.equal(H.quemFez(linha({ papel: 'sistema', nome: null })), 'o sistema');
});

test('frase completa com data no fuso da região e sem "por o sistema"', () => {
  assert.equal(H.fraseHistorico(linha({ papel: 'equipe', nome: 'Ana' }), AGORA), 'Editado por Ana (Equipe Mercado da Região) em 12/11 às 14:30');
  assert.equal(H.fraseHistorico(linha({ acao: 'status', de: 'ativo', para: 'expirado', papel: 'sistema', nome: null }), AGORA), 'Expirou em 12/11 às 14:30');
  assert.equal(H.fraseHistorico(linha({ acao: 'lixeira', e_voce: true }), AGORA), 'Enviado para a lixeira por você em 12/11 às 14:30');
  assert.equal(H.fraseHistorico(linha({ quando: '2025-01-05T09:05:00-03:00' }), AGORA), 'Editado por Raniel em 05/01/2025 às 09:05');
});

test('o que aconteceu: publicar, pausar, vender, restaurar e situação desconhecida', () => {
  assert.equal(H.oQueAconteceu({ acao: 'criou' }), 'Publicado');
  assert.equal(H.oQueAconteceu({ acao: 'status', de: 'rascunho', para: 'em_analise' }), 'Publicado');
  assert.equal(H.oQueAconteceu({ acao: 'status', de: 'ativo', para: 'pausado' }), 'Pausado');
  assert.equal(H.oQueAconteceu({ acao: 'status', de: 'ativo', para: 'vendido' }), 'Marcado como vendido');
  assert.equal(H.oQueAconteceu({ acao: 'restaurou' }), 'Restaurado da lixeira');
  assert.equal(H.oQueAconteceu({ acao: 'status', de: 'ativo', para: 'outro' }), 'Situação alterada');
  assert.equal(H.dataHistorico('não é data'), '');
});

test('P5c: no histórico da loja, "criou" é a loja montada pela equipe, não uma publicação', () => {
  assert.equal(H.oQueAconteceu({ acao: 'criou' }, 'loja'), 'Loja criada');
  assert.equal(H.oQueAconteceu({ acao: 'criou' }, 'anuncio'), 'Publicado');
  assert.equal(H.fraseHistorico(linha({ acao: 'criou', e_voce: true }), AGORA, 'loja'), 'Loja criada por você em 12/11 às 14:30');
  const { ListaHistorico } = carregar('src/components/conta/lista-historico.tsx');
  const html = render(React.createElement(ListaHistorico, { alvo: 'loja', vazio: 'Nada ainda.', linhas: [linha({ acao: 'criou', papel: 'equipe', nome: 'Ana' })] }));
  assert.match(html, /Loja criada por Ana \(Equipe Mercado da Região\)/);
  assert.doesNotMatch(html, /Publicado/);
});

test('lista do histórico: uma linha por mudança, com motivo; vazia mostra o aviso', () => {
  const { ListaHistorico } = carregar('src/components/conta/lista-historico.tsx');
  const html = render(React.createElement(ListaHistorico, { vazio: 'Nada ainda.', linhas: [
    linha({ acao: 'lixeira', papel: 'equipe', nome: 'Ana', motivo: 'Produto proibido' }),
    linha({ e_voce: true }),
  ] }));
  assert.equal((html.match(/<li/g) || []).length, 2);
  assert.match(html, /Enviado para a lixeira por Ana \(Equipe Mercado da Região\)/);
  assert.match(html, /Motivo: Produto proibido/);
  assert.match(html, /Editado por você/);
  const vazia = render(React.createElement(ListaHistorico, { vazio: 'Nada ainda.', linhas: [] }));
  assert.match(vazia, /Nenhuma mudança registrada/);
  assert.match(vazia, /Nada ainda\./);
});

test('categorias sugeridas: admin comum vê o pedido, mas não os botões de decidir', () => {
  const mocks = {
    react: { ...React, useActionState: () => [null, () => {}, false], useState: (v) => [v, () => {}], useId: () => 'u' },
    './actions': { decidirSugestoes() {} },
    '@/components/ui/confirmar': { useConfirmar: () => () => Promise.resolve(true), confirmarAntes: (_c, f) => f },
  };
  const mod = carregar('src/app/admin/categorias/sugeridas/formularios.tsx', mocks);
  const item = { grupo: { texto: 'ração', texto_norm: 'racao', quantidade: 2, anuncios: 2, primeira: '2026-11-10T10:00:00Z', ultima: '2026-11-11T10:00:00Z', proximas: [], parecidas: [] }, paiPadrao: '', finalPadrao: '', parecidas: [] };
  const so = render(React.createElement(mod.CartaoSugestao, { item, maes: [], finais: [], podeDecidir: false }));
  assert.match(so, /ração/);
  assert.doesNotMatch(so, /<form/);
  const todos = render(React.createElement(mod.CartaoSugestao, { item, maes: [], finais: [] }));
  assert.match(todos, /<form/);
});
