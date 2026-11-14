const assert = require('node:assert/strict');
const { test } = require('node:test');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { carregar } = require('./carregar.cjs');

function render(arquivo, nome, props) {
  const componentes = carregar(arquivo);
  return renderToStaticMarkup(React.createElement(componentes[nome], props));
}

test('Botao e Chip compartilham a altura de toque sem ativar a redução do mouse', () => {
  for (const [arquivo, nome] of [['botao', 'Botao'], ['chip', 'Chip']]) {
    const html = render(`src/components/ui/${arquivo}.tsx`, nome, { tamanho: 'toque', children: 'Continuar' });
    assert.match(html, /min-h-toque/);
    assert.doesNotMatch(html, /olaki-controle/);
  }
});

test('campos preservam descrições, erros e estado inválido informado pelo consumidor', () => {
  for (const [arquivo, nome] of [['ui/campo', 'Campo'], ['conta/seletor', 'Seletor']]) {
    const props = { name: 'cidade', rotulo: 'Cidade', dica: 'Use sua cidade', erro: 'Selecione a cidade',
      tamanho: 'toque', 'aria-describedby': 'ajuda-externa', ...(nome === 'Seletor' && { children: React.createElement('option', {}, 'Corrente') }) };
    const html = render(`src/components/${arquivo}.tsx`, nome, props);
    assert.match(html, /aria-describedby="campo-cidade-erro campo-cidade-dica ajuda-externa"/);
    assert.match(html, /aria-invalid="true"/);
    assert.match(html, /h-toque/);
    assert.match(render(`src/components/${arquivo}.tsx`, nome, { ...props, erro: undefined, 'aria-invalid': true }), /aria-invalid="true"/);
  }
});
