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
    <section className={`flex flex-col items-center gap-3 rounded-card bg-cartao p-6 text-center shadow-1 ${className}`}>
      <span className="grid size-14 place-items-center rounded-full bg-selecao text-beringela [&>svg]:size-6" aria-hidden>
        {icone ?? <SearchX />}
      </span>
      <h2 className="text-base font-semibold text-beringela">{titulo}</h2>
      {texto && <p className="max-w-sm text-base text-texto-suave">{texto}</p>}
      {children && <div className="mt-1 flex w-full max-w-sm flex-col gap-2">{children}</div>}
    </section>
  );
}
