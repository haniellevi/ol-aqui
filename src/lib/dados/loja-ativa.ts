import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { ehUuid } from "@/lib/formato";

/** Etapa P5b: em qual loja a pessoa está trabalhando (a própria ou uma que ela ajuda). */
export const COOKIE_LOJA = "loja_ativa";

export type LojaOpcao = { id: string; nome: string; dono: boolean };

/** Minha vitrine (qualquer tipo) + lojas que eu ajudo. A dona vem primeiro. Erro → só o que deu para ler. */
export const lojasQueCuido = cache(async (): Promise<LojaOpcao[]> => {
  const { userId } = await auth();
  if (!userId) return [];
  const db = await createClient();
  const [propria, ajudo] = await Promise.all([
    db.from("vitrines_lojas").select("id, nome").eq("dono_id", userId).maybeSingle<{ id: string; nome: string }>(),
    db.rpc("minhas_lojas"),
  ]);
  const lista: LojaOpcao[] = propria.data ? [{ id: propria.data.id, nome: propria.data.nome, dono: true }] : [];
  for (const l of (Array.isArray(ajudo.data) ? ajudo.data : []) as LojaOpcao[]) {
    if (!l.dono && ehUuid(l.id) && !lista.some((x) => x.id === l.id)) lista.push({ id: l.id, nome: l.nome, dono: false });
  }
  return lista;
});

/** Loja escolhida: a do cookie (se ainda vale), senão a própria, senão a primeira que ajuda. */
export const lojaEscolhida = cache(async (): Promise<LojaOpcao | null> => {
  const lista = await lojasQueCuido();
  if (!lista.length) return null;
  const guardada = (await cookies()).get(COOKIE_LOJA)?.value;
  return lista.find((l) => l.id === guardada) ?? lista[0];
});

/**
 * Etapa P6: passa a trabalhar na loja `id` (mesmo cookie do seletor), só se a pessoa cuida dela.
 * Usado depois de descartar um anúncio, para a aba Lixeira abrir na loja do anúncio.
 */
export async function guardarLojaEscolhida(id: string): Promise<boolean> {
  if (!(await lojasQueCuido()).some((l) => l.id === id)) return false;
  (await cookies()).set(COOKIE_LOJA, id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 });
  return true;
}
