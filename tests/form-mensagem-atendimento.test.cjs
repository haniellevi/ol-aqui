const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { carregar } = require('./carregar.cjs');

const conversa = '10000000-0000-4000-a000-000000000001';
const sucesso = { ok: true, dados: { destino: 'aki', mensagem: 'O Aki respondeu na conversa.' } };

function encontrar(no, predicado) {
  if (!React.isValidElement(no)) return null;
  if (predicado(no)) return no;
  for (const filho of React.Children.toArray(no.props.children)) {
    const achado = encontrar(filho, predicado);
    if (achado) return achado;
  }
  return null;
}

// O componente real conserva os hooks entre renders; ação, navegador e validade são fronteiras simuladas.
function formulario({ ofereceAki = true, resultado = sucesso, falha = false, valido = true } = {}) {
  const celulas = [], chamadas = [], eventos = [], tarefas = [];
  let indice = 0, arvore, atualizacoes = 0;
  const estado = inicial => {
    const i = indice++;
    if (!Object.hasOwn(celulas, i)) celulas[i] = typeof inicial === 'function' ? inicial() : inicial;
    return [celulas[i], valor => { celulas[i] = typeof valor === 'function' ? valor(celulas[i]) : valor; }];
  };
  const { FormMensagemAtendimento } = carregar('src/components/atendimento/form-mensagem.tsx', {
    react: {
      ...React,
      useState: estado,
      useRef: inicial => estado(() => ({ current: inicial }))[0],
      useTransition: () => {
        const [pendente, setPendente] = estado(false);
        return [pendente, fn => {
          setPendente(true);
          tarefas.push(Promise.resolve().then(fn).finally(() => setPendente(false)));
        }];
      },
    },
    'next/navigation': { useRouter: () => ({ refresh() { atualizacoes++; } }) },
    '@/components/ui/botao': { Botao: 'botao' },
    '@/app/(conta)/minha-conta/atendimento/actions': {
      async enviarMensagemAtendimento(...args) {
        chamadas.push(args);
        if (falha) throw new Error('Conexão interrompida');
        return resultado;
      },
    },
  });
  const render = () => {
    indice = 0;
    arvore = FormMensagemAtendimento({ id: conversa, ofereceAki });
    arvore.props.ref.current = { reportValidity: () => valido };
  };
  const campo = () => encontrar(arvore, no => no.type === 'textarea').props;
  const botao = tipo => encontrar(arvore, no => no.type === 'botao' && no.props.type === tipo)?.props;
  const aviso = role => encontrar(arvore, no => no.props.role === role)?.props.children;
  render();
  return {
    chamadas, eventos, campo, botao, aviso,
    get atualizacoes() { return atualizacoes; },
    get ocupado() { return arvore.props['aria-busy']; },
    mudar(value) { campo().onChange({ target: { value } }); render(); },
    iniciar(destino = 'aki') {
      if (destino === 'equipe') botao('button').onClick();
      else {
        let prevenido = false;
        arvore.props.onSubmit({ preventDefault() { prevenido = true; } });
        assert.equal(prevenido, true);
      }
      render();
    },
    async concluir() {
      const anterior = Object.getOwnPropertyDescriptor(globalThis, 'window');
      Object.defineProperty(globalThis, 'window', { configurable: true, value: { dispatchEvent(evento) { eventos.push(evento.type); } } });
      try { await Promise.all(tarefas.splice(0)); render(); }
      finally {
        if (anterior) Object.defineProperty(globalThis, 'window', anterior); else delete globalThis.window;
      }
    },
  };
}

