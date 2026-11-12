import "server-only";
import { cache } from "react";
import { seguro } from "@/lib/dados/seguro";
import { createClient } from "@/lib/supabase/server";
import { montarArvore, percorrer } from "@/lib/categorias-arvore";
import type { Categoria, CategoriaComFilhas } from "@/lib/tipos";

const COLUNAS =
  "id, slug, nome, icone, pai_id, ordem, ativa, campos, preco_min_centavos, preco_max_centavos, tipo_legado";

/**
 * Árvore de categorias ativas em até 3 níveis (Grande › Sub › Tipo), na ordem do painel.
 * Guardada durante a requisição: pode chamar em vários componentes sem repetir a consulta.
 */
export const listarCategorias = cache(lerArvore);

async function lerArvore(): Promise<CategoriaComFilhas[]> {
  const db = await createClient();
  const { data, error } = await db
    .from("categorias")
    .select(COLUNAS)
    .eq("ativa", true)
    .order("ordem")
    .order("nome");
  if (error || !data) throw new Error("Não foi possível carregar as categorias.");
  return montarArvore(data as Categoria[]);
}

/**
 * Anúncios no ar por categoria na região (somando para as de cima), para ordenar e esconder vazias.
 * Falhou (função ainda não aplicada no banco, rede) → null: a tela mostra todas, na ordem do painel.
 */
export const totaisCategorias = cache(async (regiaoId: string): Promise<Map<string, number> | null> =>
  seguro(async () => {
    const db = await createClient();
    const { data, error } = await db.rpc("contagem_categorias_regiao", { p_regiao: regiaoId });
    if (error || !Array.isArray(data)) return null;
    const totais = new Map<string, number>();
    for (const l of data as { categoria_id: unknown; total: unknown }[]) {
      const n = Number(l.total);
      if (typeof l.categoria_id === "string" && Number.isSafeInteger(n) && n > 0) totais.set(l.categoria_id, n);
    }
    return totais;
  }, null),
);

export type CategoriaEncontrada = {
  categoria: CategoriaComFilhas;
  /** Pai imediato, com as irmãs dentro (null quando a própria categoria é grande). */
  pai: CategoriaComFilhas | null;
  /** Do topo até a própria categoria: Grande › Sub › Tipo (a própria é a última). */
  caminho: CategoriaComFilhas[];
  /** Filhas ativas. Vazio = folha (só a folha recebe anúncio e é o filtro de campos). */
  filhas: CategoriaComFilhas[];
};

function encontrada(caminho: CategoriaComFilhas[]): CategoriaEncontrada {
  const no = caminho[caminho.length - 1];
  return {
    categoria: no,
    pai: caminho.length > 1 ? caminho[caminho.length - 2] : null,
    caminho,
    filhas: no.filhas,
  };
}

async function achar(pronta: (c: Categoria) => boolean): Promise<CategoriaEncontrada | null> {
  const hit = percorrer(await listarCategorias()).find(({ no }) => pronta(no));
  return hit ? encontrada(hit.caminho) : null;
}

/** Acha categoria de qualquer nível pelo slug (ativa). Não achou → null. */
export const categoriaPorSlug = (slug: string) => achar((c) => c.slug === slug);

/** Acha categoria de qualquer nível pelo id (ativa). Não achou → null. */
export const categoriaPorId = (id: string) => achar((c) => c.id === id);

/**
 * Existe o slug no banco mas a categoria (ou uma de cima) está desligada?
 * Usado para mandar o link antigo para a lista de categorias em vez de 404.
 * O RLS esconde categorias desligadas, então a pergunta vai para uma função do banco.
 */
export async function categoriaEscondidaPorSlug(slug: string): Promise<boolean> {
  return seguro(async () => {
    const db = await createClient();
    const { data } = await db.rpc("categoria_escondida", { p_slug: slug });
    return data === true;
  }, false);
}

/**
 * Categoria de um anúncio que JÁ está nela, mesmo que o painel tenha escondido a categoria (ou a mãe).
 * Esconder tira a categoria do cadastro, mas o anúncio publicado continua editável com os campos dela.
 * Para escolher categoria nova use categoriaPorId (só as visíveis).
 */
export async function categoriaDoAnuncio(id: string): Promise<CategoriaEncontrada | null> {
  const visivel = await categoriaPorId(id);
  if (visivel) return visivel;
  return seguro(async () => {
    const db = await createClient();
    // [grande, sub, tipo], lido por função do banco porque o RLS esconde as desligadas.
    const { data } = await db.rpc("categorias_do_caminho", { p_id: id });
    const linhas = (data ?? []) as Categoria[];
    if (!linhas.length || linhas[linhas.length - 1].id !== id) return null;
    const caminho: CategoriaComFilhas[] = linhas.map((c) => ({ ...c, filhas: [] }));
    return {
      categoria: caminho[caminho.length - 1],
      pai: caminho.length > 1 ? caminho[caminho.length - 2] : null,
      caminho,
      filhas: [],
    };
  }, null);
}
