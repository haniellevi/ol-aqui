import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { EtapaFunil, OpcoesFunil } from "@/lib/admin/funil";

/** Opções dos selects do funil, todas do banco. */
export async function carregarOpcoes(supabase: SupabaseClient): Promise<OpcoesFunil> {
  const [etapas, regioes, cidades, origens, categorias, admins, equipe] = await Promise.all([
    supabase.from("funil_etapas").select("codigo, nome, tipo, ordem, ativa").order("ordem"),
    supabase.from("microrregioes").select("id, nome").order("nome"),
    supabase.from("cidades").select("id, nome, uf, microrregiao_id").eq("ativa", true).order("nome"),
    supabase.from("origens_visita").select("codigo, nome").eq("ativa", true).order("ordem"),
    supabase.from("categorias").select("id, nome").is("pai_id", null).eq("ativa", true).order("ordem"),
    supabase.from("perfis").select("id, nome").eq("e_admin", true).order("nome"),
    supabase.from("equipe").select("usuario_id, perfis!equipe_usuario_id_fkey(nome)").eq("ativo", true),
  ]);
  const responsaveis = new Map<string, string>();
  for (const a of admins.data ?? []) responsaveis.set(a.id as string, a.nome as string);
  for (const e of equipe.data ?? []) {
    const p = (Array.isArray(e.perfis) ? e.perfis[0] : e.perfis) as { nome: string } | null;
    if (p) responsaveis.set(e.usuario_id as string, p.nome);
  }
  return {
    etapas: (etapas.data ?? []) as EtapaFunil[],
    regioes: (regioes.data ?? []).map((r) => ({ valor: r.id as string, nome: r.nome as string })),
    cidades: (cidades.data ?? []).map((c) => ({ valor: c.id as string, nome: `${c.nome}-${c.uf}`, regiao: c.microrregiao_id as string })),
    origens: (origens.data ?? []).map((o) => ({ valor: o.codigo as string, nome: o.nome as string })),
    categorias: (categorias.data ?? []).map((c) => ({ valor: c.id as string, nome: c.nome as string })),
    responsaveis: [...responsaveis].map(([valor, nome]) => ({ valor, nome })).sort((a, b) => a.nome.localeCompare(b.nome)),
  };
}
