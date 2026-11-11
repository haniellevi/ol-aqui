import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { categoriaEscondidaPorSlug, categoriaPorSlug } from "@/lib/dados/categorias";
import { Listagem } from "@/components/busca/listagem";
import { CabecalhoCategoria } from "@/components/busca/cabecalho-categoria";
import type { ParametrosUrl } from "@/components/busca/parametros";
import { linkCanonico, nomeCaminho } from "@/lib/categorias-arvore";

// T4 · Lista de uma sub ou tipo, em /c/<pai>/<filho> (o filho é filha direta do pai no endereço).
// Par que não bate (categoria que mudou de lugar) segue para o endereço certo; nunca 404 de slug existente.
type Props = { params: Promise<{ categoria: string; sub: string }>; searchParams: Promise<ParametrosUrl> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { sub } = await params;
  const achada = await categoriaPorSlug(sub);
  if (!achada) return { title: "Categoria não encontrada" };
  return {
    title: `${achada.categoria.nome} à venda`,
    description: `Anúncios de ${achada.categoria.nome.toLowerCase()} (${nomeCaminho(achada.caminho.slice(0, -1))}) na sua região. Chame o vendedor direto no WhatsApp.`,
    alternates: { canonical: linkCanonico(achada.caminho) },
  };
}

export default async function PaginaSubcategoria({ params, searchParams }: Props) {
  const [{ categoria: paiSlug, sub }, sp] = await Promise.all([params, searchParams]);
  const achada = await categoriaPorSlug(sub);
  if (!achada) {
    if (await categoriaEscondidaPorSlug(sub)) redirect("/categorias");
    notFound();
  }
  const certo = linkCanonico(achada.caminho);
  if (!achada.pai || achada.pai.slug !== paiSlug) redirect(certo);
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q) ?? "";

  return (
    <Listagem caminho={certo} sp={sp} categoria={achada} categoriaPeloEndereco topo={<CabecalhoCategoria achada={achada} q={q} sp={sp} />} />
  );
}
