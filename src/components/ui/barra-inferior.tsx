"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, Plus, Radar, Search, UserRound, type LucideIcon } from "lucide-react";

// Barra de baixo do celular: Início · Buscar · [+ Anunciar] · Radar · Conta.
// Ícone sempre com nome, item atual marcado (aria-current) e espaço para a "barra" do iPhone.

type Item = { href: string; rotulo: string; Icone: LucideIcon; ativo: (p: string) => boolean };

const ITENS: Item[] = [
  { href: "/", rotulo: "Início", Icone: House, ativo: (p) => p === "/" },
  { href: "/busca", rotulo: "Buscar", Icone: Search, ativo: (p) => p.startsWith("/busca") || p.startsWith("/c/") || p === "/categorias" },
  { href: "/anunciar", rotulo: "Anunciar", Icone: Plus, ativo: (p) => p.startsWith("/anunciar") || p.startsWith("/quero-vender") },
  { href: "/radar", rotulo: "Radar", Icone: Radar, ativo: (p) => p.startsWith("/radar") },
  { href: "/minha-conta", rotulo: "Conta", Icone: UserRound, ativo: (p) => p.startsWith("/minha-conta") },
];

// A página reserva o espaço embaixo com pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0 (ver os layouts).

export function BarraInferior() {
  const caminho = usePathname() ?? "/";
  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-borda bg-cartao pb-[env(safe-area-inset-bottom)] shadow-2 md:hidden"
    >
      <ul className="mx-auto grid h-16 max-w-lg grid-cols-5">
        {ITENS.map(({ href, rotulo, Icone, ativo }) => {
          const atual = ativo(caminho);
          const anunciar = href === "/anunciar";
          return (
            <li key={href} className="flex">
              <Link
                href={href}
                aria-current={atual ? "page" : undefined}
                className={`flex w-full flex-col items-center justify-center gap-0.5 text-[13px] font-semibold leading-4 focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-laranja-escuro ${
                  atual ? "text-beringela" : "text-texto-suave"
                }`}
              >
                {anunciar ? (
                  <span className="-mt-5 grid size-12 place-items-center rounded-card bg-laranja text-beringela shadow-[0_4px_10px_rgb(255_106_19/0.35)]">
                    <Icone className="size-6" strokeWidth={2.5} aria-hidden />
                  </span>
                ) : (
                  <Icone className="size-6" strokeWidth={atual ? 2.5 : 2} aria-hidden />
                )}
                <span className={atual ? "underline decoration-2 underline-offset-4" : undefined}>{rotulo}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
