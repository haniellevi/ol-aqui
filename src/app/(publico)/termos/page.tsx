import type { Metadata } from "next";
import { PaginaDocumento, versaoPedida } from "@/components/paginas/pagina-documento";

export const metadata: Metadata = {
  title: "Termos de uso",
  description: "As regras para usar o OLAKI: anúncios, Radar, destaques, pagamentos e o robô Aki.",
  alternates: { canonical: "/termos" },
};

export default async function PaginaTermos({ searchParams }: { searchParams: Promise<{ versao?: string | string[] }> }) {
  return <PaginaDocumento tipo="termos" versao={versaoPedida((await searchParams).versao)} />;
}
