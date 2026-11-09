import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { anuncioPublico, buscarAnuncios } from "@/lib/dados/anuncios";
import { createClient } from "@/lib/supabase/server";
import { seguro } from "@/lib/dados/seguro";
import { idDoLinkAnuncio, linkAnuncio, preco, slugDoTitulo } from "@/lib/formato";
import type { AnuncioPublico } from "@/lib/tipos";
import { anuncioForaDoAr } from "@/lib/dados/paginas";
import { AnuncioForaDoAr } from "@/components/paginas/anuncio-fora-do-ar";
import { ConteudoAnuncio } from "./conteudo-anuncio";

type Props = { params: Promise<{ idslug: string }> };

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
  const { idslug } = await params;
  const a = await carregar(idslug);
  if (!a) {
    const id = idDoLinkAnuncio(idslug);
    const fora = id ? await anuncioForaDoAr(id) : null;
    return { title: fora ? "Anúncio fora do ar" : "Anúncio não encontrado", robots: { index: false } };
  }
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
  if (!a) {
    // pausado/expirado: "saiu do ar" com parecidos em vez de erro (T44); senão, não encontrado
    const id = idDoLinkAnuncio(idslug);
    const fora = id ? await anuncioForaDoAr(id) : null;
    if (!fora) notFound();
    return <AnuncioForaDoAr categoriaSlug={fora.categoria_slug} categoriaNome={fora.categoria_nome} />;
  }

  const caminho = linkAnuncio(a.id, a.titulo);
  if (decodificar(idslug) !== `${a.id}-${slugDoTitulo(a.titulo)}`) redirect(caminho); // endereço antigo/errado → o certo

  const { userId } = await auth();
  const [favorito, parecidosBusca] = await Promise.all([
    a.status === "ativo" ? ehFavorito(a.id, userId) : Promise.resolve(false),
    // Recomendações são secundárias: sua falha não deve impedir o contato do anúncio aberto.
    a.categoria_slug ? seguro(() => buscarAnuncios({ categoria: a.categoria_slug!, limite: 9 }), null) : Promise.resolve(null),
  ]);
  const parecidos = (parecidosBusca?.anuncios ?? []).filter((p) => p.id !== a.id).slice(0, 8);
  return <ConteudoAnuncio key={a.id} a={a} favorito={favorito} logado={!!userId} parecidos={parecidos} />;
}
