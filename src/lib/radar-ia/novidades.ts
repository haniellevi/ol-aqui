import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { comReserva } from "./uso";
import { CUSTO_JEV_USD, perguntarJev } from "./jev";

// Rotina de hora em hora (radar_ia_novidades_disparar → /api/interno/radar-novidades):
// o banco traz os pedidos abertos com anúncio novo parecido (até 5 por pedido); o JEV confere
// qual combina de verdade; o banco avisa no sino, no máximo 1 por dia por pedido.

const NENHUM = "_nenhum";
const CHANCE_MINIMA = 0.6;
const LIMITE_PADRAO = 50;
const INSTRUCAO =
  "Uma pessoa pediu isto para as lojas da região de um classificado local. " +
  "Qual destes anúncios novos é o que ela procura?";

type Candidato = { pedido_id: string; titulo: string; detalhes: string; anuncios: { id: string; titulo: string; preco_centavos: number | null }[] };

function reais(c: number | null): string {
  return typeof c === "number" && Number.isFinite(c) ? `R$ ${(c / 100).toFixed(2).replace(".", ",")}` : "sem preço";
}

async function limiteDaRodada(db: ReturnType<typeof supabaseAdmin>): Promise<number> {
  const { data } = await db.from("configuracoes").select("valor").eq("chave", "radar_ia.novidades_por_rodada").is("microrregiao_id", null).maybeSingle();
  const n = Number(data?.valor);
  return Number.isInteger(n) && n >= 0 && n <= 500 ? n : LIMITE_PADRAO;
}

export async function processarNovidades(): Promise<{ pedidos: number; avisos: number }> {
  const db = supabaseAdmin();
  const { data, error } = await db.rpc("radar_novidades_candidatos", { p_limite: await limiteDaRodada(db) });
  if (error) throw new Error("candidatos");
  const lista = (Array.isArray(data) ? data : []) as Candidato[];
  let avisos = 0;
  for (const c of lista) {
    if (!Array.isArray(c.anuncios) || c.anuncios.length === 0) continue;
    const criterios: Record<string, string> = { [NENHUM]: "Nenhum destes é o que a pessoa procura" };
    for (const a of c.anuncios.slice(0, 5)) criterios[a.id] = `${String(a.titulo).slice(0, 90)} — ${reais(a.preco_centavos)}`;
    const escolhido = await comReserva(null, "novidades", async () => {
      const estado: Record<string, string> = { pedido: String(c.titulo).slice(0, 120) };
      if (c.detalhes) estado.detalhes = String(c.detalhes).slice(0, 300);
      const chances = await perguntarJev({ estado, instrucao: INSTRUCAO, criterios });
      if (!chances) return { valor: null, custoUsd: null, tokensEntrada: 0, tokensSaida: 0, falha: "jev_sem_resposta" };
      const [melhor, chance] = Object.entries(chances).sort((a, b) => b[1] - a[1])[0] ?? [NENHUM, 0];
      return { valor: melhor !== NENHUM && chance >= CHANCE_MINIMA ? melhor : null, custoUsd: CUSTO_JEV_USD, tokensEntrada: 0, tokensSaida: 0, falha: null };
    });
    if (!escolhido) continue;
    const { data: avisou } = await db.rpc("radar_avisar_novidade", { p_pedido: c.pedido_id, p_anuncio: escolhido });
    if (avisou === true) avisos++;
  }
  return { pedidos: lista.length, avisos };
}
