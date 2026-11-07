import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { categoriaPorSlug } from "@/lib/dados/categorias";
import { Listagem } from "@/components/busca/listagem";
import { CabecalhoCategoria } from "@/components/busca/cabecalho-categoria";
import type { ParametrosUrl } from "@/components/busca/parametros";
import { linkCategoria } from "@/lib/formato";

// T4 · Lista da subcategoria, com os filtros dos campos dela (ano, km, quartos...).
type Props = { params: Promise<{ categoria: string; sub: string }>; searchParams: Promise<ParametrosUrl> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { categoria, sub } = await params;
  const achada = await categoriaPorSlug(sub);
  if (!achada?.pai) return { title: "Categoria não encontrada" };
  return {
    title: `${achada.categoria.nome} à venda`,
    description: `Anúncios de ${achada.categoria.nome.toLowerCase()} (${achada.pai.nome}) na sua região. Chame o vendedor direto no WhatsApp.`,
    alternates: { canonical: linkCategoria(achada.pai.slug ?? categoria, achada.categoria.slug) },
  };
}

export default async function PaginaSubcategoria({ params, searchParams }: Props) {
  const [{ categoria: paiSlug, sub }, sp] = await Promise.all([params, searchParams]);
  const achada = await categoriaPorSlug(sub);
  if (!achada || !achada.pai) notFound();
  const certo = linkCategoria(achada.pai.slug, achada.categoria.slug);
  if (achada.pai.slug !== paiSlug) redirect(certo);
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q) ?? "";

  return (
    <Listagem caminho={certo} sp={sp} categoria={achada} categoriaPeloEndereco topo={<CabecalhoCategoria achada={achada} q={q} />} />
  );
}
