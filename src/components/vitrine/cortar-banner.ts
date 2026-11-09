// Corta a foto da fachada no tamanho do banner (3 por 1) no próprio aparelho, antes de enviar.
// Só roda no navegador. Sai em WebP (ou JPEG quando o navegador não faz WebP), 1500 x 500.

import { MAX_FOTO_ORIGINAL } from "@/lib/fotos";

export const BANNER_LARGURA = 1500;
export const BANNER_ALTURA = 500;
export const BANNER_PROPORCAO = BANNER_LARGURA / BANNER_ALTURA; // 3

export type FotoAberta = { url: string; largura: number; altura: number; liberar: () => void };

/** Abre o arquivo para a prévia do corte (respeita a rotação da câmera). */
export async function abrirFoto(arquivo: Blob): Promise<FotoAberta> {
  if (!arquivo.size || arquivo.size > MAX_FOTO_ORIGINAL) throw new Error("Escolha uma foto de até 20 MB que não esteja vazia.");
  const url = URL.createObjectURL(arquivo);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return { url, largura: img.naturalWidth, altura: img.naturalHeight, liberar: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    throw new Error("Essa foto não abriu. Tente outra.");
  }
}

/** Parte da foto que entra no banner. posicao: 0 = começo (topo/esquerda), 1 = fim. */
export function areaDoCorte(largura: number, altura: number, posicao: number) {
  const p = Math.min(1, Math.max(0, posicao));
  if (largura / altura > BANNER_PROPORCAO) {
    // foto mais larga que o banner: escolhe a parte da esquerda à direita
    const w = altura * BANNER_PROPORCAO;
    return { x: (largura - w) * p, y: 0, w, h: altura, eixo: "x" as const };
  }
  const h = largura / BANNER_PROPORCAO;
  return { x: 0, y: (altura - h) * p, w: largura, h, eixo: "y" as const };
}

export async function cortarBanner(foto: FotoAberta, posicao: number): Promise<{ blob: Blob; formato: "webp" | "jpg" }> {
  const img = new Image();
  img.src = foto.url;
  await img.decode();
  const area = areaDoCorte(img.naturalWidth, img.naturalHeight, posicao);
  const escala = Math.min(1, BANNER_LARGURA / area.w);
  const largura = Math.max(1, Math.round(area.w * escala));
  const altura = Math.max(1, Math.round(area.h * escala));
  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não deu para preparar a foto.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, area.x, area.y, area.w, area.h, 0, 0, largura, altura);
  const webp = await paraBlob(canvas, "image/webp", 0.82);
  if (webp && webp.type === "image/webp") return { blob: webp, formato: "webp" };
  const jpeg = await paraBlob(canvas, "image/jpeg", 0.82);
  if (!jpeg) throw new Error("Não deu para preparar a foto.");
  return { blob: jpeg, formato: "jpg" };
}

function paraBlob(canvas: HTMLCanvasElement, tipo: string, qualidade: number): Promise<Blob | null> {
  return new Promise((ok) => canvas.toBlob((b) => ok(b), tipo, qualidade));
}
