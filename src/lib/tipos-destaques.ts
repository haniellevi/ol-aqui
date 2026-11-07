// Tipos dos destaques pagos (migração 20261107030000_destaques.sql).
// Arquivo separado de tipos.ts para não misturar com as outras partes do sistema.

/** Os 4 tipos. O comportamento de cada um está no banco; nome, preço, dias e vagas vêm do painel. */
export type SlugDestaque = "subir" | "busca" | "home" | "loja";

export type StatusDestaque = "aguardando_pagamento" | "ativo" | "encerrado" | "cancelado";
export type OrigemDestaque = "pago" | "credito" | "cortesia";
export type FormaPagamento = "pix" | "cartao";

/** Linha de destaque_tipos (painel). */
export type TipoDestaque = {
  slug: SlugDestaque;
  nome: string;
  descricao: string | null;
  preco_centavos: number;
  dias: number | null; // null no "subir" (sobe uma vez)
  vagas_por_regiao: number | null; // null = sem limite
  alvo: "anuncio" | "loja";
  ativo: boolean;
  ordem: number;
  atualizado_em: string;
};

/** Linha de opcoes_destaque(): o que a pessoa pode contratar agora. */
export type OpcaoDestaque = {
  slug: SlugDestaque;
  nome: string;
  descricao: string | null;
  preco_centavos: number;
  dias: number | null;
  vagas_por_regiao: number | null;
  vagas_livres: number | null;
  alvo: "anuncio" | "loja";
  creditos_restantes: number;
  disponivel: boolean;
  motivo: string | null;
  ordem: number;
};

/** Um pedido de destaque visto pelo dono (tela de pagamento e espera do Pix). */
export type PedidoDestaque = {
  id: string;
  tipo: SlugDestaque;
  tipo_nome: string;
  anuncio_id: string | null;
  status: StatusDestaque;
  origem: OrigemDestaque;
  preco_centavos: number;
  inicio: string | null;
  fim: string | null;
  reservado_ate: string | null;
  pagamento_id: string | null;
  pagamento_status: "pendente" | "pago" | "vencido" | "estornado" | "cancelado" | null;
  pagamento_forma: "pix" | "boleto" | "cartao" | null;
  link_pagamento: string | null;
  tem_cobranca: boolean;
};

/** Linha de resultados_destaques(): números do destaque dentro da janela dele. */
export type ResultadoDestaque = {
  id: string;
  tipo: SlugDestaque;
  tipo_nome: string;
  anuncio_id: string | null;
  anuncio_titulo: string | null;
  vitrine_id: string;
  vitrine_nome: string;
  microrregiao_id: string;
  origem: OrigemDestaque;
  status: StatusDestaque;
  preco_centavos: number;
  inicio: string | null;
  fim: string | null;
  reservado_ate: string | null;
  pagamento_id: string | null;
  pagamento_status: string | null;
  motivo: string | null;
  criado_em: string;
  visualizacoes: number;
  cliques_whatsapp: number;
};

/** Loja do bloco "Lojas em destaque" (página inicial). */
export type LojaEmDestaque = {
  id: string;
  slug: string;
  nome: string;
  logo_url: string | null;
  cidade: string;
  selo_loja_verificada: boolean;
};

/** Créditos grátis por mês de cada plano (painel). */
export type CreditoPlano = { plano_codigo: string; tipo: SlugDestaque; quantidade_mes: number };

/** O que a tela recebe depois de pedir o pagamento. */
export type Cobranca =
  | { forma: "pix"; qrCodeBase64: string | null; copiaECola: string | null; link: string | null }
  | { forma: "cartao"; link: string };

/** Resposta das ações de pagamento: pedido + cobrança, ou "precisa do CPF". */
export type RespostaPagamento =
  | { etapa: "ativo"; pedido: PedidoDestaque }
  | { etapa: "cobranca"; pedido: PedidoDestaque; cobranca: Cobranca }
  | { etapa: "precisa_documento"; pedidoId: string | null };
