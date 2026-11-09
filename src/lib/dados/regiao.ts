import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type { Cidade, Regiao } from "@/lib/tipos";
import { ehUuid } from "@/lib/formato";

/** Cookie com o ID da cidade escolhida pelo visitante (tela T1, "Escolher cidade"). */
export const COOKIE_CIDADE = "olaki_cidade";
/** Região-piloto, usada enquanto o visitante não escolhe a cidade. */
export const REGIAO_PADRAO = "corrente-pi";

type LinhaRegiao = { id: string; slug: string; nome: string; cidade_sede: string | null };

/**
 * Região do visitante: a da cidade guardada no cookie ou, sem cookie, a região-piloto.
 * Lê cookies, então a página que chamar fica dinâmica.
 */
export const regiaoAtual = cache(async (): Promise<Regiao | null> => {
  const salvo = (await cookies()).get(COOKIE_CIDADE)?.value; // primeiro: marca a página como dinâmica
  return lerRegiao(salvo);
});

async function lerRegiao(salvo: string | undefined): Promise<Regiao | null> {
  const db = await createClient();
  const cidadeEscolhida = salvo ? safeDecode(salvo).trim().slice(0, 80) : null;

  if (cidadeEscolhida) {
    const { data: c, error } = await db
      .from("cidades")
      .select("nome, microrregioes!inner(id, slug, nome, cidade_sede, ativa)")
      .eq("ativa", true)
      .eq(ehUuid(cidadeEscolhida) ? "id" : "nome", cidadeEscolhida)
      .eq("microrregioes.ativa", true)
      .limit(1)
      .maybeSingle();
    if (error) throw new Error("Não foi possível carregar sua região.");
    const r = c?.microrregioes as unknown as LinhaRegiao | undefined;
    if (c && r) return { id: r.id, slug: r.slug, nome: r.nome, cidadeSede: r.cidade_sede, cidade: c.nome as string };
  }

  const { data: r, error } = await db
    .from("microrregioes")
    .select("id, slug, nome, cidade_sede")
    .eq("slug", REGIAO_PADRAO)
    .eq("ativa", true)
    .maybeSingle<LinhaRegiao>();
  if (error) throw new Error("Não foi possível carregar sua região.");
  return r ? { id: r.id, slug: r.slug, nome: r.nome, cidadeSede: r.cidade_sede, cidade: null } : null;
}

/** Cidades ativas de uma região (seletor de cidade, filtro de busca, passo "Local"). */
export const listarCidades = cache(async (microrregiaoId: string): Promise<Cidade[]> => {
  const db = await createClient();
  const { data, error } = await db
    .from("cidades")
    .select("id, nome, uf, microrregiao_id")
    .eq("microrregiao_id", microrregiaoId)
    .eq("ativa", true)
    .order("nome");
  if (error) throw new Error("Não foi possível carregar as cidades.");
  return (data ?? []) as Cidade[];
});

function safeDecode(v: string) {
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}
