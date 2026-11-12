import "server-only";
import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { garantirPerfil } from "@/lib/perfil";

/**
 * Garante que quem está na página/ação é administrador.
 * É só conforto de navegação: a proteção real são as regras de RLS no banco (função e_admin()).
 */
export async function exigirAdmin() {
  const { userId } = await auth();
  if (!userId) redirect("/entrar?redirect_url=/admin");
  await garantirPerfil();

  const supabase = await createClient();
  const { data: admin } = await supabase.rpc("e_admin");
  if (admin !== true) notFound(); // não revela que a área existe
  return { supabase, userId };
}

/** O admin logado é super admin (Etapa P5a)? Só para mostrar ou esconder botões: o banco confere de novo. */
export async function eSuperAdmin(supabase: Awaited<ReturnType<typeof createClient>>): Promise<boolean> {
  const { data, error } = await supabase.rpc("e_super_admin");
  return !error && data === true;
}

/** Ação só do super admin: quem não é recebe 404, como em exigirAdmin. */
export async function exigirSuperAdmin() {
  const r = await exigirAdmin();
  if (!(await eSuperAdmin(r.supabase))) notFound();
  return r;
}
