import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { modeloOuPadrao, type RecursoIA } from "@/lib/ia-modelos";

// Lê o modelo escolhido no painel (configuracoes, chave ia.modelo.<recurso>).
// Guarda por 30 s para não somar uma ida ao banco em cada chamada.
// Qualquer erro (banco fora, chave ausente, modelo fora da lista) usa o padrão: o recurso nunca para por isso.
const VALIDADE_MS = 30_000;
const memoria = new Map<RecursoIA, { modelo: string; ate: number }>();

export async function modeloDoRecurso(recurso: RecursoIA): Promise<string> {
  const guardado = memoria.get(recurso);
  if (guardado && guardado.ate > Date.now()) return guardado.modelo;
  let valor: unknown = null;
  try {
    const { data, error } = await supabaseAdmin().rpc("ia_modelo", { p_recurso: recurso });
    if (!error) valor = data;
  } catch {
    valor = null;
  }
  const modelo = modeloOuPadrao(recurso, valor);
  memoria.set(recurso, { modelo, ate: Date.now() + VALIDADE_MS });
  return modelo;
}
