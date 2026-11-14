import "server-only";
import { cache } from "react";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { ehUuid } from "@/lib/formato";

export type AtalhoLoja = { href: string; rotulo: string; id: string | null };

// A RPC inclui lojas próprias e gerenciadas, sem confundir uma vitrine individual com uma loja.
export const atalhoLoja = cache(async (): Promise<AtalhoLoja | null> => {
  try {
    if (!(await auth()).userId) return null;
    const { data, error } = await (await createClient()).rpc("minhas_lojas");
    if (error || !Array.isArray(data)) return null;
    const lojas = data.filter((loja: { id?: unknown }) => typeof loja.id === "string" && ehUuid(loja.id));
    if (!lojas.length) return null;
    return lojas.length === 1
      ? { href: "/minha-conta/loja", rotulo: "Minha loja", id: lojas[0].id }
      : { href: "/minha-conta/lojas", rotulo: "Minhas lojas", id: null };
  } catch {
    // Páginas fora do middleware de login também usam o cabeçalho.
    return null;
  }
});
