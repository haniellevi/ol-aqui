"use client";

import { lerProgresso, podeConcluir, type ProgressoAssistente } from "@/lib/assistente";

export const EVENTO_ASSISTENTE = "olaki:assistente";
const chave = (dono: string | null) => `olaki:assistente:${dono ?? "visitante"}`;

export function progressoAtual(dono: string | null) {
  try {
    return lerProgresso(localStorage.getItem(chave(dono)), dono);
  } catch {
    return null;
  }
}

export function salvarProgresso(dono: string | null, progresso: ProgressoAssistente | null) {
  try {
    if (progresso) localStorage.setItem(chave(dono), JSON.stringify(progresso));
    else localStorage.removeItem(chave(dono));
    window.dispatchEvent(new Event(EVENTO_ASSISTENTE));
  } catch {
    // O roteiro continua disponível quando o navegador bloqueia o armazenamento.
  }
}

export function concluirProgresso(dono: string | null, tentativa: string) {
  if (podeConcluir(progressoAtual(dono), tentativa)) salvarProgresso(dono, null);
}

const CONVITE = "olaki:assistente:convite";

export function conviteVisto() {
  try { return localStorage.getItem(CONVITE) === "1"; } catch { return false; }
}

export function marcarConviteVisto() {
  try { localStorage.setItem(CONVITE, "1"); } catch { /* A tela conserva a escolha durante a visita. */ }
}
