import type { ReactNode } from "react";
import { SearchX } from "lucide-react";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

// Tela vazia: sempre com uma saída (USABILIDADE.md, regra 10). Ponha os botões em `children`.
// tamanho="grande" = Modo fácil do Radar: título 24px e texto 18px (os botões dentro também em "grande").
export function Vazio({
  titulo,
  texto,
  icone,
  children,
  className,
  tamanho = "normal",
}: {
  titulo: string;
  texto?: ReactNode;
  icone?: ReactNode;
  children?: ReactNode;
  className?: string;
  tamanho?: "normal" | "grande";
}) {
  const grande = tamanho === "grande";
  return (
    <Empty className={className}>
      <EmptyHeader className={grande ? "max-w-md gap-2" : undefined}>
        <EmptyMedia variant="icon" aria-hidden className={grande ? "size-12 [&_svg:not([class*='size-'])]:size-6" : undefined}>
          {icone ?? <SearchX />}
        </EmptyMedia>
        <EmptyTitle className={grande ? "text-facil-titulo" : undefined}>{titulo}</EmptyTitle>
        {texto && <EmptyDescription className={grande ? "text-facil text-texto-suave" : undefined}>{texto}</EmptyDescription>}
      </EmptyHeader>
      {children && <EmptyContent className={grande ? "max-w-md text-facil" : undefined}>{children}</EmptyContent>}
    </Empty>
  );
}
