"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Detalhes nativos: continuam acessíveis sem JavaScript; hash abre o painel. */
export function StoreDetails({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const abrir = () => {
      if (ref.current && (window.location.hash === "#informacoes-loja" || window.matchMedia("(min-width: 1024px)").matches)) ref.current.open = true;
    };
    abrir();
    window.addEventListener("hashchange", abrir);
    return () => window.removeEventListener("hashchange", abrir);
  }, []);
  return <details ref={ref} id="informacoes-loja" className="scroll-mt-32 rounded-card bg-cartao p-4">
    <summary className="min-h-toque cursor-pointer py-3 text-base font-semibold text-beringela focus-visible:outline-3 focus-visible:outline-laranja-escuro">Informações da loja</summary>
    {children}
  </details>;
}
