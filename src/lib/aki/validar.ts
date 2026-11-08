// Conferência dos argumentos que chegam da IA (ou de volta do navegador). Nada aqui confia no que veio:
// todo texto é cortado, todo número é conferido. Serve no servidor e no navegador.
import type { DadosPedidoRadar } from "@/lib/aki/tipos";

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const ehId = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v);

/** Texto limpo (espaços juntados), cortado em `max`. Vazio ou não-texto → null. */
export function texto(v: unknown, max: number, multilinha = false): string | null {
  if (typeof v !== "string") return null;
  const t = multilinha
    ? v.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim()
    : v.replace(/\s+/g, " ").trim();
  return t ? t.slice(0, max) : null;
}

/** Valor em reais (número ou texto "8.500,00") → centavos. Inválido, negativo ou absurdo → null. */
export function centavosDeReais(v: unknown, maxReais = 1_000_000_000): number | null {
  let n: number;
  if (typeof v === "number") n = v;
  else if (typeof v === "string") {
    const limpo = v.replace(/[^\d,.-]/g, "");
    n = Number(limpo.includes(",") ? limpo.replace(/\./g, "").replace(",", ".") : limpo);
  } else return null;
  if (!Number.isFinite(n) || n <= 0 || n > maxReais) return null;
  return Math.round(n * 100);
}

export function escolha<T extends string>(v: unknown, opcoes: readonly T[]): T | null {
  return typeof v === "string" && (opcoes as readonly string[]).includes(v) ? (v as T) : null;
}

export const CATEGORIAS_RADAR = ["imovel", "veiculo", "movel", "geral"] as const;
export const URGENCIAS_RADAR = ["normal", "esta_semana", "hoje"] as const;

/** Confere um pedido do Radar (mesmas regras da tabela radar_pedidos). */
export function validarPedidoRadar(d: unknown): { ok: true; dados: DadosPedidoRadar } | { ok: false; erro: string } {
  const o = (d && typeof d === "object" ? d : {}) as Record<string, unknown>;
  const titulo = texto(o.titulo, 120);
  if (!titulo || titulo.length < 8) return { ok: false, erro: "Escreva o que você procura com pelo menos 8 letras." };
  const cidade = texto(o.cidade, 80);
  if (!cidade) return { ok: false, erro: "Falta a cidade do pedido." };
  const preco = o.preco_max_centavos;
  const precoOk = preco === null || preco === undefined || (typeof preco === "number" && Number.isInteger(preco) && preco > 0 && preco <= 100_000_000_000);
  if (!precoOk) return { ok: false, erro: "Confira o preço máximo." };
  return {
    ok: true,
    dados: {
      titulo,
      detalhes: texto(o.detalhes, 1000, true),
      preco_max_centavos: typeof preco === "number" ? preco : null,
      cidade,
      urgencia: escolha(o.urgencia, URGENCIAS_RADAR) ?? "normal",
      categoria: escolha(o.categoria, CATEGORIAS_RADAR) ?? "geral",
    },
  };
}
