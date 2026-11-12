import "server-only";
import { notFound, redirect } from "next/navigation";
import { anuncioDaLoja } from "@/lib/dados/anuncios";
import { contaDaLoja } from "@/lib/dados/conta";
import { ehUuid } from "@/lib/formato";
import type { MeuAnuncio, MinhaConta, MinhaVitrine } from "@/lib/tipos";

export type ParamsPasso = Promise<{ rascunho?: string | string[]; editar?: string | string[] }>;

export type DadosPasso = {
  anuncio: MeuAnuncio;
  conta: MinhaConta & { vitrine: MinhaVitrine };
  editar: boolean;
};

const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/**
 * Abre um passo do Anunciar: confere login, vitrine e que o anúncio é da pessoa.
 * Sem id → volta para /anunciar (que cria ou retoma o rascunho). Anúncio de outra pessoa → 404.
 */
export async function carregarPasso(searchParams: ParamsPasso): Promise<DadosPasso> {
  const sp = await searchParams;
  const id = um(sp.rascunho);
  if (!ehUuid(id)) redirect("/anunciar");

  const conta = await contaDaLoja();
  if (!conta) redirect("/entrar?redirect_url=/anunciar");
  if (!conta.vitrine) redirect("/quero-vender");

  const anuncio = await anuncioDaLoja(id);
  if (!anuncio || (anuncio.status === "congelado" || anuncio.status === "excluido")) notFound();

  // anúncio já publicado abre sempre no modo edição
  const editar = um(sp.editar) === "1" || anuncio.status !== "rascunho";
  return { anuncio, conta: conta as DadosPasso["conta"], editar };
}
