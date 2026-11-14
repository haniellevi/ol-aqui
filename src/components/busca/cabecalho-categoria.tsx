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
// título, busca dentro da categoria e as filhas da categoria atual em chips.
const LINK = "inline-flex min-h-11 min-w-0 items-center px-1 [overflow-wrap:anywhere] underline-offset-4 hover:underline";

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
    <div className="flex min-w-0 flex-col gap-2">
      <nav aria-label="Você está em" className="text-sm text-texto-suave">
        <ol className="flex flex-wrap items-center gap-1">
          <li>
            <Link href="/categorias" className={LINK}>
              Categorias
            </Link>
          </li>
          {caminho.map((c, i) => (
            <li key={c.id} className="flex max-w-full min-w-0 items-center gap-1">
              <ChevronRight className="size-4 shrink-0" aria-hidden />
              {i < caminho.length - 1 ? (
                <Link href={linkCanonico(caminho.slice(0, i + 1))} className={LINK}>
                  {c.nome}
                </Link>
              ) : (
                <span aria-current="page" className="min-w-0 text-beringela [overflow-wrap:anywhere]">
                  {c.nome}
                </span>
              )}
            </li>
          ))}
        </ol>
      </nav>

      <div className="flex min-w-0 items-center gap-2">
        <CirculoCategoria nome={caminho[0].icone} />
        <h1 className="min-w-0 text-titulo font-semibold [overflow-wrap:anywhere]">{categoria.nome}</h1>
      </div>

      <CampoBusca valor={q} manter={sp} caminho={caminhoBusca} id="busca-categoria" toqueAmplo />

      {grupo && chips.length > 0 && (
        <nav aria-label={`Dentro de ${grupo.nome}`} className="min-w-0">
          <ul className="flex flex-wrap gap-2 py-1">
            <li>
              <Chip href={comParametros(linkCanonico(caminhoGrupo), { ...filtrosGerais, q })} tamanho="toque" ativo={grupo === categoria}>
                Tudo
              </Chip>
            </li>
            {chips.map((f) => (
              <li key={f.id} className="max-w-full">
                <Chip href={linkFilha(f.slug)} tamanho="toque" ativo={f.id === categoria.id} className="max-w-full">
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
