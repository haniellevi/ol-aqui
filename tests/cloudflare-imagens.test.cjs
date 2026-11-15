const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const net = require('node:net');
const sharp = require('sharp');
const path = require('node:path');

let worker, base;
before(async () => {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  base = `http://127.0.0.1:${port}`;
  worker = spawn(process.execPath, [path.resolve('node_modules/wrangler/bin/wrangler.js'), 'dev', '--local', '--port', String(port), '--config', 'infra/imagens/wrangler.jsonc'], { cwd: path.resolve('.'), stdio: 'ignore' });
  let ultima;
  for (let tentativa = 0; tentativa < 100; tentativa++) {
    if (worker.exitCode !== null) throw new Error(`Worker terminou com código ${worker.exitCode}`);
    try { await fetch(base); return; } catch (e) { ultima = e; }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw ultima || new Error('Worker de imagens não iniciou');
});
after(() => worker?.kill('SIGTERM'));
async function processar(caminho, bytes, mime, extras = {}) {
  const resposta = await fetch(base + caminho, { method: 'POST', headers: { 'content-type': mime, ...extras }, body: bytes });
  return { resposta, bytes: Buffer.from(await resposta.arrayBuffer()) };
}
test('normaliza JPEG orientado e preserva proporção em WebP', async () => {
  const original = await sharp({ create: { width: 1800, height: 900, channels: 3, background: 'red' } }).jpeg().withMetadata({ orientation: 6 }).toBuffer();
  const { resposta, bytes } = await processar('/normalizar', original, 'image/jpeg');
  assert.equal(resposta.status, 200);
  const info = await sharp(bytes).metadata();
  assert.deepEqual([info.format, info.width, info.height], ['webp', 800, 1600]);
});
test('normaliza PNG e WebP, recusando formato adulterado e arquivos corrompidos', async () => {
  for (const formato of ['png', 'webp']) {
    const imagem = await sharp({ create: { width: 60, height: 40, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 0.5 } } })[formato]().toBuffer();
    const valido = await processar('/normalizar', imagem, `image/${formato}`);
    assert.equal(valido.resposta.status, 200);
    assert.equal((await sharp(valido.bytes).metadata()).format, 'webp');
    assert.equal((await processar('/normalizar', imagem, 'image/jpeg')).resposta.status, 400);
  }
  assert.equal((await processar('/normalizar', Buffer.from('imagem danificada'), 'image/png')).resposta.status, 400);
});
test('rejeita tamanho excessivo e imagem com dimensões acima do limite', async () => {
  const imagem = await sharp({ create: { width: 4001, height: 4000, channels: 3, background: 'white' } }).jpeg().toBuffer();
  assert.equal((await processar('/normalizar', imagem, 'image/jpeg')).resposta.status, 400);
  assert.equal((await processar('/normalizar', Buffer.alloc(20 * 1024 * 1024 + 1), 'image/png')).resposta.status, 413);
});
test('recusa operações desconhecidas', async () => {
  assert.equal((await processar('/outro', Buffer.from('x'), 'image/png')).resposta.status, 404);
});

test('gera modelo de capa fixo de 1500 por 500 em WebP', async () => {
  const resposta = await fetch(base + '/modelo-capa');
  assert.equal(resposta.status, 200);
  const info = await sharp(Buffer.from(await resposta.arrayBuffer())).metadata();
  assert.deepEqual([info.format, info.width, info.height], ['webp', 1500, 500]);
});

test('ajusta banner com corte central e foto de produto com margens brancas', async () => {
  const original = await sharp({ create: { width: 200, height: 200, channels: 4, background: { r: 250, g: 0, b: 0, alpha: 1 } } }).webp().toBuffer();
  const banner = await processar('/ajustar-banner', original, 'image/webp');
  assert.equal(banner.resposta.status, 200);
  const infoBanner = await sharp(banner.bytes).metadata();
  assert.deepEqual([infoBanner.width, infoBanner.height], [1500, 500]);
  const produto = await processar('/ajustar-produto', original, 'image/webp');
  assert.equal(produto.resposta.status, 200);
  const infoProduto = await sharp(produto.bytes).metadata();
  assert.deepEqual([infoProduto.width, infoProduto.height], [1600, 1200]);
  const margem = await sharp(produto.bytes).extract({ left: 0, top: 0, width: 1, height: 1 }).removeAlpha().raw().toBuffer();
  assert.ok([...margem].every((canal) => canal > 245));
});

