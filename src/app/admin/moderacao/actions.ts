"use server";

import { revalidatePath } from "next/cache";
import { exigirAdmin } from "@/lib/admin/auth";

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
