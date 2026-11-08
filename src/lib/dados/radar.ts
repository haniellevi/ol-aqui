import "server-only";
import { cache } from "react";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { seguro } from "@/lib/dados/seguro";
import { lerConfig } from "@/lib/dados/config";
import { ehUuid } from "@/lib/formato";
import type {
  AnuncioParaProposta,
  MeuPedidoRadar,
  MinhaPropostaNoPedido,
  MinhaPropostaRadar,
  Notificacao,
  PedidoRadarDetalhe,
  PlanoRadar,
  PropostaRecebida,
  RegrasRadar,
} from "@/lib/tipos-radar";

// Leituras do Radar. Tudo passa pelas funções do banco com a sessão da pessoa:
// o bloqueio (detalhes, nome, contato) é feito lá, nunca aqui.

const numero = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

/** Regras do painel: prazos que o comprador pode escolher, limites e tamanho da mensagem. */
export async function regrasRadar(microrregiaoId: string | null): Promise<RegrasRadar> {
  const [prazos, porDia, abertos, mensagem] = await Promise.all([
    lerConfig<unknown>("radar.prazos_horas", microrregiaoId, [24, 72, 168]),
    lerConfig<unknown>("radar.pedidos_por_dia", microrregiaoId, null),
    lerConfig<unknown>("radar.pedidos_abertos_max", microrregiaoId, null),
    lerConfig<unknown>("radar.proposta_mensagem_max", microrregiaoId, 300),
  ]);
  const lista = Array.isArray(prazos) ? prazos.map(numero).filter((n): n is number => n !== null && n > 0) : [];
  return {
    prazosHoras: [...new Set(lista)].sort((a, b) => a - b),
    pedidosPorDia: numero(porDia),
    pedidosAbertosMax: numero(abertos),
    mensagemMax: Math.min(Math.max(numero(mensagem) ?? 300, 1), 500),
  };
}

/** Planos com Radar (para quem ainda não tem), na ordem do painel. */
export const planosComRadar = cache(
  (): Promise<PlanoRadar[]> =>
    seguro(async () => {
      const db = await createClient();
      const { data, error } = await db
        .from("planos")
        .select("codigo, nome, preco_centavos, periodo_dias, propostas_radar_mes")
        .eq("acesso_radar", true)
        .eq("e_teste", false)
        .order("ordem");
      return error ? [] : ((data ?? []) as PlanoRadar[]);
    }, []),
);

/** Acesso ao Radar e propostas que sobram (null = sem limite). */
export const acessoRadar = cache(
  (): Promise<{ temAcesso: boolean; restantes: number | null }> =>
    seguro(async () => {
      const db = await createClient();
      const [{ data: acesso }, { data: restantes }] = await Promise.all([db.rpc("tem_plano_pago"), db.rpc("propostas_restantes")]);
      return { temAcesso: acesso === true, restantes: acesso === true ? ((restantes as number | null) ?? null) : 0 };
    }, { temAcesso: false, restantes: 0 }),
);

export async function meusPedidos(): Promise<MeuPedidoRadar[]> {
  return seguro(async () => {
    const db = await createClient();
    const { data, error } = await db.rpc("meus_pedidos_radar");
    return error ? [] : ((data ?? []) as MeuPedidoRadar[]);
  }, []);
}

export async function minhasPropostas(): Promise<MinhaPropostaRadar[]> {
  return seguro(async () => {
    const db = await createClient();
    const { data, error } = await db.rpc("minhas_propostas_radar");
    return error ? [] : ((data ?? []) as MinhaPropostaRadar[]);
  }, []);
}

/** Um pedido (null = não existe ou a pessoa não pode ver). */
export const pedidoRadar = cache(
  (id: string): Promise<PedidoRadarDetalhe | null> =>
    seguro(async () => {
      if (!ehUuid(id)) return null;
      const db = await createClient();
      const { data, error } = await db.rpc("radar_pedido", { p_id: id });
      const linha = Array.isArray(data) ? data[0] : data;
      return error || !linha ? null : (linha as PedidoRadarDetalhe);
    }, null),
);

export async function propostasDoPedido(id: string): Promise<PropostaRecebida[]> {
  return seguro(async () => {
    if (!ehUuid(id)) return [];
    const db = await createClient();
    const { data, error } = await db.rpc("propostas_do_pedido", { p_pedido: id });
    return error ? [] : ((data ?? []) as PropostaRecebida[]);
  }, []);
}

/** A proposta da minha loja neste pedido (para editar), ou null. */
export async function minhaPropostaNoPedido(pedidoId: string): Promise<MinhaPropostaNoPedido | null> {
  return seguro(async () => {
    const { userId } = await auth();
    if (!userId || !ehUuid(pedidoId)) return null;
    const db = await createClient();
    const { data } = await db
      .from("radar_propostas")
      .select("id, preco_centavos, mensagem, foto_url, anuncio_id, status, moderado_motivo, escolhida, vitrines_lojas!inner(dono_id)")
      .eq("pedido_id", pedidoId)
      .eq("vitrines_lojas.dono_id", userId)
      .maybeSingle();
    if (!data) return null;
    const { vitrines_lojas: _v, ...resto } = data as unknown as MinhaPropostaNoPedido & { vitrines_lojas: unknown };
    void _v;
    return resto;
  }, null);
}

/** Anúncios no ar da minha vitrine (para escolher na proposta). */
export async function meusAnunciosNoAr(): Promise<AnuncioParaProposta[]> {
  return seguro(async () => {
    const { userId } = await auth();
    if (!userId) return [];
    const db = await createClient();
    const { data, error } = await db
      .from("anuncios")
      .select("id, titulo, preco_centavos, fotos, vitrines_lojas!inner(dono_id)")
      .eq("vitrines_lojas.dono_id", userId)
      .eq("status", "ativo")
      .order("atualizado_em", { ascending: false })
      .limit(60);
    if (error || !data) return [];
    return (data as unknown as { id: string; titulo: string; preco_centavos: number | null; fotos: string[] | null }[]).map((a) => ({
      id: a.id,
      titulo: a.titulo,
      preco_centavos: a.preco_centavos,
      capa: a.fotos?.[0] ?? null,
    }));
  }, []);
}

/* ------------------------------ Avisos ------------------------------ */

export async function minhasNotificacoes(limite = 60): Promise<Notificacao[]> {
  return seguro(async () => {
    const { userId } = await auth();
    if (!userId) return [];
    const db = await createClient();
    const { data, error } = await db
      .from("notificacoes")
      .select("id, tipo, titulo, texto, link, lida_em, criado_em")
      .eq("usuario_id", userId)
      .order("criado_em", { ascending: false })
      .limit(limite);
    return error ? [] : ((data ?? []) as Notificacao[]);
  }, []);
}

/** Quantos avisos não lidos (0 em erro: a tela nunca quebra por isso). */
export const avisosNaoLidos = cache(
  (): Promise<number> =>
    seguro(async () => {
      const { userId } = await auth();
      if (!userId) return 0;
      const db = await createClient();
      const { count } = await db
        .from("notificacoes")
        .select("id", { count: "exact", head: true })
        .eq("usuario_id", userId)
        .is("lida_em", null);
      return count ?? 0;
    }, 0),
);
