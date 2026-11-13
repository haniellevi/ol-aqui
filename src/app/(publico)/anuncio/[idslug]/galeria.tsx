"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ChevronLeft, ChevronRight, ImageOff, Maximize2, X } from "lucide-react";

// Galeria do anúncio (T7/T8): deslizar com o dedo (scroll-snap, funciona sem JavaScript),
// contador "1/8", setas no computador e tela cheia ao tocar na foto.

const BOTAO_REDONDO =
  "grid size-10 place-items-center rounded-full bg-cartao/90 text-beringela shadow-1 hover:bg-cartao active:brightness-90 " +
  "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-laranja-escuro disabled:opacity-60";

export function Galeria({ fotos, titulo }: { fotos: string[]; titulo: string }) {
  const trilho = useRef<HTMLUListElement>(null);
  const trilhoCheio = useRef<HTMLUListElement>(null);
  const janela = useRef<HTMLDialogElement>(null);
  const origem = useRef<HTMLElement | null>(null);
  const overflow = useRef<string | null>(null);
  const [atual, setAtual] = useState(0);
  const atualRef = useRef(0);
  const total = fotos.length;

  function aoRolar(el: HTMLUListElement | null) {
    if (!el || !el.clientWidth) return;
    const indice = Math.min(total - 1, Math.max(0, Math.round(el.scrollLeft / el.clientWidth)));
    atualRef.current = indice;
    setAtual(indice);
  }

  function irPara(el: HTMLUListElement | null, i: number, suave = true) {
    if (!el) return;
    const alvo = Math.min(total - 1, Math.max(0, i));
    el.scrollTo({ left: alvo * el.clientWidth, behavior: suave && !window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "smooth" : "auto" });
  }

  function abrir(i: number) {
    if (janela.current?.open) return;
    origem.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    overflow.current = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    atualRef.current = i;
    janela.current?.showModal();
    setAtual(i);
    irPara(trilhoCheio.current, i, false);
  }

  function fechar() {
    janela.current?.close();
  }

  function teclado(evento: KeyboardEvent) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(evento.key)) return;
    evento.preventDefault();
    const i = evento.key === "Home" ? 0 : evento.key === "End" ? total - 1 : atual + (evento.key === "ArrowRight" ? 1 : -1);
    irPara(janela.current?.open ? trilhoCheio.current : trilho.current, i);
  }

  // ao fechar a tela cheia, a galeria pequena fica na mesma foto
  useEffect(() => {
    const d = janela.current;
    if (!d) return;
    const aoFechar = () => {
      const el = trilho.current;
      if (el) el.scrollTo({ left: atualRef.current * el.clientWidth, behavior: "auto" });
      if (overflow.current != null) document.body.style.overflow = overflow.current;
      overflow.current = null;
      const fotoAtual = el?.children[atualRef.current]?.querySelector("button");
      (fotoAtual ?? origem.current)?.focus({ preventScroll: true });
    };
    d.addEventListener("close", aoFechar);
    const redimensionar = new ResizeObserver(() => {
      for (const el of [trilho.current, trilhoCheio.current]) {
        if (el?.clientWidth) el.scrollTo({ left: atualRef.current * el.clientWidth, behavior: "auto" });
      }
    });
    if (trilho.current) redimensionar.observe(trilho.current);
    if (trilhoCheio.current) redimensionar.observe(trilhoCheio.current);
    return () => {
      d.removeEventListener("close", aoFechar);
      redimensionar.disconnect();
      if (overflow.current != null) document.body.style.overflow = overflow.current;
    };
  }, []);

  if (total === 0) {
    return (
      <div className="grid aspect-square max-h-48 w-full rounded-card md:max-h-none place-items-center bg-borda text-texto-suave md:rounded-card">
        <span className="flex flex-col items-center gap-2">
          <ImageOff className="size-10" aria-hidden />
          Anúncio sem foto
        </span>
      </div>
    );
  }

  return (
    <div className="relative min-w-0" role="region" aria-roledescription="galeria" aria-label={`Fotos de ${titulo}`} onKeyDown={teclado}>
      <ul
        ref={trilho}
        onScroll={(e) => aoRolar(e.currentTarget)}
        className="flex aspect-square max-h-48 w-full rounded-card md:max-h-none snap-x snap-mandatory overflow-x-auto bg-white [scrollbar-width:none] md:rounded-card"
      >
        {fotos.map((f, i) => (
          <li key={f + i} className="relative h-full w-full shrink-0 snap-center">
            <button
              type="button"
              tabIndex={i === atual ? 0 : -1}
              onClick={() => abrir(i)}
              className="block size-full focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-laranja"
              aria-label={`Foto ${i + 1} de ${total} de ${titulo}. Abrir em tela cheia`}
            >
              <Foto src={f} alt={`Foto ${i + 1} de ${total} de ${titulo}`} principal={i === 0} />
            </button>
          </li>
        ))}
      </ul>

      {total > 1 && (
        <>
          <span
            className="pointer-events-none absolute right-3 bottom-3 rounded-full bg-beringela/80 px-3 py-1 text-legenda font-semibold text-white"
            aria-live="polite"
          >
            {atual + 1}/{total}
          </span>
          <div className="pointer-events-none absolute inset-y-0 left-2 flex items-center [&>button]:pointer-events-auto">
            <button type="button" className={BOTAO_REDONDO} onClick={() => irPara(trilho.current, atual - 1)} aria-label="Foto anterior" disabled={atual === 0}>
              <ChevronLeft className="size-5" aria-hidden />
            </button>
          </div>
          <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center [&>button]:pointer-events-auto">
            <button type="button" className={BOTAO_REDONDO} onClick={() => irPara(trilho.current, atual + 1)} aria-label="Próxima foto" disabled={atual === total - 1}>
              <ChevronRight className="size-5" aria-hidden />
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
              className="grid size-10 place-items-center rounded-full bg-white/15 hover:bg-white/25 focus-visible:outline-3 focus-visible:outline-laranja active:bg-white/25"
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
                <Foto src={f} alt={`Foto ${i + 1} de ${total} de ${titulo}`} />
              </li>
            ))}
          </ul>
          {total > 1 && (
            <div className="flex justify-center gap-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
              <button type="button" className={BOTAO_REDONDO} onClick={() => irPara(trilhoCheio.current, atual - 1)} aria-label="Foto anterior" disabled={atual === 0}>
                <ChevronLeft className="size-5" aria-hidden />
              </button>
              <button type="button" className={BOTAO_REDONDO} onClick={() => irPara(trilhoCheio.current, atual + 1)} aria-label="Próxima foto" disabled={atual === total - 1}>
                <ChevronRight className="size-5" aria-hidden />
              </button>
            </div>
          )}
        </div>
      </dialog>
    </div>
  );
}

function Foto({ src, alt, principal = false }: { src: string; alt: string; principal?: boolean }) {
  const [erro, setErro] = useState(false);
  if (erro) return <span role="img" aria-label={`${alt}: indisponível`} className="flex size-full flex-col items-center justify-center gap-2 bg-fundo p-6 text-center text-texto-suave"><ImageOff className="size-10" aria-hidden />Não foi possível carregar esta foto.</span>;
  // Fotos públicas do Storage, com alternativa explícita quando o arquivo não responde.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} width={1080} height={1080} loading={principal ? "eager" : "lazy"} fetchPriority={principal ? "high" : undefined} decoding="async" onError={() => setErro(true)} className="size-full object-contain" />;
}
