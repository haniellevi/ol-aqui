"use client";

import { useEffect } from "react";
import { CHAVE_BUSCA_ABERTA, montarBuscaAberta, normalizarTermo } from "@/lib/metricas/termos";

// Etapa P4: quando a pessoa clica num anúncio desta busca, guarda a palavra por um minuto na aba.
// A página do anúncio usa a marca se for o mesmo caminho. Não manda nada ao servidor e não bloqueia o clique.
export function MarcarBusca({ termo }: { termo: string }) {
  useEffect(() => {
    const palavra = normalizarTermo(termo);
    if (!palavra) return;
    const aoClicar = (e: MouseEvent) => {
      const link = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null | undefined;
      if (!link) return;
      try {
        const caminho = new URL(link.href, window.location.href).pathname;
        if (!caminho.startsWith("/anuncio/")) return;
        sessionStorage.setItem(CHAVE_BUSCA_ABERTA, montarBuscaAberta(palavra, caminho, Date.now()));
      } catch {
        // Sem armazenamento disponível: a palavra simplesmente não é contada.
      }
    };
    document.addEventListener("click", aoClicar);
    return () => document.removeEventListener("click", aoClicar);
  }, [termo]);
  return null;
}
