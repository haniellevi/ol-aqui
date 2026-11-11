import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ehUuid } from "@/lib/formato";
import type {
  FiltrosRelatorio,
  Funil,
  LinhaAnuncios,
  LinhaConversao,
  LinhaCustoAki,
  LinhaReceita,
  RelatorioId,
  Relatorios,
  TipoReceita,
} from "@/lib/tipos-relatorios";

// Tela 15 · Relatórios. Tudo pelas funções relatorio_* do banco (SECURITY DEFINER, conferem e_admin
// e devolvem só números somados), sempre com o token do admin. Período no fuso de Fortaleza, no máximo 12 meses.

export const RELATORIOS: readonly RelatorioId[] = ["funil", "anuncios", "conversao", "receita", "aki"];

export const NOME_RELATORIO: Record<RelatorioId, string> = {
  funil: "Funil",
  anuncios: "Anúncios por categoria e cidade",
  conversao: "Teste grátis para plano pago",
  receita: "Receita por tipo",
  aki: "Custo do robô Merc",
};

export const NOME_TIPO_RECEITA: Record<TipoReceita, string> = { assinatura: "Plano", anuncio_avulso: "Anúncio avulso", destaque: "Destaque" };
export const TIPOS_RECEITA: readonly TipoReceita[] = ["assinatura", "anuncio_avulso", "destaque"];

/** Maior período aceito pelo banco (relatorio_periodo): 366 dias entre "de" e "até". */
export const MAX_DIAS = 366;

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const um = (v: string | string[] | undefined | null) => (Array.isArray(v) ? v[0] : v) ?? "";
/** Só datas que existem no calendário: 2026-02-31 não passa (o Date do JavaScript viraria 03/03). */
const dataValida = (t: string) => {
  if (!DATA.test(t)) return null;
  const x = new Date(`${t}T00:00:00Z`);
  return !Number.isNaN(x.getTime()) && x.toISOString().slice(0, 10) === t ? t : null;
};

/** Hoje em Fortaleza (AAAA-MM-DD). */
export const hojeFortaleza = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza" }).format(new Date());

