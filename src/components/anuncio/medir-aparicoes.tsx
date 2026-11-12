"use client";

import { useEffect, useRef } from "react";
import { registrarAparicoes } from "@/lib/metricas/acoes";
import { lotesDeAparicoes, type PaginaAparicao } from "@/lib/metricas/aparicoes";

// Conta as aparições da lista uma vez por visita à página, só com a aba visível.
// Não renderiza nada, não atrasa a tela e ignora erros.
export function MedirAparicoes({ pagina, ids }: { pagina: PaginaAparicao; ids: string[] }) {
  const enviado = useRef<string | null>(null);
  const chave = ids.join(",");
  useEffect(() => {
    if (!chave || enviado.current === chave) return;
    const lista = chave.split(",");
    const enviar = () => {
      if (enviado.current === chave) return;
      enviado.current = chave;
      // Lista com mais de 60 cards (ex.: loja com 120) vai em partes, cada uma com sua posição inicial.
      for (const lote of lotesDeAparicoes(lista)) void registrarAparicoes(pagina, lote.ids, lote.inicio).catch(() => undefined);
    };
    if (document.visibilityState === "visible") {
      enviar();
      return;
    }
    const aoMudar = () => {
      if (document.visibilityState !== "visible") return;
      document.removeEventListener("visibilitychange", aoMudar);
      enviar();
    };
    document.addEventListener("visibilitychange", aoMudar);
    return () => document.removeEventListener("visibilitychange", aoMudar);
  }, [pagina, chave]);
  return null;
}
