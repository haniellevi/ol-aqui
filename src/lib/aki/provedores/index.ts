import "server-only";
import type { ProvedorIA } from "@/lib/aki/tipos";
import type { ProvedorIAAdaptador } from "./base";
import { anthropic } from "./anthropic";
import { openai, openrouter } from "./openai";

export * from "./base";

const ADAPTADORES: Record<ProvedorIA, ProvedorIAAdaptador> = { anthropic, openai, openrouter };

/** Adaptador do provedor (null se o nome não for um dos três). */
export function adaptador(provedor: string | null | undefined): ProvedorIAAdaptador | null {
  return provedor && provedor in ADAPTADORES ? ADAPTADORES[provedor as ProvedorIA] : null;
}

/** Quais provedores têm chave na Vercel (o painel mostra; a chave em si nunca sai do servidor). */
export function chavesConfiguradas(): Record<ProvedorIA, boolean> {
  return { anthropic: anthropic.temChave(), openai: openai.temChave(), openrouter: openrouter.temChave() };
}
