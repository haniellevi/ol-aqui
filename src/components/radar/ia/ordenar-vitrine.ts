import type { AnuncioParaProposta } from "@/lib/tipos-radar";
import type { DestaqueIA } from "@/lib/radar-ia/tipos";

/** Folha "Propor": os anúncios que a IA marcou vão para o topo (na ordem dela), o resto segue igual. */
export function ordenarComDestaques(anuncios: AnuncioParaProposta[], destaques: DestaqueIA[]): { anuncio: AnuncioParaProposta; motivo: string | null }[] {
  const porId = new Map(anuncios.map((a) => [a.id, a]));
  const topo: { anuncio: AnuncioParaProposta; motivo: string | null }[] = [];
  for (const d of destaques) {
    const a = porId.get(d.id);
    if (a && !topo.some((t) => t.anuncio.id === a.id)) topo.push({ anuncio: a, motivo: d.motivo });
  }
  const usados = new Set(topo.map((t) => t.anuncio.id));
  return [...topo, ...anuncios.filter((a) => !usados.has(a.id)).map((a) => ({ anuncio: a, motivo: null }))];
}
