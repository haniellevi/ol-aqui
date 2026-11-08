"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Botao } from "@/components/ui/botao";

// "Reenviar link": copia o link da fatura para a equipe colar no WhatsApp da pessoa.
// O envio automático pelo WhatsApp fica para a fase 2.
export function CopiarLink({ link }: { link: string }) {
  const [copiado, setCopiado] = useState(false);
  async function copiar() {
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 3000);
    } catch {
      window.prompt("Copie o link:", link);
    }
  }
  return (
    <Botao type="button" variante="texto" icone={copiado ? <Check /> : <Copy />} onClick={copiar} aria-live="polite">
      {copiado ? "Link copiado" : "Copiar link"}
    </Botao>
  );
}
