"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirAdmin } from "@/lib/admin/auth";
import type { EstadoForm } from "@/lib/admin/estado";
import { limpo, slugDe, UFS } from "@/lib/admin/regras-cadastros";
import { traduzirErro } from "@/lib/erros";
import { ehUuid } from "@/lib/formato";
import { LINK_ADMIN_REGIOES, linkAdminRegiao } from "@/lib/rotas";

// Tela 7 · Regiões e cidades. Tudo pelo token do admin: a RLS (e_admin) barra quem não é, os gatilhos
// do banco recusam apagar/renomear o que está em uso (com a mensagem pronta) e registrar_log grava
// cada mudança no histórico (logs_atividade).

function atualizarTelas(regiaoId?: string) {
  revalidatePath(LINK_ADMIN_REGIOES);
  if (regiaoId) revalidatePath(linkAdminRegiao(regiaoId));
  revalidatePath("/", "layout"); // seletores de cidade das páginas públicas
}

const ufValida = (uf: string): uf is (typeof UFS)[number] => (UFS as readonly string[]).includes(uf);

export async function criarRegiao(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  let novoId: string | null = null;
  try {
    const { supabase } = await exigirAdmin();
    const nome = limpo(form.get("nome"));
    const sede = limpo(form.get("sede"));
    const uf = limpo(form.get("uf")).toUpperCase();
    if (nome.length < 2 || nome.length > 80) return { erro: "Escreva o nome da região (de 2 a 80 letras)." };
    if (sede.length < 2 || sede.length > 80) return { erro: "Escreva a cidade-sede (de 2 a 80 letras)." };
    if (!ufValida(uf)) return { erro: "Escolha o estado da cidade-sede." };
    const slug = slugDe(nome);
    if (slug.length < 2) return { erro: "O nome da região precisa ter letras ou números." };
    const { data, error } = await supabase.rpc("admin_criar_regiao", { p_nome: nome, p_slug: slug, p_sede: sede, p_uf: uf });
    if (error) return { erro: traduzirErro(error).mensagem };
    novoId = typeof data === "string" ? data : null;
    atualizarTelas();
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Erro ao criar a região." };
  }
  if (novoId) redirect(linkAdminRegiao(novoId));
  return { ok: "Região criada." };
}

export async function salvarRegiao(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  try {
    const { supabase } = await exigirAdmin();
    const id = String(form.get("id") ?? "");
    if (!ehUuid(id)) return { erro: "Região inválida." };
    const nome = limpo(form.get("nome"));
    const sede = limpo(form.get("cidade_sede"));
    if (nome.length < 2 || nome.length > 80) return { erro: "Escreva o nome da região (de 2 a 80 letras)." };
    if (!sede) return { erro: "Escolha a cidade-sede." };
    const { data, error } = await supabase.from("microrregioes").update({ nome, cidade_sede: sede }).eq("id", id).select("id");
    if (error) return { erro: traduzirErro(error).mensagem };
    if (!data?.length) return { erro: "Região não encontrada. Recarregue a página." };
    atualizarTelas(id);
    return { ok: "Região salva." };
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Erro ao salvar." };
  }
}

export async function adicionarCidade(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  try {
    const { supabase } = await exigirAdmin();
    const regiao = String(form.get("regiao_id") ?? "");
    if (!ehUuid(regiao)) return { erro: "Região inválida." };
    const nome = limpo(form.get("nome"));
    const uf = limpo(form.get("uf")).toUpperCase();
    if (nome.length < 2 || nome.length > 80) return { erro: "Escreva o nome da cidade (de 2 a 80 letras)." };
    if (!ufValida(uf)) return { erro: "Escolha o estado da cidade." };
    const { error } = await supabase.from("cidades").insert({ microrregiao_id: regiao, nome, uf });
    if (error) return { erro: traduzirErro(error).mensagem };
    atualizarTelas(regiao);
    return { ok: `${nome}-${uf} adicionada. Já aparece nas listas de cidades.` };
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Erro ao adicionar a cidade." };
  }
}

/** Ativa ou desativa (inativa some das listas públicas; anúncios e lojas continuam como estão). */
export async function trocarCidadeAtiva(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  try {
    const { supabase } = await exigirAdmin();
    const id = String(form.get("id") ?? "");
    const regiao = String(form.get("regiao_id") ?? "");
    if (!ehUuid(id)) return { erro: "Cidade inválida." };
    const ativa = form.get("ativa") === "1";
    const { data, error } = await supabase.from("cidades").update({ ativa }).eq("id", id).select("nome");
    if (error) return { erro: traduzirErro(error).mensagem };
    if (!data?.length) return { erro: "Cidade não encontrada. Recarregue a página." };
    atualizarTelas(ehUuid(regiao) ? regiao : undefined);
    return { ok: ativa ? "Cidade ativada. Voltou para as listas." : "Cidade desativada. Saiu das listas; o histórico continua." };
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Erro ao mudar a cidade." };
  }
}

/** Remove de vez (só cidade sem uso: o banco recusa as outras e explica). */
export async function removerCidade(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  try {
    const { supabase } = await exigirAdmin();
    const id = String(form.get("id") ?? "");
    const regiao = String(form.get("regiao_id") ?? "");
    if (!ehUuid(id)) return { erro: "Cidade inválida." };
    const { data, error } = await supabase.from("cidades").delete().eq("id", id).select("nome");
    if (error) return { erro: traduzirErro(error).mensagem };
    if (!data?.length) return { erro: "Cidade não encontrada. Recarregue a página." };
    atualizarTelas(ehUuid(regiao) ? regiao : undefined);
    return { ok: "Cidade removida." };
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Erro ao remover a cidade." };
  }
}

/** Apaga a região (só vazia: o banco recusa e diz o que ela tem). */
export async function apagarRegiao(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  try {
    const { supabase } = await exigirAdmin();
    const id = String(form.get("id") ?? "");
    if (!ehUuid(id)) return { erro: "Região inválida." };
    const { data, error } = await supabase.from("microrregioes").delete().eq("id", id).select("id");
    if (error) {
      if (error.code === "23503") return { erro: "Esta região ainda tem dados ligados a ela (destaques, conversas ou configurações). Não dá para apagar." };
      return { erro: traduzirErro(error).mensagem };
    }
    if (!data?.length) return { erro: "Região não encontrada. Recarregue a página." };
    atualizarTelas();
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Erro ao apagar a região." };
  }
  redirect(LINK_ADMIN_REGIOES);
}
