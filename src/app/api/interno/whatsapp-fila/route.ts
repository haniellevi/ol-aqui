import { NextResponse } from "next/server";
import { setTimeout as pausa } from "node:timers/promises";
import { SITE } from "@/lib/formato";
import { segredoModeracaoConfere } from "@/lib/moderacao-ia";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { configuracaoEnvio, enviarTexto } from "@/lib/whatsapp/envio";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// O servidor do WhatsApp fica atrás de um nginx que deixa 12 pedidos por minuto (cada envio faz 2): 1,5 s entre mensagens.
const INTERVALO_MS = 1500;
const POR_RODADA = 5;

type Linha = { id: string; numero: string; texto: string; link: string | null };

// Chamada a cada minuto pelo banco (pg_cron). Mesmo segredo da moderação por IA.
export async function POST(req: Request) {
  if (!segredoModeracaoConfere(req.headers.get("authorization"))) return NextResponse.json({ ok: false }, { status: 401 });
  try {
    const config = configuracaoEnvio(); // antes de pegar a fila: sem configuração, nada fica "enviando"
    const db = supabaseAdmin();
    const { data, error } = await db.rpc("whatsapp_fila_pegar", { p_limite: POR_RODADA });
    if (error || !Array.isArray(data)) return NextResponse.json({ ok: false }, { status: 503 });
    const linhas = (data as Linha[]).slice(0, POR_RODADA);
    const total = { enviadas: 0, falhas: 0, incertas: 0 };
    for (let i = 0; i < linhas.length; i++) {
      const linha = linhas[i];
      if (i > 0) await pausa(INTERVALO_MS);
      const texto = linha.link ? `${linha.texto} ${SITE}${linha.link}` : linha.texto;
      let resultado: "enviado" | "incerto" | "falha";
      try { resultado = await enviarTexto(linha.numero, texto, config); } catch { resultado = "incerto"; }
      if (resultado === "enviado") total.enviadas++; else if (resultado === "falha") total.falhas++; else total.incertas++;
      try {
        await db.rpc("whatsapp_fila_resultado", { p_id: linha.id, p_resultado: resultado });
      } catch {
        // Sem resultado salvo, a linha fica "enviando" e o banco a trata como incerta depois de 10 minutos (nunca repete).
      }
    }
    return NextResponse.json({ ok: true, ...total });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
