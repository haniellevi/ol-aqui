"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type EstadoVoucher = { erro?: string; ok?: string } | null;

export async function resgatarVoucher(_: EstadoVoucher, form: FormData): Promise<EstadoVoucher> {
  const codigo = String(form.get("codigo") ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9-]{4,32}$/.test(codigo)) return { erro: "Confira o código do cupom." };
  const db = await createClient();
  const { data, error } = await db.rpc("resgatar_voucher", { p_codigo: codigo });
  if (error) return { erro: error.code === "22023" ? error.message : "Não foi possível resgatar o cupom. Tente novamente." };
  revalidatePath("/minha-conta/plano");
  return { ok: data ? "Cupom aplicado. Confira as datas do plano completo em Meu plano." : "Cupom reservado. Quando não houver outro plano vigente, mudança agendada ou cobrança pendente, volte aqui para ativar seus três meses, mesmo após o fim da campanha." };
}
