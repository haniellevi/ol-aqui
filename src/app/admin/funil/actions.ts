"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirTela } from "@/lib/admin/equipe";
import type { EstadoForm } from "@/lib/admin/estado";
import { whatsappParaBanco } from "@/lib/admin/funil";
import { dddDaRegiao } from "@/lib/telefone-regiao";
import { ehUuid } from "@/lib/formato";
import { traduzirErro } from "@/lib/erros";

const CODIGO_ETAPA = /^[a-z0-9_]{2,30}$/;
const DATA = /^\d{4}-\d{2}-\d{2}$/;

const txt = (form: FormData, campo: string, max: number) => String(form.get(campo) ?? "").trim().slice(0, max) || null;
const uuidOuNulo = (form: FormData, campo: string) => {
  const v = String(form.get(campo) ?? "");
  return ehUuid(v) ? v : null;
};

function atualizar(id?: string) {
  revalidatePath("/admin/funil");
  revalidatePath("/admin/hoje");
  if (id) revalidatePath(`/admin/funil/${id}`);
}

/** Cria ou muda um contato do funil. Ao criar, abre a ficha dele. */
export async function salvarLojista(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const { supabase, userId } = await exigirTela("funil");
  const id = String(form.get("id") ?? "");
  // Região primeiro: o WhatsApp sem DDD usa o DDD dela.
  const microrregiao_id = uuidOuNulo(form, "regiao");
  const whatsapp = whatsappParaBanco(form.get("whatsapp"), await dddDaRegiao(microrregiao_id));
  if (whatsapp === undefined) return { erro: "Confira o WhatsApp: use o DDD e o celular, ex.: (89) 99999-0000." };
  const nome_loja = txt(form, "nome_loja", 80);
  if (!nome_loja || nome_loja.length < 2) return { erro: "Escreva o nome da loja." };
  if (!microrregiao_id) return { erro: "Escolha a região." };
  const etapa = String(form.get("etapa") ?? "");
  if (!CODIGO_ETAPA.test(etapa)) return { erro: "Escolha a etapa." };
  const proximo_em = String(form.get("proximo_em") ?? "");
  const origem = String(form.get("origem") ?? "");
  const responsavel = String(form.get("responsavel") ?? "");

  const dados = {
    nome_loja,
    contato_nome: txt(form, "contato_nome", 80),
    whatsapp,
    microrregiao_id,
    cidade_id: uuidOuNulo(form, "cidade"),
    categoria_id: uuidOuNulo(form, "categoria"),
    origem: /^[a-z0-9_-]{2,40}$/.test(origem) ? origem : null,
    etapa,
    responsavel_id: /^user_[A-Za-z0-9]+$/.test(responsavel) ? responsavel : null,
    proximo_passo: txt(form, "proximo_passo", 200),
    proximo_em: DATA.test(proximo_em) ? proximo_em : null,
    motivo_perda: txt(form, "motivo_perda", 200),
    atualizado_por: userId,
  };

  if (id) {
    if (!ehUuid(id)) return { erro: "Contato não encontrado." };
    const { error } = await supabase.from("funil_lojistas").update(dados).eq("id", id);
    if (error) return { erro: traduzirErro(error).mensagem };
    atualizar(id);
    return { ok: "Salvo." };
  }
  const { data, error } = await supabase.from("funil_lojistas").insert({ ...dados, criado_por: userId }).select("id").single();
  if (error || !data) return { erro: traduzirErro(error).mensagem };
  const nota = txt(form, "nota", 1000);
  if (nota) await supabase.from("funil_notas").insert({ lojista_id: data.id, texto: nota });
  atualizar();
  redirect(`/admin/funil/${data.id}`);
}

/** Muda só a etapa (direto da lista). */
export async function mudarEtapa(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const { supabase, userId } = await exigirTela("funil");
  const id = String(form.get("id") ?? "");
  const etapa = String(form.get("etapa") ?? "");
  if (!ehUuid(id) || !CODIGO_ETAPA.test(etapa)) return { erro: "Escolha a etapa." };
  const { error } = await supabase.from("funil_lojistas").update({ etapa, atualizado_por: userId }).eq("id", id);
  if (error) return { erro: traduzirErro(error).mensagem };
  atualizar(id);
  return { ok: "Etapa mudada." };
}

