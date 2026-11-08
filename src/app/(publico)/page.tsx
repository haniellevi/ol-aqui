import type { Metadata } from "next";
import Link from "next/link";
import { Ellipsis, Radar } from "lucide-react";
import { listarCategorias } from "@/lib/dados/categorias";
import { buscarAnuncios } from "@/lib/dados/anuncios";
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
import { destaquesHome } from "@/lib/dados/destaques";
import { linkCategoria } from "@/lib/formato";
import { blocosHome } from "@/lib/dados/paginas";
import { LINK_AJUDA, LINK_PRIVACIDADE, LINK_TERMOS, linkPedirRadar } from "@/lib/rotas";
import type { BlocoHome } from "@/lib/tipos-paginas";

// T2 · Início: busca grande, categorias, "Destaques perto de você" (tipo home, pago),
// "Lojas em destaque" (tipo loja, pago), faixa do Radar, lojas da região e os mais recentes.
// Todo lugar pago mostra "Patrocinado". Tudo montado no servidor (pouco JavaScript no celular).
// Busca e categorias ficam sempre no topo; a ordem, o liga/desliga e os textos dos outros blocos
// vêm do painel (tela 12, tabela home_blocos). Os blocos pagos e os "mais recentes" não desligam.

const POR_VEZ = 24;

/** Texto do painel (ou o de sempre, se vazio). "{lugar}" vira o nome da cidade/região. */
function textoDe(doPainel: BlocoHome["titulo"], padrao: string, lugar: string) {
  return (doPainel ?? padrao).replaceAll("{lugar}", lugar);
}

export async function generateMetadata(): Promise<Metadata> {
  const lugar = lugarDaRegiao(await regiaoAtual());
  return {
    title: { absolute: `OLAKI · Compre e venda em ${lugar}` },
    description: `Classificados e lojas de ${lugar}. Ache carro, moto, casa, gado, móveis e serviços e chame o vendedor no WhatsApp.`,
    alternates: { canonical: "/" },
  };
}

export default async function Inicio() {
  const [regiao, categorias, recentes, blocos] = await Promise.all([
    regiaoAtual(),
    listarCategorias(),
    buscarAnuncios({ ordem: "recentes", limite: POR_VEZ }),
    blocosHome(),
  ]);
  const lugar = lugarDaRegiao(regiao);
  // Carrossel: só o tipo "Vitrine da página inicial" da região (vagas limitadas, rodízio justo no banco).
  // "Destaque na busca" continua no topo da grade, com "Patrocinado", como na busca.
  const destaques = regiao ? await destaquesHome(regiao.id) : [];
  const normais = recentes.anuncios;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-4">
      <h1 className="sr-only">OLAKI: compre e venda em {lugar}</h1>
      <CampoBusca rotuloVisivel id="busca-inicio" />

      {categorias.length > 0 && (
        <nav aria-label="Categorias" className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none]">
          <ul className="flex gap-1">
            {categorias.map((c) => (
              <li key={c.id} className="w-[76px] shrink-0">
                <Link
                  href={linkCategoria(c.slug)}
                  className="flex flex-col items-center gap-1 rounded-card px-1 py-1.5 text-center text-[13px] font-semibold leading-[18px] hover:bg-cartao focus-visible:outline-3 focus-visible:outline-laranja-escuro"
                >
                  <CirculoCategoria nome={c.icone} />
                  <span className="line-clamp-2">{c.nome}</span>
                </Link>
              </li>
            ))}
            <li className="w-[76px] shrink-0">
              <Link
                href="/categorias"
                className="flex flex-col items-center gap-1 rounded-card px-1 py-1.5 text-center text-[13px] font-semibold leading-[18px] hover:bg-cartao focus-visible:outline-3 focus-visible:outline-laranja-escuro"
              >
                <span className="grid size-12 place-items-center rounded-full border-2 border-borda bg-cartao text-beringela">
                  <Ellipsis className="size-6" aria-hidden />
                </span>
                <span>Todas</span>
              </Link>
            </li>
          </ul>
        </nav>
      )}

      {blocos
        .filter((b) => b.ativo)
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
                <LojasEmDestaque key={bloco.chave} microrregiaoId={regiao.id} titulo={textoDe(bloco.titulo, "Lojas em destaque", lugar)} />
              ) : null;

            case "radar":
              return (
                <section
                  key={bloco.chave}
                  aria-labelledby="titulo-radar"
                  className="flex flex-col gap-3 rounded-card bg-laranja-claro p-4 sm:flex-row sm:items-center"
                >
                  <div className="flex flex-1 gap-3">
                    <Radar className="mt-0.5 size-7 shrink-0 text-laranja-escuro" aria-hidden />
                    <div className="flex flex-col gap-1">
                      <h2 id="titulo-radar" className="text-lg font-semibold">
                        {textoDe(bloco.titulo, "Não achou o que queria?", lugar)}
                      </h2>
                      <p className="text-base">{textoDe(bloco.texto, "Diga o que procura no Radar e as lojas da região te chamam.", lugar)}</p>
                    </div>
                  </div>
                  {/* Um botão principal por tela: o laranja da home é o "Buscar" (ou o "Anunciar agora" da tela vazia) */}
                  <Botao href={linkPedirRadar()} variante="secundario" className="sm:w-auto" larguraTotal>
                    {textoDe(bloco.botao, "Pedir no Radar", lugar)}
                  </Botao>
                </section>
              );

            case "lojas_regiao":
              return regiao ? (
                <LojasDaRegiao key={bloco.chave} microrregiaoId={regiao.id} lugar={lugar} titulo={textoDe(bloco.titulo, "Lojas de {lugar}", lugar)} />
              ) : null;

            case "recentes":
              return (
                <section key={bloco.chave} aria-labelledby="titulo-recentes" className="flex flex-col gap-3">
                  <h2 id="titulo-recentes" className="text-lg font-semibold">
                    {textoDe(bloco.titulo, "Mais recentes em {lugar}", lugar)}
                  </h2>
                  <GradeAnuncios
                    anuncios={normais}
                    prioridade={destaques.length ? 0 : 2}
                    vazio={
                      <Vazio
                        titulo="Ainda não tem anúncio por aqui."
                        texto={textoDe(bloco.texto, "Seja o primeiro: anunciar é rápido e você recebe as conversas no WhatsApp.", lugar)}
                      >
                        <Botao href="/anunciar" larguraTotal>
                          Anunciar agora
                        </Botao>
                        <Botao href="/radar/pedir" variante="secundario" larguraTotal>
                          Pedir no Radar
                        </Botao>
                      </Vazio>
                    }
                  />
                  {recentes.total > recentes.anuncios.length && (
                    <Botao href="/busca?ordem=recentes&pagina=2" variante="secundario" className="self-center">
                      Ver mais anúncios
                    </Botao>
                  )}
                </section>
              );

            default:
              return null;
          }
        })}

      <nav aria-label="Ajuda e textos" className="flex flex-wrap justify-center gap-x-4 border-t border-borda pt-2 text-[15px]">
        <Link href={LINK_AJUDA} className="inline-flex min-h-12 items-center font-semibold text-laranja-escuro underline-offset-4 hover:underline">
          Ajuda e segurança
        </Link>
        <Link href={LINK_TERMOS} className="inline-flex min-h-12 items-center text-texto-suave underline-offset-4 hover:underline">
          Termos de uso
        </Link>
        <Link href={LINK_PRIVACIDADE} className="inline-flex min-h-12 items-center text-texto-suave underline-offset-4 hover:underline">
          Privacidade
        </Link>
      </nav>
    </main>
  );
}
