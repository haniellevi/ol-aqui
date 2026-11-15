import { formatarNome } from "@/lib/formatar-nome";
import Link from "next/link";
import { ArrowLeft, ChevronRight, Clock, Eye, MapPin, Repeat, ShieldAlert } from "lucide-react";
import { GradeAnuncios } from "@/components/anuncio/grade-anuncios";
import { CartaoVendedor } from "@/components/vitrine/cartao-vendedor";
import { primeiroNome } from "@/components/vitrine/util";
import { classesBotao } from "@/components/ui/botao";
import { inteiro, linkAnuncio, linkCategoria, linkWhatsApp, preco, tempoRelativo, urlAbsoluta, valorDoCampo } from "@/lib/formato";
import type { AnuncioCard, AnuncioPublico, StatusAnuncio } from "@/lib/tipos";
import { Galeria } from "./galeria";
import { BarraContato } from "./barra-contato";
import { RegistrarVisita } from "./registrar-visita";
import { Denunciar } from "./denunciar";
import { CompartilharAnuncio } from "./compartilhar";
import { DescricaoAnuncio } from "./descricao";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { ehTelefoneGuardado } from "@/lib/telefone";

const STATUS_PREVIA: Partial<Record<StatusAnuncio, string>> = {
  rascunho: "Rascunho: ainda não foi publicado.",
  pausado: "Pausado: não aparece na busca.",
  expirado: "Expirado: saiu do ar.",
  em_analise: "Em análise: a equipe está conferindo antes de ir ao ar.",
  congelado: "Congelado: fora do ar até regularizar o plano.",
};

const publico = (a: AnuncioPublico) => a.status === "ativo" || a.status === "vendido";

