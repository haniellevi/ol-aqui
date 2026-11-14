import { NextResponse } from "next/server";
import { segredoModeracaoConfere } from "@/lib/moderacao-ia";
import { processarFilaLojaIa } from "@/lib/loja-ia/processar";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: Request) {
  if (!segredoModeracaoConfere(req.headers.get("authorization"))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  try {
    const resultado = await processarFilaLojaIa();
    return NextResponse.json({ ok: resultado.erros === 0, ...resultado }, { status: resultado.erros === 0 ? 200 : 503 });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
