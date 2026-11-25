"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { exigirAdmin } from "@/lib/admin/auth";
import { ehUuid } from "@/lib/formato";
import { traduzirErro } from "@/lib/erros";

export type EstadoRetencao = { erro?: string; ok?: string } | null;
export async function registrarRetencao(_: EstadoRetencao, form: FormData): Promise<EstadoRetencao> {
  try {
    const { supabase } = await exigirAdmin();
    const consulta = String(form.get("consulta") ?? "");
    const item = String(form.get("id") ?? "");
    const tipo = String(form.get("tipo") ?? "");
    const acao = String(form.get("acao") ?? "");
    const motivo = String(form.get("motivo") ?? "").trim();
    if (!ehUuid(consulta) || !ehUuid(item) || !["anuncio", "pedido"].includes(tipo) || !["liberar", "revisar"].includes(acao)) return { erro: "Atualize a consulta e escolha o item novamente." };
    if (motivo.length < 3 || motivo.length > 300) return { erro: "Escreva um motivo de 3 a 300 caracteres." };
    const { data, error } = await supabase.rpc(acao === "liberar" ? "compliance_liberar_retencao" : "compliance_revisar_retencao", {
      p_consulta: consulta, p_tipo: tipo, p_item: item, p_motivo: motivo,
    });
    if (error) return { erro: traduzirErro(error).mensagem };
    if (typeof data !== "string") return { erro: "Não deu para confirmar o registro. Atualize e tente novamente." };
    revalidatePath("/admin/compliance");
    return { ok: "Registro salvo. A revisão manual continua pendente, com dados e fotos preservados." };
  } catch (e) {
    unstable_rethrow(e);
    return { erro: "Não deu para registrar agora. Tente novamente." };
  }
}
