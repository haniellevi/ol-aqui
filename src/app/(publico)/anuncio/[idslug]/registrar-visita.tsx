"use client";

import { useEffect, useRef } from "react";
import { registrarEvento } from "./actions";
import { CHAVE_BUSCA_ABERTA, primeiraPaginaDaAba, termoDaAberturaRecente, termoDaBusca } from "@/lib/metricas/termos";

// Conta uma visualização por abertura da página (depois de montar, nunca durante a montagem no servidor).
// O banco ignora repetição do mesmo visitante e as visitas do próprio dono.
// Palavra da busca: primeiro a marca do clique na busca (vale para navegação dentro do site);
// sem marca, o endereço de origem, mas só se este anúncio foi a primeira página aberta na aba.
export function RegistrarVisita({ anuncioId }: { anuncioId: string }) {
  const feito = useRef<string | null>(null);
  useEffect(() => {
    if (feito.current === anuncioId) return;
    feito.current = anuncioId;
    let termo: string | null = null;
    try {
      const marca = sessionStorage.getItem(CHAVE_BUSCA_ABERTA);
      sessionStorage.removeItem(CHAVE_BUSCA_ABERTA);
      termo = termoDaAberturaRecente(marca, window.location.pathname, Date.now());
    } catch {
      // Sem armazenamento: fica só o endereço de origem.
    }
    if (!termo) {
      const navegacao = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      if (primeiraPaginaDaAba(navegacao?.name, window.location.href)) termo = termoDaBusca(document.referrer, window.location.origin);
    }
    void registrarEvento(anuncioId, "visualizacao", termo).catch(() => undefined);
  }, [anuncioId]);
  return null;
}
