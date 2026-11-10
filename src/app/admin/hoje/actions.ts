"use server";

import { revalidatePath } from "next/cache";
import { exigirTela } from "@/lib/admin/equipe";
import type { EstadoForm } from "@/lib/admin/estado";

const TIPOS = new Set(["cobranca_vencida", "teste_acabando", "funil", "radar_sem_proposta", "loja_sem_anuncio"]);

/** Adia o acompanhamento até amanhã, quando volta se o problema continuar. */
export async function marcarFeito(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const { supabase } = await exigirTela("hoje");
  const tipo = String(form.get("tipo") ?? "");
  const alvo = String(form.get("alvo") ?? "").slice(0, 60);
  if (!TIPOS.has(tipo) || !alvo) return { erro: "Tarefa inválida." };
  const { error } = await supabase.from("hoje_feitas").upsert({ tipo, alvo_id: alvo }, { onConflict: "tipo,alvo_id,dia", ignoreDuplicates: true });
  if (error) return { erro: "Não consegui adiar agora. Tente de novo." };
  revalidatePath("/admin/hoje");
  return { ok: "Adiado até amanhã." };
}

/** Desfaz os adiamentos de hoje (todos os acompanhamentos voltam). */
export async function desfazerFeitas(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const { supabase } = await exigirTela("hoje");
  const dia = String(form.get("dia") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return { erro: "Dia inválido." };
  const { error } = await supabase.from("hoje_feitas").delete().eq("dia", dia);
  if (error) return { erro: "Não consegui desfazer agora." };
  revalidatePath("/admin/hoje");
  return { ok: "As tarefas voltaram." };
}
