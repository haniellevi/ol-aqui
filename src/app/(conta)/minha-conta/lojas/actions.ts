"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { traduzirErro } from "@/lib/erros";
import { ehUuid } from "@/lib/formato";
import { numeroWhatsapp } from "@/lib/whatsapp/servico";
import { dddDaLoja, numeroComRegiao } from "@/lib/telefone-regiao";
import type { EstadoVitrine } from "../loja/vitrine-actions";

export type EstadoEquipe = { link?: string; erro?: string; ok?: string } | null;

export async function convidarGerente(loja: string, _: EstadoEquipe, form: FormData): Promise<EstadoEquipe> {
  if (!ehUuid(loja)) return { erro: "Informe um celular brasileiro com DDD." };
  const whatsapp = await numeroComRegiao(form.get("whatsapp"), () => dddDaLoja(loja), numeroWhatsapp);
  if (!whatsapp) return { erro: "Informe um celular brasileiro com DDD." };
  const db = await createClient();
  const { data, error } = await db.rpc("convidar_gerente_loja", { p_loja: loja, p_whatsapp: whatsapp });
  if (error || typeof data !== "string" || !ehUuid(data)) return { erro: traduzirErro(error).mensagem };
  revalidatePath(`/minha-conta/lojas/${loja}`);
  return { link: `/convite-loja?codigo=${data}` };
}

export async function revogarGerente(loja: string, convite: string): Promise<EstadoEquipe> {
  if (!ehUuid(loja) || !ehUuid(convite)) return { erro: "Convite inválido." };
  const db = await createClient();
  const { data, error } = await db.rpc("revogar_gerente_loja", { p_loja: loja, p_convite: convite });
  if (error || data !== true) return { erro: "Esse acesso já foi removido ou não está disponível." };
  revalidatePath(`/minha-conta/lojas/${loja}`);
  return { ok: "Acesso removido." };
}

export async function salvarVitrineGerenciada(loja: string, _: EstadoVitrine, form: FormData): Promise<EstadoVitrine> {
  if (!ehUuid(loja)) return { erro: "Loja inválida." };
  const campos = ["endereco", "lat", "lng", "horarios", "sobre", "faz_entrega", "entrega_obs"] as const;
  const dados = campos.map((campo) => form.get(campo));
  if (dados.some((valor) => typeof valor !== "string")) return { erro: "Atualize a página e tente novamente." };
  const [endereco, lat, lng, horarios, sobre, entrega, recado] = dados as string[];
  if (!["", "sim", "nao"].includes(entrega)) return { erro: "Escolha uma opção de entrega." };
  if (horarios.length > 2000) return { erro: "Confira os horários da loja." };
  let horario: unknown = null;
  try { horario = horarios.trim() ? JSON.parse(horarios) : null; }
  catch { return { erro: "Confira os horários da loja." }; }
  const latitude = lat.trim() ? Number(lat) : null;
  const longitude = lng.trim() ? Number(lng) : null;
  if ((latitude === null) !== (longitude === null) ||
      (latitude !== null && (!Number.isFinite(latitude) || Math.abs(latitude) > 90)) ||
      (longitude !== null && (!Number.isFinite(longitude) || Math.abs(longitude) > 180))) {
    return { erro: "Confira a localização.", campos: { localizacao: "Informe uma localização válida." } };
  }
  const db = await createClient();
  const { error } = await db.rpc("editar_loja_gerenciada", {
    p_loja: loja, p_endereco: endereco, p_lat: latitude, p_lng: longitude, p_horarios: horario,
    p_sobre: sobre, p_faz_entrega: entrega ? entrega === "sim" : null, p_entrega_obs: recado,
  });
  if (error) {
    const { mensagem, campo } = traduzirErro(error);
    return { erro: mensagem, campos: campo ? { [campo]: mensagem } : undefined };
  }
  revalidatePath(`/minha-conta/lojas/${loja}`);
  revalidatePath("/loja/[slug]", "page");
  return { ok: true };
}
