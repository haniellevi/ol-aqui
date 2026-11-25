"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { ehUuid } from "@/lib/formato";

export type ResultadoAutosservico = { ok?: boolean; erro?: string };

async function executar(id: string, rpc: string, args: Record<string, unknown>): Promise<ResultadoAutosservico> {
  const { userId } = await auth();
  if (!userId) return { erro: "Entre na sua conta para continuar." };
  if (!ehUuid(id)) return { erro: "Atualize a página para tentar novamente." };
  try {
    const { data, error } = await (await createClient()).rpc(rpc, args);
    if (error || data !== true) return { erro: error?.code === "40001"
      ? "O rascunho mudou. Atualize a página para tentar novamente."
      : "Não foi possível concluir. Atualize a página para tentar novamente." };
    // Uma seleção antiga nunca deve continuar apontando para o acesso revogado.
    if (rpc === "sair_da_loja") (await cookies()).delete("loja_ativa");
    revalidatePath("/", "layout");
    return { ok: true };
  } catch {
    return { erro: "Não foi possível concluir. Tente novamente." };
  }
}

export async function sairDaLoja(id: string): Promise<ResultadoAutosservico> {
  return executar(id, "sair_da_loja", { p_loja: id });
}

export async function descartarLojaIa(id: string, revisao: number): Promise<ResultadoAutosservico> {
  if (!Number.isSafeInteger(revisao) || revisao < 0) return { erro: "Atualize a página para tentar novamente." };
  return executar(id, "loja_ia_descartar", { p_id: id, p_revisao: revisao });
}
