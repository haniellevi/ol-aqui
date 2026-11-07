"use server";
// Tirar dos favoritos (T34). A RLS de favoritos só deixa apagar as linhas da própria pessoa.
import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { traduzirErro } from "@/lib/erros";
import { ehUuid } from "@/lib/formato";
import type { Resultado } from "@/lib/tipos";

export async function removerFavorito(anuncioId: string): Promise<Resultado> {
  const { userId } = await auth();
  if (!userId) return { ok: false, erro: { mensagem: "Entre na sua conta para continuar.", codigo: "28000" } };
  if (!ehUuid(anuncioId)) return { ok: false, erro: { mensagem: "Anúncio não encontrado." } };
  const db = await createClient();
  const { error } = await db.from("favoritos").delete().eq("usuario_id", userId).eq("anuncio_id", anuncioId);
  if (error) return { ok: false, erro: traduzirErro(error) };
  revalidatePath("/minha-conta/favoritos");
  return { ok: true, dados: undefined };
}
