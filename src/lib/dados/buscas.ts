import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Soma uma busca do site em buscas_termos (dia, região, termo e categoria; sem pessoa).
 * Serve ao alerta "muita gente buscou isso" (docs/PLANO-VITRINE-IA.md). Nunca derruba a busca:
 * sem a chave do servidor ou com erro no banco, a contagem simplesmente não acontece.
 */
export async function registrarBusca(termo: string, microrregiaoId: string | null, categoriaSlug: string | null, total: number) {
  const t = termo.trim();
  if (t.length < 2) return;
  try {
    await supabaseAdmin().rpc("registrar_busca", {
      p_termo: t.slice(0, 120),
      p_microrregiao: microrregiaoId,
      p_categoria_slug: categoriaSlug,
      p_total: Number.isFinite(total) ? Math.max(0, Math.trunc(total)) : null,
    });
  } catch {
    // contagem é secundária
  }
}
