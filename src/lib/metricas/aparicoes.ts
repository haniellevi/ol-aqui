// Etapa P4: aparições do anúncio nas listas (início, busca, categoria, loja).
// Só chega ao banco um resumo do dia por anúncio e página: nunca uma linha por aparição.

export const PAGINAS_APARICAO = ["inicio", "busca", "categoria", "loja"] as const;
export type PaginaAparicao = (typeof PAGINAS_APARICAO)[number];
/** Limite por envio. Lista maior vai em partes (lotesDeAparicoes), sem perder a posição. */
export const MAXIMO_APARICOES_POR_ENVIO = 60;
/** Maior posição aceita: o banco também limita a 500 (a loja mostra até 120 por página). */
export const POSICAO_MAXIMA = 500;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Robôs e ferramentas de prévia não contam como visita.
const PADROES_BOT = /bot|crawl|spider|slurp|headless|lighthouse|preview|facebookexternalhit|whatsapp|telegram|curl|wget|python|node-fetch|go-http/i;

export type ItemAparicao = { id: string; posicao: number };

/** Navegador sem identificação ou de robô: não conta. */
export function ehBot(agente: string | null | undefined): boolean {
  return !agente || PADROES_BOT.test(agente);
}

/**
 * Confere o envio. A posição é a ordem na tela (1 = primeiro card); ids que não são UUID são ignorados.
 * Devolve null quando não há o que contar. Nunca lança erro.
 */
export function validarAparicoes(
  pagina: unknown,
  ids: unknown,
  inicio: unknown = 0,
): { pagina: PaginaAparicao; itens: ItemAparicao[] } | null {
  if (!(PAGINAS_APARICAO as readonly unknown[]).includes(pagina)) return null;
  if (!Array.isArray(ids)) return null;
  const desde = typeof inicio === "number" && Number.isSafeInteger(inicio) && inicio >= 0 && inicio < POSICAO_MAXIMA ? inicio : 0;
  const itens: ItemAparicao[] = [];
  for (const [i, id] of ids.slice(0, MAXIMO_APARICOES_POR_ENVIO).entries()) {
    if (typeof id === "string" && UUID.test(id)) itens.push({ id: id.toLowerCase(), posicao: desde + i + 1 });
  }
  return itens.length ? { pagina: pagina as PaginaAparicao, itens } : null;
}

/** Parte uma lista grande em envios de até 60, guardando onde cada parte começa na tela. */
export function lotesDeAparicoes(ids: string[]): { inicio: number; ids: string[] }[] {
  const lotes: { inicio: number; ids: string[] }[] = [];
  for (let inicio = 0; inicio < ids.length && inicio < POSICAO_MAXIMA; inicio += MAXIMO_APARICOES_POR_ENVIO) {
    lotes.push({ inicio, ids: ids.slice(inicio, inicio + MAXIMO_APARICOES_POR_ENVIO) });
  }
  return lotes;
}
