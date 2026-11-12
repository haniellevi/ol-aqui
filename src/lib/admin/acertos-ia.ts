import type { SupabaseClient } from "@supabase/supabase-js";

// Painel "Acertos da IA" (categorias, etapa 2): lê admin_acertos_categoria_ia (o banco confere se é admin)
// e deixa os números prontos para a tela. Resposta estranha do banco vira "falhou", nunca número inventado.

export const PERIODOS_ACERTOS = [7, 30, 90] as const;
export type PeriodoAcertos = (typeof PERIODOS_ACERTOS)[number];

export type SugestaoGuardada = { id: string; chance: number };
export type ErroIA = {
  anuncio_id: string;
  texto: string;
  sugestoes: SugestaoGuardada[];
  escolhida_id: string;
  escolhida_em: string;
  entre_as_3: boolean;
};
export type AcertosIA = {
  dias: number;
  total: number;
  acertou_1: number;
  acertou_3: number;
  sem_sugestao: number;
  erros: ErroIA[];
};

/** Período da URL: 7, 30 ou 90; qualquer outra coisa vira 30. */
export function periodoAcertos(valor: unknown): PeriodoAcertos {
  const n = Number(typeof valor === "string" ? valor : NaN);
  return (PERIODOS_ACERTOS as readonly number[]).includes(n) ? (n as PeriodoAcertos) : 30;
}

const inteiroOk = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
const textoOk = (v: unknown): v is string => typeof v === "string" && v.length > 0;

function lerSugestoes(v: unknown): SugestaoGuardada[] | null {
  if (!Array.isArray(v) || v.length > 3) return null;
  const saida: SugestaoGuardada[] = [];
  for (const s of v) {
    if (!s || typeof s !== "object" || !textoOk(s.id) || typeof s.chance !== "number" || !(s.chance >= 0 && s.chance <= 1)) return null;
    saida.push({ id: s.id, chance: s.chance });
  }
  return saida;
}

/** Confere a forma do que o banco devolveu. Qualquer peça fora do lugar: null. */
export function lerResposta(dados: unknown): AcertosIA | null {
  if (!dados || typeof dados !== "object" || Array.isArray(dados)) return null;
  const d = dados as Record<string, unknown>;
  if (![d.dias, d.total, d.acertou_1, d.acertou_3, d.sem_sugestao].every(inteiroOk) || !Array.isArray(d.erros)) return null;
  const total = d.total as number;
  const acertou1 = d.acertou_1 as number;
  const acertou3 = d.acertou_3 as number;
  if (acertou1 > acertou3 || acertou3 > total || (d.sem_sugestao as number) > total) return null;
  const erros: ErroIA[] = [];
  for (const e of d.erros as unknown[]) {
    if (!e || typeof e !== "object") return null;
    const x = e as Record<string, unknown>;
    const sugestoes = lerSugestoes(x.sugestoes);
    if (!sugestoes || !textoOk(x.anuncio_id) || !textoOk(x.texto) || !textoOk(x.escolhida_id) || !textoOk(x.escolhida_em) || typeof x.entre_as_3 !== "boolean") return null;
    erros.push({ anuncio_id: x.anuncio_id, texto: x.texto, sugestoes, escolhida_id: x.escolhida_id, escolhida_em: x.escolhida_em, entre_as_3: x.entre_as_3 });
  }
  return { dias: d.dias as number, total, acertou_1: acertou1, acertou_3: acertou3, sem_sugestao: d.sem_sugestao as number, erros };
}

export async function lerAcertosIA(db: SupabaseClient, dias: PeriodoAcertos): Promise<AcertosIA | null> {
  const { data, error } = await db.rpc("admin_acertos_categoria_ia", { p_dias: dias });
  return error ? null : lerResposta(data);
}

/** "De 100": parte de um total, arredondada. Sem casos: "—". */
export function porcentagem(parte: number, total: number): string {
  return total > 0 ? `${Math.round((parte / total) * 100)}%` : "—";
}

/** Chance da IA como a tela mostra: "83%"; abaixo de 1%, "menos de 1%". */
export function chanceEmTexto(chance: number): string {
  const p = Math.round(chance * 100);
  return p < 1 ? "menos de 1%" : `${p}%`;
}
