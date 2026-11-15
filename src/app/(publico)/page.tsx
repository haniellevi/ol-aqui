import { formatarNome } from "@/lib/formatar-nome";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { auth } from "@clerk/nextjs/server";
import { ArrowDownWideNarrow, Clock, Heart, MapPin, Tag } from "lucide-react";
import { listarCategorias, totaisCategorias } from "@/lib/dados/categorias";
import { arvoreComAnuncios, enxugarArvore } from "@/lib/categorias-arvore";
import { MenuCategoriasInicio } from "@/components/categorias/menu-categorias-inicio";
import { anunciosCatalogo } from "@/lib/dados/catalogo";
import { buscarAnuncios } from "@/lib/dados/anuncios";
import { favoritosEntre } from "@/lib/dados/favoritos";
import { regiaoAtual } from "@/lib/dados/regiao";
import { EntradaAssistente } from "@/components/assistente/entrada";
import { CampoBusca } from "@/components/busca/campo-busca";
import { lugarDaRegiao } from "@/components/busca/parametros";
import { CoracaoCard } from "@/components/anuncio/coracao-card";
import { GradeAnuncios } from "@/components/anuncio/grade-anuncios";
import { SalvarAoVoltar } from "@/components/anuncio/salvar-ao-voltar";
import { VistosRecentemente } from "@/components/anuncio/vistos-recentemente";
import { Botao } from "@/components/ui/botao";
import { Chip } from "@/components/ui/chip";
import { Vazio } from "@/components/ui/vazio";
import { LojasDaRegiao } from "@/components/vitrine/lojas-da-regiao";
import { LojasEmDestaque } from "@/components/destaques/lojas-em-destaque";
import { blocosHome } from "@/lib/dados/paginas";
import { CriarAnuncioInicio, RadarInicio } from "@/components/paginas/acoes-inicio";
import { RodapeInicio } from "@/components/paginas/rodape-inicio";
import { linkPedirRadar } from "@/lib/rotas";
import type { AnuncioCard } from "@/lib/tipos";
import type { BlocoHome } from "@/lib/tipos-paginas";
import estilos from "./inicio.module.css";

// As categorias ficam na busca. O Radar explica o pedido na lateral ou acima dos filtros no celular.
const POR_VEZ = 24;
const ATE_CENTAVOS = 10000; // "Até R$ 100"

type Filtros = { minha: boolean; ate: boolean; menorPreco: boolean };
type Params = { pagina?: string; cidade?: string; ate?: string; ordem?: string; salvar?: string };

/** Texto do painel (ou o de sempre, se vazio). "{lugar}" vira o nome da cidade/região. */
function textoDe(doPainel: BlocoHome["titulo"], padrao: string, lugar: string) {
  return (doPainel ?? padrao).replaceAll("{lugar}", lugar);
}

/** Endereço do Início com os filtros dados (sempre volta para a 1ª página). */
function linkFiltros(f: Filtros) {
  const p = new URLSearchParams();
  if (f.minha) p.set("cidade", "minha");
  if (f.ate) p.set("ate", "100");
  if (f.menorPreco) p.set("ordem", "menor_preco");
  return p.size ? `/?${p}` : "/";
}

export async function generateMetadata(): Promise<Metadata> {
  const lugar = lugarDaRegiao(await regiaoAtual());
  return {
    title: { absolute: `Mercado da Região · Compre e venda em ${lugar}` },
    description: `Classificados e lojas de ${lugar}. Ache carro, moto, casa, gado, móveis e serviços e chame o vendedor no WhatsApp.`,
    alternates: { canonical: "/" },
  };
}

