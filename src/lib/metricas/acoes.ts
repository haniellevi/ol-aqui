"use server";

import { headers } from "next/headers";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ehBot, validarAparicoes, type PaginaAparicao } from "@/lib/metricas/aparicoes";

// Etapa P4: conta as aparições de uma lista de cards. Quem decide o resto é o banco
// (registrar_aparicoes): só o servidor chama, ignora o dono do anúncio e soma no dia.
// Nunca lança erro: a tela não espera nem mostra nada.

export async function registrarAparicoes(pagina: PaginaAparicao, ids: string[], inicio = 0): Promise<boolean> {
  try {
    const h = await headers();
    if (ehBot(h.get("user-agent"))) return false;
    const valido = validarAparicoes(pagina, ids, inicio);
    if (!valido) return false;
    const { userId } = await auth();
    const { data, error } = await supabaseAdmin().rpc("registrar_aparicoes", {
      p_pagina: valido.pagina,
      p_itens: valido.itens,
      p_usuario: userId ?? null,
    });
    return !error && typeof data === "number";
  } catch {
    return false;
  }
}
