import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type CortesiaRadar = { ate: string; motivo: string | null; criado_em: string };

/**
 * Cortesia do Radar ainda valendo para a loja (null = não tem ou já venceu).
 * radar_cortesias tem RLS sem política (só funções do banco leem): por isso a leitura usa a chave do servidor.
 * Chame SÓ depois de `exigirTela("lojas")` e só para administrador: a tela é quem decide, nunca o navegador.
 */
export async function cortesiaRadarAtiva(vitrineId: string): Promise<{ cortesia: CortesiaRadar | null; erro: boolean }> {
  try {
    const { data, error } = await supabaseAdmin()
      .from("radar_cortesias")
      .select("ate, motivo, criado_em")
      .eq("vitrine_id", vitrineId)
      .gt("ate", new Date().toISOString())
      .maybeSingle();
    if (error) return { cortesia: null, erro: true };
    return { cortesia: (data as CortesiaRadar | null) ?? null, erro: false };
  } catch {
    return { cortesia: null, erro: true };
  }
}
