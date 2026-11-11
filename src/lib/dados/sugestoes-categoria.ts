import "server-only";
import { createClient } from "@/lib/supabase/server";

// Sugestão de categoria pendente do anúncio (só o dono enxerga: a função confere o dono).
export type SugestaoCategoria = { id: string; texto: string; categoria_proxima_id: string; criado_em: string };

/** A sugestão esperando a equipe decidir, se houver. Erro de leitura → null (o cadastro segue normal). */
export async function minhaSugestaoCategoria(anuncioId: string): Promise<SugestaoCategoria | null> {
  const db = await createClient();
  const { data, error } = await db.rpc("minha_sugestao_categoria", { p_anuncio: anuncioId });
  if (error || !Array.isArray(data)) return null;
  return (data[0] as SugestaoCategoria | undefined) ?? null;
}
