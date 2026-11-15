import "server-only";
import { categoriasDasLojas, lojasCatalogo } from "@/lib/dados/catalogo";
import { tiposDasLojas } from "@/lib/tipos-de-loja";
import type { CategoriaLeve } from "@/lib/categorias-arvore";
import type { Regiao } from "@/lib/tipos";
import { FaixaLojas } from "@/components/vitrine/faixa-lojas";

// Início: o único bloco de lojas da tela (DESIGN.md, seção 9). Lojas da região no topo do feed (fileira que rola para o lado, com tipo de loja).
// O tipo sai das categorias dos anúncios de cada loja; sem essa leitura, o filtro some.
export async function LojasDaRegiao({
  regiao,
  arvore,
  limite = 24,
  titulo,
}: {
  regiao: Regiao;
  /** Árvore completa de categorias, para subir de qualquer categoria até a de cima. */
  arvore: CategoriaLeve[];
  limite?: number;
  /** vem do painel (tela 12, home_blocos); sem ele, "DESTAQUES DA REGIÃO" */
  titulo?: string;
}) {
  // Lojas que pagaram destaque vêm primeiro, com "Patrocinado" (antes era um segundo bloco, "Lojas em destaque").
  const [pagas, todas] = await Promise.all([lojasCatalogo(regiao, null, 12, 0, true).catch(() => []), lojasCatalogo(regiao, null, limite)]);
  const idsPagas = new Set(pagas.map((l) => l.id));
  const lojas = [...pagas, ...todas.filter((l) => !idsPagas.has(l.id))];
  const { porLoja, tipos } = tiposDasLojas(lojas, await categoriasDasLojas(lojas.map((l) => l.id)), arvore);
  return (
    <FaixaLojas
      titulo={titulo ?? "DESTAQUES DA REGIÃO"}
      tipos={tipos}
      lojas={lojas.map((l) => ({ id: l.id, slug: l.slug, nome: l.nome, logo_url: l.logo_url, verificada: l.verificada, patrocinada: idsPagas.has(l.id), tipos: porLoja.get(l.id) ?? [] }))}
    />
  );
}
