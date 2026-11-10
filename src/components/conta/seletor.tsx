import type { ComponentProps, ReactNode } from "react";
import { NativeSelect } from "@/components/ui/native-select";

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
      <NativeSelect
        {...resto}
        id={id}
        name={name}
        aria-invalid={erro ? true : undefined}
        aria-describedby={[idErro, idDica].filter(Boolean).join(" ") || undefined}
      >
        {children}
      </NativeSelect>
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
