// Endereços usados em mais de uma tela (um lugar só para mudar).

/** Página pública dos planos (/planos). Aceita ?origem=... para saber de onde a pessoa veio. */
export const LINK_PLANOS = "/planos";

/** Vitrine completa (Minha conta > Minha loja) e as telas dela. */
export const LINK_MINHA_LOJA = "/minha-conta/loja";
export const LINK_LOJA_BANNER = "/minha-conta/loja/banner";
export const LINK_LOJA_INFORMACOES = "/minha-conta/loja/informacoes";
export const LINK_LOJA_SECOES = "/minha-conta/loja/secoes";
export const LINK_LOJA_FIXADOS = "/minha-conta/loja/fixados";

/** Tela "Destacar" de um anúncio (também usada pelo robô Aki, via gerarLinkDestaque). */
export const linkDestacar = (anuncioId: string, pedidoId?: string | null) =>
  `/destacar/${anuncioId}${pedidoId ? `?d=${pedidoId}` : ""}`;

/** Tela "Destacar minha loja" (tipo "Loja em destaque"). */
export const LINK_DESTACAR_LOJA = "/destacar/loja";

/** "Destacar minha loja" retomando um pagamento (?d=<pedido>). */
export const linkDestacarLoja = (pedidoId?: string | null) => `${LINK_DESTACAR_LOJA}${pedidoId ? `?d=${pedidoId}` : ""}`;

/** "Meu plano" (pagar plano). `plano` já escolhe um; `pagamentoId` retoma um pagamento (?p=). */
export const LINK_MEU_PLANO = "/minha-conta/plano";
export const linkMeuPlano = (opcoes: { plano?: string | null; pagamentoId?: string | null } = {}) => {
  const q = new URLSearchParams();
  if (opcoes.plano) q.set("plano", opcoes.plano);
  if (opcoes.pagamentoId) q.set("p", opcoes.pagamentoId);
  const s = q.toString();
  return s ? `${LINK_MEU_PLANO}?${s}` : LINK_MEU_PLANO;
};

/** Pagamento do anúncio avulso de um anúncio (pessoa física), retomando um pagamento com ?p=. */
export const linkAvulso = (anuncioId: string, pagamentoId?: string | null) =>
  `/anunciar/avulso?id=${anuncioId}${pagamentoId ? `&p=${pagamentoId}` : ""}`;

/** Painel: telas 5 (lojas e vendedores) e 6 (pagamentos). */
export const LINK_ADMIN_LOJAS = "/admin/lojas";
export const LINK_ADMIN_PAGAMENTOS = "/admin/pagamentos";
