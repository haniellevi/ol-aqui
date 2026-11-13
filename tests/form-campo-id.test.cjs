const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

// Num <form action={...}> o React junta o botão apertado ao envio com um <input> temporário e
// form="<form.id>". Se o formulário tem um campo chamado "id", form.id devolve ESSE CAMPO (o navegador
// deixa o nome do campo tapar a propriedade), o <input> temporário fica fora do formulário e o botão
// apertado some do envio. Foi o que travou "Aprovar e conceder selo" na fila de verificação de lojas
// (o servidor respondia "Escolha uma decisão."). Por isso: num <form action> com botão que tem nome
// (name="..." ou {...props} espalhadas), nenhum campo se chama "id". Formulários sem botão com nome não
// dependem do botão e ficam de fora; os que enviam por onSubmit (enviarSemLimpar) usam o FormData nativo.

const RAIZ = path.resolve(__dirname, '..');

function arquivosTsx(pasta) {
  const saida = [];
  for (const item of fs.readdirSync(pasta, { withFileTypes: true })) {
    const caminho = path.join(pasta, item.name);
    if (item.isDirectory()) saida.push(...arquivosTsx(caminho));
    else if (item.name.endsWith('.tsx')) saida.push(caminho);
  }
  return saida;
}

function valorTexto(atributo) {
  const ini = atributo.initializer;
  if (!ini) return null;
  if (ts.isStringLiteral(ini)) return ini.text;
  if (ts.isJsxExpression(ini) && ini.expression && ts.isStringLiteralLike(ini.expression)) return ini.expression.text;
  return null;
}

function atributos(no) {
  const abertura = ts.isJsxElement(no) ? no.openingElement : no;
  return abertura.attributes.properties.filter(ts.isJsxAttribute);
}

function nomeTag(no) {
  const abertura = ts.isJsxElement(no) ? no.openingElement : no;
  return abertura.tagName.getText();
}

const BOTOES = new Set(['button', 'Botao']);

/**
 * O form envia pelo caminho do React? Sem onSubmit, sim. Com onSubmit próprio (enviarSemLimpar, aoEnviar)
 * o envio usa o FormData nativo e não sofre o defeito. Exceção: confirmarAntes(confirmar, pedido) sem o
 * terceiro argumento reenvia com requestSubmit e cai no action do React.
 */
function enviaPeloReact(form) {
  const onSubmit = atributos(form).find((a) => a.name.getText() === 'onSubmit');
  if (!onSubmit) return true;
  const expr = onSubmit.initializer && ts.isJsxExpression(onSubmit.initializer) ? onSubmit.initializer.expression : null;
  return Boolean(expr && ts.isCallExpression(expr) && expr.expression.getText() === 'confirmarAntes' && expr.arguments.length < 3);
}

function linha(fonte, no) {
  return fonte.getLineAndCharacterOfPosition(no.getStart()).line + 1;
}

