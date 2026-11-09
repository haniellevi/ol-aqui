"use client";

import { useId, useState } from "react";

export function DescricaoAnuncio({ texto }: { texto: string }) {
  const [aberta, setAberta] = useState(false);
  const id = useId();
  const longa = texto.length > 320 || texto.split("\n").length > 5;
  return <div>
    <p id={id} className={`whitespace-pre-line break-words text-base leading-6 ${longa && !aberta ? "line-clamp-5" : ""}`}>{texto}</p>
    {longa && <button type="button" aria-expanded={aberta} aria-controls={id} onClick={() => setAberta(!aberta)} className="mt-1 inline-flex min-h-12 items-center rounded-card px-1 font-semibold text-laranja-escuro underline-offset-4 hover:underline focus-visible:outline-3 focus-visible:outline-laranja-escuro">
      {aberta ? "Ver menos" : "Ver descrição completa"}
    </button>}
  </div>;
}
