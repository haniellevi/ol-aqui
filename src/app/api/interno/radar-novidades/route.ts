import { NextResponse } from "next/server";
import { segredoModeracaoConfere } from "@/lib/moderacao-ia";
import { processarNovidades } from "@/lib/radar-ia/novidades";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Chamada pela rotina do banco (radar_ia_novidades_disparar), com o mesmo segredo interno da moderação.
export async function POST(req: Request) {
  if (!segredoModeracaoConfere(req.headers.get("authorization"))) return NextResponse.json({ ok: false }, { status: 401 });
  try {
    return NextResponse.json({ ok: true, ...await processarNovidades() });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