/** Lista "arquivo:linha" de cada <form action> que junta campo chamado "id" com botão que tem nome. */
function formsComBotaoQueSome(codigo, nomeArquivo) {
  const fonte = ts.createSourceFile(nomeArquivo, codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const achados = [];
  const analisarForm = (form) => {
    let campoId = false;
    let botaoComNome = false;
    const procurar = (no) => {
      if (ts.isJsxElement(no) || ts.isJsxSelfClosingElement(no)) {
        const attrs = atributos(no);
        if (attrs.some((a) => ['name', 'id'].includes(a.name.getText()) && valorTexto(a) === 'id')) campoId = true;
        const abertura = ts.isJsxElement(no) ? no.openingElement : no;
        const espalhadas = abertura.attributes.properties.some(ts.isJsxSpreadAttribute);
        const tag = nomeTag(no);
        const ehSubmitInput = tag === 'input' && attrs.some((a) => a.name.getText() === 'type' && ['submit', 'image'].includes(valorTexto(a)));
        if ((BOTOES.has(tag) || ehSubmitInput) && (espalhadas || attrs.some((a) => a.name.getText() === 'name'))) botaoComNome = true;
      }
      ts.forEachChild(no, procurar);
    };
    ts.forEachChild(form, procurar);
    if (campoId && botaoComNome) achados.push(`${nomeArquivo}:${linha(fonte, form)}`);
  };
  const visitar = (no) => {
    if ((ts.isJsxElement(no) || ts.isJsxSelfClosingElement(no)) && nomeTag(no) === 'form'
        && atributos(no).some((a) => a.name.getText() === 'action')) {
      if (enviaPeloReact(no)) analisarForm(no);
      return;
    }
    ts.forEachChild(no, visitar);
  };
  visitar(fonte);
  return achados;
}

test('a regra pega campo "id" + botão com nome no mesmo <form action> e ignora o resto', () => {
  const casos = [
    // [código, quantos achados]
    ['<form action={a}><div><input type="hidden" name="id" value={x} /></div><Botao type="submit" name="decisao" value="s">S</Botao></form>', 1],
    ['<form action={a}><input type="hidden" name={"id"} /><Botao type="submit" {...botao("aprovar")}>A</Botao></form>', 1],
    ['<form action={a}><input type="hidden" name="id" /><button name="dia" value="1">1</button></form>', 1],
    ['<form action={a}><input type="hidden" name="id" /><input type="submit" name="x" value="1" /></form>', 1],
    ['<form action={a}><input type="hidden" name="id" /><Botao type="submit">Salvar</Botao></form>', 0],
    ['<form action={a}><input type="hidden" name="pedido" /><Botao type="submit" name="decisao" value="s">S</Botao></form>', 0],
    ['<form onSubmit={enviar}><input type="hidden" name="id" /><Botao type="submit" name="decisao" value="s">S</Botao></form>', 0],
    ['<form action={a} onSubmit={aoEnviar(a)}><input type="hidden" name="id" /><Botao type="submit" name="acao" value="s">S</Botao></form>', 0],
    ['<form action={a} onSubmit={confirmarAntes(c, p)}><input type="hidden" name="id" /><Botao type="submit" name="acao" value="s">S</Botao></form>', 1],
    ['<form action={a} onSubmit={confirmarAntes(c, p, enviarSemLimpar(a))}><input type="hidden" name="id" /><Botao type="submit" name="acao" value="s">S</Botao></form>', 0],
  ];
  for (const [jsx, qtd] of casos) {
    assert.equal(formsComBotaoQueSome(`export const F = () => ${jsx};`, 'x.tsx').length, qtd, jsx);
  }
});

test('agendarPasso (funil): lê o lojista do campo "lojista" e grava a data do botão apertado', async () => {
  const { carregar } = require('./carregar.cjs');
  const LOJISTA = '7a0593da-15d2-47e6-bbe0-30c5fe4e1f16';
  const gravacoes = [];
  const supabase = { from: (tabela) => ({ update: (dados) => ({ eq: async (col, val) => { gravacoes.push({ tabela, dados, col, val }); return { error: null }; } }) }) };
  const actions = carregar('src/app/admin/funil/actions.ts', {
    'next/cache': { revalidatePath() {} },
    'next/navigation': { redirect() {} },
    '@/lib/admin/equipe': { exigirTela: async () => ({ supabase, userId: 'user_equipe' }) },
  });
  const form = new FormData();
  form.set('lojista', LOJISTA);
  form.set('dia', '2026-11-13');
  assert.equal((await actions.agendarPasso(null, form)).ok, 'Próximo passo marcado.');
  assert.deepEqual(gravacoes, [{ tabela: 'funil_lojistas', dados: { proximo_em: '2026-11-13', atualizado_por: 'user_equipe' }, col: 'id', val: LOJISTA }]);
  const antigo = new FormData();
  antigo.set('id', LOJISTA);
  antigo.set('dia', '2026-11-13');
  assert.match((await actions.agendarPasso(null, antigo)).erro, /inválida/);
  assert.equal(gravacoes.length, 1);
});

test('nenhum <form action> do site junta campo "id" com botão que tem nome', () => {
  const achados = arquivosTsx(path.join(RAIZ, 'src')).flatMap((arq) =>
    formsComBotaoQueSome(fs.readFileSync(arq, 'utf8'), path.relative(RAIZ, arq)));
  assert.deepEqual(achados, [], 'troque o nome do campo "id" (ex.: "pedido", "lojista") e leia o novo nome na ação do servidor');
});
