import { formatarNome } from "@/lib/formatar-nome";
import type { Metadata } from "next";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { anuncioIdPorSlug, anuncioPublico, buscarAnuncios } from "@/lib/dados/anuncios";
import { completarCards } from "@/lib/dados/cards-extra";
import { ehFavorito } from "@/lib/dados/favoritos";
import { seguro } from "@/lib/dados/seguro";
import { ehSlugAnuncio, idDoLinkAnuncio, linkAnuncio, preco, slugDoTitulo } from "@/lib/formato";
import type { AnuncioPublico } from "@/lib/tipos";
import { anuncioForaDoAr } from "@/lib/dados/paginas";
import { AnuncioForaDoAr } from "@/components/paginas/anuncio-fora-do-ar";
import { ConteudoAnuncio } from "./conteudo-anuncio";
import { conversasLigadas } from "@/lib/dados/conversas";

type Props = { params: Promise<{ idslug: string }>; searchParams?: Promise<{ voltar?: string | string[] }> };

/**
 * Acha o anúncio pelo endereço da URL: link curto (/anuncio/<slug>) ou antigo (/anuncio/<id>-<titulo>).
 * `id` vem mesmo quando o anúncio não está público, para a página "fora do ar" saber de qual anúncio se trata.
 */
async function localizar(param: string): Promise<{ id: string | null; a: AnuncioPublico | null; antigo: boolean }> {
  const texto = decodificar(param);
  const idAntigo = idDoLinkAnuncio(texto);
  if (idAntigo) {
    const a = await anuncioPublico(idAntigo);
    if (a) return { id: idAntigo, a, antigo: true };
  }
  const id = ehSlugAnuncio(texto) ? await anuncioIdPorSlug(texto) : null;
  if (id) return { id, a: await anuncioPublico(id), antigo: false };
  return { id: idAntigo, a: null, antigo: false };
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
  const { id, a } = await localizar(idslug);
  if (!a || a.status === "pausado") {
    const fora = !a && id ? await anuncioForaDoAr(id) : null;
    return { title: fora ? "Anúncio fora do ar" : "Anúncio não encontrado", robots: { index: false } };
  }
  const titulo = formatarNome(a.titulo) || "Anúncio";
  const caminho = linkAnuncio(a.id, a.titulo, a.slug);
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
      siteName: "Mercado da Região",
      locale: "pt_BR",
      images: a.fotos[0] ? [{ url: a.fotos[0], alt: titulo }] : undefined,
    },
  };
}

function destinoDeVolta(voltar: string | string[] | undefined) {
  if (typeof voltar !== "string" || voltar.length > 8192) return "/busca";
  if (!/^\/(?:busca|c\/[a-z0-9-]+(?:\/[a-z0-9-]+)?)?(?:\?[^#]*)?$/.test(voltar) || /[\\\u0000-\u001f]/.test(voltar)) return "/busca";
  return voltar;
}

export default async function PaginaAnuncio({ params, searchParams }: Props) {
  const voltarHref = destinoDeVolta((await searchParams)?.voltar);

  const { idslug } = await params;
  const { id, a, antigo } = await localizar(idslug);
  if (a?.status === "pausado") notFound();
  if (!a) {
    // Expirados e anúncios de lojas fora do ar podem mostrar sugestões da categoria.
    const fora = id ? await anuncioForaDoAr(id) : null;
    if (!fora) notFound();
    return <AnuncioForaDoAr categoriaSlug={fora.categoria_slug} categoriaNome={fora.categoria_nome} />;
  }

  const caminho = linkAnuncio(a.id, a.titulo, a.slug);
  // Link antigo (uuid-titulo) de anúncio que já tem endereço curto: 308 para o curto.
  const destinoCanonico = voltarHref === "/busca" ? caminho : `${caminho}?${new URLSearchParams({ voltar: voltarHref })}`;
  if (a.slug && antigo) {
    if (destinoCanonico !== caminho) redirect(destinoCanonico);
    permanentRedirect(caminho);
  }
  // Anúncio sem endereço curto: o link antigo certo é o próprio id-titulo; outro texto → corrige.
  if (!a.slug && decodificar(idslug) !== `${a.id}-${slugDoTitulo(a.titulo)}`) redirect(destinoCanonico);

  const { userId } = await auth();
  const [favorito, parecidosBusca, [extra], conversas] = await Promise.all([
    a.status === "ativo" ? ehFavorito(a.id, userId).catch(() => null) : Promise.resolve(false),
    // Recomendações são secundárias: sua falha não deve impedir o contato do anúncio aberto.
    a.categoria_slug ? seguro(() => buscarAnuncios({ categoria: a.categoria_slug!, limite: 9 }), null) : Promise.resolve(null),
    completarCards([{ id: a.id }]), // preço antes e UF para o card de "Você viu há pouco"
    conversasLigadas(),
  ]);
  const parecidos = (parecidosBusca?.anuncios ?? []).filter((p) => p.id !== a.id).slice(0, 8);
  return <ConteudoAnuncio voltarHref={voltarHref} key={a.id} a={a} favorito={favorito} logado={!!userId} parecidos={parecidos} extra={extra} conversas={conversas} />;
}
