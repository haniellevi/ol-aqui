"use client";

import { useEffect, useRef, useState } from "react";
import { WifiOff } from "lucide-react";

// T43 · Sem internet. Aviso claro em todas as telas quando o celular perde a conexão
// (navigator.onLine + eventos online/offline). Some sozinho quando a internet volta.
export function AvisoSemInternet() {
  const [semInternet, setSemInternet] = useState(false);
  const [voltou, setVoltou] = useState(false);
  const estavaSem = useRef(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const atualizar = () => {
      const off = typeof navigator !== "undefined" && navigator.onLine === false;
      if (estavaSem.current && !off) {
        setVoltou(true);
        clearTimeout(timer);
        timer = setTimeout(() => setVoltou(false), 4000);
      }
      estavaSem.current = off;
      setSemInternet(off);
    };
    atualizar();
    window.addEventListener("online", atualizar);
    window.addEventListener("offline", atualizar);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("online", atualizar);
      window.removeEventListener("offline", atualizar);
    };
  }, []);

  if (!semInternet && !voltou) return null;
  return (
    <div role="status" aria-live="polite" className="fixed inset-x-0 top-0 z-[60] px-4 pt-[calc(0.5rem+env(safe-area-inset-top))]">
      <p
        className={`mx-auto flex max-w-lg items-start gap-2 rounded-card px-4 py-3 text-base shadow-2 ${
          semInternet ? "bg-aviso-fundo text-aviso" : "bg-sucesso-fundo text-verde-escuro"
        }`}
      >
        {semInternet ? (
          <>
            <WifiOff className="mt-0.5 size-5 shrink-0" aria-hidden />
            <span>
              <strong className="font-semibold">Você está sem internet.</strong> O que você preencheu está guardado. Quando a internet voltar, é só
              continuar.
            </span>
          </>
        ) : (
          <span className="font-semibold">A internet voltou.</span>
        )}
      </p>
    </div>
  );
}
