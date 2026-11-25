import "server-only";
import { createClient } from "@/lib/supabase/server";
import { completarCards } from "@/lib/dados/cards-extra";
import { ehUuid } from "@/lib/formato";
import type { AnuncioVitrine, OrdemVitrine } from "@/lib/tipos-vitrine";

export async function buscarProdutosVitrine(id: string, termo: string, ordem: OrdemVitrine, pagina: number): Promise<AnuncioVitrine[]> {
  const busca = termo.trim().replace(/\s+/g, " ").slice(0, 120);
  if (!ehUuid(id) || !busca || !["recentes", "menor_preco"].includes(ordem) || !Number.isInteger(pagina) || pagina < 1 || pagina > 1000) throw new Error("Busca inválida.");
  const db = await createClient();
  const { data, error } = await db.rpc("buscar_produtos_vitrine", { p_vitrine_id: id, p_busca: busca, p_ordem: ordem, p_pagina: pagina });
  if (error || !Array.isArray(data)) throw new Error("Não conseguimos buscar os produtos.");
  return completarCards(data as AnuncioVitrine[]);
}
