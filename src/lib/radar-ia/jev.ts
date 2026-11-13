import "server-only";
import { PRAZO_IA_MS } from "./gemini";

// IA do Radar que JULGA (pedido vago? anúncio novo combina?): JEV, da TypeSafe.
// Mesmo formato de src/lib/sugestao-categoria-ia.ts. Sem chave, erro ou demora: null.

export const MODELO_JEV = "jev-latest";
const ENDERECO = "https://api.typesafe.ai/v1/systemone";
/** Custo estimado de uma chamada (o JEV não devolve o custo). */
export const CUSTO_JEV_USD = 0.0002;

export type PedidoJev = { estado: Record<string, string>; instrucao: string; criterios: Record<string, string> };

/** Chance de cada opção (só as opções pedidas, números de 0 a 1). */
export async function perguntarJev(p: PedidoJev): Promise<Record<string, number> | null> {
  const chave = process.env.TYPESAFE_API_KEY;
  const opcoes = Object.keys(p.criterios);
  if (!chave || opcoes.length < 2 || opcoes.length > 255) return null;
  try {
    const r = await fetch(ENDERECO, {
      method: "POST", signal: AbortSignal.timeout(PRAZO_IA_MS), cache: "no-store", redirect: "error",
      headers: { "content-type": "application/json", authorization: `Bearer ${chave}` },
      body: JSON.stringify({
        model: MODELO_JEV,
        state: p.estado,
        questions: { resposta: { type: "choice", instructions: p.instrucao, criteria: p.criterios } },
      }),
    });
    if (!r.ok) return null;
    const texto = await r.text();
    if (texto.length > 100_000) return null;
    const chances = JSON.parse(texto)?.answers?.resposta?.probabilities;
    if (!chances || typeof chances !== "object" || Array.isArray(chances)) return null;
    const saida: Record<string, number> = {};
    for (const o of opcoes) {
      const v = (chances as Record<string, unknown>)[o];
      if (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1) saida[o] = v;
    }
    return Object.keys(saida).length ? saida : null;
  } catch {
    return null;
  }
}
