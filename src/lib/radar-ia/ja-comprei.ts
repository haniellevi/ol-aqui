import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ehUuid } from "@/lib/formato";
import { mascararParaIA } from "@/components/conversas/palavras-compra";
import { comReserva } from "./uso";
import { CUSTO_JEV_USD, perguntarJev } from "./jev";

// "Já comprei" (docs/superpowers/plans/2026-11-13-radar-ja-comprei.md): roda depois que o cliente envia
// uma mensagem com palavra de compra. O banco diz se a mensagem pode ir para a IA (chave ligada, mensagem
// do cliente, pedido dele aberto na conversa, sem "não" antes); o JEV julga; o banco grava a pergunta.
// Vão para o JEV só o título do pedido e o texto da mensagem, sem link, e-mail nem telefone.

const CHANCE_MINIMA = 0.7;
const INSTRUCAO =
  "Uma pessoa pediu isto para as lojas da região num classificado local e escreveu esta mensagem numa conversa com uma loja. " +
  "Pela mensagem, ela já comprou ou conseguiu o que pediu (nesta loja ou em outro lugar)?";
const CRITERIOS = {
  ja_resolveu: "Ela diz que já comprou, conseguiu ou não precisa mais do que pediu",
  ainda_procura: "Ela ainda está procurando, perguntando, negociando ou fala de outra coisa",
};

type Candidato = { mensagem_id: string; usuario_id: string; texto: string; pedido_id: string; pedido_titulo: string };

function ehCandidato(v: unknown): v is Candidato {
  if (!v || typeof v !== "object") return false;
  const c = v as Record<string, unknown>;
  return typeof c.mensagem_id === "string" && ehUuid(c.mensagem_id) && typeof c.pedido_id === "string" && ehUuid(c.pedido_id)
    && typeof c.usuario_id === "string"
    && typeof c.texto === "string" && typeof c.pedido_titulo === "string";
}

/** true = ficou uma pergunta para o cliente. Qualquer falha: false, sem aviso. */
export async function verificarJaComprei(mensagemId: string): Promise<boolean> {
  if (!ehUuid(mensagemId)) return false;
  try {
    const db = supabaseAdmin();
    const { data, error } = await db.rpc("ja_comprei_candidato", { p_mensagem: mensagemId });
    if (error || !ehCandidato(data)) return false;
    const c = data;
    const julgado = await comReserva(c.usuario_id, "ja_comprei", async () => {
      const chances = await perguntarJev({
        estado: { pedido: c.pedido_titulo.replace(/\s+/g, " ").trim().slice(0, 120), mensagem: mascararParaIA(c.texto) },
        instrucao: INSTRUCAO,
        criterios: CRITERIOS,
      });
      if (!chances) return { valor: null, custoUsd: null, tokensEntrada: 0, tokensSaida: 0, falha: "jev_sem_resposta" };
      return { valor: { resolveu: (chances.ja_resolveu ?? 0) >= CHANCE_MINIMA }, custoUsd: CUSTO_JEV_USD, tokensEntrada: 0, tokensSaida: 0, falha: null };
    });
    if (!julgado) return false;
    const { data: perguntou } = await db.rpc("ja_comprei_registrar", {
      p_mensagem: c.mensagem_id, p_pedido: c.pedido_id, p_resolveu: julgado.resolveu,
    });
    return perguntou === true;
  } catch {
    return false;
  }
}
