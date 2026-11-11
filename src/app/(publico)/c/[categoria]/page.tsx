import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { categoriaEscondidaPorSlug, categoriaPorSlug } from "@/lib/dados/categorias";
import { Listagem } from "@/components/busca/listagem";
import { CabecalhoCategoria } from "@/components/busca/cabecalho-categoria";
import type { ParametrosUrl } from "@/components/busca/parametros";
import { linkCanonico } from "@/lib/categorias-arvore";

// T4 · Lista de uma categoria (grande, sub ou tipo). Só a grande fica no endereço curto:
// sub e tipo vão para /c/<pai>/<slug>. Slug que saiu do cadastro vai para a lista de categorias.
type Props = { params: Promise<{ categoria: string }>; searchParams: Promise<ParametrosUrl> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const achada = await categoriaPorSlug((await params).categoria);
  if (!achada) return { title: "Categoria não encontrada" };
  const nome = achada.categoria.nome;
  return {
    title: `${nome} à venda`,
    description: `Anúncios de ${nome.toLowerCase()} na sua região. Chame o vendedor direto no WhatsApp.`,
    alternates: { canonical: linkCanonico(achada.caminho) },
  };
}

export default async function PaginaCategoria({ params, searchParams }: Props) {
  const [{ categoria: slug }, sp] = await Promise.all([params, searchParams]);
  const achada = await categoriaPorSlug(slug);
  if (!achada) {
    if (await categoriaEscondidaPorSlug(slug)) redirect("/categorias");
    notFound();
  }
  // sub ou tipo no endereço curto: manda para /c/<pai>/<slug>
  if (achada.pai) redirect(linkCanonico(achada.caminho));
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q) ?? "";

  return (
    <Listagem
      caminho={linkCanonico(achada.caminho)}
      sp={sp}
      categoria={achada}
      categoriaPeloEndereco
      topo={<CabecalhoCategoria achada={achada} q={q} sp={sp} />}
    />
  );
}
