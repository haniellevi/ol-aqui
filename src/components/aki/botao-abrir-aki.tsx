"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Botao, type VarianteBotao } from "@/components/ui/botao";
import { MascoteAki } from "./mascote";
import { abrirAki, akiLigado, EVENTO_ESTADO_AKI, type PedidoAbrirAki } from "./abrir";

// Botão que abre o Aki (busca vazia, passo Fotos do anúncio). Some quando o Aki está desligado.
export function BotaoAbrirAki({
  children,
  pedido,
  variante = "secundario",
  larguraTotal = true,
}: {
  children: ReactNode;
  pedido?: PedidoAbrirAki;
  variante?: VarianteBotao;
  larguraTotal?: boolean;
}) {
  const [ligado, setLigado] = useState(false);
  useEffect(() => {
    setLigado(akiLigado());
    const ouvir = () => setLigado(akiLigado());
    window.addEventListener(EVENTO_ESTADO_AKI, ouvir);
    return () => window.removeEventListener(EVENTO_ESTADO_AKI, ouvir);
  }, []);
  if (!ligado) return null;
  return (
    <Botao variante={variante} larguraTotal={larguraTotal} icone={<MascoteAki tamanho={20} />} onClick={() => abrirAki(pedido)}>
      {children}
    </Botao>
  );
}
