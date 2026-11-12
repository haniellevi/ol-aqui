import Link from "next/link";
import { Ellipsis } from "lucide-react";
import { CirculoCategoria } from "@/components/ui/icone-categoria";
import { linkCategoria } from "@/lib/formato";
import type { CategoriaLeve } from "@/lib/categorias-arvore";
import { TodasCategorias } from "./todas-categorias";

// Início no celular: fileira de categorias com rolagem para o lado (as com mais anúncios na região
// primeiro; as vazias já vêm fora). A última, "Todas", abre a folha com busca e os 3 níveis.

const ITEM =
  "olaki-toque flex w-18 flex-col items-center gap-1 rounded-card px-1 py-1.5 text-center text-sm font-semibold leading-tight text-texto " +
  "hover:bg-cartao focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-laranja-escuro";

export function FaixaCategorias({ arvore, soComAnuncios, className = "" }: { arvore: CategoriaLeve[]; soComAnuncios: boolean; className?: string }) {
  if (!arvore.length) return null;
  return (
    <nav aria-label="Categorias" className={className}>
      <ul className="-mx-4 flex snap-x gap-1 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {arvore.map((c) => (
          <li key={c.id} className="shrink-0 snap-start">
            <Link href={linkCategoria(c.slug)} className={ITEM}>
              <CirculoCategoria nome={c.icone} className="size-12 border border-borda" />
              <span className="line-clamp-2 max-w-full hyphens-auto break-words">{c.nome}</span>
            </Link>
          </li>
        ))}
        <li className="shrink-0 snap-start">
          <TodasCategorias arvore={arvore} soComAnuncios={soComAnuncios} className={`${ITEM} cursor-pointer`}>
            <span className="grid size-12 place-items-center rounded-full border-2 border-borda bg-cartao text-beringela">
              <Ellipsis className="size-6" aria-hidden />
            </span>
            <span>Todas</span>
          </TodasCategorias>
        </li>
      </ul>
    </nav>
  );
}
