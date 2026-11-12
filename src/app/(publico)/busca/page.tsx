import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { categoriaPorSlug } from "@/lib/dados/categorias";
import { CampoBusca } from "@/components/busca/campo-busca";
import { Listagem } from "@/components/busca/listagem";
import type { ParametrosUrl } from "@/components/busca/parametros";
import { MarcarBusca } from "@/components/busca/marcar-busca";
import { enderecoEntendido } from "@/components/busca/entender";
import { comParametros } from "@/components/busca/parametros";

// T5 · Resultado da busca. Sempre montada na hora (resultado atual).
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<ParametrosUrl> };

function texto(v: string | string[] | undefined) {
  return ((Array.isArray(v) ? v[0] : v) ?? "").trim().slice(0, 120);
}

/** O que a pessoa digitou: se a busca foi "entendida" (ia=...), é o texto original e não o que sobrou. */
function termo(sp: ParametrosUrl) {
  return texto(sp.ia) || texto(sp.q);
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
  // Busca que entende (JEV): só ao enviar o texto, sem filtros no endereço e sem "buscar só pelo texto".
  const digitado = texto(sp.q);
  if (digitado && !sp.ia && !sp.sem_ia) {
    const destino = await enderecoEntendido(sp, digitado);
    if (destino) redirect(destino);
  }
  const q = termo(sp);
  const entendeu = !!texto(sp.ia);
  const slug = (Array.isArray(sp.categoria) ? sp.categoria[0] : sp.categoria)?.trim().toLowerCase() ?? "";
  const categoria = slug ? await categoriaPorSlug(slug) : null;

  return (
    <>
      <Listagem
        caminho="/busca"
        sp={sp}
        categoria={categoria}
        categoriaPeloEndereco={false}
        topo={
          <>
            <h1 className="text-titulo font-semibold">{q ? `Resultados para “${q}”` : "Buscar anúncios"}</h1>
            <CampoBusca valor={q} manter={sp} sugestoes />
            {entendeu && (
              <p className="text-sm text-texto-suave">
                Entendi sua busca e já marquei os filtros abaixo. Toque num filtro para tirar.{" "}
                <Link
                  href={comParametros("/busca", { q: texto(sp.ia), sem_ia: "1" })}
                  className="inline-flex min-h-10 items-center font-semibold text-laranja-escuro underline underline-offset-4 focus-visible:outline-3 focus-visible:outline-laranja-escuro"
                >
                  Buscar só pelas palavras
                </Link>
              </p>
            )}
          </>
        }
      />
      {q && <MarcarBusca termo={q} />}
    </>
  );
}
