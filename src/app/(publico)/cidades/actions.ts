"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { COOKIE_CIDADE } from "@/lib/dados/regiao";
import { ehUuid } from "@/lib/formato";

export async function escolherCidade(form: FormData) {
  const id = String(form.get("cidade") ?? "");
  if (!ehUuid(id)) redirect("/cidades?erro=1");
  const db = await createClient();
  const { data, error } = await db.from("cidades").select("id,microrregioes!inner(ativa)")
    .eq("id", id).eq("ativa", true).eq("microrregioes.ativa", true).maybeSingle();
  if (error) throw new Error("Não foi possível trocar a cidade.");
  if (!data) redirect("/cidades?erro=1");
  (await cookies()).set(COOKIE_CIDADE, id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 });
  redirect("/");
}
