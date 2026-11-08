import "server-only";
import { auth } from "@clerk/nextjs/server";
import { meuPedidoDestaque } from "@/lib/dados/destaques";
import { apagarCobranca, ambienteAsaas, asaasConfigurado } from "@/lib/asaas";
import {
  ErroCobranca,
  conferirNoAsaas,
  garantirCobranca,
  lerPagamento,
  montarCobranca,
  podePerguntarAoAsaas,
  precisaDocumentoNoAsaas,
} from "@/lib/cobranca-pagamento";
import type { FormaPagamento, PedidoDestaque, RespostaPagamento } from "@/lib/tipos-destaques";

// Cobrança de um pedido de destaque no Asaas. O pedido e o pagamento nascem no banco
// (contratar_destaque, com o token da pessoa). A parte do Asaas (cliente, cobrança, Pix/cartão)
// é o núcleo comum em cobranca-pagamento.ts, o mesmo dos planos e do anúncio avulso.

export { ErroCobranca };

/**
 * Cria (ou reaproveita) a cobrança do pedido e devolve o Pix ou o link do cartão.
 * Sem cliente no Asaas e sem CPF/CNPJ válido → { etapa: "precisa_documento" }.
 */
export async function cobrarPedido(pedidoId: string, forma: FormaPagamento, documento?: string | null): Promise<RespostaPagamento> {
  const { userId } = await auth();
  if (!userId) throw new ErroCobranca("Entre na sua conta para continuar.");
  const pedido = await meuPedidoDestaque(pedidoId); // RLS: só o dono enxerga
  if (!pedido) throw new ErroCobranca("Pedido não encontrado.");
  if (pedido.status === "ativo") return { etapa: "ativo", pedido };
  if (pedido.status !== "aguardando_pagamento" || pedido.origem !== "pago" || !pedido.pagamento_id || pedido.pagamento_status !== "pendente") {
    throw new ErroCobranca("Este pedido não está mais esperando pagamento. Comece de novo.");
  }
  if (!asaasConfigurado()) throw new ErroCobranca("Pagamento em breve. Por enquanto, use os destaques grátis do seu plano.");

  const amb = await ambienteAsaas();
  let pg = await lerPagamento(pedido.pagamento_id);
  if (!pg || pg.status !== "pendente") throw new ErroCobranca("Este pedido não está mais esperando pagamento.");

  const r = await garantirCobranca({
    amb,
    pg,
    userId,
    forma,
    documento,
    descricao: `OLAKI · ${pedido.tipo_nome}`,
    naoEncontrado: "Pedido não encontrado.",
  });
  if (r === "precisa_documento") return { etapa: "precisa_documento", pedidoId: pedido.id };

  pg = await lerPagamento(pg.id);
  if (!pg?.asaas_cobranca_id) throw new ErroCobranca("Não deu para criar a cobrança. Tente de novo.");
  const atualizado = (await meuPedidoDestaque(pedido.id)) ?? pedido;
  if (atualizado.status === "ativo") return { etapa: "ativo", pedido: atualizado };
  return { etapa: "cobranca", pedido: atualizado, cobranca: await montarCobranca(amb, pg, (pg.forma as FormaPagamento) ?? forma) };
}

/**
 * Situação do pedido para a tela de espera. Com `perguntarAoAsaas`, confere direto no Asaas
 * (se o aviso do webhook atrasar, ativa do mesmo jeito: confirmar_pagamento é idempotente).
 * O pedido da tela é só um pedido: quem decide se pergunta agora é o banco (podePerguntarAoAsaas).
 * Pedido cancelado com cobrança vencida/cancelada: apaga a cobrança no Asaas, para o Pix antigo
 * não ser pago por engano (o banco também não liga um pedido cancelado pela equipe).
 */
export async function situacaoPedido(pedidoId: string, perguntarAoAsaas: boolean): Promise<PedidoDestaque | null> {
  const pedido = await meuPedidoDestaque(pedidoId);
  if (!pedido || !pedido.tem_cobranca || !asaasConfigurado()) return pedido;
  if (pedido.status === "cancelado") {
    if (pedido.pagamento_status === "vencido" || pedido.pagamento_status === "cancelado") await apagarCobrancaDoPedido(pedido);
    return pedido;
  }
  if (pedido.status !== "aguardando_pagamento" || !perguntarAoAsaas) return pedido;
  if (pedido.pagamento_id && (await conferirNoAsaas(pedido.pagamento_id))) return (await meuPedidoDestaque(pedidoId)) ?? pedido;
  return pedido;
}

/**
 * Apaga no Asaas a cobrança de um pedido que não vale mais (cancelado, vencido). Só o servidor chama,
 * e só para pagamento que não foi pago. Devolve true quando a cobrança não pode mais ser paga.
 */
export async function apagarCobrancaDoPedido(pedido: Pick<PedidoDestaque, "pagamento_id">): Promise<boolean> {
  if (!pedido.pagamento_id || !asaasConfigurado()) return false;
  try {
    const pg = await lerPagamento(pedido.pagamento_id);
    if (!pg?.asaas_cobranca_id || pg.status === "pago" || pg.status === "estornado" || pg.status === "pendente") return false;
    if (!(await podePerguntarAoAsaas(pg.id))) return false;
    return await apagarCobranca(await ambienteAsaas(), pg.asaas_cobranca_id);
  } catch {
    return false;
  }
}

/** true quando a pessoa ainda não tem cliente no Asaas neste ambiente (a tela pede o CPF/CNPJ). */
export async function precisaDocumento(vitrineId: string): Promise<boolean> {
  if (!asaasConfigurado()) return false;
  return precisaDocumentoNoAsaas(vitrineId);
}
