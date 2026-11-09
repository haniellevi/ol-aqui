"use client";

import { useEffect, useRef } from "react";
import { registrarEvento } from "./actions";

// Conta uma visualização por abertura da página (depois de montar, nunca durante a montagem no servidor).
// O banco ignora repetição do mesmo visitante e as visitas do próprio dono.
export function RegistrarVisita({ anuncioId }: { anuncioId: string }) {
  const feito = useRef<string | null>(null);
  useEffect(() => {
    if (feito.current === anuncioId) return;
    feito.current = anuncioId;
    void registrarEvento(anuncioId, "visualizacao").catch(() => undefined);
  }, [anuncioId]);
  return null;
}
