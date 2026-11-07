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
