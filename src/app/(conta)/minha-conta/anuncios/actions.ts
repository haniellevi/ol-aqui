"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { meuAnuncio } from "@/lib/dados/anuncios";
import { traduzirErro } from "@/lib/erros";
import { ehUuid } from "@/lib/formato";
import type { MeuAnuncio, Resultado, StatusAnuncio } from "@/lib/tipos";

const NAO_ACHOU = { ok: false as const, erro: { mensagem: "Anúncio não encontrado." } };
const FALHA = { ok: false as const, erro: { mensagem: "Não foi possível confirmar a alteração. Tente novamente; repetir a ação é seguro." } };
type Banco = Awaited<ReturnType<typeof createClient>>;

async function alterar(id: string, executar: (db: Banco, a: MeuAnuncio) => Promise<Resultado<StatusAnuncio>>): Promise<Resultado<StatusAnuncio>> {
  if (!ehUuid(id)) return NAO_ACHOU;
  try {
    const { userId } = await auth();
    if (!userId) return { ok: false, erro: { mensagem: "Sua sessão terminou. Entre na conta para continuar.", codigo: "28000" } };
    const a = await meuAnuncio(id);
    if (!a) return NAO_ACHOU;
    const r = await executar(await createClient(), a);
    if (r.ok) {
      revalidatePath("/minha-conta");
      revalidatePath("/minha-conta/anuncios");
      revalidatePath("/");
      revalidatePath("/busca");
      revalidatePath("/anuncio/[idslug]", "page");
      revalidatePath("/loja/[slug]", "page");
    }
    return r;
  } catch (erro) {
    unstable_rethrow(erro);
    return FALHA;
  }
}

async function chamar(db: Banco, nome: string, args: Record<string, unknown>, permitidos: readonly StatusAnuncio[]): Promise<Resultado<StatusAnuncio>> {
  const { data, error } = await db.rpc(nome, args);
  if (error) return { ok: false, erro: traduzirErro(error) };
  if (!permitidos.includes(data)) return FALHA;
  return { ok: true, dados: data as StatusAnuncio };
}

export async function pausarAnuncio(id: string): Promise<Resultado<StatusAnuncio>> {
  return alterar(id, async (db, a) => {
    if (a.status === "pausado") return { ok: true, dados: "pausado" };
    if (a.status !== "ativo") return { ok: false, erro: { mensagem: "A situação deste anúncio mudou. Atualize a página antes de continuar." } };
    const { data, error } = await db.from("anuncios").update({ status: "pausado" }).eq("id", id).eq("status", "ativo").select("id");
    if (error) return { ok: false, erro: traduzirErro(error) };
    if (!data?.length) return FALHA;
    return { ok: true, dados: "pausado" };
  });
}

export async function reativarAnuncio(id: string): Promise<Resultado<StatusAnuncio>> {
  return alterar(id, (db) => chamar(db, "publicar_anuncio", { anuncio_id: id }, ["ativo", "em_analise"]));
}

export async function marcarVendido(id: string, peloOlaki: boolean): Promise<Resultado<StatusAnuncio>> {
  if (typeof peloOlaki !== "boolean") return { ok: false, erro: { mensagem: "Informe se a venda aconteceu pelo OLAKI." } };
  return alterar(id, (db, a) => a.status === "vendido"
    ? Promise.resolve({ ok: true, dados: "vendido" })
    : chamar(db, "marcar_vendido", { anuncio_id: id, pelo_olaki: peloOlaki }, ["vendido"]));
}

export async function moverParaLixeira(id: string): Promise<Resultado<StatusAnuncio>> {
  return alterar(id, (db) => chamar(db, "mover_anuncio_lixeira", { p_anuncio_id: id }, ["excluido"]));
}

export async function restaurarAnuncio(id: string): Promise<Resultado<StatusAnuncio>> {
  return alterar(id, (db) => chamar(db, "restaurar_anuncio", { p_anuncio_id: id }, ["rascunho", "pausado", "vendido", "em_analise", "congelado"]));
}
