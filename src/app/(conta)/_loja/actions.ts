"use server";
// Etapa P5b: troca a loja em que a pessoa está trabalhando (seletor no topo de Meus anúncios e Anunciar).
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { COOKIE_LOJA, lojasQueCuido } from "@/lib/dados/loja-ativa";

const DESTINOS = ["/minha-conta/anuncios", "/anunciar"] as const;

export async function escolherLoja(form: FormData): Promise<void> {
  const id = String(form.get("loja") ?? "");
  const pedido = String(form.get("voltar") ?? "");
  const voltar = (DESTINOS as readonly string[]).includes(pedido) ? pedido : DESTINOS[0];
  const lojas = await lojasQueCuido();
  if (lojas.some((l) => l.id === id)) {
    (await cookies()).set(COOKIE_LOJA, id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 });
    revalidatePath("/minha-conta/anuncios");
    revalidatePath("/anunciar");
  }
  redirect(voltar);
}
