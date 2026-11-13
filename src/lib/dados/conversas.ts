import "server-only";
import { cache } from "react";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { seguro } from "@/lib/dados/seguro";
import { ehUuid } from "@/lib/formato";
import type { DetalheConversa, MensagemConversa, MensagemConversaAdmin, ResumoConversa } from "@/lib/tipos-conversas";

// Leituras das Conversas. O banco só devolve o que a pessoa pode ver (quem participa da conversa).

/** Chave conversas.ativa do painel (desligada até o "sim" do Raniel). */
export const conversasLigadas = cache(async (): Promise<boolean> =>
  seguro(async () => {
    const db = await createClient();
    const { data, error } = await db.rpc("conversas_ligadas");
    return !error && data === true;
  }, false),
);

export const minhasConversas = cache(async (): Promise<ResumoConversa[]> => {
  const { userId } = await auth();
  if (!userId) return [];
  return seguro(async () => {
    const db = await createClient();
    const { data, error } = await db.rpc("minhas_conversas");
    return !error && Array.isArray(data) ? (data as ResumoConversa[]) : [];
  }, []);
});

export const detalheConversa = cache(async (id: string): Promise<DetalheConversa | null> => {
  const { userId } = await auth();
  if (!userId || !ehUuid(id)) return null;
  return seguro(async () => {
    const db = await createClient();
    const { data, error } = await db.rpc("conversa_detalhe", { p_conversa: id });
    return !error && Array.isArray(data) && data[0] ? (data[0] as DetalheConversa) : null;
  }, null);
});

export const mensagensDaConversa = cache(async (id: string): Promise<MensagemConversa[]> => {
  const { userId } = await auth();
  if (!userId || !ehUuid(id)) return [];
  return seguro(async () => {
    const db = await createClient();
    const { data, error } = await db.rpc("conversa_mensagens_de", { p_conversa: id, p_depois: null });
    return !error && Array.isArray(data) ? (data as MensagemConversa[]) : [];
  }, []);
});

/** Bolinha do ícone Conversas. Lança erro para a rota responder 503 (o ícone esconde a bolinha). */
export async function conversasNaoLidas(): Promise<number> {
  const { userId } = await auth();
  if (!userId) throw new Error("Entre na sua conta.");
  const db = await createClient();
  const { data, error } = await db.rpc("conversas_nao_lidas");
  if (error || typeof data !== "number" || !Number.isSafeInteger(data) || data < 0) throw new Error("Não foi possível contar as conversas.");
  return data;
}

/** Leitura da equipe (só conversa denunciada; o banco registra cada leitura). */
export async function lerConversaAdmin(id: string): Promise<{ ok: true; mensagens: MensagemConversaAdmin[] } | { ok: false; erro: string }> {
  if (!ehUuid(id)) return { ok: false, erro: "Conversa não encontrada." };
  const db = await createClient();
  const { data, error } = await db.rpc("admin_ler_conversa", { p_conversa: id });
  if (error) return { ok: false, erro: error.code === "42501" ? "Só dá para ler conversa denunciada." : "Não foi possível abrir a conversa agora." };
  return { ok: true, mensagens: Array.isArray(data) ? (data as MensagemConversaAdmin[]) : [] };
}
