import { NextResponse } from "next/server";
import { segredoModeracaoConfere } from "@/lib/moderacao-ia";
import { processarFilaCategorizacao } from "@/lib/categorizacao-ia";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Chamada pela rotina do banco (categorizacao_ia_disparar), com o mesmo segredo interno da moderação.
export async function POST(req: Request) {
  if (!segredoModeracaoConfere(req.headers.get("authorization"))) return NextResponse.json({ ok: false }, { status: 401 });
  try {
    return NextResponse.json({ ok: true, ...await processarFilaCategorizacao() });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
