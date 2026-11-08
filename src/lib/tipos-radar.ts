// Tipos do Radar completo (migração 20261108020000_radar_completo.sql).
// Dinheiro sempre em centavos; datas em texto ISO (como o Supabase devolve).

export type ModoContato = "whatsapp_direto" | "propostas_prazo";

/** Situação calculada pelo banco: aberto, prazo das propostas acabou, fechado ou em análise. */
export type SituacaoPedido = "aberto" | "prazo_acabou" | "fechado" | "em_analise";

export type MotivoFechamento = "resolvido" | "cancelado" | "prazo" | "moderacao" | null;

/** Linha de meus_pedidos_radar() (aba "Meus pedidos"). */
export type MeuPedidoRadar = {
  id: string;
  titulo: string;
  cidade: string;
  categoria_nome: string | null;
  status: string;
  situacao: SituacaoPedido;
  modo_contato: ModoContato;
  propostas_ate: string | null;
  expira_em: string;
  criado_em: string;
  total_propostas: number;
  menor_preco_centavos: number | null;
  fechado_motivo: MotivoFechamento;
  moderado_motivo: string | null;
};

/** Linha de radar_pedido(id): o pedido com o mesmo bloqueio do feed. */
export type PedidoRadarDetalhe = {
  id: string;
  titulo: string;
  detalhes: string | null; // null sem plano com Radar
  categoria: string;
  categoria_id: string | null;
  categoria_nome: string | null;
  preco_min_centavos: number | null;
  preco_max_centavos: number | null;
  cidade: string;
  urgencia: "normal" | "esta_semana" | "hoje";
  modo_contato: ModoContato;
  propostas_ate: string | null;
  expira_em: string;
  criado_em: string;
  status: string;
  situacao: SituacaoPedido;
  total_propostas: number;
  max_propostas: number;
  comprador_primeiro_nome: string | null;
  comprador_certificado: boolean;
  sou_comprador: boolean;
  ja_propus: boolean;
  mesma_regiao: boolean;
  tem_acesso: boolean;
  moderado_motivo: string | null;
  /** Só para o dono (e a equipe): por que o pedido fechou. */
  fechado_motivo: MotivoFechamento;
};

/** Linha de propostas_do_pedido(id): o que o comprador compara (sem contato). */
export type PropostaRecebida = {
  id: string;
  vitrine_id: string;
  loja_nome: string;
  loja_slug: string | null; // só loja tem página
  loja_tipo: "pf" | "loja";
  loja_selo: boolean;
  loja_logo: string | null;
  preco_centavos: number | null;
  mensagem: string | null;
  foto_url: string | null;
  anuncio_id: string | null;
  anuncio_titulo: string | null;
  anuncio_preco_centavos: number | null;
  anuncio_capa: string | null;
  escolhida: boolean;
  status: "ativa" | "oculta";
  criado_em: string;
  atualizado_em: string;
};

/** Linha de minhas_propostas_radar() (aba "Minhas propostas" da loja). */
export type MinhaPropostaRadar = {
  id: string;
  pedido_id: string;
  pedido_titulo: string;
  pedido_cidade: string;
  situacao: SituacaoPedido;
  modo_contato: ModoContato;
  propostas_ate: string | null;
  preco_centavos: number | null;
  mensagem: string | null;
  foto_url: string | null;
  anuncio_id: string | null;
  status: "ativa" | "oculta";
  moderado_motivo: string | null;
  escolhida: boolean;
  criado_em: string;
  atualizado_em: string;
};

/** Anúncio da loja que pode ir numa proposta. */
export type AnuncioParaProposta = { id: string; titulo: string; preco_centavos: number | null; capa: string | null };

/** Minha proposta atual num pedido (para editar na folha "Propor"). */
export type MinhaPropostaNoPedido = {
  id: string;
  preco_centavos: number | null;
  mensagem: string | null;
  foto_url: string | null;
  anuncio_id: string | null;
  status: "ativa" | "oculta";
  moderado_motivo: string | null;
  escolhida: boolean;
};

/** Regras do Radar lidas do painel (configuracoes). */
export type RegrasRadar = {
  prazosHoras: number[];
  pedidosPorDia: number | null;
  pedidosAbertosMax: number | null;
  mensagemMax: number;
};

/** Plano com Radar mostrado para quem não tem (tabela planos). */
export type PlanoRadar = { codigo: string; nome: string; preco_centavos: number; periodo_dias: number; propostas_radar_mes: number | null };

/** Aviso do app (tabela notificacoes). */
export type Notificacao = {
  id: string;
  tipo: string;
  titulo: string;
  texto: string;
  link: string | null;
  lida_em: string | null;
  criado_em: string;
};

/** Um aviso que a pessoa pode ligar ou desligar (Minha conta > Notificações). */
export type PreferenciaAviso = { tipo: string; nome: string; explicacao: string; ligado: boolean };

/* ----------------------------- Respostas ----------------------------- */

export type RespostaCriarPedido =
  | { ok: true; id: string; status: "aberto" | "em_analise" }
  | { ok: false; erro: string; campo?: string; precisaCelular?: boolean };

export type RespostaProposta =
  | { ok: true; modo: "whatsapp_direto"; linkWhatsapp: string; editada: boolean }
  | { ok: true; modo: "propostas_prazo"; mensagem: string; editada: boolean }
  | { ok: false; erro: string; campo?: string; precisaPlano?: boolean };

export type RespostaEscolher = { ok: true; linkWhatsapp: string } | { ok: false; erro: string };

export type RespostaSimples = { ok: true; mensagem: string } | { ok: false; erro: string };

export type EnvioFotoProposta =
  | { ok: true; urlEnvio: string; urlPublica: string }
  | { ok: false; erro: string };
