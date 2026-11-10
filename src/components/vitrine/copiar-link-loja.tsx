"use client";

import { useState } from "react";
import { Copy } from "lucide-react";
import { Botao } from "@/components/ui/botao";

export function CopiarLinkLoja({ url }: { url: string }) {
  const [estado, setEstado] = useState<"inicial" | "copiando" | "copiado" | "manual">("inicial");
  async function copiar() {
    setEstado("copiando");
    try { await navigator.clipboard.writeText(url); setEstado("copiado"); }
    catch { setEstado("manual"); }
  }
  return <div className="flex min-w-0 flex-col gap-2">
    <Botao variante="secundario" icone={<Copy />} aria-label="Copiar link da loja" onClick={() => void copiar()} carregando={estado === "copiando"}>Copiar link</Botao>
    <p role="status" className={estado === "copiado" || estado === "manual" ? "text-sm text-texto-suave" : "sr-only"}>
      {estado === "copiado" ? "Link copiado. Cole onde quiser compartilhar." : estado === "manual" ? "Não foi possível copiar automaticamente. Selecione o link abaixo." : ""}
    </p>
    {estado === "manual" && <label className="flex flex-col gap-1 text-sm">Link da loja<input readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="h-10 min-w-0 rounded-campo border border-borda bg-cartao px-3 text-base focus-visible:outline-3 focus-visible:outline-laranja-escuro" /></label>}
  </div>;
}
