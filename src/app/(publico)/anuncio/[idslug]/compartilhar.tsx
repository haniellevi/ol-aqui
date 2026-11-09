"use client";

import { useState } from "react";
import { Copy, Share2 } from "lucide-react";
import { classesBotao } from "@/components/ui/botao";
import { registrarEvento } from "./actions";

export function CompartilharAnuncio({ anuncioId, titulo, url }: { anuncioId: string; titulo: string; url: string }) {
  const [aviso, setAviso] = useState("");
  const [manual, setManual] = useState(false);
  const [pendente, setPendente] = useState(false);
  async function compartilhar(copiar: boolean) {
    if (pendente) return;
    setPendente(true);
    setAviso("");
    setManual(false);
    try {
      if (!copiar && navigator.share) {
        await navigator.share({ title: titulo, url });
      } else {
        await navigator.clipboard.writeText(url);
        setAviso("Link copiado. Cole onde quiser compartilhar.");
      }
      void registrarEvento(anuncioId, "compartilhar").catch(() => undefined);
    } catch (erro) {
      if (!(erro instanceof Error && erro.name === "AbortError")) {
        setManual(true);
        setAviso("Copie o endereço abaixo para compartilhar.");
      }
    } finally { setPendente(false); }
  }
  return <div className="flex flex-col gap-1">
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={pendente} onClick={() => void compartilhar(false)} className={classesBotao("texto", false, "text-[15px]")}><Share2 className="size-4" aria-hidden />Compartilhar</button>
      <button type="button" disabled={pendente} onClick={() => void compartilhar(true)} className={classesBotao("texto", false, "text-[15px]")}><Copy className="size-4" aria-hidden />Copiar link</button>
    </div>
    <p role="status" className={aviso ? "text-sm text-texto-suave" : "sr-only"}>{aviso}</p>
    {manual && <label className="flex flex-col gap-1 text-sm">Link do anúncio<input readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="h-12 min-w-0 rounded-campo border border-borda bg-cartao px-3 text-base focus-visible:outline-laranja-escuro" /></label>}
  </div>;
}
