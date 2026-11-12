"use server";
// Etapa P5c: o super admin monta uma loja escondida e convida o dono para receber.

import { redirect, unstable_rethrow } from "next/navigation";
import { revalidatePath } from "next/cache";
import { exigirSuperAdmin } from "@/lib/admin/auth";
import { textoForm } from "@/lib/admin/gestao";
import { ehUuid, urlAbsoluta } from "@/lib/formato";
import { traduzirErro } from "@/lib/erros";
import { numeroWhatsapp } from "@/lib/whatsapp/servico";
import type { EstadoForm } from "@/lib/admin/estado";

export type EstadoConviteDono = { erro?: string; link?: string; whatsapp?: string } | null;

export async function montarLoja(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  try {
    const { supabase } = await exigirSuperAdmin();
    const regiao = textoForm(form, "microrregiao_id");
    if (!ehUuid(regiao)) return { erro: "Escolha a região e a cidade da loja." };
    const { data, error } = await supabase.rpc("super_montar_loja", {
      p_nome: textoForm(form, "nome"), p_slug: textoForm(form, "slug"), p_regiao: regiao, p_cidade: textoForm(form, "cidade"),
    });
    if (error || typeof data !== "string" || !ehUuid(data)) return { erro: traduzirErro(error).mensagem };
    revalidatePath("/admin/lojas");
    redirect(`/admin/lojas/${data}`);
  } catch (e) {
    unstable_rethrow(e);
    return { erro: e instanceof Error ? e.message : "Não foi possível montar a loja." };
  }
}

export async function convidarDono(loja: string, _: EstadoConviteDono, form: FormData): Promise<EstadoConviteDono> {
  const whatsapp = numeroWhatsapp(form.get("whatsapp"));
  if (!ehUuid(loja) || !whatsapp) return { erro: "Informe o celular do dono com DDD." };
  const { supabase } = await exigirSuperAdmin();
  const { data, error } = await supabase.rpc("super_convidar_dono", { p_loja: loja, p_whatsapp: whatsapp });
  if (error || typeof data !== "string" || !ehUuid(data)) return { erro: traduzirErro(error).mensagem };
  revalidatePath(`/admin/lojas/${loja}`);
  return { link: urlAbsoluta(`/receber-loja?codigo=${data}`), whatsapp };
}

export async function cancelarConviteDono(loja: string): Promise<EstadoForm> {
  if (!ehUuid(loja)) return { erro: "Loja inválida." };
  const { supabase } = await exigirSuperAdmin();
  const { error } = await supabase.rpc("super_cancelar_convite_dono", { p_loja: loja });
  if (error) return { erro: traduzirErro(error).mensagem };
  revalidatePath(`/admin/lojas/${loja}`);
  return { ok: "Convite cancelado. O link antigo não vale mais." };
}
