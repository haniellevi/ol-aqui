import type { ComponentProps, ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

// Campo de formulário: rótulo sempre visível, letra 16px (evita zoom do iPhone),
// erro escrito embaixo (não só borda vermelha) e dica opcional.

type Comum = {
  /** Texto do rótulo (obrigatório: todo campo tem nome). */
  rotulo: ReactNode;
  name: string;
  /** Mensagem de erro (vira aria-invalid e é lida pelo leitor de tela). */
  erro?: string | null;
  /** Ajuda curta embaixo do campo. */
  dica?: ReactNode;
  /** Texto fixo antes do valor, ex.: "R$". */
  prefixo?: ReactNode;
  /** Mostra "(opcional)" ao lado do rótulo. */
  opcional?: boolean;
  /** "grande" = Modo fácil do Radar: rótulo, texto, erro e dica em 18px e caixa de 48px. */
  tamanho?: "normal" | "grande";
  className?: string;
};

type ComoInput = Comum & Omit<ComponentProps<"input">, "name" | "className"> & { multilinha?: false };
type ComoTexto = Comum & Omit<ComponentProps<"textarea">, "name" | "className"> & { multilinha: true };

export type CampoProps = ComoInput | ComoTexto;

/** Use `multilinha` para descrição (textarea). Os outros props vão direto para o input. */
export function Campo(props: CampoProps) {
  const { rotulo, name, erro, dica, prefixo, opcional, tamanho = "normal", className = "", id: idProp, multilinha, ...resto } = props;
  const grande = tamanho === "grande";
  const letra = grande ? "text-facil" : "text-sm";
  const id = idProp ?? `campo-${name}`;
  const idDica = dica ? `${id}-dica` : undefined;
  const idErro = erro ? `${id}-erro` : undefined;
  const descritoPor = [idErro, idDica].filter(Boolean).join(" ") || undefined;
  const aria = { "aria-invalid": erro ? true : undefined, "aria-describedby": descritoPor };

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label htmlFor={id} className={`${grande ? "text-facil" : "text-rotulo"} font-semibold text-texto`}>
        {rotulo}
        {opcional && <span className="ml-1 font-normal text-texto-suave">(opcional)</span>}
      </label>
      <div className="relative">
        {prefixo && (
          <span className={`pointer-events-none absolute inset-y-0 left-3 flex items-center ${grande ? "text-facil" : "text-base"} font-semibold text-texto-suave`}>
            {prefixo}
          </span>
        )}
        {multilinha ? (
          <Textarea {...(resto as ComponentProps<"textarea">)} {...aria} id={id} name={name} className={grande ? "text-facil leading-7" : undefined} />
        ) : (
          <Input {...(resto as ComponentProps<"input">)} {...aria} id={id} name={name} className={cn(prefixo && (grande ? "pl-12" : "pl-11"), grande && "h-12! text-facil")} />
        )}
      </div>
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