export default async function Inicio({ searchParams }: { searchParams: Promise<Params> }) {
  const [regiao, todasCategorias, blocos, params, { userId }] = await Promise.all([
    regiaoAtual(), listarCategorias(), blocosHome(), searchParams, auth(),
  ]);
  // Para quem procura: só categorias com anúncio na região, as com mais anúncios primeiro.
  // Sem a contagem (banco fora do ar), mostra todas na ordem do painel.
  // Região sem nenhum anúncio ainda: esconder tudo não ajuda, então mostra todas.
  const contagem = regiao ? await totaisCategorias(regiao.id) : null;
  const totais = contagem?.size ? contagem : null;
  const categorias = enxugarArvore(arvoreComAnuncios(todasCategorias, totais));
  const logado = !!userId;
  const pagina = typeof params.pagina === "string" && /^\d{1,4}$/.test(params.pagina) ? Math.max(1, Number(params.pagina)) : 1;
  const lugar = lugarDaRegiao(regiao);
  const cidade = regiao?.cidade ?? regiao?.cidadeSede ?? null;
  const filtros: Filtros = {
    minha: params.cidade === "minha" && !!cidade,
    ate: params.ate === "100",
    menorPreco: params.ordem === "menor_preco",
  };
  const filtrando = filtros.minha || filtros.ate || filtros.menorPreco;

  const [normais, destaques] = regiao ? await Promise.all([
    filtrando
      ? buscarAnuncios({
          cidade: filtros.minha ? cidade : null,
          precoMax: filtros.ate ? ATE_CENTAVOS : null,
          ordem: filtros.menorPreco ? "menor_preco" : "recentes",
          limite: POR_VEZ,
          deslocamento: (pagina - 1) * POR_VEZ,
        }).then((r) => r.anuncios)
      : anunciosCatalogo(regiao, "feed", POR_VEZ, null, (pagina - 1) * POR_VEZ),
    anunciosCatalogo(regiao, "patrocinados", 12),
  ]) : [[], []];
  const total = Number(normais[0]?.total ?? 0);
  const salvosLidos = await favoritosEntre([...normais, ...destaques].map((a) => a.id), userId);
  const salvos = salvosLidos ?? new Set<string>(); // falha de leitura: corações vazios, salvar continua funcionando
  const coracao = (a: Pick<AnuncioCard, "id" | "titulo">) => (
    <CoracaoCard anuncioId={a.id} titulo={formatarNome(a.titulo)} logado={logado} inicial={salvos.has(a.id)} />
  );

  const ativos = blocos.filter((b) => b.ativo);
  const radar = ativos.find((b) => b.chave === "radar");
  const chamadaRadar = radar ? {
    titulo: textoDe(["Não achou?", "Não achou o que queria?"].includes(radar.titulo ?? "") ? null : radar.titulo, "Procurando algo?", lugar),
    texto: textoDe([
      "Diga o que procura no Radar e as lojas da região te chamam.",
      "Conte o que procura. As lojas podem enviar propostas, e você escolhe com quem conversar.",
      "Diga o que precisa. As lojas da região te respondem.",
    ].includes(radar.texto ?? "") ? null : radar.texto, "Diga o que você procura. Lojas da região podem responder com ofertas.", lugar),
    botao: textoDe(["Estou procurando…", "Estou procurando..."].includes(radar.botao ?? "") ? null : radar.botao, "Pedir no Radar", lugar),
  } : null;
  const blocoLojas = regiao ? ativos.find((b) => b.chave === "lojas_regiao") : undefined;
  const tituloAnterior = blocoLojas?.titulo ?? null;
  const tituloLojas = textoDe(
    ["LOJAS DESTAQUE DA REGIÃO", "Lojas de {lugar}", "Lojas da região"].includes(tituloAnterior ?? "") ? null : tituloAnterior,
    "DESTAQUES DA REGIÃO",
    lugar,
  );
  const base = linkFiltros(filtros);
  const voltarHref = pagina > 1 ? `${base}${base.includes("?") ? "&" : "?"}pagina=${pagina}` : base;
  const linkPagina = (n: number) => {
    if (n <= 1) return `${base}#anuncios`;
    return `${base}${base.includes("?") ? "&" : "?"}pagina=${n}#anuncios`;
  };

  return (
    <div data-comprador data-inicio className={estilos.fundo}>
      <div className="border-b border-borda bg-cartao">
        <div className="mx-auto flex w-full max-w-7xl items-center gap-2 px-4 py-2 sm:gap-3">
          <MenuCategoriasInicio categorias={categorias.map(({ id, slug, nome, icone }) => ({ id, slug, nome, icone }))} />
          <div className="min-w-0 flex-1">
            <CampoBusca id="busca-inicio" sugestoes regiao={regiao?.slug} />
          </div>
          <CriarAnuncioInicio />
        </div>
      </div>

      <div className="mx-auto w-full max-w-7xl px-4 [&:not(:empty)]:pt-2">
        <EntradaAssistente dono={userId} />
      </div>

      <main className="mx-auto grid w-full max-w-7xl items-start gap-3 px-4 py-3 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-x-4">
        <Suspense fallback={null}>
          <SalvarAoVoltar logado={logado} />
        </Suspense>

        <div className="flex min-w-0 flex-col gap-3 lg:col-start-2 lg:row-start-1">
          {regiao && blocoLojas ? (
            <LojasDaRegiao regiao={regiao} arvore={enxugarArvore(todasCategorias)} titulo={tituloLojas} />
          ) : (
            <Botao href="/lojas" variante="secundario" tamanho="toque" className="self-start">Ver todas as lojas</Botao>
          )}
        </div>

        <aside className={`${chamadaRadar ? "flex" : "hidden lg:flex"} min-w-0 flex-col gap-3 lg:sticky lg:top-20 lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:self-start`}>
          {chamadaRadar && <RadarInicio {...chamadaRadar} />}
          <nav aria-labelledby="titulo-atalhos" className="hidden rounded-card border border-borda bg-cartao p-2 lg:block">
            <h2 id="titulo-atalhos" className="px-2 pt-1 pb-1 text-legenda font-semibold tracking-wide text-texto-suave uppercase">Para você</h2>
            <ul className="flex flex-col">
              <li><Link href="/minha-conta/favoritos" className={estilos.itemLado}><Heart className="size-5 shrink-0 text-beringela" aria-hidden />Favoritos</Link></li>
              <li><a href="#vistos" className={estilos.itemLado}><Clock className="size-5 shrink-0 text-beringela" aria-hidden />Vistos há pouco</a></li>
              <li><Link href="/minha-conta/anuncios" className={estilos.itemLado}><Tag className="size-5 shrink-0 text-beringela" aria-hidden />Meus anúncios</Link></li>
              <li><Link href="/cidades" className={estilos.itemLado}><MapPin className="size-5 shrink-0 text-beringela" aria-hidden />Trocar cidade</Link></li>
            </ul>
          </nav>
        </aside>

        <div className="flex min-w-0 flex-col gap-3 lg:col-start-2 lg:row-start-2">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <h1 id="titulo-inicio" className="text-titulo font-semibold text-balance text-beringela">
                Anúncios em {lugar}
              </h1>
              {total > 0 && <p className="text-legenda text-texto-suave">{total.toLocaleString("pt-BR")} {total === 1 ? "anúncio" : "anúncios"}</p>}
            </div>
            <div role="group" aria-label="Filtros rápidos" className="flex flex-wrap gap-2">
              {cidade && (
                <Chip href={linkFiltros({ ...filtros, minha: !filtros.minha })} ativo={filtros.minha} tamanho="toque" icone={<MapPin />} scroll={false}>
                  Só em {formatarNome(cidade)}
                </Chip>
              )}
              <Chip href={linkFiltros({ ...filtros, ate: !filtros.ate })} ativo={filtros.ate} tamanho="toque" scroll={false}>
                Até R$ 100
              </Chip>
              <Chip href={linkFiltros({ ...filtros, menorPreco: !filtros.menorPreco })} ativo={filtros.menorPreco} tamanho="toque" icone={<ArrowDownWideNarrow />} scroll={false}>
                Menor preço
              </Chip>
              {filtrando && (
                <Link href="/" scroll={false} className="inline-flex min-h-toque shrink-0 items-center rounded-campo px-2 text-rotulo font-semibold text-laranja-escuro underline-offset-4 hover:underline focus-visible:outline-3 focus-visible:outline-laranja-escuro">
                  Limpar filtros
                </Link>
              )}
            </div>
          </div>

          {ativos.map((bloco) => {
            switch (bloco.chave) {
              case "destaques":
                return destaques.length > 0 ? (
                  <section key={bloco.chave} aria-labelledby="titulo-destaques" className={`flex flex-col gap-2 ${estilos.faixaPaga}`}>
                    <h2 id="titulo-destaques" className="text-lg font-semibold">
                      {textoDe(bloco.titulo, "Destaques perto de você", lugar)}
                    </h2>
                    <GradeAnuncios anuncios={destaques} acao={coracao} compacto voltarHref={voltarHref} className={estilos.trilhoDestaques} />
                  </section>
                ) : null;

              case "lojas_destaque":
                return regiao ? (
                  <div key={bloco.chave} className="min-w-0 [&:empty]:hidden"><LojasEmDestaque regiao={regiao} titulo={textoDe(bloco.titulo, "Lojas em destaque", lugar)} /></div>
                ) : null;

              case "radar":
                return null;

              case "lojas_regiao":
                return null;

              case "recentes":
                return (
                  <div key={bloco.chave} className="flex flex-col gap-3">
                    <section id="anuncios" aria-labelledby="titulo-recentes" className="flex scroll-mt-20 flex-col gap-3">
                      <h2 id="titulo-recentes" className={`text-lg font-semibold ${filtrando ? "" : "max-md:sr-only"}`}>
                        {filtrando
                          ? filtros.menorPreco ? "Menor preço primeiro" : "Anúncios com esses filtros"
                          : textoDe(bloco.titulo, "Mais recentes em {lugar}", lugar)}
                      </h2>
                      <GradeAnuncios
                        anuncios={normais}
                        prioridade={destaques.length ? 0 : 2}
                        acao={coracao}
                        medirEm="inicio"
                        compacto
                        voltarHref={voltarHref}
                        className="xl:grid-cols-4"
                        vazio={
                          filtrando ? (
                            <Vazio
                              className={estilos.vazio}
                              titulo="Nada com esses filtros"
                              texto="Tire um filtro para ver mais anúncios."
                            >
                              <Botao href="/" variante="secundario" tamanho="toque" larguraTotal>Limpar filtros</Botao>
                              {radar && <Botao href={linkPedirRadar()} tamanho="toque" larguraTotal>Pedir no Radar</Botao>}
                            </Vazio>
                          ) : (
                            <Vazio
                              className={estilos.vazio}
                              titulo="Seu anúncio pode ser o primeiro"
                              texto={textoDe(bloco.texto, "Seja o primeiro: anunciar é rápido e você recebe as conversas no WhatsApp.", lugar)}
                            >
                              <Botao href="/anunciar" variante="secundario" larguraTotal>
                                Anunciar agora
                              </Botao>
                            </Vazio>
                          )
                        }
                      />
                      <div className="flex flex-wrap justify-center gap-3">
                        {pagina > 1 && <Botao href={linkPagina(pagina - 1)} variante="secundario">Anterior</Botao>}
                        {total > pagina * POR_VEZ && pagina < 9999 && (
                          <Botao href={linkPagina(pagina + 1)} variante="secundario">Ver mais anúncios</Botao>
                        )}
                      </div>
                    </section>
                    {!filtrando && <div className="[&:empty]:hidden"><VistosRecentemente voltarHref={voltarHref} /></div>}
                  </div>
                );

              default:
                return null;
            }
          })}

          <RodapeInicio />
        </div>
      </main>
    </div>
  );
}
