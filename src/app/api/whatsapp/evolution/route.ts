import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { cabecalhoEvolutionConfere, pedidoDeMensagem, saidaSemNumeroLegivel, segredoEvolution } from "@/lib/whatsapp/evolution";

export const dynamic = "force-dynamic";

// Webhook de entrada da Evolution (mensagens recebidas). Só mensagem de pessoa com número legível faz efeito:
// SAIR (ou PARAR, STOP, CANCELAR, frase curta de saída) desliga o aviso do Radar por WhatsApp e cancela a fila dele.
// A entrada normal preserva a identidade, a hora de origem e a referência da resposta quando disponíveis.
// IDs e texto bruto não são registrados. O banco decide quando uma mensagem autoriza a reativação.
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
  const { error } = pedido.evento && pedido.intencao !== "outra"
    ? await db.rpc("whatsapp_radar_evento", {
      p_numero: pedido.numero,
      p_intencao: pedido.intencao,
      p_comando: pedido.intencao === "sair" ? pedido.comando : null,
      p_evento: pedido.evento.id,
      p_ocorreu_em: pedido.evento.ocorreuEm,
      p_citada: pedido.intencao === "sim" ? pedido.evento.citada : null,
    })
    : pedido.intencao === "sair"
    ? await db.rpc("whatsapp_sair", { p_numero: pedido.numero, p_comando: pedido.comando })
    : pedido.intencao === "outra"
    ? await db.rpc("whatsapp_radar_mensagem_com_contexto", { p_numero: pedido.numero, p_hash: pedido.hash })
    : await db.rpc("whatsapp_mensagem_recebida", { p_numero: pedido.numero, p_intencao: pedido.intencao, p_hash: pedido.hash });
  if (error) {
    console.error("whatsapp evolution: falha ao registrar a mensagem", error.code);
    return NextResponse.json({ ok: false }, { status: 503 });
  }
  return NextResponse.json({ ok: true });
}
