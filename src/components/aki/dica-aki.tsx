"use client";

import { useEffect } from "react";
import { mostrarDicaAki, type PedidoAbrirAki } from "./abrir";

// Faz o Merc aparecer sozinho com um convite curto ao lado do balão (sem abrir a folha).
// Sai junto com a tela que pediu. Não mostra nada quando o Merc está desligado.
export function DicaAki({ texto, pedido }: { texto: string; pedido?: PedidoAbrirAki }) {
  const textoPedido = pedido?.texto;
  useEffect(() => {
    mostrarDicaAki({ texto, pedido: textoPedido ? { texto: textoPedido } : undefined });
    return () => mostrarDicaAki(null);
  }, [texto, textoPedido]);
  return null;
}
