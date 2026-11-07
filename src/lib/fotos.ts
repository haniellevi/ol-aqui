// Fotos no navegador: reduzir antes de enviar (internet fraca) e mandar ao Storage.
// Seguro para componente de cliente (não usa nada do servidor).

export type OpcoesReducao = { ladoMaximo?: number; qualidade?: number };

/** Resultado da redução: o arquivo pronto e o formato (para pedir o endereço certo de envio). */
export type FotoReduzida = { blob: Blob; formato: "webp" | "jpg"; largura: number; altura: number };

/**
 * Reduz a foto para no máximo 1600px no lado maior, em WebP (qualidade ~0,8).
 * Se o navegador não gera WebP, usa JPEG. Respeita a rotação da câmera (EXIF).
 */
export async function reduzirFoto(arquivo: Blob, opcoes: OpcoesReducao = {}): Promise<FotoReduzida> {
  const ladoMaximo = opcoes.ladoMaximo ?? 1600;
  const qualidade = opcoes.qualidade ?? 0.8;

  const imagem = await abrirImagem(arquivo);
  const escala = Math.min(1, ladoMaximo / Math.max(imagem.largura, imagem.altura));
  const largura = Math.max(1, Math.round(imagem.largura * escala));
  const altura = Math.max(1, Math.round(imagem.altura * escala));

  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não deu para preparar a foto.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(imagem.fonte, 0, 0, largura, altura);
  imagem.liberar();

  const webp = await paraBlob(canvas, "image/webp", qualidade);
  if (webp && webp.type === "image/webp") return { blob: webp, formato: "webp", largura, altura };
  const jpeg = await paraBlob(canvas, "image/jpeg", qualidade);
  if (!jpeg) throw new Error("Não deu para preparar a foto.");
  return { blob: jpeg, formato: "jpg", largura, altura };
}

/**
 * Envia a foto para o endereço assinado de criarUrlEnvioFoto() (de "@/lib/dados/fotos").
 * Devolve true se deu certo.
 */
export async function enviarFoto(foto: Blob, urlEnvio: string): Promise<boolean> {
  const corpo = new FormData();
  corpo.append("cacheControl", "31536000"); // a foto nunca muda (nome único): pode guardar 1 ano
  corpo.append("", foto);
  const cabecalhos: Record<string, string> = { "x-upsert": "false" };
  const chave = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (chave) cabecalhos.apikey = chave; // chave pública (não é segredo)
  try {
    const r = await fetch(urlEnvio, { method: "PUT", body: corpo, headers: cabecalhos });
    return r.ok;
  } catch {
    return false;
  }
}

/** Endereço público de uma foto do bucket "anuncios" a partir do caminho. */
export function urlPublicaFoto(caminho: string): string {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  return `${base}/storage/v1/object/public/anuncios/${caminho.split("/").map(encodeURIComponent).join("/")}`;
}

type ImagemAberta = { fonte: CanvasImageSource; largura: number; altura: number; liberar: () => void };

async function abrirImagem(arquivo: Blob): Promise<ImagemAberta> {
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(arquivo, { imageOrientation: "from-image" });
      return { fonte: bmp, largura: bmp.width, altura: bmp.height, liberar: () => bmp.close() };
    } catch {
      // navegador antigo ou formato não suportado: tenta pelo <img>
    }
  }
  const url = URL.createObjectURL(arquivo);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return { fonte: img, largura: img.naturalWidth, altura: img.naturalHeight, liberar: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    throw new Error("Essa foto não abriu. Tente outra.");
  }
}

function paraBlob(canvas: HTMLCanvasElement, tipo: string, qualidade: number): Promise<Blob | null> {
  return new Promise((ok) => canvas.toBlob((b) => ok(b), tipo, qualidade));
}
