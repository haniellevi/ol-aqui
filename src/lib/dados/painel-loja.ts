import "server-only";
import { createClient } from "@/lib/supabase/server";
import { ehUuid } from "@/lib/formato";

// Vitrine com IA, etapa 5a: números da loja e dicas por regra (sem IA).
// As funções do banco só respondem ao dono da loja. null = falha de leitura.

export type NumerosLoja = { visitas: number; visualizacoes: number; cliques_whatsapp: number; cliques_mapa: number; favoritos: number };
export type MaisVisto = { anuncio_id: string; titulo: string; foto: string | null; visualizacoes: number; cliques: number };
export type DesempenhoLoja = { dias: 7 | 30; atual: NumerosLoja; anterior: NumerosLoja; mais_vistos: MaisVisto[] };
export type MotivoDica = "sem_foto" | "vistos_sem_clique" | "sem_preco" | "poucas_fotos" | "descricao_curta" | "titulo_curto";
export type DicaLoja = { anuncio_id: string; titulo: string; motivo: MotivoDica; texto: string };

const MOTIVOS: MotivoDica[] = ["sem_foto", "vistos_sem_clique", "sem_preco", "poucas_fotos", "descricao_curta", "titulo_curto"];
const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
const titulo = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : "Produto");

function numeros(v: unknown): NumerosLoja {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  return { visitas: n(o.visitas), visualizacoes: n(o.visualizacoes), cliques_whatsapp: n(o.cliques_whatsapp), cliques_mapa: n(o.cliques_mapa), favoritos: n(o.favoritos) };
}

export async function meuDesempenhoLoja(vitrineId: string, dias: 7 | 30): Promise<DesempenhoLoja | null> {
  if (!ehUuid(vitrineId)) return null;
  try {
    const db = await createClient();
    const { data, error } = await db.rpc("minha_loja_desempenho", { p_vitrine: vitrineId, p_dias: dias });
    if (error || !data || typeof data !== "object") return null;
    const d = data as Record<string, unknown>;
    const lista = Array.isArray(d.mais_vistos) ? (d.mais_vistos as Record<string, unknown>[]) : [];
    return {
      dias: d.dias === 30 ? 30 : 7,
      atual: numeros(d.atual),
      anterior: numeros(d.anterior),
      mais_vistos: lista.filter((l) => ehUuid(String(l?.anuncio_id))).slice(0, 5).map((l) => ({
        anuncio_id: String(l.anuncio_id), titulo: titulo(l.titulo),
        foto: typeof l.foto === "string" && l.foto.startsWith("https://") ? l.foto : null,
        visualizacoes: n(l.visualizacoes), cliques: n(l.cliques),
      })),
    };
  } catch {
    return null;
  }
}

export async function minhasDicasLoja(vitrineId: string): Promise<DicaLoja[] | null> {
  if (!ehUuid(vitrineId)) return null;
  try {
    const db = await createClient();
    const { data, error } = await db.rpc("minhas_sugestoes_loja", { p_vitrine: vitrineId });
    if (error || !Array.isArray(data)) return null;
    return (data as Record<string, unknown>[])
      .filter((l) => ehUuid(String(l.anuncio_id)) && MOTIVOS.includes(l.motivo as MotivoDica) && typeof l.texto === "string")
      .map((l) => ({ anuncio_id: String(l.anuncio_id), titulo: titulo(l.titulo), motivo: l.motivo as MotivoDica, texto: String(l.texto) }));
  } catch {
    return null;
  }
}
