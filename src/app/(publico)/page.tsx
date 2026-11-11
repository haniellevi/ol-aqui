import type { Metadata } from "next";
import Link from "next/link";
import { Ellipsis, Radar } from "lucide-react";
import { listarCategorias } from "@/lib/dados/categorias";
import { anunciosCatalogo } from "@/lib/dados/catalogo";
import { regiaoAtual } from "@/lib/dados/regiao";
import { CampoBusca } from "@/components/busca/campo-busca";
import { lugarDaRegiao } from "@/components/busca/parametros";
import { CardAnuncio } from "@/components/anuncio/card-anuncio";
import { GradeAnuncios } from "@/components/anuncio/grade-anuncios";
import { CirculoCategoria } from "@/components/ui/icone-categoria";
import { Botao } from "@/components/ui/botao";
import { Vazio } from "@/components/ui/vazio";
import { LojasDaRegiao } from "@/components/vitrine/lojas-da-regiao";
import { LojasEmDestaque } from "@/components/destaques/lojas-em-destaque";
import { linkCategoria } from "@/lib/formato";
import { blocosHome, minimoAnunciosInicio } from "@/lib/dados/paginas";
import { PortasInicio } from "@/components/paginas/portas-inicio";
import { RodapeInicio } from "@/components/paginas/rodape-inicio";
import { linkPedirRadar } from "@/lib/rotas";
import type { BlocoHome } from "@/lib/tipos-paginas";
import estilos from "./inicio.module.css";

// T2 · Início: busca grande, categorias, "Destaques perto de você" (tipo home, pago),
// "Lojas em destaque" (tipo loja, pago), faixa do Radar, lojas da região e os mais recentes.
// Todo lugar pago mostra "Patrocinado". Tudo montado no servidor (pouco JavaScript no celular).
// Busca e categorias ficam sempre no topo; a ordem, o liga/desliga e os textos dos outros blocos
// vêm do painel (tela 12, tabela home_blocos). Os blocos pagos e os "mais recentes" não desligam.

const POR_VEZ = 24;
/** Abaixo deste total de anúncios a home fica "no começo" (duas portas no lugar da prateleira vazia).
 *  Pode mudar pela configuração pública "home.comeco_min_anuncios" (lida pela tabela: vale também para visitante). */
const MIN_ANUNCIOS_PADRAO = 8;

/** Texto do painel (ou o de sempre, se vazio). "{lugar}" vira o nome da cidade/região. */
function textoDe(doPainel: BlocoHome["titulo"], padrao: string, lugar: string) {
  return (doPainel ?? padrao).replaceAll("{lugar}", lugar);
}

export async function generateMetadata(): Promise<Metadata> {
  const lugar = lugarDaRegiao(await regiaoAtual());
  return {
    title: { absolute: `Mercado da Região · Compre e venda em ${lugar}` },
    description: `Classificados e lojas de ${lugar}. Ache carro, moto, casa, gado, móveis e serviços e chame o vendedor no WhatsApp.`,
    alternates: { canonical: "/" },
  };
}

