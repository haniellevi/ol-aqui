import "server-only";
import { createClient } from "@/lib/supabase/server";
import { ehUuid } from "@/lib/formato";

type Extra = { preco_antes_centavos: number | null; uf: string | null };

/**
 * Completa os cards de uma lista com o preço antes (riscado) e a UF da cidade ("Corrente - PI"),
 * numa consulta só (anuncios_cards_extra). Se a consulta falhar — por exemplo, migração ainda não
 * aplicada —, devolve os cards como vieram: o card mostra só a cidade e o preço, sem quebrar a tela.
 */
export async function completarCards<T extends { id: string }>(cards: T[]): Promise<(T & Partial<Extra>)[]> {
  const ids = [...new Set(cards.map((c) => c.id).filter(ehUuid))].slice(0, 200);
  if (ids.length === 0) return cards;
  try {
    const db = await createClient();
    const { data, error } = await db.rpc("anuncios_cards_extra", { p_ids: ids });
    if (error || !Array.isArray(data)) return cards;
    const extra = new Map<string, Extra>();
    for (const l of data as { id: string; preco_antes_centavos: number | string | null; uf: string | null }[]) {
      extra.set(l.id, { preco_antes_centavos: l.preco_antes_centavos == null ? null : Number(l.preco_antes_centavos), uf: l.uf });
    }
    return cards.map((c) => {
      const e = extra.get(c.id);
      return e ? { ...c, ...e } : c;
    });
  } catch {
    return cards;
  }
}
