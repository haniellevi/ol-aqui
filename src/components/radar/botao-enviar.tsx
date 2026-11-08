"use client";

import { useFormStatus } from "react-dom";
import { Botao, type VarianteBotao } from "@/components/ui/botao";

// Botão de formulário que gira e trava enquanto o servidor trabalha (sem toque duplo).
export function BotaoEnviar({
  children,
  variante = "secundario",
  textoCarregando = "Salvando...",
  larguraTotal,
  className,
}: {
  children: React.ReactNode;
  variante?: VarianteBotao;
  textoCarregando?: string;
  larguraTotal?: boolean;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Botao type="submit" variante={variante} carregando={pending} textoCarregando={textoCarregando} larguraTotal={larguraTotal} className={className}>
      {children}
    </Botao>
  );
}
