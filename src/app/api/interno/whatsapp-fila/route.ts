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
type Decisao = "pode" | "cancelada" | "ignorada" | "erro";

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

    async function gravarResultado(id: string, resultado: "enviado" | "incerto" | "falha") {
      try {
        const { error: erroResultado } = await db.rpc("whatsapp_fila_resultado", { p_id: id, p_resultado: resultado });
        if (erroResultado) { total.erros_resultado++; console.error("whatsapp-fila: erro ao gravar o resultado do envio"); }
      } catch {
        total.erros_resultado++;
        console.error("whatsapp-fila: erro ao gravar o resultado do envio");
      }
    }

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

      // A conferência roda logo antes do pedido de envio (dentro de enviarTexto, depois da checagem da instância).
      // Assim, uma SAIR que chega antes do pedido segura a mensagem. Só "pode" envia; erro na conferência não envia.
      const conf: { decisao: Decisao | null } = { decisao: null };
      const conferir = async (): Promise<boolean> => {
        try {
          const { data: d, error: erroConferir } = await db.rpc("whatsapp_fila_confirmar_envio", { p_id: linha.id });
          if (erroConferir) { conf.decisao = "erro"; return false; }
          conf.decisao = d === "pode" || d === "cancelada" || d === "ignorada" ? d : "erro";
          return conf.decisao === "pode";
        } catch {
          conf.decisao = "erro";
          return false;
        }
      };

      const texto = linha.link ? `${linha.texto} ${SITE}${linha.link}` : linha.texto;
      let resultado: "enviado" | "incerto" | "falha" | "recusado";
      try { resultado = await enviarTexto(linha.numero, texto, config, conferir); } catch { resultado = "incerto"; }

      if (resultado === "recusado") {
        // O banco já guardou o motivo (cancelada) ou a linha não está mais "enviando" (ignorada): nada a gravar aqui.
        if (conf.decisao === "cancelada") total.canceladas++;
        else if (conf.decisao === "ignorada") continue;
        else {
          // Não deu para conferir: não envia e volta para a fila como falha (até 3 tentativas). Nunca vira "enviada".
          total.falhas++;
          await gravarResultado(linha.id, "falha");
        }
        continue;
      }
      if (resultado === "enviado") total.enviadas++; else if (resultado === "falha") total.falhas++; else total.incertas++;
      // Sem resultado salvo, a linha fica "enviando" e o banco a trata como incerta depois de 10 minutos (nunca repete).
      // O supabase-js devolve { error } em vez de lançar; nada de texto do erro nem de telefone no log.
      await gravarResultado(linha.id, resultado);
    }
    return NextResponse.json({ ok: true, ...total });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
