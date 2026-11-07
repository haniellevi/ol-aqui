// Endereços usados em mais de uma tela (um lugar só para mudar).

/** Tela dos planos (T: Meu plano). Aceita ?origem=... para saber de onde a pessoa veio. */
export const LINK_PLANOS = "/minha-conta/plano";

/** Tela "Destacar" de um anúncio (também usada pelo robô Aki, via gerarLinkDestaque). */
export const linkDestacar = (anuncioId: string, pedidoId?: string | null) =>
  `/destacar/${anuncioId}${pedidoId ? `?d=${pedidoId}` : ""}`;

/** Tela "Destacar minha loja" (tipo "Loja em destaque"). */
export const LINK_DESTACAR_LOJA = "/destacar/loja";
