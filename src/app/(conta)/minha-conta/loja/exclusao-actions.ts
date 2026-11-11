"use server";
// Minha loja · o dono tira a própria loja do ar. A vitrine e os anúncios ficam 30 dias na
// lixeira (excluir_minha_loja) e o dono pode restaurar nesse prazo (restaurar_minha_loja).
// A conta continua. Depois do prazo, /api/interno/limpeza apaga de vez.
import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";

export type EstadoExcluirLoja = { ok?: boolean; apagarApos?: string; erro?: string } | null;

const PALAVRA_CONFIRMACAO = "EXCLUIR";

export async function excluirMinhaLoja(_antes: EstadoExcluirLoja, form: FormData): Promise<EstadoExcluirLoja> {
  const { userId } = await auth();
  if (!userId) return { erro: "Entre na sua conta para continuar." };
  const digitado = String(form.get("confirmacao") ?? "").trim().toUpperCase();
  if (digitado !== PALAVRA_CONFIRMACAO) return { erro: `Para confirmar, escreva ${PALAVRA_CONFIRMACAO} no campo.` };
  const db = await createClient();
  const { data, error } = await db.rpc("excluir_minha_loja", { p_confirmacao: digitado });
  if (error) {
    if (error.code === "23514" || error.code === "22023") return { erro: error.message };
    return { erro: "Não deu para excluir sua loja agora. Tente de novo em alguns minutos." };
  }
  revalidatePath("/", "layout");
  return { ok: true, apagarApos: String(data) };
}

export async function restaurarMinhaLoja(): Promise<EstadoExcluirLoja> {
  const { userId } = await auth();
  if (!userId) return { erro: "Entre na sua conta para continuar." };
  const db = await createClient();
  const { error } = await db.rpc("restaurar_minha_loja");
  if (error) {
    if (error.code === "22023") return { erro: error.message };
    return { erro: "Não deu para restaurar sua loja agora. Tente de novo em alguns minutos." };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}
