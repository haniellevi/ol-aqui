"use client";

import { useEffect, useState } from "react";
import { CardAnuncio } from "@/components/anuncio/card-anuncio";
import { lerVistos, limparVistos, type AnuncioVisto } from "@/lib/vistos";

// Faixa "Você viu há pouco": lê os anúncios abertos neste aparelho. Lista vazia = faixa some.
export function VistosRecentemente() {
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
      <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:px-0">
        {vistos.map((a) => (
          <li key={a.id} className="flex w-[40%] max-w-44 shrink-0 snap-start sm:w-44">
            <div className="flex w-full flex-col [&>article]:flex-1">
              <CardAnuncio anuncio={a} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
