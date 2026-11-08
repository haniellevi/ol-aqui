"use server";

import { revalidatePath } from "next/cache";
import { exigirTela } from "@/lib/admin/equipe";
import { inteiroOuNulo } from "@/lib/admin/formato";
import type { EstadoForm } from "@/lib/admin/estado";
import { ehUuid } from "@/lib/formato";
import { traduzirErro } from "@/lib/erros";
import type { AcaoLoja } from "@/lib/tipos-cobranca";

// Tela 5 · Lojistas e vitrines. Tudo pelo token do admin; quem confere admin, motivo, dias e plano
// é o banco (admin_acao_loja, admin_analisar_verificacao), que grava o motivo em vitrines_acoes_admin
// e cada mudança em logs_atividade. Suporte: só suspender/reativar e verificações; franqueado: nada (o banco recusa).

const ACOES: readonly AcaoLoja[] = ["cortesia", "trocar_plano", "suspender", "reativar", "dar_selo", "tirar_selo"];

const OK: Record<AcaoLoja, string> = {
  cortesia: "Cortesia dada.",
  trocar_plano: "Plano trocado.",
  suspender: "Loja suspensa.",
  reativar: "Loja reativada.",
  dar_selo: "Selo Loja Verificada dado.",
  tirar_selo: "Selo Loja Verificada tirado.",
};

function atualizar() {
  revalidatePath("/admin/lojas");
  revalidatePath("/", "layout");
}

export async function acaoLoja(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  try {
    const { supabase } = await exigirTela("lojas");
    const vitrine = String(form.get("vitrine") ?? "");
    const acao = String(form.get("acao") ?? "") as AcaoLoja;
    if (!ehUuid(vitrine)) return { erro: "Loja não encontrada." };
    if (!ACOES.includes(acao)) return { erro: "Escolha o que fazer." };
    const motivo = String(form.get("motivo") ?? "").trim();
    if (motivo.length < 3) return { erro: "Escreva o motivo (fica no histórico)." };
    const precisaDias = acao === "cortesia" || acao === "trocar_plano";
    const dias = precisaDias ? inteiroOuNulo(form.get("dias")) : null;
    const plano = acao === "trocar_plano" ? String(form.get("plano") ?? "").trim() || null : null;

    const { error } = await supabase.rpc("admin_acao_loja", {
      p_vitrine: vitrine,
      p_acao: acao,
      p_motivo: motivo.slice(0, 300),
      p_dias: dias,
      p_plano: plano,
    });
    if (error) return { erro: traduzirErro(error).mensagem };
    atualizar();
    return { ok: OK[acao] };
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Não deu para salvar." };
  }
}

export async function analisarVerificacao(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  try {
    const { supabase } = await exigirTela("lojas");
    const id = String(form.get("id") ?? "");
    if (!ehUuid(id)) return { erro: "Verificação não encontrada." };
    const aprovar = form.get("decisao") === "aprovar";
    const motivo = String(form.get("motivo") ?? "").trim();
    if (!aprovar && motivo.length < 3) return { erro: "Escreva o motivo da recusa." };
    const { error } = await supabase.rpc("admin_analisar_verificacao", { p_id: id, p_aprovar: aprovar, p_motivo: motivo || null });
    if (error) return { erro: traduzirErro(error).mensagem };
    revalidatePath("/admin/lojas");
    return { ok: aprovar ? "Aprovada." : "Recusada." };
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Não deu para salvar." };
  }
}
