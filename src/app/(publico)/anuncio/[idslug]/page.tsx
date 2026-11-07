import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { ChevronRight, Clock, Eye, MapPin, Repeat, ShieldAlert } from "lucide-react";
import { anuncioPublico, buscarAnuncios } from "@/lib/dados/anuncios";
import { createClient } from "@/lib/supabase/server";
import { seguro } from "@/lib/dados/seguro";
import { GradeAnuncios } from "@/components/anuncio/grade-anuncios";
import { CartaoVendedor } from "@/components/vitrine/cartao-vendedor";
import { classesBotao } from "@/components/ui/botao";
import {
  idDoLinkAnuncio,
  inteiro,
  linkAnuncio,
  linkCategoria,
  linkWhatsApp,
  preco,
  slugDoTitulo,
  tempoRelativo,
  urlAbsoluta,
  valorDoCampo,
} from "@/lib/formato";
import type { AnuncioPublico, StatusAnuncio } from "@/lib/tipos";
import { Galeria } from "./galeria";
import { BarraContato } from "./barra-contato";
import { RegistrarVisita } from "./registrar-visita";
import { Denunciar } from "./denunciar";

// T7 · Página do anúncio. Montada no servidor a cada visita (lê a sessão para o coração
// e a prévia do dono). Vendido mostra a faixa "Vendido" e parecidos (F8), nunca erro.

type Props = { params: Promise<{ idslug: string }> };

const STATUS_PREVIA: Partial<Record<StatusAnuncio, string>> = {
  rascunho: "Rascunho: ainda não foi publicado.",
  pausado: "Pausado: não aparece na busca.",
  expirado: "Expirado: saiu do ar.",
  em_analise: "Em análise: a equipe está conferindo antes de ir ao ar.",
  congelado: "Congelado: fora do ar até regularizar o plano.",
};

async function carregar(idslug: string) {
  const id = idDoLinkAnuncio(idslug);
  return id ? anuncioPublico(id) : null;
}

function decodificar(t: string) {
  try {
    return decodeURIComponent(t);
  } catch {
    return t;
  }
}

const publico = (a: AnuncioPublico) => a.status === "ativo" || a.status === "vendido";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const a = await carregar((await params).idslug);
  if (!a) return { title: "Anúncio não encontrado", robots: { index: false } };
  const titulo = a.titulo || "Anúncio";
  const caminho = linkAnuncio(a.id, a.titulo);
  const resumo = `${preco(a.preco_centavos)}${a.cidade ? ` em ${a.cidade}` : ""}. ${(a.descricao ?? "").replace(/\s+/g, " ").slice(0, 140)}`.trim();
  return {
    title: a.status === "vendido" ? `Vendido: ${titulo}` : `${titulo} · ${preco(a.preco_centavos)}`,
    description: resumo,
    alternates: { canonical: caminho },
    robots: publico(a) && a.status === "ativo" ? undefined : { index: false, follow: true },
    openGraph: {
      title: `${titulo} · ${preco(a.preco_centavos)}`,
      description: resumo,
      url: caminho,
      type: "website",
      siteName: "OLAKI",
      locale: "pt_BR",
      images: a.fotos[0] ? [{ url: a.fotos[0], alt: titulo }] : undefined,
    },
  };
}

async function ehFavorito(anuncioId: string, userId: string | null): Promise<boolean> {
  if (!userId) return false;
  return seguro(async () => {
    const db = await createClient();
    const { data } = await db.from("favoritos").select("anuncio_id").eq("usuario_id", userId).eq("anuncio_id", anuncioId).maybeSingle();
    return !!data;
  }, false);
}

