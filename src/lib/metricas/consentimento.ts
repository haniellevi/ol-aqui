export const CHAVE_CONSENTIMENTO = "mr_privacidade_v1";
export const EVENTO_CONSENTIMENTO = "mr:privacidade";
export type Preferencia = { v: 1; estatistica: boolean; marketing: boolean };
export const NEGADO: Preferencia = { v: 1, estatistica: false, marketing: false };

export function lerPreferencia(valor: string | null | undefined): Preferencia {
  try {
    const p = JSON.parse(valor ?? "null");
    if (p?.v === 1) return { v: 1, estatistica: p.estatistica === true, marketing: p.marketing === true };
  } catch { /* inválido equivale a ausência */ }
  return { ...NEGADO };
}
