import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { listarCategorias } from "@/lib/dados/categorias";
import { CirculoCategoria } from "@/components/ui/icone-categoria";
import { Vazio } from "@/components/ui/vazio";
import { Botao } from "@/components/ui/botao";
import { linkCategoria } from "@/lib/formato";

// T3 · Todas as categorias (vêm da tabela categorias, gerenciada no painel).
export const metadata: Metadata = {
  title: "Todas as categorias",
  description: "Veículos, agro, imóveis, casa, eletrônicos, moda, serviços, empregos e mais na sua região.",
};

export default async function PaginaCategorias() {
  const categorias = await listarCategorias();

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4">
      <h1 className="text-titulo font-semibold text-beringela">Todas as categorias</h1>
      {categorias.length === 0 ? (
        <Vazio titulo="Não conseguimos carregar as categorias." texto="Confira a internet e tente de novo.">
          <Botao href="/categorias">Tentar de novo</Botao>
        </Vazio>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {categorias.map((p) => (
            <li key={p.id} className="rounded-card bg-cartao p-2 shadow-1">
              <section aria-labelledby={`cat-${p.slug}`}>
                <Link
                  href={linkCategoria(p.slug)}
                  className="flex min-h-14 items-center gap-3 rounded-campo px-2 py-1 hover:bg-fundo focus-visible:outline-3 focus-visible:outline-laranja-escuro"
                >
                  <CirculoCategoria nome={p.icone} />
                  <h2 id={`cat-${p.slug}`} className="flex-1 text-lg font-semibold">
                    {p.nome}
                  </h2>
                  <span className="text-base font-semibold text-laranja-escuro">Ver tudo</span>
                  <ChevronRight className="size-5 text-laranja-escuro" aria-hidden />
                </Link>
                {p.filhas.length > 0 && (
                  <ul className="mt-1 border-t border-borda pt-1">
                    {p.filhas.map((f) => (
                      <li key={f.id}>
                        <Link
                          href={linkCategoria(p.slug, f.slug)}
                          className="flex min-h-11 items-center gap-3 rounded-campo px-3 text-base hover:bg-fundo focus-visible:outline-3 focus-visible:outline-laranja-escuro"
                        >
                          <span className="flex-1">{f.nome}</span>
                          <ChevronRight className="size-4 text-texto-suave" aria-hidden />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
