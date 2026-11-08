"use client";

import { Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";

// Botões de decisão da Moderação (Aprovar, Recusar, Procede...). Enquanto o servidor trabalha, todos os
// botões do formulário travam e o tocado gira com "Salvando...": sem toque duplo (o segundo daria erro
// "não está mais em análise" mesmo com a decisão já feita).
export function BotaoDecisao({ name, value, className, children }: { name: string; value: string; className: string; children: React.ReactNode }) {
  const { pending, data } = useFormStatus();
  const este = pending && data?.get(name) === value;
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      aria-busy={este || undefined}
      className={`${className} disabled:cursor-not-allowed disabled:opacity-60`}
    >
      {este && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
      {este ? "Salvando..." : children}
    </button>
  );
}
