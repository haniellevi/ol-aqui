"use server";

import { revalidatePath } from "next/cache";
import { telefoneComercialDigitado } from "@/lib/formato";
import { exigirAdmin } from "@/lib/admin/auth";
import { CHAVES_DE_MODELO, CHAVES_DE_PLANO, OPCOES_FIXAS, valorDoForm, type TipoValor } from "@/lib/admin/config";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { EstadoForm } from "@/lib/admin/estado";

export async function salvarConfig(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  try {
    const { supabase, userId } = await exigirAdmin();
    const id = String(form.get("id"));
    const { data: atual } = await supabase.from("configuracoes").select("chave").eq("id", id).single();
    const valor = valorDaConfig(atual?.chave ?? "", form);
    const recusa = await valorForaDaLista(supabase, atual?.chave ?? "", valor);
    if (recusa) return { erro: recusa };
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
    const valor = valorDaConfig(chave, form);
    const recusa = await valorForaDaLista(supabase, chave, valor);
    if (recusa) return { erro: recusa };
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

function valorDaConfig(chave: string, form: FormData): unknown {
  const texto = String(form.get("valor") ?? "");
  if (chave !== "contato.whatsapp_suporte") return valorDoForm(String(form.get("tipo")) as TipoValor, texto);
  if (!texto.trim()) return null;
  const numero = telefoneComercialDigitado(texto);
  if (!numero) throw new Error("Informe o WhatsApp do suporte com DDD.");
  return numero;
}

/** Recusa valores fora das opções permitidas (a tela usa lista de escolha, mas o servidor confere de novo). */
async function valorForaDaLista(supabase: SupabaseClient, chave: string, valor: unknown): Promise<string | null> {
  const fixas = OPCOES_FIXAS[chave];
  if (fixas) return fixas.some((o) => o.valor === valor) ? null : "Escolha uma das opções da lista.";
  if (CHAVES_DE_PLANO.has(chave)) {
    const { data } = await supabase.from("planos").select("codigo").eq("codigo", String(valor)).maybeSingle();
    return data ? null : "Esse plano não existe.";
  }
  if (CHAVES_DE_MODELO.has(chave)) {
    const { data } = await supabase.from("robo_modelos").select("modelo").eq("modelo", String(valor)).eq("ativo", true).limit(1);
    return data && data.length > 0 ? null : "Esse modelo não está ativo no catálogo do robô.";
  }
  return null;
}
