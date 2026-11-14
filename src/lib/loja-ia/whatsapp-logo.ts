import "server-only";
import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { enderecoPublico } from "@/lib/loja-ia/fontes";
import { normalizarMaterial } from "@/lib/loja-ia/imagens";
import { supabaseAdmin } from "@/lib/supabase/admin";

const MAXIMO = 5 * 1024 * 1024;

/** A URL assinada do provedor fica somente no servidor durante a importação. */
export async function baixarFotoWhatsapp(endereco: string): Promise<{ bytes: Buffer; mime: string }> {
  const url = new URL(endereco);
  if (endereco.length > 2048 || url.protocol !== "https:" || url.username || url.password || url.port || url.hash
    || !["whatsapp.net", "whatsapp.com", "fbcdn.net"].some(dominio => url.hostname === dominio || url.hostname.endsWith(`.${dominio}`))) {
    throw new Error("Foto do perfil indisponível.");
  }
  const signal = AbortSignal.timeout(8000);
  const ips = await Promise.race([
    lookup(url.hostname, { all: true, verbatim: true }),
    new Promise<never>((_, reject) => signal.addEventListener("abort", () => reject(new Error("Tempo esgotado.")), { once: true })),
  ]);
  if (!ips.length || ips.some(ip => !enderecoPublico(ip.address))) throw new Error("Destino não público.");
  const ip = ips[0];
  return new Promise((resolve, reject) => {
    const req = request(url, { signal, headers: { accept: "image/jpeg,image/png,image/webp" }, lookup: (_host, options, callback) => {
      if (options.all) (callback as unknown as (error: null, addresses: typeof ips) => void)(null, [ip]);
      else callback(null, ip.address, ip.family);
    } }, res => {
      const mime = (res.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase();
      if (res.statusCode !== 200 || !["image/jpeg", "image/png", "image/webp"].includes(mime)
        || Number(res.headers["content-length"] ?? 0) > MAXIMO) {
        res.destroy(); reject(new Error("Foto do perfil indisponível.")); return;
      }
      let tamanho = 0;
      const blocos: Buffer[] = [];
      res.on("data", (bloco: Buffer) => {
        tamanho += bloco.length;
        if (tamanho > MAXIMO) { req.destroy(new Error("Foto muito grande.")); return; }
        blocos.push(bloco);
      });
      res.on("end", () => resolve({ bytes: Buffer.concat(blocos), mime }));
      res.on("error", reject);
    });
    req.on("error", reject);
    req.end();
  });
}

export async function importarLogoWhatsapp(endereco: string, trabalho: { id: string; tentativa: string }): Promise<string> {
  const foto = await baixarFotoWhatsapp(endereco);
  const bytes = await normalizarMaterial(foto.bytes, foto.mime);
  const admin = supabaseAdmin();
  const parametros = { p_trabalho: trabalho.id, p_tentativa: trabalho.tentativa };
  const { data: imagem, error } = await admin.rpc("loja_ia_reservar_logo_whatsapp", {
    ...parametros, p_sha256: createHash("sha256").update(bytes).digest("hex"), p_tamanho: bytes.length,
  });
  if (error || !imagem) throw new Error("Não foi possível preparar o logo do WhatsApp.");
  if (imagem.estado !== "pronta") {
    // Uma repetição grava os mesmos bytes no caminho reservado para este hash.
    const { error: falha } = await admin.storage.from("loja-ia").upload(imagem.caminho, bytes, { contentType: "image/webp", upsert: true, cacheControl: "0" });
    if (falha) throw new Error("Não foi possível guardar o logo do WhatsApp.");
  }
  const { data: id, error: erroFinal } = await admin.rpc("loja_ia_concluir_logo_whatsapp", { ...parametros, p_imagem: imagem.id });
  if (erroFinal || typeof id !== "string") throw new Error("Não foi possível confirmar o logo do WhatsApp.");
  return id;
}
