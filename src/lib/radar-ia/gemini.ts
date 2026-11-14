import "server-only";
import { MODELO_IA_PADRAO, ajustesDoModelo } from "@/lib/ia-modelos";
import { modeloDoRecurso } from "@/lib/ia-modelos-servidor";

// IA do Radar que ESCREVE (perguntas e a frase de 1 linha), via OpenRouter. O modelo é o escolhido
// no painel (ia.modelo.radar); o nome do arquivo ficou do Gemini, o primeiro modelo usado aqui.
// Mesmo protocolo de src/lib/verificacao-loja/ia.ts: sem retenção, sem fallback, resposta estrita,
// e aqui com prazo curto (3 s): demorou, o Radar segue sem IA.

export const MODELO_RADAR = MODELO_IA_PADRAO;
const ENDERECO = "https://openrouter.ai/api/v1/chat/completions";
export const PRAZO_IA_MS = 3000;
const MAX_CORPO = 100_000;

export type ResultadoGemini<T> =
  | { ok: true; valor: T; custoUsd: number; tokensEntrada: number; tokensSaida: number }
  | { ok: false; falha: string; custoUsd: number | null };

export type PedidoGemini<T> = {
  nome: string;
  sistema: string;
  usuario: string;
  esquema: object;
  validar: (v: unknown) => T;
};

function inteiro(v: unknown): number {
  return Number.isSafeInteger(v) && (v as number) >= 0 ? (v as number) : 0;
}

export async function perguntarGemini<T>(p: PedidoGemini<T>): Promise<ResultadoGemini<T>> {
  const chave = process.env.OPENROUTER_API_KEY;
  if (!chave) return { ok: false, falha: "ia_desligada", custoUsd: 0 };
  const modelo = await modeloDoRecurso("radar");
  let custo: number | null = null;
  let falha = "resposta_invalida";
  try {
    const r = await fetch(ENDERECO, {
      method: "POST", signal: AbortSignal.timeout(PRAZO_IA_MS), cache: "no-store", redirect: "error",
      headers: { "content-type": "application/json", authorization: `Bearer ${chave}` },
      body: JSON.stringify({
        model: modelo, stream: false, max_tokens: 400, ...ajustesDoModelo("radar", modelo, 0),
        provider: { require_parameters: true, data_collection: "deny", zdr: true, allow_fallbacks: false,
          max_price: { prompt: 0.2, completion: 0.8, request: 0 } },
        messages: [{ role: "system", content: p.sistema }, { role: "user", content: p.usuario }],
        response_format: { type: "json_schema", json_schema: { name: p.nome, strict: true, schema: p.esquema } },
      }),
    });
    if (!r.ok) {
      if ([400, 401, 402, 403, 404, 422, 429].includes(r.status)) custo = 0;
      falha = `provedor_http_${r.status}`;
      throw new Error(falha);
    }
    if (Number(r.headers.get("content-length") ?? 0) > MAX_CORPO) throw new Error("resposta_grande");
    const texto = await r.text();
    if (texto.length > MAX_CORPO) throw new Error("resposta_grande");
    const corpo = JSON.parse(texto);
    const c = corpo?.usage?.cost;
    if (typeof c === "number" && Number.isFinite(c) && c >= 0 && c <= 0.05) custo = c;
    const escolha = corpo?.choices?.[0];
    const chamadas = escolha?.message?.tool_calls;
    if (escolha?.finish_reason !== "stop" || escolha.message?.refusal
      || (chamadas != null && (!Array.isArray(chamadas) || chamadas.length > 0)) || custo === null) throw new Error("resposta_incompleta");
    const valor = p.validar(JSON.parse(escolha.message.content));
    return { ok: true, valor, custoUsd: custo, tokensEntrada: inteiro(corpo.usage?.prompt_tokens), tokensSaida: inteiro(corpo.usage?.completion_tokens) };
  } catch (e) {
    if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")) falha = "tempo_esgotado";
    return { ok: false, falha, custoUsd: custo };
  }
}

/** Texto que a IA devolve para a tela: sem link, e-mail ou telefone. */
export function textoSeguro(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.replace(/\s+/g, " ").trim();
  if (!t || t.length > max) return null;
  // Sem contato nem site: link, e-mail, telefone (8+ dígitos, com ou sem traço), domínio e encurtador.
  if (/https?:|www\.|@|wa\.me|(\d[\s().-]{0,2}){8,}/i.test(t)) return null;
  if (/\b[a-z0-9-]+\.(com|net|org|br|me|ly|app|io|shop|store|link|site|online)\b/i.test(t)) return null;
  return t;
}
