"use server";

import { revalidatePath } from "next/cache";
import { normalizarCodigoCupom } from "@/lib/cupons";
import { createClient } from "@/lib/supabase/server";

export type EstadoVoucher = { erro?: string; ok?: string } | null;

export async function resgatarVoucher(_: EstadoVoucher, form: FormData): Promise<EstadoVoucher> {
  const codigo = normalizarCodigoCupom(form.get("codigo"));
  if (!codigo) return { erro: "Confira o código do cupom." };
  try {
    const db = await createClient();
    const { data, error } = await db.rpc("resgatar_voucher", { p_codigo: codigo });
    if (error?.code === "22023") return { erro: error.message };
    if (error?.code === "42501") return { erro: "Entre na sua conta para ativar o cupom." };
    if (error || !data) return { erro: "Não foi possível ativar o cupom. Tente novamente." };
    revalidatePath("/minha-conta/plano");
    revalidatePath("/", "layout");
    return { ok: "Cupom ativado. Confira as datas do plano Promocional em Meu plano." };
  } catch {
    return { erro: "Não foi possível ativar o cupom. Tente novamente." };
  }
}
