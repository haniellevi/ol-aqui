import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { seguro } from "@/lib/dados/seguro";
import type { Categoria, CategoriaComFilhas } from "@/lib/tipos";

const COLUNAS =
  "id, slug, nome, icone, pai_id, ordem, ativa, campos, preco_min_centavos, preco_max_centavos, tipo_legado";

/**
 * Árvore de categorias ativas (pais com as filhas), na ordem do painel.
 * Guardada durante a requisição: pode chamar em vários componentes sem repetir a consulta.
 */
export const listarCategorias = cache((): Promise<CategoriaComFilhas[]> => seguro(lerArvore, []));

async function lerArvore(): Promise<CategoriaComFilhas[]> {
  const db = await createClient();
  const { data, error } = await db
    .from("categorias")
    .select(COLUNAS)
    .eq("ativa", true)
    .order("ordem")
    .order("nome");
  if (error || !data) return [];
  const todas = data as Categoria[];
  const pais = todas.filter((c) => !c.pai_id).map((p) => ({ ...p, filhas: [] as Categoria[] }));
  const porId = new Map(pais.map((p) => [p.id, p]));
  for (const c of todas) if (c.pai_id) porId.get(c.pai_id)?.filhas.push(c);
  return pais;
}

export type CategoriaEncontrada = {
  categoria: Categoria;
  /** Pai da subcategoria (null quando a própria categoria é pai). */
  pai: CategoriaComFilhas | null;
  /** Filhas (só quando a categoria é pai). */
  filhas: Categoria[];
};

/** Acha pai ou subcategoria pelo slug. Não achou → null. */
export async function categoriaPorSlug(slug: string): Promise<CategoriaEncontrada | null> {
  for (const p of await listarCategorias()) {
    if (p.slug === slug) return { categoria: p, pai: null, filhas: p.filhas };
    const f = p.filhas.find((c) => c.slug === slug);
    if (f) return { categoria: f, pai: p, filhas: [] };
  }
  return null;
}

/** Acha pai ou subcategoria pelo id. Não achou → null. */
export async function categoriaPorId(id: string): Promise<CategoriaEncontrada | null> {
  for (const p of await listarCategorias()) {
    if (p.id === id) return { categoria: p, pai: null, filhas: p.filhas };
    const f = p.filhas.find((c) => c.id === id);
    if (f) return { categoria: f, pai: p, filhas: [] };
  }
  return null;
}
