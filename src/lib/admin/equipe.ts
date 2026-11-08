import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { garantirPerfil } from "@/lib/perfil";
import { ehPapel, podeVerTela, type Papel, type TelaAdmin } from "@/lib/tipos-equipe";

/**
 * Papel de quem está no painel (administrador, moderador, financeiro, suporte, franqueado) ou nulo.
 * Lido do banco (meu_papel) uma vez por requisição. Esconder a tela é conforto: quem barra é o banco.
 */
const papelDaSessao = cache(async (): Promise<{ papel: Papel | null; userId: string }> => {
  const { userId } = await auth();
  if (!userId) redirect("/entrar?redirect_url=/admin");
  await garantirPerfil();
  const supabase = await createClient();
  const { data } = await supabase.rpc("meu_papel");
  return { papel: ehPapel(data) ? data : null, userId };
});

/** Qualquer pessoa ativa da equipe (layout do painel). Quem não é da equipe recebe 404. */
export async function exigirEquipe() {
  const { papel, userId } = await papelDaSessao();
  if (!papel) notFound(); // não revela que a área existe
  return { supabase: await createClient(), userId, papel };
}

/** Só quem tem esta tela no papel. Os outros recebem 404 (o banco recusa de qualquer jeito). */
export async function exigirTela(tela: TelaAdmin) {
  const { papel, userId } = await papelDaSessao();
  if (!papel || !podeVerTela(papel, tela)) notFound();
  return { supabase: await createClient(), userId, papel };
}

/** IP de quem usa o painel, do cabeçalho da Vercel (vai para o registro do Compliance). */
export async function ipDoNavegador(): Promise<string | null> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "").trim().slice(0, 100);
  return ip || null;
}
