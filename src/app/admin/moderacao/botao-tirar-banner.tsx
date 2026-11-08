"use client";

import { useFormStatus } from "react-dom";
import { Botao } from "@/components/ui/botao";

// Botão do formulário "Tirar foto do banner": gira e trava enquanto o servidor trabalha (sem toque duplo).
export function BotaoTirarBanner() {
  const { pending } = useFormStatus();
  return (
    <Botao type="submit" variante="perigo" carregando={pending} textoCarregando="Tirando a foto...">
      Tirar foto do banner
    </Botao>
  );
}
