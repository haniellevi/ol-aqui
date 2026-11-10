import type { ComponentProps, ReactNode } from "react";

// Lista de escolha com rótulo visível e a mesma escala do <Campo>.
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
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-rotulo font-semibold text-texto">
        {rotulo}
      </label>
      <select
        {...resto}
        id={id}
        name={name}
        aria-invalid={erro ? true : undefined}
        aria-describedby={[idErro, idDica].filter(Boolean).join(" ") || undefined}
        className={`olaki-campo h-10 min-w-0 w-full rounded-campo border bg-cartao px-3 text-base font-normal text-texto focus:outline-hidden focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-laranja-escuro disabled:bg-fundo disabled:opacity-70 ${
          erro ? "border-perigo" : "border-borda-campo"
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
