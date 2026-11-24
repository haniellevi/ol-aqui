import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Chip } from "@/components/ui/chip";
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
                <h1 aria-current="page" className="min-w-0 text-titulo font-semibold text-beringela [overflow-wrap:anywhere]">
                  {c.nome}
                </h1>
              )}
            </li>
          ))}
        </ol>
      </nav>

      <CampoBusca valor={q} manter={sp} caminho={caminhoBusca} id="busca-categoria" />

      {grupo && chips.length > 0 && (
        <nav aria-label={`Dentro de ${grupo.nome}`} className="min-w-0">
          <ul className="flex gap-2 overflow-x-auto py-1 [scrollbar-width:thin]">
            <li className="shrink-0">
              <Chip href={comParametros(linkCanonico(caminhoGrupo), { ...filtrosGerais, q })} tamanho="toque" ativo={grupo === categoria}>
                Tudo
              </Chip>
            </li>
            {[...chips].sort((a, b) => Number(b.id === categoria.id) - Number(a.id === categoria.id)).map((f) => (
              <li key={f.id} className="shrink-0">
                <Chip href={linkFilha(f.slug)} tamanho="toque" ativo={f.id === categoria.id} className="shrink-0">
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