/** Soma dias a uma data AAAA-MM-DD. */
export function somarDias(d: string, dias: number): string {
  const x = new Date(`${d}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + dias);
  return x.toISOString().slice(0, 10);
}

const diasEntre = (de: string, ate: string) => Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86_400_000);

/** Atalhos de período (chips da tela). */
export function atalhosPeriodo(hoje = hojeFortaleza()): { id: string; nome: string; de: string; ate: string }[] {
  return [
    { id: "30d", nome: "Últimos 30 dias", de: somarDias(hoje, -29), ate: hoje },
    { id: "mes", nome: "Este mês", de: `${hoje.slice(0, 8)}01`, ate: hoje },
    { id: "3m", nome: "Últimos 3 meses", de: somarDias(hoje, -89), ate: hoje },
    { id: "12m", nome: "Últimos 12 meses", de: somarDias(hoje, -364), ate: hoje },
  ];
}

/**
 * Filtros do endereço. Sem datas: últimos 30 dias. Datas trocadas são desviradas e período maior que
 * 12 meses é encurtado (o banco recusaria); `aviso` explica o que mudou.
 */
export function lerFiltrosRelatorio(sp: Record<string, string | string[] | undefined> | URLSearchParams): {
  filtros: FiltrosRelatorio;
  aviso: string | null;
} {
  const pegar = (k: string) => (sp instanceof URLSearchParams ? sp.get(k) ?? "" : um(sp[k]));
  const hoje = hojeFortaleza();
  const ateTexto = pegar("ate");
  const deTexto = pegar("de");
  let ate = dataValida(ateTexto) ?? hoje;
  let de = dataValida(deTexto) ?? somarDias(ate, -29);
  let aviso: string | null =
    (ateTexto && !dataValida(ateTexto)) || (deTexto && !dataValida(deTexto))
      ? "Uma das datas não existe no calendário. Mostramos o período padrão no lugar dela."
      : null;
  if (de > ate) {
    [de, ate] = [ate, de];
    aviso = 'A data "de" era depois da data "até": trocamos as duas.';
  }
  if (diasEntre(de, ate) > MAX_DIAS) {
    de = somarDias(ate, -364);
    aviso = "O relatório mostra no máximo 12 meses de cada vez. Mostramos os 12 meses até a data final.";
  }
  const regiao = pegar("regiao");
  return { filtros: { de, ate, regiao: ehUuid(regiao) ? regiao : null }, aviso };
}

/** Os mesmos filtros como texto de endereço (links do CSV e dos atalhos). */
export function filtrosNoEndereco(f: FiltrosRelatorio, extra: Record<string, string> = {}): string {
  const q = new URLSearchParams({ ...extra, de: f.de, ate: f.ate });
  if (f.regiao) q.set("regiao", f.regiao);
  return q.toString();
}

const n = (v: unknown) => {
  const x = Number(v ?? 0);
  return Number.isFinite(x) ? x : 0;
};

const args = (f: FiltrosRelatorio) => ({ p_de: f.de, p_ate: f.ate, p_regiao: f.regiao });

async function chamar<T>(supabase: SupabaseClient, funcao: string, f: FiltrosRelatorio): Promise<T[] | null> {
  try {
    const { data, error } = await supabase.rpc(funcao, args(f));
    if (error) return null;
    return (data ?? []) as T[];
  } catch {
    return null;
  }
}

export async function lerFunil(supabase: SupabaseClient, f: FiltrosRelatorio): Promise<Funil | null> {
  const linhas = await chamar<Record<string, unknown>>(supabase, "relatorio_funil", f);
  const l = linhas?.[0];
  if (!l) return linhas ? { visualizacoes: 0, cliques_whatsapp: 0, compartilhamentos: 0, vendidos: 0, vendidos_pelo_olaki: 0, vendidos_fora: 0, vendidos_sem_resposta: 0 } : null;
  return {
    visualizacoes: n(l.visualizacoes),
    cliques_whatsapp: n(l.cliques_whatsapp),
    compartilhamentos: n(l.compartilhamentos),
    vendidos: n(l.vendidos),
    vendidos_pelo_olaki: n(l.vendidos_pelo_olaki),
    vendidos_fora: n(l.vendidos_fora),
    vendidos_sem_resposta: n(l.vendidos_sem_resposta),
  };
}

export async function lerAnuncios(supabase: SupabaseClient, f: FiltrosRelatorio): Promise<LinhaAnuncios[] | null> {
  const linhas = await chamar<Record<string, unknown>>(supabase, "relatorio_anuncios", f);
  return (
    linhas?.map((l) => ({
      categoria_id: (l.categoria_id as string | null) ?? null,
      categoria: String(l.categoria ?? "Sem categoria"),
      cidade: String(l.cidade ?? "—"),
      no_ar: n(l.no_ar),
      publicados: n(l.publicados),
    })) ?? null
  );
}

export async function lerConversao(supabase: SupabaseClient, f: FiltrosRelatorio): Promise<LinhaConversao[] | null> {
  const linhas = await chamar<Record<string, unknown>>(supabase, "relatorio_conversao_teste", f);
  return (
    linhas?.map((l) => ({
      mes: String(l.mes),
      comecaram: n(l.comecaram),
      pagaram: n(l.pagaram),
      em_teste: n(l.em_teste),
      nao_pagaram: n(l.nao_pagaram),
    })) ?? null
  );
}

export async function lerReceita(supabase: SupabaseClient, f: FiltrosRelatorio): Promise<LinhaReceita[] | null> {
  const linhas = await chamar<Record<string, unknown>>(supabase, "relatorio_receita", f);
  return (
    linhas?.map((l) => ({
      mes: String(l.mes),
      tipo: l.tipo as TipoReceita,
      quantidade: n(l.quantidade),
      total_centavos: n(l.total_centavos),
    })) ?? null
  );
}

export async function lerCustoAki(supabase: SupabaseClient, f: FiltrosRelatorio): Promise<LinhaCustoAki[] | null> {
  const linhas = await chamar<Record<string, unknown>>(supabase, "relatorio_custo_aki", f);
  return (
    linhas?.map((l) => ({
      mes: String(l.mes),
      respostas: n(l.respostas),
      conversas: n(l.conversas),
      erros: n(l.erros),
      custo_centavos: n(l.custo_centavos),
    })) ?? null
  );
}

/** Todos os relatórios de uma vez. Um que falhar volta null (a tela mostra "não deu para ler"). */
export async function lerRelatorios(supabase: SupabaseClient, f: FiltrosRelatorio): Promise<Relatorios> {
  const [funil, anuncios, conversao, receita, aki] = await Promise.all([
    lerFunil(supabase, f),
    lerAnuncios(supabase, f),
    lerConversao(supabase, f),
    lerReceita(supabase, f),
    lerCustoAki(supabase, f),
  ]);
  return { funil, anuncios, conversao, receita, aki };
}

/* ------------------------------- Somas ------------------------------- */

/** Soma das linhas por uma chave (ex.: anúncios por categoria ou por cidade), maior primeiro. */
export function somarPor<T>(linhas: T[], chave: (l: T) => string, valores: (l: T) => number[]): { nome: string; valores: number[] }[] {
  const mapa = new Map<string, number[]>();
  for (const l of linhas) {
    const k = chave(l);
    const v = valores(l);
    const atual = mapa.get(k) ?? v.map(() => 0);
    mapa.set(k, atual.map((x, i) => x + v[i]));
  }
  return [...mapa.entries()].map(([nome, valores]) => ({ nome, valores })).sort((a, b) => b.valores[0] - a.valores[0] || a.nome.localeCompare(b.nome));
}

/** Receita agrupada por mês com uma coluna por tipo. */
export function receitaPorMes(linhas: LinhaReceita[]): { mes: string; tipos: Record<TipoReceita, number>; total: number }[] {
  const mapa = new Map<string, Record<TipoReceita, number>>();
  for (const l of linhas) {
    const atual = mapa.get(l.mes) ?? { assinatura: 0, anuncio_avulso: 0, destaque: 0 };
    if (l.tipo in atual) atual[l.tipo] += l.total_centavos;
    mapa.set(l.mes, atual);
  }
  return [...mapa.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, tipos]) => ({ mes, tipos, total: tipos.assinatura + tipos.anuncio_avulso + tipos.destaque }));
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
/** "2026-11-01" → "nov/2026". */
export const nomeMes = (mes: string) => `${MESES[Number(mes.slice(5, 7)) - 1] ?? mes.slice(5, 7)}/${mes.slice(0, 4)}`;
/** "2026-11-08" → "08/11/2026". */
export const dataBr = (d: string) => d.split("-").reverse().join("/");
