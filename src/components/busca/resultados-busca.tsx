import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, SlidersHorizontal, X } from "lucide-react";
import { classesChip } from "@/components/ui/chip";
import { classesBotao } from "@/components/ui/botao";
import { GradeAnuncios } from "@/components/anuncio/grade-anuncios";
import { FolhaFiltros } from "@/components/busca/folha-filtros";
import { ID_FOLHA, ID_RESULTADOS, ORDENS, POR_PAGINA, comParametros, paramCampo, textoPreco, type EstadoBusca, type ParametrosUrl } from "@/components/busca/parametros";
import { inteiro } from "@/lib/formato";
import type { AnuncioCard, CampoCategoria, CategoriaComFilhas, Cidade, FacetasBusca } from "@/lib/tipos";

// Corpo comum da busca (T5) e das listas de categoria (T4):
// chips de filtro, "N anúncios em ...", grade, paginação e a folha de filtros.

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
  if (estado.ordem !== "relevancia" && ordem) ativos.push({ rotulo: `Ordem: ${ordem.rotulo}`, parametros: ["ordem"] });
  const limpar = comParametros(caminho, { q: estado.q });

  return (
    <>
      <nav aria-label="Filtros da busca">
        <ul className="flex flex-wrap gap-2 py-1">
          <li>
            <a href={`#${ID_FOLHA}`} className={classesChip(estado.quantos > 0)}>
              <SlidersHorizontal className="size-4" aria-hidden />
              Filtros{estado.quantos > 0 ? ` (${estado.quantos})` : ""}
            </a>
          </li>
          <li>
            <a href="#filtro-cidade" className={classesChip(!!estado.cidade)}>
              Cidade
            </a>
          </li>
          <li>
            <a href="#filtro-preco" className={classesChip(!!estado.precoMinTexto || !!estado.precoMaxTexto)}>
              Preço
            </a>
          </li>
          <li>
            {categorias ? (
              <a href="#filtro-categoria" className={classesChip(!!estado.categoria)}>
                Categoria
              </a>
            ) : (
              <Link href="/categorias" className={classesChip(true)}>
                {nomeCategoria ?? "Categoria"}
              </Link>
            )}
          </li>
          <li>
            <a href="#filtro-ordem" className={classesChip(estado.ordem !== "relevancia")}>
              Ordenar
            </a>
          </li>
        </ul>
      </nav>

      {ativos.length > 0 && (
        <nav aria-label="Filtros ativos" className="flex flex-col gap-2 rounded-card border border-borda bg-cartao p-3">
          <div className="flex flex-wrap items-center justify-between gap-x-4">
            <p className="text-sm font-semibold">Sua busca está filtrada</p>
            <Link href={limpar} className="inline-flex min-h-11 items-center text-sm font-semibold text-laranja-escuro underline underline-offset-4 focus-visible:outline-3 focus-visible:outline-laranja-escuro">Limpar filtros</Link>
          </div>
          <ul className="flex flex-wrap gap-2">
            {ativos.map((a) => (
              <li key={a.parametros[0]} className="max-w-full">
                <Link
                  href={comParametros(caminho, sp, Object.fromEntries(a.parametros.map((p) => [p, null])))}
                  aria-label={`Remover filtro: ${a.rotulo}`}
                  className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-campo border border-laranja-escuro bg-selecao px-3 py-2 text-sm text-beringela hover:bg-fundo focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-laranja-escuro"
                >
                  <span className="min-w-0 break-words">{a.rotulo}</span><X className="size-4 shrink-0" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <section id={ID_RESULTADOS} aria-labelledby="total-resultados" className="flex scroll-mt-20 flex-col gap-3">
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

        {erros.length > 0 ? (
          <div role="alert" className="flex flex-col items-start gap-3 rounded-card border border-perigo bg-perigo-fundo p-4">
            <h2 className="text-lg font-semibold">Não foi possível aplicar os filtros</h2>
            <ul className="list-inside list-disc text-base">{erros.map((erro) => <li key={erro}>{erro}</li>)}</ul>
            <a href={`#${ID_FOLHA}`} className={classesBotao("secundario")}>Corrigir filtros</a>
          </div>
        ) : anuncios.length === 0 && estado.pagina > 1 && total === 0 ? (
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

      <FolhaFiltros key={comParametros(caminho, sp)} caminho={caminho} estado={estado} campos={campos} facetas={facetas} cidades={cidades} categorias={categorias} />
    </>
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
