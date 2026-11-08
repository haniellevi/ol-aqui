"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirTela } from "@/lib/admin/equipe";
import { traduzirErro } from "@/lib/erros";
import { ehUuid } from "@/lib/formato";
import { supabaseAdmin } from "@/lib/supabase/admin";

type Decisao = "aprovar" | "recusar" | "congelar";

// Tela 4 · Moderação. Quem pode é o banco: moderar_anuncio, moderar_pedido, resolver_denuncia,
// moderar_banner_vitrine e moderar_radar aceitam administrador e moderador; congelar_anuncio, só o
// administrador (Compliance). Cada mudança fica em logs_atividade com quem fez.

/** Volta para a tela com um aviso no topo (erro do banco em texto simples, sem detalhe técnico). */
function voltar(falha: string | null, aviso?: string): never {
  revalidatePath("/admin", "layout");
  const q = falha ? `falha=${encodeURIComponent(falha.slice(0, 200))}` : `aviso=${encodeURIComponent(aviso ?? "Feito.")}`;
  redirect(`/admin/moderacao?${q}`);
}

export async function decidirAnuncio(form: FormData): Promise<void> {
  const { supabase } = await exigirTela("moderacao");
  const id = String(form.get("id") ?? "");
  const decisao = String(form.get("decisao")) as Decisao;
  const motivo = String(form.get("motivo") ?? "").trim().slice(0, 300);
  if (!ehUuid(id)) voltar("Anúncio não encontrado.");

  const { error } =
    decisao === "congelar"
      ? await supabase.rpc("congelar_anuncio", { p_anuncio_id: id, p_motivo: motivo || "Congelado pelo Compliance" })
      : await supabase.rpc("moderar_anuncio", { p_id: id, p_decisao: decisao, p_motivo: motivo || null });
  if (error) voltar(traduzirErro(error).mensagem);
  if (decisao === "congelar") {
    // congelar (só administrador) não fecha as denúncias sozinho: ficam como procedentes
    const { userId } = await exigirTela("moderacao");
    await supabase
      .from("denuncias")
      .update({ status: "procedente", resolvido_por: userId, resolvido_em: new Date().toISOString() })
      .eq("alvo_tipo", "anuncio")
      .eq("alvo_id", id)
      .eq("status", "aberta");
  }
  voltar(null, decisao === "aprovar" ? "Anúncio aprovado." : decisao === "recusar" ? "Anúncio recusado." : "Anúncio congelado.");
}

export async function decidirPedido(form: FormData): Promise<void> {
  const { supabase } = await exigirTela("moderacao");
  const id = String(form.get("id") ?? "");
  const aprovar = form.get("decisao") === "aprovar";
  const motivo = String(form.get("motivo") ?? "").trim().slice(0, 300);
  if (!ehUuid(id)) voltar("Pedido não encontrado.");
  const { error } = await supabase.rpc("moderar_pedido", { p_id: id, p_decisao: aprovar ? "aprovar" : "recusar", p_motivo: motivo || null });
  if (error) voltar(traduzirErro(error).mensagem);
  revalidatePath("/radar", "layout");
  voltar(null, aprovar ? "Pedido aprovado." : "Pedido recusado.");
}

export async function resolverDenuncia(form: FormData): Promise<void> {
  const { supabase } = await exigirTela("moderacao");
  const id = String(form.get("id") ?? "");
  if (!ehUuid(id)) voltar("Denúncia não encontrada.");
  const procede = form.get("procedente") === "sim";
  const { error } = await supabase.rpc("resolver_denuncia", { p_id: id, p_procedente: procede });
  if (error) voltar(traduzirErro(error).mensagem);
  voltar(null, procede ? "Denúncia marcada como procedente." : "Denúncia marcada como não procedente.");
}

/**
 * Tira a foto do banner de uma loja (volta para o banner modelo) e grava o motivo, que o dono vê
 * em "Minha loja". O banco guarda o endereço tirado (o dono não grava a mesma foto de novo) e a
 * mudança fica no histórico (logs_atividade). Depois o arquivo sai do Storage: sem a chave secreta
 * no servidor, o arquivo fica, mas a foto já saiu da vitrine.
 */
export async function tirarFotoBanner(form: FormData): Promise<void> {
  const { supabase } = await exigirTela("moderacao");
  const id = String(form.get("id") ?? "");
  const motivo = String(form.get("motivo") ?? "").trim().slice(0, 300);
  const { data, error } = await supabase.rpc("moderar_banner_vitrine", { p_vitrine: id, p_motivo: motivo || null });
  if (error) throw new Error(error.message);
  const caminho = caminhoNoBucket(typeof data === "string" ? data : null);
  if (caminho) {
    try {
      await supabaseAdmin().storage.from("anuncios").remove([caminho]);
    } catch {
      // sem a chave secreta ou Storage fora do ar: a foto já não aparece na vitrine
    }
  }
  revalidatePath("/admin", "layout");
  revalidatePath("/loja", "layout");
}

/** "<usuario>/vitrine/<arquivo>" de um endereço público do bucket "anuncios" do OLAKI (ou null). */
function caminhoNoBucket(url: string | null): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
  const prefixo = `${base}/storage/v1/object/public/anuncios/`;
  if (!url || !base || !url.startsWith(prefixo)) return null;
  const caminho = decodeURIComponent(url.slice(prefixo.length).split("?")[0]);
  return /^[A-Za-z0-9_]+\/vitrine\/[A-Za-z0-9_-][A-Za-z0-9._-]*$/.test(caminho) ? caminho : null;
}

/**
 * Radar: ocultar, devolver ou remover um pedido ou uma proposta (moderar_radar no banco).
 * O motivo é obrigatório para ocultar/remover; tudo fica no histórico (logs_atividade).
 */
export async function moderarRadar(form: FormData): Promise<void> {
  const { supabase } = await exigirTela("moderacao");
  const tipo = form.get("tipo") === "proposta" ? "proposta" : "pedido";
  const acao = String(form.get("acao") ?? "");
  const id = String(form.get("id") ?? "");
  const motivo = String(form.get("motivo") ?? "").trim().slice(0, 300);
  // Remover apaga de vez (o pedido leva junto as propostas): só com a caixa de confirmação marcada
  if (acao === "remover" && form.get("confirmar_remover") !== "sim") {
    redirect(`/admin/moderacao?erro=${encodeURIComponent('Para remover de vez, marque "Sim, remover de vez" e toque em Remover de novo.')}#radar`);
  }
  const { error } = await supabase.rpc("moderar_radar", { p_tipo: tipo, p_id: id, p_acao: acao, p_motivo: motivo || null });
  revalidatePath("/admin", "layout");
  revalidatePath("/radar", "layout");
  if (error) redirect(`/admin/moderacao?erro=${encodeURIComponent(error.message.slice(0, 200))}#radar`);
  redirect(`/admin/moderacao?ok=${encodeURIComponent(acao === "devolver" ? "Devolvido ao ar." : acao === "remover" ? "Removido." : "Tirado do ar.")}#radar`);
}
