import "server-only";
import { createClient } from "@/lib/supabase/server";
import { ehUuid } from "@/lib/formato";

// Vitrine com IA, etapa 5b: o produto, a cota do mês e a sugestão aberta. Só o dono lê.
// null = produto não encontrado ou falha de leitura.

export type ProblemaFoto = "escura" | "tremida" | "fundo" | "pequeno" | "cortado";
export type DicaFoto = { indice: number; problema: ProblemaFoto; dica: string };
export type Melhoria = {
  id: string; estado: "processando" | "pronta";
  titulo_antes: string; descricao_antes: string | null;
  titulo_novo: string | null; descricao_nova: string | null; dicas_foto: DicaFoto[];
};
export type TelaMelhoria = {
  ativa: boolean; limite: number; usadas: number;
  anuncio: { id: string; titulo: string; descricao: string | null; status: string; fotos: string[] };
  melhoria: Melhoria | null;
};

const PROBLEMAS: ProblemaFoto[] = ["escura", "tremida", "fundo", "pequeno", "cortado"];
const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
const texto = (v: unknown) => (typeof v === "string" ? v : null);

export async function minhaMelhoriaIA(anuncioId: string): Promise<TelaMelhoria | null> {
  if (!ehUuid(anuncioId)) return null;
  try {
    const db = await createClient();
    const { data, error } = await db.rpc("minha_melhoria_ia", { p_anuncio: anuncioId });
    if (error || !data || typeof data !== "object") return null;
    const d = data as Record<string, unknown>;
    const a = (d.anuncio ?? {}) as Record<string, unknown>;
    if (!ehUuid(String(a.id))) return null;
    const m = d.melhoria && typeof d.melhoria === "object" ? (d.melhoria as Record<string, unknown>) : null;
    return {
      ativa: d.ativa === true, limite: n(d.limite), usadas: n(d.usadas),
      anuncio: {
        id: String(a.id), titulo: texto(a.titulo) ?? "Produto", descricao: texto(a.descricao), status: texto(a.status) ?? "",
        fotos: Array.isArray(a.fotos) ? a.fotos.filter((f): f is string => typeof f === "string" && f.startsWith("https://")).slice(0, 3) : [],
      },
      melhoria: m && ehUuid(String(m.id)) && (m.estado === "processando" || m.estado === "pronta") ? {
        id: String(m.id), estado: m.estado,
        titulo_antes: texto(m.titulo_antes) ?? "", descricao_antes: texto(m.descricao_antes),
        titulo_novo: texto(m.titulo_novo), descricao_nova: texto(m.descricao_nova),
        dicas_foto: (Array.isArray(m.dicas_foto) ? m.dicas_foto : [])
          .filter((x): x is DicaFoto => !!x && Number.isInteger(x.indice) && PROBLEMAS.includes(x.problema) && typeof x.dica === "string")
          .slice(0, 3),
      } : null,
    };
  } catch {
    return null;
  }
}
