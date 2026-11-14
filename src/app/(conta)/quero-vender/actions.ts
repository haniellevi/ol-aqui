"use server";
// Server Actions do "Quero vender" (T14, T15). Quem cria a vitrine e decide plano e teste
// grátis é a função quero_vender() do banco; aqui só conferimos os dados para mostrar o erro no campo.
import { telefoneComercialDigitado } from "@/lib/formato";
import { dddDaRegiao, numeroComRegiao } from "@/lib/telefone-regiao";
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
  // Sem DDD no WhatsApp da loja, usa o DDD da região da pessoa.
  const fone = await numeroComRegiao(whatsapp, async () => {
    const { data: perfil } = await (await createClient()).from("perfis").select("microrregiao_id").maybeSingle();
    return dddDaRegiao(perfil?.microrregiao_id);
  }, telefoneComercialDigitado, true);
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
    if (erro.campo) return { erro: { mensagem: "Confira o campo marcado." }, campos: { [erro.campo]: erro.mensagem } };
    return { erro };
  }
  const feito = (Array.isArray(data) ? data[0] : data) as ResultadoQueroVender | null;
  if (!feito?.slug) return { erro: traduzirErro(null) };
  return { feito };
}
