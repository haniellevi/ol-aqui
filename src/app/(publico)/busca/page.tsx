import type { Metadata } from "next";
import { categoriaPorSlug } from "@/lib/dados/categorias";
import { CampoBusca } from "@/components/busca/campo-busca";
import { Listagem } from "@/components/busca/listagem";
import type { ParametrosUrl } from "@/components/busca/parametros";

// T5 · Resultado da busca. Sempre montada na hora (resultado atual).
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<ParametrosUrl> };

function termo(sp: ParametrosUrl) {
  const q = Array.isArray(sp.q) ? sp.q[0] : sp.q;
  return (q ?? "").trim().slice(0, 120);
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const q = termo(await searchParams);
  return {
    title: q ? `${q}: anúncios` : "Buscar anúncios",
    description: q ? `Anúncios de ${q} na sua região no Mercado da Região.` : "Busque o que você precisa na sua região.",
    robots: { index: false, follow: true },
  };
}

export default async function PaginaBusca({ searchParams }: Props) {
  const sp = await searchParams;
  const q = termo(sp);
  const slug = (Array.isArray(sp.categoria) ? sp.categoria[0] : sp.categoria)?.trim().toLowerCase() ?? "";
  const categoria = slug ? await categoriaPorSlug(slug) : null;

  return (
    <Listagem
      caminho="/busca"
      sp={sp}
      categoria={categoria}
      categoriaPeloEndereco={false}
      topo={
        <>
          <h1 className="text-titulo font-semibold">{q ? `Resultados para “${q}”` : "Buscar anúncios"}</h1>
          <p className="text-base text-texto-suave">Combine categoria, cidade e preço para encontrar o que precisa.</p>
          <CampoBusca valor={q} manter={sp} />
        </>
      }
    />
  );
}
