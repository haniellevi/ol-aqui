"use client";
import { useState } from "react";
import { ImageOff } from "lucide-react";

export function FotoMeuAnuncio({ src }: { src?: string }) {
  const [falhou, setFalhou] = useState(false);
  return <div className="relative aspect-square w-20 shrink-0 self-start overflow-hidden rounded-campo bg-borda sm:w-24">
    {src && !falhou ? (
      // eslint-disable-next-line @next/next/no-img-element -- fotos do Storage com fallback local
      <img src={src} alt="" width={96} height={96} loading="lazy" decoding="async" onError={() => setFalhou(true)} className="absolute inset-0 size-full object-cover" />
    ) : <span className="absolute inset-0 grid place-items-center text-texto-suave"><ImageOff className="size-6" aria-hidden /><span className="sr-only">Foto indisponível</span></span>}
  </div>;
}
