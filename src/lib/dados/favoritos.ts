import "server-only";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { completarCards } from "@/lib/dados/cards-extra";
import { ehUuid } from "@/lib/formato";
import type { AnuncioCard, StatusAnuncio, TipoVitrine } from "@/lib/tipos";

export const FAVORITOS_POR_PAGINA = 24;
export type AnuncioFavorito = Pick<AnuncioCard, "id" | "slug" | "titulo" | "preco_centavos" | "cidade" | "capa" | "criado_em" | "destaque" | "vitrine_nome" | "vitrine_selo" | "vitrine_tipo" | "preco_antes_centavos" | "uf">;
/** radar: link para pedir parecido no Radar (sem título quando o anúncio saiu do ar). */
export type Favorito = { id: string; salvoEm: string; anuncio: AnuncioFavorito | null; situacao: "ativo" | "vendido" | "indisponivel"; radar: string };
type Linha = {
  anuncio_id: string; criado_em: string;
  anuncios: {
    id: string; slug: string | null; titulo: string | null; preco_centavos: number | null; cidade: string | null; fotos: string[] | null;
    status: StatusAnuncio; destaque_ate: string | null; publicado_em: string | null; criado_em: string;
    vitrines_lojas: { nome: string; selo_loja_verificada: boolean; tipo: TipoVitrine; status: string } | null;
    categorias?: { slug: string } | null;
  } | null;
};

/** A ausência de sessão ou uma falha não pode parecer uma lista vazia. */
export async function meusFavoritos(pagina = 1): Promise<{ itens: Favorito[]; total: number }> {
  const { userId } = await auth();
  if (!userId) throw new Error("Entre na sua conta para ver os favoritos.");
  if (!Number.isSafeInteger(pagina) || pagina < 1 || pagina > 100000) throw new Error("Página inválida.");
  const db = await createClient();
  const inicio = (pagina - 1) * FAVORITOS_POR_PAGINA;
  const { data, error, count } = await db.from("favoritos")
    .select("anuncio_id, criado_em, anuncios(id, slug, titulo, preco_centavos, cidade, fotos, status, destaque_ate, publicado_em, criado_em, categorias!anuncios_categoria_id_fkey(slug), vitrines_lojas(nome, selo_loja_verificada, tipo, status))", { count: "exact" })
    .eq("usuario_id", userId).order("criado_em", { ascending: false }).order("anuncio_id", { ascending: false })
    .range(inicio, inicio + FAVORITOS_POR_PAGINA - 1);
  if (error || !Array.isArray(data) || !Number.isSafeInteger(count) || count! < 0) throw new Error("Não foi possível carregar seus favoritos.");
  const itens = (data as unknown as Linha[]).map((f): Favorito => {
    if (!ehUuid(f.anuncio_id) || typeof f.criado_em !== "string" || !Number.isFinite(Date.parse(f.criado_em))) throw new Error("Favorito inválido.");
    const a = f.anuncios, v = a?.vitrines_lojas;
    // Mesmo o dono não recebe detalhes de rascunhos/pausados nesta lista pública de anúncios salvos.
    if (!a || a.id !== f.anuncio_id || !v || v.status !== "ativa" || !["ativo", "vendido"].includes(a.status)) {
      return { id: f.anuncio_id, salvoEm: f.criado_em, anuncio: null, situacao: "indisponivel", radar: "/radar/pedir" };
    }
    const titulo = a.titulo?.trim() || "Anúncio";
    const slug = a.categorias?.slug;
    const radar = `/radar/pedir?q=${encodeURIComponent(titulo.slice(0, 120))}${slug && /^[a-z0-9-]{1,80}$/.test(slug) ? `&categoria=${slug}` : ""}`;
    return {
      id: f.anuncio_id, salvoEm: f.criado_em, situacao: a.status as "ativo" | "vendido", radar,
      anuncio: {
        id: a.id, slug: a.slug, titulo, preco_centavos: a.preco_centavos, cidade: a.cidade ?? "",
        capa: a.fotos?.[0] ?? null, criado_em: a.publicado_em ?? a.criado_em,
        destaque: a.status === "ativo" && !!a.destaque_ate && Date.parse(a.destaque_ate) > Date.now(),
        vitrine_nome: v.tipo === "pf" ? v.nome.trim().split(/\s+/)[0] : v.nome,
        vitrine_selo: v.selo_loja_verificada, vitrine_tipo: v.tipo,
      },
    };
  });
  // Preço antes (riscado) e UF da cidade, numa consulta só; se falhar, os cards seguem sem eles.
  const completos = new Map((await completarCards(itens.flatMap((f) => (f.anuncio ? [f.anuncio] : [])))).map((a) => [a.id, a]));
  return { itens: itens.map((f) => (f.anuncio ? { ...f, anuncio: completos.get(f.anuncio.id) ?? f.anuncio } : f)), total: count! };
}

/** Quais destes anúncios a pessoa salvou (cards da vitrine). null = falha de leitura, nunca "nenhum". */
export async function favoritosEntre(ids: string[], userId: string | null): Promise<Set<string> | null> {
  const validos = [...new Set(ids.filter(ehUuid))].slice(0, 500);
  if (!userId || validos.length === 0) return new Set();
  try {
    const db = await createClient();
    const { data, error } = await db.from("favoritos").select("anuncio_id").eq("usuario_id", userId).in("anuncio_id", validos);
    if (error || !Array.isArray(data)) return null;
    return new Set(data.map((f) => f.anuncio_id as string));
  } catch {
    return null;
  }
}

/** Falha de leitura é diferente de anúncio não salvo. */
export async function ehFavorito(anuncioId: string, userId: string | null): Promise<boolean> {
  if (!userId) return false;
  if (!ehUuid(anuncioId)) throw new Error("Anúncio inválido.");
  const db = await createClient();
  const { data, error } = await db.from("favoritos").select("anuncio_id").eq("usuario_id", userId).eq("anuncio_id", anuncioId).maybeSingle();
  if (error || (data && data.anuncio_id !== anuncioId)) throw new Error("Não foi possível consultar seu favorito.");
  return !!data;
}

