import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { vitrinePorSlug } from "@/lib/dados/vitrines";
import { anunciosDaVitrine } from "@/lib/dados/anuncios";
import { CabecalhoVitrine } from "@/components/vitrine/cabecalho-vitrine";
import { GradeAnuncios } from "@/components/anuncio/grade-anuncios";
import { Vazio } from "@/components/ui/vazio";
import { Botao } from "@/components/ui/botao";
import { inteiro, linkLoja, urlAbsoluta } from "@/lib/formato";

// T10 · Vitrine da loja: olaki.com.br/loja/<slug>. Serve de "site grátis" da loja.
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const v = await vitrinePorSlug((await params).slug);
  if (!v) return { title: "Loja não encontrada", robots: { index: false } };
  const descricao = (v.descricao ?? "").replace(/\s+/g, " ").slice(0, 150) || `Veja os anúncios de ${v.nome} em ${v.cidade} e chame no WhatsApp.`;
  return {
    title: `${v.nome} · ${v.cidade}`,
    description: descricao,
    alternates: { canonical: linkLoja(v.slug) },
    robots: v.status === "ativa" ? undefined : { index: false },
    openGraph: {
      title: v.nome,
      description: descricao,
      url: linkLoja(v.slug),
      siteName: "OLAKI",
      locale: "pt_BR",
      images: v.capa_url ? [{ url: v.capa_url }] : v.logo_url ? [{ url: v.logo_url }] : undefined,
    },
  };
}

export default async function PaginaLoja({ params }: Props) {
  const v = await vitrinePorSlug((await params).slug);
  if (!v) notFound();
  const anuncios = await anunciosDaVitrine(v);
  const numero = (v.whatsapp ?? "").replace(/\D/g, "");
  const whatsapp = numero
    ? `https://wa.me/${numero}?text=${encodeURIComponent(`Olá! Vi sua loja no OLAKI: ${urlAbsoluta(linkLoja(v.slug))}`)}`
    : null;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 pb-8 md:px-4 md:py-4">
      {v.status !== "ativa" && (
        <p role="status" className="mx-4 mt-3 rounded-card bg-aviso-fundo p-4 text-base font-semibold text-aviso md:mx-0 md:mt-0">
          Sua vitrine está fora do ar ({v.status === "suspensa" ? "suspensa" : "plano vencido"}). Só você está vendo esta página.
        </p>
      )}
      <CabecalhoVitrine
        rotulo="Loja"
        nome={v.nome}
        logo={v.logo_url}
        capa={v.capa_url}
        selo={v.selo_loja_verificada}
        cidade={v.cidade}
        bairro={v.bairro}
        criadoEm={v.criado_em}
        descricao={v.descricao}
      >
        {whatsapp && (
          <a
            href={whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-card bg-verde-escuro px-5 text-base font-semibold text-white transition-colors hover:brightness-95 active:brightness-90 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-laranja-escuro sm:w-auto sm:self-start"
          >
            <MessageCircle className="size-5" aria-hidden />
            Chamar a loja no WhatsApp
          </a>
        )}
      </CabecalhoVitrine>

      <section aria-labelledby="titulo-anuncios-loja" className="flex flex-col gap-3 px-4 md:px-0">
        <h2 id="titulo-anuncios-loja" className="text-lg font-semibold">
          {anuncios.length ? `${inteiro(anuncios.length)} ${anuncios.length === 1 ? "anúncio" : "anúncios"}` : "Anúncios"}
        </h2>
        <GradeAnuncios
          anuncios={anuncios}
          vazio={
            <Vazio titulo="Esta loja ainda não tem anúncio no ar." texto="Volte daqui a pouco ou veja outros anúncios da região.">
              <Botao href="/" larguraTotal>
                Ver anúncios da região
              </Botao>
            </Vazio>
          }
        />
      </section>
    </main>
  );
}
