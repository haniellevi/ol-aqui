"use server";
// Server Actions do "Quero vender" (T14, T15). Quem cria a vitrine e decide plano e teste
// grátis é a função quero_vender() do banco; aqui só conferimos os dados para mostrar o erro no campo.
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { slugDisponivel } from "@/lib/dados/vitrines";
import { resultadoCadastroLoja, SLUG_LOJA, validarCadastroLoja } from "@/lib/cadastro-loja";
import { traduzirErro } from "@/lib/erros";
import type { ResultadoQueroVender } from "@/lib/tipos";
import type { EstadoForm } from "@/components/anunciar/passos";

export type EstadoLoja = (NonNullable<EstadoForm> & { feito?: ResultadoQueroVender }) | null;

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
  if (!SLUG_LOJA.test(s)) return null;
  return slugDisponivel(s);
}

/** "Tenho uma loja": cria a vitrine (ou transforma a de pessoa física) e começa o teste grátis. */
export async function criarLoja(_antes: EstadoLoja, form: FormData): Promise<EstadoLoja> {
  const validado = await validarCadastroLoja(form);
  if (!validado.campos) return validado.estado ?? null;
  const { nome, slug, whatsapp, cidade, categoria, sobre } = validado.campos;
  const db = await createClient();
  const { data, error } = await db.rpc("loja_cadastro_manual", {
    p_nome: nome, p_slug: slug, p_whatsapp: whatsapp, p_cidade: cidade, p_categoria: categoria, p_sobre: sobre,
  });
  return resultadoCadastroLoja(data, error);
}
