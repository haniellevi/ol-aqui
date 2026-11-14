import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { cabecalhoEvolutionConfere, pedidoDeMensagem, saidaSemNumeroLegivel, segredoEvolution } from "@/lib/whatsapp/evolution";

export const dynamic = "force-dynamic";

// Webhook de entrada da Evolution (mensagens recebidas). Só mensagem de pessoa com número legível faz efeito:
// SAIR (ou PARAR, STOP, CANCELAR, frase curta de saída) desliga o aviso do Radar por WhatsApp e cancela a fila dele.
// VOLTAR, SIM e as outras mensagens vão para o banco (whatsapp_mensagem_recebida), que decide e responde no máximo
// uma vez por tipo e dia. Não guarda nem registra o texto nem o número.
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
  const pedido = pedidoDeMensagem(corpo);
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
  const { error } = pedido.intencao === "sair"
    ? await db.rpc("whatsapp_sair", { p_numero: pedido.numero, p_comando: pedido.comando })
    : await db.rpc("whatsapp_mensagem_recebida", { p_numero: pedido.numero, p_intencao: pedido.intencao });
  if (error) {
    console.error("whatsapp evolution: falha ao registrar a mensagem", error.code);
    return NextResponse.json({ ok: false }, { status: 503 });
  }
  return NextResponse.json({ ok: true });
}
