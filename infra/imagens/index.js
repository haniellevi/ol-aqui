import { clarearPixels } from '../../src/lib/aki/fundo-pixels';
import { modeloCapaBase64 } from './modelo-capa.js';
import jpeg, { init as iniciarJpeg } from '@jsquash/jpeg/decode';
import png, { init as iniciarPng } from '@jsquash/png/decode';
import webp, { init as iniciarWebp } from '@jsquash/webp/decode';
import codificar, { init as iniciarCodificador } from '@jsquash/webp/encode';
import { imageSize } from 'image-size';
import { simd } from 'wasm-feature-detect';
import jpegWasm from '../../node_modules/@jsquash/jpeg/codec/dec/mozjpeg_dec.wasm';
import pngWasm from '../../node_modules/@jsquash/png/codec/pkg/squoosh_png_bg.wasm';
import webpWasm from '../../node_modules/@jsquash/webp/codec/dec/webp_dec.wasm';
import webpEncWasm from '../../node_modules/@jsquash/webp/codec/enc/webp_enc.wasm';
import webpSimdWasm from '../../node_modules/@jsquash/webp/codec/enc/webp_enc_simd.wasm';

if (!globalThis.ImageData) globalThis.ImageData = class ImageData {
  constructor(data, width, height) { this.data = data; this.width = width; this.height = height; }
};
const MAX_BYTES = 20 * 1024 * 1024;
const MAX_PIXELS = 16_000_000;
let jpgPronto, pngPronto, webpPronto, codificadorPronto;
async function iniciarCodec(tipo) {
  if (tipo === 'jpg') return jpgPronto ??= iniciarJpeg(jpegWasm);
  if (tipo === 'png') return pngPronto ??= iniciarPng(pngWasm);
  return webpPronto ??= iniciarWebp(webpWasm);
}
async function iniciarEncoder() {
  return codificadorPronto ??= simd().then((suporta) => iniciarCodificador(suporta ? webpSimdWasm : webpEncWasm));
}

async function lerLimitado(request) {
  if (Number(request.headers.get('content-length')) > MAX_BYTES) return null;
  if (!request.body) return new Uint8Array();
  const leitor = request.body.getReader();
  const partes = [];
  let total = 0;
  while (true) {
    const { value, done } = await leitor.read();
    if (done) break;
    total += value.length;
    if (total > MAX_BYTES) { await leitor.cancel(); return null; }
    partes.push(value);
  }
  const resultado = new Uint8Array(total);
  let posicao = 0;
  for (const parte of partes) { resultado.set(parte, posicao); posicao += parte.length; }
  return resultado;
}

function animada(bytes, tipo) {
  if (tipo === 'webp') return bytes.length > 20 && String.fromCharCode(...bytes.subarray(12, 16)) === 'VP8X' && Boolean(bytes[20] & 2);
  if (tipo !== 'png') return false;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let pos = 8; pos + 12 <= bytes.length;) {
    const comprimento = view.getUint32(pos);
    if (comprimento > bytes.length - pos - 12) throw new Error('PNG inválido');
    const chunk = String.fromCharCode(...bytes.subarray(pos + 4, pos + 8));
    if (chunk === 'acTL') return true;
    if (chunk === 'IEND') return false;
    pos += comprimento + 12;
  }
  throw new Error('PNG inválido');
}

