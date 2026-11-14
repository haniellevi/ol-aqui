import type { Metadata } from "next";
import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";
import { listarCategorias } from "@/lib/dados/categorias";
import { CirculoCategoria } from "@/components/ui/icone-categoria";
import { Vazio } from "@/components/ui/vazio";
import { Botao } from "@/components/ui/botao";
import { linkCanonico } from "@/lib/categorias-arvore";
import { linkCategoria } from "@/lib/formato";

// T3 · Todas as categorias (vêm da tabela categorias, gerenciada no painel).
export const metadata: Metadata = {
  title: "Todas as categorias",
  description: "Veículos, agro, imóveis, casa, eletrônicos, moda, serviços, empregos e mais na sua região.",
};

export default async function PaginaCategorias() {
  const categorias = await listarCategorias();

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-4">
      <h1 className="text-titulo font-semibold text-beringela">Todas as categorias</h1>
      {categorias.length === 0 ? (
        <Vazio titulo="Não conseguimos carregar as categorias." texto="Confira a internet e tente de novo.">
          <Botao href="/categorias" tamanho="toque">Tentar de novo</Botao>
        </Vazio>
      ) : (
        <ul className="grid items-start gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {categorias.map((p) => (
            <li key={p.id} className="min-w-0 rounded-card border border-borda bg-cartao">
              <section aria-labelledby={`cat-${p.slug}`}>
                <Link
                  href={linkCategoria(p.slug)}
                  className="flex min-h-12 items-center gap-2 rounded-campo px-3 py-2 hover:bg-fundo focus-visible:outline-3 focus-visible:outline-laranja-escuro"
                >
                  <CirculoCategoria nome={p.icone} className="size-8" />
                  <h2 id={`cat-${p.slug}`} className="min-w-0 flex-1 text-base font-semibold [overflow-wrap:anywhere]">
                    {p.nome}
                  </h2>
                  <ChevronRight className="size-4 shrink-0 text-laranja-escuro" aria-hidden />
                </Link>
                {p.filhas.length > 0 && (
                  <details className="group border-t border-borda">
                    <summary aria-label={`Subcategorias de ${p.nome}`} className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-campo px-3 text-sm font-semibold text-beringela hover:bg-fundo focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-laranja-escuro [&::-webkit-details-marker]:hidden">
                      Subcategorias <ChevronDown className="size-4 shrink-0 group-open:rotate-180" aria-hidden />
                    </summary>
                    <ul className="border-t border-borda px-1 pb-1">
                      {p.filhas.map((f) => (
                        <li key={f.id}>
                          <Link
                            href={linkCanonico([p, f])}
                            className="flex min-h-11 items-center gap-2 rounded-campo px-3 text-base hover:bg-fundo focus-visible:outline-3 focus-visible:outline-laranja-escuro"
                          >
                            <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{f.nome}</span>
                            <ChevronRight className="size-4 shrink-0 text-texto-suave" aria-hidden />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </section>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
