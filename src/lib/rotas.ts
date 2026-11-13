// Endereços usados em mais de uma tela (um lugar só para mudar).

/** Página pública dos planos (/planos). Aceita ?origem=... para saber de onde a pessoa veio. */
export const LINK_PLANOS = "/planos";

/** Vitrine completa (Minha conta > Minha loja) e as telas dela. */
export const LINK_MINHA_LOJA = "/minha-conta/loja";
export const LINK_LOJA_BANNER = "/minha-conta/loja/banner";
export const LINK_LOJA_INFORMACOES = "/minha-conta/loja/informacoes";
export const LINK_LOJA_SECOES = "/minha-conta/loja/secoes";
export const LINK_LOJA_FIXADOS = "/minha-conta/loja/fixados";
export const LINK_LOJA_CATEGORIAS = "/minha-conta/loja/categorias";
export const LINK_LOJA_DESEMPENHO = "/minha-conta/loja/desempenho";
export const LINK_LOJA_HISTORICO = "/minha-conta/loja/historico";
/** Envio dos documentos para o selo de loja verificada. */
export const LINK_LOJA_VERIFICAR = "/minha-conta/loja/verificar";
/** Histórico de mudanças de um anúncio (Etapa P5a). */
export const linkHistoricoAnuncio = (anuncioId: string) => `/minha-conta/anuncios/${anuncioId}/historico`;
/** Melhorar um produto com IA (vitrine com IA, etapa 5b). */
export const linkMelhorarComIA = (anuncioId: string) => `/minha-conta/loja/melhorar/${anuncioId}`;

/** Tela "Destacar" de um anúncio (também usada pelo robô Merc, via gerarLinkDestaque). */
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
export const LINK_ADMIN_ANUNCIOS = "/admin/anuncios";
export const LINK_ADMIN_ATENDIMENTOS = `${LINK_ADMIN_ANUNCIOS}/conversas`;
export const linkAdminAnuncio = (id: string) => `${LINK_ADMIN_ANUNCIOS}/${id}`;
export const LINK_ATENDIMENTO = "/minha-conta/atendimento";
export const linkAtendimento = (id: string) => `${LINK_ATENDIMENTO}/${id}`;

/** Radar: pedir (com o texto já preenchido), pedido do comprador e pedido visto pela loja. */
export const LINK_RADAR = "/radar";
export type FiltrosPedido = {
  categoria?: string | null;
  cidade?: string | null;
  precoMin?: string | null;
  precoMax?: string | null;
  /** "Pedir de novo": o resto do pedido antigo (detalhes, categoria por id, cidades marcadas e quem vê). */
  detalhes?: string | null;
  categoriaId?: string | null;
  cidades?: string[] | null;
  visibilidade?: "lojas" | "todos" | null;
};
export const linkPedirRadar = (texto?: string | null, filtros: FiltrosPedido = {}) => {
  const params = new URLSearchParams();
  const campos: [string, string | null | undefined, number][] = [
    ["q", texto, 120],
    ["detalhes", filtros.detalhes, 1000],
    ["categoria", filtros.categoria, 120],
    ["categoria_id", filtros.categoriaId, 36],
    ["cidade", filtros.cidade, 120],
    ["preco_min", filtros.precoMin, 120],
    ["preco_max", filtros.precoMax, 120],
    ["cidades", filtros.cidades?.slice(0, 20).join(","), 20 * 37],
    ["quem", filtros.visibilidade, 5],
  ];
  for (const [chave, valor, max] of campos) {
    const t = (valor ?? "").trim().slice(0, max);
    if (t) params.set(chave, t);
  }
  return params.size ? `/radar/pedir?${params}` : "/radar/pedir";
};
export const linkMeuPedidoRadar = (pedidoId: string) => `/radar/pedido/${pedidoId}`;
export const linkPedidoRadarLoja = (pedidoId: string) => `/radar/${pedidoId}`;
export const LINK_AVISOS = "/minha-conta/notificacoes";

/** Páginas e textos: ajuda, termos, privacidade, Merc em tela cheia, aceite no 1º acesso e painel (tela 12). */
export const LINK_AJUDA = "/ajuda";
export const LINK_TERMOS = "/termos";
export const LINK_PRIVACIDADE = "/privacidade";
export const linkDocumentoLegal = (tipo: "termos" | "privacidade", versao?: number | null) =>
  `${tipo === "termos" ? LINK_TERMOS : LINK_PRIVACIDADE}${versao ? `?versao=${versao}` : ""}`;
export const LINK_AKI = "/aki";
export const LINK_ENTRAR_PERFIL = "/completar-perfil";
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
export const LINK_ADMIN_CATEGORIAS_SUGERIDAS = `${LINK_ADMIN_CATEGORIAS}/sugeridas`;
export const LINK_ADMIN_CATEGORIAS_IA = `${LINK_ADMIN_CATEGORIAS}/ia`;

/** Painel: telas 13 (mensagens automáticas) e 15 (relatórios). */
export const LINK_ADMIN_MENSAGENS = "/admin/mensagens";
export const LINK_ADMIN_RELATORIOS = "/admin/relatorios";

/** Conversas entre cliente e loja (Radar v2, fase 2). */
export const LINK_CONVERSAS = "/conversas";
export const linkConversa = (id: string) => `/conversas/${id}`;
/** Leitura de conversa denunciada pela equipe. */
export const linkAdminConversa = (id: string) => `/admin/conversas/${id}`;
