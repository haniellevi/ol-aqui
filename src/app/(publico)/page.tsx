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

// T2 · Início: busca grande, categorias, "Destaques perto de você" (tipo home, pago),
// "Lojas em destaque" (tipo loja, pago), faixa do Radar, lojas da região e os mais recentes.
// Todo lugar pago mostra "Patrocinado". Tudo montado no servidor (pouco JavaScript no celular).

const POR_VEZ = 24;

export async function generateMetadata(): Promise<Metadata> {
  const lugar = lugarDaRegiao(await regiaoAtual());
  return {
    title: { absolute: `OLAKI · Compre e venda em ${lugar}` },
    description: `Classificados e lojas de ${lugar}. Ache carro, moto, casa, gado, móveis e serviços e chame o vendedor no WhatsApp.`,
    alternates: { canonical: "/" },
  };
}

export default async function Inicio() {
  const [regiao, categorias, recentes] = await Promise.all([
    regiaoAtual(),
    listarCategorias(),
    buscarAnuncios({ ordem: "recentes", limite: POR_VEZ }),
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

      {destaques.length > 0 && (
        <section aria-labelledby="titulo-destaques" className="flex flex-col gap-3">
          <h2 id="titulo-destaques" className="text-lg font-semibold">
            Destaques perto de você
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
      )}

      {regiao && <LojasEmDestaque microrregiaoId={regiao.id} />}

      <section aria-labelledby="titulo-radar" className="flex flex-col gap-3 rounded-card bg-laranja-claro p-4 sm:flex-row sm:items-center">
        <div className="flex flex-1 gap-3">
          <Radar className="mt-0.5 size-7 shrink-0 text-laranja-escuro" aria-hidden />
          <div className="flex flex-col gap-1">
            <h2 id="titulo-radar" className="text-lg font-semibold">
              Não achou o que queria?
            </h2>
            <p className="text-base">Diga o que procura no Radar e as lojas da região te chamam.</p>
          </div>
        </div>
        {/* Um botão principal por tela: o laranja da home é o "Buscar" (ou o "Anunciar agora" da tela vazia) */}
        <Botao href="/radar/pedir" variante="secundario" className="sm:w-auto" larguraTotal>
          Pedir no Radar
        </Botao>
      </section>

      {regiao && <LojasDaRegiao microrregiaoId={regiao.id} lugar={lugar} />}

      <section aria-labelledby="titulo-recentes" className="flex flex-col gap-3">
        <h2 id="titulo-recentes" className="text-lg font-semibold">
          Mais recentes em {lugar}
        </h2>
        <GradeAnuncios
          anuncios={normais}
          prioridade={destaques.length ? 0 : 2}
          vazio={
            <Vazio
              titulo="Ainda não tem anúncio por aqui."
              texto="Seja o primeiro: anunciar é rápido e você recebe as conversas no WhatsApp."
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
    </main>
  );
}
