import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CategoriaAdmin, CategoriaAdminArvore, CidadeAdmin, RegiaoAdmin } from "@/lib/tipos-cadastros";

// Leituras das telas 7 e 9 do painel. Usam o cliente do admin (exigirAdmin): as funções do banco
// conferem e_admin() por dentro. Erro de leitura → lista vazia (a tela mostra o estado vazio com saída).

export async function lerRegioes(db: SupabaseClient): Promise<{ regioes: RegiaoAdmin[]; falhou: boolean }> {
  const { data, error } = await db.rpc("admin_regioes");
  return { regioes: (data ?? []) as RegiaoAdmin[], falhou: !!error };
}

export async function lerRegiao(db: SupabaseClient, id: string): Promise<{ regiao: RegiaoAdmin | null; cidades: CidadeAdmin[]; falhou: boolean }> {
  const [r, c] = await Promise.all([db.rpc("admin_regioes"), db.rpc("admin_cidades", { p_regiao: id })]);
  const regiao = ((r.data ?? []) as RegiaoAdmin[]).find((x) => x.id === id) ?? null;
  return { regiao, cidades: (c.data ?? []) as CidadeAdmin[], falhou: !!(r.error || c.error) };
}

/** Árvore completa (inclusive escondidas): principais na ordem, subcategorias dentro. */
export async function lerCategorias(db: SupabaseClient): Promise<{ arvore: CategoriaAdminArvore[]; todas: CategoriaAdmin[]; falhou: boolean }> {
  const { data, error } = await db.rpc("admin_categorias");
  const todas = ((data ?? []) as CategoriaAdmin[]).map((c) => ({ ...c, campos: Array.isArray(c.campos) ? c.campos : [] }));
  const arvore: CategoriaAdminArvore[] = todas.filter((c) => !c.pai_id).map((c) => ({ ...c, subcategorias: [] }));
  const porId = new Map(arvore.map((p) => [p.id, p]));
  for (const c of todas) if (c.pai_id) porId.get(c.pai_id)?.subcategorias.push(c);
  return { arvore, todas, falhou: !!error };
}
