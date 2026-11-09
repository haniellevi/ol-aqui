"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { garantirPerfil } from "@/lib/perfil";
import { ehFavorito } from "@/lib/dados/favoritos";
import { ehUuid } from "@/lib/formato";
import type { Resultado } from "@/lib/tipos";

/** Define um estado, em vez de alternar no banco: repetir a mesma ação é seguro. */
export async function definirFavorito(anuncioId: string, salvar: boolean): Promise<Resultado<{ favorito: boolean }>> {
  if (!ehUuid(anuncioId) || typeof salvar !== "boolean") return { ok: false, erro: { mensagem: "Escolha um anúncio e uma ação válidos." } };
  try {
    const { userId } = await auth();
    if (!userId) return { ok: false, erro: { mensagem: "Entre na sua conta para continuar.", codigo: "28000" } };
    if (salvar) await garantirPerfil();
    const db = await createClient();
    if (salvar) {
      const { error } = await db.from("favoritos").insert({ usuario_id: userId, anuncio_id: anuncioId });
      if (error && error.code !== "23505") {
        return { ok: false, erro: { mensagem: error.code === "42501" || error.code === "23503" ? "Este anúncio não está disponível para salvar. Atualize a página." : "Não conseguimos salvar o favorito. Tente novamente." } };
      }
    } else {
      const { error } = await db.from("favoritos").delete().eq("usuario_id", userId).eq("anuncio_id", anuncioId);
      if (error) return { ok: false, erro: { mensagem: "Não conseguimos remover o favorito. Tente novamente." } };
    }
    const favorito = await ehFavorito(anuncioId, userId);
    if (favorito !== salvar) return { ok: false, erro: { mensagem: "Não conseguimos confirmar a alteração. Atualize a página e tente novamente." } };
    revalidatePath("/minha-conta/favoritos");
    revalidatePath("/anuncio/[idslug]", "page");
    return { ok: true, dados: { favorito } };
  } catch {
    return { ok: false, erro: { mensagem: "A conexão falhou. Tente novamente; repetir a ação é seguro." } };
  }
}

export async function removerFavorito(anuncioId: string): Promise<Resultado> {
  const r = await definirFavorito(anuncioId, false);
  return r.ok ? { ok: true, dados: undefined } : r;
}
