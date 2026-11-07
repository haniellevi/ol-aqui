import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, SlidersHorizontal } from "lucide-react";
import { classesChip } from "@/components/ui/chip";
import { classesBotao } from "@/components/ui/botao";
import { GradeAnuncios } from "@/components/anuncio/grade-anuncios";
import { FolhaFiltros, ID_FOLHA, ID_RESULTADOS } from "@/components/busca/folha-filtros";
import { ORDENS, POR_PAGINA, comParametros, textoPreco, type EstadoBusca, type ParametrosUrl } from "@/components/busca/parametros";
import { inteiro } from "@/lib/formato";
import type { AnuncioCard, CampoCategoria, CategoriaComFilhas, Cidade } from "@/lib/tipos";

// Corpo comum da busca (T5) e das listas de categoria (T4):
// chips de filtro, "N anúncios em ...", grade, paginação e a folha de filtros.

export function ResultadosBusca({
  caminho,
  sp,
  estado,
  campos,
  cidades,
  categorias,
  nomeCategoria,
  lugar,
  anuncios,
  total,
  vazio,
}: {
  caminho: string;
  sp: ParametrosUrl;
  estado: EstadoBusca;
  campos: CampoCategoria[];
  cidades: Cidade[];
  /** Na tela de busca: permite escolher a categoria na folha. */
  categorias?: CategoriaComFilhas[];
  /** Nome da categoria escolhida (para o chip). */
  nomeCategoria?: string | null;
  /** "Corrente e região" ou a cidade escolhida. */
  lugar: string;
  anuncios: AnuncioCard[];
  total: number;
  /** O que mostrar quando não há nada. */
  vazio: ReactNode;
}) {
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const faixa = textoPreco(estado.precoMin, estado.precoMax);
  const ordem = ORDENS.find((o) => o.valor === estado.ordem);
  const ondeTexto = estado.cidade || lugar;

  return (
    <>
      <nav aria-label="Filtros da busca" className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none]">
        <ul className="flex gap-2 py-1">
          <li>
            <a href={`#${ID_FOLHA}`} className={classesChip(estado.quantos > 0)}>
              <SlidersHorizontal className="size-4" aria-hidden />
              Filtros{estado.quantos > 0 ? ` (${estado.quantos})` : ""}
            </a>
          </li>
          <li>
            <a href="#filtro-cidade" className={classesChip(!!estado.cidade)}>
              {estado.cidade || "Cidade"}
            </a>
          </li>
          <li>
            <a href="#filtro-preco" className={classesChip(!!faixa)}>
              {faixa ?? "Preço"}
            </a>
          </li>
          <li>
            {categorias ? (
              <a href="#filtro-categoria" className={classesChip(!!estado.categoria)}>
                {nomeCategoria ?? "Categoria"}
              </a>
            ) : (
              <Link href="/categorias" className={classesChip(true)}>
                {nomeCategoria ?? "Categoria"}
              </Link>
            )}
          </li>
          <li>
            <a href="#filtro-ordem" className={classesChip(estado.ordem !== "relevancia")}>
              {estado.ordem !== "relevancia" && ordem ? ordem.rotulo : "Ordenar"}
            </a>
          </li>
        </ul>
      </nav>

      <section id={ID_RESULTADOS} aria-labelledby="total-resultados" className="flex scroll-mt-20 flex-col gap-3">
        <p id="total-resultados" className="text-base text-texto-suave" aria-live="polite">
          {total === 0 ? (
            <>Nenhum anúncio em {ondeTexto}</>
          ) : (
            <>
              <strong className="font-semibold text-texto">
                {inteiro(total)} {total === 1 ? "anúncio" : "anúncios"}
              </strong>{" "}
              em {ondeTexto}
            </>
          )}
        </p>

        {anuncios.length === 0 && estado.pagina > 1 && total === 0 ? (
          <div className="flex flex-col items-start gap-2">
            <p className="text-base">Esta página não tem mais anúncios.</p>
            <Link href={comParametros(caminho, sp)} className={classesBotao("secundario")}>
              Voltar para a primeira página
            </Link>
          </div>
        ) : (
          <GradeAnuncios anuncios={anuncios} vazio={vazio} />
        )}

        {paginas > 1 && <Paginacao caminho={caminho} sp={sp} pagina={estado.pagina} paginas={paginas} />}
      </section>

      <FolhaFiltros caminho={caminho} estado={estado} campos={campos} cidades={cidades} categorias={categorias} />
    </>
  );
}

function Paginacao({ caminho, sp, pagina, paginas }: { caminho: string; sp: ParametrosUrl; pagina: number; paginas: number }) {
  const link = (p: number) => comParametros(caminho, sp, { pagina: p > 1 ? String(p) : null });
  return (
    <nav aria-label="Páginas" className="mt-2 flex items-center justify-between gap-3">
      {pagina > 1 ? (
        <Link href={link(pagina - 1)} rel="prev" className={classesBotao("secundario")}>
          <ChevronLeft className="size-5" aria-hidden /> Anterior
        </Link>
      ) : (
        <span />
      )}
      <span className="text-[15px] text-texto-suave">
        Página {pagina} de {paginas}
      </span>
      {pagina < paginas ? (
        <Link href={link(pagina + 1)} rel="next" className={classesBotao("secundario")}>
          Próxima <ChevronRight className="size-5" aria-hidden />
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
