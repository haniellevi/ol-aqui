"use server";

import { revalidatePath } from "next/cache";
import { exigirAdmin } from "@/lib/admin/auth";
import type { EstadoForm } from "@/lib/admin/estado";
import { erroVariaveis, variaveisInvalidas } from "@/lib/admin/mensagens";
import { traduzirErro } from "@/lib/erros";
import { ehUuid } from "@/lib/formato";
import { LINK_ADMIN_MENSAGENS } from "@/lib/rotas";
import { LIMITES_CANAL, type CanalMensagem, type ModeloMensagem } from "@/lib/tipos-relatorios";

// Tela 13 · Mensagens automáticas. Tudo pelo token do admin: a RLS (e_admin) e a permissão de coluna
// deixam mudar só título, texto e ligado; o gatilho do banco recusa variável desconhecida e grava quem
// mudou; registrar_log guarda o valor antigo em logs_atividade.

type Linha = Pick<ModeloMensagem, "id" | "canal" | "variaveis" | "titulo_padrao" | "texto_padrao">;

async function lerModelo(supabase: Awaited<ReturnType<typeof exigirAdmin>>["supabase"], id: string): Promise<Linha | null> {
  if (!ehUuid(id)) return null;
  const { data } = await supabase.from("modelos_mensagem").select("id, canal, variaveis, titulo_padrao, texto_padrao").eq("id", id).maybeSingle();
  return (data as Linha | null) ?? null;
}

export async function salvarModelo(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  try {
    const { supabase } = await exigirAdmin();
    const modelo = await lerModelo(supabase, String(form.get("id") ?? ""));
    if (!modelo) return { erro: "Mensagem não encontrada. Recarregue a página." };
    const canal = modelo.canal as CanalMensagem;
    const limites = LIMITES_CANAL[canal];
    const texto = String(form.get("texto") ?? "").trim();
    const titulo = limites.titulo ? String(form.get("titulo") ?? "").trim() : null;

    // Avisos rápidos (o banco confere tudo de novo)
    const erroTitulo = titulo !== null ? erroVariaveis("título", variaveisInvalidas(titulo, modelo.variaveis), modelo.variaveis) : null;
    if (erroTitulo) return { erro: erroTitulo };
    const erroTexto = erroVariaveis("texto", variaveisInvalidas(texto, modelo.variaveis), modelo.variaveis);
    if (erroTexto) return { erro: erroTexto };
    if (limites.titulo && (titulo!.length < 2 || titulo!.length > limites.titulo)) {
      return { erro: `O ${canal === "email" ? "assunto" : "título"} precisa ter de 2 a ${limites.titulo} letras.` };
    }
    if (texto.length < 2 || texto.length > limites.texto) {
      return { erro: `O texto precisa ter de 2 a ${limites.texto.toLocaleString("pt-BR")} letras.` };
    }

    const { error } = await supabase
      .from("modelos_mensagem")
      .update({ titulo, texto, ativo: form.get("ativo") === "on" })
      .eq("id", modelo.id);
    if (error) return { erro: traduzirErro(error).mensagem };
    revalidatePath(LINK_ADMIN_MENSAGENS);
    return { ok: "Salvo. Vale para as próximas mensagens." };
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Erro ao salvar." };
  }
}

export async function voltarTextoOriginal(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  try {
    const { supabase } = await exigirAdmin();
    const modelo = await lerModelo(supabase, String(form.get("id") ?? ""));
    if (!modelo) return { erro: "Mensagem não encontrada. Recarregue a página." };
    const { error } = await supabase
      .from("modelos_mensagem")
      .update({ titulo: modelo.titulo_padrao, texto: modelo.texto_padrao })
      .eq("id", modelo.id);
    if (error) return { erro: traduzirErro(error).mensagem };
    revalidatePath(LINK_ADMIN_MENSAGENS);
    return { ok: "Voltou para o texto original." };
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Erro ao salvar." };
  }
}
