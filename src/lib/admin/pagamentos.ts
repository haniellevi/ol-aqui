import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ehUuid } from "@/lib/formato";
import type { PagamentoAdmin, StatusPagamento, TipoPagamento } from "@/lib/tipos-cobranca";

// Tela 6 · Pagamentos: filtros lidos do endereço (?status=&tipo=&regiao=&de=&ate=), usados pela lista,
// pelos totais (admin_resumo_pagamentos) e pelo CSV. Sempre com o token do admin: a RLS barra os outros.

export const STATUS_PAGAMENTOS: readonly StatusPagamento[] = ["pendente", "pago", "vencido", "estornado", "cancelado"];
export const TIPOS_PAGAMENTOS: readonly TipoPagamento[] = ["assinatura", "anuncio_avulso", "destaque"];

export const NOME_STATUS: Record<StatusPagamento, string> = {
  pendente: "Aguardando",
  pago: "Pago",
  vencido: "Vencido",
  estornado: "Devolvido",
  cancelado: "Cancelado",
};
export const NOME_TIPO: Record<TipoPagamento, string> = { assinatura: "Plano", anuncio_avulso: "Anúncio avulso", destaque: "Destaque" };

export type FiltrosPagamentos = {
  status: StatusPagamento | null;
  tipo: TipoPagamento | null;
  regiao: string | null;
  de: string | null; // AAAA-MM-DD (fuso de Fortaleza)
  ate: string | null;
};

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const um = (v: string | string[] | undefined | null) => (Array.isArray(v) ? v[0] : v) ?? "";
const dataValida = (t: string) => (DATA.test(t) && !Number.isNaN(Date.parse(`${t}T00:00:00Z`)) ? t : null);

export function lerFiltros(sp: Record<string, string | string[] | undefined> | URLSearchParams): FiltrosPagamentos {
  const pegar = (k: string) => (sp instanceof URLSearchParams ? sp.get(k) ?? "" : um(sp[k]));
  const status = pegar("status");
  const tipo = pegar("tipo");
  const regiao = pegar("regiao");
  return {
    status: (STATUS_PAGAMENTOS as readonly string[]).includes(status) ? (status as StatusPagamento) : null,
    tipo: (TIPOS_PAGAMENTOS as readonly string[]).includes(tipo) ? (tipo as TipoPagamento) : null,
    regiao: ehUuid(regiao) ? regiao : null,
    de: dataValida(pegar("de")),
    ate: dataValida(pegar("ate")),
  };
}

/** Os mesmos filtros como texto de endereço (para o link do CSV). */
export function filtrosNoEndereco(f: FiltrosPagamentos): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v) q.set(k, v);
  return q.toString();
}

const diaSeguinte = (d: string) => {
  const x = new Date(`${d}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + 1);
  return x.toISOString().slice(0, 10);
};

const COLUNAS =
  "id, tipo, status, valor_centavos, forma, plano_codigo, meses, regra, vencimento, pago_em, criado_em, link_pagamento, asaas_cobranca_id, devolver_motivo, observacao, microrregiao_id, vitrine_id, vitrines_lojas(nome, slug, whatsapp, perfis(whatsapp)), anuncios(titulo)";

type Linha = Omit<PagamentoAdmin, "vitrine_nome" | "vitrine_slug" | "vitrine_whatsapp" | "anuncio_titulo"> & {
  vitrines_lojas: { nome: string; slug: string; whatsapp: string | null; perfis: { whatsapp: string | null } | null } | null;
  anuncios: { titulo: string | null } | null;
};

const paraAdmin = ({ vitrines_lojas, anuncios, ...l }: Linha): PagamentoAdmin => ({
  ...l,
  vitrine_nome: vitrines_lojas?.nome ?? null,
  vitrine_slug: vitrines_lojas?.slug ?? null,
  vitrine_whatsapp: vitrines_lojas?.whatsapp ?? vitrines_lojas?.perfis?.whatsapp ?? null,
  anuncio_titulo: anuncios?.titulo ?? null,
});

/** Tamanho de cada leitura: a API do Supabase devolve no máximo 1000 linhas por pedido. */
const POR_LEITURA = 1000;

/**
 * Lista de pagamentos com os filtros. O período usa a data do pagamento (pago_em) ou, se não foi pago,
 * a da criação, no fuso de Fortaleza (-03:00), igual a admin_resumo_pagamentos.
 */
export async function listarPagamentos(supabase: SupabaseClient, f: FiltrosPagamentos, limite: number): Promise<PagamentoAdmin[]> {
  return lerFaixa(supabase, f, 0, Math.min(limite, POR_LEITURA) - 1);
}

/**
 * Todos os pagamentos com os filtros (para o CSV), lidos de 1000 em 1000 até acabar ou chegar ao `maximo`.
 * `cortado` = havia mais linhas que o máximo (o CSV avisa).
 */
export async function listarTodosPagamentos(
  supabase: SupabaseClient,
  f: FiltrosPagamentos,
  maximo: number,
): Promise<{ linhas: PagamentoAdmin[]; cortado: boolean }> {
  const linhas: PagamentoAdmin[] = [];
  for (let de = 0; de < maximo + 1; de += POR_LEITURA) {
    const ate = Math.min(de + POR_LEITURA, maximo + 1) - 1; // lê uma linha a mais para saber se cortou
    const pagina = await lerFaixa(supabase, f, de, ate);
    linhas.push(...pagina);
    if (pagina.length < ate - de + 1) break;
  }
  const cortado = linhas.length > maximo;
  return { linhas: cortado ? linhas.slice(0, maximo) : linhas, cortado };
}

async function lerFaixa(supabase: SupabaseClient, f: FiltrosPagamentos, de: number, ate: number): Promise<PagamentoAdmin[]> {
  let q = supabase
    .from("pagamentos")
    .select(COLUNAS)
    .order("criado_em", { ascending: false })
    .order("id", { ascending: true })
    .range(de, ate);
  if (f.status) q = q.eq("status", f.status);
  if (f.tipo) q = q.eq("tipo", f.tipo);
  if (f.regiao) q = q.eq("microrregiao_id", f.regiao);
  if (f.de || f.ate) {
    const de = f.de ? `${f.de}T00:00:00-03:00` : null;
    const ate = f.ate ? `${diaSeguinte(f.ate)}T00:00:00-03:00` : null;
    const faixa = (col: string) => [de && `${col}.gte.${de}`, ate && `${col}.lt.${ate}`].filter(Boolean).join(",");
    q = q.or(`and(pago_em.not.is.null,${faixa("pago_em")}),and(pago_em.is.null,${faixa("criado_em")})`);
  }
  const { data, error } = await q;
  if (error) throw new Error("Não deu para ler os pagamentos agora.");
  return ((data ?? []) as unknown as Linha[]).map(paraAdmin);
}

/** Pagamentos que chegaram mas não puderam ser aplicados: a equipe devolve (todos os tipos). */
export async function devolucoesAFazer(supabase: SupabaseClient): Promise<PagamentoAdmin[]> {
  const { data } = await supabase
    .from("pagamentos")
    .select(COLUNAS)
    .eq("status", "pago")
    .not("devolver_motivo", "is", null)
    .order("pago_em", { ascending: false })
    .limit(100);
  return ((data ?? []) as unknown as Linha[]).map(paraAdmin);
}

/** Link de fatura do Asaas que pode ir para a tela (só https). */
export const linkSeguro = (link: string | null | undefined) => (link && /^https:\/\//.test(link) ? link : null);
