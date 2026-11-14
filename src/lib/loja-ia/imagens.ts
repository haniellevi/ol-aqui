import "server-only";
import { createHash, randomUUID } from "node:crypto";
import sharp from "sharp";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ehUuid } from "@/lib/formato";

const BALDE = "loja-ia";
const MAXIMO = 20 * 1024 * 1024;
const TIPOS: Record<string, string[]> = { "image/jpeg": ["jpg", "jpeg"], "image/png": ["png"], "image/webp": ["webp"] };
export type MetadadosImagem = { nome: string; tipo: string; tamanho: number };
export type EnvioMaterial = { id: string; urlEnvio: string; token: string };
type Registro = { id: string; caminho: string; mime: string; tamanho: number; tipo: string; estado: string };

export async function normalizarMaterial(bytes: Buffer, mime: string): Promise<Buffer> {
  if (!bytes.length || bytes.length > MAXIMO) throw new Error("Escolha uma imagem de até 20 MB.");
  try {
    const original = sharp(bytes, { limitInputPixels: 16_000_000, animated: false });
    const metadados = await original.metadata();
    const esperado = mime === "image/jpeg" ? "jpeg" : mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "";
    if (!esperado || metadados.format !== esperado || (metadados.pages ?? 1) > 1) throw new Error("Formato da imagem inválido.");
    const normalizada = await original.autoOrient().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
    if (normalizada.length > MAXIMO) throw new Error("Escolha uma imagem de até 20 MB.");
    return normalizada;
  } catch (e) {
    if (e instanceof Error && /20 MB|Formato da imagem/.test(e.message)) throw e;
    throw new Error("Formato da imagem inválido ou arquivo danificado.");
  }
}

async function propria(rascunhoId: string, imagemId: string): Promise<Registro> {
  if (!ehUuid(rascunhoId) || !ehUuid(imagemId)) throw new Error("Imagem não encontrada.");
  const db = await createClient();
  const { data, error } = await db.rpc("loja_ia_obter_imagem_propria", { p_rascunho: rascunhoId, p_imagem: imagemId });
  if (error || !data) throw new Error("Imagem não encontrada.");
  return data as Registro;
}

export async function prepararMaterial(rascunhoId: string, arquivo: MetadadosImagem, tipo: "logo" | "foto"): Promise<EnvioMaterial> {
  const extensao = arquivo.nome.split(".").pop()?.toLowerCase() ?? "";
  if (!ehUuid(rascunhoId) || !TIPOS[arquivo.tipo]?.includes(extensao) || !Number.isSafeInteger(arquivo.tamanho) || arquivo.tamanho < 1 || arquivo.tamanho > MAXIMO || !["logo", "foto"].includes(tipo)) throw new Error("Escolha uma imagem JPEG, PNG ou WebP de até 20 MB.");
  const db = await createClient();
  const { data, error } = await db.rpc("loja_ia_reservar_imagem", { p_rascunho: rascunhoId, p_tipo: tipo, p_mime: arquivo.tipo, p_tamanho: arquivo.tamanho });
  if (error || !data) throw new Error("Não foi possível preparar o envio da imagem.");
  const { data: envio, error: erroEnvio } = await supabaseAdmin().storage.from(BALDE).createSignedUploadUrl(data.caminho);
  if (erroEnvio || !envio) throw new Error("Não foi possível preparar o envio da imagem.");
  return { id: data.id, urlEnvio: envio.signedUrl, token: envio.token };
}

