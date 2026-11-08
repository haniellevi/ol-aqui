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
  nome,
  valor,
}: {
  children: React.ReactNode;
  variante?: VarianteBotao;
  textoCarregando?: string;
  larguraTotal?: boolean;
  className?: string;
  /** name/value do botão (quando o formulário tem mais de uma ação). */
  nome?: string;
  valor?: string;
}) {
  const { pending, data } = useFormStatus();
  // Com várias ações no mesmo formulário, só o botão tocado gira.
  const este = pending && (!nome || data?.get(nome) === valor);
  return (
    <Botao
      type="submit"
      name={nome}
      value={valor}
      disabled={pending}
      variante={variante}
      carregando={este}
      textoCarregando={textoCarregando}
      larguraTotal={larguraTotal}
      className={className}
    >
      {children}
    </Botao>
  );
}