export function ConteudoAnuncio({ a, favorito, logado, parecidos, extra, conversas = false, voltarHref = "/busca" }: {
  a: AnuncioPublico; favorito: boolean | null; logado: boolean; parecidos: AnuncioCard[];
  /** Preço antes e UF (card de "Você viu há pouco"); sem eles o card mostra só cidade e preço. */
  extra?: { preco_antes_centavos?: number | null; uf?: string | null };
  /** Conversas ligadas no painel: mostra o botão "Conversar". */
  conversas?: boolean;
  voltarHref?: string;
}) {
  const caminho = linkAnuncio(a.id, a.titulo, a.slug);
  const titulo = formatarNome(a.titulo) || "Anúncio sem título";
  const ativo = a.status === "ativo";
  const vendido = a.status === "vendido";
  const caminhoComVolta = voltarHref === "/busca" ? caminho : `${caminho}?${new URLSearchParams({ voltar: voltarHref })}`;
  const entrarHref = `/entrar?redirect_url=${encodeURIComponent(caminhoComVolta)}`;

  const detalhes = a.campos
    .map((c) => ({ c, texto: valorDoCampo(c, a.atributos[c.chave]) }))
    .filter((d) => d.texto);
  const whatsappValido = ehTelefoneGuardado(a.whatsapp);
  const whatsappHref = ativo && whatsappValido && a.whatsapp && !a.e_dono ? linkWhatsApp(a.whatsapp, titulo, urlAbsoluta(caminho)) : null;
  const quando = tempoRelativo(a.criado_em);
  const descricao = (a.descricao ?? "").trim();
  const mostrarBarra = ativo && !a.e_dono;
  const compartilhar = publico(a) ? <CompartilharAnuncio anuncioId={a.id} titulo={titulo} url={urlAbsoluta(caminho)} /> : null;

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
    <main data-comprador data-detalhe-anuncio className={`mx-auto w-full max-w-6xl px-4 md:py-4 ${whatsappHref ? "pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-8" : "pb-8"}`}>
      <Link href={voltarHref} className="inline-flex min-h-controle items-center gap-2 rounded-campo px-1 text-base font-semibold text-beringela focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-laranja-escuro">
        <ArrowLeft className="size-5" aria-hidden /> Voltar
      </Link>
      {jsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      )}
      {ativo && !a.e_dono && (
        <RegistrarVisita
          anuncioId={a.id}
          visto={{
            id: a.id, slug: a.slug ?? null, titulo, preco_centavos: a.preco_centavos, cidade: a.cidade ?? "", capa: a.fotos[0] ?? null,
            criado_em: a.criado_em, destaque: a.destaque, vitrine_nome: a.vitrine_tipo === "pf" ? primeiroNome(a.vitrine_nome) : formatarNome(a.vitrine_nome),
            vitrine_selo: a.vitrine_selo, vitrine_tipo: a.vitrine_tipo,
            preco_antes_centavos: extra?.preco_antes_centavos ?? null, uf: extra?.uf ?? null,
          }}
        />
      )}

      {a.categoria_pai_slug && a.categoria_slug && (
        <nav aria-label="Você está em" className="hidden text-base text-texto-suave md:block">
          <ol className="flex flex-wrap items-center gap-1">
            <li>
              <Link href={linkCategoria(a.categoria_pai_slug)} className="inline-flex min-h-controle items-center underline-offset-4 hover:underline">
                {a.categoria_pai_nome}
              </Link>
            </li>
            <li className="flex items-center gap-1">
              <ChevronRight className="size-4" aria-hidden />
              <Link
                href={linkCategoria(a.categoria_pai_slug, a.categoria_slug)}
                className="inline-flex min-h-controle items-center underline-offset-4 hover:underline"
              >
                {a.categoria_nome}
              </Link>
            </li>
          </ol>
        </nav>
      )}

      {!publico(a) && (
        <Alert variant="warning" role="status" className="mb-3 flex flex-col gap-2">
          <p className="text-base font-semibold">Prévia: só você vê esta página.</p>
          <p className="text-base">{STATUS_PREVIA[a.status] ?? "Fora do ar."}</p>
          {a.e_dono && (
            <Link href="/minha-conta/anuncios" className="inline-flex min-h-controle items-center self-start font-semibold underline underline-offset-4">
              Ir para Meus anúncios
            </Link>
          )}
        </Alert>
      )}

      <div className="grid items-start gap-3 md:grid-cols-[minmax(0,1fr)_minmax(320px,380px)] md:grid-rows-[auto_1fr_auto] md:gap-x-6 md:gap-y-4">
        <header className="flex min-w-0 flex-col gap-1.5 md:col-start-2 md:row-start-1">
          <h1 className="text-titulo font-semibold text-beringela [overflow-wrap:anywhere]">{titulo}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-3xl font-bold text-beringela tabular-nums">{preco(a.preco_centavos)}</p>
            {vendido && <Badge variant="solid" className="font-semibold">Vendido</Badge>}
            {a.destaque && ativo && (
              <Badge variant="featured" className="font-semibold">Patrocinado</Badge>
            )}
          </div>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-texto-suave">
            {a.cidade && (
              <span className="inline-flex max-w-full min-w-0 items-center gap-1">
                <MapPin className="size-4 shrink-0" aria-hidden />
                <span className="min-w-0 [overflow-wrap:anywhere]">{[a.bairro, a.cidade].filter(Boolean).join(", ")}</span>
              </span>
            )}
            {quando && (
              <span className="inline-flex items-center gap-1">
                <Clock className="size-4" aria-hidden />
                {a.status === "rascunho" ? "Criado" : "Publicado"}{" "}
                <time dateTime={a.criado_em} suppressHydrationWarning>
                  {quando}
                </time>
              </span>
            )}
            {a.aceita_troca && (
              <span className="inline-flex items-center gap-1 font-semibold text-verde-escuro">
                <Repeat className="size-4 shrink-0" aria-hidden /> Aceita troca
              </span>
            )}
            {a.e_dono && (
              <span className="inline-flex items-center gap-1">
                <Eye className="size-4" aria-hidden />
                {inteiro(a.visualizacoes)} visualizações
              </span>
            )}
          </p>

          {vendido && (
            <div role="status" className="text-sm text-texto-suave">
              <p>Este anúncio já foi vendido.</p>
              {parecidos.length > 0 && (
                <a href="#parecidos" className={classesBotao("texto", false, "-ml-2", "toque")}>Ver parecidos</a>
              )}
            </div>
          )}
        </header>

        <div className={`min-w-0 md:col-start-1 md:row-span-2 md:row-start-1 ${vendido ? "opacity-80" : ""}`}>
          <Galeria key={a.id} fotos={a.fotos} titulo={titulo} />
        </div>

        <aside aria-label="Vendedor e contato" className="flex min-w-0 flex-col gap-2 md:col-start-2 md:row-start-2">
          <CartaoVendedor v={a} />

          {mostrarBarra && (
            <BarraContato
              anuncioId={a.id}
              whatsappHref={whatsappHref}
              podeFavoritar={ativo}
              favoritoInicial={favorito}
              logado={logado}
              entrarHref={entrarHref}
              conversar={conversas}
              compartilhar={compartilhar}
            />
          )}
          {!mostrarBarra && compartilhar}
          {a.e_dono && (
            <Link href="/minha-conta/anuncios" className={classesBotao("secundario", true, "", "toque")}>
              Este anúncio é seu: ver Meus anúncios
            </Link>
          )}
        </aside>

        <div className="flex min-w-0 flex-col gap-4 md:col-start-1 md:row-start-3 md:gap-5">
          {descricao && (
            <section aria-labelledby="titulo-descricao" className="flex flex-col gap-2">
              <h2 id="titulo-descricao" className="text-lg font-semibold">
                Descrição
              </h2>
              <DescricaoAnuncio texto={descricao} />
            </section>
          )}

          {detalhes.length > 0 && (
            <section aria-labelledby="titulo-detalhes" className="flex flex-col gap-2">
              <h2 id="titulo-detalhes" className="text-lg font-semibold">
                Detalhes
              </h2>
              <dl className="grid grid-cols-2 gap-3 rounded-card border border-borda bg-cartao p-3">
                {detalhes.map(({ c, texto }) => (
                  <div key={c.chave} className="flex min-w-0 flex-col">
                    <dt className="text-sm text-texto-suave">{c.rotulo}</dt>
                    <dd className="text-base font-semibold [overflow-wrap:anywhere]">{texto}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          <Alert variant="warning" role="note" aria-label="Dica de segurança" className="flex gap-2 text-sm">
            <ShieldAlert className="mt-0.5 size-5 shrink-0 text-aviso" aria-hidden />
            <p>
              <strong className="font-semibold">Nunca pague nada antes de ver o produto.</strong> Desconfie de preço muito abaixo do normal e
              combine a entrega em lugar movimentado.
            </p>
          </Alert>

          {parecidos.length > 0 && (
            <section id="parecidos" aria-labelledby="titulo-parecidos" className="flex scroll-mt-20 flex-col gap-3">
              <h2 id="titulo-parecidos" className="text-lg font-semibold">
                Parecidos na região
              </h2>
              <GradeAnuncios anuncios={parecidos} prioridade={0} voltarHref={voltarHref} />
              {a.categoria_pai_slug && a.categoria_slug && (
                <Link
                  href={linkCategoria(a.categoria_pai_slug, a.categoria_slug)}
                  className="inline-flex min-h-controle items-center self-start font-semibold text-laranja-escuro underline-offset-4 hover:underline"
                >
                  Ver todos em {a.categoria_nome}
                </Link>
              )}
            </section>
          )}

          {publico(a) && !a.e_dono && <Denunciar anuncioId={a.id} logado={logado} entrarHref={`/entrar?redirect_url=${encodeURIComponent(`${caminhoComVolta}#denunciar`)}`} />}
        </div>
      </div>
    </main>
  );
}
