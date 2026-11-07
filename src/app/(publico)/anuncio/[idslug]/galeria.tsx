"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ImageOff, Maximize2, X } from "lucide-react";

// Galeria do anúncio (T7/T8): deslizar com o dedo (scroll-snap, funciona sem JavaScript),
// contador "1/8", setas no computador e tela cheia ao tocar na foto.

const BOTAO_REDONDO =
  "grid size-12 place-items-center rounded-full bg-cartao/90 text-beringela shadow-1 hover:bg-cartao " +
  "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-laranja-escuro";

export function Galeria({ fotos, titulo }: { fotos: string[]; titulo: string }) {
  const trilho = useRef<HTMLUListElement>(null);
  const trilhoCheio = useRef<HTMLUListElement>(null);
  const janela = useRef<HTMLDialogElement>(null);
  const [atual, setAtual] = useState(0);
  const total = fotos.length;

  function aoRolar(el: HTMLUListElement | null) {
    if (!el || !el.clientWidth) return;
    setAtual(Math.min(total - 1, Math.max(0, Math.round(el.scrollLeft / el.clientWidth))));
  }

  function irPara(el: HTMLUListElement | null, i: number, suave = true) {
    if (!el) return;
    const alvo = Math.min(total - 1, Math.max(0, i));
    el.scrollTo({ left: alvo * el.clientWidth, behavior: suave ? "smooth" : "auto" });
  }

  function abrir(i: number) {
    janela.current?.showModal();
    requestAnimationFrame(() => irPara(trilhoCheio.current, i, false));
  }

  function fechar() {
    janela.current?.close();
  }

  // ao fechar a tela cheia, a galeria pequena fica na mesma foto
  const atualRef = useRef(0);
  useEffect(() => {
    atualRef.current = atual;
  }, [atual]);
  useEffect(() => {
    const d = janela.current;
    if (!d) return;
    const aoFechar = () => {
      const el = trilho.current;
      if (el) el.scrollTo({ left: atualRef.current * el.clientWidth, behavior: "auto" });
    };
    d.addEventListener("close", aoFechar);
    return () => d.removeEventListener("close", aoFechar);
  }, []);

  if (total === 0) {
    return (
      <div className="grid aspect-[4/3] w-full place-items-center bg-borda text-texto-suave md:rounded-card">
        <span className="flex flex-col items-center gap-2">
          <ImageOff className="size-10" aria-hidden />
          Anúncio sem foto
        </span>
      </div>
    );
  }

  return (
    <div className="relative" role="region" aria-roledescription="galeria" aria-label={`Fotos de ${titulo}`}>
      <ul
        ref={trilho}
        onScroll={(e) => aoRolar(e.currentTarget)}
        className="flex aspect-[4/3] w-full snap-x snap-mandatory overflow-x-auto bg-beringela [scrollbar-width:none] md:rounded-card"
      >
        {fotos.map((f, i) => (
          <li key={f + i} className="relative h-full w-full shrink-0 snap-center">
            <button
              type="button"
              onClick={() => abrir(i)}
              className="block size-full focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-laranja"
              aria-label={`Foto ${i + 1} de ${total} de ${titulo}. Abrir em tela cheia`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- foto do Storage, img simples carrega leve */}
              <img
                src={f}
                alt={`Foto ${i + 1} de ${total} de ${titulo}`}
                width={800}
                height={600}
                loading={i === 0 ? "eager" : "lazy"}
                fetchPriority={i === 0 ? "high" : undefined}
                decoding="async"
                className="size-full object-contain"
              />
            </button>
          </li>
        ))}
      </ul>

      {total > 1 && (
        <>
          <span
            className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-beringela/80 px-3 py-1 text-[13px] font-semibold text-white"
            aria-live="polite"
          >
            {atual + 1}/{total}
          </span>
          <div className="absolute inset-y-0 left-2 hidden items-center md:flex">
            <button type="button" className={BOTAO_REDONDO} onClick={() => irPara(trilho.current, atual - 1)} aria-label="Foto anterior" disabled={atual === 0}>
              <ChevronLeft className="size-6" aria-hidden />
            </button>
          </div>
          <div className="absolute inset-y-0 right-2 hidden items-center md:flex">
            <button type="button" className={BOTAO_REDONDO} onClick={() => irPara(trilho.current, atual + 1)} aria-label="Próxima foto" disabled={atual === total - 1}>
              <ChevronRight className="size-6" aria-hidden />
            </button>
          </div>
        </>
      )}
      <span className="pointer-events-none absolute bottom-3 left-3 grid size-9 place-items-center rounded-full bg-beringela/80 text-white" aria-hidden>
        <Maximize2 className="size-4" />
      </span>

      <dialog
        ref={janela}
        aria-label={`Fotos de ${titulo} em tela cheia`}
        className="m-0 h-dvh max-h-none w-screen max-w-none bg-black p-0 text-white backdrop:bg-black"
      >
        <div className="relative flex h-full flex-col">
          <div className="flex items-center justify-between px-2 py-2">
            <span className="px-2 text-base font-semibold" aria-live="polite">
              {atual + 1} de {total}
            </span>
            <button
              type="button"
              onClick={fechar}
              className="grid size-12 place-items-center rounded-full bg-white/15 hover:bg-white/25 focus-visible:outline-3 focus-visible:outline-laranja"
              aria-label="Fechar fotos"
              autoFocus
            >
              <X className="size-6" aria-hidden />
            </button>
          </div>
          <ul
            ref={trilhoCheio}
            onScroll={(e) => aoRolar(e.currentTarget)}
            className="flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto [scrollbar-width:none]"
          >
            {fotos.map((f, i) => (
              <li key={f + i} className="grid h-full w-full shrink-0 snap-center place-items-center">
                {/* eslint-disable-next-line @next/next/no-img-element -- tela cheia: foto inteira */}
                <img src={f} alt={`Foto ${i + 1} de ${total} de ${titulo}`} loading="lazy" decoding="async" className="max-h-full max-w-full object-contain" />
              </li>
            ))}
          </ul>
          {total > 1 && (
            <div className="flex justify-center gap-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
              <button type="button" className={BOTAO_REDONDO} onClick={() => irPara(trilhoCheio.current, atual - 1)} aria-label="Foto anterior" disabled={atual === 0}>
                <ChevronLeft className="size-6" aria-hidden />
              </button>
              <button type="button" className={BOTAO_REDONDO} onClick={() => irPara(trilhoCheio.current, atual + 1)} aria-label="Próxima foto" disabled={atual === total - 1}>
                <ChevronRight className="size-6" aria-hidden />
              </button>
            </div>
          )}
        </div>
      </dialog>
    </div>
  );
}
