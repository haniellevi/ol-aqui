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
