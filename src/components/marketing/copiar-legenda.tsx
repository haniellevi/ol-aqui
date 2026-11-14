"use client";

import { useState } from "react";
import { Copy } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { Textarea } from "@/components/ui/textarea";

export function CopiarLegenda({ texto }: { texto: string }) {
  const [estado, setEstado] = useState<"inicial" | "copiando" | "copiado" | "manual">("inicial");

  async function copiar() {
    setEstado("copiando");
    try {
      await navigator.clipboard.writeText(texto);
      setEstado("copiado");
    } catch {
      setEstado("manual");
    }
  }

  return <div className="flex min-w-0 flex-col gap-2">
    <Botao variante="secundario" icone={<Copy />} onClick={() => void copiar()} carregando={estado === "copiando"}>Copiar legenda</Botao>
    <p role="status" className={estado === "copiado" || estado === "manual" ? "text-sm text-texto-suave" : "sr-only"}>
      {estado === "copiado" ? "Legenda copiada. Cole junto da arte ao compartilhar." : estado === "manual" ? "Selecione a legenda abaixo para copiar manualmente." : ""}
    </p>
    {estado === "manual" && <label className="flex flex-col gap-1 text-sm">Legenda para compartilhar
      <Textarea readOnly value={texto} onFocus={(event) => event.currentTarget.select()} rows={5} />
    </label>}
  </div>;
}
