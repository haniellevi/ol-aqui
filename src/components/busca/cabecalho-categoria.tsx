import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Chip } from "@/components/ui/chip";
import { CirculoCategoria } from "@/components/ui/icone-categoria";
import { CampoBusca } from "@/components/busca/campo-busca";
import { linkCategoria } from "@/lib/formato";
import type { CategoriaEncontrada } from "@/lib/dados/categorias";
import { comParametros, manterFiltros, type ParametrosUrl } from "@/components/busca/parametros";

// Topo da lista de categoria (T4): caminho (Início › Veículos › Motos), título,
// busca dentro da categoria e as subcategorias em chips (rolagem para o lado).
export function CabecalhoCategoria({ achada, q, sp = {} }: { achada: CategoriaEncontrada; q?: string; sp?: ParametrosUrl }) {
  const { categoria, pai } = achada;
  const raiz = pai ?? { ...categoria, filhas: achada.filhas };
  const irmas = raiz.filhas;
  const caminho = linkCategoria(raiz.slug, pai ? categoria.slug : null);
  // Mudar de tipo preserva a busca geral, mas remove atributos próprios da categoria anterior.
  const filtrosGerais = Object.fromEntries(Object.entries(manterFiltros(sp)).filter(([k]) => k !== "categoria" && !k.startsWith("c_")));
  const linkTipo = (slug?: string) => comParametros(linkCategoria(raiz.slug, slug), { ...filtrosGerais, q });

  return (
    <div className="flex flex-col gap-3">
      <nav aria-label="Você está em" className="text-[15px] text-texto-suave">
        <ol className="flex flex-wrap items-center gap-1">
          <li>
            <Link href="/categorias" className="inline-flex min-h-12 items-center underline-offset-4 hover:underline">
              Categorias
            </Link>
          </li>
          {pai && (
            <li className="flex items-center gap-1">
              <ChevronRight className="size-4" aria-hidden />
              <Link href={linkCategoria(pai.slug)} className="inline-flex min-h-12 items-center underline-offset-4 hover:underline">
                {pai.nome}
              </Link>
            </li>
          )}
        </ol>
      </nav>

      <div className="flex items-center gap-3">
        <CirculoCategoria nome={categoria.icone} />
        <h1 className="text-[22px] font-semibold leading-7">{categoria.nome}</h1>
      </div>

      <CampoBusca valor={q} manter={sp} caminho={caminho} id="busca-categoria" />

      {irmas.length > 0 && (
        <nav aria-label={`Tipos de ${raiz.nome}`} className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none]">
          <ul className="flex gap-2 py-1">
            <li>
              <Chip href={linkTipo()} ativo={!pai}>
                Tudo
              </Chip>
            </li>
            {irmas.map((f) => (
              <li key={f.id}>
                <Chip href={linkTipo(f.slug)} ativo={f.id === categoria.id}>
                  {f.nome}
                </Chip>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}
