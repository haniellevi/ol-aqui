"use client";

import { useEffect, useRef } from "react";
import { registrarEvento } from "./actions";
import { guardarVisto, type AnuncioVisto } from "@/lib/vistos";

// Conta uma visualização por abertura da página (depois de montar, nunca durante a montagem no servidor).
// O banco ignora repetição do mesmo visitante e as visitas do próprio dono.
// Também guarda o card no aparelho, para a faixa "Você viu há pouco" do Início.
export function RegistrarVisita({ anuncioId, visto }: { anuncioId: string; visto?: AnuncioVisto }) {
  const feito = useRef<string | null>(null);
  useEffect(() => {
    if (feito.current === anuncioId) return;
    feito.current = anuncioId;
    void registrarEvento(anuncioId, "visualizacao").catch(() => undefined);
    if (visto) guardarVisto(visto);
  }, [anuncioId, visto]);
  return null;
}