export async function finalizarMaterial(rascunhoId: string, imagemId: string): Promise<{ id: string }> {
  const registro = await propria(rascunhoId, imagemId);
  if (registro.estado !== "upload") throw new Error("Envio já concluído ou indisponível.");
  const admin = supabaseAdmin();
  const storage = admin.storage.from(BALDE);
  const { data, error } = await storage.download(registro.caminho);
  if (error || !data || data.size !== registro.tamanho || data.size > MAXIMO) throw new Error("Não foi possível conferir a imagem enviada.");
  const bytes = await normalizarMaterial(Buffer.from(await data.arrayBuffer()), registro.mime);
  const id = randomUUID();
  const caminho = `${rascunhoId}/pronta/${id}.webp`;
  const { error: erroReserva } = await admin.rpc("loja_ia_reservar_normalizada", { p_original: imagemId, p_novo: id, p_caminho: caminho, p_tamanho: bytes.length });
  if (erroReserva) throw new Error("Não foi possível preparar a imagem.");
  const { error: erroUpload } = await storage.upload(caminho, bytes, { contentType: "image/webp", upsert: false, cacheControl: "0" });
  if (erroUpload) throw new Error("Não foi possível guardar a imagem.");
  const { error: erroFinal } = await admin.rpc("loja_ia_finalizar_imagem", { p_original: imagemId, p_novo: id, p_caminho: caminho, p_sha256: createHash("sha256").update(bytes).digest("hex"), p_tamanho: bytes.length });
  if (erroFinal) {
    throw new Error("Não foi possível confirmar a imagem. Tente novamente.");
  }
  return { id };
}

export async function prepararImagemPublicacao(rascunhoId: string, materialId: string, uso: "logo" | "capa"): Promise<{ id: string; url: string }> {
  if (!["logo", "capa"].includes(uso)) throw new Error("Uso da imagem inválido.");
  const material = await propria(rascunhoId, materialId);
  if (material.estado !== "pronta") throw new Error("Imagem ainda não está pronta.");
  return { id: material.id, url: `/api/loja/imagem/${material.id}` };
}

export async function urlRevisaoMaterial(rascunhoId: string, materialId: string): Promise<string> {
  const material = await propria(rascunhoId, materialId);
  if (material.estado !== "pronta") throw new Error("Imagem ainda não está pronta.");
  return `/api/loja/imagem/${material.id}/revisao?rascunho=${rascunhoId}`;
}

/** Chamada pelo trabalho de limpeza; uma falha pode ser repetida com o mesmo ID. */
export async function limparMaterial(materialId: string): Promise<boolean> {
  if (!ehUuid(materialId)) return false;
  const admin = supabaseAdmin();
  const { data: caminho, error } = await admin.rpc("loja_ia_marcar_descarte", { p_imagem: materialId });
  if (error || !caminho) return false;
  const { error: falha } = await admin.storage.from(BALDE).remove([caminho]);
  if (falha) return false;
  const { error: confirmacao } = await admin.rpc("loja_ia_confirmar_descarte", { p_imagem: materialId });
  return !confirmacao;
}

/** Processa até 100 registros e 100 objetos de contas excluídas; seguro para repetir. */
export async function limparMateriaisPendentes(): Promise<void> {
  const admin = supabaseAdmin();
  const { data, error } = await admin.rpc("loja_ia_lote_limpeza");
  if (error || !data) throw new Error("Não foi possível consultar a limpeza de imagens.");
  for (const id of data.imagens as string[]) await limparMaterial(id);
  for (const caminho of data.lixeira as string[]) {
    const { error: falha } = await admin.storage.from(BALDE).remove([caminho]);
    if (!falha) await admin.rpc("loja_ia_confirmar_lixeira", { p_caminho: caminho });
  }
}

/** Recebe apenas IDs escolhidos na coleta e nunca consulta outro rascunho. */
export async function coletarMateriais(rascunhoId: string, materiais: string[]) {
  const ids = [...new Set((Array.isArray(materiais) ? materiais : []).filter((valor): valor is string => typeof valor === "string" && ehUuid(valor)))].slice(0, 24);
  if (!ehUuid(rascunhoId) || !ids.length) return { estado: "indisponivel" as const, motivo: "Nenhuma imagem disponível." };
  const { data, error } = await supabaseAdmin().from("loja_ia_imagens").select("id,tipo").eq("rascunho_id", rascunhoId).eq("estado", "pronta").in("id", ids);
  if (error || !data?.length) return { estado: "indisponivel" as const, motivo: "Não foi possível conferir as imagens." };
  const evidencias = data.map((imagem) => ({
    id: `materiais:${imagem.id}`,
    campo: imagem.tipo === "logo" ? "logo" as const : "capa" as const,
    valor: imagem.id as string,
    origem: { fonte: "materiais" as const, rotulo: "Enviado pelo lojista" },
  }));
  return { estado: "ok" as const, evidencias };
}
