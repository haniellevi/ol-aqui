import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { seguro } from "@/lib/dados/seguro";
import type { Vitrine } from "@/lib/tipos";

export const COLUNAS_VITRINE =
  "id, slug, nome, descricao, logo_url, capa_url, cidade, bairro, tipo, selo_loja_verificada, microrregiao_id, status, criado_em";

/**
 * Vitrine de LOJA pelo endereço mercadodaregiao.com.br/loja/<slug>. Pessoa física não tem página → null.
 * Loja suspensa/inadimplente só aparece para o dono (RLS); para os outros → null.
 */
export const vitrinePorSlug = cache(async (slug: string): Promise<Vitrine | null> => {
  const s = slug.trim().toLowerCase();
  if (!/^[a-z0-9-]{3,60}$/.test(s)) return null;
  return seguro(async () => {
    const db = await createClient();
    const { data, error } = await db
      .from("vitrines_lojas")
      .select(COLUNAS_VITRINE)
      .eq("slug", s)
      .eq("tipo", "loja")
      .maybeSingle<Vitrine>();
    return error || !data ? null : { ...data, whatsapp: null };
  }, null);
});

/** O endereço da loja está livre (ou já é do usuário)? Em erro responde false. */
export async function slugDisponivel(slug: string): Promise<boolean> {
  return seguro(async () => {
    const db = await createClient();
    const { data, error } = await db.rpc("slug_disponivel", { slug });
    return !error && data === true;
  }, false);
}
