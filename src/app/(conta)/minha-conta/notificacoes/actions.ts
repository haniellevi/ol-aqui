"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ehUuid } from "@/lib/formato";
import { LINK_AVISOS } from "@/lib/rotas";

// Avisos: marcar como lido passa pela função do banco (a pessoa só mexe nos próprios avisos).

/** Só links do próprio site ("/radar/..."), nunca para fora. */
const linkInterno = (v: unknown) => (typeof v === "string" && /^\/(?!\/)[^\s\\]*$/.test(v) ? v : null);

export async function marcarTodasLidas() {
  const { userId } = await auth();
  if (!userId) return;
  const db = await createClient();
  await db.rpc("marcar_notificacoes_lidas", { p_ids: null });
  revalidatePath(LINK_AVISOS);
  revalidatePath("/minha-conta");
}

/** Liga ou desliga um aviso para a própria pessoa (o banco confere se o tipo pode ser escolhido). */
export async function salvarPreferenciaAviso(formData: FormData) {
  const { userId } = await auth();
  const tipo = String(formData.get("tipo") ?? "");
  const ligar = formData.get("ligar") === "sim";
  if (!userId || !/^[a-z0-9_]{3,40}$/.test(tipo)) return;
  const db = await createClient();
  await db.rpc("salvar_preferencia_aviso", { p_tipo: tipo, p_ligado: ligar });
  revalidatePath(LINK_AVISOS);
}

/** Abre um aviso: marca como lido e leva para a tela dele. */
export async function abrirAviso(formData: FormData) {
  const { userId } = await auth();
  const id = String(formData.get("id") ?? "");
  const destino = linkInterno(formData.get("link")) ?? LINK_AVISOS;
  if (userId && ehUuid(id)) {
    const db = await createClient();
    await db.rpc("marcar_notificacoes_lidas", { p_ids: [id] });
    revalidatePath(LINK_AVISOS);
    revalidatePath("/minha-conta");
  }
  redirect(destino);
}
