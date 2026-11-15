import { clarearPixels } from '../../src/lib/aki/fundo-pixels';
import { modeloCapaBase64 } from './modelo-capa.js';
import jpeg, { init as iniciarJpeg } from '@jsquash/jpeg/decode';
import png, { init as iniciarPng } from '@jsquash/png/decode';
import webp, { init as iniciarWebp } from '@jsquash/webp/decode';
import codificar, { init as iniciarCodificador } from '@jsquash/webp/encode';
import redimensionar, { initResize } from '@jsquash/resize';
import { imageSize } from 'image-size';
import { simd } from 'wasm-feature-detect';
import jpegWasm from '../../node_modules/@jsquash/jpeg/codec/dec/mozjpeg_dec.wasm';
import pngWasm from '../../node_modules/@jsquash/png/codec/pkg/squoosh_png_bg.wasm';
import webpWasm from '../../node_modules/@jsquash/webp/codec/dec/webp_dec.wasm';
import webpEncWasm from '../../node_modules/@jsquash/webp/codec/enc/webp_enc.wasm';
import webpSimdWasm from '../../node_modules/@jsquash/webp/codec/enc/webp_enc_simd.wasm';
import resizeWasm from '../../node_modules/@jsquash/resize/lib/resize/pkg/squoosh_resize_bg.wasm';

if (!globalThis.ImageData) globalThis.ImageData = class ImageData {
  constructor(data, width, height) { this.data = data; this.width = width; this.height = height; }
};
const MAX_BYTES = 20 * 1024 * 1024;
const MAX_PIXELS = 16_000_000;
const pronto = Promise.all([
  iniciarJpeg(jpegWasm), iniciarPng(pngWasm), iniciarWebp(webpWasm), initResize(resizeWasm),
  simd().then((suporta) => iniciarCodificador(suporta ? webpSimdWasm : webpEncWasm)),
]);

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

async function processar(request, operacao) {
  const bytes = await lerLimitado(request);
  if (!bytes) return new Response('Imagem muito grande.', { status: 413 });
  try {
    const info = imageSize(bytes);
    const esperado = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()];
    if (!esperado || info.type !== esperado || !info.width || !info.height || info.width * info.height > MAX_PIXELS || animada(bytes, info.type)) throw new Error('Formato inválido');
    if (operacao === '/clarear-fundo' && (info.width * info.height > 4_000_000 || Math.min(info.width, info.height) < 64)) return new Response(null, { status: 204 });
    await pronto;
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    let imagem = info.type === 'jpg' ? await jpeg(buffer, { preserveOrientation: true }) : info.type === 'png' ? await png(buffer) : await webp(buffer);
    if (!imagem || imagem.width * imagem.height > MAX_PIXELS) throw new Error('Imagem inválida');
    let qualidade = 85;
    if (operacao === '/clarear-fundo') {
      if (imagem.width * imagem.height > 4_000_000 || Math.min(imagem.width, imagem.height) < 64) return new Response(null, { status: 204 });
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
    } else if (operacao === '/normalizar') {
      const escala = Math.min(1, 1600 / imagem.width, 1600 / imagem.height);
      if (escala < 1) imagem = await redimensionar(imagem, { width: Math.max(1, Math.round(imagem.width * escala)), height: Math.max(1, Math.round(imagem.height * escala)) });
    } else {
      for (let i = 0; i < imagem.data.length; i += 4) {
        const alfa = imagem.data[i + 3] / 255;
        for (let canal = 0; canal < 3; canal++) imagem.data[i + canal] = Math.round(imagem.data[i + canal] * alfa + 255 * (1 - alfa));
        imagem.data[i + 3] = 255;
      }
      if (operacao === '/ajustar-banner') {
        imagem = await redimensionar(imagem, { width: 1500, height: 500, fitMethod: 'contain' });
        qualidade = 90;
      } else {
        const escala = Math.min(1600 / imagem.width, 1200 / imagem.height);
        const w = Math.max(1, Math.round(imagem.width * escala)), h = Math.max(1, Math.round(imagem.height * escala));
        const reduzida = w === imagem.width && h === imagem.height ? imagem : await redimensionar(imagem, { width: w, height: h });
        const fundo = new Uint8ClampedArray(1600 * 1200 * 4).fill(255);
        const x = Math.floor((1600 - w) / 2), y = Math.floor((1200 - h) / 2);
        for (let linha = 0; linha < h; linha++) fundo.set(reduzida.data.subarray(linha * w * 4, (linha + 1) * w * 4), ((linha + y) * 1600 + x) * 4);
        imagem = new ImageData(fundo, 1600, 1200);
      }
    }
    let resultado = await codificar(imagem, ['/ajustar-produto', '/clarear-fundo'].includes(operacao) ? { lossless: 1 } : { quality: qualidade });
    if (operacao === '/ajustar-produto' && resultado.byteLength > 4 * 1024 * 1024) resultado = await codificar(imagem, { quality: 95 });
    if (resultado.byteLength > MAX_BYTES) return new Response('Imagem muito grande.', { status: 413 });
    return new Response(resultado, { headers: { 'content-type': 'image/webp', 'cache-control': 'no-store' } });
  } catch {
    return new Response('Formato da imagem inválido ou arquivo danificado.', { status: 400 });
  }
}

export default {
  async fetch(request) {
    if (new URL(request.url).pathname === '/modelo-capa' && request.method === 'GET') return new Response(Uint8Array.from(atob(modeloCapaBase64), (c) => c.charCodeAt(0)), { headers: { 'content-type': 'image/webp', 'cache-control': 'no-store' } });
    const caminho = new URL(request.url).pathname;
    if (!['/normalizar', '/ajustar-banner', '/ajustar-produto', '/clarear-fundo'].includes(caminho) || request.method !== 'POST') return new Response('Não encontrado.', { status: 404 });
    return processar(request, caminho);
  },
};
