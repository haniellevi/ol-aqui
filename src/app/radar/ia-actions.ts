"use server";

import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { buscarAnuncios } from "@/lib/dados/anuncios";
import { meuPerfilEVitrine } from "@/lib/dados/conta";
import { acessoRadar, meusAnunciosNoAr, pedidoRadar } from "@/lib/dados/radar";
import { ehUuid, linkAnuncio } from "@/lib/formato";
import { comReserva } from "@/lib/radar-ia/uso";
import { escolherTres, type Escolhido } from "@/lib/radar-ia/escolher";
import { escreverPerguntas, pedidoEhVago } from "@/lib/radar-ia/perguntas";
import { CUSTO_JEV_USD } from "@/lib/radar-ia/jev";
import type { DestaqueIA, ParecidoIA, PerguntaIA } from "@/lib/radar-ia/tipos";

// Ações da IA do Radar (fase 3). Nunca travam a tela: qualquer problema (IA desligada, teto do mês,
// 20 usos no dia, demora, erro) devolve null e o Radar segue como sem IA. Arquivo separado de
// actions.ts para não mexer no que a fase 2 (Conversas) também altera.

function texto(v: unknown, max: number): string {
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

/** Pedido vago: até 2 perguntas. Pedido claro: []. Sem IA: null. */
export async function perguntasParaPedido(titulo: string, detalhes: string): Promise<PerguntaIA[] | null> {
  try {
    const { userId } = await auth();
    const t = texto(titulo, 120);
    const d = texto(detalhes, 1000);
    if (!userId || t.length < 3) return null;
    const vago = await comReserva(userId, "perguntas", async () => {
      const v = await pedidoEhVago(t, d);
      return { valor: v, custoUsd: v === null ? null : CUSTO_JEV_USD, tokensEntrada: 0, tokensSaida: 0, falha: v === null ? "jev_sem_resposta" : null };
    });
    if (vago === null) return null;
    if (!vago) return [];
    return await comReserva(userId, "perguntas", async () => {
      const r = await escreverPerguntas(t, d);
      return { valor: r.perguntas, custoUsd: r.custoUsd, tokensEntrada: r.tokensEntrada, tokensSaida: r.tokensSaida, falha: r.falha };
    });
  } catch {
    return null;
  }
}

/** "Achamos isso na região. Quer ver?": até 3 anúncios da região com a frase da IA. */
export async function parecidosParaPedido(titulo: string, detalhes: string): Promise<ParecidoIA[] | null> {
  try {
    const { userId } = await auth();
    const t = texto(titulo, 120);
    if (!userId || t.length < 3) return null;
    const conta = await meuPerfilEVitrine();
    const regiaoId = conta?.perfil.microrregiao_id;
    if (!regiaoId) return null;
    const db = await createClient();
    const { data: regiao } = await db.from("microrregioes").select("slug").eq("id", regiaoId).maybeSingle();
    if (!regiao?.slug) return null;
    const { anuncios } = await buscarAnuncios({ q: t.slice(0, 80), limite: 20, regiao: regiao.slug });
    const minhaLoja = conta.vitrine?.slug ?? null;
    const lista = anuncios.filter((a) => !minhaLoja || a.vitrine_slug !== minhaLoja);
    if (lista.length === 0) return [];
    const escolhidos = await comReserva(userId, "parecidos", async () => {
      const r = await escolherTres({ titulo: t, detalhes: texto(detalhes, 1000) },
        lista.map((a) => ({ id: a.id, titulo: a.titulo, preco_centavos: a.preco_centavos, cidade: a.cidade })));
      return { valor: r.escolhidos, custoUsd: r.custoUsd, tokensEntrada: r.tokensEntrada, tokensSaida: r.tokensSaida, falha: r.falha };
    });
    if (escolhidos === null) return null;
    const porId = new Map(lista.map((a) => [a.id, a]));
    return escolhidos.flatMap((e: Escolhido) => {
      const a = porId.get(e.id);
      return a ? [{ id: a.id, titulo: a.titulo, preco_centavos: a.preco_centavos, capa: a.capa, vitrine_nome: a.vitrine_nome ?? null,
        link: linkAnuncio(a.id, a.titulo, a.slug), motivo: e.motivo }] : [];
    });
  } catch {
    return null;
  }
}

/** Folha "Propor": os 3 anúncios da vitrine da loja que mais combinam com o pedido. */
export async function melhoresDaVitrine(pedidoId: string): Promise<DestaqueIA[] | null> {
  try {
    const { userId } = await auth();
    if (!userId || !ehUuid(pedidoId)) return null;
    const pedido = await pedidoRadar(pedidoId);
    if (!pedido || pedido.bloqueado || pedido.sou_comprador || pedido.situacao !== "aberto") return null;
    const acesso = await acessoRadar();
    if (!acesso.temAcesso) return null;
    const meus = (await meusAnunciosNoAr()).slice(0, 20);
    if (meus.length < 2) return null;
    return await comReserva(userId, "vitrine", async () => {
      const r = await escolherTres({ titulo: pedido.titulo, detalhes: pedido.detalhes ?? "" },
        meus.map((a) => ({ id: a.id, titulo: a.titulo, preco_centavos: a.preco_centavos })));
      return { valor: r.escolhidos, custoUsd: r.custoUsd, tokensEntrada: r.tokensEntrada, tokensSaida: r.tokensSaida, falha: r.falha };
    });
  } catch {
    return null;
  }
}
