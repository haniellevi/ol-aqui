"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, Plus, Radar, Search, Store, UserRound, type LucideIcon } from "lucide-react";

import { escolherLoja } from "@/app/(conta)/_loja/actions";
import type { AtalhoLoja } from "@/lib/dados/navegacao-lojista";

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

// A página reserva o espaço embaixo com pb-reserva-nav md:pb-0 (ver os layouts).

export function BarraInferior({ loja = null }: { loja?: AtalhoLoja | null }) {
  const caminho = usePathname() ?? "/";
  const itens = ITENS.map((item) => {
    if (loja && item.href === "/anunciar") {
      return { ...item, href: loja.href, rotulo: loja.rotulo, Icone: Store, ativo: (p: string) => p.startsWith("/minha-conta/loja") };
    }
    if (loja && item.href === "/minha-conta") {
      return { ...item, ativo: (p: string) => p.startsWith("/minha-conta") && !p.startsWith("/minha-conta/loja") };
    }
    return item;
  });
  return (
    <nav
      aria-label="Navegação principal"
      className="navegacao-inferior olaki-material fixed inset-x-0 bottom-0 z-30 pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="mx-auto grid h-barra-nav max-w-lg grid-cols-5">
        {itens.map(({ href, rotulo, Icone, ativo }, index) => {
          const atual = ativo(caminho);
          const principal = index === 2;
          const classe = `flex w-full flex-col items-center justify-center gap-0.5 text-legenda font-semibold leading-4 focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-laranja-escuro ${atual || principal ? "text-beringela" : "text-texto-suave"}`;
          const conteudo = <>
            {principal ? (
              <span className="icone-anunciar -mt-4 grid size-10 place-items-center rounded-card bg-laranja text-beringela shadow-2">
                <Icone className="size-5" strokeWidth={2.5} aria-hidden />
              </span>
            ) : <Icone className="size-5" strokeWidth={atual ? 2.5 : 2} aria-hidden />}
            <span className={atual ? "underline decoration-2 underline-offset-4" : undefined}>{rotulo}</span>
          </>;
          return (
            <li key={href} className="flex">
              {principal && loja?.id ? (
                <form action={escolherLoja} className="flex w-full">
                  <input type="hidden" name="loja" value={loja.id} />
                  <input type="hidden" name="voltar" value={loja.href} />
                  <button type="submit" aria-current={atual ? "page" : undefined} className={classe}>{conteudo}</button>
                </form>
              ) : <Link href={href} aria-current={atual ? "page" : undefined} className={classe}>{conteudo}</Link>}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
