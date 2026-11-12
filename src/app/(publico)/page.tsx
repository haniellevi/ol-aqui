import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { auth } from "@clerk/nextjs/server";
import { ArrowDownWideNarrow, Clock, Heart, LayoutGrid, MapPin, Plus, Radar, Store, Tag } from "lucide-react";
import { listarCategorias, totaisCategorias } from "@/lib/dados/categorias";
import { arvoreComAnuncios, enxugarArvore } from "@/lib/categorias-arvore";
import { FaixaCategorias } from "@/components/categorias/faixa-categorias";
import { anunciosCatalogo } from "@/lib/dados/catalogo";
import { buscarAnuncios } from "@/lib/dados/anuncios";
import { favoritosEntre } from "@/lib/dados/favoritos";
import { regiaoAtual } from "@/lib/dados/regiao";
import { CampoBusca } from "@/components/busca/campo-busca";
import { lugarDaRegiao } from "@/components/busca/parametros";
import { CardAnuncio } from "@/components/anuncio/card-anuncio";
import { CoracaoCard } from "@/components/anuncio/coracao-card";
import { GradeAnuncios } from "@/components/anuncio/grade-anuncios";
import { SalvarAoVoltar } from "@/components/anuncio/salvar-ao-voltar";
import { VistosRecentemente } from "@/components/anuncio/vistos-recentemente";
import { IconeCategoria } from "@/components/ui/icone-categoria";
import { Botao } from "@/components/ui/botao";
import { Chip } from "@/components/ui/chip";
import { Vazio } from "@/components/ui/vazio";
import { LojasDaRegiao } from "@/components/vitrine/lojas-da-regiao";
import { LojasEmDestaque } from "@/components/destaques/lojas-em-destaque";
import { linkCategoria } from "@/lib/formato";
import { blocosHome, minimoAnunciosInicio } from "@/lib/dados/paginas";
import { PortasInicio } from "@/components/paginas/portas-inicio";
import { RodapeInicio } from "@/components/paginas/rodape-inicio";
import { linkPedirRadar } from "@/lib/rotas";
import type { AnuncioCard } from "@/lib/tipos";
import type { BlocoHome } from "@/lib/tipos-paginas";
import estilos from "./inicio.module.css";

// T2 · Início em 3 colunas (computador) e 1 coluna (celular), pensado para quem procura.
// Esquerda: categorias e atalhos. Meio: título curto, filtros rápidos, destaques pagos,
// "Você viu há pouco" e os anúncios em grade. Direita: Anunciar, Radar e lojas.
// Filtros vão pelo endereço (?cidade=minha&ate=100&ordem=menor_preco): funcionam sem JavaScript.
// A ordem, o liga/desliga e os textos dos blocos seguem vindo do painel (tabela home_blocos).
// Todo lugar pago mostra "Patrocinado". Os blocos pagos e os "mais recentes" não desligam.

const POR_VEZ = 24;
const ATE_CENTAVOS = 10000; // "Até R$ 100"
/** Abaixo deste total de anúncios a home fica "no começo" (duas portas no lugar da prateleira vazia).
 *  Pode mudar pela configuração pública "home.comeco_min_anuncios". */
