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
  PreferenciaAviso,
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

/**
 * O painel exige celular confirmado por código para pedir? (radar.exigir_celular_confirmado; padrão: sim)
 * Enquanto o SMS do login não funciona fica false e o comprador digita o WhatsApp no pedido.
 */
export async function exigeCelularConfirmado(microrregiaoId: string | null): Promise<boolean> {
  const v = await lerConfig<unknown>("radar.exigir_celular_confirmado", microrregiaoId, true);
  return v !== false && v !== "false";
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
export const acessoRadar = cache(async (): Promise<{ temAcesso: boolean; restantes: number | null }> => {
  const db = await createClient();
  const [acesso, restantes] = await Promise.all([db.rpc("tem_plano_pago"), db.rpc("propostas_restantes")]);
  if (acesso.error || restantes.error) throw new Error("Não foi possível consultar seu acesso ao Radar.");
  return { temAcesso: acesso.data === true, restantes: acesso.data === true ? (restantes.data as number | null) : 0 };
});

export async function meusPedidos(): Promise<MeuPedidoRadar[]> {
  const db = await createClient();
  const { data, error } = await db.rpc("meus_pedidos_radar");
  if (error || !Array.isArray(data)) throw new Error("Não foi possível carregar seus pedidos.");
  return (data ?? []) as MeuPedidoRadar[];
}

export async function minhasPropostas(): Promise<MinhaPropostaRadar[]> {
  const db = await createClient();
  const { data, error } = await db.rpc("minhas_propostas_radar");
  if (error || !Array.isArray(data)) throw new Error("Não foi possível carregar suas propostas.");
  return (data ?? []) as MinhaPropostaRadar[];
}

/** Um pedido (null = não existe ou a pessoa não pode ver). */
export const pedidoRadar = cache(async (id: string): Promise<PedidoRadarDetalhe | null> => {
  if (!ehUuid(id)) return null;
  const db = await createClient();
  const { data, error } = await db.rpc("radar_pedido", { p_id: id });
  if (error || !Array.isArray(data)) throw new Error("Não foi possível carregar este pedido.");
  return (Array.isArray(data) ? data[0] : data) as PedidoRadarDetalhe | null ?? null;
});

export async function propostasDoPedido(id: string): Promise<PropostaRecebida[]> {
  if (!ehUuid(id)) return [];
  const db = await createClient();
  const { data, error } = await db.rpc("propostas_do_pedido", { p_pedido: id });
  if (error || !Array.isArray(data)) throw new Error("Não foi possível carregar as propostas.");
  return (data ?? []) as PropostaRecebida[];
}

/** A proposta da minha loja neste pedido (para editar), ou null. */
export async function minhaPropostaNoPedido(pedidoId: string): Promise<MinhaPropostaNoPedido | null> {
  const { userId } = await auth();
  if (!userId || !ehUuid(pedidoId)) return null;
  const db = await createClient();
  const { data, error } = await db
    .from("radar_propostas")
    .select("id, preco_centavos, mensagem, foto_url, anuncio_id, status, moderado_motivo, escolhida, vitrines_lojas!inner(dono_id)")
    .eq("pedido_id", pedidoId)
    .eq("vitrines_lojas.dono_id", userId)
    .maybeSingle();
  if (error) throw new Error("Não foi possível carregar sua proposta.");
  if (!data) return null;
  const { vitrines_lojas: _v, ...resto } = data as unknown as MinhaPropostaNoPedido & { vitrines_lojas: unknown };
  void _v;
  return resto;
}

/** Anúncios no ar da minha vitrine (para escolher na proposta). */
export async function meusAnunciosNoAr(): Promise<AnuncioParaProposta[]> {
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
  if (error) throw new Error("Não foi possível carregar seus anúncios.");
  if (!data) return [];
  return (data as unknown as { id: string; titulo: string; preco_centavos: number | null; fotos: string[] | null }[]).map((a) => ({
    id: a.id,
    titulo: a.titulo,
    preco_centavos: a.preco_centavos,
    capa: a.fotos?.[0] ?? null,
  }));
}

/* ------------------------------ Avisos ------------------------------ */

export const AVISOS_POR_PAGINA = 30;
export async function minhasNotificacoes(pagina = 1, somenteNaoLidas = false): Promise<{ avisos: Notificacao[]; total: number }> {
  const { userId } = await auth();
  if (!userId) throw new Error("Entre na sua conta para acessar seus avisos.");
  const db = await createClient();
  const inicio = (Math.max(1, Math.min(10000, Number.isSafeInteger(pagina) ? pagina : 1)) - 1) * AVISOS_POR_PAGINA;
  let consulta = db.from("notificacoes")
    .select("id, tipo, titulo, texto, link, lida_em, criado_em", { count: "exact" })
    .eq("usuario_id", userId).eq("canal", "app")
    .order("criado_em", { ascending: false }).order("id", { ascending: false });
  if (somenteNaoLidas) consulta = consulta.is("lida_em", null);
  const { data, error, count } = await consulta.range(inicio, inicio + AVISOS_POR_PAGINA - 1);
  if (error || !Array.isArray(data) || typeof count !== "number" || count < 0) throw new Error("Não foi possível carregar seus avisos.");
  return { avisos: data as Notificacao[], total: count };
}

/** Contagem de todos os avisos do app, inclusive os que estão nas páginas seguintes. */
export const avisosNaoLidos = cache(async (): Promise<number> => {
  const { userId } = await auth();
  if (!userId) throw new Error("Entre na sua conta para acessar seus avisos.");
  const db = await createClient();
  const { count, error } = await db.from("notificacoes")
    .select("id", { count: "exact", head: true }).eq("usuario_id", userId).eq("canal", "app").is("lida_em", null);
  if (error || typeof count !== "number" || !Number.isSafeInteger(count) || count < 0) throw new Error("Não foi possível contar seus avisos.");
  return count;
});

// Nome e explicação de cada aviso na tela. A lista de quais a pessoa pode escolher vem do painel
// (radar.avisos_escolha); aviso novo sem nome aqui aparece com um nome simples.
const NOMES_AVISO: Record<string, { nome: string; explicacao: string }> = {
  pedido_novo: { nome: "Pedido novo na região", explicacao: "Para lojas: alguém procura o que você vende." },
  proposta_nova: { nome: "Chegou proposta", explicacao: "Uma loja mandou oferta para o seu pedido." },
  prazo_acabou: { nome: "Prazo do pedido acabou", explicacao: "Resumo das ofertas para você escolher." },
  proposta_escolhida: { nome: "Escolheram minha proposta", explicacao: "Para lojas: o comprador quer falar com você." },
};

/** Avisos que a pessoa pode ligar ou desligar, com o que ela já escolheu (sem linha = ligado). */
export async function minhasPreferenciasAvisos(): Promise<PreferenciaAviso[]> {
  const { userId } = await auth();
  if (!userId) throw new Error("Entre na sua conta para acessar suas preferências.");
  const db = await createClient();
  const [config, preferencias] = await Promise.all([
    db.rpc("config", { p_chave: "radar.avisos_escolha", p_microrregiao: null, p_padrao: [] }),
    db.from("preferencias_avisos").select("tipo, ligado").eq("usuario_id", userId).eq("canal", "app"),
  ]);
  if (config.error || !Array.isArray(config.data) || preferencias.error || !Array.isArray(preferencias.data)) throw new Error("Não foi possível carregar suas preferências.");
  const desligados = new Set(preferencias.data.filter((p) => p.ligado === false).map((p) => p.tipo as string));
  return [...new Set(config.data.filter((t): t is string => typeof t === "string" && /^[a-z0-9_]{3,40}$/.test(t)))]
    .map((tipo) => ({ tipo, nome: NOMES_AVISO[tipo]?.nome ?? tipo.replace(/_/g, " "), explicacao: NOMES_AVISO[tipo]?.explicacao ?? "", ligado: !desligados.has(tipo) }));
}
