import { NextResponse } from "next/server";
import { segredoModeracaoConfere } from "@/lib/moderacao-ia";
import { processarFilaVerificacao } from "@/lib/verificacao-loja/fila";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Chamada a cada minuto pelo banco (pg_cron). Mesmo segredo da moderação por IA.
export async function POST(req: Request) {
  if (!segredoModeracaoConfere(req.headers.get("authorization"))) return NextResponse.json({ ok: false }, { status: 401 });
  try {
    return NextResponse.json({ ok: true, ...await processarFilaVerificacao() });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
