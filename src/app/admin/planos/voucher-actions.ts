"use server";

import { revalidatePath } from "next/cache";
import { exigirAdmin } from "@/lib/admin/auth";
import type { EstadoForm } from "@/lib/admin/estado";

export async function salvarVoucher(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  try {
    const { supabase } = await exigirAdmin();
    const data = String(form.get("validade") ?? "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return { erro: "Informe a data de validade." };
    const fimDoDia = new Date(`${data}T00:00:00-03:00`);
    if (Number.isNaN(fimDoDia.getTime()) || fimDoDia.toISOString().slice(0, 10) !== data) return { erro: "Informe a data de validade." };
    const validoAte = new Date(fimDoDia.getTime() + 86_400_000).toISOString();
    const id = String(form.get("id") ?? "");
    const { error } = id
      ? await supabase.rpc("voucher_admin_configurar", { p_id: id, p_ativo: form.get("ativo") === "on", p_valido_ate: validoAte })
      : await supabase.rpc("voucher_admin_criar", { p_codigo: String(form.get("codigo") ?? ""), p_valido_ate: validoAte });
    if (error) return { erro: error.code === "23505" ? "Este código já existe." : "Confira o código e a validade do cupom." };
    revalidatePath("/admin/planos");
    return { ok: "Cupom salvo." };
  } catch {
    return { erro: "Não foi possível salvar o cupom." };
  }
}
