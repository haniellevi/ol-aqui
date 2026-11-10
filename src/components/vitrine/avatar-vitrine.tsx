"use client";

import { useState } from "react";
import { iniciais } from "@/components/vitrine/util";

// Logo redondo da loja, ou as iniciais quando não há logo.
export function AvatarVitrine({ nome, logo, tamanho = "md" }: { nome: string; logo?: string | null; tamanho?: "sm" | "md" | "lg" | "xl" }) {
  const [falhou, setFalhou] = useState<string | null>(null);
  const t = { sm: "size-9 text-sm", md: "size-12 text-base", lg: "size-16 text-xl", xl: "size-24 text-2xl" }[tamanho];
  if (logo && falhou !== logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- logo vem do Storage; img simples é leve
      <img src={logo} ref={(img) => { if (img?.complete && img.naturalWidth === 0) setFalhou(logo); }} onError={() => setFalhou(logo)} alt="" width={96} height={96} loading="lazy" className={`${t} shrink-0 rounded-full border border-borda bg-cartao object-cover`} />
    );
  }
  return (
    <span aria-hidden className={`${t} grid shrink-0 place-items-center rounded-full bg-beringela font-bold text-white`}>
      {iniciais(nome)}
    </span>
  );
}
