"use server";

import { unstable_rethrow } from "next/navigation";
import { revalidatePath } from "next/cache";
import { exigirTela } from "@/lib/admin/equipe";
import { inteiroOuNulo } from "@/lib/admin/formato";
import type { EstadoForm } from "@/lib/admin/estado";
import { ehUuid } from "@/lib/formato";
import { traduzirErro } from "@/lib/erros";
import type { AcaoLoja } from "@/lib/tipos-cobranca";

// Tela 5 · Lojistas e vitrines. Tudo pelo token do admin; quem confere admin, motivo, dias e plano
// é o banco, que grava o motivo em vitrines_acoes_admin
// e cada mudança em logs_atividade. Suporte: só suspender/reativar e verificações; franqueado: nada (o banco recusa).

type AcaoOperacional = Exclude<AcaoLoja, "dar_selo" | "tirar_selo">;
const ACOES: readonly AcaoOperacional[] = ["cortesia", "trocar_plano", "suspender", "reativar"];

const OK: Record<AcaoOperacional, string> = {
  cortesia: "Cortesia dada.",
  trocar_plano: "Plano trocado.",
  suspender: "Loja suspensa.",
  reativar: "Loja reativada.",
};

const MOTIVOS_REVISAO = new Set(["dados_inconsistentes", "link_invalido", "contato_nao_confirmado", "titularidade", "outro"]);

function atualizar() {
  revalidatePath("/admin/lojas");
  revalidatePath("/", "layout");
}

export async function acaoLoja(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  try {
    const { supabase } = await exigirTela("lojas");
    const vitrine = String(form.get("vitrine") ?? "");
    const acao = String(form.get("acao") ?? "") as AcaoOperacional;
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
    if (error?.code === "23514" && error.message.includes("loja_arquivada_suspensa")) {
      return { erro: "Restaure a loja arquivada antes de reativá-la." };
    }
    if (error) return { erro: traduzirErro(error).mensagem };
    atualizar();
    return { ok: OK[acao] };
  } catch (e) {
    unstable_rethrow(e); // sessão vencida (redirect) ou quem saiu da equipe (404) não viram texto de erro
    return { erro: e instanceof Error ? e.message : "Não deu para salvar." };
  }
}

export async function revisarLoja(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  try {
    const { supabase, papel } = await exigirTela("lojas");
    if (papel !== "administrador" && papel !== "suporte") return { erro: "Seu papel não pode revisar lojas." };
    const loja = String(form.get("loja") ?? "");
    const revisao = inteiroOuNulo(form.get("revisao"));
    if (!ehUuid(loja) || revisao == null || revisao < 0) return { erro: "Revisão não encontrada. Atualize a página." };
    const decisao = form.get("decisao");
    if (decisao !== "aprovar" && decisao !== "correcao" && decisao !== "recusar") return { erro: "Escolha uma decisão." };

    const motivo = String(form.get("motivo") ?? "");
    const dados = form.get("dados") === "on";
    const link = form.get("link") === "on";
    const whatsapp = form.get("whatsapp") === "on";
    if (decisao === "aprovar" && !(dados && link && whatsapp)) return { erro: "Confirme os três itens antes de aprovar." };
    if (decisao !== "aprovar" && !MOTIVOS_REVISAO.has(motivo)) return { erro: "Selecione o motivo da decisão." };

    const { error } = await supabase.rpc("admin_revisar_loja", {
      p_loja: loja,
      p_revisao: revisao,
      p_decisao: decisao,
      p_motivo: decisao === "aprovar" ? null : motivo,
      p_dados: dados,
      p_link: link,
      p_whatsapp: whatsapp,
    });
    if (error) return { erro: traduzirErro(error).mensagem };
    atualizar();
    return { ok: decisao === "aprovar" ? "Loja aprovada." : decisao === "correcao" ? "Correção solicitada." : "Verificação recusada." };
  } catch (e) {
    unstable_rethrow(e);
    return { erro: e instanceof Error ? e.message : "Não deu para salvar a revisão." };
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
    unstable_rethrow(e); // sessão vencida (redirect) ou quem saiu da equipe (404) não viram texto de erro
    return { erro: e instanceof Error ? e.message : "Não deu para salvar." };
  }
}

