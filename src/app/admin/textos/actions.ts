"use server";

import { revalidatePath } from "next/cache";
import { exigirAdmin } from "@/lib/admin/auth";
import { inteiroOuNulo } from "@/lib/admin/formato";
import type { EstadoForm } from "@/lib/admin/estado";
import { traduzirErro } from "@/lib/erros";
import { ehUuid } from "@/lib/formato";
import type { ChaveBlocoHome, TipoDocumento } from "@/lib/tipos-paginas";

// Tela 12 · Página inicial e textos. Tudo pelo token do admin: a RLS (e_admin) e as funções do banco
// barram quem não é, e os gatilhos registrar_log gravam cada mudança no histórico (logs_atividade).

const CHAVES_HOME: readonly ChaveBlocoHome[] = ["destaques", "lojas_destaque", "radar", "lojas_regiao", "recentes"];
const TIPOS_DOC: readonly TipoDocumento[] = ["termos", "privacidade"];

const txt = (form: FormData, campo: string) => String(form.get(campo) ?? "").trim();

function atualizarAjuda() {
  revalidatePath("/admin/textos");
  revalidatePath("/ajuda");
}

/* ------------------------------- Ajuda -------------------------------- */

export async function salvarPergunta(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  try {
    const { supabase, userId } = await exigirAdmin();
    const id = txt(form, "id");
    const categoria = txt(form, "categoria");
    const pergunta = txt(form, "pergunta");
    const resposta = txt(form, "resposta");
    if (!categoria) return { erro: "Escolha o assunto." };
    if (pergunta.length < 5 || pergunta.length > 200) return { erro: "A pergunta precisa ter de 5 a 200 letras." };
    if (resposta.length < 5 || resposta.length > 4000) return { erro: "A resposta precisa ter de 5 a 4.000 letras." };
    const dados = {
      categoria,
      pergunta,
      resposta,
      ordem: inteiroOuNulo(form.get("ordem")) ?? 0,
      ativo: form.get("ativo") === "on",
      atualizado_por: userId,
    };
    if (id && !ehUuid(id)) return { erro: "Pergunta não encontrada." };
    const { error } = id
      ? await supabase.from("ajuda_perguntas").update(dados).eq("id", id)
      : await supabase.from("ajuda_perguntas").insert(dados);
    if (error) return { erro: traduzirErro(error).mensagem };
    atualizarAjuda();
    return { ok: id ? "Salvo. Já aparece na Ajuda." : "Pergunta criada." };
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Erro ao salvar." };
  }
}

export async function apagarPergunta(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  try {
    const { supabase } = await exigirAdmin();
    const id = txt(form, "id");
    if (!ehUuid(id)) return { erro: "Pergunta não encontrada." };
    const { error } = await supabase.from("ajuda_perguntas").delete().eq("id", id);
    if (error) return { erro: traduzirErro(error).mensagem };
    atualizarAjuda();
    return { ok: "Pergunta apagada." };
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Erro ao apagar." };
  }
}

export async function salvarCategoria(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  try {
    const { supabase, userId } = await exigirAdmin();
    const original = txt(form, "original"); // vazio = nova
    const nome = txt(form, "nome");
    if (nome.length < 2 || nome.length > 60) return { erro: "O nome precisa ter de 2 a 60 letras." };
    const descricao = txt(form, "descricao").slice(0, 160) || null;
    const dados = { nome, descricao, ordem: inteiroOuNulo(form.get("ordem")) ?? 0, ativa: form.get("ativa") === "on", atualizado_por: userId };
    if (original) {
      const { error } = await supabase.from("ajuda_categorias").update(dados).eq("slug", original);
      if (error) return { erro: traduzirErro(error).mensagem };
    } else {
      const slug = nome
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 40);
      if (slug.length < 2) return { erro: "Use letras no nome." };
      const { error } = await supabase.from("ajuda_categorias").insert({ slug, ...dados });
      if (error) return { erro: error.code === "23505" ? "Já existe um assunto com esse nome." : traduzirErro(error).mensagem };
    }
    atualizarAjuda();
    return { ok: original ? "Assunto salvo." : "Assunto criado." };
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Erro ao salvar." };
  }
}

export async function apagarCategoria(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  try {
    const { supabase } = await exigirAdmin();
    const { error } = await supabase.from("ajuda_categorias").delete().eq("slug", txt(form, "slug"));
    if (error) return { erro: error.code === "23503" ? "Este assunto tem perguntas. Apague ou mude as perguntas de assunto antes." : traduzirErro(error).mensagem };
    atualizarAjuda();
    return { ok: "Assunto apagado." };
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Erro ao apagar." };
  }
}

