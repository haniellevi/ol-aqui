import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";

// Topo das telas de "Minha conta": voltar (48px) + título + texto curto opcional.
export function TopoConta({
  titulo,
  texto,
  voltar = "/minha-conta",
  textoVoltar = "Minha conta",
  children,
}: {
  titulo: string;
  texto?: ReactNode;
  /** Para onde o "Voltar" leva (padrão: Minha conta). */
  voltar?: string | null;
  textoVoltar?: string;
  children?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-2">
      {voltar && (
        <Link
          href={voltar}
          className="-ml-2 inline-flex min-h-12 w-fit items-center gap-1 rounded-campo px-2 text-rotulo font-semibold text-texto-suave hover:text-texto focus-visible:outline-3 focus-visible:outline-laranja-escuro"
        >
          <ChevronLeft className="size-5" aria-hidden />
          {textoVoltar}
        </Link>
      )}
      <h1 className="text-titulo font-semibold text-beringela [overflow-wrap:anywhere]">{titulo}</h1>
      {texto && <p className="max-w-[65ch] text-base leading-6 text-texto-suave">{texto}</p>}
      {children}
    </header>
  );
}

/** Contêiner padrão das telas da conta (celular primeiro, 16px de margem). */
export function PaginaConta({ children, larga = false }: { children: ReactNode; larga?: boolean }) {
  return (
    <main className={`mx-auto flex w-full ${larga ? "max-w-5xl" : "max-w-xl"} flex-col gap-5 px-4 py-6`}>{children}</main>
  );
}
