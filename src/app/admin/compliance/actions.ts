"use server";

import { redirect } from "next/navigation";
import { exigirAdmin } from "@/lib/admin/auth";
import { ipDoNavegador } from "@/lib/admin/equipe";
import { traduzirErro } from "@/lib/erros";
import { ehUuid } from "@/lib/formato";
import { LINK_ADMIN_COMPLIANCE, linkRelatorioCompliance } from "@/lib/rotas";

// Tela 8 · Compliance jurídico (só administrador). O motivo nunca vai no endereço: o banco guarda a
// consulta (compliance_abrir) e o relatório (compliance_pedir_relatorio) e devolve só o id.

export type EstadoCompliance = { erro?: string } | null;

const USUARIO = /^user_[A-Za-z0-9]+$/;

export async function abrirConsulta(_: EstadoCompliance, form: FormData): Promise<EstadoCompliance> {
  let id: string;
  try {
    const { supabase } = await exigirAdmin();
    const motivo = String(form.get("motivo") ?? "").trim().slice(0, 500);
    if (motivo.length < 3) return { erro: "Escreva o motivo (ex.: número do ofício)." };
    const { data, error } = await supabase.rpc("compliance_abrir", { p_motivo: motivo, p_ip: await ipDoNavegador() });
    if (error || typeof data !== "string") return { erro: traduzirErro(error).mensagem };
    id = data;
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Não deu para abrir a consulta." };
  }
  redirect(`${LINK_ADMIN_COMPLIANCE}?c=${id}`);
}

export async function pedirRelatorio(_: EstadoCompliance, form: FormData): Promise<EstadoCompliance> {
  let id: string;
  try {
    const { supabase } = await exigirAdmin();
    const consulta = String(form.get("consulta") ?? "");
    const usuario = String(form.get("usuario") ?? "");
    const motivo = String(form.get("motivo") ?? "").trim().slice(0, 500);
    if (!ehUuid(consulta)) return { erro: "Esta consulta acabou. Comece de novo." };
    if (!USUARIO.test(usuario)) return { erro: "Conta não encontrada." };
    if (motivo.length < 3) return { erro: "Escreva o motivo do relatório (ex.: número do ofício)." };
    const { data, error } = await supabase.rpc("compliance_pedir_relatorio", {
      p_consulta: consulta,
      p_usuario: usuario,
      p_motivo: motivo,
      p_ip: await ipDoNavegador(),
    });
    if (error || typeof data !== "string") return { erro: traduzirErro(error).mensagem };
    id = data;
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Não deu para gerar o relatório." };
  }
  redirect(linkRelatorioCompliance(id));
}
