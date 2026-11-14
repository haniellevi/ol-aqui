"use server";

import { revalidatePath } from "next/cache";
import { auth, currentUser } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { listarCidades } from "@/lib/dados/regiao";
import { meuPerfilEVitrine } from "@/lib/dados/conta";
import { sincronizarPerfil } from "@/lib/perfil";
import { whatsappDigitado } from "@/lib/formato";
import { dddDoPerfil, numeroComRegiao } from "@/lib/telefone-regiao";

export type EstadoDados = { ok?: boolean; erro?: string; campos?: Record<string, string>; whatsappVinculado?: boolean } | null;
const SEM_LOGIN = "Entre na sua conta para continuar.";
const FALHOU = "Não conseguimos salvar agora. Seu preenchimento foi mantido; tente novamente.";
const texto = (form: FormData, campo: string) => {
  const valor = form.get(campo);
  return typeof valor === "string" ? valor.replace(/\s+/g, " ").trim() : "";
};

function atualizarTelas() {
  revalidatePath("/minha-conta", "layout");
  revalidatePath("/radar", "layout");
}

export async function salvarDados(_antes: EstadoDados, form: FormData): Promise<EstadoDados> {
  try {
    const { userId } = await auth();
    if (!userId) return { erro: SEM_LOGIN };
    const nome = texto(form, "nome"), cidade = texto(form, "cidade"), bairro = texto(form, "bairro");
    const campos: Record<string, string> = {};
    for (const campo of ["nome", "cidade", "bairro"]) {
      if (form.has(campo) && typeof form.get(campo) !== "string") campos[campo] = "Preencha este campo com texto.";
    }
    if (nome.length < 2 || nome.length > 120) campos.nome = "Escreva seu nome com 2 a 120 caracteres.";
    if (bairro.length > 80) campos.bairro = "Use até 80 caracteres no bairro.";
    if (cidade.length > 100) campos.cidade = "Escolha uma cidade da lista.";
    if (Object.keys(campos).length) return { erro: "Confira os campos marcados.", campos };
    const conta = await meuPerfilEVitrine();
    if (conta?.perfil.id !== userId) return { erro: "Não conseguimos abrir sua conta agora. Tente novamente." };
    const cidades = await listarCidades(conta.perfil.microrregiao_id);
    if (cidade && !cidades.some((c) => c.nome === cidade)) {
      return { erro: "Confira a cidade.", campos: { cidade: "Escolha uma cidade disponível na sua região." } };
    }
    const db = await createClient();
    const { data, error } = await db.from("perfis").update({ nome, cidade: cidade || null, bairro: bairro || null })
      .eq("id", userId).select("id").maybeSingle();
    if (error || data?.id !== userId) return { erro: FALHOU };
    atualizarTelas();
    return { ok: true };
  } catch { return { erro: FALHOU }; }
}

/** Foto e confirmação vêm somente do usuário autenticado no Clerk, nunca do formulário. */
export async function atualizarPerfilClerk(): Promise<EstadoDados> {
  try {
    const { userId } = await auth();
    if (!userId) return { erro: SEM_LOGIN };
    const usuario = await currentUser();
    if (!usuario || usuario.id !== userId) return { erro: SEM_LOGIN };
    const sincronizacao = await sincronizarPerfil(usuario, true);
    atualizarTelas();
    return sincronizacao?.whatsappVinculado ? { ok: true, whatsappVinculado: true } : { ok: true };
  } catch { return { erro: "Não conseguimos atualizar a foto e a confirmação no Mercado da Região. Tente novamente." }; }
}

/** Compatibilidade com formulários antigos: nunca salva contato sem comprovar a posse. */
export async function salvarWhatsapp(_antes: EstadoDados, form: FormData): Promise<EstadoDados> {
  const { userId } = await auth();
  if (!userId) return { erro: SEM_LOGIN };
  const entrada = form.get("whatsapp");
  const numero = typeof entrada === "string" && entrada.length <= 30 ? await numeroComRegiao(entrada, () => dddDoPerfil(userId), whatsappDigitado) : null;
  if (!numero) return { erro: "Confira o WhatsApp.", campos: { whatsapp: "Digite um celular brasileiro com DDD." } };
  return { erro: "Para salvar o contato, use Confirmar ou trocar celular e confirme o código recebido no WhatsApp." };
}
