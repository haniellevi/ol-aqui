"use server";

import { revalidatePath } from "next/cache";
import { exigirAdmin } from "@/lib/admin/auth";
import { valorDoForm, type TipoValor } from "@/lib/admin/config";
import type { EstadoForm } from "@/lib/admin/estado";

export async function salvarConfig(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  try {
    const { supabase, userId } = await exigirAdmin();
    const id = String(form.get("id"));
    const valor = valorDoForm(String(form.get("tipo")) as TipoValor, String(form.get("valor") ?? ""));
    const { error } = await supabase
      .from("configuracoes")
      .update({ valor, atualizado_em: new Date().toISOString(), atualizado_por: userId })
      .eq("id", id);
    if (error) return { erro: error.message };
    revalidatePath("/", "layout");
    return { ok: "Salvo." };
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Erro ao salvar." };
  }
}

/** Cria uma exceção da configuração para uma microrregião (ex.: preço de lançamento em Corrente). */
export async function criarExcecao(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  try {
    const { supabase, userId } = await exigirAdmin();
    const chave = String(form.get("chave"));
    const microrregiao_id = String(form.get("microrregiao_id"));
    if (!microrregiao_id) return { erro: "Escolha a região." };
    const valor = valorDoForm(String(form.get("tipo")) as TipoValor, String(form.get("valor") ?? ""));
    const { data: base } = await supabase.from("configuracoes").select("grupo, descricao, publico").eq("chave", chave).is("microrregiao_id", null).single();
    const { error } = await supabase
      .from("configuracoes")
      .insert({ chave, microrregiao_id, valor, grupo: base?.grupo, descricao: base?.descricao, publico: base?.publico, atualizado_por: userId });
    if (error) return { erro: error.code === "23505" ? "Essa região já tem uma exceção para esta configuração." : error.message };
    revalidatePath("/", "layout");
    return { ok: "Exceção criada para a região." };
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Erro ao criar." };
  }
}

export async function removerExcecao(form: FormData) {
  const { supabase } = await exigirAdmin();
  await supabase.from("configuracoes").delete().eq("id", String(form.get("id"))).not("microrregiao_id", "is", null);
  revalidatePath("/", "layout");
}
