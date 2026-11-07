import "server-only";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Garante que quem está na página/ação é administrador.
 * É só conforto de navegação: a proteção real são as regras de RLS no banco (função e_admin()).
 */
export async function exigirAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar?voltar=/admin");

  const { data: admin } = await supabase.rpc("e_admin");
  if (admin !== true) notFound(); // não revela que a área existe
  return { supabase, user };
}
