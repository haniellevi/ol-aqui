import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { consultarCnpj } from "./receita";

type Loja = { vitrine_id: string; cnpj: string };
export type ResultadoReconferencia = { conferidas: number; removidas: number; parouPorReceita: boolean };
type Opcoes = { esperar?: (ms: number) => Promise<void> };

const LIMITE = 30;
const INTERVALO_MS = 1_000;
const esperarReal = (ms: number) => new Promise<void>((ok) => setTimeout(ok, ms));

// Reconfere o CNPJ das lojas com selo vencido (30 dias). Uma consulta por segundo; Receita fora do ar para a rodada inteira.
export async function reconferirLojas(db?: SupabaseClient, opcoes: Opcoes = {}): Promise<ResultadoReconferencia> {
  const resultado: ResultadoReconferencia = { conferidas: 0, removidas: 0, parouPorReceita: false };
  const esperar = opcoes.esperar ?? esperarReal;
  try {
    const cliente = db ?? supabaseAdmin();
    const { data, error } = await cliente.rpc("verificacao_loja_reconferir_reservar", { p_limite: LIMITE });
    if (error || !Array.isArray(data)) return resultado;
    const lojas = (data as Loja[]).slice(0, LIMITE);
    let primeira = true;
    for (const loja of lojas) {
      try {
        if (!primeira) await esperar(INTERVALO_MS);
        primeira = false;
        const r = await consultarCnpj(loja.cnpj);
        if (r.estado === "fora_do_ar") { resultado.parouPorReceita = true; break; }
        let veredito: "ativa" | "inativa" | "nao_encontrada";
        let situacao: string | null = null;
        if (r.estado === "nao_encontrada") veredito = "nao_encontrada";
        else {
          situacao = r.dados.situacao;
          veredito = situacao.trim().toUpperCase() === "ATIVA" ? "ativa" : "inativa";
        }
        const { error: erroRegistro } = await cliente.rpc("verificacao_loja_reconferir_registrar", {
          p_vitrine: loja.vitrine_id, p_resultado: veredito, p_situacao: situacao,
        });
        if (erroRegistro) continue;
        resultado.conferidas++;
        if (veredito !== "ativa") resultado.removidas++;
      } catch {
        // Uma loja com problema não impede as seguintes.
      }
    }
  } catch {
    // Sem banco, nada a fazer nesta rodada.
  }
  return resultado;
}
