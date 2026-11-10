const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { carregar } = require('./carregar.cjs');
const { mascaraCelular } = carregar('src/lib/formato.ts');

test('máscara acompanha a digitação e aceita colagem nacional ou com +55', () => {
  for (const [entrada, esperado] of [
    ['', ''], ['8', '(8'], ['89', '(89'], ['899', '(89) 9'],
    ['8999999', '(89) 99999'], ['89999990', '(89) 99999-0'],
    ['89999990000', '(89) 99999-0000'],
    ['+55 (89) 99999-0000', '(89) 99999-0000'],
    ['5589999990000', '(89) 99999-0000'],
    ['55999990000', '(55) 99999-0000'],
    ['+55 (55) 99999-0000', '(55) 99999-0000'],
  ]) assert.equal(mascaraCelular(entrada), esperado, entrada);
});

test('máscara preserva excesso e código estrangeiro para não criar outro celular válido', () => {
  for (const [entrada, digitos] of [
    ['899999900001', '899999900001'], ['8999999000012', '8999999000012'],
    ['+55899999900001', '899999900001'],
    ['(55) 99999-00012', '559999900012'], ['(55) 99999-000123', '5599999000123'],
  ]) {
    const resultado = mascaraCelular(entrada);
    assert.equal(resultado.replace(/\D/g, ''), digitos, entrada);
    assert.doesNotMatch(resultado, /^\([1-9][0-9]\) 9[0-9]{4}-[0-9]{4}$/, entrada);
  }
  assert.equal(mascaraCelular('+1 89999990000'), '+1 89999990000');
});

function encontrar(no, predicado) {
  if (!React.isValidElement(no)) return null;
  if (predicado(no)) return no;
  for (const filho of React.Children.toArray(no.props.children)) {
    const achado = encontrar(filho, predicado);
    if (achado) return achado;
  }
  return null;
}

// Reexecuta o componente com estado persistente; serviços, CAPTCHA e DOM são fronteiras simuladas.
function formulario(numero = '') {
  const celulas = [], chamadas = [], tarefas = [];
  let indice = 0, arvore;
  const estado = inicial => {
    const i = indice++;
    if (!Object.hasOwn(celulas, i)) celulas[i] = typeof inicial === 'function' ? inicial() : inicial;
    return [celulas[i], valor => { celulas[i] = typeof valor === 'function' ? valor(celulas[i]) : valor; }];
  };
  const { ConfirmarWhatsapp } = carregar('src/components/conta/confirmar-whatsapp.tsx', {
    react: {
      ...React, useState: estado, useRef: inicial => estado(() => ({ current: inicial }))[0],
      useEffect() {}, useCallback: fn => fn,
      useTransition: () => [false, fn => { tarefas.push(Promise.resolve().then(fn)); }],
    },
    'next/script': { default: 'script' },
    '@/components/ui/campo': { Campo: 'campo' },
    '@/components/ui/botao': { Botao: 'botao' },
    '@/app/confirmar-celular/actions': {
      solicitarCodigo: async (...args) => { chamadas.push(args); return {}; },
      confirmarCodigo: async () => ({}),
    },
  });
  const render = () => { indice = 0; arvore = ConfirmarWhatsapp({ siteKey: 'teste', destino: '/', numero }); };
  const campo = () => encontrar(arvore, no => no.props.name === 'whatsapp').props;
  const botao = () => encontrar(arvore, no => no.type === 'botao' && no.props.type === 'submit').props;
  render();
  return {
    chamadas, campo, botao,
    captcha() { encontrar(arvore, no => typeof no.props.onToken === 'function').props.onToken('captcha-valido'); render(); },
    blur() { campo().onBlur(); render(); },
    async enviar() {
      let prevenido = false;
      encontrar(arvore, no => no.type === 'form').props.onSubmit({ preventDefault() { prevenido = true; } });
      assert.equal(prevenido, true);
      await Promise.all(tarefas.splice(0));
      render();
    },
    mudar(value, selectionStart = value.length, inputType = 'insertText') {
      let selecao;
      const input = { value, selectionStart, setSelectionRange: (inicio, fim) => { selecao = [inicio, fim]; } };
      const antigos = ['document', 'requestAnimationFrame'].map(nome => [nome, Object.getOwnPropertyDescriptor(globalThis, nome)]);
      Object.defineProperty(globalThis, 'document', { configurable: true, value: { activeElement: input } });
      Object.defineProperty(globalThis, 'requestAnimationFrame', { configurable: true, value: callback => { callback(); return 1; } });
      try { campo().onChange({ currentTarget: input, nativeEvent: { inputType } }); render(); }
      finally {
        for (const [nome, descriptor] of antigos) {
          if (descriptor) Object.defineProperty(globalThis, nome, descriptor); else delete globalThis[nome];
        }
      }
      return selecao;
    },
  };
}

test('número salvo aparece formatado e só solicita código após CAPTCHA', async () => {
  const f = formulario('5555999990000');
  assert.equal(f.campo().value, '(55) 99999-0000');
  assert.equal(f.campo().prefixo, '+55');
  assert.equal(f.botao().disabled, true);
  await f.enviar();
  assert.equal(f.chamadas.length, 0);
  f.captcha();
  assert.equal(f.botao().disabled, false);
  await f.enviar();
  assert.deepEqual(f.chamadas, [['(55) 99999-0000', 'captcha-valido']]);
});

test('número incompleto, fixo, excessivo ou estrangeiro nunca chama o envio, mesmo por submit direto', async () => {
  for (const entrada of ['89', '8933334444', '8999999000012', '+55899999900001', '+1 89999990000', '(55) 99999-00012', '(55) 99999-000123']) {
    const f = formulario();
    f.mudar(entrada, entrada.length, 'insertFromPaste');
    f.captcha();
    assert.equal(f.campo().erro, undefined, entrada);
    assert.equal(f.botao().disabled, true, entrada);
    f.blur();
    assert.match(f.campo().erro, /DDD e os 9 dígitos/, entrada);
    await f.enviar();
    assert.equal(f.chamadas.length, 0, entrada);
  }
});

test('colagem com +55 corrige erro anterior e envia o número nacional completo', async () => {
  const f = formulario();
  f.blur();
  f.captcha();
  f.mudar('+55 (89) 99999-0000', 18, 'insertFromPaste');
  assert.equal(f.campo().value, '(89) 99999-0000');
  assert.equal(f.campo().erro, undefined);
  assert.equal(f.botao().disabled, false);
  await f.enviar();
  assert.deepEqual(f.chamadas, [['(89) 99999-0000', 'captcha-valido']]);
});

test('edição no meio mantém o cursor, e apagar separadores remove o dígito vizinho', () => {
  const f = formulario('5589999990000');
  assert.deepEqual(f.mudar('(89) 99199-0000', 8), [8, 8]);
  assert.equal(f.campo().value, '(89) 99199-0000');

  const backspace = formulario('5589999990000');
  assert.deepEqual(backspace.mudar('(89) 999990000', 10, 'deleteContentBackward'), [9, 9]);
  assert.equal(backspace.campo().value, '(89) 99990-000');

  const apagar = formulario('5589999990000');
  assert.deepEqual(apagar.mudar('(89) 999990000', 10, 'deleteContentForward'), [10, 10]);
  assert.equal(apagar.campo().value, '(89) 99999-000');
});
