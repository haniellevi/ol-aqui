import "server-only";
import { notFound, redirect } from "next/navigation";
import { anuncioDaLoja } from "@/lib/dados/anuncios";
import { contaDaLoja } from "@/lib/dados/conta";
import { ehUuid } from "@/lib/formato";
import { edicaoAdmin, type EdicaoEquipe } from "@/lib/dados/edicao-admin";
import type { MeuAnuncio, MinhaConta, MinhaVitrine } from "@/lib/tipos";

export type ParamsPasso = Promise<{ rascunho?: string | string[]; editar?: string | string[] }>;

export type DadosPasso = {
  anuncio: MeuAnuncio;
  conta: MinhaConta & { vitrine: MinhaVitrine };
  editar: boolean;
  /** P5b-2a: super admin editando anúncio de outra pessoa (motivo e prazo para a faixa de aviso). */
  equipe: EdicaoEquipe | null;
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

  const escolhida = await contaDaLoja();
  if (!escolhida) redirect("/entrar?redirect_url=/anunciar");
  // P5b-2a: super admin sem loja própria também abre o anúncio com a edição aberta.
  const anuncio = await anuncioDaLoja(id);
  if (!escolhida.vitrine && !anuncio) redirect("/quero-vender");
  if (!anuncio || (anuncio.status === "congelado" || anuncio.status === "excluido")) notFound();
  // O anúncio pode ser de outra loja que a pessoa cuida (ex.: rascunho do Merc na loja própria).
  const conta = anuncio.vitrine_id === escolhida.vitrine?.id ? escolhida : await contaDaLoja(false, anuncio.vitrine_id);
  if (!conta?.vitrine) notFound();

  // anúncio já publicado abre sempre no modo edição
  const editar = um(sp.editar) === "1" || anuncio.status !== "rascunho";
  const equipe = conta.equipe ? await edicaoAdmin(anuncio.id) : null;
  if (conta.equipe && !equipe) notFound();
  return { anuncio, conta: conta as DadosPasso["conta"], editar, equipe };
}
