import "server-only";
import { seguro } from "@/lib/dados/seguro";
import { regiaoAtual } from "@/lib/dados/regiao";
import { listarCategorias, totaisCategorias } from "@/lib/dados/categorias";
import { buscarAnuncios } from "@/lib/dados/anuncios";
import { lojasCatalogo } from "@/lib/dados/catalogo";
import { arvoreComAnuncios, enxugarArvore } from "@/lib/categorias-arvore";
import { linkAnuncio, linkLoja, preco } from "@/lib/formato";
import {
  SEM_SUGESTOES,
  filtrarAnuncios,
  filtrarLojas,
  sugerirCategorias,
  termoSugestao,
  type SugestoesBusca,
} from "@/lib/sugestoes-busca";

/** Página do catálogo de lojas (o banco devolve no máximo 48 por vez) e quantas páginas ler no máximo. */
const LOJAS_POR_PAGINA = 48;
const PAGINAS_LOJAS = 4;
/** Anúncios pedidos ao banco antes de ficar só com os 5 cujo título combina (o banco também acha pela descrição). */
const ANUNCIOS_CANDIDATOS = 15;

/**
 * Sugestões para o que a pessoa está digitando, só da região escolhida: categorias com anúncio,
 * lojas e anúncios. Cada parte que falhar fica vazia; as outras aparecem.
 */
export async function sugestoesBusca(texto: string): Promise<SugestoesBusca> {
  const q = termoSugestao(texto);
  if (!q) return SEM_SUGESTOES;
  const regiao = await seguro(regiaoAtual, null);
  if (!regiao) return SEM_SUGESTOES;

  const [categorias, lojas, anuncios] = await Promise.all([
    seguro(async () => {
      const [arvore, totais] = await Promise.all([listarCategorias(), totaisCategorias(regiao.id)]);
      return sugerirCategorias(arvoreComAnuncios(enxugarArvore(arvore), totais), q);
    }, []),
    seguro(async () => {
      // Não há busca de loja por nome no banco: lê o catálogo da região e filtra aqui.
      const primeira = await lojasCatalogo(regiao, null, LOJAS_POR_PAGINA);
      const total = Number(primeira[0]?.total ?? 0);
      const paginas = Math.min(PAGINAS_LOJAS, Math.ceil(total / LOJAS_POR_PAGINA));
      const resto = await Promise.all(
        Array.from({ length: Math.max(0, paginas - 1) }, (_, i) => lojasCatalogo(regiao, null, LOJAS_POR_PAGINA, (i + 1) * LOJAS_POR_PAGINA)),
      );
      return filtrarLojas([primeira, ...resto].flat().map((l) => ({ nome: l.nome, cidade: l.cidade, href: linkLoja(l.slug) })), q);
    }, []),
    seguro(async () => {
      const { anuncios } = await buscarAnuncios({ q, regiao: regiao.slug, limite: ANUNCIOS_CANDIDATOS });
      return filtrarAnuncios(anuncios, q).map((a) => ({
        tipo: "anuncio" as const,
        nome: a.titulo,
        detalhe: [preco(a.preco_centavos), a.cidade].filter(Boolean).join(" · "),
        href: linkAnuncio(a.id, a.titulo, a.slug),
      }));
    }, []),
  ]);
  return { categorias, lojas, anuncios };
}
