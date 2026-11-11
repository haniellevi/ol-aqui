"use server";
// LGPD · Excluir minha conta. A conta, a loja e os anúncios saem do ar e ficam 30 dias na
// lixeira (pedir_exclusao_conta). Entrar de novo nesse prazo permite cancelar.
// Depois do prazo, /api/interno/limpeza apaga no Clerk e no banco (guarda fiscal e provas ficam).
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";

export type EstadoExcluir = { ok?: boolean; apagarApos?: string; erro?: string } | null;

const PALAVRA_CONFIRMACAO = "EXCLUIR";

export async function excluirConta(_antes: EstadoExcluir, form: FormData): Promise<EstadoExcluir> {
  const { userId } = await auth();
  if (!userId) return { erro: "Entre na sua conta para continuar." };
  const digitado = String(form.get("confirmacao") ?? "").trim().toUpperCase();
  if (digitado !== PALAVRA_CONFIRMACAO) return { erro: `Para confirmar, escreva ${PALAVRA_CONFIRMACAO} no campo.` };
  const db = await createClient();
  const { data, error } = await db.rpc("pedir_exclusao_conta", { p_confirmacao: digitado });
  if (error) {
    if (error.code === "23514") return { erro: error.message };
    return { erro: "Não deu para excluir sua conta agora. Tente de novo em alguns minutos." };
  }
  return { ok: true, apagarApos: String(data) };
}
