import "server-only";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { meuPedidoDestaque } from "@/lib/dados/destaques";
import { documentoValido } from "@/lib/cpf-cnpj";
import {
  ErroAsaas,
  STATUS_PAGO,
  ambienteAsaas,
  apagarCobranca,
  asaasConfigurado,
  clienteDoAmbiente,
  consultarCobranca,
  criarCliente,
  criarCobranca,
  qrCodePix,
  trocarForma,
  type AmbienteAsaas,
} from "@/lib/asaas";
import type { Cobranca, FormaPagamento, PedidoDestaque, RespostaPagamento } from "@/lib/tipos-destaques";

// Cobrança de um pedido de destaque no Asaas. O pedido e o pagamento nascem no banco
// (contratar_destaque, com o token da pessoa). Aqui o servidor cria o cliente e a cobrança
// no Asaas e grava os ids com a chave secreta (registrar_cobranca_asaas). O CPF/CNPJ vai
// só para o Asaas: o OLAKI guarda apenas o id do cliente.

export class ErroCobranca extends Error {}

type LinhaPagamento = {
  id: string;
  vitrine_id: string;
  valor_centavos: number;
  vencimento: string | null;
  status: string;
  forma: string | null;
  asaas_cobranca_id: string | null;
  link_pagamento: string | null;
};

const hojeFortaleza = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

async function lerPagamento(id: string): Promise<LinhaPagamento | null> {
  const { data } = await supabaseAdmin()
    .from("pagamentos")
    .select("id, vitrine_id, valor_centavos, vencimento, status, forma, asaas_cobranca_id, link_pagamento")
    .eq("id", id)
    .maybeSingle<LinhaPagamento>();
  return data ?? null;
}

async function montarCobranca(amb: AmbienteAsaas, pg: LinhaPagamento, forma: FormaPagamento): Promise<Cobranca> {
  const id = pg.asaas_cobranca_id!;
  if (forma === "cartao") {
    if (!pg.link_pagamento) throw new ErroCobranca("Não achamos a página de pagamento. Tente de novo.");
    return { forma: "cartao", link: pg.link_pagamento };
  }
  try {
    const qr = await qrCodePix(amb, id);
    return { forma: "pix", qrCodeBase64: qr.encodedImage ?? null, copiaECola: qr.payload ?? null, link: pg.link_pagamento };
  } catch {
    // sem QR (instabilidade): a página do Asaas também mostra o Pix
    return { forma: "pix", qrCodeBase64: null, copiaECola: null, link: pg.link_pagamento };
  }
}

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

  const db = supabaseAdmin();
  const amb = await ambienteAsaas();
  let pg = await lerPagamento(pedido.pagamento_id);
  if (!pg || pg.status !== "pendente") throw new ErroCobranca("Este pedido não está mais esperando pagamento.");

  const { data: vitrine } = await db
    .from("vitrines_lojas")
    .select("id, nome, tipo, dono_id, gateway_cliente_id, perfis(nome)")
    .eq("id", pg.vitrine_id)
    .maybeSingle<{ id: string; nome: string; tipo: string; dono_id: string; gateway_cliente_id: string | null; perfis: { nome: string } | null }>();
  if (!vitrine || vitrine.dono_id !== userId) throw new ErroCobranca("Pedido não encontrado.");

  try {
    if (!pg.asaas_cobranca_id) {
      let cliente = clienteDoAmbiente(vitrine.gateway_cliente_id, amb);
      if (!cliente) {
        if (!documento || !documentoValido(documento)) return { etapa: "precisa_documento", pedidoId: pedido.id };
        const nome = vitrine.tipo === "loja" ? vitrine.nome : vitrine.perfis?.nome || vitrine.nome;
        cliente = await criarCliente(amb, { nome, documento, referencia: vitrine.id });
        await db.from("vitrines_lojas").update({ gateway_cliente_id: `${amb}:${cliente}` }).eq("id", vitrine.id);
      }
      const venc = pg.vencimento && pg.vencimento >= hojeFortaleza() ? pg.vencimento : hojeFortaleza();
      const nova = await criarCobranca(amb, {
        cliente,
        forma,
        centavos: pg.valor_centavos,
        vencimento: venc,
        descricao: `OLAKI · ${pedido.tipo_nome}`,
        referencia: pg.id,
      });
      const { data: gravou, error } = await db.rpc("registrar_cobranca_asaas", {
        p_pagamento_id: pg.id,
        p_cobranca_id: nova.id,
        p_link: nova.invoiceUrl,
        p_forma: forma,
      });
      if (error || gravou !== true) await apagarCobranca(amb, nova.id); // outro clique já criou uma: fica a primeira
    } else if (pg.forma !== forma) {
      const trocada = await trocarForma(amb, pg.asaas_cobranca_id, forma);
      await db.rpc("registrar_cobranca_asaas", {
        p_pagamento_id: pg.id,
        p_cobranca_id: pg.asaas_cobranca_id,
        p_link: trocada.invoiceUrl ?? pg.link_pagamento,
        p_forma: forma,
      });
    }
  } catch (e) {
    if (e instanceof ErroAsaas) {
      throw new ErroCobranca(
        e.status === 400 ? `O pagamento não foi aceito: ${e.message}` : "O sistema de pagamento não respondeu. Tente de novo em instantes.",
      );
    }
    throw e;
  }

  pg = await lerPagamento(pg.id);
  if (!pg?.asaas_cobranca_id) throw new ErroCobranca("Não deu para criar a cobrança. Tente de novo.");
  const atualizado = (await meuPedidoDestaque(pedido.id)) ?? pedido;
  if (atualizado.status === "ativo") return { etapa: "ativo", pedido: atualizado };
  return { etapa: "cobranca", pedido: atualizado, cobranca: await montarCobranca(amb, pg, (pg.forma as FormaPagamento) ?? forma) };
}

/**
 * Situação do pedido para a tela de espera. Com `perguntarAoAsaas`, confere direto no Asaas
 * (se o aviso do webhook atrasar, ativa do mesmo jeito: confirmar_pagamento é idempotente).
 */
export async function situacaoPedido(pedidoId: string, perguntarAoAsaas: boolean): Promise<PedidoDestaque | null> {
  const pedido = await meuPedidoDestaque(pedidoId);
  if (!pedido || pedido.status !== "aguardando_pagamento" || !perguntarAoAsaas || !pedido.tem_cobranca || !asaasConfigurado()) {
    return pedido;
  }
  try {
    const pg = pedido.pagamento_id ? await lerPagamento(pedido.pagamento_id) : null;
    if (!pg?.asaas_cobranca_id || pg.status !== "pendente") return pedido;
    const amb = await ambienteAsaas();
    const c = await consultarCobranca(amb, pg.asaas_cobranca_id);
    if (STATUS_PAGO.has(String(c.status))) {
      await supabaseAdmin().rpc("confirmar_pagamento", {
        p_asaas_cobranca_id: pg.asaas_cobranca_id,
        p_payload: { event: "CONSULTA_OLAKI", payment: c },
      });
      return (await meuPedidoDestaque(pedidoId)) ?? pedido;
    }
  } catch {
    /* tenta de novo na próxima pergunta */
  }
  return pedido;
}
