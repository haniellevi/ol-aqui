"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { traduzirErro } from "@/lib/erros";
import { ehUuid } from "@/lib/formato";
import { linkConversa } from "@/lib/rotas";
import { DETALHES_MAX, ehMotivoDenuncia, validarMensagem } from "@/components/conversas/validacao";
import type { ErroTela, Resultado } from "@/lib/tipos";
import type { MensagemConversa } from "@/lib/tipos-conversas";

// Ações das Conversas. Quem decide tudo é o banco (quem participa, bloqueio, limites,
// palavras proibidas, telefone escondido); aqui só conferimos a entrada e traduzimos o erro.

type ErroBanco = { code?: string; message?: string; details?: string | null } | null;

const SEM_LOGIN: ErroTela = { mensagem: "Entre na sua conta para continuar.", codigo: "28000" };
const INVALIDO: ErroTela = { mensagem: "Conversa não encontrada." };

/** P0002 ("não está mais no ar", "não encontrada") já vem pronta do banco. */
function erroDe(e: ErroBanco): ErroTela {
  if (e?.code === "P0002" && e.message) return { mensagem: e.message, codigo: e.code };
  return traduzirErro(e);
}

async function logado(): Promise<boolean> {
  const { userId } = await auth();
  return !!userId;
}

async function chamar(nome: string, args: Record<string, unknown>): Promise<{ data: unknown; error: ErroBanco }> {
  const db = await createClient();
  const { data, error } = await db.rpc(nome, args);
  return { data, error: error as ErroBanco };
}

export async function abrirConversaAnuncio(anuncioId: string): Promise<Resultado<{ id: string }>> {
  if (!(await logado())) return { ok: false, erro: SEM_LOGIN };
  if (!ehUuid(anuncioId)) return { ok: false, erro: { mensagem: "Anúncio não encontrado." } };
  const { data, error } = await chamar("abrir_conversa_anuncio", { p_anuncio: anuncioId });
  if (error) return { ok: false, erro: erroDe(error) };
  if (typeof data !== "string" || !ehUuid(data)) return { ok: false, erro: traduzirErro(null) };
  return { ok: true, dados: { id: data } };
}

export async function enviarMensagem(conversaId: string, texto: string): Promise<Resultado<{ id: string }>> {
  if (!(await logado())) return { ok: false, erro: SEM_LOGIN };
  if (!ehUuid(conversaId)) return { ok: false, erro: INVALIDO };
  const invalida = validarMensagem(texto);
  if (invalida) return { ok: false, erro: { mensagem: invalida.mensagem, campo: invalida.campo } };
  const { data, error } = await chamar("enviar_mensagem", { p_conversa: conversaId, p_texto: texto.trim() });
  if (error) return { ok: false, erro: erroDe(error) };
  if (typeof data !== "string" || !ehUuid(data)) return { ok: false, erro: traduzirErro(null) };
  return { ok: true, dados: { id: data } };
}

/** Mensagens mais novas que `depois` (ISO), ou as últimas 200 quando `depois` é null. */
export async function mensagensDepois(conversaId: string, depois: string | null): Promise<Resultado<MensagemConversa[]>> {
  if (!(await logado())) return { ok: false, erro: SEM_LOGIN };
  if (!ehUuid(conversaId)) return { ok: false, erro: INVALIDO };
  if (depois !== null && (typeof depois !== "string" || Number.isNaN(Date.parse(depois)))) return { ok: false, erro: INVALIDO };
  const { data, error } = await chamar("conversa_mensagens_de", { p_conversa: conversaId, p_depois: depois });
  if (error) return { ok: false, erro: erroDe(error) };
  return { ok: true, dados: Array.isArray(data) ? (data as MensagemConversa[]) : [] };
}

async function acaoSimples(conversaId: string, nome: string, args: Record<string, unknown>, revalidar = true): Promise<Resultado<null>> {
  if (!(await logado())) return { ok: false, erro: SEM_LOGIN };
  if (!ehUuid(conversaId)) return { ok: false, erro: INVALIDO };
  const { error } = await chamar(nome, { p_conversa: conversaId, ...args });
  if (error) return { ok: false, erro: erroDe(error) };
  if (revalidar) revalidatePath(linkConversa(conversaId));
  return { ok: true, dados: null };
}

export async function marcarLida(conversaId: string): Promise<Resultado<null>> {
  return acaoSimples(conversaId, "marcar_conversa_lida", {}, false);
}

export async function mostrarMeuWhatsapp(conversaId: string): Promise<Resultado<null>> {
  return acaoSimples(conversaId, "mostrar_meu_whatsapp", {});
}

export async function bloquear(conversaId: string, bloquear: boolean): Promise<Resultado<null>> {
  return acaoSimples(conversaId, "bloquear_conversa", { p_bloquear: bloquear === true });
}

export async function denunciar(conversaId: string, motivo: string, detalhes: string | null): Promise<Resultado<null>> {
  if (!(await logado())) return { ok: false, erro: SEM_LOGIN };
  if (!ehUuid(conversaId)) return { ok: false, erro: INVALIDO };
  if (!ehMotivoDenuncia(motivo)) return { ok: false, erro: { mensagem: "Escolha o motivo da denúncia.", campo: "motivo" } };
  const det = typeof detalhes === "string" ? detalhes.trim() : "";
  if (det.length > DETALHES_MAX) return { ok: false, erro: { mensagem: "Escreva os detalhes em até 1.000 letras.", campo: "detalhes" } };
  return acaoSimples(conversaId, "denunciar_conversa", { p_motivo: motivo, p_detalhes: det || null });
}
