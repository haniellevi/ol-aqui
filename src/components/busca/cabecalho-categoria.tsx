import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Chip } from "@/components/ui/chip";
import { CirculoCategoria } from "@/components/ui/icone-categoria";
import { CampoBusca } from "@/components/busca/campo-busca";
import { linkCategoria } from "@/lib/formato";
import { linkCanonico } from "@/lib/categorias-arvore";
import type { CategoriaEncontrada } from "@/lib/dados/categorias";
import { comParametros, manterFiltros, type ParametrosUrl } from "@/components/busca/parametros";

// Topo da lista de categoria (T4): caminho (Categorias › Pet › Produtos para pets › Ração),
// título, busca dentro da categoria e as filhas da categoria atual em chips (rolagem para o lado).
const LINK = "inline-flex min-h-10 items-center underline-offset-4 hover:underline";

export function CabecalhoCategoria({ achada, q, sp = {} }: { achada: CategoriaEncontrada; q?: string; sp?: ParametrosUrl }) {
  const { categoria, caminho } = achada;
  // Quem mostra os chips: a própria categoria (se tem filhas) ou a mãe (irmãs da categoria atual).
  const grupo = categoria.filhas.length ? categoria : achada.pai;
  const caminhoGrupo = grupo === categoria ? caminho : caminho.slice(0, -1);
  const chips = grupo?.filhas ?? [];
  // Mudar de tipo preserva a busca geral, mas remove atributos próprios da categoria anterior.
  const filtrosGerais = Object.fromEntries(Object.entries(manterFiltros(sp)).filter(([k]) => k !== "categoria" && !k.startsWith("c_")));
  const linkFilha = (slug: string) => comParametros(linkCategoria(grupo?.slug ?? slug, slug), { ...filtrosGerais, q });
  const caminhoBusca = linkCanonico(caminho);

  return (
    <div className="flex flex-col gap-3">
      <nav aria-label="Você está em" className="text-base text-texto-suave">
        <ol className="flex flex-wrap items-center gap-1">
          <li>
            <Link href="/categorias" className={LINK}>
              Categorias
            </Link>
          </li>
          {caminho.map((c, i) => (
            <li key={c.id} className="flex items-center gap-1">
              <ChevronRight className="size-4" aria-hidden />
              {i < caminho.length - 1 ? (
                <Link href={linkCanonico(caminho.slice(0, i + 1))} className={LINK}>
                  {c.nome}
                </Link>
              ) : (
                <span aria-current="page" className="inline-flex min-h-10 items-center text-beringela">
                  {c.nome}
                </span>
              )}
            </li>
          ))}
        </ol>
      </nav>

      <div className="flex items-center gap-3">
        <CirculoCategoria nome={caminho[0].icone} />
        <h1 className="text-titulo font-semibold">{categoria.nome}</h1>
      </div>

      <CampoBusca valor={q} manter={sp} caminho={caminhoBusca} id="busca-categoria" />

      {grupo && chips.length > 0 && (
        <nav aria-label={`Dentro de ${grupo.nome}`} className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none]">
          <ul className="flex gap-2 py-1">
            <li>
              <Chip href={comParametros(linkCanonico(caminhoGrupo), { ...filtrosGerais, q })} ativo={grupo === categoria}>
                Tudo
              </Chip>
            </li>
            {chips.map((f) => (
              <li key={f.id}>
                <Chip href={linkFilha(f.slug)} ativo={f.id === categoria.id}>
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
