const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { carregar } = require('./carregar.cjs');
const foto = 'https://pps.whatsapp.net/v/foto?assinatura=privada';
const trabalho = { id:'trabalho', tentativa:'tentativa' };

function ambiente({ ip = '31.13.84.51', status = 200, mime = 'image/jpeg', tamanho = 3, blocos = [Buffer.from('jpg')], pronta = false, falhaReserva = false, falhaUpload = false, falhaFinal = false } = {}) {
  const chamadas = [];
  const req = new EventEmitter();
  req.destroy = erro => req.emit('error', erro);
  const mocks = {
    'node:dns/promises': { lookup: async () => [{ address:ip, family:4 }] },
    'node:https': { request: (url, options, responder) => {
      chamadas.push(['rede', url.hostname]);
      options.lookup(url.hostname, {}, (erro, endereco) => assert.equal(endereco, ip));
      req.end = () => queueMicrotask(() => {
        const res = new EventEmitter(); res.statusCode = status; res.headers = { 'content-type':mime, 'content-length':String(tamanho) }; res.destroy = () => {};
        responder(res);
        if (status === 200) { for (const bloco of blocos) res.emit('data', bloco); res.emit('end'); }
      });
      return req;
    } },
    '@/lib/loja-ia/imagens': { normalizarMaterial: async (bytes, tipo) => { chamadas.push(['normalizar', bytes.toString(), tipo]); return Buffer.from('webp'); } },
    '@/lib/supabase/admin': { supabaseAdmin: () => ({
      rpc: async (nome, args) => {
        chamadas.push([nome, args]);
        if (nome === 'loja_ia_reservar_logo_whatsapp') return { data: { id:'imagem', caminho:'rascunho/pronta/imagem.webp', estado:pronta ? 'pronta' : 'preparando' }, error:falhaReserva };
        return { data:falhaFinal ? null : 'imagem', error:falhaFinal };
      },
      storage: { from: bucket => ({ upload: async (caminho, bytes, opcoes) => { chamadas.push(['upload', bucket, caminho, bytes.toString(), opcoes]); return { error:falhaUpload }; } }) },
    }) },
  };
  return { modulo:carregar('src/lib/loja-ia/whatsapp-logo.ts', mocks), chamadas };
}

test('baixa, normaliza e guarda o logo privado antes de confirmar a tentativa', async () => {
  const { modulo, chamadas } = ambiente();
  assert.equal(await modulo.importarLogoWhatsapp(foto, trabalho), 'imagem');
  assert.deepEqual(chamadas.map(c => c[0]), ['rede','normalizar','loja_ia_reservar_logo_whatsapp','upload','loja_ia_concluir_logo_whatsapp']);
  assert.equal(chamadas[2][1].p_tentativa, 'tentativa');
  assert.match(chamadas[2][1].p_sha256, /^[a-f0-9]{64}$/);
  assert.equal(chamadas[3][1], 'loja-ia');
  assert.equal(chamadas[3][4].contentType, 'image/webp');
  assert.doesNotMatch(JSON.stringify(chamadas.slice(1)), /assinatura|pps.whatsapp.net/);
});

test('reutiliza imagem pronta pelo hash e ainda verifica a autorização final', async () => {
  const { modulo, chamadas } = ambiente({ pronta:true });
  assert.equal(await modulo.importarLogoWhatsapp(foto, trabalho), 'imagem');
  assert.equal(chamadas.some(c => c[0] === 'upload'), false);
  assert.equal(chamadas.at(-1)[0], 'loja_ia_concluir_logo_whatsapp');
});

test('nega URL externa, credenciais, IP privado, redireção e arquivos inválidos', async () => {
  for (const url of ['http://pps.whatsapp.net/foto','https://pps.whatsapp.net.evil.test/foto','https://user:password@pps.whatsapp.net/foto','https://127.0.0.1/foto']) {
    const { modulo, chamadas } = ambiente();
    await assert.rejects(modulo.baixarFotoWhatsapp(url)); assert.equal(chamadas.length, 0);
  }
  for (const opcoes of [{ ip:'127.0.0.1' }, { status:302 }, { mime:'text/html' }, { tamanho:5*1024*1024+1 }, { tamanho:0, blocos:[Buffer.alloc(5*1024*1024+1)] }]) {
    const { modulo } = ambiente(opcoes); await assert.rejects(modulo.baixarFotoWhatsapp(foto));
  }
});

test('falha de reserva, upload ou consentimento final impede usar imagem', async () => {
  for (const opcoes of [{ falhaReserva:true }, { falhaUpload:true }, { falhaFinal:true }]) {
    const { modulo, chamadas } = ambiente(opcoes);
    await assert.rejects(modulo.importarLogoWhatsapp(foto, trabalho));
    if (opcoes.falhaReserva) assert.equal(chamadas.some(c => c[0] === 'upload'), false);
    if (opcoes.falhaUpload) assert.equal(chamadas.some(c => c[0] === 'loja_ia_concluir_logo_whatsapp'), false);
  }
});
