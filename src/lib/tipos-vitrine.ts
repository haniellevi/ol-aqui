// Tipos da vitrine completa da loja e da página de planos
// (migração 20261107040000_vitrine_completa.sql). Dinheiro em centavos, datas em texto ISO.
import type { TipoVitrine } from "@/lib/tipos";

/* ----------------------------- Horários ----------------------------- */

export const DIAS_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"] as const;
export type DiaSemana = (typeof DIAS_SEMANA)[number];

/** Uma faixa de horário: "08:00" até "12:00" ("fecha" pode ser "24:00"). */
export type FaixaHorario = { abre: string; fecha: string };

/** Horários por dia. Dia vazio ou ausente = fechado. null = a loja não informou. */
export type Horarios = Partial<Record<DiaSemana, FaixaHorario[]>>;

/* ------------------------------ Banner ------------------------------ */

export type BannerTipo = "foto" | "modelo";
export const BANNER_MODELOS = ["liso", "listras", "pontos"] as const;
export type BannerModelo = (typeof BANNER_MODELOS)[number];

/* --------------------------- Página pública -------------------------- */

/** Seção própria da loja como a página pública recebe (só as que o plano mostra). */
export type SecaoPublica = { id: string; nome: string; anuncios: string[] };

/** Resultado de public.vitrine_publica(slug): só campos públicos (nunca CNPJ, plano ou cobrança). */
export type VitrinePublica = {
  id: string;
  slug: string;
  nome: string;
  logo_url: string | null;
  /** Banner que vale agora: "foto" só se o plano atual tiver foto da fachada. */
  banner_tipo: BannerTipo;
  banner_url: string | null;
  banner_modelo: BannerModelo;
  banner_cor: string;
  selo: boolean;
  cidade: string;
  bairro: string | null;
  whatsapp: string | null; // null = esconder o botão
  endereco: string | null;
  lat: number | null;
  lng: number | null;
  horarios: Horarios | null;
  instagram: string | null;
  sobre: string | null;
  formas_pagamento: string[];
  faz_entrega: boolean | null;
  entrega_obs: string | null;
  status: "ativa" | "inadimplente" | "suspensa";
  criado_em: string;
  microrregiao_id: string;
  e_dono: boolean;
  secoes: SecaoPublica[];
  total_anuncios: number;
};

export type OrdemVitrine = "recentes" | "menor_preco";

/** Linha de public.anuncios_vitrine(): o que o card e os grupos precisam. */
export type AnuncioVitrine = {
  id: string;
  titulo: string;
  preco_centavos: number | null;
  aceita_troca: boolean;
  cidade: string;
  bairro: string | null;
  capa: string | null;
  criado_em: string;
  destaque: boolean; // pago: o card mostra "Patrocinado"
  fixado: number | null; // posição no topo (só os que o plano mostra)
  categoria_id: string | null;
  categoria_slug: string | null;
  categoria_nome: string | null;
  categoria_pai_nome: string | null;
  grupo_ordem: number;
};

/* ------------------------------ Dono -------------------------------- */

/** O que o plano de agora libera na vitrine e quanto a loja já usa. null nos máximos = sem limite. */
export type RecursosVitrine = {
  foto_fachada: boolean;
  secoes_max: number | null;
  fixados_max: number | null;
  secoes_total: number;
  fixados_total: number;
  banner_moderado_em: string | null;
  banner_moderado_motivo: string | null;
};

/** Campos da vitrine que o dono edita nas telas novas. */
export type MinhaVitrineCompleta = {
  id: string;
  slug: string;
  nome: string;
  tipo: TipoVitrine;
  status: "ativa" | "inadimplente" | "suspensa";
  microrregiao_id: string;
  logo_url: string | null;
  capa_url: string | null;
  banner_tipo: BannerTipo;
  banner_url: string | null;
  banner_modelo: BannerModelo;
  banner_cor: string;
  endereco: string | null;
  lat: number | null;
  lng: number | null;
  horarios: Horarios | null;
  instagram: string | null;
  sobre: string | null;
  descricao: string | null;
  formas_pagamento: string[];
  faz_entrega: boolean | null;
  entrega_obs: string | null;
};

/** Seção própria vista pelo dono (inclui as escondidas e as que passam do plano). */
export type MinhaSecao = {
  id: string;
  nome: string;
  ordem: number;
  ativa: boolean;
  anuncios: string[]; // ids na ordem
};

/** Anúncio do dono nas telas de seções e fixados. */
export type MeuAnuncioVitrine = {
  id: string;
  titulo: string;
  preco_centavos: number | null;
  capa: string | null;
  status: string;
  fixado_na_loja: number | null;
};

/** Opções do painel para a vitrine (configurações). */
export type OpcoesVitrine = {
  cores: string[];
  formasPagamento: string[];
  anunciosPorSecao: number | null;
};

/* ------------------------------ Planos ------------------------------ */

/** Plano à venda como a página /planos mostra (tabela planos, só os ativos). */
export type PlanoPublico = {
  codigo: string;
  nome: string;
  descricao: string | null;
  publico: "pf" | "pj" | "todos";
  preco_centavos: number;
  periodo_dias: number;
  limite_anuncios: number | null;
  acesso_radar: boolean;
  propostas_radar_mes: number | null;
  e_teste: boolean;
  ordem: number;
  vitrine_foto_fachada: boolean;
  vitrine_secoes_max: number | null;
  vitrine_fixados_max: number | null;
  recomendado: boolean;
};

export type RecursoVitrine = "foto" | "secoes" | "fixados";

/** Pergunta e resposta da página de planos (configuração planos.perguntas_frequentes). */
export type PerguntaFrequente = { pergunta: string; resposta: string };