export default async function Inicio({ searchParams }: { searchParams: Promise<{ pagina?: string }> }) {
  const [regiao, categorias, blocos, params] = await Promise.all([
    regiaoAtual(), listarCategorias(), blocosHome(), searchParams,
  ]);
  const pagina = typeof params.pagina === "string" && /^\d{1,4}$/.test(params.pagina) ? Math.max(1, Number(params.pagina)) : 1;
  const lugar = lugarDaRegiao(regiao);
  const blocosAtivos = blocos.filter((bloco) => bloco.ativo);
  const exibeLojasDaRegiao = regiao && blocosAtivos.some((bloco) => bloco.chave === "lojas_regiao");
  const [normais, destaques] = regiao ? await Promise.all([
    anunciosCatalogo(regiao, "feed", POR_VEZ, null, (pagina - 1) * POR_VEZ),
    anunciosCatalogo(regiao, "patrocinados", 12),
  ]) : [[], []];
  const minimo = (regiao ? await minimoAnunciosInicio(regiao.id) : null) ?? MIN_ANUNCIOS_PADRAO;
  const comeco = pagina === 1 && Number(normais[0]?.total ?? 0) < minimo;
  const cidade = regiao ? regiao.cidade ?? regiao.cidadeSede : null;
  const blocoRadar = blocosAtivos.find((bloco) => bloco.chave === "radar");
  const blocoRecentes = blocosAtivos.find((bloco) => bloco.chave === "recentes");

  const navCategorias = categorias.length > 0 && (
        <nav aria-label="Categorias">
          <ul className="grid grid-cols-4 gap-x-1 gap-y-2 min-[400px]:grid-cols-5 lg:grid-cols-10">
            {categorias.map((c) => (
              <li key={c.id} className="min-w-0">
                <Link
                  href={linkCategoria(c.slug)}
                  className="flex h-full flex-col items-center gap-1 rounded-card px-1 py-2 text-center text-legenda leading-4 font-medium hover:bg-cartao focus-visible:outline-3 focus-visible:outline-laranja-escuro"
                >
                  <CirculoCategoria nome={c.icone} className={estilos.categoria} />
                  <span className="max-w-full break-words hyphens-auto">{c.nome}</span>
                </Link>
              </li>
            ))}
            <li className="min-w-0">
              <Link
                href="/categorias"
                className="flex h-full flex-col items-center gap-1 rounded-card px-1 py-2 text-center text-legenda leading-4 font-medium hover:bg-cartao focus-visible:outline-3 focus-visible:outline-laranja-escuro"
              >
                <span className="grid size-10 place-items-center rounded-full border border-borda bg-cartao text-beringela">
                  <Ellipsis className="size-6" aria-hidden />
                </span>
                <span>Todas</span>
              </Link>
            </li>
          </ul>
        </nav>
  );

  return (
    <div className={estilos.fundo}>
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-4">
      <section aria-labelledby="titulo-inicio" className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <h1 id="titulo-inicio" className="text-vitrine font-semibold text-balance text-beringela">
            Compre e venda em {lugar}
          </h1>
        </div>
        <CampoBusca id="busca-inicio" />
        {!exibeLojasDaRegiao && (
          <Botao href="/lojas" variante="secundario" className="self-start">Ver todas as lojas</Botao>
        )}
      </section>

      {comeco && (
        <PortasInicio
          radar={blocoRadar ? {
            titulo: textoDe(blocoRadar.titulo, "Procurando alguma coisa?", lugar),
            texto: textoDe(blocoRadar.texto, "Peça no Radar. As lojas da região respondem e você escolhe com quem conversar.", lugar),
            botao: textoDe(blocoRadar.botao, "Pedir no Radar", lugar),
          } : null}
          textoVender={textoDe(blocoRecentes?.texto ?? null, "Seu anúncio aparece para quem mora perto, e a conversa chega no seu WhatsApp.", lugar)}
          cidade={cidade}
          venderPrimeiro={Boolean(blocoRadar && blocoRecentes && blocosAtivos.indexOf(blocoRecentes) < blocosAtivos.indexOf(blocoRadar))}
        />
      )}

      {comeco && categorias.length > 0 && <h2 className="-mb-2 text-lg font-semibold">Veja por categoria</h2>}
      {navCategorias}

      {blocosAtivos
        .map((bloco) => {
          switch (bloco.chave) {
            case "destaques":
              return destaques.length > 0 ? (
                <section key={bloco.chave} aria-labelledby="titulo-destaques" className="flex flex-col gap-3">
                  <h2 id="titulo-destaques" className="text-lg font-semibold">
                    {textoDe(bloco.titulo, "Destaques perto de você", lugar)}
                  </h2>
                  <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
                    {destaques.map((a, i) => (
                      <li key={a.id} className="flex w-[46%] max-w-56 shrink-0 snap-start sm:w-56">
                        <div className="flex w-full flex-col [&>article]:flex-1">
                          <CardAnuncio anuncio={a} prioridade={i < 2} />
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
              // No começo, o Radar já está na primeira tela (porta "comprar").
              return comeco ? null : (
                <section
                  key={bloco.chave}
                  aria-labelledby="titulo-radar"
                  className="flex flex-col gap-4 rounded-card bg-beringela p-5 text-white sm:flex-row sm:items-center sm:p-6"
                >
                  <div className="flex flex-1 gap-3">
                    <Radar className="mt-0.5 size-7 shrink-0 text-laranja" aria-hidden />
                    <div className="flex flex-col gap-1">
                      <h2 id="titulo-radar" className="text-lg font-semibold">
                        {textoDe(bloco.titulo, "Não achou o que queria?", lugar)}
                      </h2>
                      <p className="text-base text-pretty text-white/85">{textoDe(bloco.texto, "Conte o que procura. As lojas podem enviar propostas, e você escolhe com quem conversar.", lugar)}</p>
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
                <section id="anuncios" key={bloco.chave} aria-labelledby="titulo-recentes" className="flex flex-col gap-3">
                  <h2 id="titulo-recentes" className="text-lg font-semibold">
                    {textoDe(bloco.titulo, "Mais recentes em {lugar}", lugar)}
                  </h2>
                  <GradeAnuncios
                    anuncios={normais}
                    prioridade={destaques.length ? 0 : 2}
                    vazio={
                      <Vazio
                        className={estilos.vazio}
                        titulo="Seu anúncio pode ser o primeiro"
                        texto={textoDe(bloco.texto, "Seja o primeiro: anunciar é rápido e você recebe as conversas no WhatsApp.", lugar)}
                      >
                        <Botao href="/anunciar" variante="secundario" larguraTotal>
                          Anunciar agora
                        </Botao>
                      </Vazio>
                    }
                  />
                  <div className="flex flex-wrap justify-center gap-3">
                    {pagina > 1 && <Botao href={pagina === 2 ? "/#anuncios" : `/?pagina=${pagina - 1}#anuncios`} variante="secundario">Anterior</Botao>}
                    {(Number(normais[0]?.total ?? 0) > pagina * POR_VEZ && pagina < 9999) && (
                      <Botao href={`/?pagina=${pagina + 1}#anuncios`} variante="secundario">Ver mais anúncios</Botao>
                    )}
                  </div>
                </section>
              );

            default:
              return null;
          }
        })}

      <RodapeInicio />
    </main>
    </div>
  );
}
