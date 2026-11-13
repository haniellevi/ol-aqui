"use client";

import { useEffect, useId, useRef, useState } from "react";

export function DescricaoAnuncio({ texto }: { texto: string }) {
  const [aberta, setAberta] = useState(false);
  const [cortada, setCortada] = useState(texto.length > 160 || texto.split("\n").length > 3);
  const paragrafo = useRef<HTMLParagraphElement>(null);
  const id = useId();

  useEffect(() => {
    const el = paragrafo.current;
    if (!el || aberta) return;
    const medir = () => setCortada(el.scrollHeight > el.clientHeight + 1);
    medir();
    const observer = new ResizeObserver(medir);
    observer.observe(el);
    return () => observer.disconnect();
  }, [aberta, texto]);

  return (
    <div>
      <p ref={paragrafo} id={id} className={`whitespace-pre-line text-sm leading-5 [overflow-wrap:anywhere] md:text-base md:leading-6 ${aberta ? "" : "line-clamp-3 md:line-clamp-5"}`}>{texto}</p>
      {(cortada || aberta) && (
        <button type="button" aria-expanded={aberta} aria-controls={id} onClick={() => setAberta(!aberta)} className="inline-flex min-h-12 items-center rounded-card px-1 text-sm font-semibold text-laranja-escuro underline-offset-4 hover:underline focus-visible:outline-3 focus-visible:outline-laranja-escuro">
          {aberta ? "Ver menos" : "Ver descrição completa"}
        </button>
      )}
    </div>
  );
}
