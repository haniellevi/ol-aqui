import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

// Webhook de entrada da Evolution (WhatsApp): quem responde SAIR deixa de receber o aviso do Radar.
// O segredo vem em Authorization: Bearer <EVOLUTION_WEBHOOK_SEGREDO> (32 caracteres ou mais).

export const COMANDOS_SAIDA = ["SAIR", "PARAR", "STOP", "CANCELAR"] as const;
export type ComandoSaida = (typeof COMANDOS_SAIDA)[number];

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

/** "sair", " Sair! " e "SAIR" valem. Frase com outras palavras não vale. */
export function comandoDeSaida(texto: unknown): ComandoSaida | null {
  if (typeof texto !== "string" || texto.length > 40) return null;
  const limpo = texto.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().replace(/[.!]+$/, "").toUpperCase();
  return (COMANDOS_SAIDA as readonly string[]).includes(limpo) ? (limpo as ComandoSaida) : null;
}

/** Só conversa de pessoa (@s.whatsapp.net) com celular brasileiro. Grupo, lista ou número estranho: null. */
export function numeroDoRemetente(remoteJid: unknown): string | null {
  if (typeof remoteJid !== "string") return null;
  const m = /^(\d+)@s\.whatsapp\.net$/.exec(remoteJid);
  if (!m) return null;
  return /^55[1-9]\d9?\d{8}$/.test(m[1]) ? m[1] : null;
}

/** Só mensagem recebida (messages.upsert). Outros eventos e mensagens que nós enviamos (fromMe) não valem. */
export function pedidoDeSaida(corpo: unknown): { numero: string; comando: ComandoSaida } | null {
  if (!corpo || typeof corpo !== "object") return null;
  const { event, data } = corpo as { event?: unknown; data?: unknown };
  if (typeof event !== "string" || event.toLowerCase().replace(/_/g, ".") !== "messages.upsert") return null;
  if (!data || typeof data !== "object") return null;
  const { key, message } = data as {
    key?: { remoteJid?: unknown; fromMe?: unknown };
    message?: { conversation?: unknown; extendedTextMessage?: { text?: unknown } };
  };
  if (key?.fromMe !== false) return null;
  const comando = comandoDeSaida(message?.conversation ?? message?.extendedTextMessage?.text);
  const numero = numeroDoRemetente(key?.remoteJid);
  return comando && numero ? { numero, comando } : null;
}
