import type { ReactNode } from "react";
import { SearchX } from "lucide-react";

// Tela vazia: sempre com uma saída (USABILIDADE.md, regra 10). Ponha os botões em `children`.
export function Vazio({
  titulo,
  texto,
  icone,
  children,
  className = "",
}: {
  titulo: string;
  texto?: ReactNode;
  icone?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`flex flex-col items-center gap-2 rounded-card border border-borda bg-cartao p-4 text-center ${className}`}>
      <span className="grid size-10 place-items-center rounded-full bg-selecao text-beringela [&>svg]:size-5" aria-hidden>
        {icone ?? <SearchX />}
      </span>
      <h2 className="text-balance text-base font-semibold text-beringela">{titulo}</h2>
      {texto && <p className="max-w-sm text-pretty text-sm text-texto-suave">{texto}</p>}
      {children && <div className="mt-1 flex w-full max-w-sm flex-col items-center gap-2">{children}</div>}
    </section>
  );
}
