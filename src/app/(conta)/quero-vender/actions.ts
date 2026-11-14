"use server";
// Server Actions do "Quero vender" (T14, T15). Quem cria a vitrine e decide plano e teste
// grátis é a função quero_vender() do banco; aqui só conferimos os dados para mostrar o erro no campo.
import { telefoneComercialDigitado } from "@/lib/formato";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { slugDisponivel } from "@/lib/dados/vitrines";
import { traduzirErro } from "@/lib/erros";
import type { ResultadoQueroVender } from "@/lib/tipos";
import type { EstadoForm } from "@/components/anunciar/passos";

export type EstadoLoja = (NonNullable<EstadoForm> & { feito?: ResultadoQueroVender }) | null;

const SLUG = /^[a-z0-9-]{3,60}$/;

/** "Vender minhas coisas": liga a conta de vendedor (pessoa física) e abre o Anunciar. */
export async function queroVenderPf(): Promise<EstadoForm> {
  const db = await createClient();
  const { error } = await db.rpc("quero_vender", { tipo: "pf" });
  if (error) return { erro: traduzirErro(error) };
  redirect("/anunciar");
}

/** O endereço mercadodaregiao.com.br/loja/<slug> está livre? null = formato inválido. */
export async function verificarSlug(slug: string): Promise<boolean | null> {
  const s = String(slug ?? "").trim().toLowerCase();
  if (!SLUG.test(s)) return null;
  return slugDisponivel(s);
}

/** "Tenho uma loja": cria a vitrine (ou transforma a de pessoa física) e começa o teste grátis. */
export async function criarLoja(_antes: EstadoLoja, form: FormData): Promise<EstadoLoja> {
  const nome = String(form.get("nome_loja") ?? "").replace(/\s+/g, " ").trim();
  const slug = String(form.get("slug") ?? "").trim().toLowerCase();
  const whatsapp = String(form.get("whatsapp") ?? "").trim();
  const fone = telefoneComercialDigitado(whatsapp);
  const cidade = String(form.get("cidade") ?? "").trim();
  const categoria = String(form.get("categoria_loja") ?? "").trim();
  const sobre = String(form.get("sobre") ?? "").trim();

  const campos: Record<string, string> = {};
  if (nome.length < 2 || nome.length > 80) campos.nome_loja = "Escreva o nome da loja (de 2 a 80 letras).";
  if (!SLUG.test(slug)) campos.slug = "Use de 3 a 60 letras minúsculas, números ou hífen, sem espaço nem acento.";
  if (whatsapp && !fone) campos.whatsapp = "WhatsApp inválido. Use o DDD e o número, ex.: (89) 99999-0000.";
  if (!cidade) campos.cidade = "Escolha a cidade da loja.";
  if (categoria.length > 80) campos.categoria_loja = "Use até 80 caracteres.";
  if (sobre.length > 1500) campos.sobre = "Use até 1500 caracteres.";
  if (Object.keys(campos).length) return { erro: { mensagem: "Confira os campos marcados." }, campos };

  const db = await createClient();
  const { data, error } = await db.rpc("quero_vender_com_descricao", {
    p_nome: nome,
    p_slug: slug,
    p_whatsapp: fone,
    p_cidade: cidade,
    p_categoria: categoria || null,
    p_sobre: sobre || null,
  });
  if (error) {
    const erro = traduzirErro(error);
    // o banco marca o nome da loja como "nome"; o formulário usa "nome_loja"
    const campo = erro.campo === "nome" ? "nome_loja" : erro.campo;
    if (campo) return { erro: { mensagem: "Confira o campo marcado." }, campos: { [campo]: erro.mensagem } };
    return { erro };
  }
  const feito = (Array.isArray(data) ? data[0] : data) as ResultadoQueroVender | null;
  if (!feito?.slug) return { erro: traduzirErro(null) };
  return { feito };
}
