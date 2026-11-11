import type { MetadataRoute } from "next";
import { anunciosCatalogo, lojasCatalogo } from "@/lib/dados/catalogo";
import { listarCategorias } from "@/lib/dados/categorias";
import { regiaoAtual } from "@/lib/dados/regiao";
import { linkAnuncio, linkCategoria, linkLoja, urlAbsoluta } from "@/lib/formato";
import { LINK_AJUDA, LINK_PLANOS, LINK_PRIVACIDADE, LINK_TERMOS } from "@/lib/rotas";

// Mapa do site para o Google: páginas fixas, categorias, lojas e anúncios no ar.
// O robô chega sem cidade escolhida, então vale a região-piloto (a mesma da página inicial).
// Se o banco falhar, o mapa sai só com o que já foi lido; nunca devolve erro.

const POR_VEZ = 100;
const MAX_ANUNCIOS = 1000;
const MAX_LOJAS = 500;

// O Radar fica de fora: a área dele é "noindex" (src/app/radar/layout.tsx).
const FIXAS = ["/", "/categorias", "/lojas", LINK_PLANOS, LINK_AJUDA, LINK_TERMOS, LINK_PRIVACIDADE];

async function tentar<T>(ler: () => Promise<T[]>): Promise<T[]> {
  try {
    return await ler();
  } catch {
    return [];
  }
}

/** Lê as páginas de uma lista do catálogo até acabar ou bater o teto. */
async function lerTudo<T extends { total: number }>(pagina: (offset: number) => Promise<T[]>, teto: number): Promise<T[]> {
  const tudo: T[] = [];
  while (tudo.length < teto) {
    const lote = await pagina(tudo.length);
    tudo.push(...lote);
    if (lote.length < POR_VEZ || tudo.length >= Number(lote[0]?.total ?? 0)) break;
  }
  return tudo.slice(0, teto);
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const itens: MetadataRoute.Sitemap = FIXAS.map((caminho) => ({
    url: urlAbsoluta(caminho),
    changeFrequency: caminho === "/" ? "hourly" : "weekly",
    priority: caminho === "/" ? 1 : 0.5,
  }));

  const categorias = await tentar(listarCategorias);
  for (const pai of categorias) {
    itens.push({ url: urlAbsoluta(linkCategoria(pai.slug)), changeFrequency: "daily", priority: 0.7 });
    for (const filha of pai.filhas) {
      itens.push({ url: urlAbsoluta(linkCategoria(pai.slug, filha.slug)), changeFrequency: "daily", priority: 0.6 });
    }
  }

  const regiao = await regiaoAtual().catch(() => null);
  if (!regiao) return itens;

  const [lojas, anuncios] = await Promise.all([
    tentar(() => lerTudo((offset) => lojasCatalogo(regiao, null, POR_VEZ, offset), MAX_LOJAS)),
    tentar(() => lerTudo((offset) => anunciosCatalogo(regiao, "feed", POR_VEZ, null, offset), MAX_ANUNCIOS)),
  ]);

  for (const loja of lojas) {
    itens.push({ url: urlAbsoluta(linkLoja(loja.slug)), changeFrequency: "daily", priority: 0.6 });
  }
  for (const a of anuncios) {
    itens.push({ url: urlAbsoluta(linkAnuncio(a.id, a.titulo)), lastModified: a.criado_em, changeFrequency: "weekly", priority: 0.8 });
  }
  return itens;
}
