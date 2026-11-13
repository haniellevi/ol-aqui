import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ehUuid } from "@/lib/formato";
import { mascararParaIA } from "@/components/conversas/palavras-compra";
import { comReserva } from "./uso";
import { CUSTO_JEV_USD, perguntarJev } from "./jev";

// "Já comprei" (docs/superpowers/plans/2026-11-13-radar-ja-comprei.md): roda depois que o cliente envia
// uma mensagem com palavra de compra. O banco diz se a mensagem pode ir para a IA (chave ligada, mensagem
// do cliente, pedido dele aberto na conversa, sem "não" antes); o JEV julga; o banco grava a pergunta.
// Vão para o JEV só os títulos dos pedidos abertos e o texto da mensagem, sem link, e-mail nem telefone.

const CHANCE_MINIMA = 0.7;
const AINDA_PROCURA = "ainda_procura";
const INSTRUCAO =
  "Uma pessoa pediu coisas para as lojas da região num classificado local e escreveu esta mensagem numa conversa com uma loja. " +
  "Pela mensagem, ela já comprou ou conseguiu algum dos pedidos (nesta loja ou em outro lugar)? Qual?";

type Candidato = { mensagem_id: string; usuario_id: string; texto: string; pedidos: { id: string; titulo: string }[] };

function ehCandidato(v: unknown): v is Candidato {
  if (!v || typeof v !== "object") return false;
  const c = v as Record<string, unknown>;
  return typeof c.mensagem_id === "string" && ehUuid(c.mensagem_id) && typeof c.usuario_id === "string" && typeof c.texto === "string"
    && Array.isArray(c.pedidos) && c.pedidos.length > 0 && c.pedidos.length <= 5
    && c.pedidos.every((p) => p && typeof p.id === "string" && ehUuid(p.id) && typeof p.titulo === "string");
}

/** true = ficou uma pergunta para o cliente. Qualquer falha: false, sem aviso. */
export async function verificarJaComprei(mensagemId: string): Promise<boolean> {
  if (!ehUuid(mensagemId)) return false;
  try {
    const db = supabaseAdmin();
    const { data, error } = await db.rpc("ja_comprei_candidato", { p_mensagem: mensagemId });
    if (error || !ehCandidato(data)) return false;
    const c = data;
    // Uma opção por pedido aberto (a IA escolhe de qual a mensagem fala) + "ainda procura".
    const criterios: Record<string, string> = {};
    for (const p of c.pedidos) criterios[p.id] = `Já comprou ou conseguiu: ${mascararParaIA(p.titulo).slice(0, 120)}`;
    criterios[AINDA_PROCURA] = "Ainda está procurando, perguntando, negociando ou fala de outra coisa";
    const julgado = await comReserva(c.usuario_id, "ja_comprei", async () => {
      const chances = await perguntarJev({ estado: { mensagem: mascararParaIA(c.texto) }, instrucao: INSTRUCAO, criterios });
      if (!chances) return { valor: null, custoUsd: null, tokensEntrada: 0, tokensSaida: 0, falha: "jev_sem_resposta" };
      const [melhor, chance] = Object.entries(chances).sort((a, b) => b[1] - a[1])[0] ?? [AINDA_PROCURA, 0];
      const pedido = melhor !== AINDA_PROCURA && chance >= CHANCE_MINIMA ? melhor : null;
      return { valor: { pedido }, custoUsd: CUSTO_JEV_USD, tokensEntrada: 0, tokensSaida: 0, falha: null };
    });
    if (!julgado) return false;
    const { data: perguntou } = await db.rpc("ja_comprei_registrar", {
      p_mensagem: c.mensagem_id, p_pedido: julgado.pedido ?? c.pedidos[0].id, p_resolveu: julgado.pedido !== null,
    });
    return perguntou === true;
  } catch {
    return false;
  }
}
