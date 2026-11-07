"use server";
// Meus dados: nome, cidade e bairro do perfil. O celular e a foto são do Clerk.
// A RLS só deixa editar o próprio perfil; o gatilho do banco protege selos, admin e região.
import { revalidatePath } from "next/cache";
import { auth, currentUser } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { listarCidades } from "@/lib/dados/regiao";
import { meuPerfilEVitrine } from "@/lib/dados/conta";
import { traduzirErro } from "@/lib/erros";

export type EstadoDados = { ok?: boolean; erro?: string; campos?: Record<string, string> } | null;

export async function salvarDados(_antes: EstadoDados, form: FormData): Promise<EstadoDados> {
  const { userId } = await auth();
  if (!userId) return { erro: "Entre na sua conta para continuar." };

  const nome = String(form.get("nome") ?? "").replace(/\s+/g, " ").trim();
  const cidade = String(form.get("cidade") ?? "").trim();
  const bairro = String(form.get("bairro") ?? "").replace(/\s+/g, " ").trim();

  const conta = await meuPerfilEVitrine();
  if (!conta) return { erro: "Não conseguimos abrir sua conta agora. Tente de novo." };
  const cidades = await listarCidades(conta.perfil.microrregiao_id);

  const campos: Record<string, string> = {};
  if (nome.length < 2 || nome.length > 120) campos.nome = "Escreva seu nome (de 2 a 120 letras).";
  if (cidade && cidades.length > 0 && !cidades.some((c) => c.nome === cidade)) campos.cidade = "Escolha uma cidade da lista.";
  if (bairro.length > 80) campos.bairro = "Bairro muito longo (até 80 letras).";
  if (Object.keys(campos).length) return { erro: "Confira os campos marcados.", campos };

  // A foto mostrada no site é a do Clerk (trocada em "Mudar foto ou celular").
  const usuario = await currentUser();
  const db = await createClient();
  const { error } = await db
    .from("perfis")
    .update({ nome, cidade: cidade || null, bairro: bairro || null, ...(usuario?.imageUrl ? { avatar_url: usuario.imageUrl } : {}) })
    .eq("id", userId);
  if (error) {
    const e = traduzirErro(error);
    return { erro: e.mensagem, campos: e.campo ? { [e.campo]: e.mensagem } : undefined };
  }
  revalidatePath("/minha-conta", "layout");
  return { ok: true };
}
