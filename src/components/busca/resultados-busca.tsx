import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowDownUp, ChevronLeft, ChevronRight, LayoutGrid, List, SlidersHorizontal, X } from "lucide-react";
import { classesBotao } from "@/components/ui/botao";
import { GradeAnuncios } from "@/components/anuncio/grade-anuncios";
import { FolhaFiltros } from "@/components/busca/folha-filtros";
import { ID_FOLHA, ID_RESULTADOS, ORDENS, POR_PAGINA, comParametros, paramCampo, textoPreco, type EstadoBusca, type ParametrosUrl } from "@/components/busca/parametros";
import { inteiro } from "@/lib/formato";
import type { AnuncioCard, CampoCategoria, CategoriaComFilhas, Cidade, FacetasBusca } from "@/lib/tipos";
import { Alert } from "@/components/ui/alert";

// Corpo comum da busca (T5) e das listas de categoria (T4):
// chips de filtro, "N anúncios em ...", grade, paginação e a folha de filtros.

const controle = "inline-flex min-h-12 items-center gap-1.5 rounded-campo px-2 text-sm font-semibold text-beringela hover:bg-selecao focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-laranja-escuro";

export function ResultadosBusca({
  caminho,
  sp,
  estado,
  campos,
  facetas,
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
  facetas?: FacetasBusca | null;
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
  const erros = Object.values(estado.erros);
  const ativos: { rotulo: string; parametros: string[] }[] = [];
  if (estado.categoria) ativos.push({ rotulo: nomeCategoria ?? "Categoria indisponível", parametros: ["categoria", ...Object.keys(sp).filter((k) => k.startsWith("c_"))] });
  if (estado.cidade) ativos.push({ rotulo: `Cidade: ${estado.cidade}`, parametros: ["cidade"] });
  if (estado.precoMinTexto || estado.precoMaxTexto) ativos.push({ rotulo: `Preço: ${estado.erros.preco_min || estado.erros.preco_max ? "revisar valores" : faixa}`, parametros: ["preco_min", "preco_max"] });
  for (const c of campos) {
    const parametros = c.tipo === "numero" ? [paramCampo(c.chave, "min"), paramCampo(c.chave, "max")] : [paramCampo(c.chave)];
    const valores = parametros.map((p) => estado.valores[p]);
    if (!valores.some(Boolean)) continue;
    const texto = c.tipo === "numero"
      ? [valores[0] && `de ${valores[0]}`, valores[1] && `até ${valores[1]}`].filter(Boolean).join(" ") + (c.unidade ? ` ${c.unidade}` : "")
      : c.tipo === "sim_nao" ? (valores[0] === "sim" ? "Sim" : "Não") : [valores[0]].flat().join(", ");
    ativos.push({ rotulo: `${c.rotulo}: ${texto}`, parametros });
  }
  const emCategoria = caminho.startsWith("/c/");
  const grade = estado.visualizacao === "grade";
  const paginaAtual = estado.pagina > 1 ? String(estado.pagina) : null;
  const filtros = { caminho, estado, campos, facetas, cidades, categorias, ia: (Array.isArray(sp.ia) ? sp.ia[0] : sp.ia) || undefined };
  const voltarHref = comParametros(caminho, sp, { pagina: paginaAtual });

  return (
    <div className={emCategoria ? "grid min-w-0 items-start gap-4 md:grid-cols-[minmax(14rem,16rem)_minmax(0,1fr)] md:gap-5" : "flex min-w-0 flex-col gap-2 md:gap-4"}>
      {emCategoria && <FolhaFiltros key={`lateral-${voltarHref}`} {...filtros} lateral />}
      <div className="flex min-w-0 flex-col gap-2 md:gap-3">
        <nav aria-label="Filtros da busca" className={emCategoria ? "md:hidden" : undefined}>
          <ul className="flex items-center justify-between gap-2 border-b border-borda">
            <li>
              <a href={`#${ID_FOLHA}`} className={controle}>
                <SlidersHorizontal className="size-4" aria-hidden />
                Filtros{ativos.length > 0 ? ` (${ativos.length})` : ""}
              </a>
            </li>
            <li>
              <a href="#filtro-ordem" className={controle}>
                <ArrowDownUp className="size-4" aria-hidden />
                {estado.ordem !== "relevancia" ? ordem?.rotulo : "Ordenar"}
              </a>
            </li>
          </ul>
        </nav>

        {ativos.length > 0 && (
          <nav aria-label="Filtros ativos">
            <ul className={`grid gap-1 ${ativos.length === 1 ? "grid-cols-1" : ativos.length === 2 ? "grid-cols-2" : "grid-cols-3"} sm:flex sm:flex-wrap`}>
              {ativos.map((a) => (
                <li key={a.parametros[0]} className="max-w-full">
                  <Link
                    href={comParametros(caminho, sp, Object.fromEntries(a.parametros.map((p) => [p, null])))}
                    aria-label={`Remover filtro: ${a.rotulo}`}
                    className="flex h-full min-h-12 w-full items-center justify-between gap-1 rounded-campo bg-selecao px-1.5 py-1 text-xs leading-tight text-beringela hover:bg-borda focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-laranja-escuro sm:w-auto sm:gap-2 sm:px-3"
                  >
                    <span className="min-w-0 [overflow-wrap:anywhere]">{a.rotulo.replace(/^(Cidade|Preço): /, "")}</span><X className="size-3 shrink-0" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}

        <section id={ID_RESULTADOS} aria-labelledby="total-resultados" className="flex scroll-mt-20 flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
            <p id="total-resultados" className="text-base text-texto-suave" aria-live="polite">
              {erros.length ? "Revise os filtros para ver os anúncios" : total === 0 ? (
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
            <nav aria-label="Visualização dos resultados" className="inline-flex rounded-campo border border-borda bg-cartao">
              {([{ modo: "lista", texto: "Lista", Icone: List }, { modo: "grade", texto: "Grade", Icone: LayoutGrid }] as const).map(({ modo, texto, Icone }) => {
                const selecionada = grade === (modo === "grade");
                return (
                  <Link
                    key={modo}
                    href={comParametros(caminho, sp, { visualizacao: modo === "grade" ? modo : null, pagina: paginaAtual })}
                    aria-current={selecionada ? "true" : undefined}
                    className={`inline-flex min-h-11 items-center gap-1 rounded-campo px-2 text-xs font-semibold text-beringela hover:bg-fundo focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-laranja-escuro ${selecionada ? "bg-selecao" : ""}`}
                  >
                    <Icone className="size-4" aria-hidden /> {texto}
                  </Link>
                );
              })}
            </nav>
          </div>

          {erros.length > 0 ? (
            <Alert variant="destructive" role="alert" className="flex flex-col items-start gap-3">
              <h2 className="text-lg font-semibold">Não foi possível aplicar os filtros</h2>
              <ul className="list-inside list-disc text-base">{erros.map((erro) => <li key={erro}>{erro}</li>)}</ul>
              <a href={`#${ID_FOLHA}`} className={classesBotao("secundario", false, emCategoria ? "md:hidden" : "")}>Corrigir filtros</a>
              {emCategoria && <a href="#lateral-titulo-filtros" className={classesBotao("secundario", false, "hidden md:inline-flex")}>Corrigir filtros</a>}
            </Alert>
          ) : anuncios.length === 0 && estado.pagina > 1 && total === 0 ? (
            <div className="flex flex-col items-start gap-2">
              <p className="text-base">Esta página não tem mais anúncios.</p>
              <Link href={comParametros(caminho, sp)} className={classesBotao("secundario")}>
                Voltar para a primeira página
              </Link>
            </div>
          ) : (
            <GradeAnuncios anuncios={anuncios} vazio={vazio} compacto={!grade} horizontal={!grade} className={emCategoria && grade ? "lg:grid-cols-3! xl:grid-cols-3!" : undefined} voltarHref={voltarHref} medirEm={caminho === "/busca" ? "busca" : "categoria"} />
          )}

          {paginas > 1 && <Paginacao caminho={caminho} sp={sp} pagina={estado.pagina} paginas={paginas} />}
        </section>
      </div>
      <FolhaFiltros key={voltarHref} {...filtros} apenasMobile={emCategoria} />
    </div>
  );
}

function Paginacao({ caminho, sp, pagina, paginas }: { caminho: string; sp: ParametrosUrl; pagina: number; paginas: number }) {
  const link = (p: number) => comParametros(caminho, sp, { pagina: p > 1 ? String(p) : null });
  return (
    <nav aria-label="Páginas" className="mt-2 grid grid-cols-2 items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
      {pagina > 1 ? (
        <Link href={link(pagina - 1)} rel="prev" className={classesBotao("secundario", false, "order-2 justify-self-start sm:order-1")}>
          <ChevronLeft className="hidden size-5 sm:inline" aria-hidden /> Anterior
        </Link>
      ) : (
        <span className="order-2 sm:order-1" />
      )}
      <span className="order-1 col-span-2 text-center text-base text-texto-suave sm:order-2 sm:col-span-1">
        Página {pagina} de {paginas}
      </span>
      {pagina < paginas ? (
        <Link href={link(pagina + 1)} rel="next" className={classesBotao("secundario", false, "order-3 justify-self-end")}>
          Próxima <ChevronRight className="hidden size-5 sm:inline" aria-hidden />
        </Link>
      ) : (
        <span className="order-3" />
      )}
    </nav>
  );
}
