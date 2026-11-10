"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ehUuid } from "@/lib/formato";

export async function aceitarConviteGerente(codigo: string): Promise<string | null> {
  const mensagem = "O convite venceu, foi cancelado ou pertence a outro WhatsApp. Peça um novo link ao dono da loja.";
  if (!ehUuid(codigo)) return mensagem;
  const db = await createClient();
  const { data, error } = await db.rpc("convite_gerente_loja", { p_token: codigo, p_aceitar: true }).maybeSingle<{ loja_id: string }>();
  if (error) return "Não foi possível aceitar o convite agora. Tente novamente.";
  if (!data || !ehUuid(data.loja_id)) return mensagem;
  revalidatePath("/minha-conta/lojas");
  redirect(`/minha-conta/lojas/${data.loja_id}`);
}
