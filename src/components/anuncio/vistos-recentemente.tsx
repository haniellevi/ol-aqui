"use client";

import { useEffect, useState } from "react";
import { CardAnuncio } from "@/components/anuncio/card-anuncio";
import { lerVistos, limparVistos, type AnuncioVisto } from "@/lib/vistos";

// Faixa "Você viu há pouco": lê os anúncios abertos neste aparelho. Lista vazia = faixa some.
export function VistosRecentemente({ voltarHref }: { voltarHref?: string } = {}) {
  const [vistos, setVistos] = useState<AnuncioVisto[]>([]);
  useEffect(() => setVistos(lerVistos()), []);
  if (vistos.length === 0) return null;

  return (
    <section id="vistos" aria-labelledby="titulo-vistos" className="flex scroll-mt-20 flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 id="titulo-vistos" className="text-lg font-semibold">Você viu há pouco</h2>
        <button
          type="button"
          onClick={() => { limparVistos(); setVistos([]); }}
          className="inline-flex min-h-11 items-center rounded-campo px-2 text-sm font-semibold text-laranja-escuro hover:underline focus-visible:outline-3 focus-visible:outline-laranja-escuro"
        >
          Limpar
        </button>
      </div>
      <ul className="flex flex-col gap-1.5 md:-mx-4 md:flex-row md:snap-x md:snap-mandatory md:gap-3 md:overflow-x-auto md:px-4 md:pb-1 md:[scrollbar-width:none] lg:mx-0 lg:px-0">
        {vistos.map((a) => (
          <li key={a.id} className="flex md:w-44 md:shrink-0 md:snap-start">
            <div className="flex w-full flex-col [&>article]:flex-1">
              <CardAnuncio anuncio={a} compacto voltarHref={voltarHref} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
