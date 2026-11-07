import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { garantirPerfil } from "@/lib/perfil";
import { estadoAki, lerAjustes, lerPodeEnviar, limitesFoto, motivoFinal, responder } from "@/lib/aki/motor";
import { mensagemBloqueio } from "@/lib/aki/textos";
import { ehId } from "@/lib/aki/validar";
import type { EventoAki, PedidoAki } from "@/lib/aki/tipos";

// Conversa com o Aki.
// GET  → estado do balão (pode falar? textos do painel, conversa atual).
// POST → manda uma mensagem; a resposta chega aos pedaços, uma linha JSON por evento (EventoAki).
// Exige login (v1). Antes de chamar a IA o banco confere robô ligado, limite do dia e orçamento.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MIMES = ["image/webp", "image/jpeg", "image/png"] as const;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

const json = (dados: unknown, status = 200) =>
  new Response(JSON.stringify(dados), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

export async function GET() {
  const { userId } = await auth();
  try {
    if (userId) await garantirPerfil().catch(() => null);
    return json(await estadoAki(userId));
  } catch {
    return json({ logado: !!userId, pode: false, motivo: "erro", restantes: null, boasVindas: null, sugestoes: [], avisoIa: null, fotoLadoMaximo: 1024, maxCaracteres: 600, conversaId: null, mensagens: [] });
  }
}

/** Resposta curta (um evento só) no mesmo formato do streaming. */
function umEvento(e: EventoAki, status = 200) {
  return new Response(JSON.stringify(e) + "\n", { status, headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return umEvento({ tipo: "bloqueado", motivo: "sem_login", mensagem: mensagemBloqueio("sem_login") }, 401);

  let corpo: PedidoAki;
  try {
    const bruto = await req.text();
    if (bruto.length > 6_000_000) return umEvento({ tipo: "erro", mensagem: "A foto está grande demais. Tente outra." }, 413);
    corpo = JSON.parse(bruto);
  } catch {
    return umEvento({ tipo: "erro", mensagem: "Não entendi a mensagem. Tente de novo." }, 400);
  }

  try {
    await garantirPerfil().catch(() => null);
    const db = await createClient();
    const ajustes = await lerAjustes(db);

    // texto
    const maxCaracteres = Math.max(50, Number(ajustes["robo.max_caracteres_mensagem"]) || 600);
    const texto = typeof corpo.texto === "string" ? corpo.texto.replace(/\r\n/g, "\n").trim() : "";
    if (texto.length > maxCaracteres) {
      return umEvento({ tipo: "erro", mensagem: `Sua mensagem ficou grande. Use até ${maxCaracteres} letras.` }, 400);
    }

    // foto: uma por mensagem, já reduzida no celular; vai direto para a IA e não é guardada
    let foto: PedidoAki["foto"] = null;
    if (corpo.foto) {
      const { maxKb } = limitesFoto(ajustes);
      const tipo = corpo.foto.tipo;
      const b64 = typeof corpo.foto.base64 === "string" ? corpo.foto.base64 : "";
      if (!(MIMES as readonly string[]).includes(tipo) || !b64 || !BASE64.test(b64)) {
        return umEvento({ tipo: "erro", mensagem: "Essa foto não abriu. Tente outra." }, 400);
      }
      if ((b64.length * 3) / 4 > maxKb * 1024) {
        return umEvento({ tipo: "erro", mensagem: "A foto está grande demais. Tente outra." }, 413);
      }
      foto = { base64: b64, tipo };
    }
    if (!texto && !foto) return umEvento({ tipo: "erro", mensagem: "Escreva uma mensagem ou mande uma foto." }, 400);

    // confere com a sessão da própria pessoa antes de gastar qualquer coisa
    const pode = await lerPodeEnviar(db, foto ? "foto" : "conversa");
    const motivo = motivoFinal(pode);
    if (motivo) return umEvento({ tipo: "bloqueado", motivo, mensagem: mensagemBloqueio(motivo) });

    const conversaId = typeof corpo.conversaId === "string" && ehId(corpo.conversaId) ? corpo.conversaId : null;
    const codificador = new TextEncoder();
    const fluxo = new ReadableStream<Uint8Array>({
      async start(controle) {
        let aberto = true;
        const emitir = (e: EventoAki) => {
          if (!aberto) return;
          try {
            controle.enqueue(codificador.encode(JSON.stringify(e) + "\n"));
          } catch {
            aberto = false;
          }
        };
        try {
          await responder({ userId, pedido: { texto, conversaId, foto }, ajustes, emitir, sinal: req.signal });
        } catch {
          emitir({ tipo: "erro", mensagem: "O Aki não conseguiu responder agora. Tente de novo." });
        } finally {
          aberto = false;
          try {
            controle.close();
          } catch {
            // já fechado
          }
        }
      },
    });
    return new Response(fluxo, {
      headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store, no-transform", "x-accel-buffering": "no" },
    });
  } catch {
    return umEvento({ tipo: "erro", mensagem: "O Aki não conseguiu responder agora. Tente de novo." }, 500);
  }
}
