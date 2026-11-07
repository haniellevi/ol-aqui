import type { ComponentProps, ReactNode } from "react";

// Lista de escolha (select) com rótulo visível, 48px e letra 16px, no mesmo jeito do <Campo>.
export function Seletor({
  rotulo,
  name,
  erro,
  dica,
  children,
  ...resto
}: { rotulo: ReactNode; name: string; erro?: string | null; dica?: ReactNode; children: ReactNode } & Omit<
  ComponentProps<"select">,
  "name" | "children"
>) {
  const id = resto.id ?? `campo-${name}`;
  const idErro = erro ? `${id}-erro` : undefined;
  const idDica = dica ? `${id}-dica` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-base font-semibold text-texto">
        {rotulo}
      </label>
      <select
        {...resto}
        id={id}
        name={name}
        aria-invalid={erro ? true : undefined}
        aria-describedby={[idErro, idDica].filter(Boolean).join(" ") || undefined}
        className={`h-12 w-full rounded-campo border-2 bg-cartao px-3 text-base text-texto focus:outline-none focus-visible:border-laranja-escuro focus-visible:ring-2 focus-visible:ring-laranja-escuro/30 ${
          erro ? "border-perigo" : "border-borda"
        }`}
      >
        {children}
      </select>
      {erro && (
        <p id={idErro} role="alert" className="text-sm font-semibold text-perigo">
          {erro}
        </p>
      )}
      {dica && (
        <p id={idDica} className="text-sm text-texto-suave">
          {dica}
        </p>
      )}
    </div>
  );
}
