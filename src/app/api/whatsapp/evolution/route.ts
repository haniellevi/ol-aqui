import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { cabecalhoEvolutionConfere, pedidoDeSaida, saidaSemNumeroLegivel, segredoEvolution } from "@/lib/whatsapp/evolution";

export const dynamic = "force-dynamic";

// Webhook de entrada da Evolution (mensagens recebidas). Só pedido de saída (SAIR, PARAR, STOP, CANCELAR ou frase curta como "quero sair") faz efeito:
// desligam o aviso do Radar por WhatsApp de quem tem o número, cancelam a fila dele e ficam registrados.
// Não guarda nem registra o texto nem o número. Qualquer outra mensagem é ignorada com 200.
export async function POST(req: Request) {
  const segredo = segredoEvolution();
  if (!segredo) return NextResponse.json({ ok: false }, { status: 503 });
  if (!cabecalhoEvolutionConfere(req.headers.get("authorization"), segredo)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let corpo: unknown;
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ ok: true, ignorado: "corpo" });
  }
  const pedido = pedidoDeSaida(corpo);
  if (!pedido) {
    // Frase de saída cujo número não se lê (conversa @lid sem campo de número): só o fato, sem número nem texto.
    if (saidaSemNumeroLegivel(corpo)) console.warn("whatsapp evolution: saida sem numero legivel (conversa sem campo de numero)");
    return NextResponse.json({ ok: true, ignorado: "sem pedido" });
  }

  let db;
  try {
    db = supabaseAdmin();
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
  const { error } = await db.rpc("whatsapp_sair", { p_numero: pedido.numero, p_comando: pedido.comando });
  if (error) {
    console.error("whatsapp evolution: falha ao registrar a saída", error.code);
    return NextResponse.json({ ok: false }, { status: 503 });
  }
  return NextResponse.json({ ok: true });
}
