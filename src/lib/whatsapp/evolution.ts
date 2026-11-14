import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

// Webhook de entrada da Evolution (WhatsApp): quem pede para sair deixa de receber o aviso do Radar.
// O segredo vem em Authorization: Bearer <EVOLUTION_WEBHOOK_SEGREDO> (32 caracteres ou mais).

export const COMANDOS_SAIDA = ["SAIR", "PARAR", "STOP", "CANCELAR"] as const;
export type ComandoSaida = (typeof COMANDOS_SAIDA)[number];

// Frases de saída já normalizadas (sem acento, minúsculas, sem pontuação). Cada uma guarda um dos quatro comandos do banco.
const TERMOS_SAIDA: ReadonlyArray<readonly [string, ComandoSaida]> = [
  ["sair", "SAIR"],
  ["parar", "PARAR"],
  ["pare", "PARAR"],
  ["para de", "PARAR"],
  ["stop", "STOP"],
  ["cancelar", "CANCELAR"],
  ["descadastrar", "SAIR"],
  ["nao quero mais", "SAIR"],
  ["remover", "SAIR"],
];
// Mensagem de saída tem no máximo 4 palavras. Com mais que isso é conversa ("vou sair de casa agora pra loja").
const MAX_PALAVRAS_SAIDA = 4;
const MAX_CARACTERES_SAIDA = 80;

/** Segredo do webhook. Sem ele, ou curto demais, o webhook responde 503 e não aceita nada. */
export function segredoEvolution(): string | null {
  const segredo = process.env.EVOLUTION_WEBHOOK_SEGREDO?.trim();
  return segredo && segredo.length >= 32 ? segredo : null;
}

/** Confere o cabeçalho em tempo constante (resumo sha256: mesmo tamanho sempre). */
export function cabecalhoEvolutionConfere(recebido: string | null, segredo: string | null): boolean {
  if (!segredo || !recebido) return false;
  const hash = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(hash(recebido), hash(`Bearer ${segredo}`));
}

/** Sem acento, minúsculo, pontuação e símbolos viram espaço. "SAIR!" vira "sair"; "Pare, por favor" vira "pare por favor". */
export function normalizarTextoSaida(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * Pedido de saída: a frase inteira é um termo, ou tem até 4 palavras e contém um termo como palavra inteira.
 * "quero sair" e "pare por favor" valem. "parabéns" (não é "pare") e "vou sair de casa agora pra loja" não valem.
 */
export function comandoDeSaida(texto: unknown): ComandoSaida | null {
  if (typeof texto !== "string" || texto.length > MAX_CARACTERES_SAIDA) return null;
  const normal = normalizarTextoSaida(texto);
  if (!normal) return null;
  const palavras = normal.split(" ");
  if (palavras.length > MAX_PALAVRAS_SAIDA) return null;
  for (const [termo, comando] of TERMOS_SAIDA) {
    const partes = termo.split(" ");
    for (let i = 0; i + partes.length <= palavras.length; i++) {
      if (partes.every((parte, j) => palavras[i + j] === parte)) return comando;
    }
  }
  return null;
}

/** Só conversa de pessoa (@s.whatsapp.net) com celular brasileiro. Grupo, lista ou número estranho: null. */
export function numeroDoRemetente(remoteJid: unknown): string | null {
  if (typeof remoteJid !== "string") return null;
  const m = /^(\d+)@s\.whatsapp\.net$/.exec(remoteJid);
  if (!m) return null;
  return /^55[1-9]\d9?\d{8}$/.test(m[1]) ? m[1] : null;
}

/** Número de um campo alternativo: "5589...@s.whatsapp.net" ou só os dígitos. Mesma regra de numeroDoRemetente. */
function numeroDeCampoAlternativo(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  return numeroDoRemetente(`${valor.trim().replace(/@s\.whatsapp\.net$/, "")}@s.whatsapp.net`);
}

/**
 * Número da conversa. Conversa com identificador @lid (a Evolution v2 pode mandar só o identificador oculto):
 * o número real vem em remoteJidAlt ou senderPn. Aceitamos os dois, nessa ordem. Grupo (@g.us) não entra.
 */
export function numeroDaConversa(key: { remoteJid?: unknown; remoteJidAlt?: unknown; senderPn?: unknown }): string | null {
  if (typeof key.remoteJid === "string" && key.remoteJid.endsWith("@lid")) {
    return numeroDeCampoAlternativo(key.remoteJidAlt) ?? numeroDeCampoAlternativo(key.senderPn);
  }
  return numeroDoRemetente(key.remoteJid);
}

/** Só mensagem recebida (messages.upsert). Outros eventos e mensagens que nós enviamos (fromMe) não valem. */
export function pedidoDeSaida(corpo: unknown): { numero: string; comando: ComandoSaida } | null {
  if (!corpo || typeof corpo !== "object") return null;
  const { event, data } = corpo as { event?: unknown; data?: unknown };
  if (typeof event !== "string" || event.toLowerCase().replace(/_/g, ".") !== "messages.upsert") return null;
  if (!data || typeof data !== "object") return null;
  const { key, message } = data as {
    key?: { remoteJid?: unknown; remoteJidAlt?: unknown; senderPn?: unknown; fromMe?: unknown };
    message?: { conversation?: unknown; extendedTextMessage?: { text?: unknown } };
  };
  if (!key || key.fromMe !== false) return null;
  const comando = comandoDeSaida(message?.conversation ?? message?.extendedTextMessage?.text);
  const numero = numeroDaConversa(key);
  return comando && numero ? { numero, comando } : null;
}
