"use server";

import { revalidatePath } from "next/cache";
import { exigirAdmin } from "@/lib/admin/auth";
import { centavosDe, inteiroOuNulo } from "@/lib/admin/formato";
import type { EstadoForm } from "@/lib/admin/estado";

function lerPlano(form: FormData) {
  const preco = centavosDe(form.get("preco"));
  const dias = inteiroOuNulo(form.get("periodo_dias"));
  return {
    nome: String(form.get("nome") ?? "").trim(),
    descricao: String(form.get("descricao") ?? "").trim() || null,
    publico: String(form.get("publico") ?? "todos"),
    preco_centavos: preco ?? 0,
    periodo_dias: dias ?? 30,
    limite_anuncios: inteiroOuNulo(form.get("limite_anuncios")),
    acesso_radar: form.get("acesso_radar") === "on",
    propostas_radar_mes: inteiroOuNulo(form.get("propostas_radar_mes")),
    ordem: inteiroOuNulo(form.get("ordem")) ?? 0,
    ativo: form.get("ativo") === "on",
  };
}

export async function salvarPlano(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  try {
    const { supabase, userId } = await exigirAdmin();
    const codigo = String(form.get("codigo"));
    const dados = lerPlano(form);
    if (!dados.nome) return { erro: "Dê um nome ao plano." };
    const { error } = await supabase
      .from("planos")
      .update({ ...dados, atualizado_em: new Date().toISOString(), atualizado_por: userId })
      .eq("codigo", codigo);
    if (error) return { erro: error.message };
    revalidatePath("/admin", "layout");
    revalidatePath("/radar");
    return { ok: "Plano salvo. Vale para novas assinaturas." };
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Erro ao salvar." };
  }
}

export async function criarPlano(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  try {
    const { supabase, userId } = await exigirAdmin();
    const codigo = String(form.get("codigo") ?? "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
    if (!/^[a-z0-9_]{2,30}$/.test(codigo)) return { erro: "Código inválido. Use letras, números e _ (ex.: ouro)." };
    const dados = lerPlano(form);
    if (!dados.nome) return { erro: "Dê um nome ao plano." };
    const { error } = await supabase.from("planos").insert({ codigo, ...dados, atualizado_por: userId });
    if (error) return { erro: error.code === "23505" ? "Já existe um plano com esse código." : error.message };
    revalidatePath("/admin/planos");
    return { ok: `Plano "${dados.nome}" criado.` };
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Erro ao criar." };
  }
}
