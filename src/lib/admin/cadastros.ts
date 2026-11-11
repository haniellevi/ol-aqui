import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CategoriaAdmin, CategoriaAdminArvore, CidadeAdmin, GrupoSugestao, RegiaoAdmin } from "@/lib/tipos-cadastros";
import { NIVEIS_MAXIMOS, nomeCaminho } from "@/lib/categorias-arvore";

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

/** Árvore completa (inclusive escondidas), até 3 níveis, na ordem do painel. `todas` = a mesma lista, achatada. */
export async function lerCategorias(db: SupabaseClient): Promise<{ arvore: CategoriaAdminArvore[]; todas: CategoriaAdminArvore[]; falhou: boolean }> {
  const { data, error } = await db.rpc("admin_categorias");
  const linhas = ((data ?? []) as CategoriaAdmin[]).map((c) => ({ ...c, campos: Array.isArray(c.campos) ? c.campos : [] }));
  const porId = new Map(linhas.map((c) => [c.id, c]));
  const nivelDe = (c: CategoriaAdmin) => {
    let nivel = 1;
    let pai = c.pai_id;
    while (pai && nivel < 5) {
      nivel++;
      pai = porId.get(pai)?.pai_id ?? null;
    }
    return nivel;
  };
  const todas: CategoriaAdminArvore[] = linhas.map((c) => ({ ...c, nivel: nivelDe(c), subcategorias: [] }));
  const porNo = new Map(todas.map((c) => [c.id, c]));
  const arvore: CategoriaAdminArvore[] = [];
  for (const c of todas) {
    if (!c.pai_id) arvore.push(c);
    else porNo.get(c.pai_id)?.subcategorias.push(c);
  }
  return { arvore, todas, falhou: !!error };
}

/** Sugestões de categoria pendentes, agrupadas (admin_categorias_sugeridas). Erro → lista vazia com `falhou`. */
export async function lerCategoriasSugeridas(db: SupabaseClient): Promise<{ grupos: GrupoSugestao[]; falhou: boolean }> {
  const { data, error } = await db.rpc("admin_categorias_sugeridas");
  return { grupos: (data ?? []) as GrupoSugestao[], falhou: !!error };
}

/**
 * Categorias que podem ser a "mãe" de uma categoria (com o caminho para o seletor: "Pet › Produtos para pets").
 * Não oferece a própria categoria nem as de dentro dela, e respeita o máximo de níveis:
 * a mãe precisa estar no 1º ou 2º nível e deixar espaço para a categoria e as filhas dela.
 */
export function maesPossiveis(todas: CategoriaAdminArvore[], idAtual?: string): { id: string; nome: string; ativa: boolean }[] {
  const atual = idAtual ? todas.find((c) => c.id === idAtual) : undefined;
  const altura = atual ? alturaAdmin(atual) : 0;
  const porId = new Map(todas.map((c) => [c.id, c]));
  const dentro = new Set<string>();
  if (atual) {
    const andar = (c: CategoriaAdminArvore) => c.subcategorias.forEach((s) => { dentro.add(s.id); andar(s); });
    dentro.add(atual.id);
    andar(atual);
  }
  return todas
    .filter((c) => !dentro.has(c.id) && c.nivel + 1 + altura <= NIVEIS_MAXIMOS)
    .map((c) => ({ id: c.id, nome: nomeAdmin(porId, c), ativa: c.ativa }));
}

/** Caminho em texto de uma categoria do painel ("Pet › Produtos para pets › Ração"). */
export function nomeAdmin(porId: Map<string, CategoriaAdmin>, c: CategoriaAdmin): string {
  const caminho: CategoriaAdmin[] = [];
  let atual: CategoriaAdmin | undefined = c;
  for (let k = 0; atual && k < 5; k++) {
    caminho.unshift(atual);
    atual = atual.pai_id ? porId.get(atual.pai_id) : undefined;
  }
  return nomeCaminho(caminho);
}

/** Quantos níveis abaixo (0 = sem filhas). */
export function alturaAdmin(c: CategoriaAdminArvore): number {
  return c.subcategorias.length ? 1 + Math.max(...c.subcategorias.map(alturaAdmin)) : 0;
}
