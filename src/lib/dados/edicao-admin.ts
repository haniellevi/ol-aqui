import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { ehUuid } from "@/lib/formato";

/** Etapa P5b-2a: edição aberta pelo super admin logado neste anúncio (motivo e prazo). Sem edição → null. */
export type EdicaoEquipe = { motivo: string; expira_em: string };

export const edicaoAdmin = cache(async (anuncioId: string): Promise<EdicaoEquipe | null> => {
  if (!ehUuid(anuncioId)) return null;
  const db = await createClient();
  const { data, error } = await db.rpc("minha_edicao_admin", { p_anuncio: anuncioId });
  const linha = Array.isArray(data) ? data[0] : data;
  return !error && linha?.motivo ? { motivo: String(linha.motivo), expira_em: String(linha.expira_em) } : null;
});
