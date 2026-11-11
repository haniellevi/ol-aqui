import "server-only";
import { clerkClient } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { apagarConta, limparFilaArquivos } from "@/lib/conta-exclusao";

export type ResultadoLimpeza = { contas: number; lojas: number; anuncios: number; falhas: number };

/**
 * Apaga de vez o que passou do prazo da lixeira (ou foi antecipado pelo admin): contas (no Clerk
 * e no banco), lojas e anúncios, e as fotos que ninguém mais usa. Provas e pagamentos ficam.
 * Cada item é independente: uma falha não impede os outros e a próxima execução tenta de novo.
 */
export async function executarLimpeza(): Promise<ResultadoLimpeza> {
  const db = supabaseAdmin();
  const fila = await db.rpc("limpeza_pendente");
  if (fila.error) throw new Error(fila.error.message);
  const { contas = [], lojas = [], anuncios = [] } = (fila.data ?? {}) as { contas?: string[]; lojas?: string[]; anuncios?: string[] };
  const resultado: ResultadoLimpeza = { contas: 0, lojas: 0, anuncios: 0, falhas: 0 };

  for (const id of contas) {
    try {
      // Reserva no banco antes de apagar no Clerk: quem cancelou depois da fila não é apagado.
      const reserva = await db.rpc("limpeza_reservar_conta", { p_id: id });
      if (reserva.error) throw new Error(reserva.error.message);
      if (!reserva.data) continue;
      try {
        await (await clerkClient()).users.deleteUser(id);
      } catch (e) {
        if ((e as { status?: number }).status !== 404) throw e; // 404: já apagada no Clerk
      }
      await apagarConta(id); // o webhook user.deleted também chama; é idempotente
      resultado.contas++;
    } catch (e) {
      resultado.falhas++;
      console.error("limpeza conta", id, e);
    }
  }
  for (const id of lojas) {
    try {
      // As fotos ficam na fila do banco e saem do Storage no fim.
      const r = await db.rpc("purgar_loja", { p_loja: id });
      if (r.error) throw new Error(r.error.message);
      resultado.lojas++;
    } catch (e) {
      resultado.falhas++;
      console.error("limpeza loja", id, e);
    }
  }
  for (const id of anuncios) {
    try {
      const r = await db.rpc("purgar_anuncio", { p_id: id });
      if (r.error) throw new Error(r.error.message);
      resultado.anuncios++;
    } catch (e) {
      resultado.falhas++;
      console.error("limpeza anuncio", id, e);
    }
  }
  try {
    await limparFilaArquivos(db);
  } catch (e) {
    resultado.falhas++;
    console.error("limpeza arquivos", e);
  }
  return resultado;
}
