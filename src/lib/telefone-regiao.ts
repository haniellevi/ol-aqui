import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { REGEX_DDD, normalizarTelefone } from "@/lib/telefone";

// DDD para o telefone digitado sem DDD. Só lê o DDD (nada pessoal). Sem região, sem DDD ou erro de leitura → null:
// a tela então pede o DDD, nunca chuta um. Cidade que tem outro DDD dentro da região (cidades.ddd, ex.: Barreiras-BA
// e Formosa do Rio Preto-BA são 77) também não recebe o da região: quem mora lá digita o DDD.

/** DDD de uma microrregião (microrregioes.ddd). */
export async function dddDaRegiao(microrregiaoId: string | null | undefined): Promise<string | null> {
  if (!microrregiaoId) return null;
  try {
    const { data, error } = await supabaseAdmin().from("microrregioes").select("ddd").eq("id", microrregiaoId).maybeSingle();
    return !error && typeof data?.ddd === "string" && REGEX_DDD.test(data.ddd) ? data.ddd : null;
  } catch {
    return null;
  }
}

/**
 * DDD de quem mora numa cidade da região: o da região, salvo quando a cidade tem outro DDD (então null: pede o DDD).
 * Cidade que não está na lista da região cai no DDD da região (o cadastro escolhe a cidade da lista).
 */
export async function dddDaCidade(microrregiaoId: string | null | undefined, cidade: string | null | undefined): Promise<string | null> {
  const regiao = await dddDaRegiao(microrregiaoId);
  const nome = typeof cidade === "string" ? cidade.trim() : "";
  if (!microrregiaoId || !nome) return regiao;
  try {
    const { data, error } = await supabaseAdmin().from("cidades").select("ddd")
      .eq("microrregiao_id", microrregiaoId).eq("nome", nome).maybeSingle();
    if (error) return null;
    if (!data?.ddd || data.ddd === regiao) return regiao;
    return null;
  } catch {
    return null;
  }
}

/** DDD de quem mora na região e na cidade da pessoa (perfis.microrregiao_id, perfis.cidade). */
export async function dddDoPerfil(userId: string | null | undefined): Promise<string | null> {
  if (!userId) return null;
  try {
    const { data, error } = await supabaseAdmin().from("perfis").select("microrregiao_id, cidade").eq("id", userId).maybeSingle();
    return error || !data?.microrregiao_id ? null : dddDaCidade(data.microrregiao_id, data.cidade);
  } catch {
    return null;
  }
}

/** DDD da região e da cidade de uma loja (vitrines_lojas.microrregiao_id, vitrines_lojas.cidade). */
export async function dddDaLoja(lojaId: string | null | undefined): Promise<string | null> {
  if (!lojaId) return null;
  try {
    const { data, error } = await supabaseAdmin().from("vitrines_lojas").select("microrregiao_id, cidade").eq("id", lojaId).maybeSingle();
    return error || !data?.microrregiao_id ? null : dddDaCidade(data.microrregiao_id, data.cidade);
  } catch {
    return null;
  }
}

/**
 * Normaliza o número com o DDD da região só quando ele faltou: quem já digitou o DDD não gera consulta.
 * `normalizar` é uma das funções de src/lib/formato.ts ou src/lib/whatsapp/servico.ts (recebe o DDD opcional).
 */
export async function numeroComRegiao(
  entrada: unknown,
  regiao: () => Promise<string | null>,
  normalizar: (entrada: string, ddd?: string | null) => string | null,
  aceitaFixo = false,
): Promise<string | null> {
  if (typeof entrada !== "string") return null;
  const direto = normalizar(entrada, null);
  if (direto || normalizarTelefone(entrada, { aceitaFixo }).erro !== "sem_ddd") return direto;
  return normalizar(entrada, await regiao());
}
