"use server";

import { revalidatePath } from "next/cache";
import { exigirTela } from "@/lib/admin/equipe";
import type { EstadoForm } from "@/lib/admin/estado";

const CODIGO = /^[a-z0-9_-]{2,40}$/;
const DOMINIO = /^[a-z0-9.-]{3,80}$/;

/** "instagram.com, l.instagram.com" → ["instagram.com", "l.instagram.com"] (sem www e sem https://). */
function dominios(bruto: FormDataEntryValue | null): string[] {
  return [...new Set(String(bruto ?? "")
    .split(/[\s,;]+/)
    .map((d) => d.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, ""))
    .filter((d) => DOMINIO.test(d)))].slice(0, 20);
}

/** Cria ou muda uma origem (nome, endereços que contam como ela, ordem, ligada). */
export async function salvarOrigem(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const { supabase } = await exigirTela("visitas");
  const nova = form.get("nova") === "1";
  const nome = String(form.get("nome") ?? "").trim().slice(0, 60);
  const ordem = Number(form.get("ordem") ?? 100);
  if (nome.length < 2) return { erro: "Dê um nome à origem." };
  const dados = {
    nome,
    dominios: dominios(form.get("dominios")),
    ordem: Number.isInteger(ordem) ? Math.min(Math.max(ordem, 0), 9999) : 100,
    ativa: form.get("ativa") !== "false",
  };
  if (nova) {
    const codigo = nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_-]/g, "").slice(0, 40);
    if (!CODIGO.test(codigo)) return { erro: "Use um nome com letras ou números." };
    const { error } = await supabase.from("origens_visita").insert({ codigo, ...dados });
    if (error) return { erro: error.code === "23505" ? "Já existe uma origem com esse nome." : "Não consegui salvar." };
  } else {
    const codigo = String(form.get("codigo") ?? "");
    if (!CODIGO.test(codigo)) return { erro: "Origem inválida." };
    if (["direto", "outro_site"].includes(codigo) && !dados.ativa) return { erro: "Essa origem é usada quando não se sabe de onde a pessoa veio. Ela não pode ser desligada." };
    const { error } = await supabase.from("origens_visita").update(dados).eq("codigo", codigo);
    if (error) return { erro: "Não consegui salvar." };
  }
  revalidatePath("/admin/visitas");
  return { ok: "Origem salva." };
}
