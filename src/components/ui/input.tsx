import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { cn } from "@/lib/utils"

// Caixa de campo do Mercado da Região: uma só para input, textarea e select.
// 44px e letra de 16px no toque; `olaki-campo` baixa para 36px e 14px com mouse (DESIGN.md, seção 4).
// Erro vem de aria-invalid.
export const classesCampo =
  "olaki-campo w-full min-w-0 rounded-campo border border-input bg-card px-3 text-lg font-normal pointer-fine:md:text-base text-foreground outline-none transition-colors " +
  "placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 " +
  "aria-invalid:border-destructive disabled:cursor-not-allowed disabled:bg-fundo disabled:opacity-70"

// Campo com peça junto (ex.: a busca com a lupa): a caixa vai no grupo e a entrada fica sem borda.
// Altura fixa de 44px também com mouse (DESIGN.md, seção 4: barra de busca).
export const classesGrupoCampo =
  "relative flex h-controle w-full min-w-0 items-center rounded-campo border border-input bg-card pl-3 transition-colors " +
  "focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30"

export const classesEntradaGrupo =
  "h-full min-w-0 flex-1 bg-transparent text-lg font-normal pointer-fine:md:text-base text-foreground outline-none placeholder:text-muted-foreground"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(classesCampo, "h-controle", className)}
      {...props}
    />
  )
}

export { Input }