async function processar(request, operacao, env) {
  const bytes = await lerLimitado(request);
  if (!bytes) return new Response('Imagem muito grande.', { status: 413 });
  let info;
  try {
    info = imageSize(bytes);
    const esperado = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()];
    if (!esperado || info.type !== esperado || !info.width || !info.height || info.width * info.height > MAX_PIXELS || animada(bytes, info.type)) throw new Error('Formato inválido');
  } catch {
    return new Response('Formato da imagem inválido ou arquivo danificado.', { status: 400 });
  }
  try {
    if (operacao === '/ajustar-produto' && request.headers.get('x-fundo-clareado') === '1' && info.type === 'webp' && info.width === 1600 && info.height === 1200 && bytes.length <= 4 * 1024 * 1024) {
      return new Response(bytes, { headers: { 'content-type': 'image/webp', 'cache-control': 'no-store' } });
    }
    if (operacao !== '/clarear-fundo') {
      const opcoes = operacao === '/normalizar' ? { width: 1600, height: 1600, fit: 'scale-down' }
        : operacao === '/ajustar-banner' ? { width: 1500, height: 500, fit: 'cover', background: '#ffffff' }
          : { width: 1600, height: 1200, fit: 'pad', background: '#ffffff' };
      const qualidade = operacao === '/normalizar' ? 85 : operacao === '/ajustar-banner' ? 90 : 100;
      async function transformar(q) {
        return (await env.IMAGES.input(new Response(bytes).body).transform(opcoes).output({ format: 'image/webp', quality: q, anim: false })).response();
      }
      let resposta = await transformar(qualidade);
      if (!resposta.ok) return new Response('Serviço de imagens indisponível.', { status: 503 });
      let resultado = await resposta.arrayBuffer();
      if (operacao === '/ajustar-produto' && resultado.byteLength > 4 * 1024 * 1024) {
        resposta = await transformar(95);
        if (!resposta.ok) return new Response('Serviço de imagens indisponível.', { status: 503 });
        resultado = await resposta.arrayBuffer();
      }
      if (resultado.byteLength > MAX_BYTES) return new Response('Imagem muito grande.', { status: 413 });
      return new Response(resultado, { headers: { 'content-type': 'image/webp', 'cache-control': 'no-store' } });
    }
    if (info.width * info.height > 4_000_000 || Math.min(info.width, info.height) < 64) return new Response(null, { status: 204 });
    await Promise.all([iniciarCodec(info.type), iniciarEncoder()]);
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    const imagem = info.type === 'jpg' ? await jpeg(buffer, { preserveOrientation: true }) : info.type === 'png' ? await png(buffer) : await webp(buffer);
    if (!imagem || imagem.width * imagem.height > 4_000_000 || Math.min(imagem.width, imagem.height) < 64) return new Response(null, { status: 204 });
    const rgb = new Uint8Array(imagem.width * imagem.height * 3);
    for (let i = 0, j = 0; i < imagem.data.length; i += 4, j += 3) {
      const alfa = imagem.data[i + 3] / 255;
      for (let canal = 0; canal < 3; canal++) rgb[j + canal] = Math.round(imagem.data[i + canal] * alfa + 255 * (1 - alfa));
    }
    if (!clarearPixels(rgb, imagem.width, imagem.height)) return new Response(null, { status: 204 });
    for (let i = 0, j = 0; i < imagem.data.length; i += 4, j += 3) {
      for (let canal = 0; canal < 3; canal++) imagem.data[i + canal] = rgb[j + canal];
      imagem.data[i + 3] = 255;
    }
    const resultado = await codificar(imagem, { lossless: 1 });
    if (resultado.byteLength > MAX_BYTES) return new Response('Imagem muito grande.', { status: 413 });
    return new Response(resultado, { headers: { 'content-type': 'image/webp', 'cache-control': 'no-store' } });
  } catch {
    return operacao === '/clarear-fundo' ? new Response(null, { status: 204 }) : new Response('Serviço de imagens indisponível.', { status: 503 });
  }
}

export default {
  async fetch(request, env) {
    if (new URL(request.url).pathname === '/modelo-capa' && request.method === 'GET') return new Response(Uint8Array.from(atob(modeloCapaBase64), (c) => c.charCodeAt(0)), { headers: { 'content-type': 'image/webp', 'cache-control': 'no-store' } });
    const caminho = new URL(request.url).pathname;
    if (!['/normalizar', '/ajustar-banner', '/ajustar-produto', '/clarear-fundo'].includes(caminho) || request.method !== 'POST') return new Response('Não encontrado.', { status: 404 });
    return processar(request, caminho, env);
  },
};
