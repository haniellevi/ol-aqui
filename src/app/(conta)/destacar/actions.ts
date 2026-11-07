"use server";
// Ações da tela "Destacar". Quem garante dono, anúncio no ar, vagas, créditos e preço é o banco
// (contratar_destaque). Aqui só chamamos o banco e, quando é pago, o Asaas.
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { traduzirErro } from "@/lib/erros";
import { ehUuid } from "@/lib/formato";
import { documentoValido } from "@/lib/cpf-cnpj";
import { asaasConfigurado } from "@/lib/asaas";
import { meuPedidoDestaque } from "@/lib/dados/destaques";
import { ErroCobranca, cobrarPedido, situacaoPedido } from "@/lib/cobranca-destaque";
import type { Resultado } from "@/lib/tipos";
import type { FormaPagamento, PedidoDestaque, RespostaPagamento, SlugDestaque } from "@/lib/tipos-destaques";

const TIPOS: readonly SlugDestaque[] = ["subir", "busca", "home", "loja"];
const FORMAS: readonly FormaPagamento[] = ["pix", "cartao"];

const falha = (mensagem: string) => ({ ok: false as const, erro: { mensagem } });

function atualizar() {
  revalidatePath("/minha-conta/anuncios");
  revalidatePath("/minha-conta/loja");
  revalidatePath("/");
}

function conferir(tipo: string, anuncioId: string | null) {
  if (!TIPOS.includes(tipo as SlugDestaque)) return "Escolha um tipo de destaque.";
  if (anuncioId !== null && !ehUuid(anuncioId)) return "Anúncio não encontrado.";
  return null;
}

async function contratar(tipo: SlugDestaque, anuncioId: string | null, usarCredito: boolean) {
  const db = await createClient();
  const { data, error } = await db.rpc("contratar_destaque", { p_tipo: tipo, p_anuncio_id: anuncioId, p_usar_credito: usarCredito });
  if (error) return { erro: traduzirErro(error) };
  const linha = (Array.isArray(data) ? data[0] : data) as { destaque_id: string } | null;
  return { id: linha?.destaque_id ?? null };
}

/**
 * Ativa na hora, sem cobrança: com um crédito grátis do plano (`usarCredito`) ou quando o painel
 * deixou o preço do tipo em zero. O banco confere créditos e preço; se não for grátis, só cria o pedido.
 */
export async function usarCreditoDestaque(tipo: string, anuncioId: string | null, usarCredito = true): Promise<Resultado<PedidoDestaque>> {
  const invalido = conferir(tipo, anuncioId);
  if (invalido) return falha(invalido);
  const r = await contratar(tipo as SlugDestaque, anuncioId, usarCredito);
  if ("erro" in r) return { ok: false, erro: r.erro! };
  const pedido = r.id ? await meuPedidoDestaque(r.id) : null;
  if (!pedido) return falha("Algo deu errado. Tente de novo.");
  if (pedido.status !== "ativo") return falha("Este destaque não é grátis agora. Atualize a página para ver o preço.");
  atualizar();
  return { ok: true, dados: pedido };
}

/** Compra: cria o pedido (vaga guardada por alguns minutos) e já gera o Pix ou o link do cartão. */
export async function comprarDestaque(
  tipo: string,
  anuncioId: string | null,
  forma: string,
  documento: string | null,
): Promise<Resultado<RespostaPagamento>> {
  const invalido = conferir(tipo, anuncioId);
  if (invalido) return falha(invalido);
  if (!FORMAS.includes(forma as FormaPagamento)) return falha("Escolha Pix ou cartão.");
  if (documento && !documentoValido(documento)) return falha("CPF ou CNPJ inválido. Confira os números.");
  if (!asaasConfigurado()) return falha("Pagamento em breve. Por enquanto, use os destaques grátis do seu plano.");

  const r = await contratar(tipo as SlugDestaque, anuncioId, false);
  if ("erro" in r) return { ok: false, erro: r.erro! };
  if (!r.id) return falha("Algo deu errado. Tente de novo.");
  return pagar(r.id, forma as FormaPagamento, documento);
}

/** Paga um pedido que já existe (voltou depois, trocou Pix por cartão, faltava o CPF). */
export async function pagarPedidoDestaque(pedidoId: string, forma: string, documento: string | null): Promise<Resultado<RespostaPagamento>> {
  if (!ehUuid(pedidoId)) return falha("Pedido não encontrado.");
  if (!FORMAS.includes(forma as FormaPagamento)) return falha("Escolha Pix ou cartão.");
  if (documento && !documentoValido(documento)) return falha("CPF ou CNPJ inválido. Confira os números.");
  return pagar(pedidoId, forma as FormaPagamento, documento);
}

async function pagar(pedidoId: string, forma: FormaPagamento, documento: string | null): Promise<Resultado<RespostaPagamento>> {
  try {
    const resposta = await cobrarPedido(pedidoId, forma, documento);
    if (resposta.etapa === "ativo") atualizar();
    return { ok: true, dados: resposta };
  } catch (e) {
    if (e instanceof ErroCobranca) return falha(e.message);
    return falha("Algo deu errado com o pagamento. Tente de novo.");
  }
}

/** Tela de espera do Pix: pergunta a situação (e, de vez em quando, confere direto no Asaas). */
export async function verificarPedidoDestaque(pedidoId: string, perguntarAoAsaas: boolean): Promise<Resultado<PedidoDestaque>> {
  if (!ehUuid(pedidoId)) return falha("Pedido não encontrado.");
  const pedido = await situacaoPedido(pedidoId, perguntarAoAsaas);
  if (!pedido) return falha("Pedido não encontrado.");
  if (pedido.status === "ativo") atualizar();
  return { ok: true, dados: pedido };
}
