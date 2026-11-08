import "server-only";
import { clerkClient } from "@clerk/nextjs/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { seguro } from "@/lib/dados/seguro";
import { ehPapel, type ContaEncontrada, type MembroEquipe, type Regiao } from "@/lib/tipos-equipe";

// Tela 14 · Equipe. Leituras com o token do administrador: as funções do banco (equipe_lista,
// equipe_buscar_conta) conferem e_admin() por dentro. Nada aqui usa a chave secreta do Supabase.

export async function listarEquipe(supabase: SupabaseClient): Promise<MembroEquipe[] | null> {
  return seguro(async () => {
    const { data, error } = await supabase.rpc("equipe_lista");
    if (error) return null;
    return ((data ?? []) as MembroEquipe[]).filter((m) => ehPapel(m.papel));
  }, null);
}

export async function listarRegioes(supabase: SupabaseClient): Promise<Regiao[]> {
  return seguro(async () => {
    const { data } = await supabase.from("microrregioes").select("id, nome").order("nome");
    return (data ?? []) as Regiao[];
  }, []);
}

export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Ids do Clerk das contas com este e-mail (o e-mail fica no Clerk, não no banco).
 * Sem CLERK_SECRET_KEY ou com o Clerk fora do ar: `null` (a tela avisa que a busca por e-mail não deu).
 */
export async function idsPeloEmail(email: string): Promise<string[] | null> {
  if (!process.env.CLERK_SECRET_KEY) return null;
  try {
    const { data } = await (await clerkClient()).users.getUserList({ emailAddress: [email], limit: 5 });
    return data.map((u) => u.id);
  } catch {
    return null;
  }
}

/**
 * E-mails da conta no Clerk (o banco não guarda e-mail). `null` = não deu para saber agora
 * (sem CLERK_SECRET_KEY ou Clerk fora do ar); lista vazia = conta sem e-mail ou já apagada no Clerk.
 */
export async function emailsDaConta(usuarioId: string): Promise<string[] | null> {
  if (!process.env.CLERK_SECRET_KEY) return null;
  try {
    const u = await (await clerkClient()).users.getUser(usuarioId);
    return u.emailAddresses.map((e) => e.emailAddress);
  } catch (e) {
    // conta apagada no Clerk: 404
    if (typeof e === "object" && e && "status" in e && (e as { status?: number }).status === 404) return [];
    return null;
  }
}

export type ResultadoBuscaConta = { contas: ContaEncontrada[]; emailIndisponivel?: boolean; erro?: string };

/** Busca uma conta que já existe pelo celular, nome ou e-mail. */
export async function buscarContas(supabase: SupabaseClient, termo: string): Promise<ResultadoBuscaConta> {
  const t = termo.trim().slice(0, 120);
  if (EMAIL.test(t)) {
    const ids = await idsPeloEmail(t.toLowerCase());
    if (ids === null) return { contas: [], emailIndisponivel: true };
    if (ids.length === 0) return { contas: [] };
    const { data, error } = await supabase.rpc("equipe_buscar_conta", { p_busca: null, p_ids: ids });
    if (error) return { contas: [], erro: "Não deu para buscar agora. Tente de novo." };
    return { contas: (data ?? []) as ContaEncontrada[] };
  }
  const { data, error } = await supabase.rpc("equipe_buscar_conta", { p_busca: t, p_ids: null });
  if (error) return { contas: [], erro: "Não deu para buscar agora. Tente de novo." };
  return { contas: (data ?? []) as ContaEncontrada[] };
}
