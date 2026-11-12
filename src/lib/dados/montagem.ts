import "server-only";
// Etapa P5c: depois que o dono aceita a loja montada pela equipe, as fotos saem da pasta do
// dono provisório (user_montagem…) para a pasta do dono, e os produtos prontos vão ao ar.
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { ehUuid } from "@/lib/formato";

const BALDE = "anuncios";
const LOTE = 8;

export type ResultadoRecebimento = { publicados: number; em_analise: number; rascunhos: number };

type Mudanca = { de: string; para: string; caminhos: string[] | null };

/** Produtos prontos ainda sem publicar numa loja já recebida (o aceite parou antes de publicar). */
export async function prontosPendentes(lojaId: string): Promise<number> {
  if (!ehUuid(lojaId)) return 0;
  const db = await createClient();
  const { count, error } = await db.from("anuncios").select("id", { count: "exact", head: true })
    .eq("vitrine_id", lojaId).eq("status", "rascunho").not("pronto_em", "is", null);
  return error ? 0 : count ?? 0;
}

/**
 * Copia as fotos para a pasta do dono, troca os endereços no banco, apaga as cópias antigas
 * e publica os produtos prontos (como o dono, com as conferências normais).
 * Pode rodar de novo sem estragar nada: o que já foi copiado é pulado.
 * Devolve null se algo falhou (a Minha loja mostra "Terminar de receber a loja" enquanto houver
 * fotos na pasta provisória ou produtos prontos sem publicar).
 */
export async function concluirMudancaLoja(lojaId: string): Promise<ResultadoRecebimento | null> {
  if (!ehUuid(lojaId)) return null;
  const admin = supabaseAdmin();
  const { data, error } = await admin.rpc("fotos_mudanca_loja", { p_vitrine: lojaId }).maybeSingle<Mudanca>();
  if (error) return null;
  if (data) {
    const { de, para } = data;
    const caminhos = data.caminhos ?? [];
    if (!/^user_montagem[0-9a-f]{32}$/.test(de) || !/^user_[A-Za-z0-9]+$/.test(para)) return null;
    if (caminhos.some((c) => !c.startsWith(`${de}/`) || c.includes(".."))) return null;
    const balde = admin.storage.from(BALDE);
    for (let i = 0; i < caminhos.length; i += LOTE) {
      const resultados = await Promise.all(
        caminhos.slice(i, i + LOTE).map((c) => balde.copy(c, para + c.slice(de.length))),
      );
      // Já copiada (nova tentativa) ou foto que não existe mais: segue. Outro erro: para tudo.
      if (resultados.some((r) => r.error && !/exist|not.?found/i.test(r.error.message))) return null;
    }
    const troca = await admin.rpc("trocar_pasta_loja", { p_vitrine: lojaId });
    if (troca.error) return null;
    // As fotos antigas ficaram sem uso. Se apagar falhar, só ocupa espaço.
    for (let i = 0; i < caminhos.length; i += 100) await balde.remove(caminhos.slice(i, i + 100));
  }
  const db = await createClient();
  const prontos = await db.rpc("publicar_prontos_loja", { p_vitrine: lojaId }).maybeSingle<ResultadoRecebimento>();
  if (prontos.error) return null;
  return prontos.data ?? { publicados: 0, em_analise: 0, rascunhos: 0 };
}
