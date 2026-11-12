// "Tipo de loja" no Início: sai das categorias dos anúncios de cada loja, subindo até a categoria
// de cima (Pet, Celulares, Roupas...). Função pura: serve no servidor e nos testes.
import { percorrerLeve, type CategoriaLeve } from "@/lib/categorias-arvore";

export type TipoLoja = { slug: string; nome: string; icone: string };

/**
 * Para cada loja, os slugs das categorias de cima dos anúncios dela (sem repetir, a mais usada primeiro),
 * e a lista de tipos para o filtro (os com mais lojas primeiro; empate na ordem do painel).
 */
export function tiposDasLojas(
  lojas: { id: string }[],
  categoriasPorLoja: Map<string, string[]>,
  arvore: CategoriaLeve[],
): { porLoja: Map<string, string[]>; tipos: TipoLoja[] } {
  const topoDe = new Map(percorrerLeve(arvore).map(({ no, caminho }) => [no.id, caminho[0]]));
  const porLoja = new Map<string, string[]>();
  const lojasPorTipo = new Map<string, number>();
  for (const loja of lojas) {
    const usos = new Map<string, number>();
    for (const id of categoriasPorLoja.get(loja.id) ?? []) {
      const topo = topoDe.get(id);
      if (topo) usos.set(topo.slug, (usos.get(topo.slug) ?? 0) + 1);
    }
    const slugs = [...usos].sort((a, b) => b[1] - a[1]).map(([slug]) => slug);
    porLoja.set(loja.id, slugs);
    for (const slug of slugs) lojasPorTipo.set(slug, (lojasPorTipo.get(slug) ?? 0) + 1);
  }
  const tipos = arvore
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => lojasPorTipo.has(c.slug))
    .sort((a, b) => (lojasPorTipo.get(b.c.slug) ?? 0) - (lojasPorTipo.get(a.c.slug) ?? 0) || a.i - b.i)
    .map(({ c }) => ({ slug: c.slug, nome: c.nome, icone: c.icone }));
  return { porLoja, tipos };
}
