import "server-only";
import { cache } from "react";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { seguro } from "@/lib/dados/seguro";
import { meuAnuncio } from "@/lib/dados/anuncios";
import { ehUuid, urlAbsoluta } from "@/lib/formato";
import { linkDestacar } from "@/lib/rotas";
import type { AnuncioCard } from "@/lib/tipos";
import type { LojaEmDestaque, OpcaoDestaque, PedidoDestaque, ResultadoDestaque } from "@/lib/tipos-destaques";

// Leituras dos destaques pagos. Quem garante dono/admin é o banco (RLS e as funções
// opcoes_destaque, resultados_destaques). Em erro devolvem vazio: a tela nunca quebra por isso.

/** Tipos que a pessoa pode contratar agora para o anúncio (ou para a loja, com `null`). */
export async function opcoesDestaque(anuncioId: string | null): Promise<OpcaoDestaque[]> {
  if (anuncioId !== null && !ehUuid(anuncioId)) return [];
  return seguro(async () => {
    const db = await createClient();
    const { data, error } = await db.rpc("opcoes_destaque", { p_anuncio_id: anuncioId });
    if (error || !Array.isArray(data)) return [];
    return (data as OpcaoDestaque[]).map((o) => ({ ...o, creditos_restantes: Number(o.creditos_restantes ?? 0) }));
  }, []);
}

type LinhaPedido = {
  id: string;
  tipo: PedidoDestaque["tipo"];
  anuncio_id: string | null;
  status: PedidoDestaque["status"];
  origem: PedidoDestaque["origem"];
  preco_centavos: number;
  inicio: string | null;
  fim: string | null;
  reservado_ate: string | null;
  pagamento_id: string | null;
  destaque_tipos: { nome: string } | null;
  pagamentos: { status: PedidoDestaque["pagamento_status"]; forma: PedidoDestaque["pagamento_forma"]; link_pagamento: string | null; asaas_cobranca_id: string | null } | null;
};

/** Um pedido de destaque do usuário logado (de outra pessoa → null, pela RLS). */
export async function meuPedidoDestaque(id: string): Promise<PedidoDestaque | null> {
  if (!ehUuid(id)) return null;
  return seguro(async () => {
    const db = await createClient();
    const { data, error } = await db
      .from("destaques")
      .select(
        "id, tipo, anuncio_id, status, origem, preco_centavos, inicio, fim, reservado_ate, pagamento_id, destaque_tipos(nome), pagamentos(status, forma, link_pagamento, asaas_cobranca_id)",
      )
      .eq("id", id)
      .maybeSingle();
    if (error || !data) return null;
    const l = data as unknown as LinhaPedido;
    return {
      id: l.id,
      tipo: l.tipo,
      tipo_nome: l.destaque_tipos?.nome ?? "Destaque",
      anuncio_id: l.anuncio_id,
      status: l.status,
      origem: l.origem,
      preco_centavos: l.preco_centavos,
      inicio: l.inicio,
      fim: l.fim,
      reservado_ate: l.reservado_ate,
      pagamento_id: l.pagamento_id,
      pagamento_status: l.pagamentos?.status ?? null,
      pagamento_forma: l.pagamentos?.forma ?? null,
      link_pagamento: l.pagamentos?.link_pagamento ?? null,
      tem_cobranca: !!l.pagamentos?.asaas_cobranca_id,
    };
  }, null);
}

/**
 * Destaques do usuário logado com visualizações e cliques no WhatsApp dentro da janela de cada um.
 * `todos = true` só funciona para admin (o banco confere).
 */
export const resultadosDestaques = cache(
  async (anuncioId: string | null = null, todos = false, limite = 100): Promise<ResultadoDestaque[]> =>
    seguro(async () => {
      const { userId } = await auth();
      if (!userId) return [];
      const db = await createClient();
      const { data, error } = await db.rpc("resultados_destaques", { p_anuncio_id: anuncioId, p_todos: todos, p_limite: limite });
      if (error || !Array.isArray(data)) return [];
      return (data as ResultadoDestaque[]).map((r) => ({
        ...r,
        visualizacoes: Number(r.visualizacoes ?? 0),
        cliques_whatsapp: Number(r.cliques_whatsapp ?? 0),
      }));
    }, []),
);

/** Carrossel "Destaques perto de você": tipo "home" ativo na região, em rodízio justo. */
export async function destaquesHome(microrregiaoId: string, limite = 12): Promise<AnuncioCard[]> {
  if (!ehUuid(microrregiaoId)) return [];
  return seguro(async () => {
    const db = await createClient();
    const { data, error } = await db.rpc("destaques_home", { p_microrregiao: microrregiaoId, p_limite: limite });
    if (error || !Array.isArray(data)) return [];
    return (data as AnuncioCard[]).map((a) => ({ ...a, atributos: a.atributos ?? {}, destaque: true, total: Number(a.total) }));
  }, []);
}

/** Bloco "Lojas em destaque": tipo "loja" ativo na região, em rodízio justo. */
export async function lojasEmDestaque(microrregiaoId: string, limite = 12): Promise<LojaEmDestaque[]> {
  if (!ehUuid(microrregiaoId)) return [];
  return seguro(async () => {
    const db = await createClient();
    const { data, error } = await db.rpc("lojas_em_destaque", { p_microrregiao: microrregiaoId, p_limite: limite });
    if (error || !Array.isArray(data)) return [];
    return data as LojaEmDestaque[];
  }, []);
}

/**
 * Link completo da tela "Destacar" de um anúncio do usuário logado (para o robô Aki mandar).
 * Confere se o anúncio é da pessoa; de outra pessoa (ou sem login) → null.
 */
export async function gerarLinkDestaque(anuncioId: string): Promise<string | null> {
  const a = await meuAnuncio(anuncioId);
  return a ? urlAbsoluta(linkDestacar(a.id)) : null;
}

/** "340 visualizações e 12 cliques no WhatsApp" (frase do resultado para o vendedor). */
export function fraseResultado(r: Pick<ResultadoDestaque, "visualizacoes" | "cliques_whatsapp">): string {
  const n = new Intl.NumberFormat("pt-BR");
  const v = `${n.format(r.visualizacoes)} ${r.visualizacoes === 1 ? "visualização" : "visualizações"}`;
  const c = `${n.format(r.cliques_whatsapp)} ${r.cliques_whatsapp === 1 ? "clique" : "cliques"} no WhatsApp`;
  return `${v} e ${c}`;
}
