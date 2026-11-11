"use server";
// Vitrine com IA, etapa 4: o lojista decide as sugestões da IA. O banco confere o dono,
// o congelamento do Compliance e se a categoria ainda está disponível.
import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { minhaVitrineCompleta } from "@/lib/dados/vitrine-completa";
import { traduzirErro } from "@/lib/erros";
import { ehUuid, linkLoja } from "@/lib/formato";
import type { Resultado } from "@/lib/tipos";

const SEM_LOGIN = { ok: false as const, erro: { mensagem: "Entre na sua conta para continuar.", codigo: "28000" } };
const FALHA = { ok: false as const, erro: { mensagem: "A conexão falhou. Tente novamente; repetir a ação é seguro." } };

async function minhaLoja() {
  const { userId } = await auth();
  if (!userId) return null;
  const v = await minhaVitrineCompleta(true);
  return v && v.tipo === "loja" && v.dono_id === userId ? v : undefined;
}

function atualizar(slug: string) {
  revalidatePath("/minha-conta/loja", "layout");
  revalidatePath("/minha-conta/anuncios");
  revalidatePath(linkLoja(slug));
}

export async function decidirCategoria(anuncioId: string, aceitar: boolean): Promise<Resultado> {
  if (!ehUuid(anuncioId) || typeof aceitar !== "boolean") return { ok: false, erro: { mensagem: "Escolha um produto e uma ação válidos." } };
  try {
    const v = await minhaLoja();
    if (v === null) return SEM_LOGIN;
    if (!v) return { ok: false, erro: { mensagem: "Só lojas têm vitrine para organizar." } };
    const db = await createClient();
    const { error } = await db.rpc("decidir_categoria_sugerida", { p_anuncio: anuncioId, p_aceitar: aceitar });
    if (error) return { ok: false, erro: traduzirErro(error) };
    atualizar(v.slug);
    return { ok: true, dados: undefined };
  } catch {
    return FALHA;
  }
}

export async function decidirTodasCategorias(aceitar: boolean): Promise<Resultado<{ decididas: number }>> {
  if (typeof aceitar !== "boolean") return { ok: false, erro: { mensagem: "Ação inválida." } };
  try {
    const v = await minhaLoja();
    if (v === null) return SEM_LOGIN;
    if (!v) return { ok: false, erro: { mensagem: "Só lojas têm vitrine para organizar." } };
    const db = await createClient();
    const { data, error } = await db.rpc("decidir_todas_categorias", { p_vitrine: v.id, p_aceitar: aceitar });
    if (error || typeof data !== "number") return { ok: false, erro: traduzirErro(error) };
    atualizar(v.slug);
    return { ok: true, dados: { decididas: data } };
  } catch {
    return FALHA;
  }
}

/** nichoId nulo = dispensar a sugestão sem escolher outro. */
export async function definirNicho(nichoId: string | null): Promise<Resultado> {
  if (nichoId !== null && !ehUuid(nichoId)) return { ok: false, erro: { mensagem: "Escolha um nicho da lista." } };
  try {
    const v = await minhaLoja();
    if (v === null) return SEM_LOGIN;
    if (!v) return { ok: false, erro: { mensagem: "Só lojas têm nicho." } };
    const db = await createClient();
    const { error } = await db.rpc("definir_nicho_loja", { p_vitrine: v.id, p_nicho: nichoId });
    if (error) return { ok: false, erro: traduzirErro(error) };
    atualizar(v.slug);
    return { ok: true, dados: undefined };
  } catch {
    return FALHA;
  }
}
