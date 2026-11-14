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
// A função tem 60 s: depois de 30 s não começa envio novo (cada envio pode levar até ~25 s:
// 8 s de checagem + 15 s de envio + pausa), então o último termina antes do limite.
const PRAZO_MS = 30000;

type Linha = { id: string; numero: string; texto: string; link: string | null };

// Chamada a cada minuto pelo banco (pg_cron). Mesmo segredo da moderação por IA.
export async function POST(req: Request) {
  if (!segredoModeracaoConfere(req.headers.get("authorization"))) return NextResponse.json({ ok: false }, { status: 401 });
  const inicio = Date.now();
  try {
    const config = configuracaoEnvio(); // antes de pegar a fila: sem configuração, nada fica "enviando"
    const db = supabaseAdmin();
    const { data, error } = await db.rpc("whatsapp_fila_pegar", { p_limite: POR_RODADA });
    if (error || !Array.isArray(data)) return NextResponse.json({ ok: false }, { status: 503 });
    const linhas = (data as Linha[]).slice(0, POR_RODADA);
    const total = { enviadas: 0, falhas: 0, incertas: 0, erros_resultado: 0, devolvidas: 0, canceladas: 0 };
    for (let i = 0; i < linhas.length; i++) {
      const linha = linhas[i];
      if (i > 0) await pausa(INTERVALO_MS);
      if (Date.now() - inicio > PRAZO_MS) {
        // Sem tempo: o que não foi tentado volta para a fila (sem gastar tentativa) em vez de ficar "enviando".
        const sobras = linhas.slice(i).map((l) => l.id);
        try {
          const { data: n, error: erroDevolver } = await db.rpc("whatsapp_fila_devolver", { p_ids: sobras });
          if (erroDevolver) console.error("whatsapp-fila: erro ao devolver mensagens não tentadas");
          else total.devolvidas = typeof n === "number" ? n : sobras.length;
        } catch {
          console.error("whatsapp-fila: erro ao devolver mensagens não tentadas");
        }
        break;
      }
      // Logo antes de enviar, o banco confere de novo se esta mensagem ainda pode sair (SAIR, chave geral,
      // preferência, pedido fechado, prazo ou limite). Só "pode" envia. Erro na conferência: não envia.
      let decisao: unknown = null;
      try {
        const { data: d, error: erroConferir } = await db.rpc("whatsapp_fila_confirmar_envio", { p_id: linha.id });
        if (!erroConferir) decisao = d;
      } catch {
        decisao = null;
      }
      if (decisao === "ignorada") continue; // a linha já não está "enviando": o banco cuidou dela
      if (decisao === "cancelada") { total.canceladas++; continue; } // o banco guardou o motivo
      if (decisao !== "pode") {
        // Não deu para conferir: não envia e volta para a fila como falha (até 3 tentativas). Nunca vira "enviada".
        total.falhas++;
        try {
          const { error: erroResultado } = await db.rpc("whatsapp_fila_resultado", { p_id: linha.id, p_resultado: "falha" });
          if (erroResultado) { total.erros_resultado++; console.error("whatsapp-fila: erro ao gravar o resultado do envio"); }
        } catch {
          total.erros_resultado++;
          console.error("whatsapp-fila: erro ao gravar o resultado do envio");
        }
        continue;
      }
      const texto = linha.link ? `${linha.texto} ${SITE}${linha.link}` : linha.texto;
      let resultado: "enviado" | "incerto" | "falha";
      try { resultado = await enviarTexto(linha.numero, texto, config); } catch { resultado = "incerto"; }
      if (resultado === "enviado") total.enviadas++; else if (resultado === "falha") total.falhas++; else total.incertas++;
      // Sem resultado salvo, a linha fica "enviando" e o banco a trata como incerta depois de 10 minutos (nunca repete).
      // O supabase-js devolve { error } em vez de lançar; nada de texto do erro nem de telefone no log.
      try {
        const { error: erroResultado } = await db.rpc("whatsapp_fila_resultado", { p_id: linha.id, p_resultado: resultado });
        if (erroResultado) { total.erros_resultado++; console.error("whatsapp-fila: erro ao gravar o resultado do envio"); }
      } catch {
        total.erros_resultado++;
        console.error("whatsapp-fila: erro ao gravar o resultado do envio");
      }
    }
    return NextResponse.json({ ok: true, ...total });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
