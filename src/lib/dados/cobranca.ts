import "server-only";
import { createClient } from "@/lib/supabase/server";
import { seguro } from "@/lib/dados/seguro";
import { lerConfig, lerConfigNumero } from "@/lib/dados/config";
import { ehUuid } from "@/lib/formato";
import type { MeuPagamento, MinhaAssinatura, OpcaoAssinatura } from "@/lib/tipos-cobranca";

// Leituras de "Meu plano" e do anúncio avulso. Quem garante dono e regras é o banco
// (minha_assinatura, opcoes_assinatura e a RLS de pagamentos). Em erro devolvem vazio.

/** Situação do plano do vendedor logado (null quando não vende). */
export async function minhaAssinatura(): Promise<MinhaAssinatura | null> {
  return seguro(async () => {
    const db = await createClient();
    const { data, error } = await db.rpc("minha_assinatura");
    const linha = Array.isArray(data) ? data[0] : data;
    if (error || !linha) return null;
    const l = linha as MinhaAssinatura;
    return { ...l, aviso_dias: Number(l.aviso_dias ?? 0), preco_centavos: Number(l.preco_centavos ?? 0) };
  }, null);
}

/** Planos à venda para o vendedor logado em cada período, com valor e regra antes de pagar. */
export async function opcoesAssinatura(): Promise<OpcaoAssinatura[]> {
  return seguro(async () => {
    const db = await createClient();
    const { data, error } = await db.rpc("opcoes_assinatura");
    if (error || !Array.isArray(data)) return [];
    return (data as OpcaoAssinatura[]).map((o) => ({ ...o, desconto_percentual: Number(o.desconto_percentual ?? 0) }));
  }, []);
}

type LinhaPagamento = Omit<MeuPagamento, "plano_nome" | "tem_cobranca"> & {
  asaas_cobranca_id: string | null;
  planos: { nome: string } | null;
};

/** Um pagamento do vendedor logado (de outra pessoa → null, pela RLS). */
export async function meuPagamento(id: string): Promise<MeuPagamento | null> {
  if (!ehUuid(id)) return null;
  return seguro(async () => {
    const db = await createClient();
    const { data, error } = await db
      .from("pagamentos")
      .select(
        "id, tipo, status, valor_centavos, plano_codigo, meses, anuncio_id, regra, concedido_de, concedido_ate, forma, link_pagamento, asaas_cobranca_id, pago_em, criado_em, observacao, devolver_motivo, planos(nome)",
      )
      .eq("id", id)
      .maybeSingle();
    if (error || !data) return null;
    const { asaas_cobranca_id, planos, ...l } = data as unknown as LinhaPagamento;
    return { ...l, meses: l.meses ?? 1, plano_nome: planos?.nome ?? null, tem_cobranca: !!asaas_cobranca_id };
  }, null);
}

/**
 * Preço e dias do anúncio avulso para esta vitrine, ou null quando não é oferecido
 * (preço 0/vazio no painel, ou avulso.publico = "pf" e a vitrine é loja). O banco confere de novo.
 */
export async function avulsoParaMim(vitrine: { tipo: string; microrregiao_id: string }): Promise<{ preco: number; dias: number } | null> {
  const [preco, dias, publico] = await Promise.all([
    lerConfigNumero("avulso.preco_centavos", vitrine.microrregiao_id),
    lerConfigNumero("avulso.dias", vitrine.microrregiao_id),
    lerConfig<string>("avulso.publico", vitrine.microrregiao_id, "pf"),
  ]);
  if (!preco || preco <= 0 || !dias || dias < 1) return null;
  if (publico !== "todos" && vitrine.tipo !== "pf") return null;
  return { preco, dias };
}
