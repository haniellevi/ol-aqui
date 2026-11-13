import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Toda chamada à IA do Radar passa pelo livro-caixa: o banco decide se pode (chaves, 20 usos por dia,
// teto do mês) e guarda a reserva; no fim gravamos o custo real. Sem reserva, a IA nem é chamada.

export type ParteIA = "perguntas" | "parecidos" | "vitrine" | "novidades";
export type RodadaIA<T> = { valor: T; custoUsd: number | null; tokensEntrada: number; tokensSaida: number; falha: string | null };

function idDoUso(v: unknown): number | null {
  const n = typeof v === "string" && /^\d+$/.test(v) ? Number(v) : v;
  return typeof n === "number" && Number.isSafeInteger(n) && n > 0 ? n : null;
}

/** Roda `fn` só se o banco reservar. Falha, erro ou sem reserva: null. */
export async function comReserva<T>(usuario: string | null, parte: ParteIA, fn: () => Promise<RodadaIA<T>>): Promise<T | null> {
  let db: ReturnType<typeof supabaseAdmin>;
  try {
    db = supabaseAdmin();
  } catch {
    return null;
  }
  const { data, error } = await db.rpc("radar_ia_reservar", { p_usuario: usuario, p_parte: parte });
  const uso = error ? null : idDoUso(data);
  if (uso === null) return null;
  let r: RodadaIA<T>;
  try {
    r = await fn();
  } catch {
    r = { valor: null as T, custoUsd: null, tokensEntrada: 0, tokensSaida: 0, falha: "erro_interno" };
  }
  try {
    await db.rpc("radar_ia_concluir", {
      p_uso: uso, p_custo_usd: r.custoUsd, p_tokens_entrada: r.tokensEntrada, p_tokens_saida: r.tokensSaida, p_erro: r.falha,
    });
  } catch {
    // o livro-caixa fica com a reserva (custo estimado): nunca trava a pessoa
  }
  return r.falha ? null : r.valor;
}

export type EstadoIA = Record<ParteIA, boolean>;
const DESLIGADA: EstadoIA = { perguntas: false, parecidos: false, vitrine: false, novidades: false };

/** Quais partes da IA estão ligadas (chave geral E chave da parte). Qualquer erro: tudo desligado. */
export async function estadoRadarIA(): Promise<EstadoIA> {
  try {
    const { data, error } = await supabaseAdmin().rpc("radar_ia_estado");
    if (error || !data || typeof data !== "object") return DESLIGADA;
    const d = data as Record<string, unknown>;
    return { perguntas: d.perguntas === true, parecidos: d.parecidos === true, vitrine: d.vitrine === true, novidades: d.novidades === true };
  } catch {
    return DESLIGADA;
  }
}
