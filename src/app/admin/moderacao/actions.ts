"use server";

import { revalidatePath } from "next/cache";
import { exigirAdmin } from "@/lib/admin/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

type Decisao = "aprovar" | "recusar" | "congelar";

async function fecharDenuncias(
  supabase: Awaited<ReturnType<typeof exigirAdmin>>["supabase"],
  userId: string,
  alvoTipo: "anuncio" | "pedido",
  alvoId: string,
  procedente: boolean,
) {
  await supabase
    .from("denuncias")
    .update({ status: procedente ? "procedente" : "improcedente", resolvido_por: userId, resolvido_em: new Date().toISOString() })
    .eq("alvo_tipo", alvoTipo)
    .eq("alvo_id", alvoId)
    .eq("status", "aberta");
}

export async function decidirAnuncio(form: FormData): Promise<void> {
  const { supabase, userId } = await exigirAdmin();
  const id = String(form.get("id"));
  const decisao = String(form.get("decisao")) as Decisao;
  const motivo = String(form.get("motivo") ?? "").trim();

  if (decisao === "congelar") {
    const { error } = await supabase.rpc("congelar_anuncio", { p_anuncio_id: id, p_motivo: motivo || "Congelado pelo Compliance" });
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("anuncios")
      .update(
        decisao === "aprovar"
          ? { status: "ativo", motivo_analise: null }
          : { status: "pausado", motivo_analise: `Recusado: ${motivo || "fora das regras do OLAKI"}` },
      )
      .eq("id", id);
    if (error) throw new Error(error.message);
  }
  await fecharDenuncias(supabase, userId, "anuncio", id, decisao !== "aprovar");
  revalidatePath("/admin", "layout");
}

export async function decidirPedido(form: FormData): Promise<void> {
  const { supabase, userId } = await exigirAdmin();
  const id = String(form.get("id"));
  const aprovar = form.get("decisao") === "aprovar";
  const motivo = String(form.get("motivo") ?? "").trim();
  const { error } = await supabase
    .from("radar_pedidos")
    .update(aprovar ? { status: "aberto", motivo_analise: null } : { status: "encerrado", motivo_analise: `Recusado: ${motivo || "fora das regras"}` })
    .eq("id", id);
  if (error) throw new Error(error.message);
  await fecharDenuncias(supabase, userId, "pedido", id, !aprovar);
  revalidatePath("/admin", "layout");
}

export async function resolverDenuncia(form: FormData): Promise<void> {
  const { supabase, userId } = await exigirAdmin();
  const { error } = await supabase
    .from("denuncias")
    .update({ status: form.get("procedente") === "sim" ? "procedente" : "improcedente", resolvido_por: userId, resolvido_em: new Date().toISOString() })
    .eq("id", String(form.get("id")));
  if (error) throw new Error(error.message);
  revalidatePath("/admin", "layout");
}

/**
 * Tira a foto do banner de uma loja (volta para o banner modelo) e grava o motivo, que o dono vê
 * em "Minha loja". O banco guarda o endereço tirado (o dono não grava a mesma foto de novo) e a
 * mudança fica no histórico (logs_atividade). Depois o arquivo sai do Storage: sem a chave secreta
 * no servidor, o arquivo fica, mas a foto já saiu da vitrine.
 */
export async function tirarFotoBanner(form: FormData): Promise<void> {
  const { supabase } = await exigirAdmin();
  const id = String(form.get("id") ?? "");
  const motivo = String(form.get("motivo") ?? "").trim().slice(0, 300);
  const { data, error } = await supabase.rpc("moderar_banner_vitrine", { p_vitrine: id, p_motivo: motivo || null });
  if (error) throw new Error(error.message);
  const caminho = caminhoNoBucket(typeof data === "string" ? data : null);
  if (caminho) {
    try {
      await supabaseAdmin().storage.from("anuncios").remove([caminho]);
    } catch {
      // sem a chave secreta ou Storage fora do ar: a foto já não aparece na vitrine
    }
  }
  revalidatePath("/admin", "layout");
  revalidatePath("/loja", "layout");
}

/** "<usuario>/vitrine/<arquivo>" de um endereço público do bucket "anuncios" do OLAKI (ou null). */
function caminhoNoBucket(url: string | null): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
  const prefixo = `${base}/storage/v1/object/public/anuncios/`;
  if (!url || !base || !url.startsWith(prefixo)) return null;
  const caminho = decodeURIComponent(url.slice(prefixo.length).split("?")[0]);
  return /^[A-Za-z0-9_]+\/vitrine\/[A-Za-z0-9_-][A-Za-z0-9._-]*$/.test(caminho) ? caminho : null;
}
