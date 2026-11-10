"use server";

import { auth } from "@clerk/nextjs/server";
import { responderAtendimento } from "@/lib/aki/atendimento";
import { traduzirErro } from "@/lib/erros";
import { ehUuid } from "@/lib/formato";
import { createClient } from "@/lib/supabase/server";
import type { Resultado } from "@/lib/tipos";

export async function enviarMensagemAtendimento(conversa: string, chave: string, texto: string, aoAki: boolean): Promise<Resultado> {
  const { userId } = await auth();
  if (!userId) return { ok: false, erro: { mensagem: "Entre na sua conta para enviar." } };
  if (!ehUuid(conversa) || !ehUuid(chave) || typeof texto !== "string" || !texto.trim() || texto.length > 2000) {
    return { ok: false, erro: { mensagem: "Escreva uma mensagem de até 2000 caracteres." } };
  }
  try {
    const db = await createClient();
    const { data, error } = await db.rpc("enviar_mensagem_atendimento", {
      p_conversa: conversa, p_chave: chave, p_texto: texto, p_aki: aoAki === true,
    });
    if (error) return { ok: false, erro: traduzirErro(error) };
    if (!Number.isSafeInteger(data) || data <= 0) return { ok: false, erro: { mensagem: "Não foi possível confirmar o envio. Tente novamente." } };
    if (aoAki === true) await responderAtendimento(db, userId, data);
    return { ok: true, dados: undefined };
  } catch {
    return { ok: false, erro: { mensagem: "Não foi possível confirmar o envio. Tente novamente." } };
  }
}
