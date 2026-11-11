"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { exigirAdmin } from "@/lib/admin/auth";
import { idUsuarioValido, motivoForm, textoForm } from "@/lib/admin/gestao";
import { traduzirErro } from "@/lib/erros";
import { ehUuid } from "@/lib/formato";
import { executarLimpeza } from "@/lib/limpeza";
import type { EstadoForm } from "@/lib/admin/estado";

function atualizar() { revalidatePath("/", "layout"); }

/** Conta: mover para a lixeira (operacao=excluir) ou restaurar. Loja e anúncios acompanham. */
export async function lixeiraConta(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  try {
    const { supabase } = await exigirAdmin();
    const id = textoForm(form, "id"), motivo = motivoForm(form), operacao = textoForm(form, "operacao");
    if (!idUsuarioValido(id) || !["excluir", "restaurar"].includes(operacao)) return { erro: "Operação inválida." };
    const { error } = await supabase.rpc("admin_lixeira_conta", { p_id: id, p_excluir: operacao === "excluir", p_motivo: motivo });
    if (error) return { erro: traduzirErro(error).mensagem };
    atualizar();
    return { ok: operacao === "excluir"
      ? "Conta movida para a lixeira. Conta, loja e anúncios saíram do ar e serão apagados em 30 dias."
      : "Conta restaurada. A loja e os anúncios voltaram como estavam." };
  } catch (e) {
    unstable_rethrow(e);
    return { erro: e instanceof Error ? e.message : "Não foi possível alterar a conta." };
  }
}

/** Loja: mover para a lixeira ou restaurar. Os anúncios acompanham. */
export async function lixeiraLoja(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  try {
    const { supabase } = await exigirAdmin();
    const id = textoForm(form, "id"), motivo = motivoForm(form), operacao = textoForm(form, "operacao");
    if (!ehUuid(id) || !["excluir", "restaurar"].includes(operacao)) return { erro: "Operação inválida." };
    const { error } = await supabase.rpc("admin_lixeira_loja", { p_loja: id, p_excluir: operacao === "excluir", p_motivo: motivo });
    if (error) return { erro: traduzirErro(error).mensagem };
    atualizar();
    return { ok: operacao === "excluir"
      ? "Loja movida para a lixeira. A vitrine e os anúncios saíram do ar e serão apagados em 30 dias."
      : "Loja restaurada. Os anúncios voltaram como estavam." };
  } catch (e) {
    unstable_rethrow(e);
    return { erro: e instanceof Error ? e.message : "Não foi possível alterar a loja." };
  }
}

/** Apagar de vez agora: confere o nome digitado e roda a limpeza na hora. */
export async function apagarDeVez(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  try {
    const { supabase } = await exigirAdmin();
    const tipo = textoForm(form, "tipo"), alvo = textoForm(form, "alvo"), motivo = motivoForm(form);
    if (form.get("confirmar") !== "on") return { erro: "Confirme que leu o efeito da exclusão." };
    if (!(tipo === "conta" ? idUsuarioValido(alvo) : tipo === "loja" && ehUuid(alvo))) return { erro: "Operação inválida." };
    const { error } = await supabase.rpc("admin_antecipar_limpeza", {
      p_tipo: tipo, p_alvo: alvo, p_confirmacao: textoForm(form, "confirmacao"), p_motivo: motivo,
    });
    if (error) return { erro: traduzirErro(error).mensagem };
    const r = await executarLimpeza().catch(() => null);
    atualizar();
    if (!r || r.falhas) return { erro: "A exclusão foi marcada, mas não terminou agora. A limpeza da madrugada tenta de novo." };
    return { ok: "Apagado de vez. Ficaram só os registros de pagamento e as provas congeladas, sem dados pessoais." };
  } catch (e) {
    unstable_rethrow(e);
    return { erro: e instanceof Error ? e.message : "Não foi possível apagar." };
  }
}
