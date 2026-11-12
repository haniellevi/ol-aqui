// Tipos da cobrança de planos e do anúncio avulso (migração 20261108010000_cobranca_planos.sql)
// e das telas 5 (lojas) e 6 (pagamentos) do painel. Separado de tipos.ts de propósito.
import type { Cobranca } from "@/lib/tipos-destaques";

export type { Cobranca, FormaPagamento } from "@/lib/tipos-destaques";

/** Como o pagamento entra no plano (calculado no banco antes e na hora de pagar). */
export type RegraAssinatura = "inicio" | "renovacao" | "troca_agora" | "proximo_periodo" | "renovacao_proximo";

/** Situação da conta de vendedor (calculada: "vencida" não muda o status da vitrine). */
export type SituacaoConta = "teste" | "teste_vencido" | "ativa" | "vencida" | "suspensa" | "inadimplente" | "gratis";

export type StatusPagamento = "pendente" | "pago" | "vencido" | "estornado" | "cancelado";
export type AmbientePagamento = "producao" | "sandbox" | "sem_origem";
export type TipoPagamento = "assinatura" | "anuncio_avulso" | "destaque";

/** Linha de minha_assinatura(). */
export type MinhaAssinatura = {
  vitrine_id: string;
  tipo: "pf" | "loja";
  status: "ativa" | "inadimplente" | "suspensa";
  situacao: SituacaoConta;
  plano: string | null;
  plano_nome: string | null;
  e_teste: boolean;
  preco_centavos: number;
  vence_em: string | null;
  plano_proximo: string | null;
  plano_proximo_nome: string | null;
  plano_proximo_inicio: string | null;
  plano_proximo_ate: string | null;
  aviso_dias: number;
  renovar_agora: boolean;
};

/** Linha de opcoes_assinatura(): um plano num período, com valor e regra antes de pagar. */
export type OpcaoAssinatura = {
  codigo: string;
  nome: string;
  descricao: string | null;
  preco_centavos: number;
  periodo_dias: number;
  limite_anuncios: number | null;
  acesso_radar: boolean;
  propostas_radar_mes: number | null;
  recomendado: boolean;
  ordem: number;
  meses: number;
  desconto_percentual: number;
  valor_centavos: number;
  dias: number;
  regra: RegraAssinatura | null;
  inicio: string | null;
  fim: string | null;
  atual: boolean;
  disponivel: boolean;
  motivo: string | null;
};

/** Um pagamento de plano ou avulso visto pelo dono (tela de espera do Pix). */
export type MeuPagamento = {
  id: string;
  tipo: TipoPagamento;
  status: StatusPagamento;
  valor_centavos: number;
  plano_codigo: string | null;
  plano_nome: string | null;
  meses: number;
  anuncio_id: string | null;
  regra: RegraAssinatura | null;
  concedido_de: string | null;
  concedido_ate: string | null;
  forma: "pix" | "boleto" | "cartao" | null;
  link_pagamento: string | null;
  tem_cobranca: boolean;
  pago_em: string | null;
  criado_em: string;
  observacao: string | null;
  /** Pago, mas não pôde ser aplicado: a equipe devolve o dinheiro. */
  devolver_motivo: string | null;
};

/** Resposta das ações de pagamento de plano e avulso. */
export type RespostaCobranca =
  | { etapa: "pago"; pagamento: MeuPagamento }
  | { etapa: "cobranca"; pagamento: MeuPagamento; cobranca: Cobranca }
  | { etapa: "precisa_documento"; pagamentoId: string };

// ---------------------------------------------------------------- painel

/** Linha de admin_lojas() (tela 5). */
export type LojaAdmin = {
  id: string;
  slug: string;
  nome: string;
  tipo: "pf" | "loja";
  dono_id: string;
  dono_nome: string | null;
  whatsapp: string | null;
  cidade: string | null;
  microrregiao_id: string;
  plano: string | null;
  plano_nome: string | null;
  plano_efetivo_nome: string | null;
  teste_expira_em: string | null;
  plano_expira_em: string | null;
  plano_proximo: string | null;
  plano_proximo_nome: string | null;
  plano_proximo_ate: string | null;
  status: "ativa" | "inadimplente" | "suspensa" | "montagem";
  situacao: SituacaoConta | "arquivada" | "excluida" | "montagem";
  selo_loja_verificada: boolean;
  anuncios_ativos: number;
  limite_anuncios: number | null;
  propostas_mes: number;
  propostas_limite: number | null;
  criado_em: string;
  total: number;
};

export type AcaoLoja = "cortesia" | "trocar_plano" | "suspender" | "reativar" | "dar_selo" | "tirar_selo";

/** Linha de admin_resumo_pagamentos() (tela 6). */
export type ResumoPagamentos = { status: StatusPagamento; tipo: TipoPagamento; quantidade: number; total_centavos: number };

/** Linha da lista de pagamentos do painel. */
export type PagamentoAdmin = {
  id: string;
  ambiente: AmbientePagamento;
  tipo: TipoPagamento;
  status: StatusPagamento;
  valor_centavos: number;
  forma: "pix" | "boleto" | "cartao" | null;
  plano_codigo: string | null;
  meses: number | null;
  regra: RegraAssinatura | null;
  vencimento: string | null;
  pago_em: string | null;
  criado_em: string;
  link_pagamento: string | null;
  asaas_cobranca_id: string | null;
  devolver_motivo: string | null;
  observacao: string | null;
  microrregiao_id: string;
  vitrine_id: string;
  vitrine_nome: string | null;
  vitrine_slug: string | null;
  /** WhatsApp da loja (ou do dono) para reenviar o link da fatura. */
  vitrine_whatsapp: string | null;
  anuncio_titulo: string | null;
};

/** Verificação pendente (perfis_verificacoes). */
export type VerificacaoPendente = {
  id: string;
  perfil_id: string;
  perfil_nome: string | null;
  tipo: string;
  status: string;
  criado_em: string;
};
