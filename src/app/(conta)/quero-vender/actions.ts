"use server";
// Server Actions do "Quero vender" (T14, T15). Quem cria a vitrine e decide plano e teste
// grátis é a função quero_vender() do banco; aqui só conferimos os dados para mostrar o erro no campo.
import { comAssistente, linkAssistente, objetivoAssistente, tentativaAssistente } from "@/lib/assistente";
import { guardarLojaEscolhida, lojasQueCuido } from "@/lib/dados/loja-ativa";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { slugDisponivel } from "@/lib/dados/vitrines";
import { resultadoCadastroLoja, SLUG_LOJA, validarCadastroLoja } from "@/lib/cadastro-loja";
import { traduzirErro } from "@/lib/erros";
import type { ResultadoQueroVender } from "@/lib/tipos";
import type { EstadoForm } from "@/components/anunciar/passos";

export type EstadoLoja = (NonNullable<EstadoForm> & { feito?: ResultadoQueroVender }) | null;

/** "Vender minhas coisas": liga a conta de vendedor (pessoa física) e abre o Anunciar. */
export async function queroVenderPf(assistente?: string): Promise<EstadoForm> {
  const db = await createClient();
  const { error } = await db.rpc("quero_vender", { tipo: "pf" });
  if (error) return { erro: traduzirErro(error) };
  const tentativa = tentativaAssistente(assistente);
  if (tentativa) await anunciarPelaVitrinePropria(tentativa, "item");
  redirect("/anunciar");
}

/** O assistente anuncia pela vitrine da própria conta, mesmo se outra estiver selecionada. */
export async function anunciarPelaVitrinePropria(valor: string, escolha: string): Promise<void> {
  const tentativa = tentativaAssistente(valor);
  const objetivo = objetivoAssistente(escolha);
  if (!tentativa || (objetivo !== "loja" && objetivo !== "item")) redirect("/anunciar");
  const propria = (await lojasQueCuido()).find((loja) => loja.dono);
  if (!propria || !await guardarLojaEscolhida(propria.id)) redirect(linkAssistente(objetivo, tentativa));
  redirect(comAssistente("/anunciar", tentativa));
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
