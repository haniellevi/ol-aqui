"use client";
import { useEffect, useRef } from "react";
import { registrarEvento } from "./actions";
import { guardarVisto, type AnuncioVisto } from "@/lib/vistos";
import { prepararIdentidadeMedicao } from "@/lib/metricas/cliente";
export function RegistrarVisita({ anuncioId, visto }: { anuncioId: string; visto?: AnuncioVisto }) {
  const feito = useRef<string | null>(null);
  useEffect(() => {
    if (feito.current === anuncioId) return;
    feito.current = anuncioId;
    if (!prepararIdentidadeMedicao()) return;
    void registrarEvento(anuncioId, "visualizacao").catch(() => undefined);
    if (visto) guardarVisto(visto);
  }, [anuncioId, visto]);
  return null;
}
