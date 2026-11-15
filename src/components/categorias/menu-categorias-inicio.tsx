"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { ChevronDown, LayoutGrid } from "lucide-react";
import { IconeCategoria } from "@/components/ui/icone-categoria";
import { linkCategoria } from "@/lib/formato";

type CategoriaMenu = { id: string; slug: string; nome: string; icone: string };

const item = "flex min-h-toque min-w-0 items-center gap-2 rounded-campo px-3 py-1.5 text-sm font-medium text-beringela hover:bg-selecao focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-laranja-escuro";

export function MenuCategoriasInicio({ categorias }: { categorias: CategoriaMenu[] }) {
  const menu = useRef<HTMLDetailsElement>(null);
  const botao = useRef<HTMLElement>(null);

  useEffect(() => {
    const fecharFora = (evento: PointerEvent) => {
      const atual = menu.current;
      if (atual?.open && evento.target instanceof Node && !atual.contains(evento.target)) atual.open = false;
    };
    document.addEventListener("pointerdown", fecharFora);
    return () => document.removeEventListener("pointerdown", fecharFora);
  }, []);

  return (
    <details ref={menu} className="group relative shrink-0"
      onKeyDown={(evento) => {
        if (evento.key !== "Escape" || !evento.currentTarget.open) return;
        evento.stopPropagation();
        evento.currentTarget.open = false;
        botao.current?.focus();
      }}
      onBlur={(evento) => {
        if (evento.relatedTarget && !evento.currentTarget.contains(evento.relatedTarget)) evento.currentTarget.open = false;
      }}
    >
      <summary ref={botao} title="Categorias" className="flex min-h-toque min-w-toque cursor-pointer items-center justify-center list-none gap-1.5 rounded-campo border border-borda bg-cartao px-2 text-sm font-semibold text-beringela hover:bg-selecao focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-laranja-escuro sm:px-3 [&::-webkit-details-marker]:hidden">
        <LayoutGrid className="size-4 shrink-0 min-[360px]:max-[479px]:hidden" aria-hidden />
        <span className="max-[359px]:sr-only">Categorias</span>
        <ChevronDown className="hidden size-4 shrink-0 group-open:rotate-180 min-[480px]:block" aria-hidden />
      </summary>
      <nav aria-label="Categorias de anúncios"
        className="absolute left-0 top-full z-40 mt-2 max-h-[min(28rem,60dvh)] w-72 max-w-[calc(100vw-2rem)] overflow-y-auto overscroll-contain rounded-card border border-borda bg-cartao p-1 shadow-2 md:w-[30rem]"
      >
        <ul className="grid gap-0.5 md:grid-cols-2">
          {categorias.map((c) => (
            <li key={c.id} className="min-w-0">
              <Link href={linkCategoria(c.slug)} className={item}>
                <IconeCategoria nome={c.icone} className="size-4 shrink-0" aria-hidden />
                <span className="min-w-0 leading-snug [overflow-wrap:anywhere]">{c.nome}</span>
              </Link>
            </li>
          ))}
        </ul>
        <Link href="/categorias" className={`${item} mt-1 border-t border-borda font-semibold`}>
          <LayoutGrid className="size-4 shrink-0" aria-hidden />
          Todas as categorias
        </Link>
      </nav>
    </details>
  );
}
