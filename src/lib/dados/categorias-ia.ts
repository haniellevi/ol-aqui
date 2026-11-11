import "server-only";
import { createClient } from "@/lib/supabase/server";
import { ehUuid } from "@/lib/formato";

// Vitrine com IA, etapa 4: o que a IA sugeriu para a loja (categorias dos produtos e nicho).
// As funções do banco só devolvem dados da loja de quem está logado. null = falha de leitura.

export type SugestaoCategoria = {
  anuncio_id: string; titulo: string; foto: string | null;
  categoria_atual: string | null; sugerida_id: string; sugerida: string;
};
export type SugestaoNicho = { nicho_id: string | null; nicho_nome: string | null; sugerido_id: string | null; sugerido_nome: string | null };
export type Nicho = { id: string; nome: string };

export async function minhasSugestoesCategoria(vitrineId: string): Promise<SugestaoCategoria[] | null> {
  if (!ehUuid(vitrineId)) return null;
  try {
    const db = await createClient();
    const { data, error } = await db.rpc("minhas_sugestoes_categoria", { p_vitrine: vitrineId });
    if (error || !Array.isArray(data)) return null;
    return (data as Record<string, unknown>[])
      .filter((l) => ehUuid(String(l.anuncio_id)) && ehUuid(String(l.sugerida_id)) && typeof l.sugerida === "string")
      .map((l) => ({
        anuncio_id: String(l.anuncio_id), titulo: typeof l.titulo === "string" && l.titulo.trim() ? l.titulo.trim() : "Anúncio",
        foto: typeof l.foto === "string" ? l.foto : null,
        categoria_atual: typeof l.categoria_atual === "string" ? l.categoria_atual : null,
        sugerida_id: String(l.sugerida_id), sugerida: String(l.sugerida),
      }));
  } catch {
    return null;
  }
}

export async function minhaSugestaoNicho(vitrineId: string): Promise<SugestaoNicho | null> {
  if (!ehUuid(vitrineId)) return null;
  try {
    const db = await createClient();
    const { data, error } = await db.rpc("minha_sugestao_nicho", { p_vitrine: vitrineId });
    if (error || !Array.isArray(data) || !data[0]) return null;
    const l = data[0] as Record<string, unknown>;
    const texto = (v: unknown) => (typeof v === "string" ? v : null);
    return { nicho_id: texto(l.nicho_id), nicho_nome: texto(l.nicho_nome), sugerido_id: texto(l.sugerido_id), sugerido_nome: texto(l.sugerido_nome) };
  } catch {
    return null;
  }
}

export async function nichosDisponiveis(): Promise<Nicho[]> {
  try {
    const db = await createClient();
    const { data, error } = await db.rpc("nichos_disponiveis");
    if (error || !Array.isArray(data)) return [];
    return (data as Record<string, unknown>[])
      .filter((n) => ehUuid(String(n.id)) && typeof n.nome === "string")
      .map((n) => ({ id: String(n.id), nome: String(n.nome) }));
  } catch {
    return [];
  }
}
