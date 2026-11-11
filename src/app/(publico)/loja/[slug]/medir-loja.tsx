"use client";

import { useEffect, useRef } from "react";
import { registrarEventoLoja } from "./actions";

// Conta a visita ao abrir a loja e os cliques nos links marcados com data-medir="whatsapp" ou "mapa".
// Escuta no documento: os links continuam comuns (funcionam sem JavaScript) e nada atrasa o clique.
export function MedirLoja({ vitrineId }: { vitrineId: string }) {
  const feito = useRef<string | null>(null);
  useEffect(() => {
    if (feito.current !== vitrineId) {
      feito.current = vitrineId;
      void registrarEventoLoja(vitrineId, "visita").catch(() => undefined);
    }
    function aoClicar(e: MouseEvent) {
      const alvo = (e.target as Element | null)?.closest?.("[data-medir]");
      const tipo = alvo?.getAttribute("data-medir");
      if (tipo === "whatsapp") void registrarEventoLoja(vitrineId, "clique_whatsapp").catch(() => undefined);
      else if (tipo === "mapa") void registrarEventoLoja(vitrineId, "clique_mapa").catch(() => undefined);
    }
    document.addEventListener("click", aoClicar);
    return () => document.removeEventListener("click", aoClicar);
  }, [vitrineId]);
  return null;
}