test('Enviar ao Aki usa aoAki=true e mostra o retorno da ação após confirmar o envio', async () => {
  const f = formulario();
  f.mudar('Como edito meu anúncio?');
  assert.equal(f.botao('submit').children, 'Enviar ao Aki');
  f.iniciar();
  await f.concluir();
  assert.equal(f.chamadas.length, 1);
  assert.equal(f.chamadas[0][0], conversa);
  assert.match(f.chamadas[0][1], /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.deepEqual(f.chamadas[0].slice(2), ['Como edito meu anúncio?', true]);
  assert.equal(f.campo().value, '');
  assert.equal(f.aviso('status'), sucesso.dados.mensagem);
  assert.equal(f.aviso('alert'), undefined);
  assert.equal(f.atualizacoes, 1);
  assert.deepEqual(f.eventos, ['olaki:avisos']);
});

test('Falar com a equipe envia aoAki=false e preserva a confirmação recebida', async () => {
  const mensagem = 'Sua mensagem foi encaminhada à equipe.';
  const f = formulario({ resultado: { ok: true, dados: { destino: 'equipe', mensagem } } });
  f.mudar('Preciso falar com uma pessoa.');
  assert.equal(f.botao('button').children, 'Falar com a equipe');
  f.iniciar('equipe');
  await f.concluir();
  assert.deepEqual(f.chamadas[0].slice(2), ['Preciso falar com uma pessoa.', false]);
  assert.equal(f.aviso('status'), mensagem);

  const humano = formulario({ ofereceAki: false });
  humano.mudar('Mensagem para a conversa.');
  assert.equal(humano.botao('button'), undefined);
  assert.equal(humano.botao('submit').children, 'Enviar mensagem');
  humano.iniciar();
  await humano.concluir();
  assert.equal(humano.chamadas[0][3], false);
});

test('carregamento identifica o destino e bloqueia outro envio até terminar', async () => {
  for (const destino of ['aki', 'equipe']) {
    const f = formulario();
    f.mudar('Preciso de ajuda.');
    f.iniciar(destino);
    assert.equal(f.ocupado, true);
    assert.equal(f.campo().disabled, true);
    assert.equal(f.botao('submit').disabled, true);
    assert.equal(f.botao('button').disabled, true);
    assert.equal(f.botao('submit').carregando, destino === 'aki');
    assert.equal(f.botao('button').carregando, destino === 'equipe');
    assert.equal(f.aviso('status'), destino === 'aki' ? 'O Aki está respondendo...' : 'Enviando mensagem...');
    assert.equal(f.botao(destino === 'aki' ? 'submit' : 'button').textoCarregando, destino === 'aki' ? 'Respondendo...' : 'Enviando...');
    f.iniciar();
    await f.concluir();
    assert.equal(f.chamadas.length, 1);
    assert.equal(f.ocupado, false);
    assert.equal(f.campo().disabled, false);
    assert.equal(f.botao('submit').carregando, false);
    assert.equal(f.botao('button').carregando, false);
  }
});

test('erro preserva o texto e a chave de reenvio, sem atualizar como sucesso', async () => {
  for (const opcoes of [{ resultado: { ok: false, erro: { mensagem: 'Envio não confirmado.' } } }, { falha: true }]) {
    const f = formulario(opcoes);
    f.mudar('Mensagem que não pode se perder.');
    f.iniciar();
    await f.concluir();
    assert.equal(f.campo().value, 'Mensagem que não pode se perder.');
    assert.equal(f.aviso('alert'), opcoes.falha ? 'Não foi possível confirmar o envio. Tente novamente.' : 'Envio não confirmado.');
    assert.equal(f.aviso('status'), null);
    assert.equal(f.atualizacoes, 0);
    assert.deepEqual(f.eventos, []);
    f.iniciar();
    await f.concluir();
    assert.equal(f.chamadas[1][1], f.chamadas[0][1]);
    f.mudar('Mensagem corrigida.');
    f.iniciar();
    await f.concluir();
    assert.notEqual(f.chamadas[2][1], f.chamadas[0][1]);
  }
});

test('atalho para equipe respeita a validação do formulário', async () => {
  const f = formulario({ valido: false });
  f.iniciar('equipe');
  await f.concluir();
  assert.equal(f.chamadas.length, 0);
  assert.equal(f.ocupado, false);
});
