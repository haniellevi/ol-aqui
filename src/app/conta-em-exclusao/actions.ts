"use server";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function cancelarExclusao() {
  const { userId } = await auth();
  if (!userId) redirect("/entrar?redirect_url=%2Fconta-em-exclusao");
  const db = await createClient();
  const { error } = await db.rpc("cancelar_exclusao_conta");
  if (error) redirect("/conta-em-exclusao?erro=1");
  redirect("/minha-conta?aviso=exclusao_cancelada");
}
