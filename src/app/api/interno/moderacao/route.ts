import { NextResponse } from "next/server";
import { processarFilaModeracao, segredoModeracaoConfere } from "@/lib/moderacao-ia";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  if (!segredoModeracaoConfere(req.headers.get("authorization"))) return NextResponse.json({ ok: false }, { status: 401 });
  try {
    return NextResponse.json({ ok: true, ...await processarFilaModeracao() });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
