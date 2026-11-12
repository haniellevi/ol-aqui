import "server-only";
import { createClient } from "@/lib/supabase/server";
import { ehUuid } from "@/lib/formato";

// Etapa P4: números por produto para o dono da loja (7, 30 ou 90 dias).
// A função do banco só responde ao dono da loja. null = falha de leitura.

export type PeriodoProdutos = 7 | 30 | 90;
export const PERIODOS_PRODUTOS: PeriodoProdutos[] = [7, 30, 90];

export type TermoProduto = { termo: string; vezes: number };
export type NumerosProduto = {
  anuncio_id: string;
  titulo: string;
  foto: string | null;
  status: string;
  no_ar: boolean;
  aparicoes: number;
  visualizacoes: number;
  cliques_whatsapp: number;
  favoritos: number;
  posicao_media: number | null;
  pct_chamou: number | null;
  termos: TermoProduto[];
  tempo_ate_sair_dias: number | null;
};

const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0);
const nOuNulo = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null);

export async function meusNumerosProdutos(vitrineId: string, dias: PeriodoProdutos): Promise<NumerosProduto[] | null> {
  if (!ehUuid(vitrineId)) return null;
  try {
    const db = await createClient();
    const { data, error } = await db.rpc("minha_loja_metricas_produtos", { p_vitrine: vitrineId, p_dias: dias });
    if (error || !Array.isArray(data)) return null;
    return (data as Record<string, unknown>[])
      .filter((l) => ehUuid(String(l.anuncio_id)))
      .map((l) => ({
        anuncio_id: String(l.anuncio_id),
        titulo: typeof l.titulo === "string" && l.titulo.trim() ? l.titulo.trim() : "Produto",
        foto: typeof l.foto === "string" && l.foto.startsWith("https://") ? l.foto : null,
        status: typeof l.status === "string" ? l.status : "",
        no_ar: l.no_ar === true,
        aparicoes: n(l.aparicoes),
        visualizacoes: n(l.visualizacoes),
        cliques_whatsapp: n(l.cliques_whatsapp),
        favoritos: n(l.favoritos),
        posicao_media: nOuNulo(l.posicao_media),
        pct_chamou: nOuNulo(l.pct_chamou),
        termos: (Array.isArray(l.termos) ? l.termos : [])
          .filter((t): t is Record<string, unknown> => !!t && typeof t === "object")
          .map((t) => ({ termo: String(t.termo ?? ""), vezes: n(t.vezes) }))
          .filter((t) => t.termo)
          .slice(0, 3),
        tempo_ate_sair_dias: nOuNulo(l.tempo_ate_sair_dias),
      }));
  } catch {
    return null;
  }
}
