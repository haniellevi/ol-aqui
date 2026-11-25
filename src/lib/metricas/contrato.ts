// Destinos externos só poderão ser implementados numa frente autorizada.
export const DESTINOS = Object.freeze({ ga4: false, meta: false });
export const COORTE = "consentida_v1";
export function rotaNeutra(valor: unknown): string | null {
  if (typeof valor !== "string" || !valor.startsWith("/") || valor.startsWith("//")) return null;
  const p = valor.split(/[?#]/)[0];
  if (["/", "/busca", "/lojas", "/categorias"].includes(p)) return p;
  if (/^\/anuncio\/[^/]+$/.test(p)) return "/anuncio/:item";
  if (/^\/loja\/[^/]+$/.test(p)) return "/loja/:loja";
  if (/^\/categoria\/[^/]+$/.test(p)) return "/categoria/:categoria";
  return null;
}
const ORIGENS = new Set(["instagram", "whatsapp", "google", "radio", "qr_loja", "facebook", "panfleto", "indicacao", "outro_site", "direto"]);
export function origemPermitida(query: string) {
  const q = new URLSearchParams(query);
  const origem = q.get("origem") ?? q.get("utm_source");
  // Campanhas livres do gerador legado ficam sem atribuição até existir catálogo aprovado.
  return { origem: origem && ORIGENS.has(origem) ? origem : null, campanha: null };
}
export function contadorNavegacao() {
  let ultima: string | null = null;
  return (rota: string) => {
    if (ultima === rota) return false;
    ultima = rota;
    return true;
  };
}
export type NomeEvento = "page_view" | "search_completed" | "view_item_list" | "view_item" | "view_store" | "contact_intent" | "share";
export type Evento = { nome: NomeEvento; rota: string; faixa?: "zero" | "1-10" | "11+"; fonte: "interno"; coorte: typeof COORTE };
const NOMES = new Set<unknown>(["page_view", "search_completed", "view_item_list", "view_item", "view_store", "contact_intent", "share"]);
export function eventoPermitido(valor: unknown): Evento | null {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return null;
  const e = valor as Record<string, unknown>;
  if (Object.keys(e).some((k) => !["nome", "rota", "faixa"].includes(k))) return null;
  const rota = rotaNeutra(e.rota);
  if (!rota || !NOMES.has(e.nome)) return null;
  if (e.faixa !== undefined && !["zero", "1-10", "11+"].includes(String(e.faixa))) return null;
  if (e.nome === "search_completed" && !e.faixa) return null;
  return { nome: e.nome as NomeEvento, rota, ...(e.faixa ? { faixa: e.faixa as Evento["faixa"] } : {}), fonte: "interno", coorte: COORTE };
}
