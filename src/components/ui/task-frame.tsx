"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Mantém conteúdo rolável e ações dentro da área visível, inclusive com teclado. */
export function TaskFrame({ children }: { children: ReactNode }) {
  const main = useRef<HTMLElement>(null);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const ajustar = () => {
      if (!main.current) return;
      main.current.style.height = `${viewport.height}px`;
      main.current.style.top = `${viewport.offsetTop}px`;
    };
    ajustar();
    viewport.addEventListener("resize", ajustar);
    viewport.addEventListener("scroll", ajustar);
    return () => {
      viewport.removeEventListener("resize", ajustar);
      viewport.removeEventListener("scroll", ajustar);
    };
  }, []);
  return <main ref={main} data-tarefa-radar className="fixed inset-x-0 top-0 mx-auto flex h-dvh w-full max-w-xl flex-col overflow-y-auto bg-fundo px-4 pt-3 pb-3">{children}</main>;
}
