"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Copy } from "lucide-react";
import { Botao, type TamanhoBotao } from "@/components/ui/botao";

export function CopiarLinkLoja({ url, tamanho }: { url: string; tamanho?: TamanhoBotao }) {
  const [estado, setEstado] = useState<"inicial" | "copiando" | "copiado" | "manual">("inicial");
  async function copiar() {
    setEstado("copiando");
    try { await navigator.clipboard.writeText(url); setEstado("copiado"); }
    catch { setEstado("manual"); }
  }
  return <div className="flex min-w-0 flex-col gap-2">
    <Botao variante="secundario" tamanho={tamanho} icone={<Copy />} aria-label="Copiar link da loja" onClick={() => void copiar()} carregando={estado === "copiando"}>Copiar link</Botao>
    <p role="status" className={estado === "copiado" || estado === "manual" ? "text-sm text-texto-suave" : "sr-only"}>
      {estado === "copiado" ? "Link copiado." : estado === "manual" ? "Não foi possível copiar automaticamente. Selecione o link abaixo." : ""}
    </p>
    {estado === "manual" && <label className="flex flex-col gap-1 text-sm">Link da loja<Input readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="min-w-0" /></label>}
  </div>;
}
