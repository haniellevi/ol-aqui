import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { tokenWebhookConfere } from "@/lib/asaas";

// Avisos do Asaas (Configurações > Integrações > Webhooks, com o mesmo token de ASAAS_WEBHOOK_TOKEN).
// Confere o token em tempo constante e repassa ao banco, que é idempotente:
// aviso repetido não ativa duas vezes nem soma dias. Responde rápido.

export const dynamic = "force-dynamic";

const PAGO = new Set(["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED"]);
const CANCELA: Record<string, "vencido" | "cancelado" | "estornado"> = {
  PAYMENT_OVERDUE: "vencido",
  PAYMENT_DELETED: "cancelado",
  PAYMENT_REFUNDED: "estornado",
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

  let db;
  try {
    db = supabaseAdmin();
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 }); // sem chave do banco: o Asaas tenta de novo
  }

  const { error } = PAGO.has(evento)
    ? await db.rpc("confirmar_pagamento", { p_asaas_cobranca_id: cobranca, p_payload: aviso })
    : await db.rpc("cancelar_pagamento", { p_asaas_cobranca_id: cobranca, p_status: CANCELA[evento], p_payload: aviso });

  // Falha do banco: 500 para o Asaas reenviar (seguro, porque o banco ignora o que já processou)
  if (error) return NextResponse.json({ ok: false }, { status: 500 });
  return NextResponse.json({ ok: true });
}
