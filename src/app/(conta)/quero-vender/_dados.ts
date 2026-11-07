import "server-only";
import { createClient } from "@/lib/supabase/server";
import { lerConfig, lerConfigNumero } from "@/lib/dados/config";
import { seguro } from "@/lib/dados/seguro";

type PlanoResumo = { nome: string; limite_anuncios: number | null };

/** Plano que a pessoa física ganha ao tocar em "Vender minhas coisas" (config pf.plano_inicial). */
export async function planoInicialPf(microrregiaoId: string | null): Promise<PlanoResumo | null> {
  const codigo = await lerConfig<string>("pf.plano_inicial", microrregiaoId);
  if (typeof codigo !== "string" || !codigo) return null;
  return seguro(async () => {
    const db = await createClient();
    const { data } = await db.from("planos").select("nome, limite_anuncios").eq("codigo", codigo).maybeSingle<PlanoResumo>();
    return data ?? null;
  }, null);
}

/** Teste grátis da loja: dias (config teste.dias) e limite do plano de teste (config loja.plano_teste). */
export async function testeGratis(microrregiaoId: string | null): Promise<{ dias: number | null; limite: number | null }> {
  const [dias, codigo] = await Promise.all([
    lerConfigNumero("teste.dias", microrregiaoId),
    lerConfig<string>("loja.plano_teste", microrregiaoId),
  ]);
  if (typeof codigo !== "string" || !codigo) return { dias, limite: null };
  const plano = await seguro(async () => {
    const db = await createClient();
    const { data } = await db.from("planos").select("nome, limite_anuncios").eq("codigo", codigo).maybeSingle<PlanoResumo>();
    return data ?? null;
  }, null);
  return { dias, limite: plano?.limite_anuncios ?? null };
}
