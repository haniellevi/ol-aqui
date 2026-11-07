"use server";
// LGPD · Excluir minha conta. Apaga o usuário no Clerk; o webhook do Clerk (user.deleted)
// remove o perfil no banco ou, se houver pagamentos (guarda fiscal), tira tudo do ar e anonimiza.
import { auth, clerkClient } from "@clerk/nextjs/server";

export type EstadoExcluir = { ok?: boolean; erro?: string } | null;

const PALAVRA_CONFIRMACAO = "EXCLUIR";

export async function excluirConta(_antes: EstadoExcluir, form: FormData): Promise<EstadoExcluir> {
  const { userId } = await auth();
  if (!userId) return { erro: "Entre na sua conta para continuar." };
  const digitado = String(form.get("confirmacao") ?? "").trim().toUpperCase();
  if (digitado !== PALAVRA_CONFIRMACAO) return { erro: `Para confirmar, escreva ${PALAVRA_CONFIRMACAO} no campo.` };
  try {
    await (await clerkClient()).users.deleteUser(userId);
  } catch {
    return { erro: "Não deu para excluir sua conta agora. Tente de novo em alguns minutos." };
  }
  return { ok: true };
}