test('clareia fundo liso preservando exatamente os pixels do produto', async () => {
  const w = 160, h = 120, dados = Buffer.alloc(w * h * 3, Buffer.from([214, 198, 173]));
  for (let y = 30; y < 90; y++) dados.fill(Buffer.from([28, 78, 130]), (y * w + 30) * 3, (y * w + 130) * 3);
  dados.set([250, 250, 245], (55 * w + 68) * 3);
  const original = await sharp(dados, { raw: { width: w, height: h, channels: 3 } }).webp({ lossless: true }).toBuffer();
  const resultado = await processar('/clarear-fundo', original, 'image/webp');
  assert.equal(resultado.resposta.status, 200);
  const saida = await sharp(resultado.bytes).removeAlpha().raw().toBuffer();
  assert.deepEqual([...saida.subarray(0, 3)], [255, 255, 255]);
  for (let y = 30; y < 90; y++) assert.deepEqual(saida.subarray((y*w+30)*3,(y*w+130)*3), dados.subarray((y*w+30)*3,(y*w+130)*3));
});

test('recusa imagens animadas e declarações incompatíveis sem acessar dados externos', async () => {
  const png = await sharp({ create: { width: 80, height: 80, channels: 3, background: 'white' } }).png().toBuffer();
  const controleAnimacao = Buffer.from([0,0,0,8, 97,99,84,76, 0,0,0,2, 0,0,0,0, 0,0,0,0]);
  const apng = Buffer.concat([png.subarray(0,33), controleAnimacao, png.subarray(33)]);
  assert.equal((await processar('/normalizar', apng, 'image/png')).resposta.status, 400);
  const webp = await sharp({ create: { width: 80, height: 80, channels: 4, background: { r: 1, g: 2, b: 3, alpha: 0.5 } } }).webp().toBuffer();
  assert.equal(webp.toString('ascii', 12, 16), 'VP8X');
  webp[20] |= 2;
  assert.equal((await processar('/normalizar', webp, 'image/webp')).resposta.status, 400);
});

test('processa imagem no limite de 16 milhões de pixels', async () => {
  const imagem = await sharp({ create: { width: 4000, height: 4000, channels: 3, background: 'white' } }).jpeg().toBuffer();
  const resultado = await processar('/normalizar', imagem, 'image/jpeg');
  assert.equal(resultado.resposta.status, 200);
  const info = await sharp(resultado.bytes).metadata();
  assert.deepEqual([info.width, info.height], [1600, 1600]);
});

test('fundo inseguro devolve resposta vazia para o fluxo alternativo', async () => {
  const pequena = await sharp({ create: { width: 20, height: 20, channels: 3, background: 'white' } }).webp().toBuffer();
  const resultado = await processar('/clarear-fundo', pequena, 'image/webp');
  assert.equal(resultado.resposta.status, 204);
  assert.equal(resultado.bytes.length, 0);
});

test('foto tratada de 1600 por 1200 preserva pixels do produto ao enquadrar', async () => {
  const w=1600, h=1200, dados=Buffer.alloc(w*h*3, Buffer.from([255,255,255]));
  const pos=(x,y)=>(y*w+x)*3;
  for (let y=300;y<900;y++) dados.fill(Buffer.from([28,78,130]),pos(300,y),pos(1300,y));
  dados.set([250,250,245],pos(680,550)); dados.set([143,176,197],pos(740,790));
  const original=await sharp(dados,{raw:{width:w,height:h,channels:3}}).webp({lossless:true}).toBuffer();
  const resultado=await processar('/ajustar-produto',original,'image/webp', {'x-fundo-clareado':'1'});
  assert.equal(resultado.resposta.status,200);
  const saida=await sharp(resultado.bytes).removeAlpha().raw().toBuffer();
  for(let y=300;y<900;y++) assert.deepEqual(saida.subarray(pos(300,y),pos(1300,y)),dados.subarray(pos(300,y),pos(1300,y)));
});
