import "server-only";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { buscarAnuncios } from "@/lib/dados/anuncios";
import { registrarBusca } from "@/lib/dados/buscas";
import { listarCategorias, type CategoriaEncontrada } from "@/lib/dados/categorias";
import { listarCidades, regiaoAtual } from "@/lib/dados/regiao";
import { GradeAnuncios } from "@/components/anuncio/grade-anuncios";
import { ResultadosBusca } from "@/components/busca/resultados-busca";
import { VazioBusca } from "@/components/busca/vazio-busca";
import { POR_PAGINA, comParametros, lerEstadoBusca, lugarDaRegiao, type ParametrosUrl } from "@/components/busca/parametros";
import type { AnuncioCard } from "@/lib/tipos";

// Monta a lista de anúncios da busca (T5) e das categorias (T4) a partir do endereço.
// Tudo no servidor: a página chega pronta, sem JavaScript pesado no celular.

export async function Listagem({
  caminho,
  sp,
  categoria,
  categoriaPeloEndereco,
  topo,
  termoDigitado,
}: {
  /** Endereço da própria página (para onde vão os filtros e a paginação). */
  caminho: string;
  sp: ParametrosUrl;
  /** Categoria fixa da página (/c/...) ou a escolhida no ?categoria= da busca. */
  categoria: CategoriaEncontrada | null;
  /** true = a categoria veio do caminho /c/... (não aparece na folha de filtros). */
  categoriaPeloEndereco: boolean;
  /** Título, campo de busca etc. (fica acima dos chips). */
  topo: ReactNode;
  /** Frase que a pessoa digitou quando a busca foi "entendida" (o q do endereço fica só com o que sobrou): é ela que conta na demanda. */
  termoDigitado?: string;
}) {
  const campos = categoria && !categoria.filhas.length ? categoria.categoria.campos.filter((c) => c.filtro) : [];
  const estado = lerEstadoBusca(sp, campos, !categoriaPeloEndereco);
  if (estado.categoria && !categoria) estado.erros.categoria = "Essa categoria não está disponível. Escolha outra categoria.";
  const [regiao, categorias] = await Promise.all([regiaoAtual(), categoriaPeloEndereco ? null : listarCategorias()]);
  const cidades = regiao ? await listarCidades(regiao.id) : [];
  const slugCategoria = categoria?.categoria.slug ?? null;

  const temErro = Object.keys(estado.erros).length > 0;
  const { anuncios, total, facetas } = temErro ? { anuncios: [], total: 0, facetas: null } : await buscarAnuncios({
    q: estado.q,
    categoria: slugCategoria,
    cidade: estado.cidade,
    precoMin: estado.precoMin,
    precoMax: estado.precoMax,
    filtros: estado.filtros,
    ordem: estado.ordem,
    ...(regiao?.slug && (slugCategoria === "carros" || slugCategoria === "casas")
      ? { facetas: true, regiao: regiao.slug }
      : {}),
    limite: POR_PAGINA,
    deslocamento: (estado.pagina - 1) * POR_PAGINA,
  });

  // Página além da última (link antigo, anúncios vendidos): volta para a 1ª página.
  if (!temErro && !anuncios.length && estado.pagina > 1) redirect(comParametros(caminho, sp));

  // Conta a busca digitada (só a 1ª página), depois de responder: alimenta o alerta de demanda.
  if (!temErro && (termoDigitado || estado.q) && estado.pagina === 1) {
    const termo = termoDigitado || estado.q;
    after(() => registrarBusca(termo, regiao?.id ?? null, slugCategoria, total));
  }

  // Nada achado: procura algo parecido (sem filtros; depois em outras regiões).
  let parecidos: AnuncioCard[] = [];
  let tituloParecidos = "";
  if (!temErro && total === 0 && estado.pagina === 1) {
    if (estado.cidade || estado.precoMin != null || estado.precoMax != null || Object.keys(estado.filtros).length) {
      // mesma região, mesma busca e categoria, sem cidade/preço/campos
      parecidos = (await buscarAnuncios({ q: estado.q, categoria: slugCategoria, limite: 10 })).anuncios;
      tituloParecidos = "Sem esses filtros";
    }
    if (!parecidos.length && estado.q && slugCategoria) {
      parecidos = (await buscarAnuncios({ q: estado.q, limite: 10 })).anuncios;
      tituloParecidos = `“${estado.q}” em outras categorias e cidades`;
    }
    // Aqui a região do visitante já não tem nada com essa busca/categoria (nem sem filtros):
    // o que vier sem região é mesmo de outras regiões.
    if (!parecidos.length && (estado.q || slugCategoria)) {
      parecidos = (await buscarAnuncios({ q: estado.q, categoria: slugCategoria, limite: 10, regiao: null })).anuncios;
      tituloParecidos = "Parecidos em outras regiões";
    }
  }

  const limpar =
    estado.quantos > 0 ? (estado.q ? `${caminho}?q=${encodeURIComponent(estado.q)}` : caminho) : null;
  const termoRadar = estado.q || (categoria ? categoria.categoria.nome : "");

  return (
    <main data-comprador={caminho === "/busca" ? "" : undefined} className={`mx-auto flex w-full max-w-6xl flex-col md:gap-4 md:px-4 md:py-4 ${caminho === "/busca" ? "gap-1.5 px-2.5 py-2" : "gap-4 px-4 py-4"}`}>
      {topo}
      <ResultadosBusca
        caminho={caminho}
        sp={sp}
        estado={estado}
        campos={campos}
        facetas={facetas}
        cidades={cidades}
        categorias={categorias ?? undefined}
        nomeCategoria={categoria?.categoria.nome ?? null}
        lugar={lugarDaRegiao(regiao)}
        anuncios={anuncios}
        total={total}
        vazio={<VazioBusca termo={termoRadar} limparHref={limpar} filtros={{ categoria: slugCategoria, cidade: estado.cidade, precoMin: estado.precoMinTexto, precoMax: estado.precoMaxTexto }} />}
      />
      {parecidos.length > 0 && (
        <section aria-labelledby="titulo-parecidos" className="flex flex-col gap-3">
          <h2 id="titulo-parecidos" className="text-lg font-semibold">
            {tituloParecidos}
          </h2>
          <GradeAnuncios anuncios={parecidos} prioridade={0} compacto={caminho === "/busca"} voltarHref={caminho === "/busca" ? comParametros(caminho, sp, { pagina: estado.pagina > 1 ? String(estado.pagina) : null }) : undefined} />
        </section>
      )}
    </main>
  );
}
