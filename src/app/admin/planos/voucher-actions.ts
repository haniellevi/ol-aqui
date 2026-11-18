"use server";

import { revalidatePath } from "next/cache";
import { exigirSuperAdmin } from "@/lib/admin/auth";
import type { EstadoForm } from "@/lib/admin/estado";
import { diaDoCupom, normalizarCodigoCupom } from "@/lib/cupons";
import { ehUuid } from "@/lib/formato";

export async function salvarVoucher(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  let supabase;
  try {
    ({ supabase } = await exigirSuperAdmin());
  } catch {
    return { erro: "Acesso restrito ao administrador master." };
  }

  const id = String(form.get("id") ?? "");
  if (id && !ehUuid(id)) return { erro: "Cupom não encontrado." };
  const codigo = normalizarCodigoCupom(form.get("codigo"));
  if (!id && !codigo) return { erro: "Confira o código do cupom." };
  const dias = String(form.get("duracao_dias") ?? "").trim();
  const duracao = Number(dias);
  if (!/^\d+$/.test(dias) || duracao < 1 || duracao > 2_147_483_647) return { erro: "Informe a duração em dias inteiros, a partir de 1." };

  const data = String(form.get("validade") ?? "").trim();
  let validoAte: string | null = null;
  if (data) {
    const inicioDoDia = new Date(`${data}T03:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || Number.isNaN(inicioDoDia.getTime()) || inicioDoDia.toISOString().slice(0, 10) !== data || data.startsWith("0000")) {
      return { erro: "Informe uma data válida." };
    }
    // Prazo exclusivo: o primeiro instante do dia seguinte em São Paulo.
    const fimDoDia = new Date(inicioDoDia.getTime() + 86_400_000);
    const diaSeguinte = fimDoDia.toISOString().split("T")[0];
    if (diaDoCupom.format(new Date(fimDoDia.getTime() - 3_600_000)) === diaSeguinte) {
      fimDoDia.setUTCHours(2);
    }
    if (!id && fimDoDia.getTime() <= Date.now()) return { erro: "Escolha uma data que ainda possa ser usada para ativação." };
    validoAte = fimDoDia.toISOString();
  }

  try {
    const { error } = id
      ? await supabase.rpc("voucher_admin_configurar", { p_id: id, p_ativo: form.get("ativo") === "on", p_duracao_dias: duracao, p_valido_ate: validoAte })
      : await supabase.rpc("voucher_admin_criar", { p_codigo: codigo!, p_duracao_dias: duracao, p_valido_ate: validoAte });
    if (error?.code === "23505") return { erro: "Este código já existe." };
    if (error?.code === "22023") return { erro: error.message };
    if (error) return { erro: "Não foi possível salvar o cupom. Tente novamente." };
    revalidatePath("/admin/planos");
    revalidatePath("/minha-conta/plano");
    return { ok: "Cupom salvo." };
  } catch {
    return { erro: "Não foi possível salvar o cupom. Tente novamente." };
  }
}
