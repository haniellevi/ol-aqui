"use server";
// Etapa P5c: o dono aceita a loja que a equipe montou para ele.

import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ehUuid } from "@/lib/formato";
import { traduzirErro } from "@/lib/erros";
import { COOKIE_LOJA } from "@/lib/dados/loja-ativa";
import { concluirMudancaLoja, prontosPendentes } from "@/lib/dados/montagem";

/** Endereço de volta para a Minha loja com o resultado (ex.: recebida=3-1-0 = no ar, em análise, rascunho). */
function destino(r: Awaited<ReturnType<typeof concluirMudancaLoja>>) {
  return `/minha-conta/loja?recebida=${r ? `${r.publicados}-${r.em_analise}-${r.rascunhos}` : "pendente"}`;
}

export async function aceitarLoja(codigo: string, _: string | null, form: FormData): Promise<string | null> {
  const mensagem = "O convite venceu, foi cancelado ou pertence a outro WhatsApp. Peça um novo link à equipe Mercado da Região.";
  if (!ehUuid(codigo)) return mensagem;
  const db = await createClient();
  const { data, error } = await db
    .rpc("convite_dono_loja", { p_token: codigo, p_aceitar: true, p_manter_equipe: form.get("manter_equipe") === "on" })
    .maybeSingle<{ loja_id: string; aceito: boolean }>();
  if (error) return traduzirErro(error).mensagem;
  if (!data?.aceito || !ehUuid(data.loja_id)) return mensagem;
  const resultado = await concluirMudancaLoja(data.loja_id);
  // A Minha loja passa a mostrar a loja recebida.
  (await cookies()).set(COOKIE_LOJA, data.loja_id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 });
  revalidatePath("/", "layout");
  redirect(destino(resultado));
}

/** Botão da Minha loja quando o aceite não terminou: fotos ainda na pasta provisória ou prontos sem publicar. */
export async function terminarRecebimento(loja: string): Promise<string | null> {
  const { userId } = await auth();
  if (!userId || !ehUuid(loja)) return "Loja inválida.";
  const db = await createClient();
  // Só o dono termina (a cópia das fotos usa a chave do servidor).
  const { data } = await db.from("vitrines_lojas").select("id, pasta_montagem").eq("id", loja).eq("dono_id", userId).eq("status", "ativa")
    .maybeSingle<{ id: string; pasta_montagem: string | null }>();
  if (!data) return "Não foi possível terminar agora. Atualize a página.";
  if (!data.pasta_montagem && !(await prontosPendentes(loja))) return "A loja já foi recebida. Atualize a página.";
  const resultado = await concluirMudancaLoja(loja);
  if (!resultado) return "Não foi possível terminar de receber a loja agora. Tente de novo em alguns minutos.";
  revalidatePath("/", "layout");
  redirect(destino(resultado));
}
