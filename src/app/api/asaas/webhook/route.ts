import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ambienteAsaas, apagarCobranca, asaasConfigurado, cobrancaNoAmbiente, tokenWebhookConfere } from "@/lib/asaas";

// Avisos do Asaas (Configurações > Integrações > Webhooks, com o mesmo token de ASAAS_WEBHOOK_TOKEN).
// Confere o token em tempo constante e repassa ao banco, que é idempotente:
// aviso repetido não ativa duas vezes nem soma dias. Responde rápido.

export const dynamic = "force-dynamic";

const PAGO = new Set(["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED"]);
// Dinheiro que volta para o comprador (devolução, contestação no cartão, baixa desfeita)
// conta como "estornado": o destaque é desligado na hora.
const CANCELA: Record<string, "vencido" | "cancelado" | "estornado"> = {
  PAYMENT_OVERDUE: "vencido",
  PAYMENT_DELETED: "cancelado",
  PAYMENT_REFUNDED: "estornado",
  PAYMENT_REFUND_IN_PROGRESS: "estornado",
  PAYMENT_CHARGEBACK_REQUESTED: "estornado",
  PAYMENT_CHARGEBACK_DISPUTE: "estornado",
  PAYMENT_RECEIVED_IN_CASH_UNDONE: "estornado",
};

type Aviso = { id?: string; event?: string; payment?: { id?: string } };

export async function POST(req: Request) {
  if (!tokenWebhookConfere(req.headers.get("asaas-access-token"))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let aviso: Aviso;
  try {
    aviso = (await req.json()) as Aviso;
  } catch {
    return NextResponse.json({ ok: true, ignorado: "corpo inválido" });
  }
  const evento = String(aviso.event ?? "");
  const cobranca = typeof aviso.payment?.id === "string" ? aviso.payment.id.slice(0, 100) : "";
  if (!cobranca || (!PAGO.has(evento) && !CANCELA[evento])) {
    return NextResponse.json({ ok: true, ignorado: evento || "sem evento" });
  }

  try {
    if (process.env.VERCEL_ENV === "production" && (await ambienteAsaas()) !== "producao") {
      return NextResponse.json({ ok: false }, { status: 503 });
    }
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  let db;
  try {
    db = supabaseAdmin();
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 }); // sem chave do banco: o Asaas tenta de novo
  }

  if (process.env.VERCEL_ENV === "production") {
    try {
      const { data, error } = await db.from("pagamentos").select("id").eq("asaas_cobranca_id", cobranca).maybeSingle();
      if (error) return NextResponse.json({ ok: false }, { status: 503 });
      if (!data) return NextResponse.json({ ok: true, ignorado: "cobrança desconhecida" });
      if (!(await cobrancaNoAmbiente(data.id, "producao"))) return NextResponse.json({ ok: false }, { status: 503 });
    } catch {
      return NextResponse.json({ ok: false }, { status: 503 });
    }
  }

  const { error } = PAGO.has(evento)
    ? await db.rpc("confirmar_pagamento", { p_asaas_cobranca_id: cobranca, p_payload: aviso })
    : await db.rpc("cancelar_pagamento", { p_asaas_cobranca_id: cobranca, p_status: CANCELA[evento], p_payload: aviso });

  // Falha do banco: 500 para o Asaas reenviar (seguro, porque o banco ignora o que já processou)
  if (error) return NextResponse.json({ ok: false }, { status: 500 });

  // Cobrança de destaque vencida: o pedido foi cancelado, então apaga a cobrança no Asaas
  // para o Pix antigo não ser pago depois por engano.
  if (evento === "PAYMENT_OVERDUE" && asaasConfigurado()) {
    const { data: pg } = await db
      .from("pagamentos")
      .select("tipo, status")
      .eq("asaas_cobranca_id", cobranca)
      .maybeSingle<{ tipo: string; status: string }>();
    if (pg?.tipo === "destaque" && pg.status === "vencido") await apagarCobranca(await ambienteAsaas(), cobranca);
  }
  return NextResponse.json({ ok: true });
}
