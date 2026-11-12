"use server";
// Ações de pagamento do plano e do anúncio avulso. Quem confere dono, plano à venda, período,
// limite de pendentes, anúncio completo e preço é o banco (pedir_assinatura, pedir_anuncio_avulso).
// Aqui só chamamos o banco e o Asaas (núcleo comum em cobranca-pagamento.ts).
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { traduzirErro } from "@/lib/erros";
import { ehUuid } from "@/lib/formato";
import { documentoValido } from "@/lib/cpf-cnpj";
import { asaasConfigurado } from "@/lib/asaas";
import { ErroCobranca, apagarCanceladasNoAsaas, cobrarMeuPagamento, situacaoMeuPagamento } from "@/lib/cobranca-pagamento";
import type { Resultado } from "@/lib/tipos";
import type { FormaPagamento, MeuPagamento, RespostaCobranca } from "@/lib/tipos-cobranca";

export type ResultadoCobranca = Resultado<RespostaCobranca> & { pagamentoId?: string };

const FORMAS: readonly FormaPagamento[] = ["pix", "cartao"];
const EM_BREVE = "Pagamento em breve. Fale com a equipe Mercado da Região se precisar agora.";

const falha = (mensagem: string, campo?: string) => ({ ok: false as const, erro: { mensagem, campo } });

function atualizar() {
  revalidatePath("/minha-conta");
  revalidatePath("/minha-conta/plano");
  revalidatePath("/minha-conta/anuncios");
  revalidatePath("/anunciar");
}

function conferirForma(forma: string, documento: string | null) {
  if (typeof forma !== "string" || !FORMAS.includes(forma as FormaPagamento)) return "Escolha Pix ou cartão.";
  if (documento !== null && (typeof documento !== "string" || documento.length > 30 || (documento !== "" && !documentoValido(documento)))) return "CPF ou CNPJ inválido. Confira os números.";
  return null;
}

async function cobrar(pagamentoId: string, forma: FormaPagamento, documento: string | null): Promise<ResultadoCobranca> {
  try {
    const resposta = await cobrarMeuPagamento(pagamentoId, forma, documento);
    if (resposta.etapa === "pago") atualizar();
    return { ok: true, dados: resposta };
  } catch (e) {
    if (e instanceof ErroCobranca) return { ...falha(e.message), pagamentoId };
    return { ...falha("Não foi possível confirmar a cobrança. Retome este pagamento em instantes."), pagamentoId };
  }
}

/** Pede a cobrança de um plano num período (`meses`) e já gera o Pix ou o link do cartão. */
export async function pedirPlano(plano: string, meses: number, forma: string, documento: string | null, valorEsperado: number): Promise<ResultadoCobranca> {
  try {
    const { userId } = await auth();
    if (!userId) return falha("Entre na sua conta para continuar.");
    if (typeof plano !== "string" || !plano || plano.length > 60) return falha("Escolha um plano.");
    if (!Number.isInteger(meses) || meses < 1 || meses > 36) return falha("Escolha um dos períodos da lista.");
    const invalido = conferirForma(forma, documento);
    if (invalido) return falha(invalido);
    if (!asaasConfigurado()) return falha(EM_BREVE);

    if (!Number.isSafeInteger(valorEsperado) || valorEsperado <= 0) return falha("Confira o preço do plano antes de pagar.");
    const db = await createClient();
    const { data, error } = await db.rpc("pedir_assinatura_site", { p_plano: plano, p_meses: meses, p_valor_esperado: valorEsperado });
    if (error) return { ok: false, erro: traduzirErro(error) };
    const linha = (Array.isArray(data) ? data[0] : data) as { pagamento_id: string; cancelados: string[] | null } | null;
    if (!linha || !ehUuid(linha.pagamento_id)) return falha("Algo deu errado. Tente de novo.");
    // as outras cobranças de plano que esperavam pagamento foram canceladas no banco: apaga no Asaas
    await apagarCanceladasNoAsaas(linha.cancelados ?? []);
    return cobrar(linha.pagamento_id, forma as FormaPagamento, documento);
  } catch {
    return falha("Não foi possível consultar o pagamento. Confira a conexão e tente novamente.");
  }
}

/** Pede a cobrança do anúncio avulso de um anúncio completo e já gera o Pix ou o link do cartão. */
export async function pedirAvulso(anuncioId: string, forma: string, documento: string | null): Promise<ResultadoCobranca> {
  try {
    const { userId } = await auth();
    if (!userId) return falha("Entre na sua conta para continuar.");
    if (!ehUuid(anuncioId)) return falha("Anúncio não encontrado.");
    const invalido = conferirForma(forma, documento);
    if (invalido) return falha(invalido);
    if (!asaasConfigurado()) return falha(EM_BREVE);

    const db = await createClient();
    const { data, error } = await db.rpc("pedir_anuncio_avulso", { p_anuncio_id: anuncioId });
    if (error) return { ok: false, erro: traduzirErro(error) };
    const linha = (Array.isArray(data) ? data[0] : data) as { pagamento_id: string } | null;
    if (!linha || !ehUuid(linha.pagamento_id)) return falha("Algo deu errado. Tente de novo.");
    return cobrar(linha.pagamento_id, forma as FormaPagamento, documento);
  } catch {
    return falha("Não foi possível consultar o pagamento. Confira a conexão e tente novamente.");
  }
}

/** Paga uma cobrança que já existe (voltou depois, trocou Pix por cartão, faltava o CPF). */
export async function pagarCobranca(pagamentoId: string, forma: string, documento: string | null): Promise<ResultadoCobranca> {
  try {
    const { userId } = await auth();
    if (!userId) return falha("Entre na sua conta para continuar.");
    if (!ehUuid(pagamentoId)) return falha("Pagamento não encontrado.");
    const invalido = conferirForma(forma, documento);
    if (invalido) return falha(invalido);
    return cobrar(pagamentoId, forma as FormaPagamento, documento);
  } catch {
    return falha("Não foi possível consultar o pagamento. Confira a conexão e tente novamente.");
  }
}

/** Tela de espera do Pix: pergunta a situação (e, de vez em quando, confere direto no Asaas). */
export async function verificarCobranca(pagamentoId: string, perguntarAoAsaas: boolean): Promise<Resultado<MeuPagamento>> {
  try {
    const { userId } = await auth();
    if (!userId) return falha("Entre na sua conta para continuar.");
    if (!ehUuid(pagamentoId)) return falha("Pagamento não encontrado.");
    const pagamento = await situacaoMeuPagamento(pagamentoId, perguntarAoAsaas === true);
    if (!pagamento || pagamento.tipo === "destaque") return falha("Pagamento não encontrado.");
    if (pagamento.status === "pago") atualizar();
    return { ok: true, dados: pagamento };
  } catch {
    return falha("Não foi possível consultar o pagamento. Confira a conexão e tente novamente.");
  }
}
