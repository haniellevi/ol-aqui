import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { seguro } from "@/lib/dados/seguro";

/**
 * Lê uma configuração do painel (public.config: região → global → padrão).
 * Guardada durante a requisição. Em erro devolve o padrão (a tela nunca quebra por isso).
 */
export const lerConfig = cache(async function lerConfig<T = unknown>(
  chave: string,
  microrregiaoId: string | null = null,
  padrao: T | null = null,
): Promise<T | null> {
  return seguro(async () => {
    const db = await createClient();
    const { data, error } = await db.rpc("config_publica", { p_chave: chave, p_microrregiao: microrregiaoId, p_padrao: padrao });
    if (error) return padrao;
    return (data ?? padrao) as T | null;
  }, padrao);
}) as <T = unknown>(chave: string, microrregiaoId?: string | null, padrao?: T | null) => Promise<T | null>;

/** Configuração numérica (ex.: "anuncio.fotos_minimo"). Valor que não é número → null. */
export async function lerConfigNumero(chave: string, microrregiaoId: string | null = null): Promise<number | null> {
  const v = await lerConfig<unknown>(chave, microrregiaoId);
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}
