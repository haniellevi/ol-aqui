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
      <span className="grid size-16 place-items-center rounded-full bg-laranja-claro text-beringela [&>svg]:size-8" aria-hidden>
        {icone ?? <SearchX />}
      </span>
      <h2 className="text-lg font-semibold">{titulo}</h2>
      {texto && <p className="max-w-sm text-base text-texto-suave">{texto}</p>}
      {children && <div className="mt-1 flex w-full max-w-sm flex-col gap-2">{children}</div>}
    </section>
  );
}