export async function revogarVendedorPf(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const { supabase, papel } = await exigirTela("lojas");
  if (papel !== "administrador" && papel !== "suporte") return { erro: "Seu papel não pode verificar vendedores." };
  const vitrine = String(form.get("vitrine") ?? "");
  if (!ehUuid(vitrine)) return { erro: "Vendedor não encontrado." };
  const { error } = await supabase.rpc("admin_revogar_verificacao_pf", { p_vitrine: vitrine, p_nome: String(form.get("nome") ?? "") });
  if (error) return { erro: traduzirErro(error).mensagem };
  atualizar();
  return { ok: "Verificação revogada." };
}

export async function decidirVerificacaoPf(aprovar: boolean, _: EstadoForm, form: FormData): Promise<EstadoForm> {
  const { supabase, papel } = await exigirTela("lojas");
  if (papel !== "administrador" && papel !== "suporte") return { erro: "Seu papel não pode revisar envios." };
  const id = String(form.get("id") ?? "");
  if (!ehUuid(id) || typeof aprovar !== "boolean") return { erro: "Escolha uma decisão válida." };

  const { error } = await supabase.rpc("admin_decidir_verificacao_pf", {
    p_id: id,
    p_aprovar: aprovar,
    p_dados: form.get("dados") === "on",
    p_documento: form.get("documento") === "on",
    p_endereco: form.get("endereco") === "on",
    p_motivo: String(form.get("motivo") ?? "") || null,
  });
  if (error) return { erro: traduzirErro(error).mensagem };
  atualizar();
  return { ok: aprovar ? "Identidade do vendedor verificada." : "Novo envio solicitado." };
}

export async function alterarArquivoLoja(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const { supabase, papel } = await exigirTela("lojas");
  if (papel !== "administrador") return { erro: "Só um administrador pode arquivar ou restaurar lojas." };
  const loja = String(form.get("vitrine") ?? "");
  const acao = form.get("acao");
  const motivo = String(form.get("motivo") ?? "").trim();
  const atualizado = String(form.get("atualizado") ?? "");
  if (!ehUuid(loja) || !Number.isFinite(Date.parse(atualizado))) return { erro: "Atualize a ficha da loja." };
  if (acao !== "arquivar" && acao !== "restaurar") return { erro: "Escolha uma ação válida." };
  if (motivo.length < 3 || motivo.length > 300) return { erro: "Informe um motivo de 3 a 300 caracteres." };

  const { error } = await supabase.rpc("admin_arquivar_loja", {
    p_loja: loja,
    p_arquivar: acao === "arquivar",
    p_motivo: motivo,
    p_atualizado_em: atualizado,
  });
  if (error) return { erro: traduzirErro(error).mensagem };
  atualizar();
  revalidatePath(`/admin/lojas/${loja}`);
  return { ok: acao === "arquivar" ? "Loja arquivada." : "Loja restaurada como suspensa." };
}

/** Cortesia do Radar: a loja recebe os pedidos sem plano Full até a data. O banco confere admin, data e motivo. */
export async function darCortesiaRadar(vitrineId: string, ate: string, motivo: string): Promise<EstadoForm> {
  try {
    const { supabase } = await exigirTela("lojas");
    if (!ehUuid(vitrineId)) return { erro: "Loja não encontrada." };
    if (typeof ate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(ate)) return { erro: "Escolha uma data futura, de no máximo 365 dias." };
    const m = typeof motivo === "string" ? motivo.trim() : "";
    if (m.length < 3) return { erro: "Escreva o motivo (fica no histórico)." };
    const { error } = await supabase.rpc("dar_cortesia_radar", { p_vitrine: vitrineId, p_ate: ate, p_motivo: m.slice(0, 300) });
    if (error) return { erro: traduzirErro(error).mensagem };
    atualizar();
    return { ok: "Cortesia do Radar dada." };
  } catch (e) {
    unstable_rethrow(e);
    return { erro: e instanceof Error ? e.message : "Não deu para salvar." };
  }
}

export async function tirarCortesiaRadar(vitrineId: string): Promise<EstadoForm> {
  try {
    const { supabase } = await exigirTela("lojas");
    if (!ehUuid(vitrineId)) return { erro: "Loja não encontrada." };
    const { error } = await supabase.rpc("tirar_cortesia_radar", { p_vitrine: vitrineId });
    if (error) return { erro: traduzirErro(error).mensagem };
    atualizar();
    return { ok: "Cortesia do Radar retirada." };
  } catch (e) {
    unstable_rethrow(e);
    return { erro: e instanceof Error ? e.message : "Não deu para salvar." };
  }
}
