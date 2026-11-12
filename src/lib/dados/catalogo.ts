import "server-only";
import { createClient } from "@/lib/supabase/server";
import { seguro } from "@/lib/dados/seguro";
import type { AnuncioCard, Regiao } from "@/lib/tipos";

export type LojaCatalogo = {
  id: string;
  slug: string;
  nome: string;
  cidade: string;
  logo_url: string | null;
  verificada: boolean;
  total: number;
};

const recorte = (regiao: Regiao, nicho: string | null, limite: number, offset: number) => ({
  p_regiao: regiao.id,
  p_cidade: regiao.cidade ?? regiao.cidadeSede,
  p_nicho: nicho,
  p_limite: limite,
  p_offset: offset,
});

export async function lojasCatalogo(regiao: Regiao, nicho: string | null, limite: number, offset = 0, destaques = false) {
  const db = await createClient();
  const { data, error } = await db.rpc("catalogo_lojas", { ...recorte(regiao, nicho, limite, offset), p_destaques: destaques });
  if (error || !Array.isArray(data)) throw new Error("Não foi possível carregar o catálogo de lojas.");
  return data as LojaCatalogo[];
}

export async function anunciosCatalogo(
  regiao: Regiao, modo: "feed" | "patrocinados" | "lojas", limite: number, nicho: string | null = null, offset = 0,
) {
  const db = await createClient();
  const { data, error } = await db.rpc("catalogo_anuncios", { ...recorte(regiao, nicho, limite, offset), p_modo: modo });
  if (error || !Array.isArray(data)) throw new Error("Não foi possível carregar os produtos da região.");
  return data as AnuncioCard[];
}

/**
 * Categorias dos anúncios no ar de cada loja (vitrine → ids de categoria), para o filtro "tipo de loja"
 * do Início. Leitura pública (só anúncios ativos). Falhou → mapa vazio: o filtro some e as lojas continuam.
 */
export async function categoriasDasLojas(ids: string[]): Promise<Map<string, string[]>> {
  const mapa = new Map<string, string[]>();
  if (!ids.length) return mapa;
  return seguro(async () => {
    const db = await createClient();
    const { data, error } = await db.from("anuncios").select("vitrine_id, categoria_id")
      .in("vitrine_id", ids).eq("status", "ativo").limit(2000);
    if (error || !Array.isArray(data)) return mapa;
    for (const { vitrine_id, categoria_id } of data as { vitrine_id: string | null; categoria_id: string | null }[]) {
      if (!vitrine_id || !categoria_id) continue;
      mapa.set(vitrine_id, [...(mapa.get(vitrine_id) ?? []), categoria_id]);
    }
    return mapa;
  }, mapa);
}
