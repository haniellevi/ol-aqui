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
  "aria-describedby": descricao,
  "aria-invalid": invalido,
  ...resto
}: { rotulo: ReactNode; name: string; erro?: string | null; dica?: ReactNode; tamanho?: "normal" | "toque" | "grande"; children: ReactNode } & Omit<
  ComponentProps<"select">,
  "name" | "children"
>) {
  const id = resto.id ?? `campo-${name}`;
  // "grande" = Modo fácil do Radar: rótulo, erro e dica em 18px.
  const letra = tamanho === "grande" ? "text-facil" : "text-sm";
  const idErro = erro ? `${id}-erro` : undefined;
  const idDica = dica ? `${id}-dica` : undefined;
  return (
    <div className="flex min-w-0 flex-col gap-1 [overflow-wrap:anywhere]">
      <label htmlFor={id} className={`${tamanho === "grande" ? "text-facil" : "text-rotulo"} font-semibold text-texto`}>
        {rotulo}
      </label>
      <NativeSelect
        {...resto}
        className={cn(tamanho === "grande" && "[&>select]:h-12! [&>select]:text-facil", tamanho === "toque" && "[&>select]:h-toque!", resto.className)}
        id={id}
        name={name}
        aria-invalid={erro ? true : invalido}
        aria-describedby={[idErro, idDica, descricao].filter(Boolean).join(" ") || undefined}
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
