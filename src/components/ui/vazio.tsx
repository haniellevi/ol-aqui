import type { ReactNode } from "react";
import { SearchX } from "lucide-react";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

// Tela vazia: sempre com uma saída (USABILIDADE.md, regra 10). Ponha os botões em `children`.
export function Vazio({
  titulo,
  texto,
  icone,
  children,
  className,
}: {
  titulo: string;
  texto?: ReactNode;
  icone?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <Empty className={className}>
      <EmptyHeader>
        <EmptyMedia variant="icon" aria-hidden>
          {icone ?? <SearchX />}
        </EmptyMedia>
        <EmptyTitle>{titulo}</EmptyTitle>
        {texto && <EmptyDescription>{texto}</EmptyDescription>}
      </EmptyHeader>
      {children && <EmptyContent>{children}</EmptyContent>}
    </Empty>
  );
}
