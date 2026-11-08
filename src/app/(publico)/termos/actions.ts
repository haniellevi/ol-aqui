"use server";
// Aceite dos termos e da privacidade (faixa "Atualizamos os termos" e /entrar/perfil).
// Usa a sessão da pessoa: a função do banco confere quem é e se as versões ainda estão no ar.
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { traduzirErro } from "@/lib/erros";

export type RespostaAceite = { ok: true } | { ok: false; erro: string; mudou?: boolean };

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Aceita as versões que a pessoa viu (ids). Se uma saiu do ar no meio, devolve mudou = true. */
export async function aceitarTermos(ids: string[]): Promise<RespostaAceite> {
  const { userId } = await auth();
  if (!userId) return { ok: false, erro: "Entre na sua conta para aceitar." };
  const lista = Array.isArray(ids) ? [...new Set(ids.filter((i) => typeof i === "string" && ID.test(i)))].slice(0, 10) : [];
  if (lista.length === 0) return { ok: false, erro: "Não há nada para aceitar." };
  try {
    const db = await createClient();
    const { error } = await db.rpc("aceitar_documentos_legais", { p_documentos: lista });
    if (error) {
      const mudou = /mudaram agora/i.test(error.message ?? "");
      return { ok: false, erro: traduzirErro(error).mensagem, mudou };
    }
  } catch {
    return { ok: false, erro: "Sem conexão agora. Tente de novo." };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}
