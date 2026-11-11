"use server";

import { auth } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ehUuid } from "@/lib/formato";

// Vitrine com IA, etapa 5a: conta visita e cliques (WhatsApp, mapa) na página da loja.
// Quem decide o que vale é o banco (registrar_evento_loja): ignora repetição do mesmo visitante,
// o próprio dono e loja fora do ar. Guarda só um resumo embaralhado, nunca o IP.

export type TipoEventoLoja = "visita" | "clique_whatsapp" | "clique_mapa";
const TIPOS: TipoEventoLoja[] = ["visita", "clique_whatsapp", "clique_mapa"];

/** Nunca lança erro: a pessoa que visita a loja não precisa saber. */
export async function registrarEventoLoja(vitrineId: string, tipo: TipoEventoLoja): Promise<boolean> {
  if (!ehUuid(vitrineId) || !TIPOS.includes(tipo)) return false;
  try {
    const h = await headers();
    const ip = (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "").trim().slice(0, 100);
    const { userId } = await auth();
    const { data, error } = await supabaseAdmin().rpc("registrar_evento_loja", {
      p_vitrine: vitrineId,
      p_tipo: tipo,
      p_visitante: ip || null,
      p_usuario: userId ?? null,
    });
    return !error && data === true;
  } catch {
    return false;
  }
}
