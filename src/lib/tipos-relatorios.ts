// Tipos da tela 13 (Mensagens automáticas) e da tela 15 (Relatórios) do painel.
// Banco: supabase/migrations/20261108060000_mensagens_relatorios.sql · Nota: docs/etapa5/relatorios.md

/* ------------------------------ Mensagens ------------------------------ */

/** notificacao = aviso dentro do site (já mandado); whatsapp e email = guardados ("envio em breve"). */
export type CanalMensagem = "notificacao" | "whatsapp" | "email";

/** Linha de modelos_mensagem (o painel só muda titulo, texto e ativo). */
export type ModeloMensagem = {
  id: string;
  chave: string;
  canal: CanalMensagem;
  nome: string;
  quando: string;
  variaveis: string[];
  titulo: string | null;
  texto: string;
  titulo_padrao: string | null;
  texto_padrao: string;
  ativo: boolean;
  ordem: number;
  atualizado_em: string;
  atualizado_por: string | null;
};

/** Tamanhos máximos por canal (os mesmos das checagens do banco). */
export const LIMITES_CANAL: Record<CanalMensagem, { titulo: number | null; texto: number }> = {
  notificacao: { titulo: 120, texto: 500 },
  whatsapp: { titulo: null, texto: 1000 },
  email: { titulo: 150, texto: 4000 },
};

export const NOME_CANAL: Record<CanalMensagem, string> = {
  notificacao: "Aviso no site",
  whatsapp: "WhatsApp",
  email: "E-mail",
};

/** Canais que já mandam de verdade hoje. Os outros aparecem como "envio em breve". */
export const CANAIS_ATIVOS: readonly CanalMensagem[] = ["notificacao"];

/**
 * Valores de exemplo para a prévia do painel (só para mostrar como fica; não é regra do negócio).
 * Variável nova no banco sem exemplo aqui aparece como [nome].
 */
export const EXEMPLOS_VARIAVEIS: Record<string, { exemplo: string; explica: string }> = {
  nome: { exemplo: "Maria", explica: "primeiro nome da pessoa" },
  codigo: { exemplo: "482913", explica: "código de 6 números" },
  plano: { exemplo: "Plano Slim", explica: "nome do plano" },
  data: { exemplo: "15/12/2026", explica: "data (dia/mês/ano)" },
  dias: { exemplo: "3", explica: "quantos dias faltam" },
  anuncio: { exemplo: "Moto Honda CG 160 2019", explica: "título do anúncio" },
  tipo: { exemplo: "Destaque na busca", explica: "tipo de destaque" },
  visualizacoes: { exemplo: "340", explica: "visualizações no período" },
  cliques: { exemplo: "12", explica: "cliques no WhatsApp no período" },
  loja: { exemplo: "Loja do João", explica: "nome da loja" },
  pedido: { exemplo: "Geladeira frost free", explica: "o que o comprador pediu" },
  preco: { exemplo: "R$ 1.850", explica: "preço" },
  total: { exemplo: "6", explica: "quantas propostas chegaram" },
  menor: { exemplo: "R$ 1.850", explica: "menor preço das propostas" },
  cidade: { exemplo: "Corrente", explica: "cidade" },
  valor: { exemplo: "R$ 49,90", explica: "valor pago" },
  item: { exemplo: "Plano Slim", explica: "o que foi pago" },
};

/* ------------------------------ Relatórios ------------------------------ */

/** Filtros da tela 15, lidos do endereço (?de=&ate=&regiao=). Datas AAAA-MM-DD no fuso de Fortaleza. */
export type FiltrosRelatorio = { de: string; ate: string; regiao: string | null };

export type RelatorioId = "funil" | "anuncios" | "conversao" | "receita" | "aki";

export type Funil = {
  visualizacoes: number;
  cliques_whatsapp: number;
  compartilhamentos: number;
  vendidos: number;
  vendidos_pelo_olaki: number;
  vendidos_fora: number;
  vendidos_sem_resposta: number;
};

export type LinhaAnuncios = { categoria_id: string | null; categoria: string; cidade: string; no_ar: number; publicados: number };

export type LinhaConversao = { mes: string; comecaram: number; pagaram: number; em_teste: number; nao_pagaram: number };

export type TipoReceita = "assinatura" | "anuncio_avulso" | "destaque";
export type LinhaReceita = { mes: string; tipo: TipoReceita; quantidade: number; total_centavos: number };

export type LinhaCustoAki = { mes: string; respostas: number; conversas: number; erros: number; custo_centavos: number };

export type Relatorios = {
  funil: Funil | null;
  anuncios: LinhaAnuncios[] | null;
  conversao: LinhaConversao[] | null;
  receita: LinhaReceita[] | null;
  aki: LinhaCustoAki[] | null;
};
