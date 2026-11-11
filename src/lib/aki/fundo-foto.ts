import "server-only";
import sharp from "sharp";

/**
 * Para fundos lisos, muda o fundo no enquadramento original, sem sintetizar o produto.
 * Fundos incertos voltam para o tratamento por IA e ambas as versões passam pela conferência.
 */
export async function clarearFundoLiso(original: Buffer): Promise<Buffer | null> {
  try {
    const imagem = sharp(original, { limitInputPixels: 16_000_000 });
    const { width, height } = await imagem.metadata();
    if (!width || !height || width * height > 4_000_000 || Math.min(width, height) < 64) return null;
    const { data, info } = await imagem.autoOrient().flatten({ background: "#ffffff" }).toColourspace("srgb")
      .raw().toBuffer({ resolveWithObject: true });
    if (info.channels !== 3) return null;
    const { width: w, height: h } = info;
    const area = w * h;
    const cantos = [0, w - 1, area - w, area - 1];
    const cor = [0, 1, 2].map(c => Math.round(cantos.reduce((soma, i) => soma + data[i * 3 + c], 0) / 4));

    function diferenca(i: number) {
      const p = i * 3;
      return Math.max(Math.abs(data[p] - cor[0]), Math.abs(data[p + 1] - cor[1]), Math.abs(data[p + 2] - cor[2]));
    }

    if (cantos.some(i => diferenca(i) > 9)) return null;
    let bordaLisa = 0;
    let totalBorda = 0;
    const borda = (i: number) => { totalBorda++; if (diferenca(i) <= 12) bordaLisa++; };
    for (let x = 0; x < w; x++) { borda(x); borda(area - w + x); }
    for (let y = 1; y < h - 1; y++) { borda(y * w); borda(y * w + w - 1); }
    if (bordaLisa / totalBorda < 0.97) return null;

    // 1 = cor do fundo. 2 = provável sombra neutra no mesmo fundo.
    const mascara = new Uint8Array(area);
    for (let i = 0; i < area; i++) {
      const p = i * 3;
      const r = cor[0] - data[p], g = cor[1] - data[p + 1], b = cor[2] - data[p + 2];
      const min = Math.min(r, g, b), max = Math.max(r, g, b);
      if (min >= -15 && max <= 15) mascara[i] = 1;
      else if (min >= 0 && max <= 72 && max - min <= 18) mascara[i] = 2;
    }

    const fila = new Int32Array(area);
    const minimoVao = Math.max(120, Math.ceil(area * 0.005));
    let removidos = 0;
    for (let inicio = 0; inicio < area; inicio++) {
      if (!mascara[inicio]) continue;
      fila[0] = inicio;
      let tamanho = 1;
      let tocaBorda = false;
      let corExata = 0;
      function visitar(i: number) {
        if (!mascara[i]) return;
        if (mascara[i] === 1) corExata++;
        mascara[i] = 0;
        fila[tamanho++] = i;
      }

      if (mascara[inicio] === 1) corExata++;
      mascara[inicio] = 0;
      for (let j = 0; j < tamanho; j++) {
        const i = fila[j], x = i % w;
        if (i >= w) visitar(i - w); else tocaBorda = true;
        if (i < area - w) visitar(i + w); else tocaBorda = true;
        if (x > 0) visitar(i - 1); else tocaBorda = true;
        if (x < w - 1) visitar(i + 1); else tocaBorda = true;
      }

      // Vãos (por exemplo, dentro de alças) precisam ter uma área contínua da cor do fundo.
      // Pequenas regiões da mesma cor dentro do produto ficam intactas.
      if (!tocaBorda && (tamanho < minimoVao || corExata / tamanho < 0.95)) continue;
      removidos += tamanho;
      for (let j = 0; j < tamanho; j++) data.fill(255, fila[j] * 3, fila[j] * 3 + 3);
    }
    if (removidos / area < 0.1 || removidos / area > 0.97) return null;

    return await sharp(data, { raw: { width: w, height: h, channels: 3 } }).webp({ lossless: true }).toBuffer();
  } catch {
    return null;
  }
}
