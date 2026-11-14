import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const segredo = process.env.LOJA_IA_CALLBACK_SEGREDO?.trim() ?? "";
  const fornecido = req.headers.get("authorization") ?? "";
  const esperado = `Bearer ${segredo}`;
  if (segredo.length < 32 || Buffer.byteLength(fornecido) !== Buffer.byteLength(esperado) || !timingSafeEqual(Buffer.from(fornecido), Buffer.from(esperado))) return NextResponse.json({ ok: false }, { status: 401 });
  if (Number(req.headers.get("content-length") ?? 0) > 1024) return NextResponse.json({ ok: false }, { status: 400 });
  try {
    if (!req.body) return NextResponse.json({ ok: false }, { status: 400 });
    const reader = req.body.getReader(); const chunks: Uint8Array[] = []; let tamanho = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      tamanho += value.length;
      if (tamanho > 1024) { await reader.cancel(); return NextResponse.json({ ok: false }, { status: 400 }); }
      chunks.push(value);
    }
    const texto = Buffer.concat(chunks).toString("utf8");
    const body = JSON.parse(texto);
    if (typeof body.ticket !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.ticket) || Object.keys(body).length !== 1) return NextResponse.json({ ok: false }, { status: 400 });
    const { data, error } = await supabaseAdmin().rpc("loja_ia_resgatar_ticket", { p_ticket: body.ticket });
    if (error || typeof data !== "string") return NextResponse.json({ ok: false }, { status: 403 });
    return NextResponse.json({ numero: data }, { headers: { "cache-control": "no-store" } });
  } catch { return NextResponse.json({ ok: false }, { status: 503 }); }
}
