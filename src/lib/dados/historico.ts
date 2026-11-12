import "server-only";
import { createClient } from "@/lib/supabase/server";
import { ehUuid } from "@/lib/formato";
import type { LinhaHistorico } from "@/lib/historico";

/** Histórico de um anúncio ou da loja (até 50 linhas, mais recente primeiro). Sem permissão → null. */
export async function lerHistorico(alvo: { anuncio: string } | { loja: string }, limite = 50): Promise<LinhaHistorico[] | null> {
  const id = "anuncio" in alvo ? alvo.anuncio : alvo.loja;
  if (!ehUuid(id)) return null;
  const db = await createClient();
  const { data, error } = await db.rpc("historico_alteracoes_ver", "anuncio" in alvo
    ? { p_anuncio: id, p_vitrine: null, p_limite: limite }
    : { p_anuncio: null, p_vitrine: id, p_limite: limite });
  if (error) {
    if (error.code === "42501") return null;
    throw new Error("Não foi possível carregar o histórico. Tente de novo.");
  }
  return Array.isArray(data) ? (data as LinhaHistorico[]) : [];
}

/** Última mudança de cada anúncio da minha loja (linha em Meus anúncios). Falha → mapa vazio (a linha só some). */
export async function ultimasMudancas(ids: string[]): Promise<Map<string, LinhaHistorico>> {
  const mapa = new Map<string, LinhaHistorico>();
  const validos = ids.filter(ehUuid).slice(0, 500);
  if (!validos.length) return mapa;
  const db = await createClient();
  const { data, error } = await db.rpc("ultimas_alteracoes_anuncios", { p_ids: validos });
  if (error || !Array.isArray(data)) return mapa;
  for (const linha of data as (LinhaHistorico & { anuncio_id: string })[]) mapa.set(linha.anuncio_id, linha);
  return mapa;
}
