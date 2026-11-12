import type { ComponentProps, ReactNode } from "react";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";

// Lista de escolha com rótulo visível e a mesma escala do <Campo>.
export function Seletor({
  rotulo,
  name,
  erro,
  dica,
  tamanho = "normal",
  children,
  ...resto
}: { rotulo: ReactNode; name: string; erro?: string | null; dica?: ReactNode; tamanho?: "normal" | "grande"; children: ReactNode } & Omit<
  ComponentProps<"select">,
  "name" | "children"
>) {
  const id = resto.id ?? `campo-${name}`;
  // "grande" = Modo fácil do Radar: rótulo, erro e dica em 18px.
  const letra = tamanho === "grande" ? "text-facil" : "text-sm";
  const idErro = erro ? `${id}-erro` : undefined;
  const idDica = dica ? `${id}-dica` : undefined;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className={`${tamanho === "grande" ? "text-facil" : "text-rotulo"} font-semibold text-texto`}>
        {rotulo}
      </label>
      <NativeSelect
        {...resto}
        className={tamanho === "grande" ? cn("[&>select]:h-12! [&>select]:text-facil", resto.className) : resto.className}
        id={id}
        name={name}
        aria-invalid={erro ? true : undefined}
        aria-describedby={[idErro, idDica].filter(Boolean).join(" ") || undefined}
      >
        {children}
      </NativeSelect>
      {erro && (
        <p id={idErro} role="alert" className={`${letra} font-semibold text-perigo`}>
          {erro}
        </p>
      )}
      {dica && (
        <p id={idDica} className={`${letra} text-texto-suave`}>
          {dica}
        </p>
      )}
    </div>
  );
}
