import "server-only";
import { clarearPixels } from "./fundo-pixels";

/**
 * Para fundos lisos, muda o fundo no enquadramento original, sem sintetizar o produto.
 * Fundos incertos voltam para o tratamento por IA e ambas as versões passam pela conferência.
 */
export async function clarearFundoLiso(original: Buffer): Promise<Buffer | null> {
  try {
    if (process.env.CLOUDFLARE_IMAGENS === "1") {
      const tipo = original.subarray(0, 2).equals(Buffer.from([0xff, 0xd8])) ? "image/jpeg"
        : original.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ? "image/png"
          : original.toString("ascii", 0, 4) === "RIFF" && original.toString("ascii", 8, 12) === "WEBP" ? "image/webp" : null;
      if (!tipo) return null;
      const { getCloudflareContext } = await import("@opennextjs/cloudflare");
      const servico = getCloudflareContext().env.IMAGENS_TRATAMENTO;
      if (!servico) return null;
      const resposta = await servico.fetch("https://imagens.interno/clarear-fundo", {
        method: "POST", headers: { "content-type": tipo }, body: new Uint8Array(original),
      });
      return resposta.ok && resposta.status !== 204 ? Buffer.from(await resposta.arrayBuffer()) : null;
    }
    const { default: sharp } = await import("sharp");
    const imagem = sharp(original, { limitInputPixels: 16_000_000 });
    const { width, height } = await imagem.metadata();
    if (!width || !height || width * height > 4_000_000 || Math.min(width, height) < 64) return null;
    const { data, info } = await imagem.autoOrient().flatten({ background: "#ffffff" }).toColourspace("srgb")
      .raw().toBuffer({ resolveWithObject: true });
    if (info.channels !== 3) return null;
    const { width: w, height: h } = info;
    if (!clarearPixels(data, w, h)) return null;

    return await sharp(data, { raw: { width: w, height: h, channels: 3 } }).webp({ lossless: true }).toBuffer();
  } catch {
    return null;
  }
}
