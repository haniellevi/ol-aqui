const test = require('node:test');
const assert = require('node:assert/strict');
const { carregar } = require('./carregar.cjs');

const m = carregar('src/lib/manutencao.ts');
const CODIGO = 'codigo-de-teste-bem-comprido-123';
const env = { MANUTENCAO: '1', MANUTENCAO_CODIGO: CODIGO };
const AGORA = 1_800_000_000_000;

test('manutencaoLigada: só com MANUTENCAO=1', () => {
  assert.equal(m.manutencaoLigada({ MANUTENCAO: '1' }), true);
  for (const valor of [undefined, '', '0', 'true', 'sim']) assert.equal(m.manutencaoLigada({ MANUTENCAO: valor }), false);
});

test('decidirManutencao: desligada ou equipe → segue tudo', () => {
  assert.equal(m.decidirManutencao('/minha-conta', false, false), 'seguir');
  assert.equal(m.decidirManutencao('/api/webhooks/clerk', true, true), 'seguir');
});

test('decidirManutencao: ligada → páginas viram /manutencao e APIs 503', () => {
  for (const p of ['/', '/entrar', '/minha-conta', '/admin', '/radar/pedir', '/loja/x', '/apiario', '/sitemap.xml']) {
    assert.equal(m.decidirManutencao(p, true, false), 'pagina', p);
  }
  for (const p of ['/api', '/api/webhooks/clerk', '/api/interno/limpeza', '/api/aki', '/api/visita', '/trpc/x']) {
    assert.equal(m.decidirManutencao(p, true, false), 'api', p);
  }
});

test('decidirManutencao: a própria página, robots e o aviso do Asaas passam sem o Clerk', () => {
  for (const p of ['/manutencao', '/robots.txt', '/api/asaas/webhook', '/api/whatsapp/evolution']) assert.equal(m.decidirManutencao(p, true, false), 'livre', p);
  assert.equal(m.decidirManutencao('/api/whatsapp/evolution/x', true, false), 'api');
  // com o cookie da equipe, tudo segue normal (com Clerk), inclusive a página de manutenção
  assert.equal(m.decidirManutencao('/manutencao', true, true), 'seguir');
  assert.equal(m.decidirManutencao('/manutencao/x', true, false), 'pagina');
  assert.equal(m.decidirManutencao('/api/asaas/webhook/x', true, false), 'api');
});

test('codigoConfere: só o código certo, e só com código forte configurado', async () => {
  assert.equal(await m.codigoConfere(CODIGO, env), true);
  assert.equal(await m.codigoConfere(`  ${CODIGO}  `, env), true);
  assert.equal(await m.codigoConfere('errado', env), false);
  assert.equal(await m.codigoConfere('', env), false);
  assert.equal(await m.codigoConfere('curto', { MANUTENCAO_CODIGO: 'curto' }), false);
  assert.equal(await m.codigoConfere('x', {}), false);
});

test('codigoEquipeConfigurado: só com 16 caracteres ou mais', () => {
  assert.equal(m.codigoEquipeConfigurado(env), true);
  assert.equal(m.codigoEquipeConfigurado({ MANUTENCAO_CODIGO: 'minhasenha' }), false);
  assert.equal(m.codigoEquipeConfigurado({ MANUTENCAO_CODIGO: '   ' }), false);
  assert.equal(m.codigoEquipeConfigurado({}), false);
});

test('matcher do middleware: extensão de arquivo só conta no fim do caminho', () => {
  const fs = require('node:fs');
  const fonte = fs.readFileSync('src/middleware.ts', 'utf8');
  const padrao = fonte.match(/"(\/\(\(\?!_next[^"]+)"/)[1].replace(/\\\\/g, '\\');
  const re = new RegExp(`^${padrao}$`);
  for (const p of ['/', '/loja/x.png/produtos', '/anuncio/abc.css-1', '/minha-conta/anuncios/x.png/editar', '/_nextx', '/manutencao']) assert.ok(re.test(p), `devia passar no middleware: ${p}`);
  for (const p of ['/logo/marca.svg', '/_next/static/a.js', '/fotos/a.webp', '/manifest.webmanifest', '/loja/x.png']) assert.ok(!re.test(p), `devia pular o middleware: ${p}`);
});

test('liberação: o cookie criado vale e não contém o código', async () => {
  const valor = await m.criarLiberacao(AGORA, env);
  assert.match(valor, /^\d+\.[0-9a-f]{64}$/);
  assert.ok(!valor.includes(CODIGO));
  assert.equal(await m.liberacaoValida(valor, AGORA, env), true);
  assert.equal(await m.liberacaoValida(valor, AGORA + 11 * 3600 * 1000, env), true);
});

test('liberação: vencida, adulterada, de outro código ou sem código configurado não vale', async () => {
  const valor = await m.criarLiberacao(AGORA, env);
  const [validade, assinatura] = valor.split('.');
  assert.equal(await m.liberacaoValida(valor, AGORA + 12 * 3600 * 1000, env), false);
  assert.equal(await m.liberacaoValida(`${Number(validade) + 60}.${assinatura}`, AGORA, env), false);
  assert.equal(await m.liberacaoValida(`${validade}.${'0'.repeat(64)}`, AGORA, env), false);
  assert.equal(await m.liberacaoValida(`${valor}.x`, AGORA, env), false);
  assert.equal(await m.liberacaoValida(valor, AGORA, { ...env, MANUTENCAO_CODIGO: 'outro-codigo-bem-comprido-456' }), false);
  assert.equal(await m.liberacaoValida(valor, AGORA, { MANUTENCAO: '1' }), false);
  assert.equal(await m.liberacaoValida(undefined, AGORA, env), false);
  assert.equal(await m.criarLiberacao(AGORA, { MANUTENCAO: '1' }), null);
});

test('liberação: validade longa demais (forjada para o futuro) não vale', async () => {
  const futuro = await m.criarLiberacao(AGORA + 48 * 3600 * 1000, env);
  assert.equal(await m.liberacaoValida(futuro, AGORA, env), false);
});
