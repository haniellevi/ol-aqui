import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
// Mantém a assinatura; nenhum texto livre chega ao banco.
export async function registrarBusca(_termo: string, microrregiaoId: string | null, categoriaSlug: string | null, total: number, permitido = false) {
  // Gate avaliado na requisição, antes de after(), onde cookies já não estão disponíveis.
  if (!permitido || !Number.isFinite(total)) return;
  try {
    await supabaseAdmin().rpc("registrar_busca_consentida", {
      p_microrregiao: microrregiaoId, p_categoria_slug: categoriaSlug,
      p_faixa: total === 0 ? "zero" : total <= 10 ? "1-10" : "11+",
    });
  } catch { /* não interrompe a busca */ }
}
