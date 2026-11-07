import "server-only";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { seguro } from "@/lib/dados/seguro";
import { ehUuid } from "@/lib/formato";
import type { CategoriaPedido, ModoContato, StatusPedido, UrgenciaPedido } from "@/lib/radar";

// Leituras do Radar do comprador. A RLS de radar_pedidos só deixa o dono (e o admin) ler;
// as propostas recebidas também só saem para o dono do pedido (policy "propostas leitura").

export type MeuPedido = {
  id: string;
  categoria: CategoriaPedido;
  titulo: string;
  detalhes: string | null;
  preco_max_centavos: number | null;
  cidade: string;
  urgencia: UrgenciaPedido;
  status: StatusPedido;
  modo_contato: ModoContato;
  propostas_ate: string | null;
  expira_em: string;
  total_propostas: number;
  max_propostas: number;
  motivo_analise: string | null;
  criado_em: string;
};

export type PropostaRecebida = {
  id: string;
  mensagem: string | null;
  preco_centavos: number | null;
  foto_url: string | null;
  escolhida: boolean;
  criado_em: string;
  loja: { nome: string; slug: string; logo_url: string | null; cidade: string | null; selo: boolean } | null;
  anuncio: { id: string; titulo: string; preco_centavos: number | null; capa: string | null } | null;
};

const COLUNAS_PEDIDO =
  "id, categoria, titulo, detalhes, preco_max_centavos, cidade, urgencia, status, modo_contato, propostas_ate, expira_em, total_propostas, max_propostas, motivo_analise, criado_em";

/** Pedidos do usuário logado, do mais novo para o mais velho. */
export async function meusPedidos(): Promise<MeuPedido[]> {
  return seguro(async () => {
    const { userId } = await auth();
    if (!userId) return [];
    const db = await createClient();
    const { data, error } = await db
      .from("radar_pedidos")
      .select(COLUNAS_PEDIDO)
      .eq("comprador_id", userId)
      .order("criado_em", { ascending: false })
      .limit(50);
    return error ? [] : ((data ?? []) as MeuPedido[]);
  }, []);
}

/** Um pedido do usuário logado (null se não existe ou não é dele). */
export async function meuPedido(id: string): Promise<MeuPedido | null> {
  if (!ehUuid(id)) return null;
  return seguro(async () => {
    const { userId } = await auth();
    if (!userId) return null;
    const db = await createClient();
    const { data, error } = await db
      .from("radar_pedidos")
      .select(COLUNAS_PEDIDO)
      .eq("id", id)
      .eq("comprador_id", userId)
      .maybeSingle<MeuPedido>();
    return error ? null : data;
  }, null);
}

type LinhaProposta = {
  id: string;
  mensagem: string | null;
  preco_centavos: number | null;
  foto_url: string | null;
  escolhida: boolean;
  criado_em: string;
  vitrines_lojas: { nome: string; slug: string; logo_url: string | null; cidade: string | null; selo_loja_verificada: boolean } | null;
  anuncios: { id: string; titulo: string; preco_centavos: number | null; fotos: string[] | null } | null;
};

/** Propostas que as lojas mandaram para um pedido do usuário (a menor oferta primeiro). */
export async function propostasDoPedido(pedidoId: string): Promise<PropostaRecebida[]> {
  return seguro(async () => {
    const db = await createClient();
    const { data, error } = await db
      .from("radar_propostas")
      .select(
        "id, mensagem, preco_centavos, foto_url, escolhida, criado_em, vitrines_lojas(nome, slug, logo_url, cidade, selo_loja_verificada), anuncios(id, titulo, preco_centavos, fotos)",
      )
      .eq("pedido_id", pedidoId)
      .order("criado_em", { ascending: true })
      .limit(50)
      .returns<LinhaProposta[]>();
    if (error) return [];
    const lista = (data ?? []).map((l) => {
      const v = l.vitrines_lojas;
      const a = l.anuncios;
      return {
        id: l.id,
        mensagem: l.mensagem,
        preco_centavos: l.preco_centavos ?? a?.preco_centavos ?? null,
        foto_url: l.foto_url ?? a?.fotos?.[0] ?? null,
        escolhida: l.escolhida,
        criado_em: l.criado_em,
        loja: v ? { nome: v.nome, slug: v.slug, logo_url: v.logo_url, cidade: v.cidade, selo: v.selo_loja_verificada } : null,
        anuncio: a ? { id: a.id, titulo: a.titulo, preco_centavos: a.preco_centavos, capa: a.fotos?.[0] ?? null } : null,
      };
    });
    // menor preço primeiro; sem preço vai para o fim (na ordem em que chegou)
    return lista.sort((x, y) => (x.preco_centavos ?? Infinity) - (y.preco_centavos ?? Infinity));
  }, []);
}
