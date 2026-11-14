"use client";

import { useState } from "react";
import Image from "next/image";
import { podeOtimizar } from "@/lib/imagem";
import { iniciais } from "@/components/vitrine/util";

// Logo da loja ou iniciais, no formato da área que o exibe.
export function AvatarVitrine({ nome, logo, tamanho = "md", quadrado = false }: { nome: string; logo?: string | null; tamanho?: "sm" | "md" | "lg" | "xl"; quadrado?: boolean }) {
  const [falhou, setFalhou] = useState<string | null>(null);
  const forma = quadrado ? "rounded-campo" : "rounded-full";
  const t = { sm: "size-8 text-legenda", md: "size-10 text-sm", lg: "size-14 text-lg", xl: "size-18 text-xl" }[tamanho];
  const px = { sm: 32, md: 40, lg: 56, xl: 72 }[tamanho];
  if (logo && falhou !== logo) {
    // Logo do Storage sai otimizado no tamanho do avatar (antes vinha o arquivo inteiro, até ~900 KB).
    return (
      <Image src={logo} ref={(img) => { if (img?.complete && img.naturalWidth === 0) setFalhou(logo); }} onError={() => setFalhou(logo)} alt="" width={px} height={px} unoptimized={!podeOtimizar(logo)} className={`${t} shrink-0 ${forma} border border-borda bg-cartao object-cover`} />
    );
  }
  return (
    <span aria-hidden className={`${t} grid shrink-0 place-items-center rounded-full bg-beringela font-bold text-white`}>
      {iniciais(nome)}
    </span>
  );
}
