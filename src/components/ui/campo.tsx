import type { ComponentProps, ReactNode } from "react";

// Campo de formulário: rótulo sempre visível, letra 16px (evita zoom do iPhone),
// erro escrito embaixo (não só borda vermelha) e dica opcional.

const ESTILO_CAIXA =
  "olaki-campo w-full rounded-campo border bg-cartao px-3 text-base font-normal text-texto placeholder:text-texto-suave " +
  "focus:outline-hidden focus-visible:border-laranja-escuro focus-visible:ring-2 focus-visible:ring-laranja-escuro/30 " +
  "disabled:bg-fundo disabled:opacity-70";

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
  className?: string;
};

type ComoInput = Comum & Omit<ComponentProps<"input">, "name" | "className"> & { multilinha?: false };
type ComoTexto = Comum & Omit<ComponentProps<"textarea">, "name" | "className"> & { multilinha: true };

export type CampoProps = ComoInput | ComoTexto;

/** Use `multilinha` para descrição (textarea). Os outros props vão direto para o input. */
export function Campo(props: CampoProps) {
  const { rotulo, name, erro, dica, prefixo, opcional, className = "", id: idProp, multilinha, ...resto } = props;
  const id = idProp ?? `campo-${name}`;
  const idDica = dica ? `${id}-dica` : undefined;
  const idErro = erro ? `${id}-erro` : undefined;
  const descritoPor = [idErro, idDica].filter(Boolean).join(" ") || undefined;
  const borda = erro ? "border-perigo" : "border-borda-campo";
  const aria = { "aria-invalid": erro ? true : undefined, "aria-describedby": descritoPor };

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label htmlFor={id} className="text-rotulo font-semibold text-texto">
        {rotulo}
        {opcional && <span className="ml-1 font-normal text-texto-suave">(opcional)</span>}
      </label>
      <div className="relative">
        {prefixo && (
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-base font-semibold text-texto-suave">
            {prefixo}
          </span>
        )}
        {multilinha ? (
          <textarea
            {...(resto as ComponentProps<"textarea">)}
            {...aria}
            id={id}
            name={name}
            className={`${ESTILO_CAIXA} ${borda} min-h-24 resize-y py-2 leading-6`}
          />
        ) : (
          <input
            {...(resto as ComponentProps<"input">)}
            {...aria}
            id={id}
            name={name}
            className={`${ESTILO_CAIXA} ${borda} h-10 ${prefixo ? "pl-11" : ""}`}
          />
        )}
      </div>
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
