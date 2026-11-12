// Etapa P4: palavra que levou o cliente ao anúncio. Só é guardada quando a pessoa buscou no site
// e abriu o anúncio logo depois. O número fica solto: nada liga a palavra a quem buscou.

export const TAMANHO_MAXIMO_TERMO = 60;
/** Marca do clique num cartão da busca, guardada na aba (sessionStorage). */
export const CHAVE_BUSCA_ABERTA = "olaki.buscaAberta";
/** Quanto tempo a marca vale: o anúncio precisa abrir logo depois do clique. */
export const TEMPO_ABERTURA_MS = 60_000;

/**
 * Mesma forma de public.normaliza_termo() no banco: minúsculas, sem acento, só letras e números
 * separados por um espaço, até 60 letras. Vazio ou sem letras vira null.
 */
export function normalizarTermo(texto: string | null | undefined): string | null {
  if (typeof texto !== "string" || !texto) return null;
  const limpo = texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .slice(0, TAMANHO_MAXIMO_TERMO)
    .trim();
  return limpo || null;
}

/** Termo da busca quando a página veio da busca deste site (referrer com /busca?q=). */
export function termoDaBusca(origem: string | null | undefined, meuSite: string): string | null {
  if (!origem) return null;
  try {
    const url = new URL(origem);
    const base = new URL(meuSite);
    if (url.origin !== base.origin || url.pathname !== "/busca") return null;
    return normalizarTermo(url.searchParams.get("q"));
  } catch {
    return null;
  }
}

/** Texto da marca guardada quando a pessoa clica num cartão da busca. */
export function montarBuscaAberta(termo: string, caminho: string, agora: number): string {
  return JSON.stringify({ termo, caminho, quando: agora });
}

/**
 * Lê a marca e devolve o termo só se for deste anúncio (mesmo caminho) e recente.
 * Qualquer coisa fora do formato é ignorada.
 */
export function termoDaAberturaRecente(marca: string | null | undefined, caminhoAtual: string, agora: number): string | null {
  if (!marca) return null;
  try {
    const dados = JSON.parse(marca) as unknown;
    if (!dados || typeof dados !== "object") return null;
    const { termo, caminho, quando } = dados as Record<string, unknown>;
    if (typeof termo !== "string" || typeof caminho !== "string" || typeof quando !== "number") return null;
    if (caminho !== caminhoAtual) return null;
    if (agora < quando || agora - quando > TEMPO_ABERTURA_MS) return null;
    return normalizarTermo(termo);
  } catch {
    return null;
  }
}

/**
 * O endereço de origem (document.referrer) só vale para a primeira página aberta nesta aba.
 * Depois de navegar dentro do site ele continua o mesmo e levaria a palavra da busca para outros anúncios.
 * `inicial` é o endereço do documento carregado (performance navigation); `atual`, o de agora.
 */
export function primeiraPaginaDaAba(inicial: string | null | undefined, atual: string): boolean {
  if (!inicial) return false;
  try {
    const a = new URL(inicial);
    const b = new URL(atual);
    return a.origin === b.origin && a.pathname === b.pathname;
  } catch {
    return false;
  }
}
