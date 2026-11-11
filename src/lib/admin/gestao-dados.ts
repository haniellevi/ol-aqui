import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { LocalidadesGestao } from "./gestao";

export async function localidadesGestao(db: SupabaseClient): Promise<LocalidadesGestao | null> {
  const [r, c] = await Promise.all([
    db.from("microrregioes").select("id,nome").order("nome"),
    db.from("cidades").select("nome,microrregiao_id").eq("ativa", true).order("nome"),
  ]);
  if (r.error || c.error) return null;
  return { regioes: r.data ?? [], cidades: c.data ?? [] };
}
