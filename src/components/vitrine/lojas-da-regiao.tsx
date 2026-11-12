import "server-only";
import { categoriasDasLojas, lojasCatalogo } from "@/lib/dados/catalogo";
import { tiposDasLojas } from "@/lib/tipos-de-loja";
import type { CategoriaLeve } from "@/lib/categorias-arvore";
import type { Regiao } from "@/lib/tipos";
import { FaixaLojas } from "@/components/vitrine/faixa-lojas";

// Início: lojas da região no topo do feed (fileira que rola para o lado, com busca e tipo de loja).
// O tipo sai das categorias dos anúncios de cada loja; sem essa leitura, o filtro some.
export async function LojasDaRegiao({
  regiao,
  lugar,
  arvore,
  limite = 24,
  titulo,
}: {
  regiao: Regiao;
  lugar: string;
  /** Árvore completa de categorias, para subir de qualquer categoria até a de cima. */
  arvore: CategoriaLeve[];
  limite?: number;
  /** vem do painel (tela 12, home_blocos); sem ele, "Lojas de {lugar}" */
  titulo?: string;
}) {
  const lojas = await lojasCatalogo(regiao, null, limite);
  const { porLoja, tipos } = tiposDasLojas(lojas, await categoriasDasLojas(lojas.map((l) => l.id)), arvore);
  return (
    <FaixaLojas
      titulo={titulo ?? `Lojas de ${lugar}`}
      tipos={tipos}
      lojas={lojas.map((l) => ({ id: l.id, slug: l.slug, nome: l.nome, logo_url: l.logo_url, verificada: l.verificada, tipos: porLoja.get(l.id) ?? [] }))}
    />
  );
}