/** Marca o próximo passo com um toque (amanhã, em 3 dias, próxima semana) ou limpa. */
export async function agendarPasso(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const { supabase, userId } = await exigirTela("funil");
  const id = String(form.get("lojista") ?? "");
  const dia = String(form.get("dia") ?? "");
  if (!ehUuid(id) || (dia && !DATA.test(dia))) return { erro: "Data inválida." };
  const { error } = await supabase.from("funil_lojistas").update({ proximo_em: dia || null, atualizado_por: userId }).eq("id", id);
  if (error) return { erro: traduzirErro(error).mensagem };
  atualizar(id);
  return { ok: dia ? "Próximo passo marcado." : "Próximo passo limpo." };
}

export async function adicionarNota(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const { supabase } = await exigirTela("funil");
  const id = String(form.get("id") ?? "");
  const texto = txt(form, "texto", 1000);
  if (!ehUuid(id)) return { erro: "Contato não encontrado." };
  if (!texto) return { erro: "Escreva a anotação." };
  const { error } = await supabase.from("funil_notas").insert({ lojista_id: id, texto });
  if (error) return { erro: traduzirErro(error).mensagem };
  atualizar(id);
  return { ok: "Anotado." };
}

export async function apagarNota(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const { supabase } = await exigirTela("funil");
  const nota = String(form.get("nota") ?? "");
  const id = String(form.get("id") ?? "");
  if (!ehUuid(nota) || !ehUuid(id)) return { erro: "Anotação não encontrada." };
  const { error } = await supabase.from("funil_notas").delete().eq("id", nota).eq("automatica", false);
  if (error) return { erro: traduzirErro(error).mensagem };
  atualizar(id);
  return { ok: "Anotação apagada." };
}

export async function apagarLojista(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const { supabase } = await exigirTela("funil");
  const id = String(form.get("id") ?? "");
  if (!ehUuid(id)) return { erro: "Contato não encontrado." };
  const { error } = await supabase.from("funil_lojistas").delete().eq("id", id);
  if (error) return { erro: traduzirErro(error).mensagem };
  atualizar();
  redirect("/admin/funil");
}

/** Traz para o funil as lojas que já tinham conta no site. */
export async function importarLojas(): Promise<EstadoForm> {
  const { supabase } = await exigirTela("funil");
  const { data, error } = await supabase.rpc("funil_importar_lojas");
  if (error) return { erro: traduzirErro(error).mensagem };
  atualizar();
  const n = Number(data ?? 0);
  return { ok: n === 0 ? "Todas as lojas do site já estavam no funil." : `${n} ${n === 1 ? "loja entrou" : "lojas entraram"} no funil.` };
}

/** Cria ou muda uma etapa do funil (nome, tipo, ordem, ligada). */
export async function salvarEtapa(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const { supabase } = await exigirTela("funil");
  const nova = form.get("nova") === "1";
  const nome = String(form.get("nome") ?? "").trim().slice(0, 40);
  const tipo = String(form.get("tipo") ?? "aberta");
  const ordem = Number(form.get("ordem") ?? 100);
  if (nome.length < 2) return { erro: "Dê um nome à etapa." };
  if (!["aberta", "ganho", "perdido"].includes(tipo)) return { erro: "Escolha o tipo da etapa." };
  const dados = { nome, tipo, ordem: Number.isInteger(ordem) ? Math.min(Math.max(ordem, 0), 9999) : 100, ativa: form.get("ativa") !== "false" };
  if (nova) {
    const codigo = nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "").slice(0, 30);
    if (!CODIGO_ETAPA.test(codigo)) return { erro: "Use um nome com letras ou números." };
    const { error } = await supabase.from("funil_etapas").insert({ codigo, ...dados });
    if (error) return { erro: error.code === "23505" ? "Já existe uma etapa com esse nome." : traduzirErro(error).mensagem };
  } else {
    const codigo = String(form.get("codigo") ?? "");
    if (!CODIGO_ETAPA.test(codigo)) return { erro: "Etapa inválida." };
    const { error } = await supabase.from("funil_etapas").update(dados).eq("codigo", codigo);
    if (error) return { erro: traduzirErro(error).mensagem };
  }
  atualizar();
  return { ok: "Etapa salva." };
}