const MIN_ANUNCIOS_PADRAO = 8;

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
  const [salvosLidos, minimoLido] = await Promise.all([
    favoritosEntre([...normais, ...destaques].map((a) => a.id), userId),
    regiao ? minimoAnunciosInicio(regiao.id) : Promise.resolve(null),
  ]);
  const salvos = salvosLidos ?? new Set<string>(); // falha de leitura: corações vazios, salvar continua funcionando
  const comeco = !filtrando && pagina === 1 && total < (minimoLido ?? MIN_ANUNCIOS_PADRAO);
  const coracao = (a: Pick<AnuncioCard, "id" | "titulo">) => (
    <CoracaoCard anuncioId={a.id} titulo={a.titulo} logado={logado} inicial={salvos.has(a.id)} />
  );

  const ativos = blocos.filter((b) => b.ativo);
  const radar = ativos.find((b) => b.chave === "radar");
  const recentes = ativos.find((b) => b.chave === "recentes");
  const exibeLojasDaRegiao = regiao && ativos.some((b) => b.chave === "lojas_regiao");
  const linkPagina = (n: number) => {
    const base = linkFiltros(filtros);
    if (n <= 1) return `${base}#anuncios`;
    return `${base}${base.includes("?") ? "&" : "?"}pagina=${n}#anuncios`;
  };

  return (
    <div className={estilos.fundo}>
      {/* Celular: a busca gruda logo abaixo do cabeçalho (no computador ela está no próprio cabeçalho). */}
      <div className="sticky top-13 z-20 border-b border-borda bg-cartao/95 px-4 py-2 backdrop-blur md:hidden">
        <CampoBusca id="busca-inicio" />
      </div>

      <div className="mx-auto grid w-full max-w-7xl items-start gap-6 px-4 py-4 lg:grid-cols-[13rem_minmax(0,1fr)] xl:grid-cols-[13rem_minmax(0,1fr)_18rem]">
        {/* Coluna da esquerda: categorias e atalhos (só no computador). */}
        <aside className="sticky top-20 hidden flex-col gap-4 lg:flex">
          {categorias.length > 0 && (
            <nav aria-labelledby="titulo-cats-lado" className="rounded-card border border-borda bg-cartao p-2">
              <h2 id="titulo-cats-lado" className="px-2 pb-1 pt-1 text-legenda font-semibold uppercase tracking-wide text-texto-suave">Categorias</h2>
              <ul className="flex flex-col">
                {categorias.map((c) => (
                  <li key={c.id}>
                    <Link href={linkCategoria(c.slug)} className={estilos.itemLado}>
                      <IconeCategoria nome={c.icone} className="size-5 shrink-0 text-beringela" aria-hidden />
                      <span className="truncate">{c.nome}</span>
                    </Link>
                  </li>
                ))}
                <li>
                  <Link href="/categorias" className={estilos.itemLado}>
                    <LayoutGrid className="size-5 shrink-0 text-beringela" aria-hidden />
                    <span>Todas as categorias</span>
                  </Link>
                </li>
              </ul>
            </nav>
          )}
          <nav aria-labelledby="titulo-atalhos" className="rounded-card border border-borda bg-cartao p-2">
            <h2 id="titulo-atalhos" className="px-2 pb-1 pt-1 text-legenda font-semibold uppercase tracking-wide text-texto-suave">Para você</h2>
            <ul className="flex flex-col">
              <li><Link href="/minha-conta/favoritos" className={estilos.itemLado}><Heart className="size-5 shrink-0 text-beringela" aria-hidden />Favoritos</Link></li>
              <li><a href="#vistos" className={estilos.itemLado}><Clock className="size-5 shrink-0 text-beringela" aria-hidden />Vistos há pouco</a></li>
              <li><Link href="/minha-conta/anuncios" className={estilos.itemLado}><Tag className="size-5 shrink-0 text-beringela" aria-hidden />Meus anúncios</Link></li>
              <li><Link href="/cidades" className={estilos.itemLado}><MapPin className="size-5 shrink-0 text-beringela" aria-hidden />Trocar cidade</Link></li>
            </ul>
          </nav>
        </aside>

        {/* Meio: o feed. */}
        <main className="flex min-w-0 flex-col gap-6">
          <Suspense fallback={null}>
            <SalvarAoVoltar logado={logado} />
          </Suspense>

          <FaixaCategorias arvore={categorias} soComAnuncios={!!totais} className="lg:hidden" />

          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <h1 id="titulo-inicio" className="text-xl font-semibold text-balance text-beringela">
                Anúncios em {lugar}
              </h1>
              {total > 0 && <p className="text-legenda text-texto-suave">{total.toLocaleString("pt-BR")} {total === 1 ? "anúncio" : "anúncios"}</p>}
            </div>
            <div role="group" aria-label="Filtros rápidos" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
              {cidade && (
                <Chip href={linkFiltros({ ...filtros, minha: !filtros.minha })} ativo={filtros.minha} icone={<MapPin />} scroll={false}>
                  Só em {cidade}
                </Chip>
              )}
              <Chip href={linkFiltros({ ...filtros, ate: !filtros.ate })} ativo={filtros.ate} scroll={false}>
                Até R$ 100
              </Chip>
              <Chip href={linkFiltros({ ...filtros, menorPreco: !filtros.menorPreco })} ativo={filtros.menorPreco} icone={<ArrowDownWideNarrow />} scroll={false}>
                Menor preço
              </Chip>
              {filtrando && (
                <Link href="/" scroll={false} className="inline-flex min-h-11 shrink-0 items-center rounded-campo px-2 text-rotulo font-semibold text-laranja-escuro underline-offset-4 hover:underline focus-visible:outline-3 focus-visible:outline-laranja-escuro">
                  Limpar filtros
                </Link>
              )}
            </div>
          </div>

          {!exibeLojasDaRegiao && (
            <Botao href="/lojas" variante="secundario" className="self-start xl:hidden">Ver todas as lojas</Botao>
          )}

          {comeco && (
            <PortasInicio
              radar={radar ? {
                titulo: textoDe(radar.titulo, "Procurando alguma coisa?", lugar),
                texto: textoDe(radar.texto, "Peça no Radar. As lojas da região respondem e você escolhe com quem conversar.", lugar),
                botao: textoDe(radar.botao, "Pedir no Radar", lugar),
              } : null}
              textoVender={textoDe(recentes?.texto ?? null, "Seu anúncio aparece para quem mora perto, e a conversa chega no seu WhatsApp.", lugar)}
              cidade={cidade}
              venderPrimeiro={Boolean(radar && recentes && ativos.indexOf(recentes) < ativos.indexOf(radar))}
            />
          )}

          {ativos.map((bloco) => {
            switch (bloco.chave) {
              case "destaques":
                return destaques.length > 0 ? (
                  <section key={bloco.chave} aria-labelledby="titulo-destaques" className={`flex flex-col gap-3 ${estilos.faixaPaga}`}>
                    <h2 id="titulo-destaques" className="text-lg font-semibold">
                      {textoDe(bloco.titulo, "Destaques perto de você", lugar)}
                    </h2>
                    <ul className="-mx-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-3 pb-1 [scrollbar-width:none]">
                      {destaques.map((a, i) => (
                        <li key={a.id} className="flex w-[46%] max-w-56 shrink-0 snap-start sm:w-52">
                          <div className="flex w-full flex-col [&>article]:flex-1">
                            <CardAnuncio anuncio={a} prioridade={i < 2} acao={coracao(a)} />
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null;

              case "lojas_destaque":
                return regiao ? (
                  <LojasEmDestaque key={bloco.chave} regiao={regiao} titulo={textoDe(bloco.titulo, "Lojas em destaque", lugar)} />
                ) : null;

              case "radar":
                // No computador largo o Radar fica na coluna da direita; aqui só no celular e tablet.
                // No começo, o Radar já está na primeira tela (porta "comprar").
                return comeco ? null : (
                  <section
                    key={bloco.chave}
                    aria-labelledby="titulo-radar"
                    className="flex flex-col gap-4 rounded-card bg-beringela p-5 text-white sm:flex-row sm:items-center sm:p-6 xl:hidden"
                  >
                    <div className="flex flex-1 gap-3">
                      <Radar className="mt-0.5 size-7 shrink-0 text-laranja" aria-hidden />
                      <div className="flex flex-col gap-1">
                        <h2 id="titulo-radar" className="text-lg font-semibold">
                          {textoDe(bloco.titulo, "Não achou o que queria?", lugar)}
                        </h2>
                        <p className="text-pretty text-base text-white/85">{textoDe(bloco.texto, "Conte o que procura. As lojas podem enviar propostas, e você escolhe com quem conversar.", lugar)}</p>
                      </div>
                    </div>
                    <Botao href={linkPedirRadar()} className="focus-visible:outline-white sm:w-auto sm:shrink-0" larguraTotal>
                      {textoDe(bloco.botao, "Pedir no Radar", lugar)}
                    </Botao>
                  </section>
                );

              case "lojas_regiao":
                return regiao ? (
                  <LojasDaRegiao key={bloco.chave} regiao={regiao} lugar={lugar} titulo={textoDe(bloco.titulo, "Lojas de {lugar}", lugar)} />
                ) : null;

              case "recentes":
                // No começo, sem nenhum anúncio, a porta "vender" faz o papel da tela vazia.
                return comeco && normais.length === 0 ? null : (
                  <div key={bloco.chave} className="flex flex-col gap-6">
                    {!filtrando && <VistosRecentemente />}
                    <section id="anuncios" aria-labelledby="titulo-recentes" className="flex scroll-mt-20 flex-col gap-3">
                      <h2 id="titulo-recentes" className="text-lg font-semibold">
                        {filtrando
                          ? filtros.menorPreco ? "Menor preço primeiro" : "Anúncios com esses filtros"
                          : textoDe(bloco.titulo, "Mais recentes em {lugar}", lugar)}
                      </h2>
                      <GradeAnuncios
                        anuncios={normais}
                        prioridade={destaques.length ? 0 : 2}
                        acao={coracao}
                        medirEm="inicio"
                        className="xl:grid-cols-4"
                        vazio={
                          filtrando ? (
                            <Vazio
                              className={estilos.vazio}
                              titulo="Nada com esses filtros"
                              texto="Tire um filtro ou peça no Radar: as lojas da região podem responder com oferta."
                            >
                              <Botao href="/" variante="secundario" larguraTotal>Limpar filtros</Botao>
                              <Botao href={linkPedirRadar()} larguraTotal>Pedir no Radar</Botao>
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
                  </div>
                );

              default:
                return null;
            }
          })}

          <RodapeInicio />
        </main>

        {/* Coluna da direita: para quem quer vender (só em tela larga). */}
        <aside aria-label="Anunciar e Radar" className="sticky top-20 hidden flex-col gap-4 xl:flex">
          {!comeco && (
          <section aria-labelledby="titulo-anunciar-lado" className="flex flex-col gap-2 rounded-card bg-beringela p-4 text-white">
            <h2 id="titulo-anunciar-lado" className="text-lg font-semibold leading-snug">Tem algo parado em casa?</h2>
            <p className="text-sm text-white/85">Anuncie grátis. Quem é da região vê e chama você no WhatsApp.</p>
            <Botao href="/anunciar" icone={<Plus />} larguraTotal className="mt-1 focus-visible:outline-white">Anunciar grátis</Botao>
          </section>
          )}

          {radar && !comeco && (
            <section aria-labelledby="titulo-radar-lado" className="flex flex-col gap-2 rounded-card border border-borda bg-cartao p-4">
              <div className="flex items-center gap-2">
                <Radar className="size-5 shrink-0 text-laranja-escuro" aria-hidden />
                <h2 id="titulo-radar-lado" className="text-base font-semibold text-beringela">{textoDe(radar.titulo, "Não achou o que queria?", lugar)}</h2>
              </div>
              <p className="text-sm text-texto-suave">{textoDe(radar.texto, "Conte o que procura. As lojas podem enviar propostas, e você escolhe com quem conversar.", lugar)}</p>
              <Botao href={linkPedirRadar()} variante="secundario" larguraTotal className="mt-1">{textoDe(radar.botao, "Pedir no Radar", lugar)}</Botao>
            </section>
          )}

          <Link href="/lojas" className="flex items-center gap-3 rounded-card border border-borda bg-cartao p-4 hover:border-laranja-escuro focus-visible:outline-3 focus-visible:outline-laranja-escuro">
            <Store className="size-6 shrink-0 text-beringela" aria-hidden />
            <span className="flex min-w-0 flex-col">
              <span className="font-semibold text-beringela">Lojas de {lugar}</span>
              <span className="text-sm text-texto-suave">Veja quem vende perto de você</span>
            </span>
          </Link>
        </aside>
      </div>
    </div>
  );
}
