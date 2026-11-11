import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { executarLimpeza } from "@/lib/limpeza";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Limpeza diária da lixeira, chamada pelo pg_cron do banco às 04:00 UTC. */
export async function POST(req: Request) {
  if (!segredoConfere(req.headers.get("authorization"))) return NextResponse.json({ ok: false }, { status: 401 });
  try {
    return NextResponse.json({ ok: true, ...await executarLimpeza() });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}

function segredoConfere(recebido: string | null): boolean {
  const esperado = process.env.LIMPEZA_SECRET;
  if (!esperado || esperado.length < 32 || !recebido) return false;
  const hash = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(hash(recebido), hash(`Bearer ${esperado}`));
}
