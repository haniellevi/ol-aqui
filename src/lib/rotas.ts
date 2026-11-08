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

/** Radar: pedir (com o texto já preenchido), pedido do comprador e pedido visto pela loja. */
export const LINK_RADAR = "/radar";
export const linkPedirRadar = (texto?: string | null) => {
  const t = (texto ?? "").trim().slice(0, 120);
  return t ? `/radar/pedir?q=${encodeURIComponent(t)}` : "/radar/pedir";
};
export const linkMeuPedidoRadar = (pedidoId: string) => `/radar/pedido/${pedidoId}`;
export const linkPedidoRadarLoja = (pedidoId: string) => `/radar/${pedidoId}`;
export const LINK_AVISOS = "/minha-conta/notificacoes";

/** Páginas e textos: ajuda, termos, privacidade, Aki em tela cheia, aceite no 1º acesso e painel (tela 12). */
export const LINK_AJUDA = "/ajuda";
export const LINK_TERMOS = "/termos";
export const LINK_PRIVACIDADE = "/privacidade";
export const linkDocumentoLegal = (tipo: "termos" | "privacidade", versao?: number | null) =>
  `${tipo === "termos" ? LINK_TERMOS : LINK_PRIVACIDADE}${versao ? `?versao=${versao}` : ""}`;
export const LINK_AKI = "/aki";
export const LINK_ENTRAR_PERFIL = "/entrar/perfil";
export const LINK_ADMIN_TEXTOS = "/admin/textos";

/** Painel: tela 14 (equipe e permissões) e tela 8 (Compliance jurídico, com o relatório para imprimir). */
export const LINK_ADMIN_EQUIPE = "/admin/equipe";
export const LINK_ADMIN_COMPLIANCE = "/admin/compliance";
export const linkRelatorioCompliance = (relatorioId: string) => `/admin/compliance/relatorio/${relatorioId}`;

/** Painel: telas 7 (regiões e cidades) e 9 (categorias e campos). */
export const LINK_ADMIN_REGIOES = "/admin/regioes";
export const linkAdminRegiao = (id: string) => `${LINK_ADMIN_REGIOES}/${id}`;
export const LINK_ADMIN_CATEGORIAS = "/admin/categorias";
export const linkAdminCategoria = (id: string) => `${LINK_ADMIN_CATEGORIAS}/${id}`;

/** Painel: telas 13 (mensagens automáticas) e 15 (relatórios). */
export const LINK_ADMIN_MENSAGENS = "/admin/mensagens";
export const LINK_ADMIN_RELATORIOS = "/admin/relatorios";