export default async function PaginaAnuncio({ params }: Props) {
  const { idslug } = await params;
  const a = await carregar(idslug);
  if (!a) notFound();

  const caminho = linkAnuncio(a.id, a.titulo);
  if (decodificar(idslug) !== `${a.id}-${slugDoTitulo(a.titulo)}`) redirect(caminho); // endereço antigo/errado → o certo

  const titulo = a.titulo || "Anúncio sem título";
  const ativo = a.status === "ativo";
  const vendido = a.status === "vendido";
  const { userId } = await auth();
  const entrarHref = `/entrar?redirect_url=${encodeURIComponent(caminho)}`;

  const [favorito, parecidosBusca] = await Promise.all([
    ativo ? ehFavorito(a.id, userId) : Promise.resolve(false),
    a.categoria_slug ? buscarAnuncios({ categoria: a.categoria_slug, limite: 9 }) : Promise.resolve(null),
  ]);
  const parecidos = (parecidosBusca?.anuncios ?? []).filter((p) => p.id !== a.id).slice(0, 8);

  const detalhes = a.campos
    .map((c) => ({ c, texto: valorDoCampo(c, a.atributos[c.chave]) }))
    .filter((d) => d.texto);
  const whatsappHref = ativo && a.whatsapp && !a.e_dono ? linkWhatsApp(a.whatsapp, titulo, urlAbsoluta(caminho)) : null;
  const quando = tempoRelativo(a.criado_em);
  const descricao = (a.descricao ?? "").trim();
  const descricaoLonga = descricao.length > 320 || descricao.split("\n").length > 5;
  const mostrarBarra = ativo && !a.e_dono;

  const jsonLd = publico(a)
    ? {
        "@context": "https://schema.org",
        "@type": "Product",
        name: titulo,
        description: descricao.slice(0, 500) || undefined,
        image: a.fotos.slice(0, 4),
        category: a.categoria_nome ?? undefined,
        offers: {
          "@type": "Offer",
          url: urlAbsoluta(caminho),
          priceCurrency: "BRL",
          price: a.preco_centavos != null ? (a.preco_centavos / 100).toFixed(2) : undefined,
          availability: vendido ? "https://schema.org/SoldOut" : "https://schema.org/InStock",
        },
      }
    : null;

  return (
    <main className={`mx-auto w-full max-w-6xl md:px-4 md:py-4 ${mostrarBarra ? "pb-24 md:pb-8" : "pb-8"}`}>
      {jsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      )}
      {ativo && !a.e_dono && <RegistrarVisita anuncioId={a.id} />}

      {a.categoria_pai_slug && a.categoria_slug && (
        <nav aria-label="Você está em" className="hidden text-[15px] text-texto-suave md:block">
          <ol className="flex flex-wrap items-center gap-1">
            <li>
              <Link href={linkCategoria(a.categoria_pai_slug)} className="inline-flex min-h-12 items-center underline-offset-4 hover:underline">
                {a.categoria_pai_nome}
              </Link>
            </li>
            <li className="flex items-center gap-1">
              <ChevronRight className="size-4" aria-hidden />
              <Link
                href={linkCategoria(a.categoria_pai_slug, a.categoria_slug)}
                className="inline-flex min-h-12 items-center underline-offset-4 hover:underline"
              >
                {a.categoria_nome}
              </Link>
            </li>
          </ol>
        </nav>
      )}

      {vendido && (
        <div role="status" className="mx-4 mb-3 mt-3 flex flex-col gap-2 rounded-card border-2 border-beringela bg-laranja-claro p-4 md:mx-0 md:mt-0">
          <p className="text-lg font-bold">Vendido</p>
          <p className="text-base">Este anúncio já foi vendido. Veja abaixo outros parecidos na região.</p>
          {parecidos.length > 0 && (
            <a href="#parecidos" className={classesBotao("primario", true, "sm:w-auto sm:self-start")}>
              Ver parecidos
            </a>
          )}
        </div>
      )}

      {!publico(a) && (
        <div role="status" className="mx-4 mb-3 mt-3 flex flex-col gap-2 rounded-card bg-aviso-fundo p-4 text-aviso md:mx-0 md:mt-0">
          <p className="text-base font-semibold">Prévia: só você vê esta página.</p>
          <p className="text-base">{STATUS_PREVIA[a.status] ?? "Fora do ar."}</p>
          {a.e_dono && (
            <Link href="/minha-conta/anuncios" className="inline-flex min-h-12 items-center self-start font-semibold underline underline-offset-4">
              Ir para Meus anúncios
            </Link>
          )}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(320px,380px)] md:gap-6">
        <div className={vendido ? "opacity-80" : undefined}>
          <Galeria fotos={a.fotos} titulo={titulo} />
        </div>

        <aside className="flex flex-col gap-4 px-4 md:row-span-2 md:px-0">
          <div className="flex flex-col gap-2 md:sticky md:top-20">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-2xl font-bold leading-[30px]">{preco(a.preco_centavos)}</p>
              {vendido && <span className="rounded-full bg-beringela px-3 py-0.5 text-[13px] font-bold text-white">Vendido</span>}
              {a.destaque && ativo && (
                <span className="rounded-full bg-patrocinado-fundo px-3 py-0.5 text-[13px] font-bold text-beringela">Patrocinado</span>
              )}
            </div>
            {a.aceita_troca && (
              <p className="flex items-center gap-1.5 text-base font-semibold text-verde-escuro">
                <Repeat className="size-5" aria-hidden /> Aceita troca
              </p>
            )}
            <h1 className="text-[22px] font-semibold leading-7">{titulo}</h1>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[15px] text-texto-suave">
              {a.cidade && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-4" aria-hidden />
                  {[a.bairro, a.cidade].filter(Boolean).join(", ")}
                </span>
              )}
              {quando && (
                <span className="inline-flex items-center gap-1">
                  <Clock className="size-4" aria-hidden />
                  Publicado{" "}
                  <time dateTime={a.criado_em} suppressHydrationWarning>
                    {quando}
                  </time>
                </span>
              )}
              {a.e_dono && (
                <span className="inline-flex items-center gap-1">
                  <Eye className="size-4" aria-hidden />
                  {inteiro(a.visualizacoes)} visualizações
                </span>
              )}
            </p>

            {mostrarBarra && (
              <div className="mt-2">
                <BarraContato
                  anuncioId={a.id}
                  whatsappHref={whatsappHref}
                  podeFavoritar={ativo}
                  favoritoInicial={favorito}
                  logado={!!userId}
                  entrarHref={entrarHref}
                />
              </div>
            )}
            {a.e_dono && (
              <Link href="/minha-conta/anuncios" className={classesBotao("secundario", true, "mt-2")}>
                Este anúncio é seu: ver Meus anúncios
              </Link>
            )}

            <div className="mt-2 hidden md:block">
              <CartaoVendedor v={a} />
            </div>
          </div>
        </aside>

        <div className="flex flex-col gap-5 px-4 md:px-0">
          {detalhes.length > 0 && (
            <section aria-labelledby="titulo-detalhes" className="flex flex-col gap-2">
              <h2 id="titulo-detalhes" className="text-lg font-semibold">
                Detalhes
              </h2>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-card bg-cartao p-4 shadow-1">
                {detalhes.map(({ c, texto }) => (
                  <div key={c.chave} className="flex min-w-0 flex-col">
                    <dt className="text-[13px] text-texto-suave">{c.rotulo}</dt>
                    <dd className="break-words text-base font-semibold">{texto}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {descricao && (
            <section aria-labelledby="titulo-descricao" className="flex flex-col gap-2">
              <h2 id="titulo-descricao" className="text-lg font-semibold">
                Descrição
              </h2>
              {descricaoLonga ? (
                <div className="flex flex-col">
                  <input id="ver-mais-descricao" type="checkbox" className="peer sr-only" />
                  <p className="line-clamp-5 whitespace-pre-line break-words text-base leading-6 peer-checked:line-clamp-none">{descricao}</p>
                  <label
                    htmlFor="ver-mais-descricao"
                    className="mt-1 inline-flex min-h-12 cursor-pointer items-center self-start rounded-card px-1 font-semibold text-laranja-escuro underline-offset-4 hover:underline peer-checked:hidden peer-focus-visible:outline-3 peer-focus-visible:outline-laranja-escuro"
                  >
                    Ver mais
                  </label>
                </div>
              ) : (
                <p className="whitespace-pre-line break-words text-base leading-6">{descricao}</p>
              )}
            </section>
          )}

          <aside aria-label="Dica de segurança" className="flex gap-3 rounded-card bg-aviso-fundo p-4 text-[15px] leading-6 text-beringela">
            <ShieldAlert className="mt-0.5 size-6 shrink-0 text-aviso" aria-hidden />
            <p>
              <strong className="font-semibold">Nunca pague nada antes de ver o produto.</strong> Desconfie de preço muito abaixo do normal e
              combine a entrega em lugar movimentado.
            </p>
          </aside>

          <div className="md:hidden">
            <h2 className="sr-only">Vendedor</h2>
            <CartaoVendedor v={a} />
          </div>

          {parecidos.length > 0 && (
            <section id="parecidos" aria-labelledby="titulo-parecidos" className="flex scroll-mt-20 flex-col gap-3">
              <h2 id="titulo-parecidos" className="text-lg font-semibold">
                Parecidos na região
              </h2>
              <GradeAnuncios anuncios={parecidos} prioridade={0} />
              {a.categoria_pai_slug && a.categoria_slug && (
                <Link
                  href={linkCategoria(a.categoria_pai_slug, a.categoria_slug)}
                  className="inline-flex min-h-12 items-center self-start font-semibold text-laranja-escuro underline-offset-4 hover:underline"
                >
                  Ver todos em {a.categoria_nome}
                </Link>
              )}
            </section>
          )}

          {publico(a) && !a.e_dono && <Denunciar anuncioId={a.id} logado={!!userId} entrarHref={`/entrar?redirect_url=${encodeURIComponent(`${caminho}#denunciar`)}`} />}
        </div>
      </div>
    </main>
  );
}
