// app/radar/actions.ts
"use server";

import { createClient } from "@/lib/supabase/server";

export type ResultadoProposta =
  | { ok: true; modo: "whatsapp_direto"; linkWhatsapp: string }
  | { ok: true; modo: "propostas_prazo"; mensagem: string }
  | { ok: false; erro: string; precisaPlano?: boolean };

/**
 * Chama revelar_contato_radar no Postgres. É ELA que valida plano, propostas
 * restantes do teste, região, limite do pedido e o modo escolhido pelo comprador.
 * - whatsapp_direto: devolve o WhatsApp do comprador e o front abre a conversa.
 * - propostas_prazo: guarda a oferta; o comprador recebe o resumo no fim do prazo.
 */
export async function proporProduto(entrada: {
  pedidoId: string;
  anuncioId?: string;
  mensagem?: string;
  precoReais?: number;
}): Promise<ResultadoProposta> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("revelar_contato_radar", {
      p_pedido_id: entrada.pedidoId,
      p_anuncio_id: entrada.anuncioId ?? null,
      p_mensagem: entrada.mensagem?.slice(0, 500) ?? null,
      p_preco_centavos: entrada.precoReais != null ? Math.round(entrada.precoReais * 100) : null,
    })
    .single<{ modo: "whatsapp_direto" | "propostas_prazo"; whatsapp: string | null; mensagem: string }>();

  if (error) return { ok: false, erro: error.message, precisaPlano: error.code === "42501" };

  if (data.modo === "propostas_prazo") return { ok: true, modo: "propostas_prazo", mensagem: data.mensagem };

  if (!data.whatsapp) return { ok: false, erro: "Este comprador ainda não cadastrou o WhatsApp." };
  return {
    ok: true,
    modo: "whatsapp_direto",
    linkWhatsapp: `https://wa.me/${data.whatsapp}?text=${encodeURIComponent(data.mensagem)}`,
  };
}
