import "server-only";
import { createHash } from "node:crypto";
import { ehUuid } from "@/lib/formato";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** Arte fixa, sem texto do usuário ou chamada a provedor. */
export async function desenharModeloCapa(): Promise<Buffer> {
  if (process.env.CLOUDFLARE_IMAGENS === "1") {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const servico = getCloudflareContext().env.IMAGENS_TRATAMENTO;
    if (!servico) throw new Error("Serviço de imagens indisponível.");
    const resposta = await servico.fetch("https://imagens.interno/modelo-capa", { method: "GET" });
    if (!resposta.ok) throw new Error("Não foi possível preparar o modelo de capa.");
    return Buffer.from(await resposta.arrayBuffer());
  }
  const { default: sharp } = await import("sharp");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="500" viewBox="0 0 1500 500">
    <defs><linearGradient id="f"><stop stop-color="#512d48"/><stop offset=".5" stop-color="#f8e7d9"/><stop offset="1" stop-color="#be674b"/></linearGradient></defs>
    <rect width="1500" height="500" fill="url(#f)"/>
    <path d="M0 270 Q190 100 380 205 T680 270 V500 H0Z" fill="#dfb09a" opacity=".7"/>
    <path d="M1500 190 Q1310 70 1130 210 T820 270 V500 H1500Z" fill="#edc5a7" opacity=".75"/>
    <circle cx="110" cy="90" r="140" fill="#f6dfce" opacity=".35"/>
    <circle cx="1410" cy="380" r="170" fill="#713d4d" opacity=".23"/>
  </svg>`;
  return sharp(Buffer.from(svg)).webp({ quality: 90 }).toBuffer();
}

/** Uma ação explícita na revisão; repetir após sucesso devolve a mesma capa. */
export async function gerarModeloCapa(rascunhoId: string): Promise<{ id: string }> {
  if (!ehUuid(rascunhoId)) throw new Error("Rascunho não encontrado.");
  const db = await createClient();
  const { data, error } = await db.rpc("loja_ia_reservar_modelo_capa", { p_rascunho: rascunhoId });
  if (error || !data) throw new Error("Não foi possível preparar o modelo de capa.");
  if (data.estado === "pronta") return { id: data.id };
  if (data.estado === "esgotada") throw new Error("O modelo de capa deste rascunho já foi removido.");
  if (data.estado !== "nova") throw new Error("O modelo ainda está sendo preparado. Tente novamente em instantes.");
  const bytes = await desenharModeloCapa();
  const admin = supabaseAdmin();
  const { error: falha } = await admin.storage.from("loja-ia").upload(data.caminho, bytes, { contentType: "image/webp", upsert: false, cacheControl: "0" });
  if (falha) throw new Error("Não foi possível guardar o modelo de capa. Tente novamente mais tarde.");
  const { error: erroFinal } = await admin.rpc("loja_ia_concluir_modelo_capa", { p_imagem: data.id, p_sha256: createHash("sha256").update(bytes).digest("hex"), p_tamanho: bytes.length });
  if (erroFinal) throw new Error("Não foi possível confirmar o modelo de capa. Tente novamente mais tarde.");
  return { id: data.id };
}
