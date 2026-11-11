// Cor principal de uma logo e os tons que o Merc usa na arte do banner.
// As contas são puras (testáveis sem navegador); só `corDaLogo` usa canvas.

const hex = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, "0");
const paraHex = (r: number, g: number, b: number) => `#${hex(r)}${hex(g)}${hex(b)}`;

function rgbParaHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

function hslParaHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return paraHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

/**
 * Cor que mais identifica a logo: ignora fundo transparente, branco e preto puros e
 * dá mais peso às cores vivas. Logo só em cinza devolve o cinza mais frequente.
 * Devolve null se não há nenhum pixel útil.
 */
export function corDominante(rgba: ArrayLike<number>): string | null {
  type Balde = { n: number; r: number; g: number; b: number; peso: number };
  const baldes = new Map<number, Balde>();
  for (let i = 0; i + 3 < rgba.length; i += 4) {
    const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2], a = rgba[i + 3];
    if (a < 128) continue;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    if (min > 235 || max < 25) continue;
    const chave = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const saturacao = max === 0 ? 0 : (max - min) / max;
    const balde = baldes.get(chave) ?? { n: 0, r: 0, g: 0, b: 0, peso: 0 };
    balde.n++; balde.r += r; balde.g += g; balde.b += b; balde.peso += 0.25 + saturacao;
    baldes.set(chave, balde);
  }
  let melhor: Balde | null = null;
  for (const balde of baldes.values()) if (!melhor || balde.peso > melhor.peso) melhor = balde;
  return melhor ? paraHex(melhor.r / melhor.n, melhor.g / melhor.n, melhor.b / melhor.n) : null;
}

/** Principal + uma versão bem escura (cantos) + uma bem clara (brilho), sempre do mesmo tom. */
export function tonsDaCor(principal: string): { principal: string; escura: string; clara: string } {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(principal);
  if (!m) return { principal: "#4b1248", escura: "#2a0a28", clara: "#f3e8f2" };
  const [h, s, l] = rgbParaHsl(parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16));
  return {
    principal: principal.toLowerCase(),
    escura: hslParaHex(h, Math.min(1, s * 0.9), Math.min(l * 0.45, 0.22)),
    clara: hslParaHex(h, Math.min(s, 0.6), 0.94),
  };
}

/** Lê a imagem escolhida no navegador e devolve a cor principal da logo (ou null). */
export async function corDaLogo(previa: string): Promise<string | null> {
  const imagem = new Image();
  imagem.src = previa;
  await imagem.decode();
  const lado = 64;
  const canvas = document.createElement("canvas");
  canvas.width = lado; canvas.height = lado;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  const escala = Math.min(lado / imagem.naturalWidth, lado / imagem.naturalHeight);
  const w = Math.max(1, Math.round(imagem.naturalWidth * escala)), h = Math.max(1, Math.round(imagem.naturalHeight * escala));
  ctx.drawImage(imagem, 0, 0, w, h);
  return corDominante(ctx.getImageData(0, 0, w, h).data);
}
