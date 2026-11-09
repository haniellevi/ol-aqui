"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ehUuid } from "@/lib/formato";
import { LINK_AVISOS } from "@/lib/rotas";

type RespostaAviso = { ok: true; mensagem: string; destino?: string } | { ok: false; erro: string };
const SEM_LOGIN = "Entre na sua conta para acessar seus avisos.";
const contagemValida = (n: unknown): n is number => typeof n === "number" && Number.isSafeInteger(n) && n >= 0;
function atualizar() {
  revalidatePath(LINK_AVISOS);
  revalidatePath("/minha-conta");
}

export async function marcarTodasLidas(): Promise<RespostaAviso> {
  const { userId } = await auth();
  if (!userId) return { ok: false, erro: SEM_LOGIN };
  const db = await createClient();
  const { data, error } = await db.rpc("marcar_notificacoes_lidas", { p_ids: null });
  if (error || !contagemValida(data)) return { ok: false, erro: "Não conseguimos marcar os avisos. Tente novamente." };
  atualizar();
  return { ok: true, mensagem: data === 0 ? "Todos os avisos já estavam lidos." : "Todos os avisos foram marcados como lidos." };
}

export async function salvarPreferenciaAviso(tipo: string, ligar: boolean): Promise<RespostaAviso> {
  const { userId } = await auth();
  if (!userId) return { ok: false, erro: SEM_LOGIN };
  if (typeof tipo !== "string" || !/^[a-z0-9_]{3,40}$/.test(tipo) || typeof ligar !== "boolean") return { ok: false, erro: "Escolha uma preferência válida." };
  const db = await createClient();
  const { data, error } = await db.rpc("salvar_preferencia_aviso", { p_tipo: tipo, p_ligado: ligar });
  if (error || data !== ligar) return { ok: false, erro: "Não conseguimos salvar sua preferência. Tente novamente." };
  revalidatePath(LINK_AVISOS);
  return { ok: true, mensagem: ligar ? "Aviso ligado." : "Aviso desligado. Os avisos anteriores continuam disponíveis." };
}

/** O destino vem do aviso da própria pessoa no banco, nunca de um campo enviado pelo navegador. */
export async function abrirAviso(id: string): Promise<RespostaAviso> {
  const { userId } = await auth();
  if (!userId) return { ok: false, erro: SEM_LOGIN };
  if (!ehUuid(id)) return { ok: false, erro: "Aviso não encontrado. Atualize a lista." };
  const db = await createClient();
  const { data: aviso, error: erroLeitura } = await db.from("notificacoes")
    .select("id, link").eq("id", id).eq("usuario_id", userId).eq("canal", "app").maybeSingle();
  if (erroLeitura || !aviso || aviso.id !== id) return { ok: false, erro: "Não conseguimos abrir este aviso. Atualize a lista e tente novamente." };
  const destino = aviso.link;
  if (destino !== null && (typeof destino !== "string" || destino.length > 300 || !/^\/(?:[A-Za-z0-9_-][A-Za-z0-9/_?=&%.,-]*)?$/.test(destino))) {
    return { ok: false, erro: "O destino deste aviso está indisponível." };
  }
  const { data, error } = await db.rpc("marcar_notificacoes_lidas", { p_ids: [id] });
  if (error || !contagemValida(data) || data > 1) return { ok: false, erro: "Não conseguimos confirmar a leitura. Tente novamente." };
  atualizar();
  return { ok: true, mensagem: "Aviso marcado como lido.", ...(destino ? { destino } : {}) };
}