/* -------------------------- Termos e privacidade -------------------------- */

export async function publicarDocumento(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  try {
    const { supabase } = await exigirAdmin();
    const tipo = txt(form, "tipo") as TipoDocumento;
    if (!TIPOS_DOC.includes(tipo)) return { erro: "Tipo inválido." };
    const { data, error } = await supabase.rpc("publicar_documento_legal", {
      p_tipo: tipo,
      p_titulo: txt(form, "titulo"),
      p_conteudo: String(form.get("conteudo") ?? ""),
      p_resumo: txt(form, "resumo") || null,
      p_revisado: form.get("revisado") === "on",
    });
    if (error) return { erro: traduzirErro(error).mensagem };
    revalidatePath("/", "layout");
    const versao = (data as { versao?: number } | null)?.versao;
    return { ok: `Versão ${versao ?? "nova"} publicada. Quem está logado vai ver o aviso para aceitar.` };
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Erro ao publicar." };
  }
}

export async function marcarRevisado(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  try {
    const { supabase } = await exigirAdmin();
    const id = txt(form, "id");
    if (!ehUuid(id)) return { erro: "Versão não encontrada." };
    const revisado = txt(form, "revisado") === "1";
    const { error } = await supabase.rpc("marcar_documento_revisado", { p_documento_id: id, p_revisado: revisado });
    if (error) return { erro: traduzirErro(error).mensagem };
    revalidatePath("/admin/textos");
    return { ok: revisado ? "Marcado como revisado por advogado." : "Voltou a ser RASCUNHO." };
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Erro ao salvar." };
  }
}

/* ---------------------------- Página inicial ----------------------------- */

export async function salvarBloco(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  try {
    const { supabase, userId } = await exigirAdmin();
    const chave = txt(form, "chave") as ChaveBlocoHome;
    if (!CHAVES_HOME.includes(chave)) return { erro: "Bloco inválido." };
    const titulo = txt(form, "titulo");
    const texto = txt(form, "texto");
    const botao = txt(form, "botao");
    if (titulo && (titulo.length < 2 || titulo.length > 80)) return { erro: "O título precisa ter de 2 a 80 letras." };
    if (texto && (texto.length < 2 || texto.length > 200)) return { erro: "O texto precisa ter de 2 a 200 letras." };
    if (botao && (botao.length < 2 || botao.length > 30)) return { erro: "O botão precisa ter de 2 a 30 letras." };
    const dados: Record<string, unknown> = { ativo: form.get("ativo") === "on", atualizado_por: userId };
    if (form.has("titulo")) dados.titulo = titulo || null;
    if (form.has("texto")) dados.texto = texto || null;
    if (form.has("botao")) dados.botao = botao || null;
    const { error } = await supabase.from("home_blocos").update(dados).eq("chave", chave);
    if (error) return { erro: traduzirErro(error).mensagem };
    revalidatePath("/admin/textos");
    revalidatePath("/");
    return { ok: "Salvo. Já vale na página inicial." };
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Erro ao salvar." };
  }
}

/** Sobe ou desce um bloco (troca a posição com o vizinho). */
export async function moverBloco(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  try {
    const { supabase, userId } = await exigirAdmin();
    const chave = txt(form, "chave") as ChaveBlocoHome;
    const direcao = txt(form, "direcao") === "subir" ? -1 : 1;
    const { data, error } = await supabase.from("home_blocos").select("chave, ordem").order("ordem").order("chave");
    if (error || !data) return { erro: traduzirErro(error).mensagem };
    // posições 10, 20, 30... (arruma empates antigos) e troca com o vizinho
    const lista = (data as { chave: ChaveBlocoHome; ordem: number }[]).map((b) => b.chave);
    const i = lista.indexOf(chave);
    const j = i + direcao;
    if (i < 0 || j < 0 || j >= lista.length) return { ok: "Já está na ponta." };
    [lista[i], lista[j]] = [lista[j], lista[i]];
    for (const [pos, c] of lista.entries()) {
      const atual = (data as { chave: string; ordem: number }[]).find((b) => b.chave === c)?.ordem;
      const nova = (pos + 1) * 10;
      if (atual === nova) continue;
      const { error: e } = await supabase.from("home_blocos").update({ ordem: nova, atualizado_por: userId }).eq("chave", c);
      if (e) return { erro: traduzirErro(e).mensagem };
    }
    revalidatePath("/admin/textos");
    revalidatePath("/");
    return { ok: "Ordem salva." };
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Erro ao mover." };
  }
}
