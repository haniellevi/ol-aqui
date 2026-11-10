import "server-only";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { meuPagamento } from "@/lib/dados/cobranca";
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
  buscarCobrancaPorReferencia,
  qrCodePix,
  trocarForma,
  type AmbienteAsaas,
} from "@/lib/asaas";
import { linkPagamentoSeguro } from "@/lib/link-pagamento";
import type { Cobranca, FormaPagamento } from "@/lib/tipos-destaques";
import type { MeuPagamento, RespostaCobranca } from "@/lib/tipos-cobranca";

// Núcleo comum da cobrança no Asaas (destaques, planos e anúncio avulso). O pagamento nasce no
// banco com o token da pessoa (contratar_destaque, pedir_assinatura, pedir_anuncio_avulso).
// Aqui o servidor cria o cliente e a cobrança no Asaas e grava os ids com a chave secreta
// (registrar_cobranca_asaas). O CPF/CNPJ vai só para o Asaas: o Mercado da Região guarda só o id do cliente.

export class ErroCobranca extends Error {}

export type LinhaPagamento = {
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

export async function lerPagamento(id: string): Promise<LinhaPagamento | null> {
  const { data, error } = await supabaseAdmin()
    .from("pagamentos")
    .select("id, vitrine_id, valor_centavos, vencimento, status, forma, asaas_cobranca_id, link_pagamento")
    .eq("id", id)
    .maybeSingle<LinhaPagamento>();
  if (error) throw new ErroCobranca("Não foi possível consultar o pagamento.");
  return data ?? null;
}

/**
 * Limite de perguntas ao Asaas, decidido no banco (cobranca.consulta_intervalo_segundos):
 * no máximo uma pergunta por pagamento a cada poucos segundos, seja o que for que a tela peça.
 */
export async function podePerguntarAoAsaas(pagamentoId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin().rpc("marcar_consulta_asaas", { p_pagamento_id: pagamentoId });
  return !error && data === true;
}

export async function montarCobranca(amb: AmbienteAsaas, pg: LinhaPagamento, forma: FormaPagamento): Promise<Cobranca> {
  const id = pg.asaas_cobranca_id!;
  const link = linkPagamentoSeguro(pg.link_pagamento);
  if (forma === "cartao") {
    if (!link) throw new ErroCobranca("Não achamos a página de pagamento. Tente de novo.");
    return { forma: "cartao", link: link! };
  }
  try {
    const qr = await qrCodePix(amb, id);
    return { forma: "pix", qrCodeBase64: qr.encodedImage ?? null, copiaECola: qr.payload ?? null, link };
  } catch {
    // sem QR (instabilidade): a página do Asaas também mostra o Pix
    if (!link) throw new ErroCobranca("Não foi possível carregar o Pix. Retome este pagamento em instantes.");
    return { forma: "pix", qrCodeBase64: null, copiaECola: null, link };
  }
}

/**
 * Garante a cobrança no Asaas de um pagamento pendente do usuário: cria o cliente (com o CPF/CNPJ,
 * que não é guardado), cria a cobrança ou troca Pix/cartão. Uma reserva persistente impede
 * POSTs concorrentes. Respostas perdidas são reconciliadas pela referência, sem recriar.
 * Sem cliente no Asaas e sem CPF/CNPJ válido → "precisa_documento".
 */
export async function garantirCobranca(opcoes: {
  amb: AmbienteAsaas;
  pg: LinhaPagamento;
  userId: string;
  forma: FormaPagamento;
  documento?: string | null;
  descricao: string;
  naoEncontrado: string;
}): Promise<"ok" | "precisa_documento"> {
  const { amb, pg, userId, forma, documento, descricao, naoEncontrado } = opcoes;
  const db = supabaseAdmin();
  const { data: vitrine } = await db
    .from("vitrines_lojas")
    .select("id, nome, tipo, dono_id, gateway_cliente_id, perfis(nome)")
    .eq("id", pg.vitrine_id)
    .maybeSingle<{ id: string; nome: string; tipo: string; dono_id: string; gateway_cliente_id: string | null; perfis: { nome: string } | null }>();
  if (!vitrine || vitrine.dono_id !== userId) throw new ErroCobranca(naoEncontrado);

  if (pg.status === "pago") return "ok";
  if (pg.status !== "pendente") throw new ErroCobranca("Esta cobrança não está mais esperando pagamento.");

  let reservou = false;
  let enviouCriacao = false;
  try {
    if (!pg.asaas_cobranca_id) {
      let cliente = clienteDoAmbiente(vitrine.gateway_cliente_id, amb);
      if (!cliente && (!documento || !documentoValido(documento))) return "precisa_documento";
      const reserva = await db.rpc("reservar_criacao_asaas", { p_pagamento_id: pg.id, p_ambiente: amb });
      if (reserva.error) throw new ErroCobranca("Não foi possível preparar o pagamento com segurança. Tente novamente.");
      reservou = reserva.data === true;
      if (!reservou) {
        const atual = await lerPagamento(pg.id);
        if (atual?.asaas_cobranca_id) return garantirCobranca({ ...opcoes, pg: atual });
      }
      const encontrada = await buscarCobrancaPorReferencia(amb, pg.id);
      if (encontrada && (encontrada.deleted || encontrada.externalReference !== pg.id || !cliente || encontrada.customer !== cliente || Math.round(encontrada.value * 100) !== pg.valor_centavos || !["PIX", "CREDIT_CARD"].includes(encontrada.billingType))) {
        throw new ErroCobranca("A cobrança precisa ser conferida pela equipe. Nenhuma nova cobrança foi criada.");
      }
      if (!encontrada && !reservou) throw new ErroCobranca("A tentativa anterior ainda está sendo conferida. Aguarde e tente retomar este pagamento. Se continuar, fale com o suporte.");
      if (!cliente) {
        const nome = vitrine.tipo === "loja" ? vitrine.nome : vitrine.perfis?.nome || vitrine.nome;
        cliente = await criarCliente(amb, { nome, documento: documento!, referencia: vitrine.id });
        const salvo = await db.from("vitrines_lojas").update({ gateway_cliente_id: `${amb}:${cliente}` }).eq("id", vitrine.id).select("id").maybeSingle();
        if (salvo.error || salvo.data?.id !== vitrine.id) throw new ErroCobranca("Não foi possível preparar os dados do pagamento. Tente novamente.");
      }
      const venc = pg.vencimento && pg.vencimento >= hojeFortaleza() ? pg.vencimento : hojeFortaleza();
      enviouCriacao = !encontrada;
      const nova = encontrada ?? await criarCobranca(amb, { cliente, forma, centavos: pg.valor_centavos, vencimento: venc, descricao, referencia: pg.id });
      if (!nova.id || Math.round(nova.value * 100) !== pg.valor_centavos || !["PIX", "CREDIT_CARD"].includes(nova.billingType)) throw new ErroCobranca("A resposta do pagamento precisa ser conferida. Retome em instantes.");
      const formaReal = nova.billingType === "CREDIT_CARD" ? "cartao" : "pix";
      const { data: gravou, error } = await db.rpc("registrar_cobranca_asaas", {
        p_pagamento_id: pg.id, p_cobranca_id: nova.id, p_link: linkPagamentoSeguro(nova.invoiceUrl), p_forma: formaReal,
      });
      if (error || gravou !== true) {
        const conferido = await lerPagamento(pg.id);
        if (conferido?.asaas_cobranca_id !== nova.id) throw new ErroCobranca("Não foi possível confirmar a cobrança. Retome este pagamento em instantes.");
      }
      if (STATUS_PAGO.has(nova.status)) {
        const confirmado = await db.rpc("confirmar_pagamento", { p_asaas_cobranca_id: nova.id, p_payload: { event: "RECONCILIACAO_OLAKI", payment: nova } });
        if (confirmado.error) throw new ErroCobranca("Pagamento localizado. Aguarde a confirmação e consulte novamente.");
      }
    } else if (pg.forma !== forma) {
      if (!(await podePerguntarAoAsaas(pg.id))) throw new ErroCobranca("Espere alguns segundos e tente de novo.");
      const trocada = await trocarForma(amb, pg.asaas_cobranca_id, forma);
      const registrado = await db.rpc("registrar_cobranca_asaas", {
        p_pagamento_id: pg.id,
        p_cobranca_id: pg.asaas_cobranca_id,
        p_link: linkPagamentoSeguro(trocada.invoiceUrl ?? pg.link_pagamento),
        p_forma: forma,
      });
      if (registrado.error || registrado.data !== true) throw new ErroCobranca("Não foi possível confirmar a forma de pagamento. Consulte novamente.");
    }
  } catch (e) {
    // Sem POST ou recusa explícita: seguro liberar. Timeout/5xx após POST preservam a reserva.
    if (reservou && (!enviouCriacao || (e instanceof ErroAsaas && e.status === 400))) {
      await db.from("asaas_criacoes").delete().eq("pagamento_id", pg.id).eq("ambiente", amb);
    }
    if (e instanceof ErroAsaas) {
      throw new ErroCobranca(
        e.status === 400 ? `O pagamento não foi aceito: ${e.message}` : "O sistema de pagamento não respondeu. Tente de novo em instantes.",
      );
    }
    throw e;
  }
  return "ok";
}

/**
 * Pergunta ao Asaas se um pagamento pendente já foi pago (o aviso do webhook pode atrasar) e, se foi,
 * confirma no banco (confirmar_pagamento é idempotente). Respeita o limite de perguntas do banco.
 * Nunca lança: em erro tenta de novo na próxima pergunta. Devolve true quando confirmou agora.
 */
export async function conferirNoAsaas(pagamentoId: string): Promise<boolean> {
  try {
    const pg = await lerPagamento(pagamentoId);
    if (!pg?.asaas_cobranca_id || pg.status !== "pendente") return false;
    if (!(await podePerguntarAoAsaas(pg.id))) return false;
    const amb = await ambienteAsaas();
    const c = await consultarCobranca(amb, pg.asaas_cobranca_id);
    if (!STATUS_PAGO.has(String(c.status))) return false;
    const confirmado = await supabaseAdmin().rpc("confirmar_pagamento", {
      p_asaas_cobranca_id: pg.asaas_cobranca_id,
      p_payload: { event: "CONSULTA_OLAKI", payment: c },
    });
    return !confirmado.error;
  } catch {
    return false;
  }
}

/**
 * Apaga no Asaas cobranças que o banco já cancelou (ex.: a pessoa trocou de plano antes de pagar),
 * para o Pix antigo não ser pago por engano. Só cobranças que o banco diz que não foram pagas.
 */
export async function apagarCanceladasNoAsaas(asaasIds: string[]): Promise<void> {
  if (asaasIds.length === 0) return;
  try {
    const amb = await ambienteAsaas();
    const { data } = await supabaseAdmin()
      .from("pagamentos")
      .select("asaas_cobranca_id")
      .in("asaas_cobranca_id", asaasIds)
      .in("status", ["cancelado", "vencido"]);
    for (const l of (data ?? []) as { asaas_cobranca_id: string }[]) {
      try {
        await apagarCobranca(amb, l.asaas_cobranca_id);
      } catch {
        /* se não apagar agora, a cobrança vence sozinha; paga assim mesmo, ela vale */
      }
    }
  } catch {
    /* idem */
  }
}

/** true quando a pessoa ainda não tem cliente no Asaas neste ambiente (a tela pede o CPF/CNPJ). */
export async function precisaDocumentoNoAsaas(vitrineId: string): Promise<boolean> {
  try {
    const [amb, { data }] = await Promise.all([
      ambienteAsaas(),
      supabaseAdmin().from("vitrines_lojas").select("gateway_cliente_id").eq("id", vitrineId).maybeSingle<{ gateway_cliente_id: string | null }>(),
    ]);
    return !clienteDoAmbiente(data?.gateway_cliente_id, amb);
  } catch {
    return true;
  }
}

// ---------------------------------------------------------------- planos e anúncio avulso

function descricaoDe(p: MeuPagamento): string {
  if (p.tipo === "anuncio_avulso") return "Mercado da Região · Anúncio avulso";
  const nome = p.plano_nome ?? p.plano_codigo ?? "plano";
  return `Mercado da Região · Plano ${nome}${p.meses > 1 ? ` (${p.meses} períodos)` : ""}`;
}

/** null quando o pagamento ainda pode ser cobrado; senão o motivo (cobranca_pode_seguir, com o token da pessoa). */
async function motivoParaNaoCobrar(pagamentoId: string): Promise<string | null> {
  const db = await createClient();
  const { data, error } = await db.rpc("cobranca_pode_seguir", { p_pagamento_id: pagamentoId });
  if (error) return "Não deu para conferir a cobrança agora. Tente de novo.";
  return typeof data === "string" && data ? data : null;
}

/**
 * Cria (ou reaproveita) a cobrança no Asaas de um pagamento de plano ou de anúncio avulso do
 * vendedor logado e devolve o Pix ou o link do cartão. Já pago → { etapa: "pago" }.
 */
export async function cobrarMeuPagamento(pagamentoId: string, forma: FormaPagamento, documento?: string | null): Promise<RespostaCobranca> {
  const { userId } = await auth();
  if (!userId) throw new ErroCobranca("Entre na sua conta para continuar.");
  const meu = await meuPagamento(pagamentoId); // RLS: só o dono enxerga
  if (!meu || meu.tipo === "destaque") throw new ErroCobranca("Pagamento não encontrado.");
  if (meu.status === "pago") return { etapa: "pago", pagamento: meu };
  if (meu.status !== "pendente") throw new ErroCobranca("Esta cobrança não está mais esperando pagamento. Comece de novo.");
  if (!asaasConfigurado()) throw new ErroCobranca("Pagamento em breve. Fale com a equipe Mercado da Região se precisar agora.");

  // A cobrança pode ter nascido antes de a conta ser suspensa ou de o anúncio entrar no ar:
  // o banco confere de novo o que pedir_* conferiu antes de criar ou trocar a cobrança no Asaas.
  const motivo = await motivoParaNaoCobrar(meu.id);
  if (motivo) throw new ErroCobranca(motivo);

  const amb = await ambienteAsaas();
  let pg = await lerPagamento(meu.id);
  if (!pg || pg.status !== "pendente") throw new ErroCobranca("Esta cobrança não está mais esperando pagamento.");
  const r = await garantirCobranca({ amb, pg, userId, forma, documento, descricao: descricaoDe(meu), naoEncontrado: "Pagamento não encontrado." });
  if (r === "precisa_documento") return { etapa: "precisa_documento", pagamentoId: meu.id };

  pg = await lerPagamento(meu.id);
  if (!pg?.asaas_cobranca_id) throw new ErroCobranca("Não deu para criar a cobrança. Tente de novo.");
  const atualizado = (await meuPagamento(meu.id)) ?? meu;
  if (atualizado.status === "pago") return { etapa: "pago", pagamento: atualizado };
  return { etapa: "cobranca", pagamento: atualizado, cobranca: await montarCobranca(amb, pg, (pg.forma as FormaPagamento) ?? forma) };
}

/**
 * Situação de um pagamento de plano/avulso para a tela de espera. Com `perguntarAoAsaas`, confere
 * direto no Asaas (o banco decide se pode perguntar agora). Nunca lança.
 */
export async function situacaoMeuPagamento(pagamentoId: string, perguntarAoAsaas: boolean): Promise<MeuPagamento | null> {
  const meu = await meuPagamento(pagamentoId);
  if (!meu || meu.tipo === "destaque" || meu.status !== "pendente" || !meu.tem_cobranca || !perguntarAoAsaas || !asaasConfigurado()) {
    return meu;
  }
  if (await conferirNoAsaas(meu.id)) return (await meuPagamento(meu.id)) ?? meu;
  return meu;
}
