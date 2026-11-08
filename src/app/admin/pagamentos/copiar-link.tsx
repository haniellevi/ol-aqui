"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Botao } from "@/components/ui/botao";

// "Copiar link": copia o link da fatura (para quando o vendedor não tem WhatsApp na conta
// ou a equipe quer mandar por outro meio). O botão "Reenviar no WhatsApp" fica ao lado.
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
