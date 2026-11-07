import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { categoriaPorSlug } from "@/lib/dados/categorias";
import { Listagem } from "@/components/busca/listagem";
import { CabecalhoCategoria } from "@/components/busca/cabecalho-categoria";
import type { ParametrosUrl } from "@/components/busca/parametros";
import { linkCategoria } from "@/lib/formato";

// T4 · Lista de uma categoria pai (inclui todas as subcategorias).
type Props = { params: Promise<{ categoria: string }>; searchParams: Promise<ParametrosUrl> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const achada = await categoriaPorSlug((await params).categoria);
  if (!achada) return { title: "Categoria não encontrada" };
  const nome = achada.categoria.nome;
  return {
    title: `${nome} à venda`,
    description: `Anúncios de ${nome.toLowerCase()} na sua região. Chame o vendedor direto no WhatsApp.`,
    alternates: { canonical: linkCategoria(achada.pai?.slug ?? achada.categoria.slug, achada.pai ? achada.categoria.slug : null) },
  };
}

export default async function PaginaCategoria({ params, searchParams }: Props) {
  const [{ categoria: slug }, sp] = await Promise.all([params, searchParams]);
  const achada = await categoriaPorSlug(slug);
  if (!achada) notFound();
  // subcategoria no endereço curto: manda para /c/pai/sub
  if (achada.pai) redirect(linkCategoria(achada.pai.slug, achada.categoria.slug));
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q) ?? "";

  return (
    <Listagem
      caminho={linkCategoria(achada.categoria.slug)}
      sp={sp}
      categoria={achada}
      categoriaPeloEndereco
      topo={<CabecalhoCategoria achada={achada} q={q} />}
    />
  );
}
