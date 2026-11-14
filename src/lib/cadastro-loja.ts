import "server-only";

import { auth } from "@clerk/nextjs/server";
import { telefoneComercialDigitado } from "@/lib/formato";
import { dddDoPerfil, numeroComRegiao } from "@/lib/telefone-regiao";
import { traduzirErro } from "@/lib/erros";
import type { EstadoLoja } from "@/app/(conta)/quero-vender/actions";
import type { ResultadoQueroVender } from "@/lib/tipos";

export const SLUG_LOJA = /^[a-z0-9-]{3,60}$/;

export async function validarCadastroLoja(form: FormData) {
  const nome = String(form.get("nome_loja") ?? "").replace(/\s+/g, " ").trim();
  const slug = String(form.get("slug") ?? "").trim().toLowerCase();
  const whatsapp = String(form.get("whatsapp") ?? "").trim();
  // Sem DDD no WhatsApp da loja, usa o DDD da região da pessoa.
  const { userId } = await auth();
  const fone = await numeroComRegiao(whatsapp, () => dddDoPerfil(userId), telefoneComercialDigitado, true);
  const cidade = String(form.get("cidade") ?? "").trim();
  const categoria = String(form.get("categoria_loja") ?? "").trim();
  const sobre = String(form.get("sobre") ?? "").trim();

  const campos: Record<string, string> = {};
  if (nome.length < 2 || nome.length > 80) campos.nome_loja = "Escreva o nome da loja (de 2 a 80 letras).";
  if (!SLUG_LOJA.test(slug)) campos.slug = "Use de 3 a 60 letras minúsculas, números ou hífen, sem espaço nem acento.";
  if (whatsapp && !fone) campos.whatsapp = "WhatsApp inválido. Use o DDD e o número, ex.: (89) 99999-0000.";
  if (!cidade) campos.cidade = "Escolha a cidade da loja.";
  if (categoria.length > 80) campos.categoria_loja = "Use até 80 caracteres.";
  if (sobre.length > 1500) campos.sobre = "Use até 1500 caracteres.";
  if (Object.keys(campos).length) return { estado: { erro: { mensagem: "Confira os campos marcados." }, campos } };
  return { campos: { nome, slug, whatsapp: fone, cidade, categoria: categoria || null, sobre: sobre || null } };
}

export function resultadoCadastroLoja(data: unknown, error: Parameters<typeof traduzirErro>[0]): EstadoLoja {
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
