import { createHash, timingSafeEqual } from "node:crypto";
import { clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { apagarConta, limparFilaArquivos } from "@/lib/conta-exclusao";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Limpeza diária da lixeira (chamada pelo pg_cron do banco, às 04:00 UTC).
 * Apaga de vez o que passou de 30 dias: contas (no Clerk e no banco), lojas e anúncios,
 * e as fotos que ninguém mais usa. Provas congeladas e registros de pagamento ficam.
 * Cada item é independente: uma falha não impede os outros, e a próxima execução tenta de novo.
 */
export async function POST(req: Request) {
  if (!segredoConfere(req.headers.get("authorization"))) return NextResponse.json({ ok: false }, { status: 401 });
  const db = supabaseAdmin();
  const fila = await db.rpc("limpeza_pendente");
  if (fila.error) return NextResponse.json({ ok: false }, { status: 503 });
  const { contas = [], lojas = [], anuncios = [] } = (fila.data ?? {}) as { contas?: string[]; lojas?: string[]; anuncios?: string[] };
  const resultado = { contas: 0, lojas: 0, anuncios: 0, falhas: 0 };

  for (const id of contas) {
    try {
      // Reserva no banco antes de apagar no Clerk: quem cancelou depois da fila não é apagado.
      const reserva = await db.rpc("limpeza_reservar_conta", { p_id: id });
      if (reserva.error) throw new Error(reserva.error.message);
      if (!reserva.data) continue;
      try {
        await (await clerkClient()).users.deleteUser(id);
      } catch (e) {
        if ((e as { status?: number }).status !== 404) throw e; // 404: já apagada no Clerk
      }
      await apagarConta(id); // o webhook user.deleted também chama; é idempotente
      resultado.contas++;
    } catch (e) {
      resultado.falhas++;
      console.error("limpeza conta", id, e);
    }
  }
  for (const id of lojas) {
    try {
      // As fotos ficam na fila do banco e saem do Storage no fim.
      const r = await db.rpc("purgar_loja", { p_loja: id });
      if (r.error) throw new Error(r.error.message);
      resultado.lojas++;
    } catch (e) {
      resultado.falhas++;
      console.error("limpeza loja", id, e);
    }
  }
  for (const id of anuncios) {
    try {
      const r = await db.rpc("purgar_anuncio", { p_id: id });
      if (r.error) throw new Error(r.error.message);
      resultado.anuncios++;
    } catch (e) {
      resultado.falhas++;
      console.error("limpeza anuncio", id, e);
    }
  }
  try {
    await limparFilaArquivos(db);
  } catch (e) {
    resultado.falhas++;
    console.error("limpeza arquivos", e);
  }
  return NextResponse.json({ ok: true, ...resultado });
}

function segredoConfere(recebido: string | null): boolean {
  const esperado = process.env.LIMPEZA_SECRET;
  if (!esperado || esperado.length < 32 || !recebido) return false;
  const hash = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(hash(recebido), hash(`Bearer ${esperado}`));
}
