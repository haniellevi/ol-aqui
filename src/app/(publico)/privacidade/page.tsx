import type { Metadata } from "next";
import { PaginaDocumento, versaoPedida } from "@/components/paginas/pagina-documento";

export const metadata: Metadata = {
  title: "Política de privacidade",
  description: "Quais dados o Mercado da Região usa, para quê, com quem divide e como você baixa ou apaga seus dados (LGPD).",
  alternates: { canonical: "/privacidade" },
};

export default async function PaginaPrivacidade({ searchParams }: { searchParams: Promise<{ versao?: string | string[] }> }) {
  return <PaginaDocumento tipo="privacidade" versao={versaoPedida((await searchParams).versao)} />;
}
