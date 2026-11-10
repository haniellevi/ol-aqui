"use client";

import { useState } from "react";
import { Botao } from "@/components/ui/botao";
import { confirmarAntes, useConfirmar } from "@/components/ui/confirmar";

// Exemplo vivo da janela de confirmação (não apaga nada).
export function ExemploConfirmar() {
  const confirmar = useConfirmar();
  const [resposta, setResposta] = useState("");
  return (
    <form
      className="flex flex-wrap items-center gap-3"
      onSubmit={confirmarAntes(
        confirmar,
        { titulo: "Apagar este exemplo?", texto: "É só uma demonstração: nada é apagado.", acao: "Apagar", perigo: true },
        (e) => { e.preventDefault(); setResposta("Confirmado."); },
      )}
    >
      <Botao type="submit" variante="perigo" tamanho="pequeno">Apagar exemplo</Botao>
      <span role="status" className="text-sm text-texto-suave">{resposta}</span>
    </form>
  );
}
