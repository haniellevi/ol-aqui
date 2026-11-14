"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { limparInstagram, linkSiteLoja } from "@/components/vitrine/regras";
import { comAssistente } from "@/lib/assistente";
import { resultadoCadastroLoja, validarCadastroLoja } from "@/lib/cadastro-loja";
import { traduzirErro } from "@/lib/erros";
import { normalizarFonte } from "@/lib/loja-ia/fontes";
import { finalizarMaterial, prepararImagemPublicacao, prepararMaterial, urlRevisaoMaterial, type MetadadosImagem } from "@/lib/loja-ia/imagens";
import { gerarModeloCapa } from "@/lib/loja-ia/modelo-capa";
import type { CamposRascunho, EntradaRascunho, FonteLoja, RascunhoLoja, RespostaLojaIa } from "@/lib/loja-ia/tipos";
import { createClient } from "@/lib/supabase/server";
import type { EstadoLoja } from "../../actions";

const PAGINA = "/quero-vender/loja/criar-com-ia";

function erroAcao(erro: Parameters<typeof traduzirErro>[0]): Error {
  return new ErroLojaIa(erro?.code === "40001" ? "O rascunho mudou. Atualize a página para tentar novamente." : traduzirErro(erro).mensagem);
}

async function responder<T>(acao: () => Promise<T>, falha: string): Promise<RespostaLojaIa<T>> {
  try {
    return { ok: true, dados: await acao() };
  } catch (erro) {
    return { ok: false, erro: erro instanceof ErroLojaIa ? erro.message : falha };
  }
}

class ErroLojaIa extends Error {}

async function rascunhoRpc(rpc: string, args?: Record<string, unknown>): Promise<RascunhoLoja> {
  const db = await createClient();
  const { data, error } = await db.rpc(rpc, args);
  if (error || !data?.id) throw erroAcao(error);
  return data as RascunhoLoja;
}

export async function abrirRascunho(assistente?: string) {
  try {
    await rascunhoRpc("loja_ia_abrir_coleta");
  } catch {
    redirect(comAssistente("/quero-vender/loja?aviso=ia", assistente));
  }
  redirect(comAssistente(PAGINA, assistente));
}

export async function salvarColeta(id: string, revisao: number, entrada: EntradaRascunho) {
  return responder(async () => {
    for (const [fonte, nome] of [["site", "site"], ["instagram", "Instagram"], ["facebook", "Facebook"]] as const) {
      const valor = entrada[fonte]?.trim();
      if (valor && !normalizarFonte(fonte, valor)) throw new ErroLojaIa(`Confira o link ou perfil de ${nome}.`);
    }
    const rascunho = await rascunhoRpc("loja_ia_salvar_coleta", { p_id: id, p_revisao: revisao, p_entrada: entrada });
    return { revisao: rascunho.revisao };
  }, "Não foi possível salvar. Tente novamente.");
}

export async function prepararEnvio(id: string, arquivo: MetadadosImagem, tipo: "logo" | "foto") {
  return responder(async () => prepararMaterial(id, arquivo, tipo), "Não foi possível preparar o envio. Use uma imagem JPEG, PNG ou WebP de até 20 MB.");
}

export async function finalizarEnvio(id: string, imagemId: string) {
  return responder(async () => finalizarMaterial(id, imagemId), "Não foi possível processar a imagem. Tente enviar outro arquivo.");
}

export async function iniciarRascunho(id: string, revisao: number) {
  return responder(async () => {
    await rascunhoRpc("loja_ia_iniciar", { p_id: id, p_revisao: revisao });
    revalidatePath(PAGINA);
    revalidatePath("/minha-conta/lojas");
  }, "Não foi possível iniciar o rascunho. Tente novamente.");
}

export async function salvarRevisao(id: string, revisao: number, edicoes: Partial<Record<keyof CamposRascunho, string | null>>) {
  return responder(() => rascunhoRpc("loja_ia_salvar_revisao", { p_id: id, p_revisao: revisao, p_edicoes: edicoes }), "Não foi possível salvar a revisão.");
}

export async function retentarFonte(id: string, fonte: FonteLoja) {
  return responder(() => rascunhoRpc("loja_ia_retentar_fonte", { p_id: id, p_fonte: fonte }), "Não foi possível consultar a fonte novamente.");
}

export async function revogarWhatsapp(id: string) {
  return responder(() => rascunhoRpc("loja_ia_revogar_whatsapp", { p_id: id, p_consulta: true, p_aviso: true }), "Não foi possível retirar a autorização.");
}

export async function gerarCapa(id: string) {
  return responder(async () => {
    const material = await gerarModeloCapa(id);
    return { id: material.id, url: await urlRevisaoMaterial(id, material.id) };
  }, "Não foi possível criar o modelo de capa agora.");
}

export async function confirmarLojaIa(id: string, revisao: number, form: FormData): Promise<EstadoLoja> {
  const db = await createClient();
  const { data: rascunho, error: erroRascunho } = await db.rpc("loja_ia_obter");
  if (erroRascunho) return { erro: traduzirErro(erroRascunho) };
  // Se a resposta se perdeu depois do commit, o banco identifica a confirmação anterior pelo próprio rascunho.
  if (!rascunho) {
    const { data, error } = await db.rpc("loja_ia_publicar", {
      p_id: id, p_revisao: revisao, p_campos: null, p_imagens: null,
    });
    return resultadoCadastroLoja(data, error);
  }

  const cadastro = await validarCadastroLoja(form);
  if (!cadastro.campos) return cadastro.estado ?? null;
  const endereco = String(form.get("endereco") ?? "").replace(/\s+/g, " ").trim();
  const instagram = limparInstagram(String(form.get("instagram") ?? ""));
  const siteDigitado = String(form.get("site") ?? "").trim();
  const site = siteDigitado ? linkSiteLoja(siteDigitado) : null;
  const problemas: Record<string, string> = {};
  if (endereco.length > 160) problemas.endereco = "O endereço pode ter até 160 caracteres.";
  if (instagram && (!/^[a-z0-9._]{1,30}$/.test(instagram) || instagram.includes(".."))) problemas.instagram = "Informe um perfil do Instagram válido.";
  if (siteDigitado && !site) problemas.site = "Informe um site válido, incluindo https://.";
  if (Object.keys(problemas).length) return { erro: { mensagem: "Confira os campos marcados." }, campos: problemas };

  const imagens: { logo?: string; capa?: string } = {};
  for (const uso of ["logo", "capa"] as const) {
    const idImagem = String(form.get(uso) ?? "");
    if (!idImagem) continue;
    try {
      imagens[uso] = (await prepararImagemPublicacao(id, idImagem, uso)).id;
    } catch {
      // A primeira confirmação pode ter ocorrido entre a leitura e a preparação.
      const { data } = await db.rpc("loja_ia_publicar", { p_id: id, p_revisao: revisao, p_campos: null, p_imagens: null });
      if (data) return resultadoCadastroLoja(data, null);
      return { erro: { mensagem: "Confira as imagens da loja." }, campos: { [uso]: "Selecione outra imagem ou deixe em branco." } };
    }
  }
  const { data, error } = await db.rpc("loja_ia_publicar", {
    p_id: id, p_revisao: revisao, p_campos: { ...cadastro.campos, endereco, instagram, site }, p_imagens: imagens,
  });
  if (error?.code === "40001") return { erro: { mensagem: erroAcao(error).message } };
  const resultado = resultadoCadastroLoja(data, error);
  if (resultado?.feito) revalidatePath("/minha-conta/lojas");
  return resultado;
}
