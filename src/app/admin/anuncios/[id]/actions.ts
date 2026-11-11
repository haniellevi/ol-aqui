"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { exigirTela } from "@/lib/admin/equipe";
import { traduzirErro } from "@/lib/erros";
import { ehUuid } from "@/lib/formato";
import { LINK_ADMIN_ANUNCIOS, linkAdminAnuncio } from "@/lib/rotas";
import type { StatusAnuncio } from "@/lib/tipos";

function aviso(id: string, chave: "erro" | "ok", texto: string, conversa = false): never {
  redirect(`${linkAdminAnuncio(id)}?${new URLSearchParams({ [chave]: texto })}${conversa ? "#conversa" : ""}`);
}

export async function administrarAnuncio(id: string, esperado: StatusAnuncio, atualizado: string, acao: string, form: FormData) {
  const { supabase } = await exigirTela("anuncios");
  if (!ehUuid(id)) notFound();
  const motivo = String(form.get("motivo") ?? "").trim();
  if (acao !== "revisar" && acao !== "aprovar" && acao !== "recusar") aviso(id, "erro", "Escolha uma ação válida.");
  if (acao !== "aprovar" && (motivo.length < 3 || motivo.length > 280)) aviso(id, "erro", "Informe um motivo entre 3 e 280 caracteres.");
  const { data, error } = await supabase.rpc("admin_gerenciar_anuncio", {
    p_id: id, p_acao: acao, p_esperado: esperado, p_atualizado: atualizado, p_motivo: motivo || null,
  });
  if (error) aviso(id, "erro", traduzirErro(error).mensagem);
  revalidatePath(LINK_ADMIN_ANUNCIOS, "page");
  revalidatePath("/admin/moderacao");
  revalidatePath("/minha-conta/anuncios");
  revalidatePath("/");
  revalidatePath("/busca");
  revalidatePath("/anuncio/[idslug]", "page");
  revalidatePath("/loja/[slug]", "page");
  aviso(id, "ok", data === "ativo" ? "Anúncio aprovado e no ar." : data === "em_analise" ? "Anúncio enviado para revisão da equipe." : "Anúncio recusado e fora do ar.");
}

export async function abrirAtendimento(id: string) {
  const { supabase } = await exigirTela("anuncios");
  if (!ehUuid(id)) notFound();
  const { data, error } = await supabase.rpc("abrir_atendimento_anuncio", { p_anuncio: id });
  if (error || !data) aviso(id, "erro", error ? traduzirErro(error).mensagem : "Não foi possível abrir a conversa.");
  redirect(`${linkAdminAnuncio(id)}#conversa`);
}

export async function delegarAtendimento(id: string, conversa: string, ativo: boolean, versao: number) {
  const { supabase } = await exigirTela("anuncios");
  if (!ehUuid(id) || !ehUuid(conversa) || typeof ativo !== "boolean" || !Number.isSafeInteger(versao)) notFound();
  const { error } = await supabase.rpc("delegar_atendimento_aki", { p_conversa: conversa, p_ativo: ativo, p_versao: versao });
  if (error) aviso(id, "erro", traduzirErro(error).mensagem, true);
  aviso(id, "ok", ativo ? "O Merc pode responder nesta conversa." : "A equipe retomou o atendimento.", true);
}
