"use server";
// Ações de "Meus anúncios" (T32, F8). Quem garante o dono é o banco:
// RLS de anuncios (só o dono edita/apaga) e as funções publicar_anuncio/marcar_vendido.
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { traduzirErro } from "@/lib/erros";
import { ehUuid } from "@/lib/formato";
import { apagarFoto } from "@/lib/dados/fotos";
import type { Resultado } from "@/lib/tipos";

const NAO_ACHOU = { ok: false as const, erro: { mensagem: "Anúncio não encontrado." } };

function atualizar() {
  revalidatePath("/minha-conta/anuncios");
  revalidatePath("/minha-conta");
}

/** Tira do ar por um tempo (ativo → pausado). */
export async function pausarAnuncio(id: string): Promise<Resultado> {
  if (!ehUuid(id)) return NAO_ACHOU;
  const db = await createClient();
  const { data, error } = await db.from("anuncios").update({ status: "pausado" }).eq("id", id).eq("status", "ativo").select("id");
  if (error) return { ok: false, erro: traduzirErro(error) };
  if (!data?.length) return NAO_ACHOU;
  atualizar();
  return { ok: true, dados: undefined };
}

/**
 * Volta para o ar (pausado/vencido → ativo). Passa pelo publicar_anuncio:
 * confere limite do plano, campos e moderação. Devolve "ativo" ou "em_analise".
 */
export async function reativarAnuncio(id: string): Promise<Resultado<string>> {
  if (!ehUuid(id)) return NAO_ACHOU;
  const db = await createClient();
  const { data, error } = await db.rpc("publicar_anuncio", { anuncio_id: id });
  if (error) return { ok: false, erro: traduzirErro(error) };
  atualizar();
  return { ok: true, dados: String(data ?? "ativo") };
}

/** F8 · "Vendi": pergunta se vendeu pelo OLAKI e tira da busca. */
export async function marcarVendido(id: string, peloOlaki: boolean): Promise<Resultado> {
  if (!ehUuid(id)) return NAO_ACHOU;
  const db = await createClient();
  const { error } = await db.rpc("marcar_vendido", { anuncio_id: id, pelo_olaki: peloOlaki });
  if (error) return { ok: false, erro: traduzirErro(error) };
  atualizar();
  return { ok: true, dados: undefined };
}

/** Apaga um rascunho (só rascunho; anúncio publicado se pausa ou marca como vendido). */
export async function excluirRascunho(id: string): Promise<Resultado> {
  if (!ehUuid(id)) return NAO_ACHOU;
  const db = await createClient();
  const { data, error } = await db.from("anuncios").delete().eq("id", id).eq("status", "rascunho").select("id, fotos");
  if (error) return { ok: false, erro: traduzirErro(error) };
  if (!data?.length) return NAO_ACHOU;
  // Limpa as fotos do Storage (só da pasta do próprio usuário; falha aqui não desfaz a exclusão)
  const fotos = ((data[0] as { fotos?: string[] | null }).fotos ?? []).filter(Boolean);
  await Promise.allSettled(fotos.map((f) => apagarFoto(f)));
  atualizar();
  return { ok: true, dados: undefined };
}
